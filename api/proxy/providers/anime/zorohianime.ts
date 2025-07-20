import axios from 'axios';
import { CONSUMET_API_URL } from '../../../../app/constants/api';
import { AUTO_DETECT_TIMING } from '../../../../app/videoplayer/constants';

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

export interface ServerInfo {
  id: string;
  serverId: string;
  type: 'sub' | 'dub';
  name: string;
}

export class ZoroHiAnimeProvider {
  private baseUrl = `${CONSUMET_API_URL}`;
  private provider = 'zoro';
  private takiApiUrl = 'https://takiapi.xyz';
  private hianimeUrl = 'https://hianime.to';
  private sourceParserUrl = 'http://yesgogogototheapi.xyz/proxy?url=';
  private proxyUrl = 'http://yesgogogototheapi.xyz/proxy?url=';
  private videoProxyUrl = 'http://yesgogogototheapi.xyz/proxy/';

  constructor() {
    console.log(`🟢 [ZORO] Provider initialized with URLs:`);
    console.log(`[ZORO] Base URL: ${this.baseUrl}`);
    console.log(`[ZORO] TakiAPI URL: ${this.takiApiUrl}`);
    console.log(`[ZORO] HiAnime URL: ${this.hianimeUrl}`);
    console.log(`[ZORO] Source Parser URL: ${this.sourceParserUrl}`);
    console.log(`[ZORO] Proxy URL: ${this.proxyUrl}`);
    console.log(`[ZORO] Video Proxy URL: ${this.videoProxyUrl}`);
  }

  /**
   * Proxy a URL through the proxy service (for API calls)
   */
  private proxyRequest(url: string): string {
    const proxiedUrl = `${this.proxyUrl}${encodeURIComponent(url)}`;
    console.log(`[ZORO] 🔄 Proxying request: ${url.substring(0, 80)}... -> ${proxiedUrl.substring(0, 80)}...`);
    return proxiedUrl;
  }

  /**
   * Proxy a video URL through the video proxy service (for streaming)
   */
  private proxyVideoUrl(url: string): string {
    const proxiedUrl = `${this.videoProxyUrl}${url}`;
    console.log(`[ZORO] 🔄 Proxying video URL: ${url.substring(0, 80)}... -> ${proxiedUrl.substring(0, 80)}...`);
    return proxiedUrl;
  }

  /**
   * Search for anime using direct TakiAPI Zoro endpoint (more reliable than Consumet)
   */
  async searchAnime(query: string): Promise<any[]> {
    console.log(`\n🔍 [ZORO SEARCH START] ===================`);
    console.log(`[ZORO] 🔍 Searching for anime: "${query}"`);
    console.log(`[ZORO] 🔄 Using direct TakiAPI search (more reliable)`);
    
    try {
      const searchUrl = `${this.takiApiUrl}/anime/zoro/${encodeURIComponent(query)}`;
      const proxiedUrl = this.proxyRequest(searchUrl);
      console.log(`[ZORO] 📡 Search URL: ${searchUrl}`);
      console.log(`[ZORO] 📡 Proxied URL: ${proxiedUrl.substring(0, 100)}...`);
      
      console.log(`[ZORO] ⏱️ Making search request...`);
      const response = await axios.get(proxiedUrl);
      
      console.log(`[ZORO] ✅ Search response received`);
      console.log(`[ZORO] 📊 Response status: ${response.status}`);
      console.log(`[ZORO] 📊 Response data structure:`, {
        hasResults: !!response.data.results,
        resultsCount: response.data.results?.length || 0,
        hasData: !!response.data,
        dataKeys: Object.keys(response.data || {}),
        statusCode: response.status,
        isArray: Array.isArray(response.data),
        directResults: Array.isArray(response.data) ? response.data.length : 0
      });
      
      // TakiAPI might return results directly or in a results property
      let results = [];
      if (Array.isArray(response.data)) {
        results = response.data;
        console.log(`[ZORO] 📋 Using direct array results: ${results.length} found`);
      } else if (response.data.results && Array.isArray(response.data.results)) {
        results = response.data.results;
        console.log(`[ZORO] 📋 Using results property: ${results.length} found`);
      } else {
        console.log(`[ZORO] ❌ Unexpected response format, no results found`);
        results = [];
      }
      
      if (results.length > 0) {
        console.log(`[ZORO] 📋 First few search results:`);
        results.slice(0, 3).forEach((anime: any, index: number) => {
          console.log(`[ZORO] 📝 Result ${index + 1}:`, {
            id: anime.id,
            title: anime.title,
            status: anime.status,
            totalEpisodes: anime.totalEpisodes,
            type: anime.type,
            hasImage: !!anime.image,
            releaseDate: anime.releaseDate,
            subOrDub: anime.subOrDub,
            url: anime.url
          });
        });
      } else {
        console.log(`[ZORO] ❌ No search results found for "${query}"`);
      }
      
      console.log(`🔍 [ZORO SEARCH END] ===================\n`);
      return results;
    } catch (error: any) {
      console.log(`🔍 [ZORO SEARCH ERROR] ===================`);
      console.error('[ZORO] ❌ Search error:', {
        query,
        errorMessage: error?.message,
        errorCode: error?.code,
        httpStatus: error?.response?.status,
        httpStatusText: error?.response?.statusText,
        responseData: error?.response?.data,
        stack: error?.stack?.split('\n').slice(0, 3).join('\n')
      });
      console.log(`🔍 [ZORO SEARCH ERROR END] ===================\n`);
      throw new Error('Failed to search anime');
    }
  }

