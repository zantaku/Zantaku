import { useState, useEffect } from 'react';
import axios from 'axios';

export interface Volume {
  id: string;
  title: string;
  number: string;
  epub: string;
  pdf: string;
  cover?: string;
}

interface NovelInfo {
  id: string;
  title: string;
  cover: string;
  status: string;
  type: string;
  translation: string;
  genres: string[];
  synopsis: string;
  volumes: Volume[];
  anilist: {
    rating: string;
    popularity: string;
  };
}

interface MangaTitle {
  english: string;
  userPreferred: string;
}

export function useNovelData(mangaTitle: MangaTitle, anilistId?: string) {
  const [loading, setLoading] = useState(true);
  const [volumes, setVolumes] = useState<Volume[]>([]);
  const [novelId, setNovelId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const searchNovel = async () => {
      try {
        setLoading(true);
        
        // First try with AniList ID if available
        if (anilistId) {
          const idSearchUrl = `https://jellee.vercel.app/novel/jellee/info?anilistId=${anilistId}`;
          try {
            const idResponse = await axios.get(idSearchUrl);
            if (idResponse.data?.data) {
              const novelInfo = idResponse.data.data;
              const formattedVolumes = formatVolumes(novelInfo);
              setVolumes(formattedVolumes);
              setNovelId(anilistId);
              setError(null);
              return;
            }
          } catch (idError) {
            console.log('AniList ID search failed, falling back to title search:', idError);
          }
        }

        // Try with userPreferred title
        const searchUrl = `https://jellee.vercel.app/novel/jellee/search?query=${encodeURIComponent(mangaTitle.userPreferred)}`;
        const searchResponse = await axios.get(searchUrl);

        // If no results with userPreferred, try English title
        if (!searchResponse.data?.data?.length && mangaTitle.english) {
          const englishSearchUrl = `https://jellee.vercel.app/novel/jellee/search?query=${encodeURIComponent(mangaTitle.english)}`;
          const englishSearchResponse = await axios.get(englishSearchUrl);

          if (englishSearchResponse.data?.data?.length) {
            const id = englishSearchResponse.data.data[0].id;
            const volumesUrl = `https://jellee.vercel.app/novel/jellee/info?id=${id}`;
            const volumesResponse = await axios.get(volumesUrl);

            if (volumesResponse.data?.data) {
              const novelInfo = volumesResponse.data.data;
              const formattedVolumes = formatVolumes(novelInfo);
              setVolumes(formattedVolumes);
              setNovelId(id);
              setError(null);
              return;
            }
          }
        } else if (searchResponse.data?.data?.length) {
          const id = searchResponse.data.data[0].id;
          const volumesUrl = `https://jellee.vercel.app/novel/jellee/info?id=${id}`;
          const volumesResponse = await axios.get(volumesUrl);

          if (volumesResponse.data?.data) {
            const novelInfo = volumesResponse.data.data;
            const formattedVolumes = formatVolumes(novelInfo);
            setVolumes(formattedVolumes);
            setNovelId(id);
            setError(null);
            return;
          }
        }

        setError('No novel found');
      } catch (err) {
        console.error('Error fetching novel volumes:', err);
        if (axios.isAxiosError(err)) {
          console.error('Response data:', err.response?.data);
          console.error('Response status:', err.response?.status);
        }
        setError('Failed to load volumes');
      } finally {
        setLoading(false);
      }
    };

    searchNovel();
  }, [mangaTitle, anilistId]);

  const formatVolumes = (novelInfo: NovelInfo): Volume[] => {
    return novelInfo.volumes.map(volume => ({
      id: volume.epub || volume.pdf,
      title: novelInfo.title,
      number: volume.number,
      epub: volume.epub,
      pdf: volume.pdf,
      cover: novelInfo.cover
    }));
  };

  return {
    loading,
    volumes,
    novelId,
    error
  };
} 