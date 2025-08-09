import axios from 'axios';
import { getInfoByAniList, getEpisodesByMal } from '../../../../services/miruroClient';
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
  providerIds?: { [key: string]: string };
}

export interface Source {
  url: string;
  quality?: string;
  type?: string;
  headers?: Record<string, string>;
  isM3U8?: boolean;
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
  public static KUROJI_PROXY_PREFIX = 'https://kuroji.1ani.me/api/proxy?url=';
  private static ANIWATCH_BASE = 'https://anianiwatchwatching.vercel.app/api/v2/hianime';
  private static DEFAULT_SERVER = 'hd-1';
  private static DESKTOP_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

  // Internal HTTP helpers
  private static async httpGetJson<T = any>(url: string, headers?: Record<string, string>): Promise<T> {
    const res = await axios.get(url, { headers: headers || {}, responseType: 'json' });
    return res.data as T;
  }

  private static async httpGetText(url: string, headers?: Record<string, string>): Promise<string> {
    const res = await axios.get(url, { headers: headers || {}, responseType: 'text' });
    return res.data as string;
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
      const converted: Episode[] = list
        .map((e: any) => ({
          id: String(e?.episodeId || ''),
          number: Number(e?.number),
          title: e?.title || '',
          image: undefined,
          provider: 'zoro',
          isSubbed: true,
          isDubbed: true,
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
   * Get watch data using Aniwatch (HiAnime) API
   */
  async getWatchData(episodeId: string, isDub: boolean = false): Promise<WatchResponse> {
    try {
      console.log(`[ZoroProvider] 🔄 Getting watch data (Aniwatch) for episode: ${episodeId}, isDub: ${isDub}`);

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
      const data = await ZoroHiAnimeProvider.httpGetJson<any>(srcUrl, { 'User-Agent': ZoroHiAnimeProvider.DESKTOP_UA });
      const headers: Record<string, string> | undefined = data?.data?.headers || data?.headers;
      const apiSources: any[] = data?.data?.sources || data?.sources || [];
      // Map Aniwatch 'tracks' to our subtitle shape; fallback to 'subtitles' if present
      const apiTracks: any[] = data?.data?.tracks || data?.tracks || [];
      const apiSubs: any[] = (Array.isArray(apiTracks) && apiTracks.length ? apiTracks : (data?.data?.subtitles || data?.subtitles || []));
      const intro = data?.data?.intro || data?.intro;
      const outro = data?.data?.outro || data?.outro;

      const sources: Source[] = apiSources.map((s: any) => ({
        url: s?.url,
        quality: s?.quality,
        type: cat,
        headers: undefined,
        isM3U8: Boolean(s?.isM3U8),
      })).filter((s: Source) => !!s.url);

      const subtitles: Subtitle[] = apiSubs.map((s: any) => ({ url: s?.url, lang: s?.lang || s?.language || '' })).filter((s: Subtitle) => !!s.url);

      if (!sources.length) throw new Error('No playable sources from Aniwatch API');

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
      
      const watchData = await this.getWatchData(episodeId, false);
      
      if (watchData.sources.length === 0) {
        console.log(`[ZoroProvider] ❌ No sources available`);
        return [];
      }

      // Return a simplified server structure for compatibility
      const servers = [
        {
          name: 'Kuroji HD',
          type: 'sub',
          id: 'kuroji-hd',
          sources: watchData.sources
        }
      ];

      // If we have dub sources, add a dub server
      const dubWatchData = await this.getWatchData(episodeId, true);
      if (dubWatchData.sources.length > 0) {
        servers.push({
          name: 'Kuroji HD (Dub)',
          type: 'dub',
          id: 'kuroji-hd-dub',
          sources: dubWatchData.sources,
        });
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
    const info = await getInfoByAniList(Number(anilistId));
    const candidates: string[] = [];
    const english = info?.title?.english || '';
    const romaji = info?.title?.romaji || '';
    const userPreferred = info?.title?.userPreferred || '';
    const synonyms: string[] = Array.isArray(info?.synonyms) ? info.synonyms : [];
    ;[english, romaji, userPreferred, ...synonyms].forEach((t) => {
      if (t && !candidates.includes(t)) candidates.push(t);
    });
    for (const term of candidates) {
      try {
        const url = `${ZoroHiAnimeProvider.ANIWATCH_BASE}/search?q=${encodeURIComponent(term)}&page=1`;
        const data = await ZoroHiAnimeProvider.httpGetJson<any>(url, { 'User-Agent': ZoroHiAnimeProvider.DESKTOP_UA });
        const list: any[] = data?.data?.animes || [];
        if (list.length > 0) {
          return String(list[0]?.id || '');
        }
      } catch {}
    }
    return undefined;
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