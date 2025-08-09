import { EpisodeLite } from './kuroji';

export function normalizeEpisodesForUI(episodes: EpisodeLite[]) {
  // Provide a minimal normalized shape your UI can rely on
  return episodes
    .filter((e) => e && typeof e.number === 'number')
    .map((e) => ({
      id: `ep-${e.number}`,
      number: e.number,
      title: e.title ?? `Episode ${e.number}`,
      image: e.thumb,
      duration: e.duration,
      aired: e.airDate,
    }));
}


