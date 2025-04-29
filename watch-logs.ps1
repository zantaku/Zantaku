# Script to capture detailed logs for React Native app crashes
Write-Host "Setting up detailed logging for React Native..." -ForegroundColor Cyan

# Clear existing logs
Write-Host "Clearing existing logs..." -ForegroundColor Yellow
adb logcat -c

# Uninstall the app if it exists
Write-Host "Uninstalling existing app..." -ForegroundColor Yellow
adb uninstall com.kamilist.app

# Restore the original MainActivity
Write-Host "Restoring original MainActivity configuration..." -ForegroundColor Cyan
if (Test-Path -Path ".\android\app\src\main\AndroidManifest.xml.bak") {
    Copy-Item ".\android\app\src\main\AndroidManifest.xml.bak" ".\android\app\src\main\AndroidManifest.xml" -Force
    Write-Host "✅ Original AndroidManifest.xml restored" -ForegroundColor Green
}
if (Test-Path -Path ".\android\app\src\main\java\com\kamilist\app\MinimalActivity.kt") {
    Remove-Item ".\android\app\src\main\java\com\kamilist\app\MinimalActivity.kt" -Force
    Write-Host "✅ MinimalActivity.kt removed" -ForegroundColor Green
}

# Run a clean build
Write-Host "Building the app..." -ForegroundColor Cyan
Set-Location -Path ".\android"
.\gradlew clean
.\gradlew assembleDebug --info

# Install the APK if build was successful
if ($LASTEXITCODE -eq 0) {
    Write-Host "Install the APK..." -ForegroundColor Cyan
    $apkPath = "app\build\outputs\apk\debug\app-debug.apk"
    adb install -r $apkPath
}

# Return to the original directory
Set-Location -Path ".."

# Start logging with detailed filters
Write-Host "Starting detailed logging..." -ForegroundColor Cyan
Write-Host "Watching for React Native issues..." -ForegroundColor Yellow
Write-Host "(Press Ctrl+C to stop)" -ForegroundColor Yellow

# Launch the app
adb shell monkey -p com.kamilist.app -c android.intent.category.LAUNCHER 1

# More specific and comprehensive filter pattern
adb logcat | Select-String -Pattern "(com.kamilist.app|ActivityManager|AndroidRuntime|System.err|React|ReactNative|Hermes|JSC|soloader|dlopen|fatal|FATAL|Exception|EXCEPTION|Error|ERROR)" 