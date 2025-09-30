// services/zencloud.ts
import AsyncStorage from '@react-native-async-storage/async-storage';

// Environment variables - read from .env file
// Note: In React Native, you might need to use react-native-config or expo-constants
// For now, using the values directly from .env as fallbacks
const ENV = {
  ZEN_BASE: 'https://zencloud.cc',
  ZEN_CDN: 'https://zantaku.zencloud.cc', // CDN for better performance
  ZEN_API_CDN: 'https://cdn.zencloud.cc', // API CDN
  ZEN_API_KEY: 'yV2XTk5nW-8cddOr6GDSjP2UxZuWnSPte8ZjEhsrmkw',
  ZEN_IP_DEFAULT: '1.1.1.1',
  ZEN_TIMEOUT_MS: 10000,
};

export type ZenRawItem = {
  access_id: string;
  anilist_id: number;
  audio: "sub" | "dub" | "dual" | string;
  episode: number;
  player_url: string;
};

export type ZenRawResponse = {
  data: ZenRawItem[];
  status: "success" | string;
  pagination?: unknown;
};

export type ZenChapter = {
  id: string;
  title: string;
  description: string;
  start_time: number;
  end_time: number;
  video_id: string;
  created_at: string;
};

export type ZenSubtitle = {
  format: "ass" | "vtt" | string;
  is_default: boolean;
  language: string;
  language_name: string;
  title: string;
  url: string;
};

export type ZenFileData = {
  file_code: string;
  file_id: string;
  player_url: string;
  m3u8_url: string;
  download_url: string;
  original_filename: string;
  thumbnail_url: string;
  thumbnails_vtt_url?: string;
  has_subtitles: boolean;
  has_vtt_thumbnails: boolean;
  premium_status: number | null;
  premium_expires: string | null;
  token: string;
  token_expires: string;
  token_ip_bound: boolean;
  client_ip: string;
  fonts?: { name: string; url: string }[];
  subtitles?: ZenSubtitle[];
  chapters?: ZenChapter[];
  created_at?: string;
};

export type ZenFileResponse = {
  data: ZenFileData;
  status: "success" | string;
};

function withTimeout<T>(p: Promise<T>, ms: number, msg = "Request timed out"): Promise<T> {
  return new Promise((resolve, reject) => {
    const id = setTimeout(() => reject(new Error(msg)), ms);
    p.then((v) => { clearTimeout(id); resolve(v); })
     .catch((e) => { clearTimeout(id); reject(e); });
  });
}

