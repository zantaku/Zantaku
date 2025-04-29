# Rebuild Android Release Script
Write-Host "🚀 Rebuilding Android Release with JSC..." -ForegroundColor Cyan

# Step 1: Clean the project
Write-Host "🧹 Cleaning project..." -ForegroundColor Yellow
Push-Location android
./gradlew clean
Pop-Location

# Step 2: Bundle the JavaScript
Write-Host "📦 Creating JavaScript bundle..." -ForegroundColor Yellow
$assetsDir = "android/app/src/main/assets"
if (-not (Test-Path $assetsDir)) {
    New-Item -ItemType Directory -Path $assetsDir -Force | Out-Null
    Write-Host "📁 Created assets directory" -ForegroundColor Green
}

# Create the JS bundle
npx react-native bundle --platform android --dev false --entry-file index.js --bundle-output android/app/src/main/assets/index.android.bundle --assets-dest android/app/src/main/res

# Step 3: Build the release APK
Write-Host "🔨 Building release APK..." -ForegroundColor Yellow
Push-Location android
./gradlew assembleRelease
Pop-Location

# Final output
Write-Host "✅ Build complete!" -ForegroundColor Green
Write-Host "📱 APK location: android/app/build/outputs/apk/release/" -ForegroundColor Green
Write-Host "📋 Remember to test your APK before distributing!" -ForegroundColor Green 