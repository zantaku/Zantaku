import { useEffect } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useDiscordAuth } from '../../../hooks/useDiscordAuth';
import { supabase } from '../../../lib/supabase';
import { useTheme } from '../../../hooks/useTheme';

export default function DiscordCallback() {
  const params = useLocalSearchParams();
  const { handleDiscordCallback } = useDiscordAuth();
  const { currentTheme } = useTheme();

  useEffect(() => {
    const processDiscordAuth = async () => {
      console.log('Processing Discord auth callback with params:', params);
      
      try {
        // Wait a moment for the auth state to update after OAuth redirect
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Get the current session from Supabase
        const { data: { session }, error } = await supabase.auth.getSession();
        
        console.log('Discord callback - Session check:', { 
          hasSession: !!session, 
          provider: session?.user?.app_metadata?.provider,
          error: error?.message 
        });
        
        if (error) {
          console.error('Error getting session:', error);
          router.replace('/appsettings/accountsetting?error=discord_auth_failed');
          return;
        }

        if (!session) {
          console.log('No session found, attempting to refresh...');
          // Try to refresh the session
          const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
          
          if (refreshError || !refreshData.session) {
            console.error('No session after refresh:', refreshError?.message);
            router.replace('/appsettings/accountsetting?error=no_session');
            return;
          }
          
          console.log('Session refreshed successfully');
        }

        const finalSession = session || (await supabase.auth.getSession()).data.session;
        
        if (!finalSession) {
          console.error('Still no session found');
          router.replace('/appsettings/accountsetting?error=no_session');
          return;
        }

        // Verify this is a Discord session
        if (finalSession.user?.app_metadata?.provider !== 'discord') {
          console.error('Session is not from Discord provider:', finalSession.user?.app_metadata?.provider);
          router.replace('/appsettings/accountsetting?error=invalid_provider');
          return;
        }

        console.log('Discord session found, processing user data...');
        const success = await handleDiscordCallback(finalSession);
        
        if (success) {
          console.log('Discord authentication successful, redirecting...');
          router.replace('/appsettings/accountsetting?discord_success=true');
        } else {
          console.error('Failed to process Discord callback');
          router.replace('/appsettings/accountsetting?error=callback_failed');
        }
      } catch (error) {
        console.error('Error in Discord auth callback:', error);
        router.replace('/appsettings/accountsetting?error=unknown');
      }
    };

    // Process the auth callback
    processDiscordAuth();
  }, [params]);

  return (
    <View style={{ 
      flex: 1, 
      justifyContent: 'center', 
      alignItems: 'center', 
      backgroundColor: currentTheme.colors.background 
    }}>
      <ActivityIndicator size="large" color={currentTheme.colors.primary} />
      <Text style={{ 
        marginTop: 20, 
        color: currentTheme.colors.text,
        fontSize: 16,
        fontWeight: '500'
      }}>
        Connecting to Discord...
      </Text>
    </View>
  );
} 