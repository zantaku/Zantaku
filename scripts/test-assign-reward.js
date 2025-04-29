require('dotenv').config();
const axios = require('axios');

// Get environment variables
const apiUrl = process.env.SUPABASE_URL?.replace('/rest/v1', '') || 'https://kamidb.online';
const apiKey = process.env.SUPABASE_ANON_KEY || '';

console.log('Loading .env from:', process.cwd() + '/.env');
console.log('🔍 Testing KamiDB Reward Assignment');
console.log('URL:', apiUrl);

async function assignTestReward() {
  try {
    // Set up headers for API request
    const headers = {
      'apikey': apiKey,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Prefer': 'return=representation'
    };
    
    // First get a test user
    console.log('\n📡 Getting a test user...');
    const usersResponse = await axios.get(
      `${apiUrl}/rest/v1/anilist_users?apikey=${apiKey}&limit=1`,
      { headers }
    );
    
    if (!usersResponse.data || usersResponse.data.length === 0) {
      console.error('❌ No users found in the database');
      return;
    }
    
    const testUser = usersResponse.data[0];
    console.log(`Found test user: ${testUser.username} (ID: ${testUser.id})`);
    
    // Get the first reward
    console.log('\n📡 Getting a test reward...');
    const rewardsResponse = await axios.get(
      `${apiUrl}/rest/v1/rewards?apikey=${apiKey}&limit=1`,
      { headers }
    );
    
    if (!rewardsResponse.data || rewardsResponse.data.length === 0) {
      console.error('❌ No rewards found in the database');
      return;
    }
    
    const testReward = rewardsResponse.data[0];
    console.log(`Found test reward: ${testReward.name} (ID: ${testReward.id})`);
    
    // Check if user already has this reward
    console.log('\n📡 Checking if user already has this reward...');
    const checkUrl = `${apiUrl}/rest/v1/user_rewards?apikey=${apiKey}&user_id=eq.${testUser.id}&reward_id=eq.${testReward.id}`;
    const checkResponse = await axios.get(checkUrl, { headers });
    
    if (checkResponse.data && checkResponse.data.length > 0) {
      console.log('✅ User already has this reward');
      console.log(checkResponse.data[0]);
      return;
    }
    
    // Assign the reward to the user
    console.log('\n📡 Assigning reward to user...');
    const assignUrl = `${apiUrl}/rest/v1/user_rewards?apikey=${apiKey}`;
    
    const requestBody = {
      user_id: testUser.id,
      reward_id: testReward.id,
      unlocked_at: new Date().toISOString(),
      proof_data: { 
        test: true,
        assigned_by: 'test-assign-reward.js script',
        timestamp: Date.now()
      }
    };
    
    const assignResponse = await axios.post(
      assignUrl,
      requestBody,
      { 
        headers: {
          ...headers,
          'Prefer': 'return=representation'
        }
      }
    );
    
    if (assignResponse.status === 201 || assignResponse.status === 200) {
      console.log('\n✅ SUCCESS! Reward assigned to user');
      console.log(assignResponse.data[0]);
    } else {
      console.error(`❌ Failed to assign reward: Status ${assignResponse.status}`);
    }
    
    // Verify the assignment
    console.log('\n📡 Verifying reward assignment...');
    const verifyResponse = await axios.get(checkUrl, { headers });
    
    if (verifyResponse.data && verifyResponse.data.length > 0) {
      console.log('✅ Verification successful! User now has the reward');
      console.log(verifyResponse.data[0]);
    } else {
      console.error('❌ Verification failed! Could not find the assigned reward');
    }
    
  } catch (error) {
    console.error('Error in assign test reward:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    }
  }
}

assignTestReward(); 