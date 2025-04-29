// Simple script to check environment variables
require('dotenv').config();

console.log('=== ENVIRONMENT VARIABLES CHECK ===');
console.log('SUPABASE_URL from .env:', process.env.SUPABASE_URL);
console.log('SUPABASE_ANON_KEY from .env:', process.env.SUPABASE_ANON_KEY ? 
  (process.env.SUPABASE_ANON_KEY.substring(0, 15) + '...') : 'undefined');

// Check if any environment file exists for development or production
console.log('\n=== CHECKING FOR ADDITIONAL ENV FILES ===');
try {
  const fs = require('fs');
  
  const envFiles = [
    '.env',
    '.env.local',
    '.env.development',
    '.env.production',
    'app.json',
    'eas.json'
  ];
  
  for (const file of envFiles) {
    if (fs.existsSync(file)) {
      console.log(`${file} exists`);
      
      // For .env files, check if they contain Supabase URLs
      if (file.startsWith('.env')) {
        const content = fs.readFileSync(file, 'utf8');
        const supabaseUrlMatch = content.match(/SUPABASE_URL\s*=\s*(.+)/);
        if (supabaseUrlMatch) {
          console.log(`  - Contains SUPABASE_URL: ${supabaseUrlMatch[1]}`);
        }
      }
    } else {
      console.log(`${file} does not exist`);
    }
  }
} catch (error) {
  console.error('Error checking files:', error);
}

// Run a simple test - prints the process.env object keys
console.log('\n=== ALL ENVIRONMENT VARIABLES ===');
console.log(Object.keys(process.env).filter(key => key.includes('SUPABASE')));

console.log('\n=== TESTING PROCESS ===');
console.log('Current working directory:', process.cwd()); 