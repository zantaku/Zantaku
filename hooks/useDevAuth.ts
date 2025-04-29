import { useState } from 'react';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';
import * as SecureStore from 'expo-secure-store';
import axios from 'axios';
import { supabase } from '../lib/supabase';
import { 
  ANILIST_DEV_CLIENT_ID, 
  ANILIST_DEV_CLIENT_SECRET,
  ANILIST_DEV_REDIRECT_URI,
  ANILIST_AUTH_ENDPOINT,
  ANILIST_TOKEN_ENDPOINT,
  ANILIST_GRAPHQL_ENDPOINT,
  STORAGE_KEY
} from '../constants/auth';
import { saveAnilistUser, getAnilistUser, checkAnilistUsersTable } from '../lib/supabase';
import { router } from 'expo-router';
import * as Clipboard from 'expo-clipboard';

interface AnilistUser {
  id: number;
  name: string;
  avatar: {
    large: string;
  };
}

interface AuthResult {
  accessToken: string;
  user: AnilistUser;
}

export const useDevAuth = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchUserData = async (accessToken: string): Promise<AnilistUser> => {
    try {
      console.log('🔄 Fetching user data with token:', accessToken.substring(0, 10) + '...');
      console.log('🔗 Using AniList endpoint:', ANILIST_GRAPHQL_ENDPOINT);
      
      const response = await fetch(ANILIST_GRAPHQL_ENDPOINT, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          query: `
            query {
              Viewer {
                id
                name
                avatar {
                  large
                }
              }
            }
          `
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const responseData = await response.json();
      console.log('Raw API Response:', JSON.stringify(responseData, null, 2));

      // Check for GraphQL errors
      if (responseData.errors) {
        console.error('GraphQL Errors:', responseData.errors);
        throw new Error(responseData.errors[0]?.message || 'GraphQL Error');
      }

      // Validate the response structure
      if (!responseData.data?.Viewer) {
        console.error('Invalid response structure:', responseData);
        throw new Error('Invalid response format from AniList');
      }

      const viewer = responseData.data.Viewer;
      
      // Validate required fields
      if (!viewer.id || !viewer.name) {
        console.error('Missing required fields in viewer data:', viewer);
        throw new Error('Missing required user data fields');
      }

      // Return normalized user data
      return {
        id: viewer.id,
        name: viewer.name,
        avatar: {
          large: viewer.avatar?.large || null
        }
      };
    } catch (error) {
      console.error('Error in fetchUserData:', error);
      if (error instanceof Error) {
        throw new Error(`Error fetching user data: ${error.message}`);
      }
      throw new Error('Unknown error fetching user data');
    }
  };

  const storeAuthData = async (token: string, userData: AnilistUser) => {
    try {
      console.log('💾 Storing auth data...');
      // Store token and user data in SecureStore - this is the critical part
      // Even if Supabase fails, this will ensure the user can use the app
      await SecureStore.setItemAsync(STORAGE_KEY.AUTH_TOKEN, token);
      await SecureStore.setItemAsync(STORAGE_KEY.USER_DATA, JSON.stringify(userData));
      console.log('✅ Auth data stored in SecureStore');
      
      // Attempt to store in Supabase, but don't block app functionality if it fails
      try {
        console.log('�� Attempting to save user data to Supabase...');
        
        // Using the enhanced saveAnilistUser function that handles headers automatically
        const savedUser = await saveAnilistUser({
          anilist_id: userData.id,
          username: userData.name,
          avatar_url: userData.avatar.large || '',
          access_token: token,
          is_verified: false,
        });

        if (savedUser) {
          console.log('✅ User data successfully saved to Supabase:', {
            user_id: savedUser.id,
            anilist_id: savedUser.anilist_id
          });
          return savedUser;
        } else {
          console.log('⚠️ Could not save to Supabase but continuing with local data');
        }
      } catch (supabaseError) {
        console.error('❌ Supabase error, continuing with local auth only:', supabaseError);
      }
      
      // If we reach here, Supabase save failed but SecureStore succeeded
      // Return a minimal user object so the app can continue
      console.log('🔄 Using local user data fallback');
      return {
        id: `local-${userData.id}`,
        anilist_id: userData.id,
        username: userData.name,
        avatar_url: userData.avatar.large || '',
        access_token: token,
        is_verified: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
    } catch (error) {
      console.error('❌ Error in storeAuthData:', error);
      // Still try to continue even if there's an error
      // But we throw the error so the caller can handle it appropriately
      throw error;
    }
  };

  const handleToken = async (token: string): Promise<boolean> => {
    try {
      setIsLoading(true);
      console.log('=== Dev Auth Flow: handleToken ===');
      console.log('1. Starting token handling process');

      // Check if token is valid
      if (!token || typeof token !== 'string' || token.length < 10) {
        console.error('2. Invalid token format:', token);
        throw new Error('Invalid token format');
      }

      console.log('3. Token validation passed, fetching user data...');
      console.log('Token prefix:', token.substring(0, 10) + '...');

      // Fetch user data with the token to validate it
      const userData = await fetchUserData(token);
      console.log('4. Successfully fetched user data:', {
        id: userData.id,
        name: userData.name,
        hasAvatar: !!userData.avatar?.large
      });

      // Check if user exists in Supabase
      console.log('5. Checking if user exists in Supabase...');
      try {
        const existingUser = await getAnilistUser(userData.id);
        
        if (!existingUser) {
          console.log('6. User not found in Supabase, creating new user...');
          // Store auth data using our enhanced function that handles both local and remote storage
          const newUser = await storeAuthData(token, userData);
          console.log('7. User data stored:', newUser ? 'Success' : 'Failed');
        } else {
          console.log('6. User found in Supabase:', {
            id: existingUser.id,
            username: existingUser.username
          });
          // Store auth data using our enhanced function for both local and remote
          const updatedUser = await storeAuthData(token, userData);
          console.log('7. User data updated:', updatedUser ? 'Success' : 'Failed');
        }
      } catch (lookupError) {
        console.error('Error checking if user exists:', lookupError);
        console.log('Proceeding with local storage only');
        
        // Store auth data locally even if Supabase lookup fails
        await SecureStore.setItemAsync(STORAGE_KEY.AUTH_TOKEN, token);
        await SecureStore.setItemAsync(STORAGE_KEY.USER_DATA, JSON.stringify(userData));
        console.log('7. User data stored locally only');
      }

      // Navigate to home
      console.log('8. Authentication successful, preparing navigation');
      setTimeout(() => {
        console.log('9. Navigating to tabs...');
        router.replace('/(tabs)');
        console.log('10. Navigation command sent');
      }, 500);
      
      console.log('=== Dev Auth Flow Complete ===');
      return true;
    } catch (error) {
      console.error('=== Dev Auth Flow Error ===');
      console.error('Error details:', error);
      setError(error instanceof Error ? error.message : 'Failed to handle authentication token');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const exchangeCodeForToken = async (code: string, redirectUri: string): Promise<string> => {
    try {
      console.log('=== DEV Auth: Exchanging code for token ===');
      console.log('1. Code value (first 10 chars):', code.substring(0, 10) + '...');
      console.log('2. Redirect URI:', redirectUri);
      console.log('3. Client ID:', ANILIST_DEV_CLIENT_ID);
      
      // Create form data for x-www-form-urlencoded
      const formData = new URLSearchParams();
      formData.append('grant_type', 'authorization_code');
      formData.append('client_id', ANILIST_DEV_CLIENT_ID);
      formData.append('client_secret', ANILIST_DEV_CLIENT_SECRET);
      formData.append('redirect_uri', redirectUri);
      formData.append('code', code);

      console.log('4. Request payload prepared');
      console.log('5. Sending request to:', ANILIST_TOKEN_ENDPOINT);

      const response = await axios.post(
        ANILIST_TOKEN_ENDPOINT,
        formData,  // Send the actual FormData object
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          }
        }
      );

      console.log('6. Token response status:', response.status);
      console.log('7. Token response data:', response.data ? 'Received data' : 'No data');

      if (response.data?.access_token) {
        console.log('8. Successfully obtained access token');
        return response.data.access_token;
      }
      console.error('9. No access token in response:', response.data);
      throw new Error('No access token in response');
    } catch (error) {
      console.error('=== DEV Auth: Token Exchange Error ===');
      if (axios.isAxiosError(error)) {
        console.error('10. Axios error details:', {
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data,
          message: error.message,
          config: {
            url: error.config?.url,
            method: error.config?.method,
            headers: error.config?.headers,
            data: error.config?.data,
          }
        });
      } else {
        console.error('11. Non-Axios error:', error);
      }
      throw error;
    }
  };

  const signInWithPin = async (): Promise<AuthResult | null> => {
    try {
      setIsLoading(true);
      setError(null);
      console.log('=== Dev Auth Flow: signInWithPin ===');
      
      // Get both the environment URI and a dynamic one
      const envRedirectUri = ANILIST_DEV_REDIRECT_URI;
      // Generate a dynamic redirect URI as backup
      const dynamicRedirectUri = makeRedirectUri({
        scheme: 'exp',
        path: 'auth/callback',
      });
      
      // Use the environment one if available, otherwise use dynamic one
      const redirectUri = envRedirectUri || dynamicRedirectUri;
      
      console.log('1. Redirect URI comparison:', {
        fromEnv: envRedirectUri,
        dynamic: dynamicRedirectUri,
        using: redirectUri
      });
      
      // Add additional logging for environment variables
      console.log('Environment check:', {
        clientId: ANILIST_DEV_CLIENT_ID ? 'Set' : 'Missing',
        clientSecret: ANILIST_DEV_CLIENT_SECRET ? 'Set' : 'Missing',
        redirectUri: ANILIST_DEV_REDIRECT_URI ? 'Set' : 'Missing'
      });
      
      // Construct auth URL with the redirect URI
      const authUrl = `${ANILIST_AUTH_ENDPOINT}?client_id=${ANILIST_DEV_CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}`;
      console.log('2. Constructed auth URL:', authUrl);
      
      // Open auth session
      console.log('3. Opening auth session in browser...');
      const result = await WebBrowser.openAuthSessionAsync(
        authUrl,
        redirectUri,
        {
          showInRecents: true,
          preferEphemeralSession: true,
          createTask: false
        }
      );

      console.log('4. Auth session result:', JSON.stringify(result, null, 2));

      // Check if we have a successful result with a URL
      if (result.type !== 'success' || !('url' in result) || !result.url) {
        if (result.type === 'cancel') {
          throw new Error('Authentication cancelled by user');
        }
        throw new Error('Authentication failed - no valid response');
      }

      // Parse the URL and get the code
      const url = new URL(result.url);
      const code = url.searchParams.get('code');
      
      if (!code) {
        console.error('No code found in URL params:', url.searchParams.toString());
        throw new Error('No authorization code received');
      }

      console.log('5. Successfully extracted auth code');
      console.log('Code prefix:', code.substring(0, 10) + '...');
      
      // Exchange code for token
      console.log('6. Exchanging code for token...');
      const token = await exchangeCodeForToken(code, redirectUri);
      
      if (!token) {
        throw new Error('Failed to exchange code for token');
      }

      // Handle the token
      console.log('7. Handling token...');
      const success = await handleToken(token);
      if (!success) {
        throw new Error('Failed to handle token');
      }

      // Fetch user data again to return it
      console.log('8. Fetching final user data...');
      const userData = await fetchUserData(token);
      console.log('9. Auth flow complete');
      
      return {
        accessToken: token,
        user: userData
      };
    } catch (err) {
      console.error('=== Dev Auth Flow Error ===');
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
      console.error('Error details:', errorMessage);
      setError(errorMessage);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const authWithClipboardToken = async (): Promise<boolean> => {
    try {
      setIsLoading(true);
      setError(null);
      console.log('=== Dev Auth Flow: authWithClipboardToken ===');
      
      const clipboardContent = await Clipboard.getStringAsync();
      console.log('Clipboard content length:', clipboardContent?.length || 0);
      
      if (!clipboardContent || clipboardContent.length < 20) {
        console.error('No valid token in clipboard (too short)');
        setError('Please copy a valid AniList token to your clipboard first');
        return false;
      }
      
      console.log('Found potential token in clipboard');
      const token = clipboardContent.trim();
      
      // Try to handle the token
      return await handleToken(token);
    } catch (error) {
      console.error('Error in authWithClipboardToken:', error);
      setError(error instanceof Error ? error.message : 'Failed to authenticate with clipboard token');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    signInWithPin,
    authWithClipboardToken,
    isLoading,
    error
  };
};
