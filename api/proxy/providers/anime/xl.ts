import axios from 'axios';
import Constants from 'expo-constants';
import { Episode, Source, Subtitle, WatchResponse } from './zorohianime';

export class XLProvider {
  private baseUrl = 'https://api.aeticdn.net';
  private apiKeys: string[] = [];
  private currentKeyIndex = 0;

  constructor() {
    // Load API keys from environment variables
    this.loadApiKeys();
    console.log(`🟢 [XL] Provider initialized with base URL: ${this.baseUrl}`);
    console.log(`[XL] 📋 Loaded ${this.apiKeys.length} API keys`);
  }

  /**
   * Load API keys from environment variables
   */
  private loadApiKeys(): void {
    const keys: string[] = [];
    
    // Load keys from .env (they should be prefixed with XL_API_KEY_)
    // Using Constants.expoConfig.extra for Expo environment variables
    try {
      const env = Constants.expoConfig?.extra || {};
      keys.push(
        env.XL_API_KEY_1 || '',
        env.XL_API_KEY_2 || '',
        env.XL_API_KEY_3 || '',
        env.XL_API_KEY_4 || ''
      );
    } catch {
      console.warn('[XL] Failed to load API keys from Expo config');
    }

    // Also try process.env for Node.js environment
    if (typeof process !== 'undefined' && process.env) {
      keys.push(
        process.env.XL_API_KEY_1 || '',
        process.env.XL_API_KEY_2 || '',
        process.env.XL_API_KEY_3 || '',
        process.env.XL_API_KEY_4 || ''
      );
    }

    // Filter out empty keys and deduplicate
    this.apiKeys = [...new Set(keys.filter(key => key && key.trim().length > 0))];
    
    if (this.apiKeys.length === 0) {
      console.warn('[XL] ⚠️ No API keys loaded. Provider may not work properly.');
    }
  }

  /**
   * Get the next API key (round-robin rotation)
   */
  private getApiKey(): string {
    if (this.apiKeys.length === 0) {
      throw new Error('No API keys available');
    }
    
    const key = this.apiKeys[this.currentKeyIndex];
    this.currentKeyIndex = (this.currentKeyIndex + 1) % this.apiKeys.length;
    return key;
  }

  /**
   * Make an authenticated API request
   */
  private async makeRequest<T>(
    endpoint: string,
    options: { method?: 'GET' | 'POST'; data?: any; headers?: Record<string, string> } = {}
  ): Promise<T> {
    const apiKey = this.getApiKey();
    const url = `${this.baseUrl}${endpoint}`;
    
    const headers = {
      'X-API-Key': apiKey,
      'Accept': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      ...options.headers
    };

    try {
      const response = await axios.request<T>({
        url,
        method: options.method || 'GET',
        headers,
        data: options.data,
        timeout: 15000,
        validateStatus: (status) => status < 500 // Accept all status codes < 500
      });

      // If unauthorized, try next API key
      if (response.status === 401 && this.apiKeys.length > 1) {
        console.log(`[XL] ⚠️ API key ${this.currentKeyIndex} returned 401, rotating to next key`);
        this.currentKeyIndex = (this.currentKeyIndex + 1) % this.apiKeys.length;
        return this.makeRequest<T>(endpoint, options);
      }

      if (response.status >= 400) {
        throw new Error(`API request failed with status ${response.status}: ${response.statusText}`);
      }

      return response.data;
    } catch (error: any) {
      if (error?.response?.status === 401 && this.apiKeys.length > 1) {
        // Try with next key
        console.log(`[XL] ⚠️ API key failed with 401, rotating to next key`);
        this.currentKeyIndex = (this.currentKeyIndex + 1) % this.apiKeys.length;
        return this.makeRequest<T>(endpoint, options);
      }
      
      console.error(`[XL] ❌ API request failed:`, {
        endpoint,
        error: error?.message,
        status: error?.response?.status,
        statusText: error?.response?.statusText
      });
      throw error;
    }
  }

