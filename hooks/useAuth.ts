import { useState, useEffect } from 'react';
import * as WebBrowser from 'expo-web-browser';
import * as SecureStore from 'expo-secure-store';
import * as Clipboard from 'expo-clipboard';
import axios, { AxiosError } from 'axios';
import {
  ANILIST_AUTH_ENDPOINT,
  ANILIST_CLIENT_ID,
  ANILIST_REDIRECT_URI,
  ANILIST_TOKEN_ENDPOINT,
  ANILIST_CLIENT_SECRET,
  STORAGE_KEY,
} from '../constants/auth';
import { rateLimitedAxios } from '../utils/api';
import { saveAnilistUser, getAnilistUser, checkAnilistUsersTable } from '../lib/supabase';
import { router } from 'expo-router';

WebBrowser.maybeCompleteAuthSession();

interface User {
  id: number;
  name: string;
  avatar: {
    large: string;
  };
  token?: string;
  isAnonymous?: boolean;
}

// Correctly type the WebBrowser result types
type WebBrowserResultSuccess = {
  type: 'success';
  url: string;
};

function isAuthSessionResult(result: any): boolean {
  return result && 
         result.type && 
         (result.type === 'success' || 
          result.type === 'cancel' || 
          result.type === 'dismiss' ||
          typeof result.url === 'string');
}

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      try {
        console.log('Initializing auth state...');
        // First check for stored user data
        const storedUser = await SecureStore.getItemAsync(STORAGE_KEY.USER_DATA);
        if (storedUser) {
          const userData = JSON.parse(storedUser);
          if (userData.isAnonymous) {
            console.log('Found anonymous user data');
            setUser(userData);
            setLoading(false);
            return;
          }
        }

        // If no anonymous user, check for token
        const token = await SecureStore.getItemAsync(STORAGE_KEY.AUTH_TOKEN);
        console.log('Stored token:', token ? 'Found' : 'Not found');
        
        if (token) {
          console.log('Attempting to fetch user data with stored token...');
          await fetchUserData(token);
        } else {
          console.log('No stored token found, user needs to login');
          setLoading(false);
        }
      } catch (error) {
        console.error('Error in auth initialization:', error);
        setLoading(false);
      }
    };

    initAuth();
  }, []);

  const fetchUserData = async (token: string) => {
    try {
      console.log('Fetching user data with token:', token.substring(0, 10) + '...');
      const query = `
        query {
          Viewer {
            id
            name
            avatar {
              large
            }
          }
        }
      `;

      const response = await rateLimitedAxios(query, {}, token);
      console.log('API Response:', JSON.stringify(response?.data, null, 2));

      // Check if response data exists
      if (!response?.data) {
        throw new Error('No response data received from AniList');
      }

      // Check for GraphQL errors
      if (response.data.errors) {
        console.error('GraphQL Errors:', response.data.errors);
        throw new Error(response.data.errors[0]?.message || 'GraphQL Error');
      }

      // Validate the response structure
      if (!response.data?.Viewer) {
        console.error('Invalid response structure:', response.data);
        throw new Error('Invalid response format from AniList');
      }

      const userData = response.data.Viewer;
      
      // Validate required fields
      if (!userData.id || !userData.name) {
        console.error('Missing required fields in viewer data:', userData);
        throw new Error('Missing required user data fields');
      }

      // Store the token with the user data
      const userWithToken = {
        ...userData,
        token
      };
      
      setUser(userWithToken);
      setLoading(false);
      return userWithToken;
    } catch (error) {
      console.error('Error fetching user data:', error);
      // Clear invalid token
      await SecureStore.deleteItemAsync(STORAGE_KEY.AUTH_TOKEN);
      setUser(null);
      setLoading(false);
      throw error;
    }
  };

  const storeAuthData = async (token: string, userData: User) => {
    try {
      console.log('Storing auth data...');
      await SecureStore.setItemAsync(STORAGE_KEY.AUTH_TOKEN, token);
      await SecureStore.setItemAsync(STORAGE_KEY.USER_DATA, JSON.stringify(userData));
      
      // Make Supabase optional - wrap in try-catch
      try {
        console.log('Attempting to save user data to Supabase...');
        const savedUser = await saveAnilistUser({
          anilist_id: userData.id,
          username: userData.name,
          avatar_url: userData.avatar.large,
          access_token: token,
          is_verified: false,
        });
        console.log('User data saved to Supabase:', savedUser);
      } catch (error) {
        // Don't throw error if Supabase fails, just log it
        console.log('Supabase storage failed, continuing with local storage:', error);
      }
      
      console.log('Auth data stored successfully');
      return true;
    } catch (error) {
      console.error('Error storing auth data:', error);
      throw error;
    }
  };

  const loadStoredAuth = async () => {
    try {
      console.log('Loading stored auth data...');
      const storedUser = await SecureStore.getItemAsync(STORAGE_KEY.USER_DATA);
      if (storedUser) {
        console.log('Found stored user data');
        setUser(JSON.parse(storedUser));
      } else {
        console.log('No stored user data found');
      }
    } catch (error) {
      console.error('Error loading stored auth:', error);
    } finally {
      console.log('Setting loading to false');
      setLoading(false);
    }
  };

  const signOut = async () => {
    try {
      setLoading(true);
      console.log('Signing out...');
      await SecureStore.deleteItemAsync(STORAGE_KEY.AUTH_TOKEN);
      await SecureStore.deleteItemAsync(STORAGE_KEY.USER_DATA);
      setUser(null);
      console.log('Sign out complete');
    } catch (error) {
      console.error('Error signing out:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToken = async (token: string): Promise<boolean> => {
    try {
      setLoading(true);
      console.log('=== Auth Flow: handleToken ===');
      console.log('1. Starting token handling process');
      console.log('Token prefix:', token.substring(0, 10) + '...');

      // Verify token is stored
      const storedToken = await SecureStore.getItemAsync(STORAGE_KEY.AUTH_TOKEN);
      if (!storedToken) {
        console.log('2. Token not found in storage, storing now...');
        await SecureStore.setItemAsync(STORAGE_KEY.AUTH_TOKEN, token);
      }

      // Fetch user data with the token to validate it
      console.log('3. Fetching user data to validate token');
      const userData = await fetchUserData(token);
      if (!userData) {
        console.error('Failed to fetch user data with provided token');
        throw new Error('Failed to fetch user data with provided token');
      }
      console.log('4. Successfully fetched user data:', {
        id: userData.id,
        name: userData.name,
        hasAvatar: !!userData.avatar?.large
      });

      // Store the auth data
      try {
        console.log('5. Storing auth data');
        await storeAuthData(token, userData);
        console.log('6. Successfully stored auth data');
      } catch (error) {
        console.error('Warning: Failed to store auth data:', error);
        console.log('Continuing with in-memory data only');
      }
      
      // Set user state
      console.log('7. Setting user state');
      setUser(userData);
      
      // Navigate to tabs index with a slight delay to ensure state is updated
      console.log('8. Authentication successful, preparing navigation');
      setTimeout(() => {
        console.log('9. Navigating to tabs...');
        router.replace('/(tabs)');
        console.log('10. Navigation command sent');
      }, 1000); // Increased delay to 1 second
      
      console.log('=== Auth Flow Complete ===');
      return true;
    } catch (error) {
      console.error('=== Auth Flow Error ===');
      console.error('Error details:', error);
      // Clean up on error
      await SecureStore.deleteItemAsync(STORAGE_KEY.AUTH_TOKEN);
      await SecureStore.deleteItemAsync(STORAGE_KEY.USER_DATA);
      setUser(null);
      setLoading(false);
      return false;
    }
  };

  const checkClipboardForToken = async () => {
    try {
      console.log('Checking clipboard for token...');
      const clipboardContent = await Clipboard.getStringAsync();
      console.log('Clipboard content length:', clipboardContent?.length || 0);
      
      if (clipboardContent && clipboardContent.length > 20) {
        console.log('Found potential token in clipboard');
        const success = await handleToken(clipboardContent.trim());
        if (success) {
          console.log('Successfully authenticated with clipboard token');
        } else {
          console.log('Failed to authenticate with clipboard token');
        }
        return success;
      }
      
      console.log('No valid token found in clipboard');
      return false;
    } catch (error) {
      console.error('Error checking clipboard:', error);
      return false;
    }
  };

  const signIn = async () => {
    try {
      setLoading(true);
      console.log('=== Auth Flow: signIn ===');
      console.log('1. Starting sign in process');

      // Use authorization code flow instead of implicit
      const authUrl = new URL(ANILIST_AUTH_ENDPOINT);
      authUrl.searchParams.append('client_id', ANILIST_CLIENT_ID);
      authUrl.searchParams.append('response_type', 'code');
      authUrl.searchParams.append('redirect_uri', ANILIST_REDIRECT_URI);

      console.log('2. Opening auth URL:', authUrl.toString());
      console.log('3. Using redirect URI:', ANILIST_REDIRECT_URI);

      // Open the authorization URL in a browser
      const result = await WebBrowser.openAuthSessionAsync(
        authUrl.toString(),
        ANILIST_REDIRECT_URI,
        {
          showInRecents: true,
          preferEphemeralSession: true,
          createTask: false
        }
      );

      console.log('4. Auth session result:', JSON.stringify(result, null, 2));

      if (!isAuthSessionResult(result)) {
        console.error('Invalid auth session result type');
        return false;
      }

      if (result.type === 'success') {
        const resultUrl = result.url;
        if (!resultUrl) {
          console.error('No URL in success result');
          return false;
        }

        console.log('5. Successfully received callback URL');
        
        try {
          // Get code from URL params instead of fragment
          const url = new URL(resultUrl);
          const code = url.searchParams.get('code');
          
          if (!code) {
            console.error('6. No authorization code found in URL params:', url.searchParams.toString());
            return false;
          }

          console.log('7. Successfully extracted auth code');
          console.log('8. Code prefix:', code.substring(0, 10) + '...');
          
          // Exchange code for token
          console.log('9. Exchanging code for token');
          const formData = new URLSearchParams();
          formData.append('grant_type', 'authorization_code');
          formData.append('client_id', ANILIST_CLIENT_ID);
          formData.append('client_secret', ANILIST_CLIENT_SECRET);
          formData.append('redirect_uri', ANILIST_REDIRECT_URI);
          formData.append('code', code);

          const response = await axios.post(
            ANILIST_TOKEN_ENDPOINT,
            formData,
            {
              headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
              }
            }
          );

          if (!response.data?.access_token) {
            console.error('10. No access token in response:', response.data);
            return false;
          }

          console.log('11. Successfully obtained access token');
          console.log('12. Handling token...');
          
          // Store token immediately
          await SecureStore.setItemAsync(STORAGE_KEY.AUTH_TOKEN, response.data.access_token);
          
          return await handleToken(response.data.access_token);
        } catch (urlError) {
          console.error('Error processing callback URL:', urlError);
          return false;
        }
      }

      if (result.type === 'dismiss') {
        console.log('Auth browser dismissed by user');
        return false;
      }

      console.error('Auth was not successful:', result);
      return false;
    } catch (error) {
      console.error('=== Auth Flow Error ===');
      console.error('Error during sign in:', error);
      if (axios.isAxiosError(error)) {
        console.error('Axios error details:', {
          status: error.response?.status,
          data: error.response?.data,
          headers: error.response?.headers
        });
      }
      return false;
    } finally {
      setLoading(false);
    }
  };

  const enableAnonymousMode = async () => {
    try {
      setLoading(true);
      console.log('Enabling anonymous mode...');
      
      // Create an anonymous user object
      const anonymousUser: User = {
        id: -1,
        name: 'Guest',
        avatar: {
          large: ''
        },
        isAnonymous: true
      };

      // Store the anonymous user data
      await SecureStore.setItemAsync(STORAGE_KEY.USER_DATA, JSON.stringify(anonymousUser));
      setUser(anonymousUser);
      console.log('Anonymous mode enabled');
      return true;
    } catch (error) {
      console.error('Error enabling anonymous mode:', error);
      return false;
    } finally {
      setLoading(false);
    }
  };

  return {
    user,
    loading,
    signIn,
    signOut,
    handleToken,
    enableAnonymousMode
  };
}; 