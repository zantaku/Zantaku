@echo off
echo Starting Optimized APK Build Process...
powershell -ExecutionPolicy Bypass -File "%~dp0build-release.ps1"
echo.
echo If the build was successful, see APK_SIZE_REPORT.txt for size details
echo.
pause 