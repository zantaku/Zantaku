require('dotenv').config();
const axios = require('axios');

// Get environment variables
const apiUrl = process.env.SUPABASE_URL?.replace('/rest/v1', '') || 'https://kamidb.online';
const apiKey = process.env.SUPABASE_ANON_KEY || '';

// Function to get user streak data
async function getUserStreakData(anilistId) {
  if (!anilistId) {
    console.log('No anilistId provided');
    return null;
  }
  
  try {
    console.log('Fetching streak data for anilist_id:', anilistId);
    
    // Set up headers for API request
    const headers = {
      'apikey': apiKey,
      'Content-Type': 'application/json'
    };
    
    // Make request to user_streaks endpoint filtered by anilist_id
    const response = await axios.get(
      `${apiUrl}/rest/v1/user_streaks?anilist_id=eq.${anilistId}`,
      { headers }
    );
    
    if (response.status === 200) {
      if (response.data && response.data.length > 0) {
        console.log('Successfully fetched streak data:', {
          id: response.data[0].id,
          anilist_id: response.data[0].anilist_id,
          current_streak: response.data[0].current_streak,
          longest_streak: response.data[0].longest_streak
        });
        return response.data[0];
      } else {
        console.log('No streak data found for user');
        return null;
      }
    } else {
      console.error(`Error getting user streak data: ${response.status} ${response.statusText}`);
      return null;
    }
  } catch (error) {
    console.error('Error getting user streak data:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
    return null;
  }
}

// Function to update user streak
async function updateUserStreak(
  anilistId,
  streakData
) {
  if (!anilistId) {
    console.log('No anilistId provided');
    return null;
  }
  
  try {
    console.log('Updating streak for anilist_id:', anilistId, streakData);
    
    // Get existing streak data first
    const existingStreak = await getUserStreakData(anilistId);
    
    // Set up headers for API request
    const headers = {
      'apikey': apiKey,
      'Content-Type': 'application/json'
    };
    
    // Prepare request body with updated timestamp
    const requestBody = {
      ...streakData,
      updated_at: new Date().toISOString(),
    };
    
    let response;
    
    if (existingStreak) {
      // Update existing record
      console.log('Updating existing streak');
      
      response = await axios.patch(
        `${apiUrl}/rest/v1/user_streaks?anilist_id=eq.${anilistId}`,
        requestBody,
        { 
          headers,
          params: {
            'prefer': 'return=representation'
          }
        }
      );
    } else {
      // Create new record
      console.log('Creating new streak record');
      
      // For new records, we need anilist_id
      response = await axios.post(
        `${apiUrl}/rest/v1/user_streaks`,
        {
          anilist_id: anilistId,
          current_streak: streakData.current_streak || 1,
          longest_streak: streakData.longest_streak || 1,
          last_active: streakData.last_active || new Date().toISOString(),
          type: streakData.type || 'daily',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        { 
          headers,
          params: {
            'prefer': 'return=representation'
          }
        }
      );
    }
    
    if (response.status === 200 || response.status === 201) {
      console.log('Successfully updated streak:', {
        id: response.data[0].id,
        anilist_id: response.data[0].anilist_id,
        current_streak: response.data[0].current_streak,
        longest_streak: response.data[0].longest_streak
      });
      return response.data[0];
    } else {
      console.error(`Error updating streak: ${response.status} ${response.statusText}`);
      return null;
    }
  } catch (error) {
    console.error('Error updating user streak:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
    return null;
  }
}

// Function to check and update streak based on today's activity
async function checkAndUpdateStreak(anilistId, hasActivityToday) {
  if (!anilistId) {
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
    console.error('Error loading streak data:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
    return null;
  }
}

module.exports = {
  getUserStreakData,
  updateUserStreak,
  checkAndUpdateStreak
}; 