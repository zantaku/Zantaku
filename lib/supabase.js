require('dotenv').config();
const axios = require('axios');

// Get environment variables
const apiUrl = process.env.SUPABASE_URL?.replace('/rest/v1', '') || 'https://kamidb.online';
const apiKey = process.env.SUPABASE_ANON_KEY || '';

/**
 * Get user data from Anilist ID
 * @param {number} anilistId - The Anilist ID to query
 * @returns {Promise<Object|null>} - The user data or null if not found
 */
async function getAnilistUser(anilistId) {
  if (!anilistId) {
    console.error('getAnilistUser: No anilistId provided');
    return null;
  }

  try {
    console.log(`Getting user data for anilist_id: ${anilistId}`);
    
    // Set up headers for API request
    const headers = {
      'apikey': apiKey,
      'Content-Type': 'application/json'
    };

    // Make request to the anilist_users endpoint filtered by anilist_id
    const response = await axios.get(
      `${apiUrl}/rest/v1/anilist_users?anilist_id=eq.${anilistId}`,
      { headers }
    );

    if (response.status === 200) {
      if (response.data && response.data.length > 0) {
        console.log(`Found user: ${response.data[0].username}`);
        return response.data[0];
      } else {
        console.log('No user found with this Anilist ID');
        return null;
      }
    } else {
      console.error(`Error fetching user: ${response.status} ${response.statusText}`);
      return null;
    }
  } catch (error) {
    console.error('Error in getAnilistUser:', error.message);
    return null;
  }
}

/**
 * Save/update an Anilist user in the database
 * @param {Object} userData - The user data to save
 * @param {string} [jwt] - Optional JWT token for authenticated requests
 * @returns {Promise<Object|null>} - The saved user data or null if failed
 */
async function saveAnilistUser(userData, jwt) {
  if (!userData || !userData.anilist_id) {
    console.error('saveAnilistUser: Missing required user data or anilist_id');
    return null;
  }

  try {
    console.log(`Saving user data for anilist_id: ${userData.anilist_id}`);
    
    // Set up headers for API request
    const headers = {
      'apikey': apiKey,
      'Content-Type': 'application/json'
    };
    
    // Add Authorization header if JWT is provided
    if (jwt) {
      headers.Authorization = `Bearer ${jwt}`;
    }

    // Prepare the user data for upsert
    const userDataToSave = {
      ...userData,
      is_verified: true,
      updated_at: new Date().toISOString()
    };

    // Check if user exists first
    const existingUser = await getAnilistUser(userData.anilist_id);
    
    let response;
    
    if (existingUser) {
      // Update existing user
      console.log('Updating existing user record');
      response = await axios.patch(
        `${apiUrl}/rest/v1/anilist_users?anilist_id=eq.${userData.anilist_id}`,
        userDataToSave,
        { 
          headers,
          params: {
            // Using URL params for additional options
            'prefer': 'return=representation'
          }
        }
      );
    } else {
      // Create new user
      console.log('Creating new user record');
      response = await axios.post(
        `${apiUrl}/rest/v1/anilist_users`,
        {
          ...userDataToSave,
          created_at: new Date().toISOString()
        },
        { 
          headers,
          params: {
            // Using URL params for additional options
            'prefer': 'return=representation'
          }
        }
      );
    }

    if (response.status === 200 || response.status === 201) {
      console.log('User data saved successfully');
      return response.data[0] || null;
    } else {
      console.error(`Error saving user: ${response.status} ${response.statusText}`);
      return null;
    }
  } catch (error) {
    console.error('Error in saveAnilistUser:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
    return null;
  }
}

module.exports = {
  getAnilistUser,
  saveAnilistUser
}; 