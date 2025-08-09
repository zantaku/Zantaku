// Tiny Miruro API wrapper (MAL-first). Works with AniList too.

const BASE = "https://www.miruro.to/api";

export type ProviderKey = "animepahe" | "zoro" | "gogoanime" | "crunchyroll";
export type Category = "sub" | "dub";

export interface SearchItem {
  id: number; // AniList
  idMal?: number; // MAL
  title: {
    userPreferred?: string;
    english?: string;
    romaji?: string;
    native?: string;
  };
  coverImage?: { large?: string; medium?: string };
  type?: string; // "ANIME" | "MANGA"
}

export interface StreamsResponse {
  provider: string;
  streams: { url: string; type: "hls" | "mp4"; width?: number; height?: number }[];
  download?: string;
}

export interface InfoResponse {
  id: number; // AniList ID
  idMal?: number; // MAL ID
  title?: {
    userPreferred?: string;
    english?: string;
    romaji?: string;
    native?: string;
  };
  coverImage?: { large?: string; medium?: string };
  [key: string]: any;
}

async function http<T>(url: string): Promise<T> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`[Miruro] ${r.status} ${r.statusText} for ${url}`);
  return r.json();
}

/** 1) Search (AniList-first data; we’ll still prefer MAL id if present) */
export async function searchAnime(query: string, limit = 10): Promise<SearchItem[]> {
  const url = `${BASE}/search/browse?search=${encodeURIComponent(query)}&type=ANIME&sort=SEARCH_MATCH&page=1&perPage=${limit}`;
  return http<SearchItem[]>(url);
}

/**
 * 2) Episodes & provider mappings by MAL ID (preferred).
 * If you only have AniList, use getEpisodesByAniList as a fallback.
 *
 * NOTE: Response is a big object; what you usually need is:
 *  - MAPPINGS.providers.<PROVIDER>.provider_id[]   (series-level mapping)
 *  - TMDB.selectedSeason + episodes[]              (episode list, titles, etc.)
 */
export async function getEpisodesByMal(malId: number, ongoing = false): Promise<any> {
  const url = `${BASE}/episodes?malId=${malId}&ongoing=${ongoing}`;
  return http<any>(url);
}

/** Optional: same as above, but by AniList ID */
export async function getEpisodesByAniList(aniId: number, ongoing = false): Promise<any> {
  const url = `${BASE}/episodes?aniId=${aniId}&ongoing=${ongoing}`;
  return http<any>(url);
}

/** Get media info by AniList ID (includes idMal at top level) */
export async function getInfoByAniList(aniId: number): Promise<InfoResponse> {
  const url = `${BASE}/info/anilist/${aniId}`;
  return http<InfoResponse>(url);
}

/**
 * 3) Sources (stream URLs) by provider + provider episodeId (URL-ENCODED!).
 *
 * Typical provider keys:
 * - "zoro"        (HiAnime)
 * - "animepahe"
 * - "gogoanime"
 * - "crunchyroll"
 */
export async function getSources(
  episodeId: string, // e.g. "4722/ep-1" or "181444/episode-1"
  provider: ProviderKey,
  category: Category = "sub",
  ongoing = false
): Promise<StreamsResponse> {
  const ep = encodeURIComponent(episodeId); // IMPORTANT
  const url = `${BASE}/sources?episodeId=${ep}&provider=${provider}&category=${category}&ongoing=${ongoing}`;
  return http<StreamsResponse>(url);
}

/* ---------------------------- Helpers your dev will want ---------------------------- */

/**
 * Find a provider episodeId string for a given episode number.
 * The structure of the episodes blob can vary; this safely searches common places.
 */
export function pickProviderEpisodeId(
  episodesBlob: any,
  provider: ProviderKey,
  episodeNumber: number
): string | null {
  // Try TMDB episode list as the truthy episode sequence.
  const epList: any[] =
    episodesBlob?.TMDB?.episodes ??
    episodesBlob?.episodes ??
    episodesBlob?.TMDB?.selectedSeason?.episodes ??
    [];

  if (!Array.isArray(epList) || !epList.length) return null;

  // Heuristic: look for a place each ep stores provider ids (commonly “episodeId”, “id”, or nested “providers”)
  const target = epList.find((e) =>
    Number(e?.number ?? e?.episode_number ?? e?.ep ?? e?.Episode) === Number(episodeNumber)
  );

  if (!target) return null;

  // Common patterns we’ve seen:
  // 1) target.providers?.[provider]?.episodeId
  // 2) target[provider]?.episodeId
  // 3) target.episodeId    (already provider-specific)
  // 4) target.ids?.[provider]
  const candidates: (string | undefined)[] = [
    target?.providers?.[provider]?.episodeId,
    target?.[provider]?.episodeId,
    target?.ids?.[provider],
    target?.episodeId,
    target?.id,
  ];

  return (candidates.find((x) => typeof x === "string" && x.includes("/")) as string) || null;
}

/** Choose the "best" HLS stream (prefers highest resolution) */
export function pickBestHls(streams: StreamsResponse): string | null {
  const hls = streams.streams?.filter((s) => s.type === "hls") ?? [];
  if (!hls.length) return null;
  // Sort by height desc (fallback to width)
  hls.sort((a, b) => (b.height ?? 0) - (a.height ?? 0) || (b.width ?? 0) - (a.width ?? 0));
  return hls[0].url;
}