async function requestJSON<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await withTimeout(fetch(url, { ...init }), ENV.ZEN_TIMEOUT_MS);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}: ${text || "Unknown error"}`);
  }
  return res.json() as Promise<T>;
}

export async function fetchRawByAnilistId(anilistId: number): Promise<ZenRawItem[]> {
  console.log(`[ZENCLOUD] 🔍 Fetching raw data for AniList ID: ${anilistId}`);
  
  // Try primary API first, then fallback to CDN for Android compatibility
  const baseUrls = [ENV.ZEN_BASE, ENV.ZEN_CDN, ENV.ZEN_API_CDN];
  let lastError: Error | null = null;
  
  for (const baseUrl of baseUrls) {
    try {
      const u = new URL("/videos/raw", baseUrl);
      u.searchParams.set("anilist_id", String(anilistId));
      
      console.log(`[ZENCLOUD] 📡 Trying URL: ${u.toString()}`);
      
      const data = await requestJSON<ZenRawResponse>(u.toString());
      
      console.log(`[ZENCLOUD] 📊 Raw response from ${baseUrl}:`, {
        status: data.status,
        dataCount: data.data?.length || 0,
        hasData: Array.isArray(data.data)
      });
      
      // Log full raw data for debugging
      console.log(`[ZENCLOUD] 📋 FULL RAW DATA:`, JSON.stringify(data, null, 2));
      
      if (data.status !== "success" || !Array.isArray(data.data)) {
        throw new Error("Zencloud raw: unexpected response");
      }
      
      // Normalize/sort by episode number
      const sorted = [...data.data].sort((a, b) => a.episode - b.episode);
      
      console.log(`[ZENCLOUD] ✅ Found ${sorted.length} episodes from ${baseUrl}:`, 
        sorted.map(item => ({
          episode: item.episode,
          audio: item.audio,
          access_id: item.access_id.substring(0, 8) + '...'
        }))
      );
      
      return sorted;
      
    } catch (error: any) {
      console.log(`[ZENCLOUD] ❌ Failed with ${baseUrl}: ${error.message}`);
      lastError = error;
      continue;
    }
  }
  
  throw lastError || new Error('All Zencloud endpoints failed');
}

export async function fetchFileDetailsByAccessId(accessId: string, ipOverride?: string): Promise<ZenFileData> {
  const ip = ipOverride || ENV.ZEN_IP_DEFAULT;
  console.log(`[ZENCLOUD] 🔍 Fetching file details for access_id: ${accessId.substring(0, 8)}...`);
  
  // Try primary API first, then fallback to CDN for Android compatibility
  const baseUrls = [ENV.ZEN_BASE, ENV.ZEN_CDN, ENV.ZEN_API_CDN];
  let lastError: Error | null = null;
  
  for (const baseUrl of baseUrls) {
    try {
      const u = new URL("/file/direct_link", baseUrl);
      u.searchParams.set("file_code", accessId);
      u.searchParams.set("ip", ip);
      u.searchParams.set("key", ENV.ZEN_API_KEY);
      
      console.log(`[ZENCLOUD] 📡 Trying URL: ${u.toString().replace(ENV.ZEN_API_KEY, 'API_KEY_HIDDEN')}`);
      
      const data = await requestJSON<ZenFileResponse>(u.toString());
      
      console.log(`[ZENCLOUD] 📊 File details response from ${baseUrl}:`, {
        status: data.status,
        hasData: !!data.data,
        fileCode: data.data?.file_code,
        hasM3U8: !!data.data?.m3u8_url,
        subtitlesCount: data.data?.subtitles?.length || 0,
        chaptersCount: data.data?.chapters?.length || 0
      });
      
      // Log full file details for debugging
      console.log(`[ZENCLOUD] 📋 FULL FILE DETAILS:`, JSON.stringify(data.data, null, 2));
      
      if (data.status !== "success" || !data.data) {
        throw new Error("Zencloud file details: unexpected response");
      }
      
      console.log(`[ZENCLOUD] ✅ File details loaded successfully from ${baseUrl}`);
      return data.data;
      
    } catch (error: any) {
      console.log(`[ZENCLOUD] ❌ Failed file details with ${baseUrl}: ${error.message}`);
      lastError = error;
      continue;
    }
  }
  
  throw lastError || new Error('All Zencloud file detail endpoints failed');
}

export function maskToken(token: string) {
  if (!token) return "";
  if (token.length <= 12) return "****";
  return token.slice(0, 6) + "…".repeat(3) + token.slice(-6);
}

// Cache management
const CACHE_PREFIX = 'zencloud_';
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

export async function getCachedRaw(anilistId: number): Promise<ZenRawItem[] | null> {
  try {
    const key = `${CACHE_PREFIX}raw_${anilistId}`;
    const cached = await AsyncStorage.getItem(key);
    if (!cached) return null;
    
    const { data, timestamp } = JSON.parse(cached);
    if (Date.now() - timestamp > CACHE_DURATION) {
      await AsyncStorage.removeItem(key);
      return null;
    }
    
    return data;
  } catch (error) {
    console.warn('[ZENCLOUD] Cache read error:', error);
    return null;
  }
}

export async function setCachedRaw(anilistId: number, data: ZenRawItem[]): Promise<void> {
  try {
    const key = `${CACHE_PREFIX}raw_${anilistId}`;
    const cacheData = {
      data,
      timestamp: Date.now()
    };
    await AsyncStorage.setItem(key, JSON.stringify(cacheData));
  } catch (error) {
    console.warn('[ZENCLOUD] Cache write error:', error);
  }
}

export async function getCachedFileDetails(accessId: string): Promise<ZenFileData | null> {
  try {
    const key = `${CACHE_PREFIX}file_${accessId}`;
    const cached = await AsyncStorage.getItem(key);
    if (!cached) return null;
    
    const { data, timestamp } = JSON.parse(cached);
    
    // Check if token is expired
    if (data.token_expires) {
      const tokenExpiry = new Date(data.token_expires).getTime();
      if (Date.now() >= tokenExpiry - 60000) { // 1 minute buffer
        await AsyncStorage.removeItem(key);
        return null;
      }
    }
    
    // Check cache age
    if (Date.now() - timestamp > CACHE_DURATION) {
      await AsyncStorage.removeItem(key);
      return null;
    }
    
    return data;
  } catch (error) {
    console.warn('[ZENCLOUD] File cache read error:', error);
    return null;
  }
}

export async function setCachedFileDetails(accessId: string, data: ZenFileData): Promise<void> {
  try {
    const key = `${CACHE_PREFIX}file_${accessId}`;
    const cacheData = {
      data,
      timestamp: Date.now()
    };
    await AsyncStorage.setItem(key, JSON.stringify(cacheData));
  } catch (error) {
    console.warn('[ZENCLOUD] File cache write error:', error);
  }
}
