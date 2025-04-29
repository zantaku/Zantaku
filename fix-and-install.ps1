# Comprehensive cleanup and rebuild script for React Native Android
Write-Host "Starting complete cleanup and rebuild process..." -ForegroundColor Cyan

# 1. First uninstall the app from the device
Write-Host "Uninstalling existing app from device..." -ForegroundColor Yellow
adb uninstall com.kamilist.app

# 2. Clean all build directories
Write-Host "Cleaning build directories..." -ForegroundColor Cyan

# Clean Android build files
$androidDir = Join-Path $PSScriptRoot "android"
if (Test-Path -Path "$androidDir/app/build") {
    Remove-Item -Path "$androidDir/app/build" -Recurse -Force
    Write-Host "Removed app/build directory" -ForegroundColor Green
}

if (Test-Path -Path "$androidDir/.gradle") {
    Remove-Item -Path "$androidDir/.gradle" -Recurse -Force
    Write-Host "Removed .gradle directory" -ForegroundColor Green
}

if (Test-Path -Path "$androidDir/build") {
    Remove-Item -Path "$androidDir/build" -Recurse -Force
    Write-Host "Removed build directory" -ForegroundColor Green
}

# Clean node_modules cache of native modules
if (Test-Path -Path "$PSScriptRoot/node_modules/.cache") {
    Remove-Item -Path "$PSScriptRoot/node_modules/.cache" -Recurse -Force
    Write-Host "Removed node_modules/.cache directory" -ForegroundColor Green
}

# 3. Run Gradle clean
Write-Host "Running Gradle clean..." -ForegroundColor Cyan
Set-Location -Path $androidDir
./gradlew clean

# 4. Build the app
Write-Host "Building debug APK..." -ForegroundColor Cyan
./gradlew assembleDebug

# 5. Check if build was successful
if ($LASTEXITCODE -eq 0) {
    Write-Host "Build completed successfully!" -ForegroundColor Green
    
    # Install the APK
    $apkPath = Join-Path $androidDir "app/build/outputs/apk/debug/app-debug.apk"
    if (Test-Path -Path $apkPath) {
        Write-Host "Installing APK..." -ForegroundColor Cyan
        adb install -r $apkPath
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ Installation successful!" -ForegroundColor Green
            Write-Host "You can now launch the app on your device." -ForegroundColor Cyan
        } else {
            Write-Host "❌ Installation failed with code $LASTEXITCODE" -ForegroundColor Red
        }
    } else {
        Write-Host "❌ APK not found at path: $apkPath" -ForegroundColor Red
    }
} else {
    Write-Host "❌ Build failed with exit code $LASTEXITCODE" -ForegroundColor Red
}

# Return to original directory
Set-Location -Path $PSScriptRoot
Write-Host "Process completed." -ForegroundColor Cyan 