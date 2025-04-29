import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

// Types needed for episode caching
export interface Episode {
  id: string;
  number: number;
  title?: string;
  image?: string;
  progress?: number;
  isFiller?: boolean;
  isRecap?: boolean;
  aired?: string;
  anilistId?: string;
  description?: string;
  duration?: number;
  provider?: string;
}

// Constants
export const CACHE_EXPIRY_TIME = 24 * 60 * 60 * 1000; // 24 hours in milliseconds 
export const MAX_INITIAL_EPISODES = 24; // Initial number of episodes to show

// Delay utility for rate limiting
export const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// API request throttling
let apiRequestQueue: (() => Promise<any>)[] = [];
let isProcessingQueue = false;

export const rateLimitedFetch = async (fn: () => Promise<any>) => {
  return new Promise((resolve, reject) => {
    apiRequestQueue.push(async () => {
      try {
        const result = await fn();
        resolve(result);
      } catch (error) {
        reject(error);
      }
    });

    if (!isProcessingQueue) {
      processQueue();
    }
  });
};

const processQueue = async () => {
  if (apiRequestQueue.length === 0) {
    isProcessingQueue = false;
    return;
  }

  isProcessingQueue = true;
  const request = apiRequestQueue[0];
  
  try {
    await request();
  } catch (error) {
    console.error('Error processing queued request:', error);
  }
  
  apiRequestQueue.shift();
  await delay(1200); // Respecting rate limits with 1.2s between requests
  processQueue();
};

// Retry logic for API requests
export const fetchWithRetry = async (url: string, params: any = {}, retries = 3, baseDelay = 1000) => {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await axios.get(url, { params });
      return response;
    } catch (error: any) {
      if (error.response?.status === 429) {
        console.log(`Rate limited, attempt ${i + 1}/${retries}. Waiting ${baseDelay * (i + 1)}ms...`);
        await delay(baseDelay * (i + 1)); // Exponential backoff
        continue;
      }
      throw error;
    }
  }
  throw new Error(`Failed after ${retries} retries`);
};

// Utility to compact episode data before caching
export const compactEpisodeData = (episode: Episode): Partial<Episode> => {
  // Store only essential fields to save space
  return {
    id: episode.id,
    number: episode.number,
    title: episode.title,
    image: episode.image || '',
    aired: episode.aired,
    isFiller: episode.isFiller || false,
    isRecap: episode.isRecap || false,
    duration: episode.duration,
  };
};

// Create a cache key for episodes
export const getEpisodeCacheKey = (anilistId?: string, malId?: string, animeTitle?: string) => {
  return `episodes_${anilistId || malId || animeTitle?.replace(/\s+/g, '_').toLowerCase() || 'unknown'}`;
};

// Save episodes to cache
export const saveEpisodesToCache = async (
  episodes: Episode[], 
  anilistId?: string, 
  malId?: string, 
  animeTitle?: string
) => {
  if (!episodes || episodes.length === 0) return;
  
  try {
    const key = getEpisodeCacheKey(anilistId, malId, animeTitle);
    
    // Compact the episode data to save storage space
    const compactedEpisodes = episodes.map(compactEpisodeData);
    
    const cacheData = {
      episodes: compactedEpisodes,
      timestamp: Date.now(),
      version: 2, // Version number for cache format
      count: episodes.length,
      maxEpisode: Math.max(...episodes.map(ep => ep.number)),
    };
    
    await AsyncStorage.setItem(key, JSON.stringify(cacheData));
    console.log(`Cached ${episodes.length} episodes with key: ${key}`);
    return true;
  } catch (error) {
    console.error('Error saving episodes to cache:', error);
    return false;
  }
};

// Load episodes from cache
export const loadEpisodesFromCache = async (
  anilistId?: string, 
  malId?: string, 
  animeTitle?: string,
  coverImage?: string
): Promise<{episodes: Episode[], isStale: boolean} | null> => {
  try {
    const key = getEpisodeCacheKey(anilistId, malId, animeTitle);
    const cachedData = await AsyncStorage.getItem(key);
    
    if (!cachedData) {
      return null;
    }
    
    const parsed = JSON.parse(cachedData);
    const { episodes, timestamp, version } = parsed;
    const cacheAge = Date.now() - timestamp;
    
    if (!episodes || !Array.isArray(episodes) || episodes.length === 0) {
      return null;
    }
    
    console.log(`Loaded ${episodes.length} episodes from cache (age: ${Math.round(cacheAge / (60 * 1000))} minutes)`);
    
    // Determine if cache is stale and needs refresh
    const isStale = cacheAge > CACHE_EXPIRY_TIME || (version || 1) < 2;
    
    // For version 2+, episodes are in compact format, expand them
    if (version >= 2) {
      // Fill in missing fields with defaults
      const expandedEpisodes = episodes.map((ep: Partial<Episode>) => ({
        id: ep.id || '',
        number: ep.number || 0,
        title: ep.title || `Episode ${ep.number}`,
        image: ep.image || coverImage || '',
        isFiller: ep.isFiller || false,
        isRecap: ep.isRecap || false,
        duration: ep.duration || 24,
        aired: ep.aired || '',
        anilistId: anilistId,
        description: '',
        provider: 'cache',
      }));
      
      return { episodes: expandedEpisodes, isStale };
    }
    
    // Legacy format (version 1 or unspecified)
    return { episodes: episodes as Episode[], isStale };
  } catch (error) {
    console.error('Error loading episodes from cache:', error);
    return null;
  }
};

