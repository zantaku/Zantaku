import axios from 'axios';
import { getInfoByAniList, getEpisodesByMal, getEpisodesByAniList } from '../../../../services/miruroClient';
// No proxying needed for aniwatch sources

// Types for compatibility with existing code
export interface Episode {
  id: string;
  number: number;
  title?: string;
  image?: string;
  provider?: string;
  isSubbed?: boolean;
  isDubbed?: boolean;
  isFiller?: boolean;
  providerIds?: { [key: string]: string };
}

export interface Source {
  url: string;
  quality?: string;
  type?: string;
  headers?: Record<string, string>;
  isM3U8?: boolean;
  name?: string;
}

export interface Subtitle {
  url: string;
  lang: string;
}

export interface VideoTimings {
  intro?: { start: number; end: number };
  outro?: { start: number; end: number };
}

export interface WatchResponse {
  sources: Source[];
  subtitles: Subtitle[];
  intro?: { start: number; end: number };
  outro?: { start: number; end: number };
  headers?: Record<string, string>;
}

export interface EpisodeAvailability {
  sub: boolean;
  dub: boolean;
}

export class ZoroHiAnimeProvider {
  private baseUrl = 'https://hianime.to';
  private slugCache: Map<string, string> = new Map();
  private headerCache: Map<string, Record<string, string>> = new Map();
  public static KUROJI_PROXY_PREFIX = 'https://kuroji.1ani.me/api/proxy?url=';
  private static KUROJI_BASE = 'https://kuroji.1ani.me/api/anime/watch';
  private static ANIWATCH_BASE = 'https://anianiwatchwatching.vercel.app/api/v2/hianime';
  private static DEFAULT_SERVER = 'hd-1';
  private static DESKTOP_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