  /**
   * Search for anime using the XL provider
   */
  async searchAnime(query: string): Promise<any[]> {
    console.log(`\n🔍 [XL SEARCH START] ===================`);
    console.log(`[XL] 🔍 Searching for anime: "${query}"`);
    
    try {
      // XL API might have a search endpoint, adjust based on actual API
      const searchUrl = `/anime/search?q=${encodeURIComponent(query)}`;
      console.log(`[XL] 📡 Search URL: ${searchUrl}`);
      
      const response = await this.makeRequest<any>(searchUrl);
      
      // Adjust response structure based on actual API response
      const results = response?.results || response?.data || response || [];
      
      console.log(`[XL] ✅ Search response received`);
      console.log(`[XL] 📊 Found ${results.length} results`);
      
      if (results.length > 0) {
        console.log(`[XL] 📋 First few results:`, results.slice(0, 3).map((anime: any) => ({
          id: anime.id || anime.anilistId,
          title: anime.title,
          type: anime.type
        })));
      }
      
      console.log(`🔍 [XL SEARCH END] ===================\n`);
      return Array.isArray(results) ? results : [];
    } catch (error: any) {
      console.log(`🔍 [XL SEARCH ERROR] ===================`);
      console.error('[XL] ❌ Search error:', error?.message);
      console.log(`🔍 [XL SEARCH ERROR END] ===================\n`);
      return [];
    }
  }

  /**
   * Get anime info by AniList ID
   */
  async getAnimeInfo(anilistId: string | number): Promise<any> {
    console.log(`\n📄 [XL INFO START] ===================`);
    console.log(`[XL] 📄 Getting anime info for AniList ID: ${anilistId}`);
    
    try {
      const infoUrl = `/anime/${anilistId}`;
      const response = await this.makeRequest<any>(infoUrl);
      
      console.log(`[XL] ✅ Info response received`);
      console.log(`[XL] 📊 Anime info:`, {
        id: response?.id || response?.anilistId,
        title: response?.title,
        episodes: response?.episodes,
        type: response?.type
      });
      
      console.log(`📄 [XL INFO END] ===================\n`);
      return response;
    } catch (error: any) {
      console.log(`📄 [XL INFO ERROR] ===================`);
      console.error('[XL] ❌ Info error:', error?.message);
      console.log(`📄 [XL INFO ERROR END] ===================\n`);
      throw error;
    }
  }

  /**
   * Get episodes from XL provider by AniList ID
   * Note: XL API doesn't provide an episodes list endpoint.
   * Only watch data endpoint exists: /cdn/xl/{anilist_id}/{episode_number}
   * The app will use Jikan/MAL metadata for episode listings instead.
   */
  async getEpisodes(anilistId: string | number): Promise<Episode[]> {
    console.log(`\n📺 [XL EPISODES START] ===================`);
    console.log(`[XL] 📺 Getting episodes for AniList ID: ${anilistId}`);
    console.log(`[XL] ℹ️ XL API doesn't provide an episodes list endpoint.`);
    console.log(`[XL] ℹ️ Only watch data endpoint exists: /cdn/xl/{anilist_id}/{episode_number}`);
    console.log(`[XL] ℹ️ Episode list will fall back to Jikan/MAL metadata.`);
    console.log(`📺 [XL EPISODES END] ===================\n`);
    
    // XL API doesn't have an episodes endpoint, return empty array
    // The app will use Jikan metadata for episode listings
    return [];
  }

  /**
   * Get episodes by AniList ID (alias for compatibility)
   */
  async getEpisodesById(anilistId: string | number): Promise<Episode[]> {
    return this.getEpisodes(anilistId);
  }

