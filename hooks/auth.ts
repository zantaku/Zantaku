import { useState, useEffect } from 'react';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri, useAuthRequest, ResponseType } from 'expo-auth-session';
import * as SecureStore from 'expo-secure-store';
import axios from 'axios';
import { supabase } from '../lib/supabase';
import { 
  ANILIST_CLIENT_ID, 
  ANILIST_CLIENT_SECRET,
  ANILIST_REDIRECT_URI,
  ANILIST_AUTH_ENDPOINT,
  ANILIST_TOKEN_ENDPOINT,
  ANILIST_GRAPHQL_ENDPOINT,
  STORAGE_KEY
} from '../constants/auth';
import { saveAnilistUser, getAnilistUser } from '../lib/supabase';
import { router } from 'expo-router';

// Register the authentication callback
WebBrowser.maybeCompleteAuthSession();

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

export const useAuth = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<AnilistUser | null>(null);

  // Configure auth request
  const redirectUri = ANILIST_REDIRECT_URI || makeRedirectUri({
    scheme: 'zantaku',
    path: 'auth/callback'
  });

  const [request, response, promptAsync] = useAuthRequest(
    {
      clientId: ANILIST_CLIENT_ID,
      redirectUri,
      responseType: ResponseType.Code,
      scopes: [],
    },
    {
      authorizationEndpoint: ANILIST_AUTH_ENDPOINT,
      tokenEndpoint: ANILIST_TOKEN_ENDPOINT,
    }
  );

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

      if (responseData.errors) {
        console.error('GraphQL Errors:', responseData.errors);
        throw new Error(responseData.errors[0]?.message || 'GraphQL Error');
      }

      if (!responseData.data?.Viewer) {
        console.error('Invalid response structure:', responseData);
        throw new Error('Invalid response format from AniList');
      }

      const viewer = responseData.data.Viewer;
      
      if (!viewer.id || !viewer.name) {
        console.error('Missing required fields in viewer data:', viewer);
        throw new Error('Missing required user data fields');
      }

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
      await SecureStore.setItemAsync(STORAGE_KEY.AUTH_TOKEN, token);
      await SecureStore.setItemAsync(STORAGE_KEY.USER_DATA, JSON.stringify(userData));
      console.log('✅ Auth data stored in SecureStore');
      
      try {
        console.log('🔄 Attempting to save user data to Supabase...');
        
        const savedUser = await saveAnilistUser({
          anilist_id: userData.id,
          username: userData.name,
          avatar_url: userData.avatar.large || '',
          access_token: token,
          is_verified: true,
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
      
      return {
        id: `local-${userData.id}`,
        anilist_id: userData.id,
        username: userData.name,
        avatar_url: userData.avatar.large || '',
        access_token: token,
        is_verified: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
    } catch (error) {
      console.error('❌ Error in storeAuthData:', error);
      throw error;
    }
  };

  const handleToken = async (token: string): Promise<boolean> => {
    try {
      setIsLoading(true);
      console.log('=== Auth Flow: handleToken ===');
      console.log('1. Starting token handling process');

      if (!token || typeof token !== 'string' || token.length < 10) {
        console.error('2. Invalid token format:', token);
        throw new Error('Invalid token format');
      }

      console.log('3. Token validation passed, fetching user data...');
      const userData = await fetchUserData(token);
      console.log('4. Successfully fetched user data:', {
        id: userData.id,
        name: userData.name,
        hasAvatar: !!userData.avatar?.large
      });

      console.log('5. Checking if user exists in Supabase...');
      try {
        const existingUser = await getAnilistUser(userData.id);
        
        if (!existingUser) {
          console.log('6. User not found in Supabase, creating new user...');
          const newUser = await storeAuthData(token, userData);
          console.log('7. User data stored:', newUser ? 'Success' : 'Failed');
        } else {
          console.log('6. User found in Supabase:', {
            id: existingUser.id,
            username: existingUser.username
          });
          const updatedUser = await storeAuthData(token, userData);
          console.log('7. User data updated:', updatedUser ? 'Success' : 'Failed');
        }
      } catch (lookupError) {
        console.error('Error checking if user exists:', lookupError);
        console.log('Proceeding with local storage only');
        
        await SecureStore.setItemAsync(STORAGE_KEY.AUTH_TOKEN, token);
        await SecureStore.setItemAsync(STORAGE_KEY.USER_DATA, JSON.stringify(userData));
        console.log('7. User data stored locally only');
      }

      setUser(userData);
      
      console.log('8. Authentication successful, preparing navigation');
      setTimeout(() => {
        console.log('9. Navigating to tabs...');
        router.replace('/(tabs)');
        console.log('10. Navigation command sent');
      }, 500);
      
      return true;
    } catch (error) {
      console.error('=== Auth Flow Error ===');
      console.error('Error details:', error);
      setError(error instanceof Error ? error.message : 'Failed to handle authentication token');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const exchangeCodeForToken = async (code: string, redirectUri: string): Promise<string> => {
    try {
      console.log('=== Auth: Exchanging code for token ===');
      console.log('1. Code value (first 10 chars):', code.substring(0, 10) + '...');
      console.log('2. Redirect URI:', redirectUri);
      console.log('3. Client ID:', ANILIST_CLIENT_ID);
      
      const formData = new URLSearchParams();
      formData.append('grant_type', 'authorization_code');
      formData.append('client_id', ANILIST_CLIENT_ID);
      formData.append('client_secret', ANILIST_CLIENT_SECRET);
      formData.append('redirect_uri', redirectUri);
      formData.append('code', code);

      console.log('4. Request payload prepared');
      console.log('5. Sending request to:', ANILIST_TOKEN_ENDPOINT);

      const response = await axios.post(
        ANILIST_TOKEN_ENDPOINT,
        formData,
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
      throw new Error('No access token in response');
    } catch (error) {
      console.error('=== Auth: Token Exchange Error ===');
      if (axios.isAxiosError(error)) {
        console.error('Error details:', {
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data,
          message: error.message
        });
      } else {
        console.error('Non-Axios error:', error);
      }
      throw error;
    }
  };

  const signIn = async (): Promise<AuthResult | null> => {
    try {
      setIsLoading(true);
      setError(null);
      console.log('=== Auth Flow: signIn ===');
      
      console.log('1. Using redirect URI:', redirectUri);
      
      // Prompt for authentication
      console.log('2. Starting auth flow...');
      const result = await promptAsync();
      console.log('3. Auth result:', result);

      if (result.type === 'success' && result.params.code) {
        const code = result.params.code;
        console.log('4. Successfully got auth code');
        
        const token = await exchangeCodeForToken(code, redirectUri);
        if (!token) {
          throw new Error('Failed to exchange code for token');
        }

        console.log('5. Successfully got token');
        const success = await handleToken(token);
        if (!success) {
          throw new Error('Failed to handle token');
        }

        console.log('6. Fetching user data...');
        const userData = await fetchUserData(token);
        console.log('7. Auth flow complete');

        return {
          accessToken: token,
          user: userData
        };
      } else if (result.type === 'error') {
        throw new Error(result.error?.message || 'Authentication failed');
      } else {
        throw new Error('Authentication was cancelled or failed');
      }
    } catch (err) {
      console.error('=== Auth Flow Error ===');
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
      console.error('Error details:', errorMessage);
      setError(errorMessage);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const signOut = async () => {
    try {
      setIsLoading(true);
      await SecureStore.deleteItemAsync(STORAGE_KEY.AUTH_TOKEN);
      await SecureStore.deleteItemAsync(STORAGE_KEY.USER_DATA);
      setUser(null);
      router.replace('/welcome');
    } catch (error) {
      console.error('Error signing out:', error);
      setError('Failed to sign out');
    } finally {
      setIsLoading(false);
    }
  };

  return {
    signIn,
    signOut,
    handleToken,
    user,
    isLoading,
    error
  };
}; 