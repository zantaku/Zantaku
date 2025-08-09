import { useQuery } from '@tanstack/react-query';
import {
  ProviderKey,
  AnimeLite,
  EpisodeLite,
  ProvidersForEpisode,
  StreamSource,
  resolveAnimeId,
  getAnimeInfo,
  getEpisodes,
  getProvidersForEpisode,
  getStreams,
  getAnizipMappings,
  applyAnizipMapping,
} from '../api/kuroji';

// Query key helpers
const qk = {
  animeId: (title?: string, anilistId?: string | number) => ['kuroji', 'animeId', { title, anilistId }],
  info: (id: string) => ['kuroji', 'info', id],
  episodes: (id: string) => ['kuroji', 'episodes', id],
  mappings: (anilistId: string | number) => ['kuroji', 'anizip', anilistId],
  providers: (id: string, ep: number) => ['kuroji', 'providers', id, ep],
  streams: (id: string, ep: number, provider: ProviderKey, dub: boolean) => ['kuroji', 'streams', id, ep, provider, dub],
};

export function useAnimeId(title?: string, anilistId?: string | number) {
  return useQuery({
    queryKey: qk.animeId(title, anilistId),
    queryFn: async () => {
      const id = await resolveAnimeId({ anilistId, title });
      return id;
    },
    enabled: Boolean(title || anilistId),
    staleTime: 1000 * 60 * 60, // 1h
  });
}

export function useAnimeInfo(id?: string) {
  return useQuery<AnimeLite | null>({
    queryKey: id ? qk.info(id) : ['kuroji', 'info', 'disabled'],
    queryFn: () => getAnimeInfo(id as string),
    enabled: Boolean(id),
    staleTime: 1000 * 60 * 60, // 1h
  });
}

export function useEpisodes(id?: string, anilistIdForMapping?: string | number) {
  return useQuery<EpisodeLite[]>({
    queryKey: id ? qk.episodes(id) : ['kuroji', 'episodes', 'disabled'],
    queryFn: async () => {
      const eps = await getEpisodes(id as string);
      if (!anilistIdForMapping) return eps;
      const map = await getAnizipMappings(anilistIdForMapping);
      return applyAnizipMapping(eps, map);
    },
    enabled: Boolean(id),
    staleTime: 1000 * 60 * 10, // 10m
  });
}

export function useProviders(id?: string, ep?: number) {
  return useQuery<ProvidersForEpisode>({
    queryKey: id && typeof ep === 'number' ? qk.providers(id, ep) : ['kuroji', 'providers', 'disabled'],
    queryFn: () => getProvidersForEpisode(id as string, ep as number),
    enabled: Boolean(id && typeof ep === 'number'),
    staleTime: 1000 * 60 * 5, // 5m
  });
}

export function useStreams(id?: string, ep?: number, provider?: ProviderKey, dub: boolean = false) {
  return useQuery<StreamSource[]>({
    queryKey: id && typeof ep === 'number' && provider ? qk.streams(id, ep, provider, dub) : ['kuroji', 'streams', 'disabled'],
    queryFn: () => getStreams(id as string, ep as number, provider as ProviderKey, dub),
    enabled: Boolean(id && typeof ep === 'number' && provider),
    staleTime: 1000 * 60 * 2, // 2m
  });
}

export type { ProviderKey, AnimeLite, EpisodeLite, ProvidersForEpisode, StreamSource };


