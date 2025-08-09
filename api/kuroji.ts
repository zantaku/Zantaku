import Constants from 'expo-constants';

// Types kept here for convenience; also exported for app-wide reuse
export type ProviderKey = 'zoro' | 'animekai' | 'animepahe' | 'anilibria';

export interface AnimeLite {
  id: string;
  title: { romaji?: string; english?: string; native?: string };
  coverImage?: string;
  bannerImage?: string;
  format?: string;
  status?: string;
  episodesCount?: number;
}

export interface EpisodeLite {
  number: number;
  title?: string;
  airDate?: string;
  thumb?: string;
  duration?: number;
  // New: availability flags straight from Kuroji /episodes
  sub?: boolean;
  dub?: boolean;
  availableOn?: Partial<Record<ProviderKey, boolean>>;
}

export interface ProvidersForEpisode {
  episode: number;
  available: ProviderKey[];
  // Optional: per-provider available types when the API returns detailed entries
  types?: Partial<Record<ProviderKey, Array<'sub' | 'dub'>>>;
}

export interface StreamCaption {
  url: string;
  lang: string;
}

export interface StreamSource {
  url: string;
  quality?: string;
  mime?: string;
  headers?: Record<string, string>;
  captions?: StreamCaption[];
  isDub?: boolean;
}

// Kuroji unified watch payload
export interface KurojiWatchPayload {
  headers?: Record<string, string>;
  intro?: { start: number; end: number } | null;
  outro?: { start: number; end: number } | null;
  subtitles?: Array<{ url: string; lang: string }>;
  sources: Array<{ url: string; isM3U8?: boolean; type?: string; quality?: string; mime?: string; headers?: Record<string, string> }>;
}

type JsonValue = any;

const DEFAULT_BASE = 'https://kuroji.1ani.me';
function getEnvString(key: string | undefined): string | undefined {
  if (!key) return undefined;
  try {
    // @ts-ignore expo-constants types can vary by env
    const fromExtra = Constants?.expoConfig?.extra?.[key] ?? Constants?.manifest?.extra?.[key];
    if (typeof fromExtra === 'string' && fromExtra.length > 0) return fromExtra;
  } catch {}
  // Fallback to process.env if available
  // eslint-disable-next-line no-undef
  const fromProcess = (typeof process !== 'undefined' ? (process as any).env?.[key] : undefined) as string | undefined;
  return fromProcess;
}

const KUROJI_BASE_URL = getEnvString('KUROJI_BASE_URL') || DEFAULT_BASE;
const USE_PROXY_FOR_VIDEO = (getEnvString('USE_PROXY_FOR_VIDEO') || 'false').toLowerCase() === 'true';

export function buildUrl(path: string): string {
  // Normalize base and path; avoid touching scheme (https://)
  const base = KUROJI_BASE_URL.replace(/\/+$/, '');
  const normalized = (path.startsWith('/') ? path : `/${path}`).replace(/\/+/, '/').replace(/\/{2,}/g, '/');
  return `${base}${normalized}`;
}

// Safe path join to avoid duplicate slashes inside segments
export function joinPathSegments(...parts: string[]): string {
  return parts
    .filter((p) => p != null && p !== '')
    .map((p, i) => (i === 0 ? String(p).replace(/\/+$/, '') : String(p).replace(/^\/+|\/+$/g, '')))
    .join('/');
}

export function buildUrlFromSegments(...parts: string[]): string {
  const path = joinPathSegments(...parts);
  return buildUrl(`/${path}`);
}

export function buildProxyUrl(targetUrl: string): string {
  const encoded = encodeURIComponent(targetUrl);
  return `${KUROJI_BASE_URL}/api/proxy?url=${encoded}`;
}

export async function kfetch<T = JsonValue>(path: string, init?: RequestInit & { timeoutMs?: number; retries?: number }, signal?: AbortSignal): Promise<T> {
  const url = buildUrl(path);
  const { timeoutMs = 15000, retries = 1, ...rest } = init || {};

  let attempt = 0;
  let lastError: unknown;

  while (attempt <= retries) {
    attempt += 1;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...rest, signal: signal ?? controller.signal });
      clearTimeout(timeout);
      if (!res.ok) {
        throw new Error(`${res.status} ${res.statusText}`);
      }
      const json = (await res.json()) as T;
      return json;
    } catch (err) {
      clearTimeout(timeout);
      lastError = err;
      if (attempt > retries) break;
      await new Promise((r) => setTimeout(r, Math.min(1000 * 2 ** (attempt - 1), 4000)));
    }
  }

  throw lastError instanceof Error ? lastError : new Error('kfetch failed');
}

