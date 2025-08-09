import axios from 'axios';
import { createLocalProxy, cacheVideoSegment, cleanupCache } from './nativeProxy';
import { fetchWithHeaders, processM3u8Playlist, getBaseUrl } from './streamUtils';

/**
 * CORS Proxy for GogoAnime and Hianime m3u8 streams
 * Based on the implementation from https://github.com/JulzOhern/Gogoanime-and-Hianime-proxy
 * 
 * This implementation works directly within the React Native app instead
 * of relying on an external proxy server.
 */

// Headers needed for streaming videos properly
const REQUIRED_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/vnd.apple.mpegurl',
  'Cache-Control': 'no-cache, no-store, must-revalidate',
}

// Headers for different content types
const CONTENT_TYPE_HEADERS = {
  'm3u8': 'application/vnd.apple.mpegurl',
  'ts': 'video/mp2t',
  'm4s': 'video/mp4',
  'mp4': 'video/mp4',
}

// Re-export all the utility functions
export {
  // Native proxy functions
  createLocalProxy,
  cacheVideoSegment,
  cleanupCache,
  
  // Stream utility functions
  fetchWithHeaders,
  processM3u8Playlist,
  getBaseUrl
};

/**
 * Create a proxy for a GogoAnime HLS stream
 * 
 * @param url The URL of the m3u8 stream
 * @returns A local file URI and headers that can be used with the Video component
 */
export async function proxyGogoAnimeStream(url: string): Promise<{ uri: string; headers: Record<string, string> }> {
  return createLocalProxy(url, 'gogoanime');
}

/**
 * Create a proxy for a HiAnime (Zoro) HLS stream
 * 
 * @param url The URL of the m3u8 stream
 * @returns A local file URI and headers that can be used with the Video component
 */
export async function proxyHiAnimeStream(url: string): Promise<{ uri: string; headers: Record<string, string> }> {
  return createLocalProxy(url, 'zoro');
}

/**
 * Universal proxy function that detects the provider from the URL or provider parameter
 * 
 * @param url The URL of the m3u8 stream
 * @param provider Optional provider override
 * @returns A local file URI and headers that can be used with the Video component
 */
export async function proxyAnimeStream(
  url: string, 
  provider?: 'gogoanime' | 'zoro'
): Promise<{ uri: string; headers: Record<string, string> }> {
  // Detect provider from URL if not specified
  if (!provider) {
    if (url.includes('netmagcdn.com') || 
        url.includes('megacloud') || 
        url.includes('vidstreamingcdn')) {
      provider = 'zoro';
    } else {
      provider = 'gogoanime';
    }
  }
  
  return createLocalProxy(url, provider);
} 