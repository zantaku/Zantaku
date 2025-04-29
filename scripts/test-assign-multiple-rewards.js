require('dotenv').config();
const axios = require('axios');

// Get environment variables
const apiUrl = process.env.SUPABASE_URL?.replace('/rest/v1', '') || 'https://kamidb.online';
const apiKey = process.env.SUPABASE_ANON_KEY || '';

// Configure test user (use one found from the test-user-ids.js output)
const TEST_USER_ID = '4bbffeea-118e-47b1-a5e1-56483dd6047a'; // Blackman12345

console.log('🔍 Testing KamiDB Multiple Reward Assignment');
console.log('URL:', apiUrl);
console.log('Target User ID:', TEST_USER_ID);

async function assignMultipleRewards() {
  try {
    // Set up headers for API request
    const headers = {
      'apikey': apiKey,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Prefer': 'return=representation'
    };
    
    // Get all rewards
    console.log('\n📡 Getting all rewards...');
    const rewardsResponse = await axios.get(
      `${apiUrl}/rest/v1/rewards?apikey=${apiKey}`,
      { headers }
    );
    
    if (!rewardsResponse.data || rewardsResponse.data.length === 0) {
      console.error('❌ No rewards found in the database');
      return;
    }
    
    const rewards = rewardsResponse.data;
    console.log(`Found ${rewards.length} rewards`);
    
    // Get existing user rewards to avoid duplicates
    console.log('\n📡 Checking existing user rewards...');
    const userRewardsResponse = await axios.get(
      `${apiUrl}/rest/v1/user_rewards?apikey=${apiKey}&user_id=eq.${TEST_USER_ID}`,
      { headers }
    );
    
    const existingRewardIds = (userRewardsResponse.data || []).map(ur => ur.reward_id);
    console.log(`User already has ${existingRewardIds.length} rewards`);
    
    // Filter rewards to only those not already assigned
    const rewardsToAssign = rewards.filter(reward => !existingRewardIds.includes(reward.id));
    console.log(`Will assign ${rewardsToAssign.length} new rewards to user`);
    
    if (rewardsToAssign.length === 0) {
      console.log('✅ User already has all available rewards!');
      return;
    }
    
    // Assign each reward
    for (const [index, reward] of rewardsToAssign.entries()) {
      console.log(`\n📡 Assigning reward ${index + 1}/${rewardsToAssign.length}: ${reward.name}`);
      
      const assignUrl = `${apiUrl}/rest/v1/user_rewards?apikey=${apiKey}`;
      
      const requestBody = {
        user_id: TEST_USER_ID,
        reward_id: reward.id,
        unlocked_at: new Date().toISOString(),
        proof_data: { 
          test: true,
          assigned_by: 'test-assign-multiple-rewards.js script',
          timestamp: Date.now()
        }
      };
      
      try {
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
          console.log(`✅ Successfully assigned reward: ${reward.name}`);
        } else {
          console.error(`❌ Failed to assign reward: Status ${assignResponse.status}`);
        }
      } catch (error) {
        console.error(`❌ Error assigning reward ${reward.name}:`, error.message);
        if (error.response) {
          console.error('Status:', error.response.status);
          console.error('Data:', error.response.data);
        }
      }
      
      // Add a small delay between requests to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    // Verify assignments
    console.log('\n📡 Verifying reward assignments...');
    const verifyResponse = await axios.get(
      `${apiUrl}/rest/v1/user_rewards?apikey=${apiKey}&user_id=eq.${TEST_USER_ID}`,
      { headers }
    );
    
    if (verifyResponse.data) {
      console.log(`\n✅ User now has ${verifyResponse.data.length} rewards!`);
    }
    
  } catch (error) {
    console.error('Error in assign multiple rewards:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    }
  }
}

assignMultipleRewards(); 