// Lightweight resolver utilities
export async function resolveAnimeId({ anilistId, title }: { anilistId?: string | number; title?: string }): Promise<string | null> {
  // Prefer AniList id
  if (anilistId) {
    try {
      const info = await kfetch<any>(`/api/anime/info/${anilistId}`);
      if (info?.id ?? info?.data?.id) return (info.id ?? info.data.id).toString();
      // Some deployments wrap under data
    } catch {}
  }

  if (!title) return null;

  try {
    const search = await kfetch<any>(`/api/anime/search/${encodeURIComponent(title)}`);
    const items: any[] = Array.isArray(search?.data) ? search.data : Array.isArray(search) ? search : [];
    if (items.length > 0) return (items[0].id ?? items[0]._id ?? items[0].anilistId ?? items[0].malId)?.toString?.();
  } catch {}

  return null;
}

export async function getAnimeInfo(animeId: string): Promise<AnimeLite | null> {
  try {
    const info = await kfetch<any>(`/api/anime/info/${animeId}`);
    const d = info?.data ?? info;
    return {
      id: (d?.id ?? d?.anilistId ?? animeId)?.toString?.(),
      title: {
        romaji: d?.title?.romaji ?? d?.title?.userPreferred ?? d?.title?.romajiTitle,
        english: d?.title?.english ?? d?.title?.englishTitle,
        native: d?.title?.native,
      },
      coverImage: d?.coverImage ?? d?.image ?? d?.cover,
      bannerImage: d?.bannerImage ?? d?.banner,
      format: d?.format,
      status: d?.status,
      episodesCount: d?.episodes ?? d?.totalEpisodes ?? d?.episodesCount,
    };
  } catch (e) {
    return null;
  }
}

export async function getEpisodes(animeId: string): Promise<EpisodeLite[]> {
  const res = await kfetch<any>(`/api/anime/info/${animeId}/episodes`);
  const list: any[] = res?.data ?? res ?? [];
  return list.map((ep) => ({
    number: Number(ep?.number ?? ep?.episode ?? ep?.no ?? ep?.id ?? 0),
    title: ep?.title ?? ep?.name ?? undefined,
    airDate: ep?.airDate ?? ep?.aired ?? undefined,
    thumb: ep?.image ?? ep?.thumb ?? ep?.thumbnail ?? undefined,
    duration: typeof ep?.duration === 'number' ? ep.duration : undefined,
    sub: typeof ep?.sub === 'boolean' ? ep.sub : undefined,
    dub: typeof ep?.dub === 'boolean' ? ep.dub : undefined,
    availableOn: ep?.availableOn && typeof ep.availableOn === 'object' ? {
      zoro: Boolean(ep.availableOn.zoro),
      animekai: Boolean(ep.availableOn.animekai),
      animepahe: Boolean(ep.availableOn.animepahe),
      anilibria: Boolean(ep.availableOn.anilibria),
    } : undefined,
  }));
}

export async function getProvidersForEpisode(animeId: string, episodeNumber: number): Promise<ProvidersForEpisode> {
  const res = await kfetch<any>(`/api/anime/info/${animeId}/providers/${episodeNumber}`);
  const raw = res?.data ?? res;

  const allowed: ProviderKey[] = ['zoro', 'animekai', 'animepahe', 'anilibria'];
  let available: ProviderKey[] = [];
  let types: ProvidersForEpisode['types'] = {};

  if (Array.isArray(raw)) {
    // e.g., ['zoro','animepahe']
    available = raw.filter(Boolean).map((p: string) => p.toLowerCase()) as ProviderKey[];
  } else if (raw && typeof raw === 'object') {
    if (Array.isArray(raw.providers)) {
      // Could be array of strings or array of entries with type
      if (raw.providers.length > 0 && typeof raw.providers[0] === 'object') {
        for (const entry of raw.providers) {
          const provider = String(entry.provider || entry.name || '').toLowerCase() as ProviderKey;
          const type = (entry.type || entry.audio || '').toLowerCase(); // 'sub' | 'dub'
          if (!provider) continue;
          available.push(provider);
          if (type === 'sub' || type === 'dub') {
            if (!types![provider]) types![provider] = [];
            if (!types![provider]!.includes(type)) types![provider]!.push(type);
          }
        }
      } else {
        available = raw.providers.map((p: string) => p.toLowerCase()) as ProviderKey[];
      }
    } else {
      // e.g., { zoro: true, animepahe: false }
      available = (Object.keys(raw) as ProviderKey[]).filter((k) => Boolean((raw as any)[k]));
    }
  }

  const unique = Array.from(new Set(available)) as ProviderKey[];
  const filtered = unique.filter((p) => allowed.includes(p));
  // Filter types map to allowed providers only
  const filteredTypes: ProvidersForEpisode['types'] = {};
  for (const key of Object.keys(types || {}) as ProviderKey[]) {
    if (allowed.includes(key)) filteredTypes[key] = types?.[key];
  }
  return { episode: episodeNumber, available: filtered, types: filteredTypes };
}

