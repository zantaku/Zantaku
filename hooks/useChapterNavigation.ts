import { useState, useCallback, useEffect } from 'react';

interface Chapter {
  id: string;
  number: string;
  title: string;
  url: string;
}

interface ApiChapter {
  id: string;
  title: string;
}

export const useChapterNavigation = (mangaId: string, currentChapter: string) => {
  const [allChapters, setAllChapters] = useState<Chapter[]>([]);
  const [currentChapterIndex, setCurrentChapterIndex] = useState<number>(-1);
  const [hasNextChapter, setHasNextChapter] = useState(false);
  const [hasPreviousChapter, setHasPreviousChapter] = useState(false);

  const fetchChapters = useCallback(async () => {
    try {
      if (mangaId) {
        const response = await fetch(`https://enoki-api.vercel.app/manganato/details/${mangaId}`);
        const data = await response.json();
        
        if (data?.chapters && Array.isArray(data.chapters)) {
          const formattedChapters = data.chapters.map((ch: ApiChapter) => ({
            id: ch.id,
            number: ch.id.match(/chapter-(.+)/)?.[1] || '',
            title: ch.title,
            url: ch.id
          }));
          
          setAllChapters(formattedChapters);
          
          // Find current chapter index
          const index = formattedChapters.findIndex(
            (ch: Chapter) => ch.number === currentChapter
          );
          setCurrentChapterIndex(index);
          
          // Set navigation availability (chapters are in reverse order)
          setHasNextChapter(index > 0);
          setHasPreviousChapter(index < formattedChapters.length - 1);
        }
      }
    } catch (err) {
      console.error('Error fetching chapters:', err);
    }
  }, [mangaId, currentChapter]);

  const getChapterByType = useCallback((type: 'next' | 'previous') => {
    if (!allChapters || currentChapterIndex === -1) return null;
    
    const targetIndex = type === 'next' 
      ? currentChapterIndex - 1  // Next chapter (they're in reverse order)
      : currentChapterIndex + 1; // Previous chapter
    
    if (targetIndex >= 0 && targetIndex < allChapters.length) {
      const chapter = allChapters[targetIndex];
      return {
        ...chapter,
        url: chapter.id
      };
    }
    return null;
  }, [allChapters, currentChapterIndex]);

  useEffect(() => {
    fetchChapters();
  }, [fetchChapters]);

  return {
    allChapters,
    currentChapterIndex,
    hasNextChapter,
    hasPreviousChapter,
    getChapterByType,
  };
}; 