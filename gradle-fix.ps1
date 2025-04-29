# Script to fix Gradle issues and rebuild
Write-Host "Applying fixes to disable Hermes completely..." -ForegroundColor Cyan

# Paths to files we need to modify
$mainAppKt = ".\android\app\src\main\java\com\kamilist\app\MainApplication.kt"
$gradleProps = ".\android\gradle.properties"
$appBuildGradle = ".\android\app\build.gradle"

# 1. Modify MainApplication.kt
if (Test-Path -Path $mainAppKt) {
    Write-Host "Updating MainApplication.kt..." -ForegroundColor Yellow
    $content = Get-Content -Path $mainAppKt -Raw
    $content = $content -replace "override val isHermesEnabled: Boolean = true", "override val isHermesEnabled: Boolean = false"
    $content | Set-Content -Path $mainAppKt
    Write-Host "✅ MainApplication.kt updated" -ForegroundColor Green
}

# 2. Modify gradle.properties
if (Test-Path -Path $gradleProps) {
    Write-Host "Updating gradle.properties..." -ForegroundColor Yellow
    $content = Get-Content -Path $gradleProps -Raw
    $content = $content -replace "hermesEnabled=true", "hermesEnabled=false"
    $content | Set-Content -Path $gradleProps
    Write-Host "✅ gradle.properties updated" -ForegroundColor Green
}

# 3. Modify build.gradle
if (Test-Path -Path $appBuildGradle) {
    Write-Host "Updating app build.gradle..." -ForegroundColor Yellow
    $content = Get-Content -Path $appBuildGradle -Raw
    $content = $content -replace "enableHermes: true", "enableHermes: false"
    
    # Remove hermes-android dependency
    $content = $content -replace "implementation ""com.facebook.react:hermes-android:.*""", "// Hermes disabled"
    
    # Update packagingOptions to use JSC instead
    $content = $content -replace "pickFirst '\*\*/libhermes.so'", "exclude '**/libhermes.so'"
    $content = $content -replace "pickFirst '\*\*/libhermes_executor.so'", "exclude '**/libhermes_executor.so'"
    
    $content | Set-Content -Path $appBuildGradle
    Write-Host "✅ app build.gradle updated" -ForegroundColor Green
}

# Now run the fix-and-install script
Write-Host "`nRunning fix-and-install.ps1..." -ForegroundColor Cyan
./fix-and-install.ps1

Write-Host "`nAfter installation, run this to see logs:" -ForegroundColor Yellow
Write-Host "adb logcat -c; adb logcat | Select-String -Pattern '(com.kamilist.app|AndroidRuntime|System.err|ReactNative)'" 