  /**
   * Get anime info by ID from TakiAPI
   */
  async getAnimeInfo(id: string): Promise<any> {
    console.log(`\n📄 [ZORO INFO START] ===================`);
    console.log(`[ZORO] 📄 Getting anime info for ID: ${id}`);
    
    try {
      const infoUrl = `${this.takiApiUrl}/anime/zoro/info?id=${id}`;
      const proxiedUrl = this.proxyRequest(infoUrl);
      console.log(`[ZORO] 📡 Info URL: ${infoUrl}`);
      console.log(`[ZORO] 📡 Proxied URL: ${proxiedUrl.substring(0, 100)}...`);
      
      console.log(`[ZORO] ⏱️ Making info request...`);
      const response = await axios.get(proxiedUrl);
      
      console.log(`[ZORO] ✅ Info response received`);
      console.log(`[ZORO] 📊 Response status: ${response.status}`);
      console.log(`[ZORO] 📊 Anime info:`, {
        id: response.data.id,
        title: response.data.title,
        status: response.data.status,
        totalEpisodes: response.data.totalEpisodes,
        episodesCount: response.data.episodes?.length || 0,
        hasDescription: !!response.data.description,
        hasImage: !!response.data.image,
        genres: response.data.genres?.length || 0,
        releaseDate: response.data.releaseDate,
        subOrDub: response.data.subOrDub,
        dataKeys: Object.keys(response.data || {})
      });
      
      console.log(`📄 [ZORO INFO END] ===================\n`);
      return response.data;
    } catch (error: any) {
      console.log(`📄 [ZORO INFO ERROR] ===================`);
      console.error('[ZORO] ❌ Info error:', {
        id,
        errorMessage: error?.message,
        errorCode: error?.code,
        httpStatus: error?.response?.status,
        httpStatusText: error?.response?.statusText,
        responseData: error?.response?.data,
        stack: error?.stack?.split('\n').slice(0, 3).join('\n')
      });
      console.log(`📄 [ZORO INFO ERROR END] ===================\n`);
      throw new Error('Failed to get anime info');
    }
  }

  /**
   * Get episodes using direct Zoro search + info method (more reliable sub/dub data)
   */
  async getEpisodes(animeTitle: string, isDub: boolean = false): Promise<Episode[]> {
    console.log(`\n📺 [ZORO EPISODES START] ===================`);
    console.log(`[ZORO] 📺 Getting episodes for anime title: "${animeTitle}", isDub: ${isDub}`);
    console.log(`[ZORO] 🔄 Using new reliable method: search + info (instead of AniList meta)`);
    
    try {
      // Step 1: Search for anime by title
      console.log(`[ZORO] 🔍 Step 1: Searching for anime...`);
      const searchResults = await this.searchAnime(animeTitle);
      
      if (!searchResults || searchResults.length === 0) {
        console.log(`[ZORO] ❌ No search results found for: "${animeTitle}"`);
        console.log(`📺 [ZORO EPISODES END] ===================\n`);
        return [];
      }
      
      // Get the first/best match (could add more sophisticated matching later)
      const bestMatch = searchResults[0];
      console.log(`[ZORO] ✅ Found anime match:`, {
        id: bestMatch.id,
        title: bestMatch.title,
        status: bestMatch.status,
        totalEpisodes: bestMatch.totalEpisodes,
        type: bestMatch.type,
        subOrDub: bestMatch.subOrDub
      });
      
      // Step 2: Get full anime info with proper episode data
      console.log(`[ZORO] 📄 Step 2: Getting full anime info for ID: ${bestMatch.id}...`);
      const animeInfo = await this.getAnimeInfo(bestMatch.id);
      
      if (!animeInfo || !animeInfo.episodes || animeInfo.episodes.length === 0) {
        console.log(`[ZORO] ❌ No episodes found in anime info for ID: ${bestMatch.id}`);
        console.log(`📺 [ZORO EPISODES END] ===================\n`);
        return [];
      }
      
      console.log(`[ZORO] ✅ Raw episodes data received:`, {
        episodesCount: animeInfo.episodes.length,
        animeId: animeInfo.id,
        animeTitle: animeInfo.title,
        hasEpisodes: !!animeInfo.episodes,
        episodesType: typeof animeInfo.episodes,
        isArray: Array.isArray(animeInfo.episodes)
      });
      
      // Step 3: Process episodes with proper sub/dub flags
      const episodes = animeInfo.episodes.map((ep: any, index: number) => {
        const episode = {
          id: ep.id,
          number: ep.number,
          title: ep.title,
          image: ep.image,
          description: ep.description,
          duration: ep.duration,
          provider: 'Zoro/HiAnime',
          // Use the more reliable sub/dub flags from the info endpoint
          isSubbed: ep.isSubbed ?? ep.subbed ?? true, // fallback to true for subbed
          isDubbed: ep.isDubbed ?? ep.dubbed ?? false, // fallback to false for dubbed
          isFiller: ep.isFiller,
          isRecap: ep.isRecap,
          aired: ep.aired
        };
        
        if (index < 3) { // Log first 3 episodes
          console.log(`[ZORO] 📝 Episode ${index + 1} - Raw API data:`, {
            id: ep.id,
            number: ep.number,
            title: ep.title,
            rawIsSubbed: ep.isSubbed,
            rawIsDubbed: ep.isDubbed,
            rawSubbed: ep.subbed,
            rawDubbed: ep.dubbed,
            isFiller: ep.isFiller
          });
          console.log(`[ZORO] 📝 Episode ${index + 1} - Parsed data:`, {
            id: episode.id,
            number: episode.number,
            title: episode.title,
            hasImage: !!episode.image,
            hasDuration: !!episode.duration,
            isSubbed: episode.isSubbed,
            isDubbed: episode.isDubbed,
            aired: episode.aired,
            provider: episode.provider
          });
        }
        
        return episode;
      });

      console.log(`[ZORO] ✅ Successfully processed ${episodes.length} episodes using search+info method`);
      console.log(`[ZORO] 📊 Episodes summary:`, {
        totalEpisodes: episodes.length,
        firstEpisode: episodes[0]?.number,
        lastEpisode: episodes[episodes.length - 1]?.number,
        subbedEpisodes: episodes.filter((ep: Episode) => ep.isSubbed).length,
        dubbedEpisodes: episodes.filter((ep: Episode) => ep.isDubbed).length,
        allSubbed: episodes.every((ep: Episode) => ep.isSubbed),
        noneSubbed: episodes.every((ep: Episode) => !ep.isSubbed),
        allDubbed: episodes.every((ep: Episode) => ep.isDubbed),
        noneDubbed: episodes.every((ep: Episode) => !ep.isDubbed),
        episodesWithImages: episodes.filter((ep: Episode) => ep.image).length,
        episodesWithTitles: episodes.filter((ep: Episode) => ep.title).length,
        episodesWithBothAudio: episodes.filter((ep: Episode) => ep.isSubbed && ep.isDubbed).length,
        episodesWithNoAudio: episodes.filter((ep: Episode) => !ep.isSubbed && !ep.isDubbed).length,
        requestedType: isDub ? 'DUB' : 'SUB',
        searchMethod: 'direct_zoro_search_and_info'
      });
      
      console.log(`📺 [ZORO EPISODES END] ===================\n`);
      return episodes;
    } catch (error: any) {
      console.log(`📺 [ZORO EPISODES ERROR] ===================`);
      console.error('[ZORO] ❌ Episodes error:', {
        animeTitle,
        isDub,
        errorMessage: error?.message,
        errorCode: error?.code,
        httpStatus: error?.response?.status,
        httpStatusText: error?.response?.statusText,
        responseData: error?.response?.data,
        stack: error?.stack?.split('\n').slice(0, 3).join('\n')
      });
      console.log(`📺 [ZORO EPISODES ERROR END] ===================\n`);
      return [];
    }
  }

