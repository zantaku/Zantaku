import axios from 'axios';
import { CONSUMET_API_URL } from '../../../../app/constants/api';
// import { AUTO_DETECT_TIMING } from '../../../../app/videoplayer/constants';
import { Episode, Source, Subtitle, WatchResponse } from './zorohianime';
import { getStreams as kjGetStreams, resolveAnimeId as kjResolve, getProvidersForEpisode as kjGetProviders, getEpisodes as kjGetEpisodes } from '../../../kuroji';

export class AnimePaheProvider {
  private baseUrl = `${CONSUMET_API_URL}`;
  private provider = 'animepahe';

  constructor() {
    console.log(`🟢 [ANIMEPAHE] Provider initialized with base URL: ${this.baseUrl}`);
  }

  /**
   * Search for anime using the AnimePahe provider
   */
  async searchAnime(query: string): Promise<any[]> {
    console.log(`\n🔍 [ANIMEPAHE SEARCH START] ===================`);
    console.log(`[ANIMEPAHE] 🔍 Searching for anime: "${query}"`);
    
    try {
      const searchUrl = `${this.baseUrl}/anime/animepahe/${encodeURIComponent(query)}`;
      console.log(`[ANIMEPAHE] 📡 Search URL: ${searchUrl}`);
      
      console.log(`[ANIMEPAHE] ⏱️ Making search request...`);
      const response = await axios.get(searchUrl);
      
      console.log(`[ANIMEPAHE] ✅ Search response received`);
      console.log(`[ANIMEPAHE] 📊 Response status: ${response.status}`);
      console.log(`[ANIMEPAHE] 📊 Response data structure:`, {
        hasResults: !!response.data.results,
        resultsCount: response.data.results?.length || 0,
        hasData: !!response.data,
        dataKeys: Object.keys(response.data || {}),
      });
      
      const results = response.data.results || [];
      
      console.log(`[ANIMEPAHE] 📋 Search results: ${results.length} found`);
      
      if (results.length > 0) {
        console.log(`[ANIMEPAHE] 📋 First few results:`);
        results.slice(0, 3).forEach((anime: any, index: number) => {
          console.log(`[ANIMEPAHE] 📝 Result ${index + 1}:`, {
            id: anime.id,
            title: anime.title,
            status: anime.status,
            totalEpisodes: anime.totalEpisodes,
            type: anime.type,
            hasImage: !!anime.image,
            releaseDate: anime.releaseDate
          });
        });
      } else {
        console.log(`[ANIMEPAHE] ❌ No search results found for "${query}"`);
      }
      
      console.log(`🔍 [ANIMEPAHE SEARCH END] ===================\n`);
      return results;
    } catch (error: any) {
      console.log(`🔍 [ANIMEPAHE SEARCH ERROR] ===================`);
      console.error('[ANIMEPAHE] ❌ Search error:', {
        query,
        errorMessage: error?.message,
        errorCode: error?.code,
        httpStatus: error?.response?.status,
        httpStatusText: error?.response?.statusText,
        responseData: error?.response?.data,
        stack: error?.stack?.split('\n').slice(0, 3).join('\n')
      });
      console.log(`🔍 [ANIMEPAHE SEARCH ERROR END] ===================\n`);
      throw new Error('Failed to search anime');
    }
  }

