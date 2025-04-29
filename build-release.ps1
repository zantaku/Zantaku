#!/usr/bin/env pwsh

# Command line parameter to skip AAB build
param (
    [switch]$SkipAAB
)

# Check if interactive mode - ask user if they want to skip AAB build if not specified via parameter
if (-not $PSBoundParameters.ContainsKey('SkipAAB')) {
    $response = Read-Host "Skip building Android App Bundle (AAB) and only build APKs? (y/n) [Default: n]"
    $SkipAAB = $response -eq "y"
}

# Set environment to production
$env:NODE_ENV = "production"

# Display build information
Write-Output "=== Release Build ===" 
Write-Output "Starting release build with NODE_ENV=production at $(Get-Date)"
if ($SkipAAB) {
    Write-Output "AAB building will be skipped - only building APKs"
}
Write-Output "============================================"

# Change to android directory
Write-Output "Changing to Android directory..."
cd .\android
Write-Output "Current directory: $(Get-Location)"

# Clean all output directories
Write-Output "Cleaning previous build artifacts..."
try {
    # Clean release directories
    if (Test-Path .\app\build\outputs\apk\release) {
        Remove-Item -Path .\app\build\outputs\apk\release\* -Force -Recurse -ErrorAction SilentlyContinue
        Write-Output "  - Cleaned APK release directory"
    }
    
    if (Test-Path .\app\build\outputs\bundle\release) {
        Remove-Item -Path .\app\build\outputs\bundle\release\* -Force -Recurse -ErrorAction SilentlyContinue
        Write-Output "  - Cleaned bundle release directory"
    }
    
    # Clean baseline profiles to avoid the confirmation prompt
    if (Test-Path .\app\build\outputs\apk\release\baselineProfiles) {
        Remove-Item -Path .\app\build\outputs\apk\release\baselineProfiles -Force -Recurse -ErrorAction SilentlyContinue
        Write-Output "  - Cleaned baseline profiles"
    }
    
    # Clean additional build directories that might cause issues
    if (Test-Path .\app\build\intermediates) {
        Remove-Item -Path .\app\build\intermediates -Force -Recurse -ErrorAction SilentlyContinue
        Write-Output "  - Cleaned build intermediates"
    }
    
    if (Test-Path .\app\build\tmp) {
        Remove-Item -Path .\app\build\tmp -Force -Recurse -ErrorAction SilentlyContinue
        Write-Output "  - Cleaned temporary build files"
    }
} catch {
    Write-Output "Error while cleaning build files: $_"
}

# Build Android App Bundle for more efficient distribution if not skipped
$aabFile = $null
if (-not $SkipAAB) {
    Write-Output "============================================"
    Write-Output "Building optimized Android App Bundle (AAB)..."
    try {
        .\gradlew.bat clean bundleRelease --console=plain
        
        if ($LASTEXITCODE -ne 0) {
            Write-Output "AAB build failed with exit code $LASTEXITCODE"
            Write-Output "Falling back to APK build..."
        } else {
            $aabFile = Get-ChildItem -Path .\app\build\outputs\bundle\release\*.aab -File | Select-Object -First 1
            
            if ($aabFile) {
                $aabSize = [Math]::Round($aabFile.Length / 1MB, 2)
                Write-Output "Bundle build successful!"
                Write-Output "AAB file generated: $($aabFile.Name): $aabSize MB"
                Write-Output "This AAB file can be uploaded to Google Play Store for optimal size distribution."
            }
        }
    } catch {
        Write-Output "AAB build failed with exception: $_"
        Write-Output "Falling back to APK build..."
    }
}

# Also build split APKs for direct installation
Write-Output "============================================"
Write-Output "Building optimized split APKs..."
try {
    if ($SkipAAB) {
        # If we skipped AAB build, we need to run clean separately
        .\gradlew.bat clean --console=plain
        if ($LASTEXITCODE -ne 0) {
            Write-Output "Clean failed with exit code $LASTEXITCODE"
            cd ..
            exit 1
        }
        
        # Now build the APKs
        .\gradlew.bat assembleRelease --console=plain
    } else {
        # If we already built AAB, we can just build APKs without cleaning again
        .\gradlew.bat assembleRelease --console=plain
    }
    
    if ($LASTEXITCODE -ne 0) {
        Write-Output "Build failed with exit code $LASTEXITCODE"
        cd ..
        exit 1
    }
} catch {
    Write-Output "Build failed with exception: $_"
    cd ..
    exit 1
}

