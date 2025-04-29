import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import ENV from '../config';

// Enhanced debugging for Supabase configuration
console.log('💾 SUPABASE CONFIG:', {
  URL: ENV.SUPABASE_URL,
  KEY_PREFIX: ENV.SUPABASE_ANON_KEY ? ENV.SUPABASE_ANON_KEY.substring(0, 15) + '...' : 'undefined',
  HAS_URL: !!ENV.SUPABASE_URL,
  HAS_KEY: !!ENV.SUPABASE_ANON_KEY,
  URL_TYPE: typeof ENV.SUPABASE_URL,
  KEY_TYPE: typeof ENV.SUPABASE_ANON_KEY,
  URL_LENGTH: ENV.SUPABASE_URL?.length,
  KEY_LENGTH: ENV.SUPABASE_ANON_KEY?.length,
});

if (!ENV.SUPABASE_URL || !ENV.SUPABASE_ANON_KEY) {
  console.error('Missing Supabase credentials:', {
    hasUrl: !!ENV.SUPABASE_URL,
    hasKey: !!ENV.SUPABASE_ANON_KEY,
    urlType: typeof ENV.SUPABASE_URL,
    keyType: typeof ENV.SUPABASE_ANON_KEY,
  });
  throw new Error('Supabase credentials are missing');
}

// Extract and clean up the base URL (without /rest/v1)
let baseUrl = ENV.SUPABASE_URL;

// Remove trailing slashes
baseUrl = baseUrl.replace(/\/$/, '');

// Remove /rest/v1 if present
if (baseUrl.includes('/rest/v1')) {
  baseUrl = baseUrl.split('/rest/v1')[0];
}

// Ensure protocol is included
if (!baseUrl.startsWith('http')) {
  baseUrl = 'https://' + baseUrl;
}

console.log('Using Supabase base URL:', baseUrl);

export const supabase = createClient(baseUrl, ENV.SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
  global: {
    headers: {
      'apikey': ENV.SUPABASE_ANON_KEY,
      'Content-Type': 'application/json',
    },
  },
});

// Test Supabase connection immediately
(async function testSupabaseConnection() {
  console.log('🔄 Testing Supabase connection to:', baseUrl);
  try {
    // Use direct REST API call to test connection
    const restEndpoint = `${ENV.SUPABASE_URL.replace(/\/$/, '')}`;
    const apiKey = ENV.SUPABASE_ANON_KEY;
    const testUrl = `${restEndpoint}/anilist_users?apikey=${apiKey}&limit=1`;
    
    console.log('Testing direct REST API connection to:', testUrl.replace(apiKey, '***'));
    
    const response = await fetch(testUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Supabase Connection Error:', {
        status: response.status,
        statusText: response.statusText,
        body: errorText
      });
    } else {
      const data = await response.json();
      console.log(`
      
      ✅✅✅ SUPABASE CONNECTION SUCCESSFUL ✅✅✅
      URL: ${baseUrl}
      REST Endpoint: ${ENV.SUPABASE_URL}
      Retrieved ${data.length} users from anilist_users table
      
      `);
      if (data.length > 0) {
        console.log(`Sample user:`, {
          id: data[0].id,
          anilist_id: data[0].anilist_id,
          username: data[0].username
        });
      } else {
        console.log('No users found in the database yet');
      }
    }
  } catch (error) {
    console.error('❌ Supabase Test Connection Error:', error);
  }
})();

// Types for Anilist user data
export interface AnilistUser {
  id: string;
  anilist_id: number;
  username: string;
  avatar_url: string;
  access_token: string;
  is_verified: boolean;
  created_at: string;
  updated_at: string;
}