  /**
   * Get anime info by ID
   */
  async getAnimeInfo(id: string): Promise<any> {
    console.log(`\n📄 [ANIMEPAHE INFO START] ===================`);
    console.log(`[ANIMEPAHE] 📄 Getting anime info for ID: ${id}`);
    
    try {
      const infoUrl = `${this.baseUrl}/anime/animepahe/info/${id}`;
      console.log(`[ANIMEPAHE] 📡 Info URL: ${infoUrl}`);
      
      console.log(`[ANIMEPAHE] ⏱️ Making info request...`);
      const response = await axios.get(infoUrl);
      
      console.log(`[ANIMEPAHE] ✅ Info response received`);
      console.log(`[ANIMEPAHE] 📊 Response status: ${response.status}`);
      console.log(`[ANIMEPAHE] 📊 Anime info:`, {
        id: response.data.id,
        title: response.data.title,
        status: response.data.status,
        totalEpisodes: response.data.totalEpisodes,
        episodesCount: response.data.episodes?.length || 0,
        hasDescription: !!response.data.description,
        hasImage: !!response.data.image,
        genres: response.data.genres?.length || 0,
        releaseDate: response.data.releaseDate,
        dataKeys: Object.keys(response.data || {})
      });
      
      console.log(`📄 [ANIMEPAHE INFO END] ===================\n`);
      return response.data;
    } catch (error: any) {
      console.log(`📄 [ANIMEPAHE INFO ERROR] ===================`);
      console.error('[ANIMEPAHE] ❌ Info error:', {
        id,
        errorMessage: error?.message,
        errorCode: error?.code,
        httpStatus: error?.response?.status,
        httpStatusText: error?.response?.statusText,
        responseData: error?.response?.data,
        stack: error?.stack?.split('\n').slice(0, 3).join('\n')
      });
      console.log(`📄 [ANIMEPAHE INFO ERROR END] ===================\n`);
      throw new Error('Failed to get anime info');
    }
  }

  /**
   * Get episodes from AnimePahe
   */
  async getEpisodes(animeId: string): Promise<Episode[]> {
    // Use Kuroji as primary since TakiAPI/animepahe.ru is often down
    console.log(`\n📺 [ANIMEPAHE EPISODES START] ===================`);
    console.log(`[ANIMEPAHE] 📺 Getting episodes for anime ID: ${animeId}`);
    console.log(`[ANIMEPAHE] 🔄 Using Kuroji as primary source (TakiAPI/animepahe.ru is unreliable)`);
    
    try {
      const eps = await kjGetEpisodes(animeId);
      const episodes: Episode[] = eps.map((ep: any) => ({
        id: `animepahe-${ep.number}`,
        number: ep.number,
        title: ep.title,
        image: ep.thumb,
        description: undefined,
        duration: ep.duration,
        provider: 'AnimePahe',
        isSubbed: true,
        isDubbed: false,
        isFiller: false,
        isRecap: false,
        aired: ep.airDate,
      }));
      console.log(`[ANIMEPAHE] ✅ Processed ${episodes.length} episodes from Kuroji`);
      return episodes;
    } catch (kurojiErr) {
      console.log(`[ANIMEPAHE] ⚠️ Kuroji failed for ${animeId}, trying TakiAPI as fallback`, {
        error: (kurojiErr as any)?.message,
      });
      
      // Fallback to TakiAPI if Kuroji fails
      try {
        const episodesUrl = `${this.baseUrl}/anime/animepahe/info/${animeId}`;
        console.log(`[ANIMEPAHE] 📡 Episodes URL: ${episodesUrl}`);
        const response = await axios.get(episodesUrl);
        console.log(`[ANIMEPAHE] ✅ Episodes response received (status ${response.status})`);
        if (!response.data || !Array.isArray(response.data?.episodes)) {
          throw new Error('No episodes in TakiAPI response');
        }
        const episodes: Episode[] = response.data.episodes.map((ep: any) => ({
            id: ep.id,
            number: ep.number,
            title: ep.title,
            image: ep.image,
            description: ep.description,
            duration: ep.duration,
            provider: 'AnimePahe',
          isSubbed: true,
          isDubbed: false,
            isFiller: ep.isFiller,
            isRecap: ep.isRecap,
          aired: ep.aired,
        }));
        console.log(`[ANIMEPAHE] ✅ Processed ${episodes.length} episodes from TakiAPI fallback`);
        return episodes;
      } catch (takiErr) {
        console.log(`[ANIMEPAHE] ❌ Both Kuroji and TakiAPI failed`, {
          kurojiError: (kurojiErr as any)?.message,
          takiError: (takiErr as any)?.message,
        });
        throw new Error('Failed to get episodes from all sources');
      }
    }
  }

