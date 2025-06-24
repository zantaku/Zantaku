import axios from 'axios';
import { CONSUMET_API_URL } from '../../../../app/constants/api';
import { AUTO_DETECT_TIMING } from '../../../../app/videoplayer/constants';
import { Episode, Source, Subtitle, VideoTimings, WatchResponse } from './zorohianime';

export class AnimePaheProvider {
  private baseUrl = `${CONSUMET_API_URL}`;
  private provider = 'animepahe';

  /**
   * Search for anime using the AnimePahe provider
   */
  async searchAnime(query: string): Promise<any[]> {
    try {
      const searchUrl = `${this.baseUrl}/anime/animepahe/${encodeURIComponent(query)}`;
      console.log(`[AnimePaheProvider] Searching: ${searchUrl}`);
      
      const response = await axios.get(searchUrl);
      return response.data.results || [];
    } catch (error) {
      console.error('[AnimePaheProvider] Search error:', error);
      throw new Error('Failed to search anime');
    }
  }

  /**
   * Get anime info by ID
   */
  async getAnimeInfo(id: string): Promise<any> {
    try {
      const infoUrl = `${this.baseUrl}/anime/animepahe/info/${id}`;
      console.log(`[AnimePaheProvider] Getting info: ${infoUrl}`);
      
      const response = await axios.get(infoUrl);
      return response.data;
    } catch (error) {
      console.error('[AnimePaheProvider] Info error:', error);
      throw new Error('Failed to get anime info');
    }
  }

  /**
   * Get episodes from AnimePahe
   */
  async getEpisodes(animeId: string): Promise<Episode[]> {
    try {
      const episodesUrl = `${this.baseUrl}/anime/animepahe/info/${animeId}`;
      console.log(`[AnimePaheProvider] Getting episodes: ${episodesUrl}`);
      
      const response = await axios.get(episodesUrl);
      
      if (!response.data || !response.data.episodes) {
        console.log('[AnimePaheProvider] No episodes found');
        return [];
      }

      return response.data.episodes.map((ep: any) => ({
        id: ep.id,
        number: ep.number,
        title: ep.title,
        image: ep.image,
        description: ep.description,
        duration: ep.duration,
        provider: 'AnimePahe',
        isSubbed: true, // AnimePahe provides subbed content
        isDubbed: true, // AnimePahe also provides dubbed content
        isFiller: ep.isFiller,
        isRecap: ep.isRecap,
        aired: ep.aired
      }));
    } catch (error) {
      console.error('[AnimePaheProvider] Episodes error:', error);
      return [];
    }
  }

  /**
   * Get watch data for an episode by anime ID and episode number
   */
  async getWatchData(animeId: string, episodeNumber: number, isDub: boolean = false): Promise<WatchResponse> {
    try {
      const watchUrl = `${this.baseUrl}/anime/animepahe/watch/${animeId}/episode-${episodeNumber}`;
      console.log(`[AnimePaheProvider] Getting ${isDub ? 'DUB' : 'SUB'} watch data: ${watchUrl}`);
      
      const response = await axios.get(watchUrl);
      
      if (!response.data) {
        throw new Error('No watch data available');
      }

      // Format sources
      const sources: Source[] = (response.data.sources || [])
        .map((source: any) => ({
          url: source.url,
          quality: source.quality || 'default',
          type: isDub ? 'dub' : 'sub',
          headers: {
            ...response.data.headers,
            Referer: 'https://animepahe.com/',
            Origin: 'https://animepahe.com',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/98.0.4758.102 Safari/537.36'
          },
          isM3U8: source.url.includes('.m3u8') || source.isM3U8
        }));

      // AnimePahe typically doesn't provide separate subtitle files as they're embedded
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
      console.error('[AnimePaheProvider] Watch data error:', error);
      throw new Error('Failed to get watch data');
    }
  }

  /**
   * Get watch data for an episode by direct episode ID (legacy method)
   */
  async getWatchDataById(episodeId: string, isDub: boolean = false): Promise<WatchResponse> {
    try {
      const watchUrl = `${this.baseUrl}/anime/animepahe/watch/${episodeId}`;
      console.log(`[AnimePaheProvider] Getting watch data by ID: ${watchUrl}`);
      
      const response = await axios.get(watchUrl);
      
      if (!response.data) {
        throw new Error('No watch data available');
      }

      // Format sources
      const sources: Source[] = (response.data.sources || [])
        .map((source: any) => ({
          url: source.url,
          quality: source.quality || 'default',
          type: isDub ? 'dub' : 'sub',
          headers: {
            ...response.data.headers,
            Referer: 'https://animepahe.com/',
            Origin: 'https://animepahe.com',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/98.0.4758.102 Safari/537.36'
          },
          isM3U8: source.url.includes('.m3u8') || source.isM3U8
        }));

      // AnimePahe typically doesn't provide separate subtitle files as they're embedded
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
      console.error('[AnimePaheProvider] Watch data error:', error);
      throw new Error('Failed to get watch data');
    }
  }

