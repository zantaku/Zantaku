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
  private sourceParserUrl = 'https://shih.kaoru.cat';
  private proxyUrl = 'http://yesgogogototheapi.xyz/proxy?url=';
  private videoProxyUrl = 'http://yesgogogototheapi.xyz/proxy/';

  /**
   * Proxy a URL through the proxy service (for API calls)
   */
  private proxyRequest(url: string): string {
    return `${this.proxyUrl}${encodeURIComponent(url)}`;
  }

  /**
   * Proxy a video URL through the video proxy service (for streaming)
   */
  private proxyVideoUrl(url: string): string {
    return `${this.videoProxyUrl}${url}`;
  }

  /**
   * Search for anime using the Zoro provider
   */
  async searchAnime(query: string): Promise<any[]> {
    try {
      const searchUrl = `${this.baseUrl}/anime/zoro/${encodeURIComponent(query)}?type=1`;
      const proxiedUrl = this.proxyRequest(searchUrl);
      console.log(`[ZoroProvider] Searching: ${searchUrl} via proxy`);
      
      const response = await axios.get(proxiedUrl);
      return response.data.results || [];
    } catch (error) {
      console.error('[ZoroProvider] Search error:', error);
      throw new Error('Failed to search anime');
    }
  }

  /**
   * Get anime info by ID from TakiAPI
   */
  async getAnimeInfo(id: string): Promise<any> {
    try {
      const infoUrl = `${this.takiApiUrl}/anime/zoro/info?id=${id}`;
      const proxiedUrl = this.proxyRequest(infoUrl);
      console.log(`[ZoroProvider] Getting info: ${infoUrl} via proxy`);
      
      const response = await axios.get(proxiedUrl);
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
      const proxiedUrl = this.proxyRequest(episodesUrl);
      console.log(`[ZoroProvider] Getting episodes: ${episodesUrl} via proxy`);
      
      const response = await axios.get(proxiedUrl);
      
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
   * Extract episode ID from TakiAPI episode data
   */
  private extractEpisodeId(episodeData: any): string | null {
    if (!episodeData || !episodeData.id) return null;
    
    // Format: "anime-name$episode$140994"
    const parts = episodeData.id.split('$');
    return parts.length >= 3 ? parts[parts.length - 1] : null;
  }

  /**
   * Parse HTML response to extract server information
   */
  private parseServersHtml(html: string): ServerInfo[] {
    const servers: ServerInfo[] = [];
    
    try {
      // Match server items with regex since we're dealing with HTML
      const serverPattern = /<div[^>]*class="[^"]*server-item[^"]*"[^>]*data-type="([^"]*)"[^>]*data-id="([^"]*)"[^>]*data-server-id="([^"]*)"[^>]*>([\s\S]*?)<\/div>/g;
      
      let match;
      while ((match = serverPattern.exec(html)) !== null) {
        const [, type, dataId, serverId, content] = match;
        
        // Extract server name from the button text (e.g., "HD-1", "HD-2", "HD-3")
        const nameMatch = content.match(/<a[^>]*class="btn"[^>]*>([^<]+)<\/a>/);
        const name = nameMatch ? nameMatch[1].trim() : `Server ${serverId}`;
        
        servers.push({
          id: dataId,
          serverId,
          type: type as 'sub' | 'dub',
          name
        });
      }
      
      // Sort servers by name for consistent ordering (HD-1, HD-2, HD-3, etc.)
      servers.sort((a, b) => {
        // Extract number from server name for proper sorting
        const getServerNumber = (name: string) => {
          const match = name.match(/HD-(\d+)/);
          return match ? parseInt(match[1], 10) : 999;
        };
        return getServerNumber(a.name) - getServerNumber(b.name);
      });
      
      console.log(`[ZoroProvider] Found ${servers.length} servers:`, servers.map(s => `${s.name} (${s.type})`).join(', '));
      return servers;
    } catch (error) {
      console.error('[ZoroProvider] Error parsing servers HTML:', error);
      return [];
    }
  }

  /**
   * Get available servers for an episode
   */
  async getEpisodeServers(episodeId: string): Promise<ServerInfo[]> {
    try {
      const serversUrl = `${this.hianimeUrl}/ajax/v2/episode/servers?episodeId=${episodeId}`;
      const proxiedUrl = this.proxyRequest(serversUrl);
      console.log(`[ZoroProvider] Getting servers: ${serversUrl} via proxy`);
      
      const response = await axios.get(proxiedUrl, {
        headers: {
          'Referer': this.hianimeUrl,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });
      
      if (response.data && typeof response.data.html === 'string') {
        return this.parseServersHtml(response.data.html);
      } else if (typeof response.data === 'string') {
        return this.parseServersHtml(response.data);
      }
      
      console.warn('[ZoroProvider] Unexpected servers response format');
      return [];
    } catch (error) {
      console.error('[ZoroProvider] Error fetching servers:', error);
      return [];
    }
  }

  /**
   * Get source link from server
   */
  async getSourceLink(serverId: string): Promise<string | null> {
    try {
      const sourceUrl = `${this.hianimeUrl}/ajax/v2/episode/sources?id=${serverId}`;
      const proxiedUrl = this.proxyRequest(sourceUrl);
      console.log(`[ZoroProvider] Getting source: ${sourceUrl} via proxy`);
      
      const response = await axios.get(proxiedUrl, {
        headers: {
          'Referer': this.hianimeUrl,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });
      
      if (response.data && response.data.link) {
        return response.data.link;
      }
      
      console.warn('[ZoroProvider] No source link found in response');
      return null;
    } catch (error) {
      console.error('[ZoroProvider] Error fetching source link:', error);
      return null;
    }
  }

  /**
   * Parse actual stream data from iframe link with retry logic
   */
  async parseStreamData(iframeUrl: string, retryCount: number = 0): Promise<any> {
    const maxRetries = 3;
    const baseDelay = 1000; // 1 second base delay
    
    try {
      const parserUrl = `${this.sourceParserUrl}/sources?url=${encodeURIComponent(iframeUrl)}`;
      const proxiedUrl = this.proxyRequest(parserUrl);
      console.log(`[ZoroProvider] Parsing stream: ${parserUrl} via proxy${retryCount > 0 ? ` (retry ${retryCount})` : ''}`);
      
      const response = await axios.get(proxiedUrl, {
        headers: {
          'Referer': this.hianimeUrl,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        },
        timeout: 10000 // 10 second timeout
      });
      
      return response.data;
    } catch (error: any) {
      console.error('[ZoroProvider] Error parsing stream data:', error);
      
      // Check if it's a rate limit error and we can retry
      if (error?.response?.status === 429 && retryCount < maxRetries) {
        const delay = baseDelay * Math.pow(2, retryCount); // Exponential backoff
        console.warn(`[ZoroProvider] Rate limited, retrying in ${delay}ms... (attempt ${retryCount + 1}/${maxRetries})`);
        
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.parseStreamData(iframeUrl, retryCount + 1);
      }
      
      // If it's a rate limit error and we've exhausted retries, or other error
      if (error?.response?.status === 429) {
        throw new Error('Rate limit exceeded - too many requests');
      }
      
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
