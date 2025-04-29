require('dotenv').config();
const axios = require('axios');

// Get environment variables
const apiUrl = process.env.SUPABASE_URL?.replace('/rest/v1', '') || 'https://kamidb.online';
const apiKey = process.env.SUPABASE_ANON_KEY || '';

console.log('Loading .env from:', process.cwd() + '/.env');
console.log('🔍 Testing connection to KamiDB REST API');
console.log('URL:', apiUrl);

async function testRewardsAPI() {
  try {
    console.log('📡 Sending GET request to: ' + apiUrl + '/rest/v1/rewards');
    
    // Set up headers for API request
    const headers = {
      'apikey': apiKey,
      'Content-Type': 'application/json'
    };
    
    // First test getting rewards
    const rewardsResponse = await axios.get(
      `${apiUrl}/rest/v1/rewards?apikey=${apiKey}`,
      { headers }
    );
    
    if (rewardsResponse.status === 200) {
      console.log(`\n✅ SUCCESS! Retrieved ${rewardsResponse.data.length} rewards`);
      
      // Show sample rewards
      console.log('\nSample rewards:');
      rewardsResponse.data.slice(0, 3).forEach((reward, index) => {
        console.log(`\nReward ${index + 1}:`);
        console.log(`- ID: ${reward.id}`);
        console.log(`- Name: ${reward.name}`);
        console.log(`- Type: ${reward.type}`);
        console.log(`- Description: ${reward.description}`);
      });
    }
    
    // Next test getting user rewards
    console.log('\n🔍 Testing user rewards lookup');
    
    // Get a test user first
    const usersResponse = await axios.get(
      `${apiUrl}/rest/v1/anilist_users?apikey=${apiKey}&limit=1`,
      { headers }
    );
    
    if (usersResponse.data && usersResponse.data.length > 0) {
      const testUser = usersResponse.data[0];
      console.log(`Using test user: ${testUser.username} (ID: ${testUser.id})`);
      
      // Get rewards for this user
      const userRewardsResponse = await axios.get(
        `${apiUrl}/rest/v1/user_rewards?apikey=${apiKey}&user_id=eq.${testUser.id}`,
        { headers }
      );
      
      if (userRewardsResponse.status === 200) {
        console.log(`\n✅ SUCCESS! Found ${userRewardsResponse.data.length} rewards for user`);
        
        if (userRewardsResponse.data.length > 0) {
          console.log('\nSample user rewards:');
          userRewardsResponse.data.slice(0, 3).forEach((userReward, index) => {
            console.log(`\nUser Reward ${index + 1}:`);
            console.log(`- ID: ${userReward.id}`);
            console.log(`- Reward ID: ${userReward.reward_id}`);
            console.log(`- Unlocked at: ${userReward.unlocked_at}`);
          });
          
          // Get the reward details for one of the user rewards
          if (userRewardsResponse.data.length > 0) {
            const firstRewardId = userRewardsResponse.data[0].reward_id;
            console.log(`\n🔍 Looking up details for reward: ${firstRewardId}`);
            
            const rewardDetailsResponse = await axios.get(
              `${apiUrl}/rest/v1/rewards?apikey=${apiKey}&id=eq.${firstRewardId}`,
              { headers }
            );
            
            if (rewardDetailsResponse.status === 200 && rewardDetailsResponse.data.length > 0) {
              console.log(`\n✅ Reward details found:`);
              console.log(`- Name: ${rewardDetailsResponse.data[0].name}`);
              console.log(`- Description: ${rewardDetailsResponse.data[0].description}`);
            } else {
              console.log(`❌ Could not find reward details for ID: ${firstRewardId}`);
            }
          }
        } else {
          console.log('No rewards found for this user yet.');
        }
      }
    } else {
      console.log('❌ No users found in the database');
    }
    
  } catch (error) {
    console.error('Error testing rewards API:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    }
  }
}

testRewardsAPI(); 