  /**
   * Extract episode ID from TakiAPI episode data
   */
  private extractEpisodeId(episodeData: any): string | null {
    console.log(`[ZORO] 🔍 Extracting episode ID from:`, {
      hasData: !!episodeData,
      hasId: !!episodeData?.id,
      id: episodeData?.id,
      idType: typeof episodeData?.id
    });
    
    if (!episodeData || !episodeData.id) {
      console.log(`[ZORO] ❌ No episode data or ID found`);
      return null;
    }
    
    // Format: "anime-name$episode$140994"
    const parts = episodeData.id.split('$');
    const extractedId = parts.length >= 3 ? parts[parts.length - 1] : null;
    
    console.log(`[ZORO] 📊 Episode ID extraction:`, {
      originalId: episodeData.id,
      parts,
      extractedId,
      partsCount: parts.length
    });
    
    return extractedId;
  }

  /**
   * Parse HTML response to extract server information
   */
  private parseServersHtml(html: string): ServerInfo[] {
    console.log(`[ZORO] 🔍 Parsing servers HTML - Length: ${html.length} characters`);
    
    const servers: ServerInfo[] = [];
    
    try {
      // Match server items with regex since we're dealing with HTML
      const serverPattern = /<div[^>]*class="[^"]*server-item[^"]*"[^>]*data-type="([^"]*)"[^>]*data-id="([^"]*)"[^>]*data-server-id="([^"]*)"[^>]*>([\s\S]*?)<\/div>/g;
      
      let match;
      let matchCount = 0;
      while ((match = serverPattern.exec(html)) !== null) {
        matchCount++;
        const [, type, dataId, serverId, content] = match;
        
        // Extract server name from the button text (e.g., "HD-1", "HD-2", "HD-3")
        const nameMatch = content.match(/<a[^>]*class="btn"[^>]*>([^<]+)<\/a>/);
        const name = nameMatch ? nameMatch[1].trim() : `Server ${serverId}`;
        
        const serverInfo = {
          id: dataId,
          serverId,
          type: type as 'sub' | 'dub',
          name
        };
        
        servers.push(serverInfo);
        
        if (matchCount <= 5) { // Log first 5 servers
          console.log(`[ZORO] 📝 Server ${matchCount}:`, {
            name: serverInfo.name,
            type: serverInfo.type,
            id: serverInfo.id,
            serverId: serverInfo.serverId
          });
        }
      }
      
      console.log(`[ZORO] 📊 HTML parsing found ${matchCount} server matches`);
      
      // Sort servers by name for consistent ordering (HD-1, HD-2, HD-3, etc.)
      servers.sort((a, b) => {
        // Extract number from server name for proper sorting
        const getServerNumber = (name: string) => {
          const match = name.match(/HD-(\d+)/);
          return match ? parseInt(match[1], 10) : 999;
        };
        return getServerNumber(a.name) - getServerNumber(b.name);
      });
      