// Generate range labels for episodic content
export const createEpisodeRangeLabels = (
  episodes: Episode[], 
  isNewestFirst: boolean
): string[] => {
  if (episodes.length === 0) return [];

  // Sort episodes by number
  const sortedEpisodes = [...episodes].sort((a, b) => a.number - b.number);
  
  // Group consecutive episode numbers
  const ranges: { start: number; end: number }[] = [];
  let currentRange: { start: number; end: number } | null = null;

  sortedEpisodes.forEach(episode => {
    const num = episode.number;
    
    if (!currentRange) {
      currentRange = { start: num, end: num };
    } else if (num === currentRange.end + 1) {
      // Consecutive episode, extend the range
      currentRange.end = num;
    } else {
      // Non-consecutive, start a new range
      ranges.push({ ...currentRange });
      currentRange = { start: num, end: num };
    }
  });

  // Add the last range
  if (currentRange) {
    ranges.push(currentRange);
  }

  // Generate labels
  return ranges.map(range => {
    if (range.start === range.end) {
      return `${range.start}`;
    }
    return `${range.start}-${range.end}`;
  });
};

// Create episode ranges for tabbed viewing
export const createEpisodeRanges = (
  episodes: Episode[], 
  isNewestFirst: boolean
): Episode[][] => {
  const ranges: Episode[][] = [];
  
  if (episodes.length === 0) {
    return ranges;
  }
  
  const maxEpisodes = Math.max(...episodes.map(ep => ep.number));
  
  // Adaptive episodes per tab based on total episode count
  let episodesPerTab;
  if (maxEpisodes > 2000) episodesPerTab = 500;
  else if (maxEpisodes > 1000) episodesPerTab = 250;
  else if (maxEpisodes > 500) episodesPerTab = 150;
  else episodesPerTab = 100;

  const numTabs = Math.ceil(maxEpisodes / episodesPerTab);

  // Sort episodes based on isNewestFirst
  const sortedEpisodes = [...episodes].sort((a, b) => 
    isNewestFirst ? b.number - a.number : a.number - b.number
  );

  // Generate ranges based on sort order
  if (isNewestFirst) {
    // For newest first: start from highest number and go down
    for (let i = 0; i < numTabs; i++) {
      const end = maxEpisodes - (i * episodesPerTab);
      const start = Math.max(1, end - episodesPerTab + 1);
      
      const rangeEpisodes = sortedEpisodes.filter(ep => ep.number <= end && ep.number >= start);
      if (rangeEpisodes.length > 0) {
        ranges.push(rangeEpisodes);
      }
    }
  } else {
    // For oldest first: start from 1 and go up
    for (let i = 0; i < numTabs; i++) {
      const start = i * episodesPerTab + 1;
      const end = Math.min(maxEpisodes, (i + 1) * episodesPerTab);
      
      const rangeEpisodes = sortedEpisodes.filter(ep => ep.number >= start && ep.number <= end);
      if (rangeEpisodes.length > 0) {
        ranges.push(rangeEpisodes);
      }
    }
  }

  return ranges;
};

// Render a nice label for episode range tabs
export const formatRangeLabel = (
  range: Episode[], 
  isNewestFirst: boolean
): string => {
  if (!range.length) return '';
  
  // Simple format for small ranges
  if (range.length <= 3) {
    const numbers = range.map(ep => ep.number)
      .sort(isNewestFirst ? (a, b) => b - a : (a, b) => a - b);
    return numbers.join(', ');
  }
  
  // For ranges with skipped episodes, create more descriptive labels
  const minEp = Math.min(...range.map(ep => ep.number));
  const maxEp = Math.max(...range.map(ep => ep.number));
  
  // If the range has exactly maxEp-minEp+1 episodes, it's continuous
  if (range.length === (maxEp - minEp + 1)) {
    return isNewestFirst ? `${maxEp}-${minEp}` : `${minEp}-${maxEp}`;
  }
  
  // Handle skipped episodes with compact notation
  const sortedNumbers = range.map(ep => ep.number).sort((a, b) => a - b);
  
  // Look for large gaps
  let hasLargeGap = false;
  for (let i = 1; i < sortedNumbers.length; i++) {
    if (sortedNumbers[i] - sortedNumbers[i-1] > 5) {
      hasLargeGap = true;
      break;
    }
  }
  
  // If there are large gaps, show range with count
  if (hasLargeGap) {
    return isNewestFirst 
      ? `${maxEp}→${minEp} (${range.length})`
      : `${minEp}→${maxEp} (${range.length})`;
  }
  
  // Default format
  return isNewestFirst 
    ? `${maxEp}-${minEp}`
    : `${minEp}-${maxEp}`;
}; 