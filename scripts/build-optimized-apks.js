#!/usr/bin/env node

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Building optimized APKs for Kamilist...\n');

// Configuration
const config = {
  architectures: ['armeabi-v7a', 'arm64-v8a', 'x86', 'x86_64'],
  buildTypes: ['release', 'releaseOptimized'],
  maxSizeMB: 100,
  outputDir: path.join(process.cwd(), 'android', 'app', 'build', 'outputs', 'apk')
};

function formatBytes(bytes) {
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(2)} MB`;
}

function checkAPKSize(apkPath, maxSizeMB) {
  if (!fs.existsSync(apkPath)) {
    console.log(`❌ APK not found: ${apkPath}`);
    return false;
  }
  
  const stats = fs.statSync(apkPath);
  const sizeMB = stats.size / (1024 * 1024);
  const sizeStatus = sizeMB <= maxSizeMB ? '✅' : '⚠️';
  
  console.log(`${sizeStatus} ${path.basename(apkPath)}: ${formatBytes(stats.size)}`);
  
  if (sizeMB > maxSizeMB) {
    console.log(`   Warning: Exceeds ${maxSizeMB}MB target by ${(sizeMB - maxSizeMB).toFixed(2)}MB`);
  }
  
  return sizeMB <= maxSizeMB;
}

function buildAPKs() {
  console.log('📦 Building architecture-specific APKs...\n');
  
  try {
    // Change to android directory
    process.chdir(path.join(process.cwd(), 'android'));
    
    // Clean build
    console.log('🧹 Cleaning previous builds...');
    execSync('gradlew.bat clean', { stdio: 'inherit' });
    
    // Build release APKs
    console.log('\n🔨 Building release APKs...');
    execSync('gradlew.bat assembleRelease', { stdio: 'inherit' });
    
    // Build optimized APKs
    console.log('\n🔨 Building optimized APKs...');
    execSync('gradlew.bat assembleReleaseOptimized', { stdio: 'inherit' });
    
    console.log('\n✅ Build completed successfully!\n');
    
  } catch (error) {
    console.error('❌ Build failed:', error.message);
    process.exit(1);
  }
}

function analyzeAPKs() {
  console.log('📊 Analyzing APK sizes...\n');
  
  const results = [];
  
  // Check all APK files
  config.buildTypes.forEach(buildType => {
    const buildDir = path.join(config.outputDir, buildType);
    
    if (!fs.existsSync(buildDir)) {
      console.log(`❌ Build directory not found: ${buildDir}`);
      return;
    }
    
    console.log(`\n📱 ${buildType.toUpperCase()} APKs:`);
    
    config.architectures.forEach(arch => {
      const apkName = `app-${arch}-${buildType}.apk`;
      const apkPath = path.join(buildDir, apkName);
      
      const isValid = checkAPKSize(apkPath, config.maxSizeMB);
      results.push({
        buildType,
        architecture: arch,
        path: apkPath,
        isValid,
        exists: fs.existsSync(apkPath)
      });
    });
  });
  
  return results;
}

function generateReport(results) {
  console.log('\n📋 Build Report:');
  console.log('================\n');
  
  const validAPKs = results.filter(r => r.exists && r.isValid);
  const oversizedAPKs = results.filter(r => r.exists && !r.isValid);
  const missingAPKs = results.filter(r => !r.exists);
  
  console.log(`✅ Valid APKs (under ${config.maxSizeMB}MB): ${validAPKs.length}`);
  console.log(`⚠️  Oversized APKs: ${oversizedAPKs.length}`);
  console.log(`❌ Missing APKs: ${missingAPKs.length}`);
  
  if (validAPKs.length > 0) {
    console.log('\n🎯 Recommended APKs for distribution:');
    validAPKs.forEach(apk => {
      console.log(`   • ${path.basename(apk.path)} (${apk.architecture})`);
    });
  }
  
  if (oversizedAPKs.length > 0) {
    console.log('\n⚠️  APKs requiring optimization:');
    oversizedAPKs.forEach(apk => {
      console.log(`   • ${path.basename(apk.path)} (${apk.architecture})`);
    });
  }
  
  // Generate optimization suggestions
  console.log('\n💡 Optimization Suggestions:');
  console.log('   • Use App Bundle (.aab) for Play Store distribution');
  console.log('   • Enable dynamic feature delivery');
  console.log('   • Consider removing unused resources');
  console.log('   • Optimize image assets with WebP format');
  console.log('   • Review native library dependencies');
  
  return validAPKs.length > 0;
}

function copyOptimizedAPKs(results) {
  const validAPKs = results.filter(r => r.exists && r.isValid);
  
  if (validAPKs.length === 0) {
    console.log('\n❌ No valid APKs to copy');
    return;
  }
  
  const outputFolder = path.join(process.cwd(), '..', 'optimized-apks');
  
  // Create output folder
  if (!fs.existsSync(outputFolder)) {
    fs.mkdirSync(outputFolder, { recursive: true });
  }
  
  console.log(`\n📁 Copying optimized APKs to: ${outputFolder}`);
  
  validAPKs.forEach(apk => {
    const destPath = path.join(outputFolder, path.basename(apk.path));
    fs.copyFileSync(apk.path, destPath);
    console.log(`   ✅ ${path.basename(apk.path)}`);
  });
}

// Main execution
function main() {
  try {
    // Build APKs
    buildAPKs();
    
    // Analyze results
    const results = analyzeAPKs();
    
    // Generate report
    const hasValidAPKs = generateReport(results);
    
    // Copy optimized APKs
    if (hasValidAPKs) {
      copyOptimizedAPKs(results);
    }
    
    console.log('\n🎉 Build process completed!');
    
    if (!hasValidAPKs) {
      console.log('\n⚠️  Consider running additional optimizations or using App Bundle format');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('\n❌ Build process failed:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { main, checkAPKSize, formatBytes }; 