// Function to save Anilist user data to Supabase
export async function saveAnilistUser(userData: Omit<AnilistUser, 'id' | 'created_at' | 'updated_at'>) {
  try {
    console.log('📝 saveAnilistUser: Starting to save user to Supabase:', {
      anilist_id: userData.anilist_id,
      username: userData.username,
      avatar_url: userData.avatar_url ? userData.avatar_url.substring(0, 15) + '...' : 'none',
      access_token_length: userData.access_token?.length || 0,
    });

    // Use direct REST API access with apikey as URL parameter
    const restEndpoint = `${ENV.SUPABASE_URL.replace(/\/$/, '')}`;
    const apiKey = ENV.SUPABASE_ANON_KEY;
    
    // Check if user exists first
    const checkUrl = `${restEndpoint}/anilist_users?apikey=${apiKey}&anilist_id=eq.${userData.anilist_id}`;
    console.log('Making direct REST request to:', checkUrl.replace(apiKey, '***'));
    
    const checkResponse = await fetch(checkUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });
    
    let existingUser = null;
    
    if (!checkResponse.ok) {
      const errorText = await checkResponse.text();
      console.error('❌ API Error during user check:', {
        status: checkResponse.status,
        statusText: checkResponse.statusText,
        body: errorText
      });
    } else {
      const existingData = await checkResponse.json();
      console.log(`✅ User check complete: found ${existingData.length} matching records`);
      if (existingData.length > 0) {
        existingUser = existingData[0];
      }
    }
    
    // Prepare request body with updated timestamp
    const requestBody = {
      anilist_id: userData.anilist_id,
      username: userData.username,
      avatar_url: userData.avatar_url,
      access_token: userData.access_token,
      is_verified: userData.is_verified || false,
      updated_at: new Date().toISOString(),
    };
    
    let response;
    
    if (existingUser) {
      // Update existing user with PATCH
      const updateUrl = `${restEndpoint}/anilist_users?apikey=${apiKey}&anilist_id=eq.${userData.anilist_id}`;
      console.log('Updating existing user with PATCH');
      
      response = await fetch(updateUrl, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify(requestBody)
      });
    } else {
      // Create new user with POST
      const createUrl = `${restEndpoint}/anilist_users?apikey=${apiKey}`;
      console.log('Creating new user with POST');
      
      response = await fetch(createUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify(requestBody)
      });
    }
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ API Error saving user:', {
        status: response.status,
        statusText: response.statusText,
        body: errorText
      });
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (!data || data.length === 0) {
      console.error('❌ No data returned from operation');
      throw new Error('Failed to save user data, no records returned');
    }

    console.log('✅ Successfully saved user to Supabase REST API:', {
      id: data[0].id,
      anilist_id: data[0].anilist_id,
      username: data[0].username,
      created_at: data[0].created_at
    });
    return data[0];
  } catch (error: any) {
    console.error('❌ Error saving Anilist user:', {
      name: error.name,
      message: error.message,
    });
    // Don't throw the error, just log it and continue
    // This way, even if Supabase fails, the app can still function
    return null;
  }
}

// Function to get Anilist user data from Supabase
export async function getAnilistUser(anilistId: number) {
  try {
    console.log('Fetching user from Supabase with anilist_id:', anilistId);
    
    // Use direct REST API access with apikey as URL parameter
    const restEndpoint = `${ENV.SUPABASE_URL.replace(/\/$/, '')}`;
    const apiKey = ENV.SUPABASE_ANON_KEY;
    const url = `${restEndpoint}/anilist_users?apikey=${apiKey}&anilist_id=eq.${anilistId}`;
    
    console.log('Making direct REST request to:', url.replace(apiKey, '***'));
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('API Error:', {
        status: response.status,
        statusText: response.statusText,
        body: errorText
      });
      return null;
    }
    
    const data = await response.json();
    
    if (!data || data.length === 0) {
      console.log('User not found in Supabase');
      return null;
    }
    
    console.log('Successfully fetched user from Supabase REST API:', {
      id: data[0].id,
      anilist_id: data[0].anilist_id,
      username: data[0].username
    });
    
    return data[0];
  } catch (error) {
    console.error('Error getting Anilist user:', error);
    // Don't throw the error, just log it and continue
    return null;
  }
}

// Function to check if anilist_users table exists
export async function checkAnilistUsersTable() {
  try {
    console.log('Checking anilist_users table...');
    
    // Use direct REST API access
    const restEndpoint = `${ENV.SUPABASE_URL.replace(/\/$/, '')}`;
    const apiKey = ENV.SUPABASE_ANON_KEY;
    const testUrl = `${restEndpoint}/anilist_users?apikey=${apiKey}&limit=0`;
    
    const response = await fetch(testUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error checking anilist_users table:', {
        status: response.status,
        statusText: response.statusText,
        body: errorText
      });
      return false;
    }

    console.log('anilist_users table exists');
    return true;
  } catch (error: any) {
    console.error('Error checking table:', {
      name: error.name,
      message: error.message
    });
    return false;
  }
}

