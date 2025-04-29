# Debug script for AniList authentication
Write-Host "AniList Authentication Debug Tool" -ForegroundColor Cyan

# First, let's try to extract the authentication token from expo-secure-store
Write-Host "`nChecking if the app is installed and running..." -ForegroundColor Yellow

# Run a command to check if the Expo development server is running
$expoStatus = adb shell "ps | grep expo"
if ($expoStatus -match "expo") {
    Write-Host "Expo process detected on device!" -ForegroundColor Green
} else {
    Write-Host "Warning: No Expo process detected. Make sure the app is running." -ForegroundColor Red
}

# Output log to see if we can find auth token or auth debug messages
Write-Host "`nChecking for authentication logs..." -ForegroundColor Yellow
$logs = adb logcat -d | Select-String -Pattern "Auth Debug|Token available|Is authenticated|isFavourite|mediaListEntry"

if ($logs) {
    Write-Host "Found auth-related logs:" -ForegroundColor Green
    $logs | ForEach-Object { Write-Host $_ -ForegroundColor White }
} else {
    Write-Host "No auth logs found. Try navigating to a manga detail page in the app." -ForegroundColor Red
}

Write-Host "`nRecommended Action:" -ForegroundColor Cyan
Write-Host "1. Make sure you are logged in to the app (not anonymous mode)" -ForegroundColor White  
Write-Host "2. Close and reopen the app" -ForegroundColor White
Write-Host "3. Navigate to the manga detail page again" -ForegroundColor White
Write-Host "4. Check for error messages in the logs" -ForegroundColor White
Write-Host "5. If no errors, check if the isAuth parameter is being properly passed as 'true'" -ForegroundColor White 