  /**
   * Get watch data for an episode by anime ID and episode number
   */
  async getWatchData(animeId: string, episodeNumber: number, isDub: boolean = false): Promise<WatchResponse> {
    // Use Kuroji as primary since TakiAPI/animepahe.ru is unreliable
    console.log(`[ANIMEPAHE] 🎬 Getting watch data for anime ${animeId} ep ${episodeNumber}`);
    console.log(`[ANIMEPAHE] 🔄 Using Kuroji as primary source`);
    
    try {
      const streams = await kjGetStreams(animeId, episodeNumber, 'animepahe', isDub);
      const sources: Source[] = streams.map((s) => ({
        url: s.url,
        quality: s.quality || 'auto',
        type: isDub ? 'dub' : 'sub',
        headers: s.headers || {},
        isM3U8: s.url.includes('.m3u8'),
      }));
      const subtitles: Subtitle[] = (streams[0]?.captions || []).map((c) => ({ url: c.url, lang: c.lang }));
      console.log(`[ANIMEPAHE] ✅ Kuroji provided ${sources.length} sources`);
      return { sources, subtitles, headers: {} };
    } catch (kurojiErr) {
      console.log(`[ANIMEPAHE] ⚠️ Kuroji watch failed for ${animeId} ep ${episodeNumber}, trying TakiAPI`, {
        error: (kurojiErr as any)?.message,
      });
      
      // Fallback to TakiAPI
      try {
        const watchUrl = `${this.baseUrl}/anime/animepahe/watch/${animeId}/episode-${episodeNumber}`;
        console.log(`[ANIMEPAHE] 📡 Watch URL: ${watchUrl}`);
        const response = await axios.get(watchUrl);
        if (!response.data) throw new Error('No watch data');
        const sources: Source[] = (response.data.sources || []).map((source: any) => ({
              url: source.url,
              quality: source.quality || 'default',
              type: isDub ? 'dub' : 'sub',
              headers: {
                ...response.data.headers,
                Referer: 'https://animepahe.com/',
                Origin: 'https://animepahe.com',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/98.0.4758.102 Safari/537.36',
          },
          isM3U8: (source.url || '').includes('.m3u8') || source.isM3U8,
        }));
        const subtitles: Subtitle[] = (response.data.subtitles || [])
          .filter((sub: any) => sub.url && sub.lang)
          .map((sub: any) => ({ url: sub.url, lang: sub.lang }));
        if (!sources.length) throw new Error('No sources in TakiAPI watch');
        console.log(`[ANIMEPAHE] ✅ TakiAPI provided ${sources.length} sources as fallback`);
        return { sources, subtitles, headers: response.data.headers || {} };
      } catch (takiErr) {
        console.log(`[ANIMEPAHE] ❌ Both Kuroji and TakiAPI watch failed`, {
          kurojiError: (kurojiErr as any)?.message,
          takiError: (takiErr as any)?.message,
        });
        throw new Error('Failed to get watch data from all sources');
      }
    }
  }

