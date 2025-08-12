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

    // 1) Read once to preserve any existing verification state (defensive)
    const checkUrl = `${restEndpoint}/anilist_users?apikey=${apiKey}&anilist_id=eq.${userData.anilist_id}`;
    console.log('Making direct REST request to:', checkUrl.replace(apiKey, '***'));

    let existingUser: any = null;
    try {
      const checkResponse = await fetch(checkUrl, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      if (checkResponse.ok) {
        const existingData = await checkResponse.json();
        console.log(`✅ User check complete: found ${existingData.length} matching records`);
        existingUser = existingData?.[0] || null;
      } else {
        const errorText = await checkResponse.text();
        console.error('❌ API Error during user check:', {
          status: checkResponse.status,
          statusText: checkResponse.statusText,
          body: errorText,
        });
      }
    } catch (readErr) {
      console.error('User existence check failed but will continue with upsert:', readErr);
    }

    // 2) Never downgrade verification: once true, always true
    const mergedIsVerified = (existingUser?.is_verified === true) || (userData.is_verified === true);

    // 3) Build body and perform a single upsert using PostgREST conflict handling
    const requestBody = {
      anilist_id: userData.anilist_id,
      username: userData.username,
      avatar_url: userData.avatar_url,
      access_token: userData.access_token,
      is_verified: mergedIsVerified === true,
      updated_at: new Date().toISOString(),
    };

    // Upsert on unique key anilist_id
    const upsertUrl = `${restEndpoint}/anilist_users?apikey=${apiKey}&on_conflict=anilist_id`;
    const response = await fetch(upsertUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        // Merge duplicates and return the final representation
        'Prefer': 'resolution=merge-duplicates,return=representation',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ API Error saving user (upsert):', {
        status: response.status,
        statusText: response.statusText,
        body: errorText,
      });
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    if (!data || data.length === 0) {
      console.error('❌ No data returned from upsert operation');
      throw new Error('Failed to save user data, no records returned');
    }

    let saved = data[0];

    // 4) Sanity check: if, for any reason, the DB returned is_verified=false, force it to true
    if (saved?.is_verified !== true) {
      console.warn('⚠️ is_verified returned false from DB. Forcing true to prevent downgrade.');
      const forceUrl = `${restEndpoint}/anilist_users?apikey=${apiKey}&anilist_id=eq.${userData.anilist_id}`;
      const forceResp = await fetch(forceUrl, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Prefer': 'return=representation',
        },
        body: JSON.stringify({ is_verified: true, updated_at: new Date().toISOString() }),
      });
      if (forceResp.ok) {
        const forced = await forceResp.json();
        saved = forced?.[0] || saved;
      } else {
        const errText = await forceResp.text();
        console.error('❌ Failed to force is_verified=true:', {
          status: forceResp.status,
          statusText: forceResp.statusText,
          body: errText,
        });
      }
    }

    console.log('✅ Successfully saved user to Supabase REST API:', {
      id: saved.id,
      anilist_id: saved.anilist_id,
      username: saved.username,
      is_verified: saved.is_verified,
      created_at: saved.created_at,
    });
    return saved;
  } catch (error: any) {
    console.error('❌ Error saving Anilist user:', { name: error.name, message: error.message });
    // Don't throw the error, just log it and continue so the app still works offline/local
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