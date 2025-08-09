import { useEffect, useMemo, useState } from 'react';
import { ANILIST_GRAPHQL_ENDPOINT } from '../constants/auth';

export interface SeasonEntry {
  id: string; // AniList ID as string for consistency with rest of app
  idMal?: number | null;
  title: {
    userPreferred: string;
    english?: string;
    romaji?: string;
    native?: string;
  };
  season?: 'WINTER' | 'SPRING' | 'SUMMER' | 'FALL';
  seasonYear?: number;
  format: 'TV' | 'MOVIE' | 'TV_SHORT' | 'OVA' | 'SPECIAL' | string;
  episodes?: number | null;
}

interface UseSeasonsResult {
  seasons: SeasonEntry[];
  loading: boolean;
  error: string | null;
}

const SEASON_ORDER: Record<string, number> = {
  WINTER: 0,
  SPRING: 1,
  SUMMER: 2,
  FALL: 3,
};

const FORMAT_PRIORITY: Record<string, number> = {
  TV: 0,
  TV_SHORT: 1,
  SPECIAL: 2,
  OVA: 3,
  MOVIE: 4,
};

export function useSeasons(anilistId?: string): UseSeasonsResult {
  const [seasons, setSeasons] = useState<SeasonEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!anilistId) {
      setSeasons([]);
      return;
    }

    let isCancelled = false;
    setLoading(true);
    setError(null);

    const query = `
      query Seasons($id: Int) {
        Media(id: $id, type: ANIME) {
          id
          idMal
          title { romaji english native userPreferred }
          season
          seasonYear
          format
          episodes
          relations {
            nodes {
              id
              idMal
              title { romaji english native userPreferred }
              season
              seasonYear
              format
              episodes
              relationType
              type
            }
          }
        }
      }
    `;

    fetch(ANILIST_GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables: { id: parseInt(anilistId, 10) } }),
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        const base = json?.data?.Media;
        if (!base) throw new Error('AniList media not found');

        const nodes: any[] = Array.isArray(base?.relations?.nodes) ? base.relations.nodes : [];

        // Filter related entries to the main watch order
        const allowedRelations = new Set(['SEQUEL', 'PREQUEL']);
        const allowedTypes = new Set(['ANIME']);
        const related = nodes.filter((n) => allowedTypes.has(n?.type) && allowedRelations.has(n?.relationType));

        // Build entries list (include base first)
        const entries: SeasonEntry[] = [
          {
            id: String(base.id),
            idMal: base.idMal ?? null,
            title: {
              userPreferred: base.title?.userPreferred || base.title?.english || base.title?.romaji || '',
              english: base.title?.english,
              romaji: base.title?.romaji,
              native: base.title?.native,
            },
            season: base.season || undefined,
            seasonYear: base.seasonYear || undefined,
            format: base.format || 'TV',
            episodes: base.episodes ?? null,
          },
          ...related.map((n: any) => ({
            id: String(n.id),
            idMal: n.idMal ?? null,
            title: {
              userPreferred: n.title?.userPreferred || n.title?.english || n.title?.romaji || '',
              english: n.title?.english,
              romaji: n.title?.romaji,
              native: n.title?.native,
            },
            season: n.season || undefined,
            seasonYear: n.seasonYear || undefined,
            format: n.format || 'TV',
            episodes: n.episodes ?? null,
          })),
        ];

        // Sort entries chronologically and by format priority
        const sorted = entries
          .slice()
          .sort((a, b) => {
            const ya = a.seasonYear ?? 0;
            const yb = b.seasonYear ?? 0;
            if (ya !== yb) return ya - yb;
            const sa = SEASON_ORDER[a.season || 'WINTER'] ?? 0;
            const sb = SEASON_ORDER[b.season || 'WINTER'] ?? 0;
            if (sa !== sb) return sa - sb;
            const fa = FORMAT_PRIORITY[a.format] ?? 99;
            const fb = FORMAT_PRIORITY[b.format] ?? 99;
            return fa - fb;
          });

        if (!isCancelled) setSeasons(sorted);
      })
      .catch((err) => {
        if (!isCancelled) setError(err?.message || 'Failed to fetch seasons');
      })
      .finally(() => {
        if (!isCancelled) setLoading(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [anilistId]);

  const memoed = useMemo(() => seasons, [seasons]);

  return { seasons: memoed, loading, error };
}

export default useSeasons;


