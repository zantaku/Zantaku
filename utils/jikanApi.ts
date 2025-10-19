/**
 * Jikan API v4 Utility
 * Provides anime and episode metadata from MyAnimeList via Jikan API
 * Documentation: https://docs.api.jikan.moe/
 */

import axios from 'axios';
import { JIKAN_API_ENDPOINT } from '../app/constants/api';

// Types for Jikan API responses
export interface JikanEpisode {
  mal_id: number;
  url: string;
  title: string;
  title_japanese?: string;
  title_romanji?: string;
  aired?: string;
  score?: number;
  filler: boolean;
  recap: boolean;
  forum_url?: string;
  duration?: number; // in seconds
}

export interface JikanEpisodesResponse {
  pagination: {
    last_visible_page: number;
    has_next_page: boolean;
  };
  data: JikanEpisode[];
}

export interface JikanAnimeData {
  mal_id: number;
  url: string;
  images: {
    jpg: {
      image_url: string;
      small_image_url: string;
      large_image_url: string;
    };
    webp: {
      image_url: string;
      small_image_url: string;
      large_image_url: string;
    };
  };
  trailer?: {
    youtube_id?: string;
    url?: string;
    embed_url?: string;
  };
  title: string;
  title_english?: string;
  title_japanese?: string;
  type?: string;
  episodes?: number;
  status?: string;
  aired?: {
    from?: string;
    to?: string;
    string?: string;
  };
  duration?: string;
  rating?: string;
  score?: number;
  scored_by?: number;
  rank?: number;
  popularity?: number;
  members?: number;
  favorites?: number;
  synopsis?: string;
  background?: string;
  season?: string;
  year?: number;
  broadcast?: {
    day?: string;
    time?: string;
    timezone?: string;
    string?: string;
  };
  studios?: Array<{ mal_id: number; type: string; name: string; url: string }>;
  genres?: Array<{ mal_id: number; type: string; name: string; url: string }>;
}

export interface JikanAnimeResponse {
  data: JikanAnimeData;
}

// Cache to avoid redundant API calls
const episodeCache: Map<string, JikanEpisode[]> = new Map();
const animeCache: Map<number, JikanAnimeData> = new Map();

// Rate limiting helper
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 333; // ~3 requests per second (Jikan limit)

const waitForRateLimit = async () => {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  
  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
    const waitTime = MIN_REQUEST_INTERVAL - timeSinceLastRequest;
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }
  
  lastRequestTime = Date.now();
};

/**
 * Fetch all episodes for an anime from Jikan API
 * Handles pagination automatically
 */
export const fetchJikanEpisodes = async (malId: number): Promise<JikanEpisode[]> => {
  const cacheKey = `mal_${malId}`;
  
  // Check cache first
  if (episodeCache.has(cacheKey)) {
    console.log(`[JIKAN] 📦 Using cached episodes for MAL ID ${malId}`);
    return episodeCache.get(cacheKey)!;
  }
  
  console.log(`[JIKAN] 🔄 Fetching episodes for MAL ID ${malId}`);
  
  try {
    const allEpisodes: JikanEpisode[] = [];
    let page = 1;
    let hasNextPage = true;
    
    while (hasNextPage) {
      await waitForRateLimit();
      
      const url = `${JIKAN_API_ENDPOINT}/anime/${malId}/episodes?page=${page}`;
      console.log(`[JIKAN] 📡 Fetching page ${page}: ${url}`);
      
      const response = await axios.get<JikanEpisodesResponse>(url, {
        timeout: 10000,
        headers: {
          'Accept': 'application/json',
        }
      });
      
      if (response.data?.data && Array.isArray(response.data.data)) {
        allEpisodes.push(...response.data.data);
        hasNextPage = response.data.pagination?.has_next_page ?? false;
        page++;
        
        console.log(`[JIKAN] ✅ Page ${page - 1} fetched: ${response.data.data.length} episodes (Total: ${allEpisodes.length})`);
      } else {
        hasNextPage = false;
      }
      
      // Safety limit to prevent infinite loops
      if (page > 50) {
        console.warn(`[JIKAN] ⚠️ Stopped at page 50 to prevent infinite loop`);
        break;
      }
    }
    
    // Cache the results
    if (allEpisodes.length > 0) {
      episodeCache.set(cacheKey, allEpisodes);
      console.log(`[JIKAN] 💾 Cached ${allEpisodes.length} episodes for MAL ID ${malId}`);
    }
    
    console.log(`[JIKAN] ✅ Successfully fetched ${allEpisodes.length} episodes for MAL ID ${malId}`);
    
    // Log filler and recap episodes
    const fillerCount = allEpisodes.filter(ep => ep.filler).length;
    const recapCount = allEpisodes.filter(ep => ep.recap).length;
    if (fillerCount > 0 || recapCount > 0) {
      console.log(`[JIKAN] 📊 Metadata: ${fillerCount} filler episodes, ${recapCount} recap episodes`);
    }
    
    return allEpisodes;
    
  } catch (error: any) {
    if (error?.response?.status === 404) {
      console.warn(`[JIKAN] ⚠️ MAL ID ${malId} not found`);
      return [];
    }
    
    if (error?.response?.status === 429) {
      console.error(`[JIKAN] ❌ Rate limited. Please wait before retrying.`);
      throw new Error('Jikan API rate limit exceeded. Please wait a moment.');
    }
    
    console.error(`[JIKAN] ❌ Error fetching episodes for MAL ID ${malId}:`, {
      message: error?.message,
      status: error?.response?.status,
      statusText: error?.response?.statusText
    });
    
    throw error;
  }
};