  /**
   * Search for anime by title and get episodes
   */
  async searchAndGetEpisodes(animeTitle: string, episodeNumber?: number): Promise<Episode[]> {
    try {
      console.log(`[AnimePaheProvider] Searching for: ${animeTitle}`);
      
      const searchResults = await this.searchAnime(animeTitle);
      
      if (!searchResults.length) {
        console.log('[AnimePaheProvider] No search results found');
        return [];
      }

      // Find the best match
      const exactMatch = searchResults.find((anime: any) => 
        anime.title.toLowerCase().trim() === animeTitle.toLowerCase().trim()
      );
      
      const selectedAnime = exactMatch || searchResults[0];
      console.log(`[AnimePaheProvider] Selected anime: ${selectedAnime.title}`);

      // Get episodes for the selected anime
      const episodes = await this.getEpisodes(selectedAnime.id);
      
      // If looking for a specific episode, filter it
      if (episodeNumber) {
        return episodes.filter(ep => ep.number === episodeNumber);
      }
      
      return episodes;
    } catch (error) {
      console.error('[AnimePaheProvider] Search and get episodes error:', error);
      return [];
    }
  }

  /**
   * Check if a specific episode is available
   */
  async checkEpisodeAvailability(animeTitle: string, episodeNumber: number): Promise<boolean> {
    try {
      const episodes = await this.searchAndGetEpisodes(animeTitle, episodeNumber);
      return episodes.length > 0;
    } catch (error) {
      console.error('[AnimePaheProvider] Availability check error:', error);
      return false;
    }
  }

  /**
   * Get episode by anime title and episode number
   */
  async getEpisodeByTitle(animeTitle: string, episodeNumber: number): Promise<Episode | null> {
    try {
      const episodes = await this.searchAndGetEpisodes(animeTitle, episodeNumber);
      return episodes.length > 0 ? episodes[0] : null;
    } catch (error) {
      console.error('[AnimePaheProvider] Get episode by title error:', error);
      return null;
    }
  }

  /**
   * Get AnimePahe anime ID by searching for the anime title
   */
  async getAnimeIdByTitle(animeTitle: string): Promise<string | null> {
    try {
      console.log(`[AnimePaheProvider] Getting anime ID for: ${animeTitle}`);
      
      const searchResults = await this.searchAnime(animeTitle);
      
      if (!searchResults.length) {
        console.log('[AnimePaheProvider] No search results found');
        return null;
      }

      // Find the best match
      const exactMatch = searchResults.find((anime: any) => 
        anime.title.toLowerCase().trim() === animeTitle.toLowerCase().trim()
      );
      
      const selectedAnime = exactMatch || searchResults[0];
      console.log(`[AnimePaheProvider] Selected anime: ${selectedAnime.title} (ID: ${selectedAnime.id})`);

      return selectedAnime.id;
    } catch (error) {
      console.error('[AnimePaheProvider] Get anime ID error:', error);
      return null;
    }
  }

  /**
   * Merge AnimePahe episodes with existing episodes
   */
  mergeWithExistingEpisodes(existingEpisodes: Episode[], animePaheEpisodes: Episode[]): Episode[] {
    const episodeMap = new Map<number, Episode>();
    
    // Add existing episodes first
    existingEpisodes.forEach(ep => episodeMap.set(ep.number, ep));
    
    // Add AnimePahe episodes as alternatives or fill gaps
    animePaheEpisodes.forEach(ep => {
      const existing = episodeMap.get(ep.number);
      if (!existing) {
        // Add new episode
        episodeMap.set(ep.number, ep);
      } else {
        // Update existing episode to indicate AnimePahe availability
        episodeMap.set(ep.number, {
          ...existing,
          provider: existing.provider ? `${existing.provider}, AnimePahe` : 'AnimePahe'
        });
      }
    });
    
    return Array.from(episodeMap.values()).sort((a, b) => a.number - b.number);
  }
}

// Export a singleton instance
export const animePaheProvider = new AnimePaheProvider();