  /**
   * Get watch data for an episode
   * Based on documentation: /cdn/xl/:anilist_id/:episode
   */
  async getWatchData(
    anilistIdOrEpisodeId: string,
    isDub: boolean = false,
    episodeNumber?: number
  ): Promise<WatchResponse> {
    console.log(`\n🎬 [XL WATCH START] ===================`);
    console.log(`[XL] 🎬 Getting watch data for: ${anilistIdOrEpisodeId}, isDub: ${isDub}, episodeNumber: ${episodeNumber}`);
    
    try {
      let anilistId: string;
      let episodeNum: number;

      // Parse the input to extract anilistId and episodeNumber
      if (episodeNumber) {
        // If episodeNumber is provided, use anilistIdOrEpisodeId as anilistId
        anilistId = String(anilistIdOrEpisodeId);
        episodeNum = episodeNumber;
      } else if (anilistIdOrEpisodeId.includes('?ep=')) {
        // Format: "anilistId?ep=episodeNumber"
        const parts = anilistIdOrEpisodeId.split('?ep=');
        anilistId = parts[0];
        episodeNum = parseInt(parts[1], 10);
      } else if (anilistIdOrEpisodeId.includes('-ep-')) {
        // Format: "anilistId-ep-episodeNumber"
        const parts = anilistIdOrEpisodeId.split('-ep-');
        anilistId = parts[0];
        episodeNum = parseInt(parts[1], 10);
      } else {
        // Assume it's just anilistId and default to episode 1
        anilistId = String(anilistIdOrEpisodeId);
        episodeNum = 1;
      }

      // Based on actual API: /cdn/xl/:anilist_id/:episode_number
      // No query params needed - API returns both sub and dub in response
      const watchUrl = `/cdn/xl/${anilistId}/${episodeNum}`;
      console.log(`[XL] 📡 Watch URL: ${watchUrl}`);
      
      const response = await this.makeRequest<any>(watchUrl);
      
      console.log(`[XL] ✅ Watch response received`);
      console.log(`[XL] 📊 Response structure:`, {
        hasSuccess: response?.success !== undefined,
        hasData: !!response?.data,
        hasLinks: !!response?.data?.links,
        hasAltLinks: !!response?.data?.alt_links,
        altLinksCount: response?.data?.alt_links?.length || 0,
        episodeAudio: response?.data?.episode?.audio
      });
      
      // Parse the actual API response structure:
      // {
      //   "success": true,
      //   "data": {
      //     "episode": { "audio": "sub" },
      //     "links": { "stream": "https://...m3u8" },
      //     "alt_links": [{ "url": "...", "quality": "HD", "audio": "dub" }],
      //     "subtitles": []
      //   }
      // }
      
      const apiData = response?.data;
      if (!apiData || !response?.success) {
        throw new Error('Invalid API response structure');
      }
      
      const episodeAudio = apiData.episode?.audio || 'sub';
      const mainStreamUrl = apiData.links?.stream;
      const altLinks = Array.isArray(apiData.alt_links) ? apiData.alt_links : [];
      const subtitlesData = Array.isArray(apiData.subtitles) ? apiData.subtitles : [];
      
      console.log(`[XL] 📊 Parsed data:`, {
        episodeAudio,
        hasMainStream: !!mainStreamUrl,
        altLinksCount: altLinks.length,
        subtitlesCount: subtitlesData.length
      });
      
      // Build sources array from main stream and alt_links
      // Filter based on requested audio type (sub/dub)
      const sources: Source[] = [];
      const requestedAudio = isDub ? 'dub' : 'sub';
      
      // Add main stream only if it matches the requested audio type
      if (mainStreamUrl && episodeAudio === requestedAudio) {
        sources.push({
          url: mainStreamUrl,
          quality: 'HD',
          type: requestedAudio,
          headers: {
            'Referer': 'https://zuko.to/',
            'Origin': 'https://zuko.to',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
          },
          isM3U8: mainStreamUrl.includes('.m3u8')
        });
        console.log(`[XL] ✅ Added main stream (${episodeAudio}) matching requested type (${requestedAudio})`);
      } else if (mainStreamUrl) {
        console.log(`[XL] ⚠️ Main stream is ${episodeAudio} but requested ${requestedAudio}, skipping main stream`);
      }
      
      // Add alternate links that match the requested audio type
      altLinks.forEach((altLink: any) => {
        const linkAudio = altLink.audio || episodeAudio;
        // Only include links matching the requested audio type
        if (linkAudio === requestedAudio && altLink.url) {
          sources.push({
            url: altLink.url,
            quality: altLink.quality || altLink.server || 'HD',
            type: requestedAudio,
            headers: {
              'Referer': 'https://zuko.to/',
              'Origin': 'https://zuko.to',
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
            },
            isM3U8: altLink.url.includes('.m3u8') || altLink.type === 'hls'
          });
          console.log(`[XL] ✅ Added alt link: ${altLink.quality || 'HD'} (${linkAudio})`);
        }
      });
      
      console.log(`[XL] 📊 Built sources:`, {
        totalSources: sources.length,
        requestedType: isDub ? 'dub' : 'sub',
        sourcesByType: {
          sub: sources.filter(s => s.type === 'sub').length,
          dub: sources.filter(s => s.type === 'dub').length
        }
      });

      const subtitles: Subtitle[] = subtitlesData
        .filter((s: any) => s && (s.url || s.file))
        .map((s: any) => ({
          url: s.url || s.file || s.src,
          lang: s.lang || s.language || s.label || 'en'
        }));

      if (sources.length === 0) {
        throw new Error('No sources available from XL provider');
      }

      console.log(`[XL] ✅ Successfully processed watch data`);
      console.log(`[XL] 📊 Found ${sources.length} sources, ${subtitles.length} subtitles`);
      
      console.log(`🎬 [XL WATCH END] ===================\n`);
      
      return {
        sources,
        subtitles,
        headers: {
          'Referer': 'https://zuko.to/',
          'Origin': 'https://zuko.to',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
        }
      };
    } catch (error: any) {
      console.log(`🎬 [XL WATCH ERROR] ===================`);
      console.error('[XL] ❌ Error getting watch data:', error?.message);
      console.log(`🎬 [XL WATCH ERROR END] ===================\n`);
      throw error;
    }
  }

