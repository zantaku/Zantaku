import * as FileSystem from 'expo-file-system';
import { fetchWithHeaders, processM3u8Playlist, getBaseUrl, getDirectVariantUrls } from './streamUtils';

/**
 * Native proxy for handling m3u8 streams in React Native
 * This approach downloads the m3u8 playlist, modifies it, and saves to a local file
 * that can be used by the Video component with the right headers applied
 */

// The directory to store cached HLS streams
const CACHE_DIR = FileSystem.cacheDirectory ? 
  FileSystem.cacheDirectory + 'hls-cache/' : 
  null;

// Ensure the cache directory exists
async function ensureCacheDirectory() {
  if (!CACHE_DIR) {
    throw new Error('Cache directory is not available');
  }
  
  try {
    // Check if the directory exists and create it if it doesn't
    const dirInfo = await FileSystem.getInfoAsync(CACHE_DIR);
    if (!dirInfo.exists) {
      console.log('[HLS Cache] Creating cache directory');
      await FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true });
    }
    
    return CACHE_DIR;
  } catch (error) {
    console.error('[HLS Cache] Error creating cache directory:', error);
    throw error;
  }
}

/**
 * Generate a unique filename for a given URL
 * 
 * @param url The URL of the stream
 * @param provider The provider (zoro or gogoanime)
 * @returns A unique filename
 */
function getLocalFilePath(url: string, provider: 'zoro' | 'gogoanime'): string {
  if (!CACHE_DIR) {
    throw new Error('Cache directory is not available');
  }
  
  // Create a unique filename based on the URL
  const hash = url
    .split('')
    .reduce((hash, char) => (hash << 5) - hash + char.charCodeAt(0), 0)
    .toString(16)
    .replace(/^-/, '');
  
  return `${CACHE_DIR}${provider}_${hash}.m3u8`;
}

/**
 * Cache a video segment in the local filesystem
 * 
 * @param url The URL of the segment
 * @param provider The provider (zoro or gogoanime)
 * @returns The local path to the cached segment
 */
export async function cacheVideoSegment(
  url: string, 
  provider: 'zoro' | 'gogoanime'
): Promise<string> {
  await ensureCacheDirectory();
  
  // Create a unique filename for this segment
  const segmentHash = url
    .split('')
    .reduce((hash, char) => (hash << 5) - hash + char.charCodeAt(0), 0)
    .toString(16)
    .replace(/^-/, '');
  
  const localPath = CACHE_DIR + `${provider}_segment_${segmentHash}.ts`;
  
  try {
    // Check if we already have this segment cached
    const fileInfo = await FileSystem.getInfoAsync(localPath);
    if (fileInfo.exists) {
      // Skip logging to reduce console spam
      return localPath;
    }
    
    // Download the segment with the right headers
    // Only log the first few segments to reduce console spam
    const isImportantSegment = segmentHash.endsWith('0') || segmentHash.endsWith('5');
    if (isImportantSegment) {
      console.log(`[HLS Cache] Downloading segment: ${url.substring(0, 50)}...`);
    }
    
    // Add a shorter timeout for better error detection
    await FileSystem.downloadAsync(url, localPath, {
      headers: provider === 'zoro' ? 
        {
          'Referer': 'https://hianime.to/',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/98.0.4758.102 Safari/537.36',
          'Origin': 'https://hianime.to',
        } : 
        {
          'Referer': 'https://gogoanime.tel/',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/98.0.4758.102 Safari/537.36',
        }
    });
    
    // Verify the segment was downloaded properly
    const segmentInfo = await FileSystem.getInfoAsync(localPath);
    if (!segmentInfo.exists || segmentInfo.size === 0) {
      throw new Error('Segment download failed or resulted in empty file');
    }
    
    return localPath;
  } catch (error) {
    console.error(`[HLS Cache] Error caching segment: ${error}`);
    
    // If caching fails, return the original URL
    return url;
  }
}