// Types for Rewards data
export interface Reward {
  id: string;
  name: string;
  type: 'anime' | 'manga' | 'combo';
  description: string;
  icon_url: string | null;
  unlock_criteria: any;
  created_at: string;
}

export interface UserReward {
  id: string;
  user_id: string;
  reward_id: string;
  unlocked_at: string;
  proof_data: any;
  reward?: Reward;
}

// Function to get all available rewards
export async function getAllRewards() {
  try {
    console.log('Fetching all rewards from Supabase');

    // Use direct REST API access
    const restEndpoint = `${ENV.SUPABASE_URL.replace(/\/$/, '')}`;
    const apiKey = ENV.SUPABASE_ANON_KEY;
    const url = `${restEndpoint}/rewards?apikey=${apiKey}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error fetching rewards:', {
        status: response.status,
        statusText: response.statusText,
        body: errorText
      });
      throw new Error('Failed to fetch rewards');
    }
    
    const data = await response.json();
    console.log(`Successfully fetched ${data.length} rewards from Supabase`);
    return data as Reward[];
  } catch (error) {
    console.error('Error getting rewards:', error);
    return [];
  }
}

// Function to get user rewards
export async function getUserRewards(userId: string) {
  try {
    console.log('Fetching user rewards from Supabase for user:', userId);

    // Use direct REST API access
    const restEndpoint = `${ENV.SUPABASE_URL.replace(/\/$/, '')}`;
    const apiKey = ENV.SUPABASE_ANON_KEY;
    const url = `${restEndpoint}/user_rewards?apikey=${apiKey}&user_id=eq.${userId}&select=*,reward:rewards(*)`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error fetching user rewards:', {
        status: response.status,
        statusText: response.statusText,
        body: errorText
      });
      throw new Error('Failed to fetch user rewards');
    }
    
    const data = await response.json();
    console.log(`Successfully fetched ${data.length} user rewards from Supabase`);
    return data as UserReward[];
  } catch (error) {
    console.error('Error getting user rewards:', error);
    return [];
  }
}

// Function to assign a new reward to user
export async function assignRewardToUser(userId: string, rewardId: string, proofData: any = {}) {
  try {
    console.log(`Assigning reward ${rewardId} to user ${userId}`);

    // Use direct REST API access
    const restEndpoint = `${ENV.SUPABASE_URL.replace(/\/$/, '')}`;
    const apiKey = ENV.SUPABASE_ANON_KEY;
    
    // First check if the user-reward pair already exists
    const checkUrl = `${restEndpoint}/user_rewards?apikey=${apiKey}&user_id=eq.${userId}&reward_id=eq.${rewardId}`;
    const checkResponse = await fetch(checkUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    });
    
    if (!checkResponse.ok) {
      const errorText = await checkResponse.text();
      console.error('Error checking existing user reward:', {
        status: checkResponse.status,
        statusText: checkResponse.statusText,
        body: errorText
      });
    }
    
    const existingData = await checkResponse.json();
    let response;
    
    const requestBody = {
      user_id: userId,
      reward_id: rewardId,
      proof_data: proofData,
      unlocked_at: new Date().toISOString()
    };
    
    if (existingData && existingData.length > 0) {
      // Update existing record
      console.log('Updating existing user reward');
      response = await fetch(checkUrl, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify(requestBody)
      });
    } else {
      // Create new record
      console.log('Creating new user reward');
      const createUrl = `${restEndpoint}/user_rewards?apikey=${apiKey}`;
      response = await fetch(createUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify(requestBody)
      });
    }
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error assigning reward:', {
        status: response.status,
        statusText: response.statusText,
        body: errorText
      });
      throw new Error('Failed to assign reward');
    }
    
    const data = await response.json();
    
    if (!data || data.length === 0) {
      throw new Error('No data returned when assigning reward');
    }
    
    console.log('Successfully assigned reward:', data[0]);
    return data[0];
  } catch (error) {
    console.error('Error assigning reward:', error);
    return null;
  }
} 