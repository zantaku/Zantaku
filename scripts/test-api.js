// Test direct API connection to KamiDB
const fs = require('fs');
const path = require('path');

// Load environment variables from .env file
function loadEnv() {
  const envPath = path.resolve(process.cwd(), '.env');
  console.log('Loading .env from:', envPath);
  
  try {
    const envFile = fs.readFileSync(envPath, 'utf8');
    const envVars = {};
    
    envFile.split('\n').forEach(line => {
      // Skip comments and empty lines
      if (!line || line.trim().startsWith('#')) return;
      
      // Find the first equals sign
      const equalsIndex = line.indexOf('=');
      if (equalsIndex > 0) {
        const key = line.substring(0, equalsIndex).trim();
        const value = line.substring(equalsIndex + 1).trim();
        // Remove quotes if present
        envVars[key] = value.replace(/^["'](.*)["']$/, '$1');
      }
    });
    
    return envVars;
  } catch (error) {
    console.error('Error reading .env file:', error);
    return {};
  }
}

// Main test function
async function testAPIConnection() {
  const env = loadEnv();
  
  // Get Supabase URL and API key
  const supabaseUrl = env.SUPABASE_URL || '';
  const apiKey = env.SUPABASE_ANON_KEY || '';
  
  if (!supabaseUrl || !apiKey) {
    console.error('❌ Missing Supabase credentials in .env file');
    process.exit(1);
  }
  
  // Clean up URL
  const baseUrl = supabaseUrl.replace(/\/$/, '');
  console.log('🔍 Testing connection to KamiDB REST API');
  console.log('URL:', baseUrl);
  console.log('API Key (first 15 chars):', apiKey.substring(0, 15) + '...');
  
  // Test endpoint
  const endpoint = `${baseUrl}/anilist_users`;
  const url = `${endpoint}?apikey=${apiKey}&limit=3`;
  
  try {
    console.log('\n📡 Sending GET request to:', endpoint);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ API Error:', {
        status: response.status,
        statusText: response.statusText,
        body: errorText
      });
      process.exit(1);
    }
    
    const data = await response.json();
    
    console.log(`\n✅ SUCCESS! Retrieved ${data.length} users\n`);
    
    if (data.length > 0) {
      console.log('Sample user data:');
      data.forEach((user, index) => {
        console.log(`\nUser ${index + 1}:`);
        console.log('- ID:', user.id);
        console.log('- Anilist ID:', user.anilist_id);
        console.log('- Username:', user.username);
        console.log('- Avatar:', user.avatar_url ? user.avatar_url.substring(0, 30) + '...' : 'None');
        console.log('- Token length:', user.access_token ? user.access_token.length : 0);
        console.log('- Verified:', user.is_verified);
      });
    }
    
    // Test specific user lookup
    const testId = data.length > 0 ? data[0].anilist_id : 5777099;
    console.log(`\n🔍 Testing specific user lookup for anilist_id: ${testId}`);
    
    const userUrl = `${endpoint}?apikey=${apiKey}&anilist_id=eq.${testId}`;
    const userResponse = await fetch(userUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    });
    
    if (!userResponse.ok) {
      const errorText = await userResponse.text();
      console.error('❌ User lookup error:', {
        status: userResponse.status,
        statusText: userResponse.statusText,
        body: errorText
      });
    } else {
      const userData = await userResponse.json();
      if (userData.length > 0) {
        console.log('✅ User lookup successful!');
        console.log('- Username:', userData[0].username);
      } else {
        console.log('❌ User not found');
      }
    }
    
  } catch (error) {
    console.error('❌ Error testing API connection:', error);
    process.exit(1);
  }
}

// Run the test
testAPIConnection().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
}); 