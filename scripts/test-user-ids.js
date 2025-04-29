require('dotenv').config();
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Get environment variables
const apiUrl = process.env.SUPABASE_URL?.replace('/rest/v1', '') || 'https://kamidb.online';
const apiKey = process.env.SUPABASE_ANON_KEY || '';

console.log('Loading .env from:', process.cwd() + '/.env');
console.log('🔍 Testing User ID Lookup and Verification');
console.log('URL:', apiUrl);

async function checkUserIdFromFile() {
  try {
    console.log('\n📂 Checking for stored user data in local files...');
    
    // Common locations for Expo SecureStore data (simulated for Node.js)
    const possibleLocations = [
      // Check the local directory first
      path.join(process.cwd(), 'user-data.json'),
      path.join(process.cwd(), 'debug', 'user-data.json'),
      path.join(process.cwd(), 'data', 'user-data.json'),
    ];
    
    for (const location of possibleLocations) {
      try {
        if (fs.existsSync(location)) {
          console.log(`Found user data file at: ${location}`);
          const data = JSON.parse(fs.readFileSync(location, 'utf8'));
          console.log('User data from file:', data);
          
          if (data.id) {
            console.log('Supabase user ID from file:', data.id);
          }
          
          if (data.anilist_id) {
            console.log('Anilist ID from file:', data.anilist_id);
          }
          
          return data;
        }
      } catch (err) {
        console.log(`Error reading from ${location}:`, err.message);
      }
    }
    
    console.log('❌ No user data files found in expected locations');
    return null;
  } catch (error) {
    console.error('Error reading user data from files:', error.message);
    return null;
  }
}

async function testSupabaseUsers() {
  try {
    console.log('\n📡 Getting users from Supabase...');
    
    // Set up headers for API request
    const headers = {
      'apikey': apiKey,
      'Content-Type': 'application/json'
    };
    
    // Get the first few users
    const usersResponse = await axios.get(
      `${apiUrl}/rest/v1/anilist_users?apikey=${apiKey}&limit=5`,
      { headers }
    );
    
    if (!usersResponse.data || usersResponse.data.length === 0) {
      console.error('❌ No users found in the database');
      return [];
    }
    
    console.log(`✅ Found ${usersResponse.data.length} users in Supabase`);
    
    // Display each user's details
    usersResponse.data.forEach((user, index) => {
      console.log(`\nUser ${index + 1}:`);
      console.log(`- ID: ${user.id}`);
      console.log(`- Username: ${user.username}`);
      console.log(`- Anilist ID: ${user.anilist_id}`);
      
      // Check for any potential issues with IDs
      if (!user.id) {
        console.log('⚠️ Warning: Missing Supabase ID');
      }
      
      if (!user.anilist_id) {
        console.log('⚠️ Warning: Missing Anilist ID');
      }
    });
    
    return usersResponse.data;
  } catch (error) {
    console.error('Error checking Supabase users:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    }
    return [];
  }
}

async function compareUserIds() {
  try {
    // First get local user data
    const localUserData = await checkUserIdFromFile();
    
    // Then get users from Supabase
    const supabaseUsers = await testSupabaseUsers();
    
    // If we have both, try to find matches
    if (localUserData && supabaseUsers.length > 0) {
      console.log('\n🔍 Comparing local user data with Supabase users...');
      
      let foundMatch = false;
      
      if (localUserData.id) {
        // Try to find a match for the Supabase ID
        const matchBySupabaseId = supabaseUsers.find(user => user.id === localUserData.id);
        
        if (matchBySupabaseId) {
          console.log('✅ Found matching user by Supabase ID:', matchBySupabaseId.username);
          foundMatch = true;
        } else {
          console.log('❌ No Supabase user found with ID:', localUserData.id);
        }
      }
      
      if (localUserData.anilist_id) {
        // Try to find a match for the Anilist ID
        const matchByAnilistId = supabaseUsers.find(user => 
          user.anilist_id && user.anilist_id.toString() === localUserData.anilist_id.toString()
        );
        
        if (matchByAnilistId) {
          console.log('✅ Found matching user by Anilist ID:', matchByAnilistId.username);
          foundMatch = true;
        } else {
          console.log('❌ No Supabase user found with Anilist ID:', localUserData.anilist_id);
        }
      }
      
      if (!foundMatch) {
        console.log('❌ Could not find any matching user in Supabase for the local user data');
      }
    }
  } catch (error) {
    console.error('Error comparing user IDs:', error.message);
  }
}

async function runTests() {
  console.log('='.repeat(50));
  console.log('Starting User ID Tests');
  console.log('='.repeat(50));
  
  await compareUserIds();
  
  console.log('\n='.repeat(50));
  console.log('User ID Tests Complete');
  console.log('='.repeat(50));
}

runTests(); 