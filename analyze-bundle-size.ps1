 # Bundle Size Analysis Script
Write-Host "Analyzing bundle size and dependencies..." -ForegroundColor Green

# Check for large dependencies
Write-Host "`nLarge dependencies that could be optimized:" -ForegroundColor Yellow
Write-Host "- ffmpeg-kit-react-native: Very large video processing library"
Write-Host "- react-native-vlc-media-player: Large video player (consider removing if using react-native-video)"
Write-Host "- webtorrent: Large torrent client library"
Write-Host "- @shopify/react-native-skia: Large graphics library"
Write-Host "- Multiple font packages: @fontsource/* packages"

# Suggestions for optimization
Write-Host "`nOptimization suggestions:" -ForegroundColor Cyan
Write-Host "1. Remove duplicate video players (keep only react-native-video)"
Write-Host "2. Consider removing webtorrent if not essential"
Write-Host "3. Remove unused @fontsource packages"
Write-Host "4. Use dynamic imports for large libraries"
Write-Host "5. Consider alternatives to ffmpeg-kit if only basic video features needed"

# Build with ultra optimization
Write-Host "`nBuilding with ultra optimization..." -ForegroundColor Green
eas build --platform android --profile ultra-optimized --clear-cache