  /**
   * Get watch data for an episode by direct episode ID (legacy method)
   */
  async getWatchDataById(episodeId: string, isDub: boolean = false): Promise<WatchResponse> {
    console.log(`\n🎬 [ANIMEPAHE WATCH BY ID START] ===================`);
    console.log(`[ANIMEPAHE] 🎬 Getting watch data by ID: ${episodeId}, isDub: ${isDub}`);
    
    try {
      const watchUrl = `${this.baseUrl}/anime/animepahe/watch/${episodeId}`;
      console.log(`[ANIMEPAHE] 📡 Watch by ID URL: ${watchUrl}`);
      
      console.log(`[ANIMEPAHE] ⏱️ Making watch by ID request...`);
      const response = await axios.get(watchUrl);
      
      console.log(`[ANIMEPAHE] ✅ Watch by ID response received`);
      console.log(`[ANIMEPAHE] 📊 Response status: ${response.status}`);
      console.log(`[ANIMEPAHE] 📊 Response data structure:`, {
        hasData: !!response.data,
        hasSources: !!response.data?.sources,
        sourcesCount: response.data?.sources?.length || 0,
        hasSubtitles: !!response.data?.subtitles,
        subtitlesCount: response.data?.subtitles?.length || 0,
        hasHeaders: !!response.data?.headers,
        hasIntro: !!response.data?.intro,
        hasOutro: !!response.data?.outro,
        dataKeys: Object.keys(response.data || {})
      });
      
      if (!response.data) {
        console.log(`[ANIMEPAHE] ❌ No watch data available for ID: ${episodeId}`);
        throw new Error('No watch data available');
      }

      // Format sources
      const sources: Source[] = (response.data.sources || [])
        .map((source: any, index: number) => {
          const formattedSource = {
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
          };
          
          console.log(`[ANIMEPAHE] 📝 Source ${index + 1}:`, {
            quality: formattedSource.quality,
            type: formattedSource.type,
            isM3U8: formattedSource.isM3U8,
            hasUrl: !!formattedSource.url,
            urlPreview: formattedSource.url?.substring(0, 50) + '...',
            hasHeaders: !!formattedSource.headers
          });
          
          return formattedSource;
        });

      // AnimePahe typically doesn't provide separate subtitle files as they're embedded
      const subtitles: Subtitle[] = (response.data.subtitles || [])
        .filter((sub: any) => sub.url && sub.lang)
        .map((sub: any, index: number) => {
          const subtitle = {
            url: sub.url,
            lang: sub.lang
          };
          
          console.log(`[ANIMEPAHE] 📝 Subtitle ${index + 1}:`, {
            lang: subtitle.lang,
            hasUrl: !!subtitle.url,
            urlPreview: subtitle.url?.substring(0, 50) + '...'
          });
          
          return subtitle;
        });

      console.log(`[ANIMEPAHE] ✅ Successfully processed watch data by ID`);
      console.log(`[ANIMEPAHE] 📊 Watch data summary:`, {
        sourcesCount: sources.length,
        subtitlesCount: subtitles.length,
        hasIntro: !!response.data.intro,
        hasOutro: !!response.data.outro,
        intro: response.data.intro,
        outro: response.data.outro,
        hasHeaders: !!response.data.headers
      });

      console.log(`🎬 [ANIMEPAHE WATCH BY ID END] ===================\n`);
      return {
        sources,
        subtitles,
        intro: response.data.intro,
        outro: response.data.outro,
        headers: response.data.headers
      };
    } catch (error: any) {
      console.log(`🎬 [ANIMEPAHE WATCH BY ID ERROR] ===================`);
      console.error('[ANIMEPAHE] ❌ Watch data error:', {
        episodeId,
        isDub,
        errorMessage: error?.message,
        errorCode: error?.code,
        httpStatus: error?.response?.status,
        httpStatusText: error?.response?.statusText,
        responseData: error?.response?.data,
        stack: error?.stack?.split('\n').slice(0, 3).join('\n')
      });
      console.log(`🎬 [ANIMEPAHE WATCH BY ID ERROR END] ===================\n`);
      throw new Error('Failed to get watch data');
    }
  }

