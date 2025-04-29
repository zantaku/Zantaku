# Set environment to production
$env:NODE_ENV = "production"

# Display build information
Write-Output "=== React Native Release Build ===" 
Write-Output "Starting release build with NODE_ENV=production at $(Get-Date)"
Write-Output "============================================"

# Create necessary dirs
Write-Output "Setting up build environment..."
$bundleDir = ".\android\app\src\main\assets"
if (!(Test-Path $bundleDir)) {
    New-Item -ItemType Directory -Path $bundleDir -Force
    Write-Output "Created assets directory: $bundleDir"
}

# Bundle the JS code
Write-Output "============================================"
Write-Output "Bundling React Native JS code for Android..."
try {
    npx react-native bundle --platform android --dev false --entry-file index.js --bundle-output $bundleDir/index.android.bundle --assets-dest $bundleDir
    
    if ($LASTEXITCODE -ne 0) {
        Write-Output "JS bundling failed with exit code $LASTEXITCODE"
        exit 1
    } else {
        Write-Output "JS code bundled successfully!"
    }
} catch {
    Write-Output "JS bundling failed with exception: $_"
    exit 1
}

# Step 1: Clean build with gradlew
Write-Output "============================================"
Write-Output "Step 1: Cleaning previous build artifacts..."
cd .\android
try {
    .\gradlew clean
    
    if ($LASTEXITCODE -ne 0) {
        Write-Output "Gradle clean failed with exit code $LASTEXITCODE"
        cd ..
        exit 1
    } else {
        Write-Output "Clean completed successfully."
    }
} catch {
    Write-Output "Gradle clean failed with exception: $_"
    cd ..
    exit 1
}

# Step 2: Ask if AAB or Split APK
Write-Output "============================================"
Write-Output "Step 2: Choose build type"
$buildChoice = Read-Host "Do you want to build Android App Bundle (AAB) for Play Store or split APKs? (Enter 'aab' or 'apk')"

# Step 3: Begin building package based on choice
Write-Output "============================================"
Write-Output "Step 3: Building package..."

if ($buildChoice.ToLower() -eq "aab") {
    # Build release AAB
    try {
        Write-Output "Building App Bundle (AAB) for Play Store..."
        .\gradlew bundleRelease
        
        if ($LASTEXITCODE -ne 0) {
            Write-Output "AAB build failed with exit code $LASTEXITCODE"
            cd ..
            exit 1
        } else {
            Write-Output "AAB built successfully!"
        }
    } catch {
        Write-Output "AAB build failed with exception: $_"
        cd ..
        exit 1
    }
    
    # Check for AAB in the release directory
    $packageDir = ".\app\build\outputs\bundle\release"
    $packageFiles = Get-ChildItem -Path $packageDir -Filter "*.aab" -File
    $packageType = "AAB"
} else {
    # Build release APK
    try {
        Write-Output "Building Split APKs..."
        .\gradlew assembleRelease
        
        if ($LASTEXITCODE -ne 0) {
            Write-Output "APK build failed with exit code $LASTEXITCODE"
            cd ..
            exit 1
        } else {
            Write-Output "APKs built successfully!"
        }
    } catch {
        Write-Output "APK build failed with exception: $_"
        cd ..
        exit 1
    }
    
    # Check for APK in the release directory
    $packageDir = ".\app\build\outputs\apk\release"
    $packageFiles = Get-ChildItem -Path $packageDir -Filter "*.apk" -File
    $packageType = "APK"
}

if ($packageFiles.Count -eq 0) {
    Write-Output "No $packageType files were generated in the expected directory: $packageDir"
    cd ..
    exit 1
}

# Step 4: Ask if they want to install on device
Write-Output "============================================"
Write-Output "Step 4: Package built successfully!"
Write-Output "$packageType files generated:"

foreach ($package in $packageFiles) {
    $size = [Math]::Round($package.Length / 1MB, 2)
    Write-Output "- $($package.Name): $size MB"
}

# Only offer installation for APKs, not AABs
if ($packageType -eq "APK") {
    Write-Output "============================================"
    $installChoice = Read-Host "Do you want to install the APK on a connected device? (Y/N)"

    # Step 5: Install on device if requested
    if ($installChoice.ToUpper() -eq "Y") {
        $mainApk = $packageFiles | Where-Object { $_.Name -like "*-release.apk" } | Select-Object -First 1
        if ($null -eq $mainApk) {
            $mainApk = $packageFiles | Select-Object -First 1
        }
        
        Write-Output "Installing $($mainApk.Name) on device..."
        try {
            adb install -r "$packageDir\$($mainApk.Name)"
            
            if ($LASTEXITCODE -ne 0) {
                Write-Output "Installation failed with exit code $LASTEXITCODE"
            } else {
                Write-Output "Installation completed successfully!"
            }
        } catch {
            Write-Output "Installation failed with exception: $_"
        }
    } else {
        # Step 6: Exit if not installing
        Write-Output "Skipping installation."
    }

    Write-Output "============================================"
    Write-Output "To install later, use:"
    Write-Host "adb install -r ""android\$packageDir\$($packageFiles[0].Name)""" -ForegroundColor Yellow
} else {
    # AAB handling
    Write-Output "============================================"
    Write-Output "To use this AAB:"
    Write-Output "1. Upload to Google Play Console for distribution"
    Write-Output "2. Use bundletool to convert to APKs for testing:"
    Write-Host "bundletool build-apks --bundle=""android\$packageDir\$($packageFiles[0].Name)"" --output=app.apks" -ForegroundColor Yellow
}

# Return to the project root directory
cd ..

Write-Output "============================================"
Write-Output "Build process completed at $(Get-Date)"


