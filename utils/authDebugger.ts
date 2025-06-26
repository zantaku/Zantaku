import * as SecureStore from 'expo-secure-store';
import { STORAGE_KEY } from '../constants/auth';
import { rateLimitedAxios } from './api';

export interface AuthStatus {
  hasToken: boolean;
  tokenValid: boolean;
  userInfo: any;
  error: string | null;
  rateLimitInfo: {
    remaining: number;
    limit: number;
    resetTime: number | null;
  };
}

export const checkAuthStatus = async (): Promise<AuthStatus> => {
  const result: AuthStatus = {
    hasToken: false,
    tokenValid: false,
    userInfo: null,
    error: null,
    rateLimitInfo: {
      remaining: 0,
      limit: 30,
      resetTime: null
    }
  };

  try {
    // Check if token exists
    const token = await SecureStore.getItemAsync(STORAGE_KEY.AUTH_TOKEN);
    result.hasToken = !!token;

    if (!token) {
      result.error = 'No authentication token found';
      return result;
    }

    // Test the token with a simple query
    const testQuery = `
      query {
        Viewer {
          id
          name
          avatar {
            medium
          }
        }
      }
    `;

    console.log('Testing AniList authentication...');
    const response = await rateLimitedAxios(testQuery, {}, token);

    if (response.data?.Viewer) {
      result.tokenValid = true;
      result.userInfo = response.data.Viewer;
      console.log('✅ Authentication successful:', result.userInfo.name);
    } else if (response.data?.errors) {
      result.error = response.data.errors[0]?.message || 'GraphQL Error';
      console.log('❌ GraphQL Error:', result.error);
    } else {
      result.error = 'Invalid response structure';
      console.log('❌ Invalid response:', response.data);
    }

  } catch (error: any) {
    console.log('❌ Authentication test failed:', error.message);
    
    if (error.message?.includes('Invalid token') || error.message?.includes('Unauthorized')) {
      result.error = 'Token is invalid or expired';
      // Clear the invalid token
      await SecureStore.deleteItemAsync(STORAGE_KEY.AUTH_TOKEN);
      result.hasToken = false;
    } else if (error.message?.includes('rate limit') || error.message?.includes('Too Many Requests')) {
      result.error = 'Rate limit exceeded. Please wait before trying again.';
    } else {
      result.error = error.message || 'Unknown authentication error';
    }
  }

  return result;
};

export const clearAuthData = async (): Promise<void> => {
  try {
    await SecureStore.deleteItemAsync(STORAGE_KEY.AUTH_TOKEN);
    await SecureStore.deleteItemAsync(STORAGE_KEY.USER_DATA);
    console.log('✅ Authentication data cleared');
  } catch (error) {
    console.error('❌ Error clearing auth data:', error);
  }
};

export const logAuthDebugInfo = async (): Promise<void> => {
  console.log('=== AniList Auth Debug Info ===');
  
  const status = await checkAuthStatus();
  
  console.log('Token exists:', status.hasToken);
  console.log('Token valid:', status.tokenValid);
  console.log('User info:', status.userInfo);
  console.log('Error:', status.error);
  console.log('Rate limit remaining:', status.rateLimitInfo.remaining);
  
  // Check stored user data
  try {
    const storedUser = await SecureStore.getItemAsync(STORAGE_KEY.USER_DATA);
    if (storedUser) {
      const userData = JSON.parse(storedUser);
      console.log('Stored user data:', {
        id: userData.id,
        name: userData.name,
        isAnonymous: userData.isAnonymous
      });
    } else {
      console.log('No stored user data found');
    }
  } catch (error) {
    console.log('Error reading stored user data:', error);
  }
  
  console.log('=== End Debug Info ===');
}; 