  /**
   * Search for anime by title and get episodes
   */
  async searchAndGetEpisodes(animeTitle: string, episodeNumber?: number): Promise<Episode[]> {
    console.log(`\n🔍📺 [ANIMEPAHE SEARCH & EPISODES START] ===================`);
    console.log(`[ANIMEPAHE] 🔍📺 Searching and getting episodes for: "${animeTitle}"${episodeNumber ? `, episode: ${episodeNumber}` : ''}`);
    
    try {
      console.log(`[ANIMEPAHE] 🔍 Step 1: Searching for anime...`);
      const searchResults = await this.searchAnime(animeTitle);
      
      if (!searchResults.length) {
        console.log('[ANIMEPAHE] ❌ No search results found');
        console.log(`🔍📺 [ANIMEPAHE SEARCH & EPISODES END] ===================\n`);
        return [];
      }

      console.log(`[ANIMEPAHE] 🎯 Step 2: Finding best match from ${searchResults.length} results...`);
      
      // Find the best match
      const exactMatch = searchResults.find((anime: any) => 
        anime.title.toLowerCase().trim() === animeTitle.toLowerCase().trim()
      );
      
      const selectedAnime = exactMatch || searchResults[0];
      console.log(`[ANIMEPAHE] ✅ Selected anime: "${selectedAnime.title}" (ID: ${selectedAnime.id})`);
      console.log(`[ANIMEPAHE] 📊 Match info:`, {
        isExactMatch: !!exactMatch,
        selectedTitle: selectedAnime.title,
        selectedId: selectedAnime.id,
        totalEpisodes: selectedAnime.totalEpisodes,
        status: selectedAnime.status
      });

      console.log(`[ANIMEPAHE] 📺 Step 3: Getting episodes for selected anime...`);
      const episodes = await this.getEpisodes(selectedAnime.id);
      
      console.log(`[ANIMEPAHE] 📊 Got ${episodes.length} episodes from AnimePahe`);
      
      // If looking for a specific episode, filter it
      if (episodeNumber) {
        console.log(`[ANIMEPAHE] 🔍 Step 4: Filtering for episode ${episodeNumber}...`);
        const filteredEpisodes = episodes.filter(ep => ep.number === episodeNumber);
        console.log(`[ANIMEPAHE] 📊 Filtered to ${filteredEpisodes.length} episodes`);
        
        if (filteredEpisodes.length > 0) {
          console.log(`[ANIMEPAHE] ✅ Found episode ${episodeNumber}:`, {
            id: filteredEpisodes[0].id,
            number: filteredEpisodes[0].number,
            title: filteredEpisodes[0].title,
            isSubbed: filteredEpisodes[0].isSubbed,
            isDubbed: filteredEpisodes[0].isDubbed
          });
        } else {
          console.log(`[ANIMEPAHE] ❌ Episode ${episodeNumber} not found`);
        }
        
        console.log(`🔍📺 [ANIMEPAHE SEARCH & EPISODES END] ===================\n`);
        return filteredEpisodes;
      }
      
      console.log(`[ANIMEPAHE] ✅ Returning all ${episodes.length} episodes`);
      console.log(`🔍📺 [ANIMEPAHE SEARCH & EPISODES END] ===================\n`);
      return episodes;
    } catch (error: any) {
      console.log(`🔍📺 [ANIMEPAHE SEARCH & EPISODES ERROR] ===================`);
      console.error('[ANIMEPAHE] ❌ Search and get episodes error:', {
        animeTitle,
        episodeNumber,
        errorMessage: error?.message,
        errorCode: error?.code,
        httpStatus: error?.response?.status,
        httpStatusText: error?.response?.statusText,
        responseData: error?.response?.data,
        stack: error?.stack?.split('\n').slice(0, 3).join('\n')
      });
      console.log(`🔍📺 [ANIMEPAHE SEARCH & EPISODES ERROR END] ===================\n`);
      return [];
    }
  }

