import ENV from '../config';
import * as SecureStore from 'expo-secure-store';
import { STORAGE_KEY } from '../constants/auth';

export interface UserStreak {
  id: string;
  anilist_id: number;
  current_streak: number;
  longest_streak: number;
  last_active: string;
  type: string;
  created_at: string;
  updated_at: string;
}

// Function to get user streak data
export async function getUserStreakData(anilistId: number | null): Promise<UserStreak | null> {
  if (anilistId === null) {
    console.log('No anilistId provided');
    return null;
  }
  
  try {
    console.log('Fetching streak data for anilist_id:', anilistId);
    
    // Use direct REST API access with apikey as URL parameter
    const restEndpoint = `${ENV.SUPABASE_URL.replace(/\/$/, '')}`;
    const apiKey = ENV.SUPABASE_ANON_KEY;
    const url = `${restEndpoint}/user_streaks?apikey=${apiKey}&anilist_id=eq.${anilistId}`;
    
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
      console.error('API Error getting user streak data:', {
        status: response.status,
        statusText: response.statusText,
        body: errorText
      });
      return null;
    }
    
    const data = await response.json();
    
    if (!data || data.length === 0) {
      console.log('No streak data found for user');
      return null;
    }
    
    console.log('Successfully fetched streak data:', {
      id: data[0].id,
      anilist_id: data[0].anilist_id,
      current_streak: data[0].current_streak,
      longest_streak: data[0].longest_streak
    });
    
    return data[0];
  } catch (error) {
    console.error('Error getting user streak data:', error);
    return null;
  }
}

// Function to update user streak
export async function updateUserStreak(
  anilistId: number | null,
  streakData: {
    current_streak?: number;
    longest_streak?: number;
    last_active?: string;
    type?: string;
  }
): Promise<UserStreak | null> {
  if (anilistId === null) {
    console.log('No anilistId provided');
    return null;
  }
  
  try {
    console.log('Updating streak for anilist_id:', anilistId, streakData);
    
    // Get existing streak data first
    const existingStreak = await getUserStreakData(anilistId);
    
    // Use direct REST API access with apikey as URL parameter
    const restEndpoint = `${ENV.SUPABASE_URL.replace(/\/$/, '')}`;
    const apiKey = ENV.SUPABASE_ANON_KEY;
    
    // Prepare request body with updated timestamp
    const requestBody = {
      ...streakData,
      updated_at: new Date().toISOString(),
    };
    
    let response;
    
    if (existingStreak) {
      // Update existing record
      const updateUrl = `${restEndpoint}/user_streaks?apikey=${apiKey}&anilist_id=eq.${anilistId}`;
      console.log('Updating existing streak');
      
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
      // Create new record
      const createUrl = `${restEndpoint}/user_streaks?apikey=${apiKey}`;
      console.log('Creating new streak record');
      
      // For new records, we need anilist_id
      response = await fetch(createUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({
          anilist_id: anilistId,
          current_streak: streakData.current_streak || 1,
          longest_streak: streakData.longest_streak || 1,
          last_active: streakData.last_active || new Date().toISOString(),
          type: streakData.type || 'daily',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
      });
    }
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('API Error updating streak:', {
        status: response.status,
        statusText: response.statusText,
        body: errorText
      });
      return null;
    }
    
    const data = await response.json();
    
    if (!data || data.length === 0) {
      console.error('No data returned from streak update operation');
      return null;
    }
    
    console.log('Successfully updated streak:', {
      id: data[0].id,
      anilist_id: data[0].anilist_id,
      current_streak: data[0].current_streak,
      longest_streak: data[0].longest_streak
    });
    
    return data[0];
  } catch (error) {
    console.error('Error updating user streak:', error);
    return null;
  }
}

// Function to check and update streak based on today's activity
export async function checkAndUpdateStreak(anilistId: number | null, hasActivityToday: boolean): Promise<UserStreak | null> {
  if (anilistId === null) {
    console.log('No anilistId provided');
    return null;
  }
  
  try {
    console.log('Checking streak update for user:', anilistId);
    
    // Get current streak data
    const currentStreak = await getUserStreakData(anilistId);
    
    // Get current date in ISO format, but truncate to date only (no time)
    const today = new Date().toISOString().split('T')[0];
    
    // Skip if already updated today
    if (currentStreak && currentStreak.last_active?.startsWith(today)) {
      console.log('Skipping streak update, already checked today');
      return currentStreak;
    }
    
    // If there's activity today
    if (hasActivityToday) {
      // Calculate new streak values
      let newCurrentStreak = 1;
      let newLongestStreak = currentStreak?.longest_streak || 1;
      
      if (currentStreak) {
        const lastActive = new Date(currentStreak.last_active);
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        
        // Check if last activity was yesterday
        if (
          lastActive.getFullYear() === yesterday.getFullYear() &&
          lastActive.getMonth() === yesterday.getMonth() &&
          lastActive.getDate() === yesterday.getDate()
        ) {
          // Continue streak
          newCurrentStreak = (currentStreak.current_streak || 0) + 1;
        }
        
        // Update longest streak if needed
        if (newCurrentStreak > newLongestStreak) {
          newLongestStreak = newCurrentStreak;
        }
      }
      
      // Update streak
      return await updateUserStreak(anilistId, {
        current_streak: newCurrentStreak,
        longest_streak: newLongestStreak,
        last_active: new Date().toISOString(),
        type: 'daily'
      });
    } else if (currentStreak) {
      // No activity today, just update the check date without resetting streak
      return await updateUserStreak(anilistId, {
        last_active: new Date().toISOString()
      });
    }
    
    return null;
  } catch (error) {
    console.error('Error loading streak data:', error);
    return null;
  }
} 