import {
  AnimeLite,
  EpisodeLite,
  ProvidersForEpisode,
  StreamSource,
  ProviderKey,
  resolveAnimeId,
  getAnimeInfo,
  getEpisodes,
  getProvidersForEpisode,
  getStreams,
  getAnizipMappings,
  applyAnizipMapping,
} from './kuroji';

// Thin facade so UI can remain provider-agnostic
export async function resolveId(title?: string, anilistId?: string | number) {
  return resolveAnimeId({ anilistId, title });
}

export async function fetchInfo(id: string): Promise<AnimeLite | null> {
  return getAnimeInfo(id);
}

export async function fetchEpisodes(id: string, anilistIdForMapping?: string | number): Promise<EpisodeLite[]> {
  const eps = await getEpisodes(id);
  if (!anilistIdForMapping) return eps;
  const map = await getAnizipMappings(anilistIdForMapping);
  return applyAnizipMapping(eps, map);
}

export async function fetchProviders(id: string, ep: number): Promise<ProvidersForEpisode> {
  return getProvidersForEpisode(id, ep);
}

export async function fetchStreams(id: string, ep: number, provider: ProviderKey, dub: boolean): Promise<StreamSource[]> {
  return getStreams(id, ep, provider, dub);
}

export type { AnimeLite, EpisodeLite, ProvidersForEpisode, StreamSource, ProviderKey };