      console.log(`[ZORO] ✅ Found ${servers.length} servers after sorting:`, servers.map(s => `${s.name} (${s.type})`).join(', '));
      return servers;
    } catch (error: any) {
      console.error('[ZORO] ❌ Error parsing servers HTML:', {
        htmlLength: html.length,
        errorMessage: error?.message,
        errorCode: error?.code,
        stack: error?.stack?.split('\n').slice(0, 3).join('\n')
      });
      return [];
    }
  }

  /**
   * Get available servers for an episode
   */
  async getEpisodeServers(episodeId: string): Promise<ServerInfo[]> {
    console.log(`\n📡 [ZORO SERVERS START] ===================`);
    console.log(`[ZORO] 📡 Getting servers for episode ID: ${episodeId}`);
    
    try {
      const serversUrl = `${this.hianimeUrl}/ajax/v2/episode/servers?episodeId=${episodeId}`;
      const proxiedUrl = this.proxyRequest(serversUrl);
      console.log(`[ZORO] 📡 Servers URL: ${serversUrl}`);
      console.log(`[ZORO] 📡 Proxied URL: ${proxiedUrl.substring(0, 100)}...`);
      
      console.log(`[ZORO] ⏱️ Making servers request...`);
      const response = await axios.get(proxiedUrl, {
        headers: {
          'Referer': this.hianimeUrl,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });
      
      console.log(`[ZORO] ✅ Servers response received`);
      console.log(`[ZORO] 📊 Response status: ${response.status}`);
      console.log(`[ZORO] 📊 Response data structure:`, {
        hasData: !!response.data,
        hasHtml: !!response.data?.html,
        isString: typeof response.data === 'string',
        htmlLength: response.data?.html?.length || (typeof response.data === 'string' ? response.data.length : 0),
        dataKeys: typeof response.data === 'object' ? Object.keys(response.data || {}) : 'string',
        contentPreview: (response.data?.html || response.data || '').substring(0, 200) + '...'
      });
      
      let servers: ServerInfo[] = [];
      
      if (response.data && typeof response.data.html === 'string') {
        console.log(`[ZORO] 🔍 Parsing HTML from response.data.html`);
        servers = this.parseServersHtml(response.data.html);
      } else if (typeof response.data === 'string') {
        console.log(`[ZORO] 🔍 Parsing HTML from response.data (string)`);
        servers = this.parseServersHtml(response.data);
      } else {
        console.warn('[ZORO] ⚠️ Unexpected servers response format');
        console.log(`[ZORO] 📊 Response data:`, response.data);
      }
      
      console.log(`[ZORO] ✅ Successfully parsed ${servers.length} servers`);
      console.log(`📡 [ZORO SERVERS END] ===================\n`);
      return servers;
    } catch (error: any) {
      console.log(`📡 [ZORO SERVERS ERROR] ===================`);
      console.error('[ZORO] ❌ Error fetching servers:', {
        episodeId,
        errorMessage: error?.message,
        errorCode: error?.code,
        httpStatus: error?.response?.status,
        httpStatusText: error?.response?.statusText,
        responseData: error?.response?.data,
        stack: error?.stack?.split('\n').slice(0, 3).join('\n')
      });
      console.log(`📡 [ZORO SERVERS ERROR END] ===================\n`);
      return [];
    }
  }

  /**
   * Get source link from server
   */
  async getSourceLink(serverId: string): Promise<string | null> {
    console.log(`\n🔗 [ZORO SOURCE LINK START] ===================`);
    console.log(`[ZORO] 🔗 Getting source link for server ID: ${serverId}`);
    
    try {
      const sourceUrl = `${this.hianimeUrl}/ajax/v2/episode/sources?id=${serverId}`;
      const proxiedUrl = this.proxyRequest(sourceUrl);
      console.log(`[ZORO] 📡 Source URL: ${sourceUrl}`);
      console.log(`[ZORO] 📡 Proxied URL: ${proxiedUrl.substring(0, 100)}...`);
      
      console.log(`[ZORO] ⏱️ Making source link request...`);
      const response = await axios.get(proxiedUrl, {
        headers: {
          'Referer': this.hianimeUrl,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });
      
      console.log(`[ZORO] ✅ Source link response received`);
      console.log(`[ZORO] 📊 Response status: ${response.status}`);
      console.log(`[ZORO] 📊 Response data structure:`, {
        hasData: !!response.data,
        hasLink: !!response.data?.link,
        linkPreview: response.data?.link?.substring(0, 80) + '...',
        dataKeys: Object.keys(response.data || {})
      });
      
      if (response.data && response.data.link) {
        console.log(`[ZORO] ✅ Source link found: ${response.data.link.substring(0, 80)}...`);
        console.log(`🔗 [ZORO SOURCE LINK END] ===================\n`);
        return response.data.link;
      }
      
      console.warn('[ZORO] ⚠️ No source link found in response');
      console.log(`🔗 [ZORO SOURCE LINK END] ===================\n`);
      return null;
    } catch (error: any) {
      console.log(`🔗 [ZORO SOURCE LINK ERROR] ===================`);
      console.error('[ZORO] ❌ Error fetching source link:', {
        serverId,
        errorMessage: error?.message,
        errorCode: error?.code,
        httpStatus: error?.response?.status,
        httpStatusText: error?.response?.statusText,
        responseData: error?.response?.data,
        stack: error?.stack?.split('\n').slice(0, 3).join('\n')
      });
      console.log(`🔗 [ZORO SOURCE LINK ERROR END] ===================\n`);
      return null;
    }
  }

  /**
   * Parse actual stream data from iframe link with retry logic
   */
  async parseStreamData(iframeUrl: string, retryCount: number = 0): Promise<any> {
    const maxRetries = 3;
    const baseDelay = 1000; // 1 second base delay
    
    console.log(`\n🔍 [ZORO PARSE STREAM START] ===================`);
    console.log(`[ZORO] 🔍 Parsing stream data from iframe URL: ${iframeUrl.substring(0, 80)}...`);
    console.log(`[ZORO] 🔄 Retry count: ${retryCount}/${maxRetries}`);
    
    try {
      const parserUrl = `${this.sourceParserUrl}/sources?url=${encodeURIComponent(iframeUrl)}`;
      const proxiedUrl = this.proxyRequest(parserUrl);
      console.log(`[ZORO] 📡 Parser URL: ${parserUrl.substring(0, 100)}...`);
      console.log(`[ZORO] 📡 Proxied URL: ${proxiedUrl.substring(0, 100)}...`);
      
      console.log(`[ZORO] ⏱️ Making stream parsing request...`);
      const response = await axios.get(proxiedUrl, {
        headers: {
          'Referer': this.hianimeUrl,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        },
        timeout: 10000 // 10 second timeout
      });
      
      console.log(`[ZORO] ✅ Stream parsing response received`);
      console.log(`[ZORO] 📊 Response status: ${response.status}`);
      console.log(`[ZORO] 📊 Response data structure:`, {
        hasData: !!response.data,
        hasSources: !!response.data?.sources,
        sourcesCount: response.data?.sources?.length || 0,
        hasTracks: !!response.data?.tracks,
        tracksCount: response.data?.tracks?.length || 0,
        hasIntro: !!response.data?.intro,
        hasOutro: !!response.data?.outro,
        dataKeys: Object.keys(response.data || {})
      });
      
      if (response.data?.sources?.length > 0) {
        console.log(`[ZORO] 📝 First few sources:`, response.data.sources.slice(0, 3).map((src: any, idx: number) => ({
          index: idx + 1,
          file: src.file?.substring(0, 50) + '...',
          type: src.type,
          label: src.label
        })));
      }
      
      if (response.data?.tracks?.length > 0) {
        console.log(`[ZORO] 📝 First few tracks:`, response.data.tracks.slice(0, 3).map((track: any, idx: number) => ({
          index: idx + 1,
          kind: track.kind,
          label: track.label,
          file: track.file?.substring(0, 50) + '...'
        })));
      }
      
      console.log(`🔍 [ZORO PARSE STREAM END] ===================\n`);
      return response.data;
    } catch (error: any) {
      console.log(`🔍 [ZORO PARSE STREAM ERROR] ===================`);
      console.error('[ZORO] ❌ Error parsing stream data:', {
        iframeUrl: iframeUrl.substring(0, 80) + '...',
        retryCount,
        maxRetries,
        errorMessage: error?.message,
        errorCode: error?.code,
        httpStatus: error?.response?.status,
        httpStatusText: error?.response?.statusText,
        responseData: error?.response?.data,
        stack: error?.stack?.split('\n').slice(0, 3).join('\n')
      });
      
      // Check if it's a rate limit error and we can retry
      if (error?.response?.status === 429 && retryCount < maxRetries) {
        const delay = baseDelay * Math.pow(2, retryCount); // Exponential backoff
        console.warn(`[ZORO] ⚠️ Rate limited, retrying in ${delay}ms... (attempt ${retryCount + 1}/${maxRetries})`);
        
        await new Promise(resolve => setTimeout(resolve, delay));
        console.log(`🔍 [ZORO PARSE STREAM ERROR END] ===================\n`);
        return this.parseStreamData(iframeUrl, retryCount + 1);
      }
      
      // If it's a rate limit error and we've exhausted retries, or other error
      if (error?.response?.status === 429) {
        console.log(`🔍 [ZORO PARSE STREAM ERROR END] ===================\n`);
        throw new Error('Rate limit exceeded - too many requests');
      }
      
      console.log(`🔍 [ZORO PARSE STREAM ERROR END] ===================\n`);
      throw new Error('Failed to parse stream data');
    }
  }

  /**
   * Get watch data for an episode using new HiAnime endpoints
   */
  async getWatchData(episodeId: string, isDub: boolean = false): Promise<WatchResponse> {
    try {
      console.log(`\n🔥 [ZORO WATCH DATA START] ===================`);
      console.log(`[ZoroProvider] Getting watch data for episode: ${episodeId}, isDub: ${isDub}`);
      
      // Step 1: Use episode ID directly - Consumet already provides the correct format
      let numericEpisodeId = episodeId;
      
      // If it's in the format "episode$1304", extract just the number
      if (episodeId.includes('$')) {
        const parts = episodeId.split('$');
        numericEpisodeId = parts[parts.length - 1]; // Get the last part (the actual episode ID)
        console.log(`[ZoroProvider] ✅ Extracted episode ID: ${numericEpisodeId} from ${episodeId}`);
      } else {
        console.log(`[ZoroProvider] ✅ Using episode ID as-is: ${numericEpisodeId}`);
      }
      
      // Step 2: Get available servers
      console.log(`[ZoroProvider] 📡 Fetching servers for episode ID: ${numericEpisodeId}`);
      const servers = await this.getEpisodeServers(numericEpisodeId);
      console.log(`[ZoroProvider] 📊 Retrieved ${servers.length} total servers`);
      
      if (servers.length === 0) {
        console.log(`[ZoroProvider] ❌ No servers available for episode ${numericEpisodeId}`);
        throw new Error('No servers available for this episode');
      }
      
      // Step 3: Organize servers by type
      console.log(`[ZoroProvider] 🔍 Organizing servers by type...`);
      const subServers = servers.filter(server => server.type === 'sub');
      const dubServers = servers.filter(server => server.type === 'dub');
      
      console.log(`[ZoroProvider] 📊 Found ${subServers.length} SUB servers: [${subServers.map(s => s.name).join(', ')}]`);
      console.log(`[ZoroProvider] 📊 Found ${dubServers.length} DUB servers: [${dubServers.map(s => s.name).join(', ')}]`);
      
      // Step 4: Choose which servers to try based on preference
      console.log(`[ZoroProvider] 🎯 Selecting servers for ${isDub ? 'DUB' : 'SUB'} content...`);
      let targetServers: ServerInfo[] = [];
      
      if (isDub && dubServers.length > 0) {
        targetServers = dubServers;
        console.log(`[ZoroProvider] ✅ Using DUB servers: [${dubServers.map(s => s.name).join(', ')}]`);
      } else if (!isDub && subServers.length > 0) {
        targetServers = subServers;
        console.log(`[ZoroProvider] ✅ Using SUB servers: [${subServers.map(s => s.name).join(', ')}]`);
      } else {
        // Fallback: if requested type not available, use what's available
        targetServers = isDub ? subServers : dubServers;
        if (targetServers.length > 0) {
          console.log(`[ZoroProvider] ⚠️ Requested ${isDub ? 'DUB' : 'SUB'} not available, falling back to ${targetServers[0].type.toUpperCase()}: [${targetServers.map(s => s.name).join(', ')}]`);
        }
      }
      
      if (targetServers.length === 0) {
        console.log(`[ZoroProvider] ❌ No ${isDub ? 'DUB' : 'SUB'} servers available for this episode`);
        throw new Error(`No ${isDub ? 'DUB' : 'SUB'} servers available for this episode`);
      }
      
      // Limit to 2 servers initially to avoid rate limiting
      if (targetServers.length > 2) {
        console.log(`[ZoroProvider] ⚡ Limiting to first 2 servers to avoid rate limiting (from ${targetServers.length})`);
        targetServers = targetServers.slice(0, 2);
      }
      
      console.log(`[ZoroProvider] 🚀 Final target servers: [${targetServers.map(s => `${s.name}(${s.type})`).join(', ')}]`);
      
      // Step 5: Try each server and collect all available sources
      const allServerSources: (Source & { serverName: string })[] = [];
      const collectedSubtitles: Subtitle[] = [];
      let collectedTimings: { intro?: { start: number; end: number; }; outro?: { start: number; end: number; }; } = {};
      
              console.log(`[ZoroProvider] 🔄 Starting server processing loop...`);
        for (let i = 0; i < targetServers.length; i++) {
          const server = targetServers[i];
          try {
            console.log(`\n[ZoroProvider] 🎬 Processing server ${i + 1}/${targetServers.length}: ${server.name} (${server.type}) - ID: ${server.id}`);
            
            // Add delay between requests to avoid rate limiting
            if (i > 0) {
              console.log(`[ZoroProvider] ⏱️ Adding 1s delay before next server...`);
              await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
            }
            
            // Get iframe link
            console.log(`[ZoroProvider] 📡 Getting source link for server ${server.name}...`);
            const iframeUrl = await this.getSourceLink(server.id);
            if (!iframeUrl) {
              console.warn(`[ZoroProvider] ❌ No iframe URL for server ${server.name}`);
              continue;
            }
            console.log(`[ZoroProvider] ✅ Got iframe URL: ${iframeUrl.substring(0, 80)}...`);
            
            // Parse stream data
            console.log(`[ZoroProvider] 🔍 Parsing stream data for server ${server.name}...`);
            const streamData = await this.parseStreamData(iframeUrl);
            if (!streamData || !streamData.sources) {
              console.warn(`[ZoroProvider] ❌ No stream data for server ${server.name}`);
              continue;
            }
            console.log(`[ZoroProvider] ✅ Stream data parsed successfully for ${server.name}, sources: ${streamData.sources?.length || 0}`);
            
            // Log detailed stream data
            console.log(`[ZoroProvider] 📊 Stream data details:`, {
              sourcesCount: streamData.sources?.length || 0,
              tracksCount: streamData.tracks?.length || 0,
              hasIntro: !!streamData.intro,
              hasOutro: !!streamData.outro
            });
          
          // Process sources from this server
          if (Array.isArray(streamData.sources)) {
            streamData.sources.forEach((source: any) => {
              if (source.file && source.type === 'hls') {
                // Proxy the actual video stream URL using the streaming proxy
                const proxiedVideoUrl = this.proxyVideoUrl(source.file);
                console.log(`[ZoroProvider] 🔗 Proxying video URL: ${source.file.substring(0, 50)}... -> streaming proxy`);
                
                allServerSources.push({
                  url: proxiedVideoUrl,
                  quality: `${server.name} - ${source.label || 'default'}`,
                  type: server.type,
                  serverName: server.name,
                  headers: {
                    'Referer': this.hianimeUrl,
                    'Origin': this.hianimeUrl,
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                  },
                  isM3U8: true
                });
              }
            });
          }
          
          // Collect subtitles (avoid duplicates)
          if (Array.isArray(streamData.tracks)) {
            streamData.tracks.forEach((track: any) => {
              if (track.file && track.kind === 'captions') {
                // Proxy subtitle URLs using the streaming proxy
                const proxiedSubtitleUrl = this.proxyVideoUrl(track.file);
                const existing = collectedSubtitles.find(sub => sub.url === proxiedSubtitleUrl);
                if (!existing) {
                  console.log(`[ZoroProvider] 📝 Proxying subtitle: ${track.label || 'Unknown'} - ${track.file.substring(0, 50)}... -> streaming proxy`);
                  collectedSubtitles.push({
                    url: proxiedSubtitleUrl,
                    lang: track.label || 'Unknown'
                  });
                }
              }
            });
          }
          
          // Collect intro/outro timings (use first available)
          if (streamData.intro && !collectedTimings.intro) {
            collectedTimings.intro = streamData.intro;
          }
          if (streamData.outro && !collectedTimings.outro) {
            collectedTimings.outro = streamData.outro;
          }
          
          console.log(`[ZoroProvider] Server ${server.name} provided ${streamData.sources?.length || 0} sources`);
          
                  } catch (serverError: any) {
            console.error(`[ZoroProvider] ❌ Server ${server.name} failed:`, {
              serverName: server.name,
              serverId: server.id,
              serverType: server.type,
              errorMessage: serverError?.message || 'Unknown error',
              errorCode: serverError?.code,
              httpStatus: serverError?.response?.status,
              errorStack: serverError?.stack?.split('\n').slice(0, 3).join('\n')
            });
            continue;
          }
        }
        
        console.log(`[ZoroProvider] 🏁 Server processing loop completed`);
      
      // Step 6: Process collected sources
      console.log(`[ZoroProvider] 📊 Processing final results...`);
      console.log(`[ZoroProvider] 📊 Total sources collected: ${allServerSources.length}`);
      console.log(`[ZoroProvider] 📊 Total subtitles collected: ${collectedSubtitles.length}`);
      console.log(`[ZoroProvider] 📊 Timings collected:`, {
        hasIntro: !!collectedTimings.intro,
        hasOutro: !!collectedTimings.outro,
        intro: collectedTimings.intro,
        outro: collectedTimings.outro
      });
      
      if (allServerSources.length === 0) {
        console.log(`[ZoroProvider] ❌ No working sources found from any server`);
        throw new Error('No working sources found from any server');
      }
      
      // Sort sources by server preference (HD-1 first, then by quality)
      console.log(`[ZoroProvider] 🔄 Sorting sources by server priority...`);
      allServerSources.sort((a, b) => {
        const getServerPriority = (name: string) => {
          const match = name.match(/HD-(\d+)/);
          return match ? parseInt(match[1], 10) : 999;
        };
        return getServerPriority(a.serverName) - getServerPriority(b.serverName);
      });
      
      // Add sources to the main array (remove serverName for compatibility)
      const sources = allServerSources.map(({ serverName, ...source }) => source);
      const subtitles = collectedSubtitles;
      
      // Generate fake intro/outro timings if not provided (like animepahe)
      let intro = collectedTimings.intro;
      let outro = collectedTimings.outro;
      
      // If no real timings found, generate fake ones based on typical anime patterns
      if (!intro || (intro.start === 0 && intro.end === 0)) {
        intro = { 
          start: AUTO_DETECT_TIMING.INTRO.START, 
          end: AUTO_DETECT_TIMING.INTRO.END 
        };
        console.log(`[ZoroProvider] 🎭 Generated fake intro timing: ${intro.start}-${intro.end}s`);
      } else {
        console.log(`[ZoroProvider] 🎬 Using real intro timing: ${intro.start}-${intro.end}s`);
      }
      
      if (!outro || (outro.start === 0 && outro.end === 0)) {
        // Use typical anime episode duration (23.5 minutes) to calculate outro
        const episodeDuration = AUTO_DETECT_TIMING.COMMON_DURATIONS.STANDARD;
        outro = { 
          start: episodeDuration - AUTO_DETECT_TIMING.OUTRO.START_OFFSET_FROM_END, 
          end: episodeDuration - AUTO_DETECT_TIMING.OUTRO.END_OFFSET_FROM_END 
        };
        console.log(`[ZoroProvider] 🎭 Generated fake outro timing: ${outro.start}-${outro.end}s`);
      } else {
        console.log(`[ZoroProvider] 🎬 Using real outro timing: ${outro.start}-${outro.end}s`);
      }
      
      const uniqueServers = new Set(allServerSources.map(s => s.serverName));
      console.log(`[ZoroProvider] ✅ Successfully collected sources from ${uniqueServers.size} servers: [${Array.from(uniqueServers).join(', ')}]`);
      console.log(`[ZoroProvider] ✅ Final sources: ${sources.length}, subtitles: ${subtitles.length}`);
      
      console.log(`🔥 [ZORO WATCH DATA END] ===================\n`);
      
      return {
        sources,
        subtitles,
        intro,
        outro,
        headers: {}
      };
      
    } catch (error: any) {
      console.error(`🔥 [ZORO WATCH DATA ERROR] ===================`);
      console.error('[ZoroProvider] ❌ Fatal error in getWatchData:', {
        episodeId,
        isDub,
        errorMessage: error?.message || 'Unknown error',
        errorCode: error?.code,
        httpStatus: error?.response?.status,
        errorType: error?.constructor?.name,
        errorStack: error?.stack?.split('\n').slice(0, 5).join('\n')
      });
      console.error(`🔥 [ZORO WATCH DATA ERROR END] ===================\n`);
      throw new Error(`Failed to get watch data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get all available servers for both SUB and DUB
   */
  async getAllServerOptions(episodeId: string): Promise<{ sub: ServerInfo[], dub: ServerInfo[] }> {
    try {
      // Use episode ID directly - Consumet already provides the correct format
      let numericEpisodeId = episodeId;
      
      // If it's in the format "episode$1304", extract just the number
      if (episodeId.includes('$')) {
        const parts = episodeId.split('$');
        numericEpisodeId = parts[parts.length - 1]; // Get the last part (the actual episode ID)
        console.log(`[ZoroProvider] Extracted episode ID: ${numericEpisodeId} from ${episodeId}`);
      }
      
      // Get all available servers
      const servers = await this.getEpisodeServers(numericEpisodeId);
      
      // Organize by type
      const subServers = servers.filter(server => server.type === 'sub');
      const dubServers = servers.filter(server => server.type === 'dub');
      
      console.log(`[ZoroProvider] All servers - SUB: ${subServers.length}, DUB: ${dubServers.length}`);
      
      return {
        sub: subServers,
        dub: dubServers
      };
    } catch (error) {
      console.error('[ZoroProvider] Error getting all server options:', error);
      return { sub: [], dub: [] };
    }
  }

  /**
   * Check episode availability for both sub and dub using new search+info method
   */
  async checkEpisodeAvailability(animeTitle: string, episodeNumber: number): Promise<{sub: boolean, dub: boolean}> {
    console.log(`\n🔍✅ [ZORO AVAILABILITY START] ===================`);
    console.log(`[ZORO] 🔍✅ Checking availability for anime title: "${animeTitle}", episode: ${episodeNumber}`);
    console.log(`[ZORO] 🔄 Using new reliable search+info method for availability check`);
    
    try {
      // Use the new search+info method to get episodes once
      // This is more efficient than the old method that made separate SUB/DUB calls
      console.log(`[ZORO] 🔍 Getting all episodes using search+info method...`);
      const allEpisodes = await this.getEpisodes(animeTitle, false); // Get all episodes (sub/dub info is per-episode)
      
      // Find the specific episode
      const targetEpisode = allEpisodes.find((ep: Episode) => ep.number === episodeNumber);
      
      if (!targetEpisode) {
        console.log(`[ZORO] ❌ Episode ${episodeNumber} not found in results`);
        console.log(`[ZORO] 📊 Available episodes:`, allEpisodes.map(ep => ep.number).slice(0, 10));
        console.log(`🔍✅ [ZORO AVAILABILITY END] ===================\n`);
        return { sub: false, dub: false };
      }
      
      const subAvailable = targetEpisode.isSubbed === true;
      const dubAvailable = targetEpisode.isDubbed === true;
      
      console.log(`[ZORO] 📊 Availability results:`, {
        animeTitle,
        episodeNumber,
        targetEpisode: {
          id: targetEpisode.id,
          number: targetEpisode.number,
          title: targetEpisode.title,
          isSubbed: targetEpisode.isSubbed,
          isDubbed: targetEpisode.isDubbed,
          provider: targetEpisode.provider
        },
        finalResult: { sub: subAvailable, dub: dubAvailable },
        totalEpisodesFound: allEpisodes.length,
        searchMethod: 'direct_zoro_search_and_info'
      });
      
      console.log(`🔍✅ [ZORO AVAILABILITY END] ===================\n`);
      return { sub: subAvailable, dub: dubAvailable };
    } catch (error: any) {
      console.log(`🔍✅ [ZORO AVAILABILITY ERROR] ===================`);
      console.error('[ZORO] ❌ Availability check error:', {
        animeTitle,
        episodeNumber,
        errorMessage: error?.message,
        errorCode: error?.code,
        httpStatus: error?.response?.status,
        httpStatusText: error?.response?.statusText,
        responseData: error?.response?.data,
        stack: error?.stack?.split('\n').slice(0, 3).join('\n')
      });
      console.log(`[ZORO] ⚠️ Assuming both SUB and DUB available due to check failure`);
      console.log(`🔍✅ [ZORO AVAILABILITY ERROR END] ===================\n`);
      return { sub: true, dub: true }; // Assume both available if check fails
    }
  }

  /**
   * Merge episodes from different sources
   */
  mergeEpisodes(jikanEpisodes: Episode[], zoroEpisodes: any[], coverImage?: string): Episode[] {
    console.log(`\n🔄 [ZORO MERGE START] ===================`);
    console.log(`[ZORO] 🔄 Merging episodes - Jikan: ${jikanEpisodes.length}, Zoro: ${zoroEpisodes.length}`);
    
    const episodeMap = new Map<number, Episode>();
    
    // Add Jikan episodes first
    console.log(`[ZORO] 📥 Step 1: Adding Jikan episodes...`);
    jikanEpisodes.forEach((ep: Episode, index: number) => {
      episodeMap.set(ep.number, ep);
      if (index < 3) {
        console.log(`[ZORO] 📝 Jikan episode ${index + 1}:`, {
          number: ep.number,
          title: ep.title,
          provider: ep.provider,
          isSubbed: ep.isSubbed,
          isDubbed: ep.isDubbed
        });
      }
    });
    
    const highestJikanEpisode = jikanEpisodes.reduce((max, ep) => Math.max(max, ep.number), 0);
    console.log(`[ZORO] 📊 Highest Jikan episode: ${highestJikanEpisode}`);
    
    // Add Zoro episodes that are missing or newer
    console.log(`[ZORO] 📥 Step 2: Adding Zoro episodes...`);
    let newEpisodes = 0;
    let updatedEpisodes = 0;
    
    zoroEpisodes.forEach((zoroEp: any, index: number) => {
      if (zoroEp.number && !isNaN(zoroEp.number) && 
          (!episodeMap.has(zoroEp.number) || zoroEp.number > highestJikanEpisode)) {
        
        const episode = {
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
        };
        
        if (!episodeMap.has(zoroEp.number)) {
          newEpisodes++;
        } else {
          updatedEpisodes++;
        }
        
        episodeMap.set(zoroEp.number, episode);
        
        if (index < 3) {
          console.log(`[ZORO] 📝 Zoro episode ${index + 1}:`, {
            number: episode.number,
            title: episode.title,
            provider: episode.provider,
            isNew: !episodeMap.has(zoroEp.number),
            hasImage: !!episode.image
          });
        }
      }
    });
    
    const result = Array.from(episodeMap.values()).sort((a, b) => a.number - b.number);
    
    console.log(`[ZORO] 📊 Merge summary:`, {
      originalJikan: jikanEpisodes.length,
      originalZoro: zoroEpisodes.length,
      newEpisodes,
      updatedEpisodes,
      finalTotal: result.length,
      episodeNumbers: result.slice(0, 10).map(ep => ep.number),
      highestJikanEpisode
    });
    
    console.log(`🔄 [ZORO MERGE END] ===================\n`);
    return result;
  }
}

// Export a singleton instance
export const zoroProvider = new ZoroHiAnimeProvider();