  /**
   * Get anime ID by title
   */
  async getAnimeIdByTitle(animeTitle: string): Promise<string | null> {
    console.log(`[XL] 🔍 Getting anime ID for: "${animeTitle}"`);
    
    try {
      const searchResults = await this.searchAnime(animeTitle);
      if (searchResults && searchResults.length > 0) {
        // Find best match (exact or first result)
        const exactMatch = searchResults.find((a: any) => 
          (a.title || '').toLowerCase().trim() === animeTitle.toLowerCase().trim()
        );
        const foundAnime = exactMatch || searchResults[0];
        const id = foundAnime?.id || foundAnime?.anilistId;
        
        if (id) {
          console.log(`[XL] ✅ Found anime ID: ${id}`);
          return String(id);
        }
      }
      
      console.log(`[XL] ❌ No anime ID found for: "${animeTitle}"`);
      return null;
    } catch (error: any) {
      console.error(`[XL] ❌ Error getting anime ID:`, error?.message);
      return null;
    }
  }

  /**
   * Get anime ID by AniList ID (compatibility method)
   */
  async getAnimeIdByAnilistId(anilistId: string | number): Promise<string | null> {
    console.log(`[XL] 🔍 Resolving by AniList ID: ${anilistId}`);
    // XL uses AniList IDs directly, so just return it
    return String(anilistId);
  }

  /**
   * Check episode availability
   */
  async checkEpisodeAvailability(
    anilistId: string | number,
    episodeNumber: number
  ): Promise<{ sub: boolean; dub: boolean }> {
    try {
      console.log(`[XL] 🔄 Checking availability for AniList ID: ${anilistId}, ep: ${episodeNumber}`);
      
      // Try to get watch data for both sub and dub
      const [subData, dubData] = await Promise.allSettled([
        this.getWatchData(String(anilistId), false, episodeNumber),
        this.getWatchData(String(anilistId), true, episodeNumber)
      ]);

      const sub = subData.status === 'fulfilled' && subData.value.sources.length > 0;
      const dub = dubData.status === 'fulfilled' && dubData.value.sources.length > 0;

      console.log(`[XL] ✅ Availability: sub=${sub}, dub=${dub}`);
      return { sub, dub };
    } catch (error: any) {
      console.error(`[XL] ❌ Error checking availability:`, error?.message);
      return { sub: false, dub: false };
    }
  }
}

// Export singleton instance
export const xlProvider = new XLProvider();