/**
 * Fetch anime details from Jikan API
 */
export const fetchJikanAnimeData = async (malId: number): Promise<JikanAnimeData | null> => {
  // Check cache first
  if (animeCache.has(malId)) {
    console.log(`[JIKAN] 📦 Using cached anime data for MAL ID ${malId}`);
    return animeCache.get(malId)!;
  }
  
  console.log(`[JIKAN] 🔄 Fetching anime data for MAL ID ${malId}`);
  
  try {
    await waitForRateLimit();
    
    const url = `${JIKAN_API_ENDPOINT}/anime/${malId}`;
    console.log(`[JIKAN] 📡 Fetching: ${url}`);
    
    const response = await axios.get<JikanAnimeResponse>(url, {
      timeout: 10000,
      headers: {
        'Accept': 'application/json',
      }
    });
    
    if (response.data?.data) {
      const animeData = response.data.data;
      animeCache.set(malId, animeData);
      
      console.log(`[JIKAN] ✅ Successfully fetched anime data for "${animeData.title}"`);
      console.log(`[JIKAN] 📊 Episodes: ${animeData.episodes || 'Unknown'}, Status: ${animeData.status}, Score: ${animeData.score || 'N/A'}`);
      
      return animeData;
    }
    
    return null;
    
  } catch (error: any) {
    if (error?.response?.status === 404) {
      console.warn(`[JIKAN] ⚠️ MAL ID ${malId} not found`);
      return null;
    }
    
    if (error?.response?.status === 429) {
      console.error(`[JIKAN] ❌ Rate limited. Please wait before retrying.`);
      throw new Error('Jikan API rate limit exceeded. Please wait a moment.');
    }
    
    console.error(`[JIKAN] ❌ Error fetching anime data for MAL ID ${malId}:`, {
      message: error?.message,
      status: error?.response?.status,
      statusText: error?.response?.statusText
    });
    
    return null;
  }
};

/**
 * Search for anime by title to get MAL ID
 */
export const searchJikanAnime = async (query: string, limit: number = 5): Promise<JikanAnimeData[]> => {
  console.log(`[JIKAN] 🔍 Searching for anime: "${query}"`);
  
  try {
    await waitForRateLimit();
    
    const url = `${JIKAN_API_ENDPOINT}/anime?q=${encodeURIComponent(query)}&limit=${limit}&order_by=popularity&sort=asc`;
    console.log(`[JIKAN] 📡 Searching: ${url}`);
    
    const response = await axios.get<{ data: JikanAnimeData[] }>(url, {
      timeout: 10000,
      headers: {
        'Accept': 'application/json',
      }
    });
    
    if (response.data?.data && Array.isArray(response.data.data)) {
      console.log(`[JIKAN] ✅ Found ${response.data.data.length} results for "${query}"`);
      
      // Cache the results
      response.data.data.forEach(anime => {
        animeCache.set(anime.mal_id, anime);
      });
      
      return response.data.data;
    }
    
    return [];
    
  } catch (error: any) {
    if (error?.response?.status === 429) {
      console.error(`[JIKAN] ❌ Rate limited. Please wait before retrying.`);
      throw new Error('Jikan API rate limit exceeded. Please wait a moment.');
    }
    
    console.error(`[JIKAN] ❌ Error searching for anime "${query}":`, {
      message: error?.message,
      status: error?.response?.status
    });
    
    return [];
  }
};

/**
 * Clear episode cache (useful for refreshing data)
 */
export const clearJikanCache = () => {
  episodeCache.clear();
  animeCache.clear();
  console.log('[JIKAN] 🗑️ Cache cleared');
};

/**
 * Get episode by number
 */
export const getJikanEpisodeByNumber = async (malId: number, episodeNumber: number): Promise<JikanEpisode | null> => {
  const episodes = await fetchJikanEpisodes(malId);
  return episodes.find(ep => ep.mal_id === episodeNumber) || null;
};

