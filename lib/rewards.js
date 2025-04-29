const axios = require('axios');
require('dotenv').config();

// Get environment variables
const apiUrl = process.env.SUPABASE_URL?.replace('/rest/v1', '') || 'https://kamidb.online';
const apiKey = process.env.SUPABASE_ANON_KEY || '';

/**
 * Get all rewards/badges for a specific Anilist user
 * @param {number} anilistId - The Anilist ID of the user
 * @returns {Promise<Array>} - Array of reward objects
 */
async function getRewardsForUser(anilistId) {
  if (!anilistId) {
    console.error('getRewardsForUser: No anilistId provided');
    return [];
  }

  try {
    // Set up headers for API request
    const headers = {
      'apikey': apiKey,
      'Content-Type': 'application/json'
    };

    // Make request to the user_badges endpoint filtered by anilist_id
    const response = await axios.get(
      `${apiUrl}/rest/v1/user_badges?anilist_id=eq.${anilistId}&select=*`,
      { headers }
    );

    if (response.status === 200) {
      return response.data || [];
    } else {
      console.error(`Error fetching rewards: ${response.status} ${response.statusText}`);
      return [];
    }
  } catch (error) {
    console.error('Error in getRewardsForUser:', error.message);
    return [];
  }
}

/**
 * Award a badge to a user
 * @param {number} anilistId - The Anilist ID of the user
 * @param {string} badgeId - The ID of the badge to award
 * @param {string} [jwt] - Optional JWT token for authenticated requests
 * @returns {Promise<Object>} - The created badge object
 */
async function awardBadge(anilistId, badgeId, jwt) {
  if (!anilistId || !badgeId) {
    console.error('awardBadge: Missing required parameters');
    return null;
  }

  try {
    // Set up headers for API request
    const headers = {
      'apikey': apiKey,
      'Content-Type': 'application/json'
    };
    
    // Add Authorization header if JWT is provided
    if (jwt) {
      headers.Authorization = `Bearer ${jwt}`;
    }

    // Create the badge record
    const badgeData = {
      anilist_id: anilistId,
      badge_id: badgeId,
      unlocked_at: new Date().toISOString()
    };

    // Make POST request to the user_badges endpoint
    const response = await axios.post(
      `${apiUrl}/rest/v1/user_badges`,
      badgeData,
      { headers }
    );

    if (response.status === 201) {
      return response.data || null;
    } else {
      console.error(`Error awarding badge: ${response.status} ${response.statusText}`);
      return null;
    }
  } catch (error) {
    console.error('Error in awardBadge:', error.message);
    return null;
  }
}

/**
 * Get all available badges from the database
 * @returns {Promise<Array>} - Array of all badge definitions
 */
async function getAllBadges() {
  try {
    // Set up headers for API request
    const headers = {
      'apikey': apiKey,
      'Content-Type': 'application/json'
    };

    // Make request to the badges endpoint
    const response = await axios.get(
      `${apiUrl}/rest/v1/badges?select=*`,
      { headers }
    );

    if (response.status === 200) {
      return response.data || [];
    } else {
      console.error(`Error fetching badges: ${response.status} ${response.statusText}`);
      return [];
    }
  } catch (error) {
    console.error('Error in getAllBadges:', error.message);
    return [];
  }
}

module.exports = {
  getRewardsForUser,
  awardBadge,
  getAllBadges
}; 