// Track concurrency
let activeDownloads = 0;
const MAX_CONCURRENT_DOWNLOADS = 3;
const downloadQueue: Array<() => Promise<void>> = [];
let isProcessingQueue = false;

// Add download progress tracking
export type DownloadProgress = {
  total: number;
  completed: number;
  inProgress: number;
  percentage: number;
};

let downloadProgress: DownloadProgress = {
  total: 0,
  completed: 0,
  inProgress: 0,
  percentage: 0
};

// Progress tracking listeners
type ProgressListener = (progress: DownloadProgress) => void;
const progressListeners: ProgressListener[] = [];

/**
 * Subscribe to download progress updates
 * @param listener Function to call with progress updates
 * @returns Function to unsubscribe
 */
export function subscribeToDownloadProgress(listener: ProgressListener): () => void {
  progressListeners.push(listener);
  
  // Immediately send current progress
  listener({ ...downloadProgress });
  
  // Return unsubscribe function
  return () => {
    const index = progressListeners.indexOf(listener);
    if (index > -1) {
      progressListeners.splice(index, 1);
    }
  };
}

/**
 * Update download progress and notify listeners
 */
function updateDownloadProgress(): void {
  // Calculate percentage
  downloadProgress.percentage = downloadProgress.total > 0 
    ? Math.round((downloadProgress.completed / downloadProgress.total) * 100)
    : 0;
  
  // Update inProgress count
  downloadProgress.inProgress = activeDownloads;
  
  // Notify all listeners with a new object (to ensure reference changes)
  const progress = { ...downloadProgress };
  progressListeners.forEach(listener => {
    try {
      listener(progress);
    } catch (e) {
      console.error("Error in progress listener:", e);
    }
  });
}

// Add a prefetching mechanism
export async function prefetchSegments(baseUrl: string, segmentNames: string[], provider: 'zoro' | 'gogoanime'): Promise<void> {
  // Queue up segment downloads (first 10 segments)
  const segmentsToFetch = segmentNames.slice(0, 10);
  
  console.log(`[HLS Cache] Prefetching ${segmentsToFetch.length} segments`);
  
  // Reset progress tracking for a new download session
  downloadProgress.total = segmentsToFetch.length;
  downloadProgress.completed = 0;
  downloadProgress.inProgress = 0;
  downloadProgress.percentage = 0;
  updateDownloadProgress();
  
  // Clear existing queue to prioritize the new segments
  downloadQueue.length = 0;
  
  // First chunk - high priority segments for immediate playback
  const firstChunk = segmentsToFetch.slice(0, 5);
  // Rest - lower priority segments for later playback
  const restChunk = segmentsToFetch.slice(5);
  
  // Add high priority segments to the front of the queue
  for (const segment of firstChunk) {
    const segmentUrl = segment.startsWith('http') ? segment : `${baseUrl}${segment}`;
    
    downloadQueue.unshift(async () => {
      try {
        activeDownloads++;
        updateDownloadProgress();
        await cacheVideoSegment(segmentUrl, provider);
        downloadProgress.completed++;
        updateDownloadProgress();
      } catch (err) {
        console.log(`[HLS Cache] Error prefetching segment: ${err}`);
        // Still increment completed to keep the progress moving
        downloadProgress.completed++;
        updateDownloadProgress();
      } finally {
        activeDownloads--;
        updateDownloadProgress();
        processQueue();
      }
    });
  }
  
  // Add the rest to the back of the queue
  for (const segment of restChunk) {
    const segmentUrl = segment.startsWith('http') ? segment : `${baseUrl}${segment}`;
    
    downloadQueue.push(async () => {
      try {
        activeDownloads++;
        updateDownloadProgress();
        await cacheVideoSegment(segmentUrl, provider);
        downloadProgress.completed++;
        updateDownloadProgress();
      } catch (err) {
        // Silent error for prefetch
        downloadProgress.completed++;
        updateDownloadProgress();
      } finally {
        activeDownloads--;
        updateDownloadProgress();
        processQueue();
      }
    });
  }
  
  // Start processing the queue immediately
  if (!isProcessingQueue) {
    isProcessingQueue = true;
    processQueue();
  }
}

