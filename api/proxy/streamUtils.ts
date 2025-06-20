import axios from 'axios';

/**
 * Utility functions for handling HLS streams
 */

/**
 * Retrieves the base URL from a URL string (everything up to the last /)
 * 
 * @param url The full URL
 * @returns The base URL part (without the filename)
 */
export function getBaseUrl(url: string): string {
  return url.substring(0, url.lastIndexOf('/') + 1);
}

/**
 * Headers for GogoAnime requests
 */
export const GOGOANIME_HEADERS = {
  'Referer': 'https://gogoanime.tel/',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/98.0.4758.102 Safari/537.36',
  'Accept': '*/*',
};

/**
 * Headers for HiAnime/Zoro requests
 */
export const HIANIME_HEADERS = {
  'Referer': 'https://hianime.to/',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/98.0.4758.102 Safari/537.36',
  'Accept': '*/*',
  'Origin': 'https://hianime.to',
};

/**
 * Makes an HTTP request with the appropriate headers for the given provider
 * 
 * @param url The URL to fetch
 * @param provider The provider (zoro or gogoanime)
 * @returns The response data
 */
export async function fetchWithHeaders(url: string, provider: 'zoro' | 'gogoanime'): Promise<string> {
  try {
    const headers = provider === 'zoro' ? HIANIME_HEADERS : GOGOANIME_HEADERS;
    
    console.log(`[Proxy] Fetching ${url} with ${provider} headers`);
    const response = await axios.get(url, {
      headers,
      responseType: 'text',
      timeout: 10000, // 10 second timeout
    });
    
    return response.data;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[Proxy] Error fetching ${url}: ${errorMessage}`);
    throw new Error(`Failed to fetch URL: ${errorMessage}`);
  }
}

/**
 * Processes an m3u8 playlist, converting relative URLs to absolute
 * and selecting an appropriate quality level
 * 
 * @param content The m3u8 playlist content
 * @param baseUrl The base URL to resolve relative URLs against
 * @returns The processed m3u8 content
 */
export async function processM3u8Playlist(content: string, baseUrl: string, provider: 'zoro' | 'gogoanime'): Promise<string> {
  // Check if this is a master playlist with different quality options
  if (content.includes('#EXT-X-STREAM-INF')) {
    console.log('[M3u8 Processor] Master playlist detected, selecting quality');
    const selectedUrl = selectAppropriateQuality(content, baseUrl);
    
    try {
      // Fetch the selected variant playlist
      console.log(`[M3u8 Processor] Fetching selected variant playlist: ${selectedUrl}`);
      const variantContent = await fetchWithHeaders(selectedUrl, provider);
      
      // Process the variant playlist which contains the actual segments
      return processSegmentPlaylist(variantContent, getBaseUrl(selectedUrl));
    } catch (error) {
      console.error(`[M3u8 Processor] Error fetching variant playlist: ${error}`);
      // Return the original content as fallback
      return content;
    }
  }
  
  // Regular segment playlist
  return processSegmentPlaylist(content, baseUrl);
}

/**
 * Processes a segment playlist (not a master playlist)
 */
function processSegmentPlaylist(content: string, baseUrl: string): string {
  // Process each line in the m3u8 content
  return content
    .split('\n')
    .map((line: string) => {
      // Skip comments and directives
      if (line.startsWith('#') || line.trim().length === 0) {
        return line;
      }
      
      // If it's a relative URL, convert to absolute
      return line.startsWith('http') ? line : `${baseUrl}${line}`;
    })
    .join('\n');
}

/**
 * Selects an appropriate quality stream from a master playlist
 */
function selectAppropriateQuality(content: string, baseUrl: string): string {
  const lines = content.split('\n');
  const streams: Array<{bandwidth: number, resolution?: string, url: string}> = [];
  let currentBandwidth: number | null = null;
  let currentResolution: string | null = null;
  
  // Parse the playlist to extract available streams
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Parse stream info
    if (line.startsWith('#EXT-X-STREAM-INF')) {
      currentBandwidth = null;
      currentResolution = null;
      
      // Extract bandwidth
      const bandwidthMatch = line.match(/BANDWIDTH=(\d+)/);
      if (bandwidthMatch) {
        currentBandwidth = parseInt(bandwidthMatch[1], 10);
      }
      
      // Extract resolution if available
      const resolutionMatch = line.match(/RESOLUTION=(\d+x\d+)/);
      if (resolutionMatch) {
        currentResolution = resolutionMatch[1];
      }
    } 
    // If this line is a URL and we have bandwidth info
    else if (!line.startsWith('#') && line.trim().length > 0 && currentBandwidth !== null) {
      const url = line.startsWith('http') ? line : `${baseUrl}${line}`;
      streams.push({
        bandwidth: currentBandwidth,
        resolution: currentResolution || undefined,
        url
      });
      
      currentBandwidth = null;
      currentResolution = null;
    }
  }
  
  // Print available quality options for debugging
  console.log('[Quality Selector] Available streams:');
  streams.forEach(stream => {
    console.log(`- ${stream.resolution || 'unknown'} (${stream.bandwidth} bps)`);
  });
  
  // Sort streams by bandwidth
  streams.sort((a, b) => a.bandwidth - b.bandwidth);
  
  // Select an appropriate stream based on device capabilities and preferences
  
  let selectedStream;
  
  // If we have no streams, return original content
  if (streams.length === 0) {
    console.log('[Quality Selector] No valid streams found, returning original content');
    return content;
  }
  
  // If we have only one stream option, use it
  if (streams.length === 1) {
    selectedStream = streams[0];
    console.log(`[Quality Selector] Only one quality available: ${selectedStream.resolution || 'unknown'} (${selectedStream.bandwidth} bps)`);
    return selectedStream.url;
  }
  
  // Try to detect mobile network limitations
  // We'll look for reasonable resolution options for mobile devices
  // For most mobile devices, 720p is a good balance between quality and performance
  
  // Find streams with resolution info
  const streamsWithResolution = streams.filter(s => s.resolution);
  
  // Try to find a stream close to the highest available quality
  if (streamsWithResolution.length > 0) {
    // Extract height from resolution strings (e.g., "1280x720" -> 720)
    const streamsWithHeight = streamsWithResolution.map(s => {
      const height = s.resolution?.split('x')[1] ? parseInt(s.resolution.split('x')[1], 10) : 0;
      return { ...s, height };
    });
    
    // Sort by height in descending order (highest quality first)
    streamsWithHeight.sort((a, b) => b.height - a.height);
    
    // Prefer the highest quality available (1080p, 4K, etc.)
    const highestQuality = streamsWithHeight[0];
    
    // If we have 1080p or higher, use it
    if (highestQuality.height >= 1080) {
      console.log(`[Quality Selector] Selected highest quality: ${highestQuality.resolution} (${highestQuality.bandwidth} bps)`);
      return highestQuality.url;
    }
    
    // If no 1080p+, try to find 720p
    const optimalResolution = streamsWithHeight.find(s => s.height === 720) || highestQuality;
    
    console.log(`[Quality Selector] Selected optimal resolution: ${optimalResolution.resolution} (${optimalResolution.bandwidth} bps)`);
    return optimalResolution.url;
  }
  
  // If we can't choose based on resolution, pick the highest quality option
  // Sort by bandwidth in descending order and pick the highest
  streams.sort((a, b) => b.bandwidth - a.bandwidth);
  selectedStream = streams[0]; // Pick the highest bandwidth (best quality)
  
  console.log(`[Quality Selector] Selected highest bandwidth option: ${selectedStream.resolution || 'unknown'} (${selectedStream.bandwidth} bps)`);
  
  return selectedStream.url;
}

/**
 * Handles errors in the proxy process
 * 
 * @param error The error that occurred
 * @param context Additional context about where the error occurred
 * @returns A formatted error message
 */
export function handleProxyError(error: unknown, context: string): string {
  const errorMessage = error instanceof Error ? error.message : 'Unknown error';
  console.error(`[Proxy Error] ${context}: ${errorMessage}`);
  
  if (error instanceof Error && error.stack) {
    console.error(`[Proxy Error] Stack: ${error.stack}`);
  }
  
  return `Error in ${context}: ${errorMessage}`;
}

/**
 * Save an HLS stream to a temporary file and return the file path
 * This is useful for platforms that can't directly handle remote m3u8 streams
 */
export async function saveHlsStreamToTemp(
  url: string, 
  provider: 'zoro' | 'gogoanime'
): Promise<string> {
  try {
    const data = await fetchWithHeaders(url, provider);
    
    if (url.includes('.m3u8')) {
      const baseUrl = getBaseUrl(url);
      const processedContent = await processM3u8Playlist(data, baseUrl, provider);
      
      // Here you would normally save this to a temporary file
      // Since React Native doesn't have direct file system access, we'll 
      // return the processed content directly (this would need to be adapted 
      // based on how your app handles data)
      return processedContent;
    }
    
    // For non-m3u8 files, return the raw content
    return data;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to save HLS stream: ${errorMessage}`);
  }
}

// Add a function that gets direct variant URLs from a master playlist
export function getDirectVariantUrls(content: string, baseUrl: string): string[] {
  if (!content.includes('#EXT-X-STREAM-INF')) {
    return []; // Not a master playlist
  }
  
  const lines = content.split('\n');
  const directUrls: string[] = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // If this line contains stream info and the next line is a URL
    if (line.startsWith('#EXT-X-STREAM-INF')) {
      const nextLine = lines[i + 1];
      if (nextLine && !nextLine.startsWith('#') && nextLine.trim().length > 0) {
        // It's a variant playlist URL
        const url = nextLine.startsWith('http') ? nextLine : `${baseUrl}${nextLine}`;
        directUrls.push(url);
        i++; // Skip the URL line since we've processed it
      }
    }
  }
  
  return directUrls;
} 