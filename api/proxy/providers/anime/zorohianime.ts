import axios from 'axios';
import { CONSUMET_API_URL } from '../../../../app/constants/api';

export interface Episode {
  id: string;
  number: number;
  title?: string;
  image?: string;
  description?: string;
  duration?: number;
  provider?: string;
  isSubbed?: boolean;
  isDubbed?: boolean;
  isFiller?: boolean;
  isRecap?: boolean;
  aired?: string;
  providerIds?: {
    zoro?: string;
    animepahe?: string;
  };
}

export interface Source {
  quality: string;
  url: string;
  type: 'sub' | 'dub';
  headers: Record<string, string>;
  isM3U8?: boolean;
}

export interface Subtitle {
  url: string;
  lang: string;
}

export interface VideoTimings {
  intro?: { start: number; end: number; };
  outro?: { start: number; end: number; };
}

export interface WatchResponse {
  sources: Source[];
  subtitles: Subtitle[];
  intro?: { start: number; end: number; };
  outro?: { start: number; end: number; };
  headers?: Record<string, string>;
}

export class ZoroHiAnimeProvider {
  private baseUrl = `${CONSUMET_API_URL}`;
  private provider = 'zoro';

  /**
   * Search for anime using the Zoro provider
   */
  async searchAnime(query: string): Promise<any[]> {
    try {
      const searchUrl = `${this.baseUrl}/anime/zoro/${encodeURIComponent(query)}?type=1`;
      console.log(`[ZoroProvider] Searching: ${searchUrl}`);
      
      const response = await axios.get(searchUrl);
      return response.data.results || [];
    } catch (error) {
      console.error('[ZoroProvider] Search error:', error);
      throw new Error('Failed to search anime');
    }
  }

  /**
   * Get anime info by ID
   */
  async getAnimeInfo(id: string): Promise<any> {
    try {
      const infoUrl = `${this.baseUrl}/anime/zoro/info?id=${id}`;
      console.log(`[ZoroProvider] Getting info: ${infoUrl}`);
      
      const response = await axios.get(infoUrl);
      return response.data;
    } catch (error) {
      console.error('[ZoroProvider] Info error:', error);
      throw new Error('Failed to get anime info');
    }
  }

  /**
   * Get episodes using AniList meta endpoint
   */
  async getEpisodes(anilistId: string, isDub: boolean = false): Promise<Episode[]> {
    try {
      const episodesUrl = `${this.baseUrl}/meta/anilist/episodes/${anilistId}?provider=zoro${isDub ? '&dub=true' : ''}`;
      console.log(`[ZoroProvider] Getting episodes: ${episodesUrl}`);
      
      const response = await axios.get(episodesUrl);
      
      if (!response.data || response.data.length === 0) {
        console.log(`[ZoroProvider] No ${isDub ? 'DUB' : 'SUB'} episodes found`);
        return [];
      }

      return response.data.map((ep: any) => ({
        id: ep.id,
        number: ep.number,
        title: ep.title,
        image: ep.image,
        description: ep.description,
        duration: ep.duration,
        provider: 'Zoro/HiAnime',
        isSubbed: !isDub,
        isDubbed: isDub,
        isFiller: ep.isFiller,
        isRecap: ep.isRecap,
        aired: ep.aired
      }));
    } catch (error) {
      console.error('[ZoroProvider] Episodes error:', error);
      return [];
    }
  }

  /**
   * Get watch data for an episode
   */
  async getWatchData(episodeId: string, isDub: boolean = false): Promise<WatchResponse> {
    try {
      const watchUrl = `${this.baseUrl}/meta/anilist/watch/${episodeId}?provider=zoro${isDub ? '&dub=true' : ''}`;
      console.log(`[ZoroProvider] Getting watch data: ${watchUrl}`);
      
      const response = await axios.get(watchUrl);
      
      if (!response.data) {
        throw new Error('No watch data available');
      }

      // Format sources
      const sources: Source[] = (response.data.sources || [])
        .filter((source: any) => !source.url.includes('m3u8.google'))
        .map((source: any) => ({
          url: source.url,
          quality: source.quality || 'default',
          type: isDub ? 'dub' : 'sub',
          headers: {
            ...response.data.headers,
            Referer: 'https://hianime.to/',
            Origin: 'https://hianime.to',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/98.0.4758.102 Safari/537.36'
          },
          isM3U8: source.url.includes('.m3u8') || source.isM3U8
        }));

      // Format subtitles
      const subtitles: Subtitle[] = (response.data.subtitles || [])
        .filter((sub: any) => sub.url && sub.lang)
        .map((sub: any) => ({
          url: sub.url,
          lang: sub.lang
        }));

      return {
        sources,
        subtitles,
        intro: response.data.intro,
        outro: response.data.outro,
        headers: response.data.headers
      };
    } catch (error) {
      console.error('[ZoroProvider] Watch data error:', error);
      throw new Error('Failed to get watch data');
    }
  }

  /**
   * Check episode availability for both sub and dub
   */
  async checkEpisodeAvailability(anilistId: string, episodeNumber: number): Promise<{sub: boolean, dub: boolean}> {
    try {
      const [subCheck, dubCheck] = await Promise.allSettled([
        this.getEpisodes(anilistId, false),
        this.getEpisodes(anilistId, true)
      ]);
      
      const subAvailable = subCheck.status === 'fulfilled' && 
        subCheck.value.some(ep => ep.number === episodeNumber);
        
      const dubAvailable = dubCheck.status === 'fulfilled' && 
        dubCheck.value.some(ep => ep.number === episodeNumber);
      
      return { sub: subAvailable, dub: dubAvailable };
    } catch (error) {
      console.error('[ZoroProvider] Availability check error:', error);
      return { sub: true, dub: true }; // Assume both available if check fails
    }
  }

  /**
   * Merge episodes from different sources
   */
  mergeEpisodes(jikanEpisodes: Episode[], zoroEpisodes: any[], coverImage?: string): Episode[] {
    const episodeMap = new Map<number, Episode>();
    
    // Add Jikan episodes first
    jikanEpisodes.forEach(ep => episodeMap.set(ep.number, ep));
    
    const highestJikanEpisode = jikanEpisodes.reduce((max, ep) => Math.max(max, ep.number), 0);
    
    // Add Zoro episodes that are missing or newer
    zoroEpisodes.forEach((zoroEp: any) => {
      if (zoroEp.number && !isNaN(zoroEp.number) && 
          (!episodeMap.has(zoroEp.number) || zoroEp.number > highestJikanEpisode)) {
        episodeMap.set(zoroEp.number, {
          id: zoroEp.id || `zoro-${zoroEp.number}`,
          number: zoroEp.number,
          title: zoroEp.title || `Episode ${zoroEp.number}`,
          image: zoroEp.image || coverImage,
          provider: 'Zoro/HiAnime',
          description: zoroEp.description,
          duration: zoroEp.duration,
          isFiller: zoroEp.isFiller,
          isRecap: zoroEp.isRecap,
          aired: zoroEp.aired
        });
      }
    });
    
    return Array.from(episodeMap.values()).sort((a, b) => a.number - b.number);
  }
}

// Export a singleton instance
export const zoroProvider = new ZoroHiAnimeProvider();