async function processQueue() {
  if (downloadQueue.length === 0 || activeDownloads >= MAX_CONCURRENT_DOWNLOADS) {
    isProcessingQueue = downloadQueue.length > 0;
    return;
  }
  
  const promises = [];
  
  // Process multiple queue items at once up to the concurrency limit
  while (downloadQueue.length > 0 && activeDownloads < MAX_CONCURRENT_DOWNLOADS) {
    const nextDownload = downloadQueue.shift();
    if (nextDownload) {
      promises.push(nextDownload());
    }
  }
  
  // Wait for this batch to complete
  if (promises.length > 0) {
    try {
      await Promise.all(promises);
    } catch (error) {
      console.error('[HLS Cache] Error in download batch:', error);
    }
    
    // Continue processing the queue
    setTimeout(processQueue, 0);
  } else {
    isProcessingQueue = false;
  }
}

/**
 * Create a local proxy for an HLS stream
 * 
 * @param url The URL of the m3u8 playlist
 * @param provider The provider (zoro or gogoanime)
 * @returns The local file URI and headers to use with the Video component
 */
export async function createLocalProxy(
  url: string, 
  provider: 'zoro' | 'gogoanime'
): Promise<{ uri: string; headers: Record<string, string> }> {
  if (!url.includes('.m3u8')) {
    // For non-HLS streams, just return the original URL with headers
    console.log('[HLS Cache] Not an HLS stream, skipping proxy');
    return { 
      uri: url,
      headers: provider === 'zoro' ?
        {
          'Referer': 'https://hianime.to/',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/98.0.4758.102 Safari/537.36',
          'Origin': 'https://hianime.to',
        } :
        {
          'Referer': 'https://gogoanime.tel/',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/98.0.4758.102 Safari/537.36',
        }
    };
  }
  
  try {
    // Expo Go often has limitations with direct network requests to some streaming servers
    // So we'll try different approaches in sequence
    
    // First approach: Try to use our native caching system
    try {
      console.log('[HLS Cache] Trying direct fetch and native caching...');
      
      await ensureCacheDirectory();
      
      // Get the local file path for the m3u8 playlist
      const localPath = getLocalFilePath(url, provider);
      
      // Check if we already have this file cached and it's readable
      const cachedFile = await tryUsingCachedPlaylist(localPath);
      if (cachedFile) {
        return cachedFile;
      }
      
      // Fetch and process the m3u8 content
      const processedPlaylist = await fetchAndProcessPlaylist(url, localPath, provider);
      if (processedPlaylist) {
        return processedPlaylist;
      }
    } catch (error) {
      console.log('[HLS Cache] Native caching approach failed:', error);
      // Continue to next approach
    }
    
    // Alternative approach: For master playlists, try to fetch a direct variant URL
    // This can work better in Expo Go which has limitations with m3u8 processing
    try {
      console.log('[HLS Cache] Trying direct variant URL approach...');
      const masterContent = await fetchWithHeaders(url, provider);
      
      if (masterContent.includes('#EXT-X-STREAM-INF')) {
        console.log('[HLS Cache] This is a master playlist, fetching direct variant URLs');
        const baseUrl = getBaseUrl(url);
        const variantUrls = getDirectVariantUrls(masterContent, baseUrl);
        
        if (variantUrls.length > 0) {
          // Find a middle-quality variant (better for mobile)
          const selectedIndex = Math.min(Math.floor(variantUrls.length / 2), variantUrls.length - 1);
          const directVariantUrl = variantUrls[selectedIndex];
          
          console.log(`[HLS Cache] Using direct variant URL: ${directVariantUrl.substring(0, 60)}...`);
          
          // Try to fetch this variant playlist directly
          return { 
            uri: directVariantUrl,
            headers: provider === 'zoro' ?
              {
                'Referer': 'https://hianime.to/',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/98.0.4758.102 Safari/537.36',
                'Origin': 'https://hianime.to',
              } :
              {
                'Referer': 'https://gogoanime.tel/',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/98.0.4758.102 Safari/537.36',
              }
          };
        }
      }
    } catch (error) {
      console.log('[HLS Cache] Direct variant URL approach failed:', error);
      // Continue to next approach
    }
    
    // Second approach: Try using public CORS proxies for Expo Go compatibility
    try {
      console.log('[HLS Cache] Trying public CORS proxy approach...');
      const publicProxies = [
        'https://cors-proxy.elfsight.com/',  // Very reliable public proxy
        'https://corsproxy.io/?',            // Another popular option
        'https://proxy.cors.sh/',            // Backup option
      ];
      
      // Try each proxy in sequence
      for (const proxy of publicProxies) {
        try {
          const proxiedUrl = proxy + encodeURIComponent(url);
          console.log(`[HLS Cache] Trying proxy: ${proxiedUrl.substring(0, 60)}...`);
          
          // Try to fetch using the proxy
          const response = await fetch(proxiedUrl, {
            method: 'GET',
            headers: provider === 'zoro' ? 
              {
                'Referer': 'https://hianime.to/',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/98.0.4758.102 Safari/537.36',
                'Origin': 'https://hianime.to',
              } : 
              {
                'Referer': 'https://gogoanime.tel/',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/98.0.4758.102 Safari/537.36',
              }
          });
          
          if (response.ok) {
            console.log(`[HLS Cache] Proxy ${proxy} worked! Using proxied URL`);
            // Success - use this proxied URL directly
            return {
              uri: proxiedUrl,
              headers: {} // Headers are already in the proxied URL
            };
          }
        } catch (proxyError) {
          console.log(`[HLS Cache] Proxy ${proxy} failed:`, proxyError);
          // Try next proxy
          continue;
        }
      }
      
      throw new Error('All proxy attempts failed');
    } catch (error) {
      console.log('[HLS Cache] Public proxy approach failed:', error);
      // Continue to final fallback
    }
    
    // Final fallback: Just return the direct URL with headers
    // This will work in prebuilt APKs even if Expo Go has limitations
    console.log('[HLS Cache] Using direct URL as final fallback');
    return { 
      uri: url,
      headers: provider === 'zoro' ?
        {
          'Referer': 'https://hianime.to/',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/98.0.4758.102 Safari/537.36',
          'Origin': 'https://hianime.to',
        } :
        {
          'Referer': 'https://gogoanime.tel/',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/98.0.4758.102 Safari/537.36',
        }
    };
  } catch (error) {
    console.error(`[HLS Cache] Error creating proxy: ${error}`);
    
    // If all approaches fail, return the original URL with headers
    return { 
      uri: url,
      headers: provider === 'zoro' ?
        {
          'Referer': 'https://hianime.to/',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/98.0.4758.102 Safari/537.36',
          'Origin': 'https://hianime.to',
        } :
        {
          'Referer': 'https://gogoanime.tel/',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/98.0.4758.102 Safari/537.36',
        }
    };
  }
}

