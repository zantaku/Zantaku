import axios from 'axios';
import { CONSUMET_API_URL } from '../../../../app/constants/api';
import { AUTO_DETECT_TIMING } from '../../../../app/videoplayer/constants';
import { Episode, Source, Subtitle, VideoTimings, WatchResponse } from './zorohianime';

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
    console.log(`\n📺 [ANIMEPAHE EPISODES START] ===================`);
    console.log(`[ANIMEPAHE] 📺 Getting episodes for anime ID: ${animeId}`);
    
    try {
      const episodesUrl = `${this.baseUrl}/anime/animepahe/info/${animeId}`;
      console.log(`[ANIMEPAHE] 📡 Episodes URL: ${episodesUrl}`);
      
      console.log(`[ANIMEPAHE] ⏱️ Making episodes request...`);
      const response = await axios.get(episodesUrl);
      
      console.log(`[ANIMEPAHE] ✅ Episodes response received`);
      console.log(`[ANIMEPAHE] 📊 Response status: ${response.status}`);
      console.log(`[ANIMEPAHE] 📊 Response data structure:`, {
        hasData: !!response.data,
        hasEpisodes: !!response.data?.episodes,
        episodesCount: response.data?.episodes?.length || 0,
        dataKeys: Object.keys(response.data || {})
      });
      
      if (!response.data || !response.data.episodes) {
        console.log('[ANIMEPAHE] ❌ No episodes found in response');
        console.log(`📺 [ANIMEPAHE EPISODES END] ===================\n`);
        return [];
      }

      const episodes = response.data.episodes.map((ep: any, index: number) => {
        const episode = {
          id: ep.id,
          number: ep.number,
          title: ep.title,
          image: ep.image,
          description: ep.description,
          duration: ep.duration,
          provider: 'AnimePahe',
          isSubbed: true, // AnimePahe provides subbed content
          isDubbed: false, // AnimePahe does NOT provide dubbed content
          isFiller: ep.isFiller,
          isRecap: ep.isRecap,
          aired: ep.aired
        };
        
        if (index < 3) { // Log first 3 episodes
          console.log(`[ANIMEPAHE] 📝 Episode ${index + 1}:`, {
            id: episode.id,
            number: episode.number,
            title: episode.title,
            hasImage: !!episode.image,
            hasDuration: !!episode.duration,
            isSubbed: episode.isSubbed,
            isDubbed: episode.isDubbed,
            aired: episode.aired
          });
        }
        
        return episode;
      });

      console.log(`[ANIMEPAHE] ✅ Successfully processed ${episodes.length} episodes`);
      console.log(`[ANIMEPAHE] 📊 Episodes summary:`, {
        totalEpisodes: episodes.length,
        firstEpisode: episodes[0]?.number,
        lastEpisode: episodes[episodes.length - 1]?.number,
        allSubbed: episodes.every((ep: Episode) => ep.isSubbed),
        noneSubbed: episodes.every((ep: Episode) => !ep.isSubbed),
        allDubbed: episodes.every((ep: Episode) => ep.isDubbed),
        noneDubbed: episodes.every((ep: Episode) => !ep.isDubbed),
        episodesWithImages: episodes.filter((ep: Episode) => ep.image).length,
        episodesWithTitles: episodes.filter((ep: Episode) => ep.title).length
      });
      
      console.log(`📺 [ANIMEPAHE EPISODES END] ===================\n`);
      return episodes;
    } catch (error: any) {
      console.log(`📺 [ANIMEPAHE EPISODES ERROR] ===================`);
      console.error('[ANIMEPAHE] ❌ Episodes error:', {
        animeId,
        errorMessage: error?.message,
        errorCode: error?.code,
        httpStatus: error?.response?.status,
        httpStatusText: error?.response?.statusText,
        responseData: error?.response?.data,
        stack: error?.stack?.split('\n').slice(0, 3).join('\n')
      });
      console.log(`📺 [ANIMEPAHE EPISODES ERROR END] ===================\n`);
      return [];
    }
  }

  /**
   * Get watch data for an episode by anime ID and episode number
   */
  async getWatchData(animeId: string, episodeNumber: number, isDub: boolean = false): Promise<WatchResponse> {
    console.log(`\n🎬 [ANIMEPAHE WATCH START] ===================`);
    console.log(`[ANIMEPAHE] 🎬 Getting watch data for anime: ${animeId}, episode: ${episodeNumber}, isDub: ${isDub}`);
    
    try {
      const watchUrl = `${this.baseUrl}/anime/animepahe/watch/${animeId}/episode-${episodeNumber}`;
      console.log(`[ANIMEPAHE] 📡 Watch URL: ${watchUrl}`);
      
      console.log(`[ANIMEPAHE] ⏱️ Making watch request...`);
      const response = await axios.get(watchUrl);
      
      console.log(`[ANIMEPAHE] ✅ Watch response received`);
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
        console.log(`[ANIMEPAHE] ❌ No watch data available`);
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

      console.log(`[ANIMEPAHE] ✅ Successfully processed watch data`);
      console.log(`[ANIMEPAHE] 📊 Watch data summary:`, {
        sourcesCount: sources.length,
        subtitlesCount: subtitles.length,
        hasIntro: !!response.data.intro,
        hasOutro: !!response.data.outro,
        intro: response.data.intro,
        outro: response.data.outro,
        hasHeaders: !!response.data.headers
      });

      console.log(`🎬 [ANIMEPAHE WATCH END] ===================\n`);
      return {
        sources,
        subtitles,
        intro: response.data.intro,
        outro: response.data.outro,
        headers: response.data.headers
      };
    } catch (error: any) {
      console.log(`🎬 [ANIMEPAHE WATCH ERROR] ===================`);
      console.error('[ANIMEPAHE] ❌ Watch data error:', {
        animeId,
        episodeNumber,
        isDub,
        errorMessage: error?.message,
        errorCode: error?.code,
        httpStatus: error?.response?.status,
        httpStatusText: error?.response?.statusText,
        responseData: error?.response?.data,
        stack: error?.stack?.split('\n').slice(0, 3).join('\n')
      });
      console.log(`🎬 [ANIMEPAHE WATCH ERROR END] ===================\n`);
      throw new Error('Failed to get watch data');
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
  async checkEpisodeAvailability(animeTitle: string, episodeNumber: number): Promise<{ sub: boolean; dub: boolean }> {
    console.log(`\n🔍✅ [ANIMEPAHE AVAILABILITY START] ===================`);
    console.log(`[ANIMEPAHE] 🔍✅ Checking availability for "${animeTitle}" episode ${episodeNumber}`);
    
    try {
      console.log(`[ANIMEPAHE] 🔍 Step 1: Searching for episodes...`);
      const episodes = await this.searchAndGetEpisodes(animeTitle, episodeNumber);
      const hasEpisode = episodes.length > 0;
      
      const availability = { 
        sub: hasEpisode,  // AnimePahe provides SUB if episode exists
        dub: false        // AnimePahe never provides DUB
      };
      
      console.log(`[ANIMEPAHE] 📊 Availability result:`, {
        animeTitle,
        episodeNumber,
        episodesFound: episodes.length,
        sub: availability.sub,
        dub: availability.dub,
        hasEpisode
      });
      
      if (hasEpisode) {
        console.log(`[ANIMEPAHE] ✅ Episode ${episodeNumber} is available (SUB only)`);
      } else {
        console.log(`[ANIMEPAHE] ❌ Episode ${episodeNumber} is not available`);
      }
      
      console.log(`🔍✅ [ANIMEPAHE AVAILABILITY END] ===================\n`);
      return availability;
    } catch (error: any) {
      console.log(`🔍✅ [ANIMEPAHE AVAILABILITY ERROR] ===================`);
      console.error('[ANIMEPAHE] ❌ Availability check error:', {
        animeTitle,
        episodeNumber,
        errorMessage: error?.message,
        errorCode: error?.code,
        httpStatus: error?.response?.status,
        httpStatusText: error?.response?.statusText,
        responseData: error?.response?.data,
        stack: error?.stack?.split('\n').slice(0, 3).join('\n')
      });
      console.log(`🔍✅ [ANIMEPAHE AVAILABILITY ERROR END] ===================\n`);
      return { sub: false, dub: false };
    }
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
   */
  async getAnimeIdByTitle(animeTitle: string): Promise<string | null> {
    console.log(`\n🔍🆔 [ANIMEPAHE GET ID START] ===================`);
    console.log(`[ANIMEPAHE] 🔍🆔 Getting anime ID for: "${animeTitle}"`);
    
    try {
      console.log(`[ANIMEPAHE] 🔍 Step 1: Searching for anime...`);
      const searchResults = await this.searchAnime(animeTitle);
      
      if (!searchResults.length) {
        console.log('[ANIMEPAHE] ❌ No search results found');
        console.log(`🔍🆔 [ANIMEPAHE GET ID END] ===================\n`);
        return null;
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

      console.log(`🔍🆔 [ANIMEPAHE GET ID END] ===================\n`);
      return selectedAnime.id;
    } catch (error: any) {
      console.log(`🔍🆔 [ANIMEPAHE GET ID ERROR] ===================`);
      console.error('[ANIMEPAHE] ❌ Get anime ID error:', {
        animeTitle,
        errorMessage: error?.message,
        errorCode: error?.code,
        httpStatus: error?.response?.status,
        httpStatusText: error?.response?.statusText,
        responseData: error?.response?.data,
        stack: error?.stack?.split('\n').slice(0, 3).join('\n')
      });
      console.log(`🔍🆔 [ANIMEPAHE GET ID ERROR END] ===================\n`);
      return null;
    }
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