  /**
   * Check if a specific episode is available
   * AnimePahe only provides SUB content, no DUB
   */
  async checkEpisodeAvailability(animeIdentifier: string, episodeNumber: number): Promise<{ sub: boolean; dub: boolean }> {
    // Resolve ID, ask providers endpoint, then treat animepahe availability
    let id = animeIdentifier;
    if (!/^[0-9]+$/.test(animeIdentifier)) {
      const resolved = await kjResolve({ title: animeIdentifier });
      if (!resolved) return { sub: false, dub: false };
      id = resolved;
    }
    const providers = await kjGetProviders(id, episodeNumber);
    const available = providers.available || [];
    const hasPahe = available.includes('animepahe');
    return { sub: hasPahe, dub: false };
  }

  /**
   * Get episode by anime title and episode number
   */
  async getEpisodeByTitle(animeTitle: string, episodeNumber: number): Promise<Episode | null> {
    console.log(`\n🔍📺 [ANIMEPAHE GET EPISODE START] ===================`);
    console.log(`[ANIMEPAHE] 🔍📺 Getting episode by title: "${animeTitle}" episode ${episodeNumber}`);
    
    try {
      const episodes = await this.searchAndGetEpisodes(animeTitle, episodeNumber);
      const episode = episodes.length > 0 ? episodes[0] : null;
      
      if (episode) {
        console.log(`[ANIMEPAHE] ✅ Found episode:`, {
          id: episode.id,
          number: episode.number,
          title: episode.title,
          isSubbed: episode.isSubbed,
          isDubbed: episode.isDubbed,
          provider: episode.provider
        });
      } else {
        console.log(`[ANIMEPAHE] ❌ Episode not found`);
      }
      
      console.log(`🔍📺 [ANIMEPAHE GET EPISODE END] ===================\n`);
      return episode;
    } catch (error: any) {
      console.log(`🔍📺 [ANIMEPAHE GET EPISODE ERROR] ===================`);
      console.error('[ANIMEPAHE] ❌ Get episode by title error:', {
        animeTitle,
        episodeNumber,
        errorMessage: error?.message,
        errorCode: error?.code,
        httpStatus: error?.response?.status,
        httpStatusText: error?.response?.statusText,
        responseData: error?.response?.data,
        stack: error?.stack?.split('\n').slice(0, 3).join('\n')
      });
      console.log(`🔍📺 [ANIMEPAHE GET EPISODE ERROR END] ===================\n`);
      return null;
    }
  }

  /**
   * Get AnimePahe anime ID by searching for the anime title
   * Note: This actually returns the AniList ID which Kuroji uses internally
   */
  async getAnimeIdByTitle(animeTitle: string): Promise<string | null> {
    // Use Kuroji resolver as primary since TakiAPI is unreliable
    console.log(`[ANIMEPAHE] 🔍 Getting anime ID for: "${animeTitle}"`);
    console.log(`[ANIMEPAHE] 🔄 Using Kuroji resolver as primary source`);
    
    try {
      // Try to resolve by title using Kuroji
      const id = await kjResolve({ title: animeTitle });
      if (id) {
        console.log(`[ANIMEPAHE] ✅ Kuroji resolved AniList ID: ${id}`);
        return id;
      }
    } catch (err) {
      console.log('[ANIMEPAHE] ⚠️ Kuroji resolver failed, will try TakiAPI search', {
        error: (err as any)?.message,
      });
    }
    
    // Fallback to TakiAPI search
    try {
      const searchResults = await this.searchAnime(animeTitle);
      if (searchResults && searchResults.length > 0) {
        const exact = searchResults.find((a: any) => (a.title || '').toLowerCase().trim() === animeTitle.toLowerCase().trim());
        const foundId = (exact?.id || searchResults[0].id)?.toString?.() || null;
        if (foundId) {
          console.log(`[ANIMEPAHE] ✅ TakiAPI search found ID: ${foundId}`);
        }
        return foundId;
      }
    } catch (err) {
      console.log('[ANIMEPAHE] ❌ Both Kuroji and TakiAPI failed to find anime ID', {
        error: (err as any)?.message,
      });
    }
    
    return null;
  }
  