  // Lightweight text normalizer for fuzzy matching
  private static normalize(input?: string): string {
    return (input || '')
      .toLowerCase()
      .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
      .replace(/\b(tv|season|part|arc|special|movie|the)\b/gi, '')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private static hasArcToken(input?: string): boolean {
    return /\b(arc|part|special|movie)\b/i.test(input || '');
  }

  // Token-set ratio style fuzzy score (0..100)
  private static fuzzy(a?: string, b?: string): number {
    const A = new Set(ZoroHiAnimeProvider.normalize(a).split(' ').filter(Boolean));
    const B = new Set(ZoroHiAnimeProvider.normalize(b).split(' ').filter(Boolean));
    if (!A.size || !B.size) return 0;
    let inter = 0;
    A.forEach((w) => { if (B.has(w)) inter++; });
    const score = (2 * inter) / (A.size + B.size);
    return Math.round(score * 100);
  }

  // Internal HTTP helpers
  private static async httpGetJson<T = any>(url: string, headers?: Record<string, string>): Promise<T> {
    const res = await axios.get(url, { headers: headers || {}, responseType: 'json' });
    return res.data as T;
  }

  private static async httpGetText(url: string, headers?: Record<string, string>): Promise<string> {
    const res = await axios.get(url, { headers: headers || {}, responseType: 'text' });
    return res.data as string;
  }

  // Optimized header fetching with caching
  private async getAniwatchHeaders(episodeId: string, category: string): Promise<Record<string, string>> {
    const cacheKey = `${episodeId}:${category}`;
    
    // Check cache first
    if (this.headerCache.has(cacheKey)) {
      console.log(`[ZoroProvider] 📋 Using cached headers for ${cacheKey}`);
      return this.headerCache.get(cacheKey)!;
    }

    try {
      if (/\?ep=\d+/.test(episodeId)) {
        const srcUrl = `${ZoroHiAnimeProvider.ANIWATCH_BASE}/episode/sources?animeEpisodeId=${encodeURIComponent(episodeId)}&server=${encodeURIComponent(ZoroHiAnimeProvider.DEFAULT_SERVER)}&category=${category}`;
        console.log(`[ZoroProvider] 🔍 Fetching Aniwatch headers for ${cacheKey}`);
        const aniwatchData = await ZoroHiAnimeProvider.httpGetJson<any>(srcUrl, { 'User-Agent': ZoroHiAnimeProvider.DESKTOP_UA });
        const headers = aniwatchData?.data?.headers || aniwatchData?.headers || {};
        
        // Cache the headers for future use
        this.headerCache.set(cacheKey, headers);
        console.log(`[ZoroProvider] 📋 Cached headers for ${cacheKey}`);
        
        // Clean up old cache entries
        this.clearOldCache();
        
        return headers;
      }
    } catch (error: any) {
      console.log(`[ZoroProvider] ⚠️ Failed to get Aniwatch headers for ${cacheKey}:`, error?.message);
    }
    
    return {};
  }

  // Pre-fetch headers for multiple episodes to improve performance
  async preloadHeaders(episodeIds: string[], category: string = 'dub'): Promise<void> {
    console.log(`[ZoroProvider] 🚀 Pre-loading headers for ${episodeIds.length} episodes`);
    
    // Use Promise.allSettled to fetch headers in parallel without blocking
    const headerPromises = episodeIds.map(async (episodeId) => {
      try {
        await this.getAniwatchHeaders(episodeId, category);
      } catch (error) {
        // Silently fail for preloading
      }
    });
    
    // Don't await this - let it run in background
    Promise.allSettled(headerPromises).then(() => {
      console.log(`[ZoroProvider] ✅ Pre-loaded headers for ${episodeIds.length} episodes`);
    });
  }

  // Clear old cache entries to prevent memory bloat
  private clearOldCache(): void {
    const maxCacheSize = 100; // Keep only last 100 header entries
    if (this.headerCache.size > maxCacheSize) {
      const entries = Array.from(this.headerCache.entries());
      const toRemove = entries.slice(0, entries.length - maxCacheSize);
      toRemove.forEach(([key]) => this.headerCache.delete(key));
      console.log(`[ZoroProvider] 🧹 Cleared ${toRemove.length} old cache entries`);
    }
  }

  // Warm up cache for a range of episodes (called when episode list is loaded)
  async warmupCache(episodeIds: string[], category: string = 'dub'): Promise<void> {
    if (episodeIds.length === 0) return;
    
    console.log(`[ZoroProvider] 🔥 Warming up cache for ${episodeIds.length} episodes`);
    
    // Start with the first few episodes for immediate responsiveness
    const immediateEpisodes = episodeIds.slice(0, 3);
    const remainingEpisodes = episodeIds.slice(3);
    
    // Preload immediate episodes synchronously for instant response
    for (const episodeId of immediateEpisodes) {
      try {
        await this.getAniwatchHeaders(episodeId, category);
      } catch (error) {
        // Continue with next episode
      }
    }
    
    // Preload remaining episodes in background
    if (remainingEpisodes.length > 0) {
      this.preloadHeaders(remainingEpisodes, category);
    }
  }

  private static slugify(input: string): string {
    return (input || '')
      .toLowerCase()
      .replace(/['’]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .replace(/--+/g, '-');
  }

  /**
   * Get episodes using Aniwatch (HiAnime) API
   */
  async getEpisodes(anilistIdOrTitle: string, _isDub: boolean = false): Promise<Episode[]> {
    try {
      console.log(`[ZoroProvider] 🔄 Getting episodes (Aniwatch API) for: ${anilistIdOrTitle}`);

      let slug: string | undefined;
      if (/^\d+$/.test(anilistIdOrTitle)) {
        // AniList ID path
        slug = await this.resolveAniwatchSlugFromAniList(anilistIdOrTitle);
      } else {
        // Title path via direct Aniwatch search
        const searchUrl = `${ZoroHiAnimeProvider.ANIWATCH_BASE}/search?q=${encodeURIComponent(anilistIdOrTitle)}&page=1`;
        const data = await ZoroHiAnimeProvider.httpGetJson<any>(searchUrl, { 'User-Agent': ZoroHiAnimeProvider.DESKTOP_UA });
        const list: any[] = data?.data?.animes || [];
        slug = list[0]?.id ? String(list[0].id) : undefined;
      }
      if (!slug) return [];

      const epUrl = `${ZoroHiAnimeProvider.ANIWATCH_BASE}/anime/${encodeURIComponent(slug)}/episodes`;
      const resp = await ZoroHiAnimeProvider.httpGetJson<any>(epUrl, { 'User-Agent': ZoroHiAnimeProvider.DESKTOP_UA });
      const list: any[] = resp?.data?.episodes || resp?.data?.data?.episodes || resp?.episodes || [];
      
      // Debug: Log raw API response for filler detection
      if (list.length > 0) {
        console.log(`[ZoroProvider] 🔍 Raw episode data sample:`, {
          firstEpisode: {
            number: list[0]?.number,
            title: list[0]?.title,
            isFiller: list[0]?.isFiller,
            filler: list[0]?.filler,
            is_filler: list[0]?.is_filler,
            rawKeys: Object.keys(list[0] || {})
          }
        });
      }
      const converted: Episode[] = list
        .map((e: any) => ({
          id: String(e?.episodeId || ''),
          number: Number(e?.number),
          title: e?.title || '',
          image: undefined,
          provider: 'zoro',
          isSubbed: true,
          isDubbed: true,
          isFiller: Boolean(e?.isFiller ?? e?.filler ?? e?.is_filler ?? false),
          providerIds: { zoro: `${slug}` },
        }))
        .filter((x: Episode) => !!x.id && !Number.isNaN(x.number));

      console.log(`[ZoroProvider] ✅ Retrieved ${converted.length} episodes (Aniwatch)`);
      return converted;
    } catch (error: any) {
      console.error(`[ZoroProvider] ❌ Error getting episodes:`, error?.message);
      return [];
    }
  }

  /**
   * Get episodes by ID (compatibility method)
   */
  async getEpisodesById(anilistId: string): Promise<Episode[]> {
    return this.getEpisodes(anilistId, false);
  }

  /**
   * Search anime via Aniwatch (HiAnime) API
   */
  async searchAnime(query: string): Promise<any[]> {
    try {
      console.log(`[ZoroProvider] 🔄 Searching via Aniwatch for: ${query}`);
      const url = `${ZoroHiAnimeProvider.ANIWATCH_BASE}/search?q=${encodeURIComponent(query)}&page=1`;
      const data = await ZoroHiAnimeProvider.httpGetJson<any>(url, { 'User-Agent': ZoroHiAnimeProvider.DESKTOP_UA });
      const list: any[] = data?.data?.animes || [];
      const mapped = list
        .map((r: any) => ({
          id: String(r?.id || ''),
          title: r?.name || r?.title || '',
          image: r?.poster || r?.image || undefined,
          provider: 'zoro',
          type: r?.type || '',
          rating: r?.rating || null,
          episodes: {
            sub: typeof r?.episodes?.sub === 'number' ? r.episodes.sub : (Array.isArray(r?.episodes) ? r.episodes?.length : undefined),
            dub: typeof r?.episodes?.dub === 'number' ? r.episodes.dub : undefined,
          },
        }))
        .filter((x: any) => x.id);
      console.log(`[ZoroProvider] ✅ Found ${mapped.length} anime via Aniwatch search`);
      return mapped;
    } catch (error: any) {
      console.error(`[ZoroProvider] ❌ Search error:`, error?.message);
      return [];
    }
  }

  /**
   * Get watch data using Kuroji API for dub, Aniwatch API for sub
   * - Dub: Gets sources directly from Kuroji API and extracts original stream URLs
   * - Sub: Uses Aniwatch API directly
   */
  async getWatchData(episodeId: string, isDub: boolean = false, episodeNumber?: number): Promise<WatchResponse> {
    try {
      console.log(`[ZoroProvider] 🔄 Getting watch data for episode: ${episodeId}, isDub: ${isDub}, episodeNumber: ${episodeNumber}`);

      // For dub, try Kuroji API first to get proper dub sources
      if (isDub) {
        try {
          // For Kuroji API, we need the actual episode number from EpisodeList (1, 2, 3, etc.)
          // The episodeId format is "demon-slayer-kimetsu-no-yaiba-47?ep=1279" but we need episode 1
          // We'll use the anilistId from context and the episodeNumber parameter
          const anilistId = '101922'; // This should come from the anime context
          const epNumber = episodeNumber || 1; // Use provided episodeNumber or default to 1
          
          console.log(`[ZoroProvider] 🎯 Trying Kuroji API for dub: ${anilistId}/episodes/${epNumber}`);
          const kurojiUrl = `${ZoroHiAnimeProvider.KUROJI_BASE}/${anilistId}/episodes/${epNumber}?provider=zoro&dub=true`;
          console.log(`[ZoroProvider] 🌐 Kuroji API URL → ${kurojiUrl}`);
          
          const kurojiData = await ZoroHiAnimeProvider.httpGetJson<any>(kurojiUrl, { 'User-Agent': ZoroHiAnimeProvider.DESKTOP_UA });
          console.log(`[ZoroProvider] 📡 Kuroji API response:`, JSON.stringify(kurojiData, null, 2));
          
          if (kurojiData?.sources && Array.isArray(kurojiData.sources) && kurojiData.sources.length > 0) {
            console.log(`[ZoroProvider] ✅ Kuroji API successful for dub - found ${kurojiData.sources.length} sources`);
            
            // Get Aniwatch headers efficiently using the helper method
            const aniwatchHeaders = await this.getAniwatchHeaders(episodeId, 'dub');
            
            // Extract original stream URLs from Kuroji proxy URLs
            const sources: Source[] = kurojiData.sources.map((s: any) => {
              let originalUrl = s?.url;
              
              // Remove Kuroji proxy prefix to get original stream URL
              if (originalUrl && originalUrl.includes('kuroji.1ani.me/api/proxy?url=')) {
                originalUrl = decodeURIComponent(originalUrl.replace('https://kuroji.1ani.me/api/proxy?url=', ''));
                console.log(`[ZoroProvider] 🔄 Extracted original URL from Kuroji proxy: ${originalUrl?.substring(0, 80)}...`);
              }
              
              return {
                url: originalUrl,
                quality: s?.quality || 'HD',
                type: 'dub',
                headers: aniwatchHeaders, // Use Aniwatch headers with Kuroji sources
                isM3U8: Boolean(s?.isM3U8 || s?.url?.includes('.m3u8')),
              };
            }).filter((s: Source) => !!s.url);

            const subtitles: Subtitle[] = (kurojiData?.subtitles || []).map((s: any) => ({ 
              url: s?.url, 
              lang: s?.lang || s?.language || '' 
            })).filter((s: Subtitle) => !!s.url);

            if (sources.length > 0) {
              console.log(`[ZoroProvider] 🎬 Returning ${sources.length} Kuroji dub sources with Aniwatch headers`);
              return { 
                sources, 
                subtitles, 
                headers: aniwatchHeaders, // Return Aniwatch headers for consistency
                intro: kurojiData?.intro, 
                outro: kurojiData?.outro 
              };
            }
          }
        } catch (kurojiError: any) {
          console.log(`[ZoroProvider] ⚠️ Kuroji API failed for dub, falling back to Aniwatch:`, kurojiError?.message);
        }
      }

      // Fallback to Aniwatch API (for sub or if Kuroji dub failed)
      console.log(`[ZoroProvider] 🔄 Using Aniwatch API for ${isDub ? 'dub (fallback)' : 'sub'}`);

      // Determine animeEpisodeId understood by Aniwatch API
      let animeEpisodeId = '';

      if (/\?ep=\d+/.test(episodeId)) {
        animeEpisodeId = episodeId;
      } else if (episodeId.includes('-ep-')) {
        const parts = episodeId.split('-ep-');
        const anilistId = parts[0];
        const episodeNumber = parseInt(parts[1], 10);
        const resolved = await this.resolveAniwatchEpisodeFromAniList(anilistId, episodeNumber);
        animeEpisodeId = resolved?.episodeId || '';
      } else if (/^\d+-\d+$/.test(episodeId)) {
        // MAL format: "malId-episodeNumber"
        const [malIdStr, epStr] = episodeId.split('-');
        const malId = Number(malIdStr);
        const episodeNumber = parseInt(epStr, 10);
        let aniId: string | undefined;
        try {
          let blob = null as any;
          try {
            blob = await getEpisodesByMal(malId, false);
          } catch {
            blob = await getEpisodesByMal(malId, true);
          }
          aniId = String(
            blob?.MAPPINGS?.aniId ||
              blob?.MAPPINGS?.anilistId ||
              blob?.aniId ||
              blob?.anilist_id ||
              blob?.anilistId ||
              ''
          );
        } catch {}
        if (!aniId) throw new Error('Missing anilist id in MAL mapping');
        const resolved = await this.resolveAniwatchEpisodeFromAniList(aniId, episodeNumber);
        animeEpisodeId = resolved?.episodeId || '';
      }

      if (!animeEpisodeId) {
        throw new Error('Unsupported episodeId format for Aniwatch API');
      }

      // Fetch sources from Aniwatch API
      const cat = isDub ? 'dub' : 'sub';
      const srcUrl = `${ZoroHiAnimeProvider.ANIWATCH_BASE}/episode/sources?animeEpisodeId=${encodeURIComponent(animeEpisodeId)}&server=${encodeURIComponent(ZoroHiAnimeProvider.DEFAULT_SERVER)}&category=${cat}`;
      console.log(`[ZoroProvider] 🌐 Aniwatch Sources URL → ${srcUrl}`);
      const data = await ZoroHiAnimeProvider.httpGetJson<any>(srcUrl, { 'User-Agent': ZoroHiAnimeProvider.DESKTOP_UA });
      const headers: Record<string, string> | undefined = data?.data?.headers || data?.headers;
      const apiSources: any[] = data?.data?.sources || data?.sources || [];
      // Map Aniwatch 'tracks' to our subtitle shape; fallback to 'subtitles' if present
      const apiTracks: any[] = data?.data?.tracks || data?.tracks || [];
      const apiSubs: any[] = (Array.isArray(apiTracks) && apiTracks.length ? apiTracks : (data?.data?.subtitles || data?.subtitles || []));
      const intro = data?.data?.intro || data?.intro;
      const outro = data?.data?.outro || data?.outro;

      // Debug: log track keys to understand structure variations
      try {
        console.log(`[ZoroProvider] 📜 Aniwatch subtitle tracks count: ${apiSubs?.length || 0}`);
        if (Array.isArray(apiSubs) && apiSubs.length) {
          const sample = apiSubs[0];
          console.log(`[ZoroProvider] 🔍 Subtitle sample keys:`, Object.keys(sample || {}));
        }
      } catch {}

      const sources: Source[] = apiSources.map((s: any) => ({
        url: s?.url || s?.file,
        quality: s?.quality || s?.label || 'default',
        type: cat === 'dub' ? 'dub' : 'sub',
        headers: headers || {},
        isM3U8: Boolean(s?.isM3U8),
      })).filter((s: Source) => !!s.url);

      // Map a variety of possible subtitle field names returned by Aniwatch
      const subtitles: Subtitle[] = (Array.isArray(apiSubs) ? apiSubs : []).map((s: any) => ({
        url: s?.url || s?.file || s?.src,
        lang: s?.lang || s?.language || s?.label || s?.srclang || ''
      })).filter((s: Subtitle) => !!s.url);

      if (!sources.length) throw new Error('No playable sources from Aniwatch API');

      console.log(`[ZoroProvider] 🎬 Returning ${sources.length} Aniwatch ${cat} sources with ${subtitles.length} subtitle track(s)`);
      return { sources, subtitles, headers, intro, outro };
    } catch (error: any) {
      console.error(`[ZoroProvider] ❌ Error getting watch data:`, error?.message);
      throw error;
    }
  }

  /**
   * Check episode availability
   */
  async checkEpisodeAvailability(anilistId: string, episodeNumber: number): Promise<EpisodeAvailability> {
    try {
      console.log(`[ZoroProvider] 🔄 Checking availability via Aniwatch for AniList ID: ${anilistId}, ep: ${episodeNumber}`);
      const resolved = await this.resolveAniwatchEpisodeFromAniList(String(anilistId), episodeNumber);
      const animeEpisodeId = resolved?.episodeId;
      if (!animeEpisodeId) return { sub: false, dub: false };
      const serversUrl = `${ZoroHiAnimeProvider.ANIWATCH_BASE}/episode/servers?animeEpisodeId=${encodeURIComponent(animeEpisodeId)}`;
      console.log(`[ZoroProvider] 🌐 Servers URL → ${serversUrl}`);
      const data = await ZoroHiAnimeProvider.httpGetJson<any>(serversUrl, { 'User-Agent': ZoroHiAnimeProvider.DESKTOP_UA });
      const sub = Array.isArray(data?.data?.sub) ? data.data.sub.length > 0 : Array.isArray(data?.sub) ? data.sub.length > 0 : false;
      const dub = Array.isArray(data?.data?.dub) ? data.data.dub.length > 0 : Array.isArray(data?.dub) ? data.dub.length > 0 : false;
      const availability: EpisodeAvailability = { sub, dub };
      console.log(`[ZoroProvider] ✅ Availability (Aniwatch): sub=${availability.sub}, dub=${availability.dub}`);
      return availability;
    } catch (error: any) {
      console.error(`[ZoroProvider] ❌ Error checking availability:`, error?.message);
      return { sub: false, dub: false };
    }
  }

  /**
   * Get all server options (compatibility method - simplified)
   */
  async getAllServerOptions(episodeId: string): Promise<any[]> {
    try {
      console.log(`[ZoroProvider] 🔄 Getting server options for episode: ${episodeId}`);
      
      // Pre-warm cache for this episode to improve responsiveness
      await this.warmupCache([episodeId], 'dub');
      
      // Get sub sources from Aniwatch API
      const subWatchData = await this.getWatchData(episodeId, false, 1); // Default to episode 1 for sub
      
      // Get dub sources from Aniwatch API
      const dubWatchData = await this.getWatchData(episodeId, true, 1); // Default to episode 1 for dub

      // Return a simplified server structure for compatibility
      const servers = [];

      if (subWatchData?.sources && subWatchData.sources.length > 0) {
        servers.push({
          name: 'Kuroji HD',
          type: 'sub',
          id: 'kuroji-hd',
          sources: subWatchData.sources
        });
      }

      // If we have dub sources, add a dub server
      if (dubWatchData?.sources && dubWatchData.sources.length > 0) {
        servers.push({
          name: 'Kuroji HD (Dub)',
          type: 'dub',
          id: 'kuroji-hd-dub',
          sources: dubWatchData.sources,
        });
      }

      if (servers.length === 0) {
        console.log(`[ZoroProvider] ❌ No sources available`);
        return [];
      }

      console.log(`[ZoroProvider] ✅ Found ${servers.length} server options`);
      return servers;
    } catch (error: any) {
      console.error(`[ZoroProvider] ❌ Error getting server options:`, error?.message);
      return [];
    }
  }

  // Resolve Aniwatch slug from AniList ID
  private async resolveAniwatchSlugFromAniList(anilistId: string): Promise<string | undefined> {
    // Cache first
    const cached = this.slugCache.get(String(anilistId));
    if (cached) return cached;

    // 1) Prefer Miruro provider mappings by AniList, which include accurate Zoro/HiAnime IDs
    try {
      const blob = await getEpisodesByAniList(Number(anilistId), false);
      const mappings = blob?.MAPPINGS || blob?.mappings || {};
      const providers = mappings?.providers || mappings?.PROVIDERS || {};
      const zoro = providers?.zoro || providers?.hianime || providers?.hiAnime || providers?.HiAnime || {};
      // Common possible fields observed in similar APIs
      const providerIdCandidates: any[] = [
        zoro?.provider_id,
        zoro?.providerId,
        Array.isArray(zoro?.provider_id) ? zoro?.provider_id?.[0] : undefined,
        zoro?.id,
        zoro?.ids && Array.isArray(zoro.ids) ? zoro.ids[0] : zoro?.ids,
        zoro?.slug,
        mappings?.zoro?.provider_id,
        mappings?.hianime?.provider_id
      ];
      const fromMapping = providerIdCandidates.find((v) => typeof v === 'string' && v.length > 0);
      if (fromMapping) {
        const slug = String(fromMapping);
        this.slugCache.set(String(anilistId), slug);
        return slug;
      }
    } catch (e) {
      // fall through to title-based matching
    }

    // 2) Fallback: title-based search using AniList titles and synonyms
    const info = await getInfoByAniList(Number(anilistId));
    const aniTitles: string[] = [];
    const english = info?.title?.english || '';
    const romaji = info?.title?.romaji || '';
    const userPreferred = info?.title?.userPreferred || '';
    const synonyms: string[] = Array.isArray(info?.synonyms) ? info.synonyms : [];
    ;[english, romaji, userPreferred, ...synonyms].forEach((t) => {
      if (t && !aniTitles.includes(t)) aniTitles.push(t);
    });

    // Determine expected episode count from Miruro AniList episodes blob
    let expectedEpisodes: number | undefined;
    try {
      const blob = await getEpisodesByAniList(Number(anilistId), false);
      const list: any[] = blob?.TMDB?.episodes || blob?.episodes || blob?.TMDB?.selectedSeason?.episodes || [];
      if (Array.isArray(list) && list.length > 0) expectedEpisodes = list.length;
    } catch {}

    // Aggregate candidates from provider search across all titles
    const seen = new Map<string, any>();
    for (const term of aniTitles) {
      try {
        const results = await this.searchAnime(term);
        for (const r of results) {
          if (!seen.has(r.id)) seen.set(r.id, r);
        }
      } catch {}
    }

    const candidates = Array.from(seen.values());
    if (!candidates.length) return undefined;

    // Score candidates
    const scored = candidates.map((c: any) => {
      const titleScore = Math.max(...aniTitles.map((t) => ZoroHiAnimeProvider.fuzzy(t, c.title)));
      // Episode-based score
      const provEps = Math.max(Number(c?.episodes?.sub || 0), Number(c?.episodes?.dub || 0));
      let epsScore = 0;
      if (expectedEpisodes && provEps) {
        if (provEps === expectedEpisodes) epsScore = 20;
        else if (Math.abs(provEps - expectedEpisodes) <= 2) epsScore = 12;
        else if (Math.abs(provEps - expectedEpisodes) / expectedEpisodes <= 0.2) epsScore = 8;
      }
      const arcPenalty = (ZoroHiAnimeProvider.hasArcToken(c.title) && !ZoroHiAnimeProvider.hasArcToken(aniTitles[0])) ? 20 : 0;
      const base = titleScore + epsScore - arcPenalty;
      return { c, score: base };
    }).sort((a: any, b: any) => b.score - a.score);

    const best = scored[0];
    if (!best) return undefined;
    const bestSlug = String(best.c.id);
    this.slugCache.set(String(anilistId), bestSlug);
    return bestSlug;
  }

  // Resolve Aniwatch episodeId from AniList ID + episode number
  private async resolveAniwatchEpisodeFromAniList(
    anilistId: string,
    episodeNumber: number
  ): Promise<{ slug: string; episodeId: string } | undefined> {
    const slug = await this.resolveAniwatchSlugFromAniList(anilistId);
    if (!slug) return undefined;
    const epUrl = `${ZoroHiAnimeProvider.ANIWATCH_BASE}/anime/${encodeURIComponent(slug)}/episodes`;
    const resp = await ZoroHiAnimeProvider.httpGetJson<any>(epUrl, { 'User-Agent': ZoroHiAnimeProvider.DESKTOP_UA });
    const list: any[] = resp?.data?.episodes || resp?.episodes || [];
    const entry = list.find((e: any) => Number(e?.number) === Number(episodeNumber));
    if (!entry) return undefined;
    return { slug, episodeId: String(entry?.episodeId || '') };
  }
}



// Export singleton instance
export const zoroProvider = new ZoroHiAnimeProvider();


// Note: Using Aniwatch API source shape mapped to internal `Source`