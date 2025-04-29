/**
 * Post-build script to obfuscate JavaScript code for production builds
 * To be run after the main build process
 */

const fs = require('fs');
const path = require('path');
const JavaScriptObfuscator = require('javascript-obfuscator');
const glob = require('glob');

// Configuration for the JavaScript obfuscator
const obfuscatorConfig = {
  compact: true,
  controlFlowFlattening: true,
  controlFlowFlatteningThreshold: 0.75,
  deadCodeInjection: true,
  deadCodeInjectionThreshold: 0.4,
  debugProtection: false,
  selfDefending: true,
  stringArray: true,
  stringArrayEncoding: ['base64'],
  stringArrayThreshold: 0.8,
  transformObjectKeys: true,
  unicodeEscapeSequence: false
};

// Directory containing the output JS files (adjust as needed)
const buildDir = path.resolve(__dirname, '../android/app/build/generated/assets/react');

// Find all JS files in the build directory
function processDirectory() {
  console.log('Starting JavaScript obfuscation for production build...');
  
  try {
    // Make sure directory exists
    if (!fs.existsSync(buildDir)) {
      console.error(`Build directory not found: ${buildDir}`);
      console.log('Skipping obfuscation step.');
      return;
    }
    
    // Find all .js files to obfuscate
    const jsFiles = glob.sync(`${buildDir}/**/*.js`);
    
    if (jsFiles.length === 0) {
      console.log('No JavaScript files found for obfuscation.');
      return;
    }
    
    console.log(`Found ${jsFiles.length} JavaScript files to obfuscate.`);
    
    // Process each file
    jsFiles.forEach(filePath => {
      try {
        const content = fs.readFileSync(filePath, 'utf8');
        const obfuscatedCode = JavaScriptObfuscator.obfuscate(content, obfuscatorConfig).getObfuscatedCode();
        fs.writeFileSync(filePath, obfuscatedCode);
        console.log(`Obfuscated: ${path.relative(process.cwd(), filePath)}`);
      } catch (err) {
        console.error(`Error obfuscating ${filePath}:`, err);
      }
    });
    
    console.log('JavaScript obfuscation completed successfully!');
  } catch (err) {
    console.error('Error during obfuscation process:', err);
  }
}

// Run the obfuscation process
processDirectory();
