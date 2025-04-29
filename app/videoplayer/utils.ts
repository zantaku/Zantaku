import { Platform, ToastAndroid } from 'react-native';

/**
 * Enhanced HLS/M3U8 stream detection function
 * 
 * @param url The URL to check
 * @returns true if the URL appears to be an HLS stream
 */
export const isM3U8Stream = (url: string): boolean => {
  // Basic validation
  if (!url) return false;
  
  // Normalize the URL to lowercase for consistent checking
  const lowerUrl = url.toLowerCase();
  
  // Check for the .m3u8 extension or typical HLS patterns
  return (
    // File extension check
    lowerUrl.includes('.m3u8') ||
    
    // Common HLS patterns in URLs
    lowerUrl.includes('playlist.m3u8') ||
    lowerUrl.includes('/hls/') ||
    lowerUrl.includes('/live/') ||
    lowerUrl.includes('streaming.php') ||
    
    // Common HLS domains
    lowerUrl.includes('streamserver') ||
    lowerUrl.includes('cdn.stream') ||
    
    // URL parameters that often indicate HLS
    lowerUrl.includes('playlist_type=') ||
    lowerUrl.includes('manifest_type=') ||
    
    // Content-type patterns in the URL 
    lowerUrl.includes('application/vnd.apple.mpegurl') ||
    lowerUrl.includes('application/x-mpegurl')
  );
};

// Format time in seconds to display format (mm:ss or hh:mm:ss)
export const formatTime = (seconds: number): string => {
  if (isNaN(seconds) || seconds === Infinity) return '00:00';
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  
  if (hours > 0) {
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  }
  
  return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
};

// Parse time string (HH:MM:SS.MS) to seconds
export const parseTimeToSeconds = (timeStr: string): number => {
  const parts = timeStr.split(':');
  
  // Handle hours:minutes:seconds format
  if (parts.length === 3) {
    const hours = parseInt(parts[0], 10);
    const minutes = parseInt(parts[1], 10);
    const seconds = parseFloat(parts[2]);
    return hours * 3600 + minutes * 60 + seconds;
  }
  
  // Handle minutes:seconds format
  if (parts.length === 2) {
    const minutes = parseInt(parts[0], 10);
    const seconds = parseFloat(parts[1]);
    return minutes * 60 + seconds;
  }
  
  // Handle seconds.milliseconds format
  return parseFloat(timeStr);
};

// Show message helper (uses Toast on Android, console.log elsewhere)
export const showMessage = (message: string): void => {
  console.log(message);
  if (Platform.OS === 'android') {
    ToastAndroid.show(message, ToastAndroid.SHORT);
  } else if (__DEV__) {
    // In development, we'll log it more prominently
    console.log('🔶 DEBUG:', message);
  }
};

/**
 * Get the appropriate Android implementation based on stream type
 * MediaPlayer handles M3U8 streams better on some devices
 * 
 * @param url The stream URL to check
 * @returns The implementation type to use
 */
export const getAndroidImplementation = (url: string): "ExoPlayer" | "MediaPlayer" => {
  return isM3U8Stream(url) ? "MediaPlayer" : "ExoPlayer";
}; 