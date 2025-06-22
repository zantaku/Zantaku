import { useState, useCallback } from 'react';
import { DeviceEventEmitter } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

const ANILIST_API_URL = 'https://graphql.anilist.co';
const STORAGE_KEY = {
  AUTH_TOKEN: 'auth_token',
  USER_DATA: 'user_data'
};

interface ProgressParams {
  mangaId: string;
  chapter: string;
  title: string;
  anilistId?: string;
}

export const useReadingProgress = () => {
  const [readingProgress, setReadingProgress] = useState(0);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [hasUpdatedProgress, setHasUpdatedProgress] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);

  // Update scroll progress directly (for continuous scrolling)
  const updateScrollProgress = useCallback((progress: number) => {
    setScrollProgress(progress);
    // Also update reading progress to match scroll progress
    setReadingProgress(progress);
  }, []);

  const updateProgress = useCallback((pageIndex: number, totalPages: number) => {
    // Only update if the page index actually changed
    setCurrentPageIndex(prevIndex => {
      if (prevIndex !== pageIndex) {
        const progress = Math.min((pageIndex / (totalPages - 1)) * 100, 100);
        setReadingProgress(Math.max(0, progress));
        return pageIndex;
      }
      return prevIndex;
    });
  }, []);

  const saveProgress = useCallback(async (
    params: ProgressParams,
    isIncognito: boolean,
    totalPages: number
  ) => {
    try {
      // Save progress locally regardless of incognito mode
      const key = `reading_progress_${params.mangaId}_${params.chapter}`;
      const progress = {
        page: currentPageIndex + 1,
        totalPages,
        lastRead: new Date().toISOString(),
        chapterTitle: params.title,
        isCompleted: currentPageIndex + 1 === totalPages
      };
      await AsyncStorage.setItem(key, JSON.stringify(progress));

      // Mark as completed if on last page
      if (currentPageIndex + 1 === totalPages) {
        const completedKey = `completed_${params.mangaId}_${params.chapter}`;
        await AsyncStorage.setItem(completedKey, 'true');
      }

      // Only sync with AniList if not in incognito mode
      if (!isIncognito) {
        const token = await SecureStore.getItemAsync(STORAGE_KEY.AUTH_TOKEN);
        if (token) {
          let anilistId = params.anilistId;
          
          // If anilistId is missing, search for the manga
          if (!anilistId) {
            const response = await fetch(`https://enoki-api.vercel.app/manganato/details/${params.mangaId}`);
            const data = await response.json();

            if (!data?.title) {
              throw new Error('Could not get manga title');
            }

            const searchResult = await searchMangaOnAniList(data.title);
            if (!searchResult.id) {
              throw new Error('Could not find manga on AniList');
            }

            anilistId = searchResult.id;
          }

          const chapterNumber = Array.isArray(params.chapter) 
            ? params.chapter[0].replace(/[^0-9]/g, '')
            : params.chapter.replace(/[^0-9]/g, '');

          const mutation = `
            mutation ($mediaId: Int, $progress: Int) {
              SaveMediaListEntry (mediaId: $mediaId, progress: $progress) {
                id
                progress
                media {
                  title {
                    userPreferred
                  }
                }
              }
            }
          `;

          const response = await fetch(ANILIST_API_URL, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
              'Accept': 'application/json',
            },
            body: JSON.stringify({
              query: mutation,
              variables: {
                mediaId: parseInt(String(anilistId)),
                progress: parseInt(chapterNumber)
              }
            })
          });

          const data = await response.json();
          if (data.errors) {
            throw new Error(data.errors[0].message);
          }
          
          // Emit events to refresh other parts of the app
          DeviceEventEmitter.emit('refreshMediaLists');
          DeviceEventEmitter.emit('refreshReadlist');
          
          return `Progress saved to AniList: Chapter ${chapterNumber}`;
        }
      }
      
      setHasUpdatedProgress(true);
      return 'Progress saved locally';
    } catch (err) {
      console.error('Error saving progress:', err);
      throw new Error('Failed to save progress' + (isIncognito ? '' : ' to AniList'));
    }
  }, [currentPageIndex]);

  const searchMangaOnAniList = useCallback(async (title: string) => {
    try {
      const query = `
        query ($search: String) {
          Media (search: $search, type: MANGA) {
            id
            title {
              romaji
              english
              native
              userPreferred
            }
          }
        }
      `;

      const response = await fetch(ANILIST_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          query,
          variables: {
            search: title
          }
        })
      });

      const data = await response.json();
      
      if (data?.data?.Media?.id) {
        return {
          id: data.data.Media.id,
          titles: data.data.Media.title
        };
      }
      return { id: null, titles: null };
    } catch (err) {
      console.error('Error searching manga on AniList:', err);
      return { id: null, titles: null };
    }
  }, []);

  return {
    readingProgress,
    currentPageIndex,
    hasUpdatedProgress,
    scrollProgress,
    updateProgress,
    updateScrollProgress,
    saveProgress,
    setHasUpdatedProgress,
  };
}; 