export async function getStreams(
  animeId: string,
  episodeNumber: number,
  provider: ProviderKey,
  dub: boolean
): Promise<StreamSource[]> {
  const q = `/api/anime/watch/${animeId}/episodes/${episodeNumber}?provider=${provider}${dub ? '&dub=true' : ''}`;
  const res = await kfetch<any>(q, { retries: 1, timeoutMs: 20000 });
  const raw = res?.data ?? res;

  const toSource = (s: any): StreamSource | null => {
    if (!s) return null;
    const url: string = s.url ?? s.src ?? s.file ?? '';
    if (!url) return null;
    // Avoid double-proxying: if Kuroji already returned a proxied URL, keep as-is
    const isKurojiProxied = typeof url === 'string' && url.includes('/api/proxy?url=');
    const finalUrl = USE_PROXY_FOR_VIDEO && !isKurojiProxied ? buildProxyUrl(url) : url;
    const headers = s.headers && typeof s.headers === 'object' ? s.headers : undefined;
    const captions: StreamCaption[] | undefined = Array.isArray(s.captions)
      ? s.captions.map((c: any) => ({ url: c?.url ?? c?.file, lang: c?.lang ?? c?.language ?? 'und' })).filter((c) => c.url)
      : Array.isArray(s.subtitles)
      ? s.subtitles.map((c: any) => ({ url: c?.url ?? c?.file, lang: c?.lang ?? c?.language ?? 'und' })).filter((c) => c.url)
      : undefined;
    return {
      url: finalUrl,
      quality: s.quality ?? s.label ?? s.name,
      mime: s.mime ?? s.type,
      headers,
      captions,
      isDub: Boolean(s.isDub ?? dub),
    };
  };

  const arr: any[] = Array.isArray(raw) ? raw : Array.isArray(raw?.sources) ? raw.sources : raw?.url ? [raw] : [];
  const sources = arr.map(toSource).filter(Boolean) as StreamSource[];
  // Prefer HLS first for mobile playback stability
  sources.sort((a, b) => {
    const isHlsA = (a.mime?.includes('mpegurl') || a.url.includes('.m3u8')) ? 1 : 0;
    const isHlsB = (b.mime?.includes('mpegurl') || b.url.includes('.m3u8')) ? 1 : 0;
    if (isHlsA !== isHlsB) return isHlsB - isHlsA; // HLS first
    // Prefer 'auto' or highest quality fallback
    const score = (s?: string) => s === 'auto' ? 3 : s?.includes('1080') ? 2 : s?.includes('720') ? 1 : 0;
    return score(b.quality) - score(a.quality);
  });
  return sources;
}

// Raw unified watch fetch so callers can use headers/subtitles/intro/outro directly
export async function getWatch(
  animeId: string | number,
  episodeNumber: number,
  provider: ProviderKey,
  dub: boolean
): Promise<KurojiWatchPayload> {
  const basePath = joinPathSegments('api', 'anime', 'watch', String(animeId), 'episodes', String(episodeNumber));
  const query = `?provider=${provider}${dub ? '&dub=true' : ''}`;
  const urlPath = `/${basePath}${query}`;
  const data = await kfetch<any>(urlPath, { retries: 1, timeoutMs: 20000 });
  // Some deployments wrap under data
  return (data?.data ?? data) as KurojiWatchPayload;
}

// Optional: Anizip mappings for canonical episode numbers
export interface AnizipMappings {
  episodes: Array<{
    episode: number; // canonical
    from?: number; // raw start
    to?: number; // raw end
  }>;
}

export async function getAnizipMappings(anilistId: string | number): Promise<AnizipMappings | null> {
  try {
    const res = await kfetch<any>(`/api/anizip/mappings?anilist=${anilistId}`);
    const data = res?.data ?? res;
    if (!data) return null;
    const episodes = Array.isArray(data?.episodes) ? data.episodes : [];
    return { episodes };
  } catch {
    return null;
  }
}

export function applyAnizipMapping(episodes: EpisodeLite[], mappings: AnizipMappings | null): EpisodeLite[] {
  if (!mappings || !Array.isArray(mappings.episodes) || mappings.episodes.length === 0) return episodes;
  // Basic passthrough: assume numbers are already canonical in Kuroji; keep hook in place for future tweaks
  return episodes;
}

// Convenience high-level helpers
export async function resolveInfoAndEpisodes({ anilistId, title }: { anilistId?: string | number; title?: string }) {
  const id = await resolveAnimeId({ anilistId, title });
  if (!id) return { id: null, info: null, episodes: [] as EpisodeLite[] };
  const [info, eps] = await Promise.all([getAnimeInfo(id), getEpisodes(id)]);
  return { id, info, episodes: eps };
}

export default {
  kfetch,
  buildUrl,
  buildUrlFromSegments,
  joinPathSegments,
  buildProxyUrl,
  resolveAnimeId,
  getAnimeInfo,
  getEpisodes,
  getProvidersForEpisode,
  getStreams,
  getWatch,
  getAnizipMappings,
  applyAnizipMapping,
  resolveInfoAndEpisodes,
};