// Helper function to check and use cached playlist if available
async function tryUsingCachedPlaylist(localPath: string): Promise<{ uri: string; headers: Record<string, string> } | null> {
  try {
    const fileInfo = await FileSystem.getInfoAsync(localPath);
    if (fileInfo.exists && fileInfo.size > 0) {
      // Verify the file is actually valid by reading a small portion
      try {
        const content = await FileSystem.readAsStringAsync(localPath, { encoding: FileSystem.EncodingType.UTF8, position: 0, length: 50 });
        if (content && content.includes('#EXTM3U')) {
          console.log(`[HLS Cache] Using cached m3u8 playlist: ${localPath}`);
          return {
            uri: localPath,
            headers: {} // No headers needed for local files
          };
        } else {
          console.log(`[HLS Cache] Cached m3u8 is invalid, refreshing`);
        }
      } catch (readError) {
        console.log(`[HLS Cache] Error reading cached file: ${readError}`);
      }
    }
  } catch (error) {
    console.log(`[HLS Cache] Error checking cached file: ${error}`);
  }
  return null;
}

// Helper function to fetch and process a playlist
async function fetchAndProcessPlaylist(
  url: string, 
  localPath: string, 
  provider: 'zoro' | 'gogoanime'
): Promise<{ uri: string; headers: Record<string, string> } | null> {
  try {
    // First, fetch the main m3u8 content
    const m3u8Content = await fetchWithHeaders(url, provider);
    
    // Process the playlist - this will handle master playlists by selecting
    // a variant and fetching its content, or process a regular segment playlist
    console.log(`[HLS Cache] Processing m3u8 content (length: ${m3u8Content.length})`);
    const baseUrl = getBaseUrl(url);
    
    // Process the playlist - this will now handle master playlists properly
    const processedContent = await processM3u8Playlist(m3u8Content, baseUrl, provider);
    
    // Now extract segments for prefetching
    const { processedContent: finalContent, segmentNames } = extractSegmentInfo(processedContent, baseUrl);
    
    // Write the processed playlist to the local file
    console.log(`[HLS Cache] Writing processed m3u8 playlist to: ${localPath} (segments: ${segmentNames.length})`);
    await FileSystem.writeAsStringAsync(localPath, finalContent);
    
    // Start prefetching segments in the background - only if we have segment names
    if (segmentNames.length > 0) {
      console.log(`[HLS Cache] Starting segment prefetch for ${segmentNames.length} segments`);
      prefetchSegments(baseUrl, segmentNames, provider);
    } else {
      console.log(`[HLS Cache] No segments found to prefetch`);
    }
    
    // Verify the file was written successfully
    const fileInfo = await FileSystem.getInfoAsync(localPath);
    if (!fileInfo.exists || fileInfo.size === 0) {
      throw new Error(`Failed to write m3u8 playlist to ${localPath}`);
    }
    
    console.log(`[HLS Cache] M3u8 playlist cached successfully: ${localPath} (size: ${fileInfo.size})`);
    
    // Return the local file URI
    return {
      uri: localPath,
      headers: {} // No headers needed for local files
    };
  } catch (error) {
    console.error(`[HLS Cache] Error in playlist processing pipeline: ${error}`);
    return null;
  }
}

