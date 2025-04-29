// Test script to verify auth settings
const fs = require('fs');
const path = require('path');
const SecureStore = require('expo-secure-store');

// Function to manually parse .env file
function parseEnvFile(filePath) {
  try {
    const envFile = fs.readFileSync(filePath, 'utf8');
    const envVars = {};
    
    envFile.split('\n').forEach(line => {
      // Skip comments and empty lines
      if (!line || line.startsWith('#')) return;
      
      // Find the first equals sign
      const equalsIndex = line.indexOf('=');
      if (equalsIndex > 0) {
        const key = line.substring(0, equalsIndex).trim();
        const value = line.substring(equalsIndex + 1).trim();
        envVars[key] = value;
      }
    });
    
    return envVars;
  } catch (error) {
    console.error('Error reading .env file:', error);
    return {};
  }
}

// Parse .env file
const envPath = path.resolve(process.cwd(), '.env');
console.log('Parsing .env file from:', envPath);
const envVars = parseEnvFile(envPath);

console.log('\n=== AUTH CONFIGURATION ===');
console.log('App Scheme: zantaku');
console.log('Redirect URI:', envVars.ANILIST_REDIRECT_URI);

// Check if redirect URI matches scheme
if (envVars.ANILIST_REDIRECT_URI && envVars.ANILIST_REDIRECT_URI.startsWith('zantaku://')) {
  console.log('✅ Redirect URI matches app scheme');
} else {
  console.log('❌ Redirect URI does not match app scheme:', envVars.ANILIST_REDIRECT_URI);
}

// Check Supabase configuration
console.log('\n=== SUPABASE CONFIGURATION ===');
console.log('Supabase URL:', envVars.SUPABASE_URL);
console.log('Supabase Anon Key (first 20 chars):', 
  envVars.SUPABASE_ANON_KEY ? envVars.SUPABASE_ANON_KEY.substring(0, 20) : 'Not set');

// Verify the URL format includes /rest/v1
if (envVars.SUPABASE_URL && envVars.SUPABASE_URL.includes('/rest/v1')) {
  console.log('✅ Supabase URL has correct REST endpoint format');
} else {
  console.log('❌ Warning: Supabase URL should include "/rest/v1"');
}

// Check if REST API with apikey works
console.log('\n=== TESTING API CONNECTION ===');
const baseUrl = envVars.SUPABASE_URL ? envVars.SUPABASE_URL.replace(/\/$/, '') : '';
const apiUrl = `${baseUrl}/anilist_users?apikey=${envVars.SUPABASE_ANON_KEY}&limit=1`;
console.log('API URL format:', baseUrl + '/anilist_users?apikey=***&limit=1');

// Detect any spaces in the Supabase keys
if (envVars.SUPABASE_ANON_KEY && envVars.SUPABASE_ANON_KEY.includes(' ')) {
  console.log('❌ Warning: Supabase Anon Key contains spaces');
  // Show where the space is
  const spaceLoc = envVars.SUPABASE_ANON_KEY.indexOf(' ');
  console.log(`   Space at position ${spaceLoc}: ${envVars.SUPABASE_ANON_KEY.substring(spaceLoc-5, spaceLoc+5)}`);
} else {
  console.log('✅ Supabase Anon Key has no spaces');
}

// Check eas.json configuration
try {
  const easJsonPath = path.resolve(process.cwd(), 'eas.json');
  const easJson = JSON.parse(fs.readFileSync(easJsonPath, 'utf8'));
  
  console.log('\n=== EAS.JSON CONFIGURATION ===');
  if (easJson.build?.production?.env) {
    const prodEnv = easJson.build.production.env;
    
    console.log('Redirect URI:', prodEnv.ANILIST_REDIRECT_URI);
    console.log('Supabase URL:', prodEnv.SUPABASE_URL);
    
    if (prodEnv.ANILIST_REDIRECT_URI?.startsWith('zantaku://')) {
      console.log('✅ EAS Redirect URI matches app scheme');
    } else {
      console.log('❌ EAS Redirect URI does not match app scheme:', prodEnv.ANILIST_REDIRECT_URI);
    }
    
    if (prodEnv.SUPABASE_URL === 'https://kamidb.online/') {
      console.log('✅ EAS Supabase URL matches VPS configuration');
    } else {
      console.log('❌ EAS Supabase URL does not match VPS configuration:', prodEnv.SUPABASE_URL);
    }
  } else {
    console.log('❌ No production environment configuration found in eas.json');
  }
} catch (error) {
  console.error('Error reading eas.json:', error);
}

// Add this code to check that the user ID can be correctly retrieved
const STORAGE_KEY = { USER_DATA: 'user_data' };

async function checkUserIdFromStorage() {
  try {
    console.log('===== CHECKING USER DATA FROM STORAGE =====');
    const userDataStr = await SecureStore.getItemAsync(STORAGE_KEY.USER_DATA);
    
    if (!userDataStr) {
      console.log('❌ No user data found in secure storage');
      return null;
    }
    
    const userData = JSON.parse(userDataStr);
    console.log('✅ User data found in storage:');
    console.log('- AniList ID:', userData.id);
    console.log('- Username:', userData.name);
    
    // Check for Supabase user ID
    if (userData.supabaseId) {
      console.log('✅ Supabase user ID found:', userData.supabaseId);
    } else {
      console.log('❌ No Supabase user ID found in user data');
      if (userData.id) {
        console.log('ℹ️ Will use AniList ID as fallback:', userData.id);
      }
    }
    
    return userData;
  } catch (error) {
    console.error('Error checking user data:', error);
    return null;
  }
}

// At the end of the script
checkUserIdFromStorage().then(() => {
  console.log('===== USER ID CHECK COMPLETE =====');
}); 