  /**
   * Get AnimePahe anime ID by AniList ID
   * When we have an AniList ID, we can use it directly with Kuroji
   */
  async getAnimeIdByAnilistId(anilistId: string | number): Promise<string | null> {
    console.log(`[ANIMEPAHE] 🔍 Resolving by AniList ID: ${anilistId}`);
    console.log(`[ANIMEPAHE] 🔄 Using Kuroji resolver with AniList ID`);
    
    try {
      // Kuroji accepts AniList IDs directly
      const id = await kjResolve({ anilistId });
      if (id) {
        console.log(`[ANIMEPAHE] ✅ Kuroji confirmed AniList ID: ${id}`);
        return id;
      }
    } catch (err) {
      console.log('[ANIMEPAHE] ❌ Kuroji resolver failed for AniList ID', {
        anilistId,
        error: (err as any)?.message,
      });
    }
    
    // Return the AniList ID itself as fallback since Kuroji uses AniList IDs
    return String(anilistId);
  }

  /**
   * Merge AnimePahe episodes with existing episodes
   */
  mergeWithExistingEpisodes(existingEpisodes: Episode[], animePaheEpisodes: Episode[]): Episode[] {
    console.log(`\n🔄 [ANIMEPAHE MERGE START] ===================`);
    console.log(`[ANIMEPAHE] 🔄 Merging episodes - Existing: ${existingEpisodes.length}, AnimePahe: ${animePaheEpisodes.length}`);
    
    const episodeMap = new Map<number, Episode>();
    
    // Add existing episodes first
    console.log(`[ANIMEPAHE] 📥 Step 1: Adding existing episodes...`);
    existingEpisodes.forEach((ep, index) => {
      episodeMap.set(ep.number, ep);
      if (index < 3) {
        console.log(`[ANIMEPAHE] 📝 Existing episode ${index + 1}:`, {
          number: ep.number,
          title: ep.title,
          provider: ep.provider,
          isSubbed: ep.isSubbed,
          isDubbed: ep.isDubbed
        });
      }
    });
    
    // Add AnimePahe episodes as alternatives or fill gaps
    console.log(`[ANIMEPAHE] 📥 Step 2: Adding AnimePahe episodes...`);
    let newEpisodes = 0;
    let updatedEpisodes = 0;
    
    animePaheEpisodes.forEach((ep, index) => {
      const existing = episodeMap.get(ep.number);
      if (!existing) {
        // Add new episode
        episodeMap.set(ep.number, ep);
        newEpisodes++;
        if (index < 3) {
          console.log(`[ANIMEPAHE] ✅ New episode ${ep.number}:`, {
            number: ep.number,
            title: ep.title,
            provider: ep.provider,
            isSubbed: ep.isSubbed,
            isDubbed: ep.isDubbed
          });
        }
      } else {
        // Update existing episode to indicate AnimePahe availability
        const updatedEpisode = {
          ...existing,
          provider: existing.provider ? `${existing.provider}, AnimePahe` : 'AnimePahe'
        };
        episodeMap.set(ep.number, updatedEpisode);
        updatedEpisodes++;
        if (index < 3) {
          console.log(`[ANIMEPAHE] 🔄 Updated episode ${ep.number}:`, {
            number: ep.number,
            oldProvider: existing.provider,
            newProvider: updatedEpisode.provider
          });
        }
      }
    });
    
    const result = Array.from(episodeMap.values()).sort((a, b) => a.number - b.number);
    
    console.log(`[ANIMEPAHE] 📊 Merge summary:`, {
      originalExisting: existingEpisodes.length,
      originalAnimePahe: animePaheEpisodes.length,
      newEpisodes,
      updatedEpisodes,
      finalTotal: result.length,
      episodeNumbers: result.slice(0, 10).map(ep => ep.number)
    });
    
    console.log(`🔄 [ANIMEPAHE MERGE END] ===================\n`);
    return result;
  }
}

// Export a singleton instance
export const animePaheProvider = new AnimePaheProvider();
