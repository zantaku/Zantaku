import { useState, useEffect, useCallback } from 'react';
import { discordSupabase } from '../lib/discord_auth';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import Constants from 'expo-constants';

interface DiscordUser {
  id: string;
  username: string;
  discriminator: string;
  avatar: string | null;
  email?: string;
}

interface DiscordAuthState {
  user: DiscordUser | null;
  loading: boolean;
  error: string | null;
}

// Initialize WebBrowser
WebBrowser.maybeCompleteAuthSession();

export const useDiscordAuth = () => {
  const [state, setState] = useState<DiscordAuthState>({
    user: null,
    loading: false,
    error: null,
  });

  // Get the appropriate redirect URI based on environment
  const getRedirectUri = () => {
    const isDevelopment = __DEV__ && Constants.appOwnership === 'expo';
    
    if (isDevelopment) {
      // For Expo Go development
      const debuggerHost = Constants.expoConfig?.hostUri?.split(':')[0];
      const port = Constants.expoConfig?.hostUri?.split(':')[1] || '8081';
      return `exp://${debuggerHost}:${port}/--/auth/discord/callback`;
    } else {
      // For production builds
      return 'kamilist://auth/discord/callback';
    }
  };

  const signInWithDiscord = async () => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));
      
      const redirectUri = getRedirectUri();
      console.log('🚀 Starting Discord OAuth flow with official Supabase...');
      console.log('📍 Using redirect URI:', redirectUri);
      console.log('🔷 Using Discord Supabase client');
      
      const { data, error } = await discordSupabase.auth.signInWithOAuth({
        provider: 'discord',
        options: {
          redirectTo: redirectUri,
          scopes: 'identify email',
        },
      });

      if (error) {
        console.error('❌ Discord OAuth error:', error);
        setState(prev => ({ ...prev, error: error.message, loading: false }));
        return false;
      }

      console.log('✅ Discord OAuth initiated successfully with official Supabase');
      console.log('🔗 OAuth data:', data);

      // Open the authorization URL in the browser
      if (data?.url) {
        console.log('🌐 Opening Discord authorization URL in browser...');
        console.log('🔗 Full authorization URL:', data.url);
        
        try {
          const result = await WebBrowser.openAuthSessionAsync(
            data.url,
            redirectUri,
            {
              showInRecents: true,
              preferEphemeralSession: false, // Changed to false
              createTask: false
            }
          );

          console.log('🔄 Browser auth session result:', result);

          if (result.type === 'success') {
            console.log('✅ User completed Discord authorization');
            // The auth state change listener will handle the callback
            return true;
          } else if (result.type === 'cancel') {
            console.log('❌ User cancelled Discord authorization');
            setState(prev => ({ ...prev, loading: false }));
            return false;
          } else {
            console.log('❌ Discord authorization failed:', result);
            setState(prev => ({ ...prev, loading: false }));
            return false;
          }
        } catch (browserError) {
          console.error('❌ Error opening browser:', browserError);
          // Fallback: try opening with a simpler method
          console.log('🔄 Trying fallback browser opening...');
          await WebBrowser.openBrowserAsync(data.url);
          // Don't change loading state, let the auth state listener handle it
          return true;
        }
      } else {
        console.error('❌ No authorization URL received from Supabase');
        setState(prev => ({ ...prev, loading: false }));
        return false;
      }
    } catch (error) {
      console.error('❌ Discord auth error:', error);
      setState(prev => ({ 
        ...prev, 
        error: error instanceof Error ? error.message : 'Discord authentication failed',
        loading: false 
      }));
      return false;
    }
  };

  const handleDiscordCallback = async (session: any) => {
    try {
      console.log('🔄 Processing Discord callback with official Supabase...');
      setState(prev => ({ ...prev, loading: true, error: null }));
      
      if (!session?.user) {
        throw new Error('No user data in session');
      }

      console.log('📋 Raw session user data:', {
        id: session.user.id,
        email: session.user.email,
        provider: session.user.app_metadata?.provider,
        user_metadata: session.user.user_metadata,
        identities: session.user.identities?.map((i: any) => ({
          provider: i.provider,
          identity_data: i.identity_data
        }))
      });

      // Extract Discord user data from the session
      // Discord data might be in identities or user_metadata
      const discordIdentity = session.user.identities?.find((i: any) => i.provider === 'discord');
      const metadata = session.user.user_metadata;
      const identityData = discordIdentity?.identity_data;

      const discordUser: DiscordUser = {
        id: identityData?.id || metadata?.provider_id || session.user.id,
        username: identityData?.username || metadata?.user_name || metadata?.name || 'Unknown',
        discriminator: identityData?.discriminator || metadata?.discriminator || '0000',
        avatar: identityData?.avatar || metadata?.avatar_url || null,
        email: session.user.email,
      };

      console.log('👤 Extracted Discord user:', discordUser);

      // Store Discord user data
      await SecureStore.setItemAsync('discord_user', JSON.stringify(discordUser));
      await SecureStore.setItemAsync('discord_session', JSON.stringify(session));

      setState(prev => ({ ...prev, user: discordUser, loading: false }));
      
      console.log('✅ Discord user authenticated successfully:', discordUser.username);
      return true;
    } catch (error) {
      console.error('❌ Error handling Discord callback:', error);
      setState(prev => ({ 
        ...prev, 
        error: error instanceof Error ? error.message : 'Failed to process Discord login',
        loading: false 
      }));
      return false;
    }
  };

  const signOutDiscord = async () => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));
      
      // Sign out from Discord Supabase
      await discordSupabase.auth.signOut();
      
      // Remove stored Discord data
      await SecureStore.deleteItemAsync('discord_user');
      await SecureStore.deleteItemAsync('discord_session');
      
      setState(prev => ({ ...prev, user: null, loading: false }));
      
      console.log('Discord user signed out');
      return true;
    } catch (error) {
      console.error('Error signing out Discord:', error);
      setState(prev => ({ 
        ...prev, 
        error: error instanceof Error ? error.message : 'Failed to sign out of Discord',
        loading: false 
      }));
      return false;
    }
  };

  const loadStoredDiscordUser = async () => {
    try {
      console.log('🔍 Checking SecureStore for discord_user...');
      const storedUser = await SecureStore.getItemAsync('discord_user');
      console.log('📦 Raw stored user data:', storedUser ? 'Found data' : 'No data');
      
      if (storedUser) {
        const discordUser: DiscordUser = JSON.parse(storedUser);
        setState(prev => ({ ...prev, user: discordUser }));
        console.log('📱 Loaded stored Discord user:', discordUser.username);
        return discordUser;
      }
      console.log('📱 No stored Discord user found');
      return null;
    } catch (error) {
      console.error('❌ Error loading stored Discord user:', error);
      return null;
    }
  };

  const checkCurrentSession = async () => {
    try {
      console.log('🔍 Checking current Discord Supabase session...');
      console.log('🔗 Using Discord Supabase instance for session check');
      const { data: { session }, error } = await discordSupabase.auth.getSession();
      
      if (error) {
        console.error('❌ Error getting Discord session:', error);
        return null;
      }

      if (session) {
        console.log('📋 Current Discord session found:', {
          provider: session.user?.app_metadata?.provider,
          userId: session.user?.id,
          email: session.user?.email,
          username: session.user?.user_metadata?.user_name || session.user?.user_metadata?.name
        });
        
        if (session.user?.app_metadata?.provider === 'discord') {
          console.log('🎯 Found Discord session, processing...');
          const success = await handleDiscordCallback(session);
          return success ? session : null;
        } else {
          console.log('⚠️ Session found but not Discord provider:', session.user?.app_metadata?.provider);
        }
      } else {
        console.log('❌ No current Discord session found in Discord Supabase');
      }
      
      return session;
    } catch (error) {
      console.error('❌ Error checking Discord session:', error);
      return null;
    }
  };

  const refreshDiscordUser = useCallback(async () => {
    try {
      console.log('🔄 Refreshing Discord user data...');
      setState(prev => ({ ...prev, loading: true }));
      
      // First check for stored user
      const storedUser = await loadStoredDiscordUser();
      if (storedUser) {
        setState(prev => ({ ...prev, loading: false }));
        return storedUser;
      }
      
      // Then check current session
      const session = await checkCurrentSession();
      setState(prev => ({ ...prev, loading: false }));
      return session;
    } catch (error) {
      console.error('❌ Error refreshing Discord user:', error);
      setState(prev => ({ ...prev, loading: false }));
      return null;
    }
  }, []);

  // Set up auth state listener for Discord Supabase
  useEffect(() => {
    console.log('Setting up Discord auth state listener...');
    const { data: { subscription } } = discordSupabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('🔔 Discord auth state change:', {
          event,
          provider: session?.user?.app_metadata?.provider,
          hasSession: !!session,
          userId: session?.user?.id
        });
        
        if (event === 'SIGNED_IN' && session?.user?.app_metadata?.provider === 'discord') {
          console.log('✅ Discord user signed in via auth state change, processing...');
          setState(prev => ({ ...prev, loading: false })); // Stop the connecting state
          const success = await handleDiscordCallback(session);
          
          if (success) {
            console.log('🎉 Discord authentication completed successfully!');
            // The success will be handled by the account settings component
          }
        } else if (event === 'SIGNED_OUT') {
          console.log('👋 User signed out, clearing Discord data...');
          setState(prev => ({ ...prev, user: null }));
          await SecureStore.deleteItemAsync('discord_user');
          await SecureStore.deleteItemAsync('discord_session');
        } else if (event === 'SIGNED_IN') {
          console.log('ℹ️ User signed in but not Discord provider:', session?.user?.app_metadata?.provider);
        }
      }
    );

    return () => {
      console.log('🧹 Cleaning up Discord auth state listener');
      subscription.unsubscribe();
    };
  }, []);

  // Load stored Discord user on mount
  useEffect(() => {
    loadStoredDiscordUser();
  }, []);

  return {
    ...state,
    signInWithDiscord,
    handleDiscordCallback,
    signOutDiscord,
    loadStoredDiscordUser,
    checkCurrentSession,
    refreshDiscordUser,
  };
}; 