# Check for architecture-specific APKs in the release directory
$apkDir = ".\app\build\outputs\apk\release"
$apkFiles = Get-ChildItem -Path $apkDir -Filter "*.apk" -File

if ($apkFiles.Count -eq 0) {
    Write-Output "No APK files were generated in the expected directory: $apkDir"
    cd ..
    exit 1
}

# Return to the project root directory
cd ..

# Categorize APKs by architecture
$x86Apks = $apkFiles | Where-Object { $_.Name -match "x86" }
$armApks = $apkFiles | Where-Object { $_.Name -match "arm" }
$universalApk = $apkFiles | Where-Object { $_.Name -notmatch "x86|arm" }

Write-Output "============================================"
Write-Output "Build successful! APK files generated:"

if ($x86Apks.Count -gt 0) {
    Write-Output "x86/x86_64 APKs for emulators:"
    foreach ($apk in $x86Apks) {
        $size = [Math]::Round($apk.Length / 1MB, 2)
        Write-Output "  - $($apk.Name): $size MB"
    }
}

if ($armApks.Count -gt 0) {
    Write-Output "ARM APKs for physical devices:"
    foreach ($apk in $armApks) {
        $size = [Math]::Round($apk.Length / 1MB, 2)
        Write-Output "  - $($apk.Name): $size MB"
    }
} else {
    Write-Output "No ARM APKs were built. Your app may only work on emulators."
}

if ($universalApk.Count -gt 0) {
    Write-Output "Universal APK (works on all devices):"
    foreach ($apk in $universalApk) {
        $size = [Math]::Round($apk.Length / 1MB, 2)
        Write-Output "  - $($apk.Name): $size MB"
    }
}

# Write size comparison information to a file
$reportFile = "APK_SIZE_REPORT.txt"
Write-Output "============================================" | Out-File -FilePath $reportFile
Write-Output "APK Size Report $(Get-Date)" | Out-File -FilePath $reportFile -Append
Write-Output "============================================" | Out-File -FilePath $reportFile -Append

if ($universalApk.Count -gt 0) {
    foreach ($apk in $universalApk) {
        $size = [Math]::Round($apk.Length / 1MB, 2)
        Write-Output "Universal APK: $($apk.Name): $size MB" | Out-File -FilePath $reportFile -Append
    }
}

if ($armApks.Count -gt 0) {
    foreach ($apk in $armApks) {
        $size = [Math]::Round($apk.Length / 1MB, 2)
        Write-Output "ARM APK: $($apk.Name): $size MB" | Out-File -FilePath $reportFile -Append
    }
}

if ($aabFile) {
    $aabSize = [Math]::Round($aabFile.Length / 1MB, 2)
    Write-Output "AAB file: $($aabFile.Name): $aabSize MB" | Out-File -FilePath $reportFile -Append
}

Write-Output "============================================" | Out-File -FilePath $reportFile -Append

# Suggest validation
Write-Output "============================================"
Write-Output "Next steps:"

if ($armApks.Count -gt 0) {
    $armApk = $armApks | Where-Object { $_.Name -match "arm64-v8a" } | Select-Object -First 1
    if (!$armApk) { $armApk = $armApks | Select-Object -First 1 }
    Write-Output "1. Install on physical device: adb install -r ""$($armApk.FullName)"""
} elseif ($universalApk.Count -gt 0) {
    Write-Output "1. Install universal APK on any device: adb install -r ""$($universalApk[0].FullName)"""
} else {
    Write-Output "1. Install on emulator: adb install -r ""$($x86Apks[0].FullName)"""
}

Write-Output "2. Verify the app launches without crashing"
if (-not $SkipAAB) {
    Write-Output "3. For optimal size distribution, use the AAB file to upload to Google Play Store"
    Write-Output "   This will automatically deliver only the required parts of the app to each device"
}
Write-Output "4. Check APK_SIZE_REPORT.txt for size comparison details" 

if (-not $SkipAAB) {
    Write-Host "3. For optimal size distribution, use the AAB file to upload to Google Play Store" -ForegroundColor Yellow
    Write-Host "   This will automatically deliver only the required parts of the app to each device" -ForegroundColor Yellow 
}
Write-Host "2. Verify the app launches without crashing" -ForegroundColor Yellow
Write-Host "Note: ProGuard/R8 has been disabled in build.gradle to prevent crash issues." -ForegroundColor Yellow