// Helper function to extract segment names from m3u8 content
function extractSegmentInfo(m3u8Content: string, baseUrl: string): { processedContent: string, segmentNames: string[] } {
  const lines = m3u8Content.split('\n');
  const segmentNames: string[] = [];
  
  // Process each line to extract segments and make URLs absolute
  const processedLines = lines.map(line => {
    // Skip comments and directives
    if (line.startsWith('#') || line.trim().length === 0) {
      return line;
    }
    
    // Add to segments list and convert to absolute URL if needed
    segmentNames.push(line.startsWith('http') ? line : `${baseUrl}${line}`);
    
    // Always return absolute URLs
    return line.startsWith('http') ? line : `${baseUrl}${line}`;
  });
  
  return { 
    processedContent: processedLines.join('\n'),
    segmentNames
  };
}

/**
 * Clean up the cache directory
 */
export async function cleanupCache(): Promise<void> {
  if (!CACHE_DIR) {
    console.log('[HLS Cache] No cache directory to clean');
    return;
  }
  
  try {
    // Get all files in the cache directory
    const dirInfo = await FileSystem.getInfoAsync(CACHE_DIR);
    if (!dirInfo.exists) {
      console.log('[HLS Cache] Cache directory does not exist');
      return;
    }
    
    console.log('[HLS Cache] Cleaning up cache directory');
    await FileSystem.deleteAsync(CACHE_DIR, { idempotent: true });
    await FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true });
    
    console.log('[HLS Cache] Cache cleanup complete');
  } catch (error) {
    console.error(`[HLS Cache] Error cleaning cache: ${error}`);
  }
} 