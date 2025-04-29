import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, FlatList, Platform, useColorScheme, ScrollView, Dimensions, StatusBar, DeviceEventEmitter } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useRouter, useNavigation } from 'expo-router';
import axios, { AxiosResponse } from 'axios';
import { Image as ExpoImage } from 'expo-image';
import { useTheme, lightTheme } from '../hooks/useTheme';
import { useIncognito } from '../hooks/useIncognito';
import { BlurView } from 'expo-blur';
import LottieView from 'lottie-react-native';
import { LinearGradient as ExpoLinearGradient } from 'expo-linear-gradient';
import Reanimated, { 
  useAnimatedStyle, 
  withRepeat, 
  withSequence,
  useSharedValue,
  withTiming,
  Easing,
  FadeIn,
  FadeOut
} from 'react-native-reanimated';
import { createShimmerPlaceholder } from 'react-native-shimmer-placeholder';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { KATANA_API_URL, KatanaProvider, MANGADEX_API_URL, MangaDexProvider } from '../api/proxy/providers/manga';

// Add BASE_API_URL constant
const BASE_API_URL = 'https://takiapi.xyz';

const ShimmerPlaceholder = createShimmerPlaceholder(ExpoLinearGradient);
const AnimatedLinearGradient = Reanimated.createAnimatedComponent(ExpoLinearGradient);
const ReanimatedTouchableOpacity = Reanimated.createAnimatedComponent(TouchableOpacity);

interface ChapterSourcesModalProps {
  visible: boolean;
  onClose: () => void;
  chapter: {
    id: string;
    number: string;
    title: string;
    url: string;
    source?: string;
    isLatest?: boolean;
  } | null;
  mangaTitle: {
    english: string;
    userPreferred: string;
  };
  mangaId: string;
  countryOfOrigin?: string;
  autoLoad?: boolean;
  currentReader?: 'webnovel' | 'manga';
  existingParams?: Record<string, any>;
  anilistId?: string;
}

interface ImageHeaders {
  [key: string]: string;
  'Referer': string;
  'User-Agent': string;
}

interface PrefetchOptions {
  headers: ImageHeaders;
}

interface KatanaSearchResult {
  title: string;
  slugId: string;
  url?: string;
}

const imageHeaders: ImageHeaders = {
  'Referer': 'https://readmanganato.com/',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
};

interface AutoSelectPillProps {
  visible: boolean;
  message: string;
}

const AutoSelectPill: React.FC<AutoSelectPillProps> = ({ visible, message }) => {
  if (!visible) return null;

  return (
    <View style={pillStyles.container}>
      <Text style={pillStyles.text}>{message}</Text>
    </View>
  );
};

const pillStyles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 40,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: '#FFFFFF',
    fontSize: 16,
    textAlign: 'center',
  },
});

interface ProviderPreferences {
  defaultProvider: 'katana' | 'mangadex';
  autoSelectSource: boolean;
  preferredChapterLanguage: string;
  preferredScanlationGroup: string;
  showDataSaver: boolean;
  cacheImages: boolean;
  cacheDuration: number;
}

export default function ChapterSourcesModal({ 
  visible, 
  onClose, 
  chapter, 
  mangaTitle, 
  mangaId,
  countryOfOrigin,
  autoLoad,
  currentReader,
  existingParams = {},
  anilistId
}: ChapterSourcesModalProps) {
  const router = useRouter();
  const navigation = useNavigation();
  const [providerPreferences, setProviderPreferences] = useState<ProviderPreferences>({
    defaultProvider: 'katana',
    autoSelectSource: true,
    preferredChapterLanguage: 'en',
    preferredScanlationGroup: '',
    showDataSaver: false,
    cacheImages: true,
    cacheDuration: 7
  });

  // Load provider preferences
  useEffect(() => {
    const loadProviderPreferences = async () => {
      try {
        const providerData = await AsyncStorage.getItem('mangaProviderPreferences');
        if (providerData) {
          const preferences = JSON.parse(providerData);
          console.log('[ChapterModal] Loaded provider preferences:', preferences);
          setProviderPreferences(preferences);
        }
      } catch (error) {
        console.error('[ChapterModal] Failed to load provider preferences:', error);
      }
    };

    loadProviderPreferences();
    
    // Add listener for preference changes
    const preferenceListener = DeviceEventEmitter.addListener(
      'mangaProviderPreferencesChanged', 
      (newPreferences) => {
        console.log('[ChapterModal] Provider preferences changed:', newPreferences);
        setProviderPreferences(newPreferences);
      }
    );

    return () => {
      preferenceListener.remove();
    };
  }, []);

  const selectedChapter = useMemo(() => {
    if (!chapter) return null;

    let source;

    // Determine which source to use based on the loaded preferences
    if (providerPreferences.autoSelectSource === true) {
      // When auto-select is ON, use the source provided by ChapterList if available
      // (ChapterList already determined the best source based on chapter availability)
      source = chapter.source || providerPreferences.defaultProvider;
      console.log('[ChapterModal] Auto-select is ON, using source:', source);
    } else {
      // When auto-select is OFF, use the source from ChapterList
      source = chapter.source || providerPreferences.defaultProvider;
      console.log('[ChapterModal] Auto-select is OFF, using source from chapter:', source);
    }
    
    console.log('[ChapterModal] Selected provider:', source, '(autoSelect is', providerPreferences.autoSelectSource ? 'ON' : 'OFF', ')');
    console.log('[ChapterModal] Chapter source from ChapterList:', chapter.source);
    
    return {
      ...chapter,
      source,
      url: chapter.url || chapter.id
    };
  }, [chapter, providerPreferences]);

  // Define response type for Katana API
  interface KatanaResponse {
    success: boolean;
    data: any;
  }

  const fetchWithRetry = useCallback(async (url: string, retries = 3): Promise<{ success: boolean; data: any }> => {
    for (let i = 0; i < retries; i++) {
      try {
        const response = await axios.get(url);
        return {
          success: true,
          data: response.data
        };
      } catch (error: any) {
        if (i === retries - 1) {
          console.error(`[ChapterModal] Failed after ${retries} retries:`, error.message);
          return {
            success: false,
            data: null
          };
        }
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
      }
    }
    return {
      success: false,
      data: null
    };
  }, []);

  const fetchChapterPages = useCallback(async (chapterId: string) => {
    if (!mangaTitle) {
      console.log('[ChapterModal] No manga title available for search');
      return [];
    }

    if (!selectedChapter) {
      console.log('[ChapterModal] No chapter selected');
      return [];
    }

    const userPreferredTitle = mangaTitle.userPreferred || '';
    const englishTitle = mangaTitle.english || '';
    const source = selectedChapter.source; // Get the source directly
    
    console.log('[ChapterModal] Starting chapter search process:', {
      userPreferredTitle,
      englishTitle,
      chapterNumber: selectedChapter?.number,
      chapterId,
      source,
      mangaId, // Log the mangaId that was passed to the component
      autoSelectSource: providerPreferences.autoSelectSource,
      defaultProvider: providerPreferences.defaultProvider,
      preferredLanguage: providerPreferences.preferredChapterLanguage
    });
    
    if (!userPreferredTitle && !englishTitle) {
      console.log('[ChapterModal] No valid title available for search');
      return [];
    }

    // Track retries for resilience
    let retryCount = 0;
    const maxRetries = 2;
    
    while (retryCount <= maxRetries) {
      try {
        // Check which provider to use based on the determined source
        if (source === 'mangadex') {
          // Use MangaDex provider with preferred language
          console.log('[ChapterModal] Using MangaDex provider to fetch chapter');
          const mangadexUrl = MangaDexProvider.getChapterUrl(chapterId, providerPreferences.preferredChapterLanguage);
          console.log('[ChapterModal] Fetching MangaDex chapter:', mangadexUrl);
          console.log('[ChapterModal] Using preferred language:', providerPreferences.preferredChapterLanguage);

          try {
            const response = await fetch(mangadexUrl, {
              headers: MangaDexProvider.getHeaders()
            });

            if (response.ok) {
              const responseText = await response.text();
              try {
                const responseData = JSON.parse(responseText);
                const images = MangaDexProvider.parseChapterPagesResponse(responseData);
                if (images.length > 0) {
                  return images;
                } else {
                  throw new Error('No images in MangaDex response');
                }
              } catch (parseError) {
                console.error('[ChapterModal] JSON parse error:', parseError);
                console.log('[ChapterModal] Response text preview:', responseText.substring(0, 100));
                throw new Error('Failed to parse MangaDex response');
              }
            }
            throw new Error(`Failed to fetch MangaDex chapter: ${response.status}`);
          } catch (fetchError: any) {
            console.error('[ChapterModal] Fetch error:', fetchError.message);
            throw fetchError;
          }
        } else if (source === 'katana') {
          console.log('[ChapterModal] Using Katana provider to fetch chapter');
          
          // IMPORTANT FIX: Use mangaId directly instead of searching
          // This prevents issues with searching by chapter title like "Chapter 86"
          if (mangaId) {
            console.log('[ChapterModal] Using provided mangaId directly:', mangaId);
            
            // Extract chapter number or use the passed chapter number
            let katanaChapterId;
            
            // Format the chapter ID properly for Katana API
            if (selectedChapter.number) {
              // Make sure chapter number has 'c' prefix for Katana API
              katanaChapterId = selectedChapter.number.startsWith('c') 
                ? selectedChapter.number 
                : `c${selectedChapter.number}`;
            } else {
              // Try to extract from the chapterId parameter
              const match = chapterId.match(/c(\d+(\.\d+)?)/);
              if (match) {
                katanaChapterId = match[0];
              } else {
                katanaChapterId = `c${chapterId.replace(/\D/g, '')}`;
              }
            }
            
            console.log('[ChapterModal] Using Katana chapter ID:', katanaChapterId);
            
            // Construct the chapter URL directly using mangaId
            const chapterUrl = `${KATANA_API_URL}/katana/series/${mangaId}/${katanaChapterId}`;
            console.log('[ChapterModal] Fetching chapter pages from:', chapterUrl);
            
            // Use the fetchWithFallback method for chapter fetch
            const chapterResponse = await KatanaProvider.fetchWithFallback(
              chapterUrl,
              userPreferredTitle,
              false, // isMangaSearch
              true,  // isChapterFetch
              katanaChapterId // chapterId
            );
            
            if (!chapterResponse.success || !chapterResponse.data) {
              console.log('[ChapterModal] Failed to fetch chapter pages', 
                chapterResponse ? `Error: ${JSON.stringify(chapterResponse).substring(0, 200)}...` : 'No response data');
              throw new Error('Failed to fetch chapter data from Katana');
            }
            
            const responseData = chapterResponse.data;
            console.log('[ChapterModal] Raw chapter response data:', JSON.stringify(responseData).substring(0, 300));
            
            const isLatestChapter = KatanaProvider.isLatestChapter(responseData);
            
            if (selectedChapter) {
              selectedChapter.isLatest = isLatestChapter;
            }
            
            const images = KatanaProvider.parseChapterResponse(responseData);
            console.log('[ChapterModal] Processed', images.length, 'images');
            
            if (images.length === 0) {
              console.log('[ChapterModal] No images found in chapter response. Full response:', 
                JSON.stringify(responseData).substring(0, 500));
              throw new Error('No images found in Katana response');
            }
            
            return images;
          }
          // FALLBACK: If no mangaId is provided, use the original search method
          else {
            console.log('[ChapterModal] No mangaId provided, falling back to title search');
            
            // Original search code can be left here as fallback
            // The rest of your existing code for searching
            // ...

          }
        } else {
          console.error('[ChapterModal] Unknown source:', source);
          throw new Error(`Unknown provider source: ${source}`);
        }
      } catch (error: any) {
        retryCount++;
        console.error(`[ChapterModal] Error fetching chapter pages (attempt ${retryCount}/${maxRetries+1}):`, error.message);
        
        if (retryCount > maxRetries) {
          console.error('[ChapterModal] All retry attempts failed');
          console.error('[ChapterModal] Error stack:', error.stack?.substring(0, 200));
          return [];
        }
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
        console.log(`[ChapterModal] Retrying fetch (attempt ${retryCount+1}/${maxRetries+1})...`);
      }
    }
    
    return [];
  }, [mangaTitle, selectedChapter, providerPreferences, mangaId]);

  const fetchInitialPages = useCallback(async () => {
    if (!selectedChapter || !visible) {
      console.log('[ChapterModal] No chapter provided or modal not visible');
      return;
    }

    console.log('[ChapterModal] Starting fetchInitialPages for chapter:', {
      id: selectedChapter.id,
      number: selectedChapter.number,
      title: selectedChapter.title,
      source: selectedChapter.source
    });

    // Explicitly log provider information
    console.log('[ChapterModal] Current provider settings:', {
      defaultProvider: providerPreferences.defaultProvider,
      autoSelectSource: providerPreferences.autoSelectSource,
      selectedSource: selectedChapter.source,
      preferredLanguage: providerPreferences.preferredChapterLanguage
    });

    // Clear previous state for the new chapter
    setPages([]);
    setPageUrls([]);
    setLoadedPages(0);
    
    if (typeof setProcessedImages === 'function') {
      setProcessedImages(0);
    }
    
    if (typeof setTotalImages === 'function') {
      setTotalImages(0);
    }
    
    // Set loading state
    setLoading(true);
    setLoadingProgress(0);
    setError(null);

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    // Force reset currentChapterRef to ensure fresh fetch
    currentChapterRef.current = null;
    currentChapterRef.current = selectedChapter.id;

    try {
      // Use the correct API name based on the source
      const apiName = selectedChapter.source === 'mangadex' ? 'MangaDex' : 'Katana';
      console.log(`[ChapterModal] Fetching chapter ${selectedChapter.number} pages from ${apiName} API`);

      // Determine the correct chapter ID to use
      let chapterId = selectedChapter.id;
      
      // If ID contains the full manga slug path, extract just the chapter part
      if (chapterId.includes('/')) {
        // It already has the proper format like "manga-slug/c123"
        console.log('[ChapterModal] Using chapter ID with path:', chapterId);
      } else if (chapterId.startsWith('c')) {
        // It's just a chapter number like "c123", we need to add manga ID
        if (mangaId && mangaId.includes('katana')) {
          chapterId = `${mangaId}/${chapterId}`;
          console.log('[ChapterModal] Constructed full path:', chapterId);
        }
      } else {
        // Try to construct from what we have
        // First check if this looks like a slug ID
        if (chapterId.includes('.')) {
          // Might be a slug ID like "manga-name.12345"
          const chapterNum = selectedChapter.number;
          chapterId = `${chapterId}/c${chapterNum}`;
          console.log('[ChapterModal] Constructed path from slug:', chapterId);
        }
      }

      // Try multiple approaches to fetch chapter pages with proper fallbacks
      let pages = [];
      let errorMessage = '';
      let hasTriedFallbacks = false;
      
      // First attempt - use the standard fetchChapterPages
      try {
        pages = await fetchChapterPages(chapterId);
        
        if (pages.length > 0) {
          console.log(`[ChapterModal] Successfully loaded ${pages.length} pages on first attempt`);
        } else {
          console.log('[ChapterModal] No pages returned from first attempt, trying fallbacks');
          hasTriedFallbacks = true;
          errorMessage = 'No images returned from initial API request';
        }
      } catch (error: any) {
        console.error('[ChapterModal] First attempt failed:', error.message);
        errorMessage = error.message;
        hasTriedFallbacks = true;
      }
      
      // If first attempt failed, try alternative approaches
      if (hasTriedFallbacks && pages.length === 0) {
        console.log('[ChapterModal] Trying alternative fetching approaches');
        
        // Try a direct Katana API call with the right format
        if (selectedChapter.source === 'katana' && mangaId) {
          try {
            // Format the chapter number for Katana API
            let katanaChapterNum = selectedChapter.number;
            if (!katanaChapterNum.startsWith('c')) {
              katanaChapterNum = `c${katanaChapterNum}`;
            }
            
            // Try both the numeric ID and any AniList ID
            const possibleIds = [mangaId];
            if (anilistId) possibleIds.push(anilistId);
            
            // Try each possible ID
            for (const id of possibleIds) {
              if (pages.length > 0) break; // Stop if we already have pages
              
              console.log(`[ChapterModal] Trying direct Katana fetch with ID: ${id}, chapter: ${katanaChapterNum}`);
              const katanaUrl = `${KATANA_API_URL}/katana/series/${id}/${katanaChapterNum}`;
              
              try {
                const response = await fetch(katanaUrl);
                if (response.ok) {
                  const data = await response.json();
                  
                  if (data.success && data.data && data.data.imageUrls && Array.isArray(data.data.imageUrls)) {
                    pages = data.data.imageUrls.map((img: { proxyUrl: string }) => `${KATANA_API_URL}${img.proxyUrl}`);
                    console.log(`[ChapterModal] Successfully loaded ${pages.length} pages from direct Katana API`);
                    break;
                  }
                }
              } catch (e) {
                console.error(`[ChapterModal] Direct Katana fetch failed for ID ${id}:`, e);
              }
            }
          } catch (katanaError: any) {
            console.error('[ChapterModal] Katana fallback failed:', katanaError.message);
          }
        }
        
        // If still no pages and we have a MangaDex ID, try directly with MangaDex
        if (pages.length === 0 && selectedChapter.id) {
          try {
            console.log('[ChapterModal] Trying direct MangaDex as fallback for chapter:', selectedChapter.id);
            // When auto-select is ON but Katana failed, try MangaDex directly
            const mangadexUrl = MangaDexProvider.getChapterUrl(selectedChapter.id, providerPreferences.preferredChapterLanguage);
            console.log('[ChapterModal] Fetching MangaDex chapter directly:', mangadexUrl);
            
            const response = await fetch(mangadexUrl, {
              headers: MangaDexProvider.getHeaders()
            });
            
            if (response.ok) {
              const responseData = await response.json();
              const images = MangaDexProvider.parseChapterPagesResponse(responseData);
              
              if (images && images.length > 0) {
                console.log(`[ChapterModal] Successfully loaded ${images.length} pages directly from MangaDex`);
                pages = images;
              }
            }
          } catch (mangadexError: any) {
            console.error('[ChapterModal] Direct MangaDex fallback failed:', mangadexError.message);
          }
        }
        
        // If still no pages, try the takiapi mangareader fallback
        if (pages.length === 0 && mangaId) {
          try {
            console.log('[ChapterModal] Trying takiapi mangareader as fallback');
            const takiapiUrl = `${BASE_API_URL}/manga/mangareader/read/${selectedChapter.id}`;
            
            const response = await fetch(takiapiUrl);
            if (response.ok) {
              const data = await response.json();
              
              // Check for both result.images (old API) and images (new API) formats
              const images = data?.result?.images || data?.images;
              
              if (images && Array.isArray(images)) {
                pages = images
                  .filter((img: { url: string } | string) => {
                    // Handle both object format {url: string} and direct string format
                    const imgUrl = typeof img === 'object' ? img.url : img;
                    return imgUrl && 
                      typeof imgUrl === 'string' && 
                      !imgUrl.includes('logo-chap.png') && 
                      !imgUrl.includes('gohome.png') &&
                      !imgUrl.includes('chapmanganato.to');
                  })
                  .map((img: { url: string } | string) => typeof img === 'object' ? img.url : img);
                
                console.log(`[ChapterModal] Successfully loaded ${pages.length} pages from takiapi mangareader`);
              }
            }
          } catch (takiapiError: any) {
            console.error('[ChapterModal] Takiapi mangareader fallback failed:', takiapiError.message);
          }
        }
      }

      if (!isMounted.current || currentChapterRef.current !== selectedChapter.id) {
        console.log('[ChapterModal] Component unmounted or chapter changed during fetch');
        return;
      }

      if (pages.length === 0) {
        console.log(`[ChapterModal] No pages returned from any API source`);
        throw new Error(errorMessage || 'Failed to load chapter images from all sources');
      }

      console.log(`[ChapterModal] Successfully loaded ${pages.length} pages`);
      setPageUrls(pages);
      setPages(pages);
      setLoadedPages(pages.length);
      
      if (typeof setTotalImages === 'function') {
        setTotalImages(pages.length);
      }
      
      setLoading(false);
      
      // Cache the successful result
      if (typeof window !== 'undefined') {
        try {
          const cacheKey = `chapter-${chapterId}`;
          localStorage.setItem(cacheKey, JSON.stringify({
            timestamp: Date.now(),
            pages: pages
          }));
          console.log(`[ChapterModal] Saved ${pages.length} pages to cache`);
        } catch (e) {
          console.log('[ChapterModal] Failed to cache pages:', e);
        }
      }
      
    } catch (error: any) {
      if (!isMounted.current || currentChapterRef.current !== selectedChapter.id) {
        return;
      }
      setLoading(false);
      setError(error.message || 'Failed to load chapter');
      console.error('[ChapterModal] Fetching initial pages failed:', {
        error: error.message,
        stack: error.stack?.substring(0, 100),
        status: error.status
      });
    }
  }, [selectedChapter, fetchChapterPages, mangaId, visible, anilistId, providerPreferences]);

  const { currentTheme: theme, isDarkMode } = useTheme();
  const { isIncognito } = useIncognito();
  const [loading, setLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [totalImages, setTotalImages] = useState(0);
  const [processedImages, setProcessedImages] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [pages, setPages] = useState<string[]>([]);
  const [loadedPages, setLoadedPages] = useState<number>(0);
  const [pageUrls, setPageUrls] = useState<string[]>([]);
  const [isClosing, setIsClosing] = useState(false);
  const [pillVisible, setPillVisible] = useState(false);
  const [pillMessage, setPillMessage] = useState('Loading chapter...');
  
  const PAGES_PER_BATCH = 25;
  const MAX_PARALLEL_LOADS = 10;
  const MAX_CACHE_ENTRIES = 20;
  const MAX_RETRIES = 3;
  const TIMEOUT_DURATION = 30000;
  const RETRY_DELAYS = [2000, 4000, 8000];
  
  const isMounted = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);
  const pageCache = useRef<{ [key: string]: string[] }>({});
  const currentChapterRef = useRef<string | null>(null);

  // Add a separate useEffect to track chapter.id changes
  useEffect(() => {
    if (!visible || !chapter?.id || isClosing) return;

    console.log('[ChapterModal] Chapter changed or modal became visible, fetching pages:', {
      chapterId: chapter.id,
      chapterNumber: chapter.number,
      source: selectedChapter?.source
    });
    
    // Cancel any pending fetches
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    
    // Only fetch when we have a valid selectedChapter with source
    if (selectedChapter?.id) {
      fetchInitialPages();
    }
  }, [chapter?.id, visible, selectedChapter, isClosing, fetchInitialPages]);

  // Clean up function to reset state
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      currentChapterRef.current = null;
    };
  }, []);

  const handleClose = useCallback(() => {
    // Cancel any ongoing fetches
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    // Reset loading states
    setLoading(false);
    setError(null);
    setIsClosing(true);
    
    // Call the parent onClose callback
    onClose();
    
    // If we have an ID and were loaded from the reader, navigate back to manga details
    if (existingParams?.fromReader === 'true') {
      console.log('[ChapterModal] Navigating back from reader');
      
      // Use DeviceEventEmitter to notify the manga details page to refresh
      DeviceEventEmitter.emit('refreshMangaDetails');
      
      const navigateToId = mangaId || anilistId;
      
      // Navigate back to the manga details page if we have an ID
      if (navigateToId) {
        console.log('[ChapterModal] Navigating to manga details:', navigateToId);
        router.replace(`/manga/${navigateToId}`);
      } else {
        console.warn('[ChapterModal] No ID available, using fallback navigation');
        try {
          router.replace('/(tabs)/@manga');
        } catch (e) {
          console.error('[ChapterModal] Failed to navigate to manga tab, going back instead:', e);
          router.back();
        }
      }
    }
  }, [mangaId, anilistId, onClose, router, existingParams]);

  const navigateToReader = useCallback(() => {
    if (pageUrls.length === 0) {
      console.log('No pages available to navigate');
      return;
    }

    try {
      console.log('Starting navigation with params:', {
        title: selectedChapter?.title,
        chapter: selectedChapter?.number,
        mangaId: mangaId,
        countryOfOrigin: countryOfOrigin,
        anilistId: anilistId,
        isLatest: selectedChapter?.isLatest
      });

      const params: Record<string, string> = {
        ...existingParams,
        title: selectedChapter?.title || '',
        chapter: selectedChapter?.number || '',
        mangaId: mangaId || '',
        anilistId: anilistId || '',
        shouldSaveProgress: (!isIncognito).toString(),
        isLatest: (selectedChapter?.isLatest || false).toString()
      };

      const maxImages = Math.min(pageUrls.length, 50);
      console.log(`Processing ${maxImages} images out of ${pageUrls.length} total images`);
      
      // Clear any existing image params
      Object.keys(params).forEach(key => {
        if (key.startsWith('image')) {
          delete params[key];
        }
      });
      
      // Add new image params
      for (let i = 0; i < maxImages; i++) {
        params[`image${i + 1}`] = pageUrls[i];
      }

      // Use webnovelreader if current reader is webnovel or if it's a KR/CN manga
      const useWebNovelReader = currentReader === 'webnovel' || countryOfOrigin === 'KR' || countryOfOrigin === 'CN';
      
      console.log('Navigation details:', {
        useWebNovelReader,
        currentReader,
        countryOfOrigin,
        targetPath: useWebNovelReader ? '/webnovelreader' : '/reader',
        params
      });

      router.replace({
        pathname: useWebNovelReader ? '/webnovelreader' : '/reader',
        params: params
      });

      onClose();
    } catch (error) {
      console.error('Error navigating to reader:', error);
      setError('Failed to open reader.');
    }
  }, [pageUrls, selectedChapter, mangaId, router, onClose, countryOfOrigin, currentReader, existingParams, isIncognito, anilistId]);

  const handlePagePress = useCallback(() => {
    navigateToReader();
  }, [navigateToReader]);

  const renderPage = useCallback(({ item, index }: { item: string; index: number }) => {
    return (
      <TouchableOpacity style={styles.pageItem} onPress={handlePagePress}>
        <View style={styles.pageImageContainer}>
          <ExpoImage
            source={{ 
              uri: item,
              headers: imageHeaders
            }}
            style={styles.pageImage}
            contentFit="cover"
            cachePolicy="memory-disk"
            transition={100}
            recyclingKey={`${selectedChapter?.id}-${index}`}
          />
          <View style={styles.pageNumberBadge}>
            <Text style={styles.pageNumberText}>Page {index + 1}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  }, [selectedChapter?.id, handlePagePress]);

  const keyExtractor = useCallback((item: string, index: number) => `page-${index}`, []);

  // Add useEffect for auto-navigation
  useEffect(() => {
    // Auto-navigate when images are loaded and autoLoad is true
    if (autoLoad && pageUrls.length > 0 && !loading && !error) {
      console.log('[ChapterModal] Auto-navigating to reader with', pageUrls.length, 'images');
      setPillMessage('Loading chapter...');
      setPillVisible(true);
      
      // Small delay to ensure everything is ready
      const timer = setTimeout(() => {
        navigateToReader();
      }, 500);
      
      return () => clearTimeout(timer);
    }
  }, [autoLoad, pageUrls.length, loading, error, navigateToReader]);

  // Skip rendering the modal UI completely if in auto-select mode
  if (autoLoad) {
    return (
      <AutoSelectPill 
        visible={pillVisible} 
        message={pillMessage} 
      />
    );
  }

  return (
    <Modal 
      visible={visible} 
      transparent={true} 
      animationType="slide" 
      onRequestClose={handleClose}
    >
      <View style={[
        styles.modalContainer,
        { backgroundColor: isDarkMode ? 'rgba(0, 0, 0, 0.9)' : 'rgba(0, 0, 0, 0.8)' }
      ]}>
        <View style={[
          styles.modalContent,
          { 
            backgroundColor: isDarkMode ? '#121212' : '#FFFFFF',
            maxHeight: Dimensions.get('window').height * 0.9
          }
        ]}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <FontAwesome5 name="times" size={20} color={isDarkMode ? '#FFFFFF' : '#000000'} />
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: isDarkMode ? '#FFFFFF' : '#000000' }]}>
              Chapter {selectedChapter?.number}
            </Text>
            <Text style={[styles.chapterTitle, { color: isDarkMode ? '#AAAAAA' : '#666666' }]}>
              {selectedChapter?.title || `Chapter ${selectedChapter?.number}`}
            </Text>
          </View>

          {loading && loadedPages === 0 ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#02A9FF" />
              <Text style={[styles.loadingText, { color: isDarkMode ? '#FFFFFF' : '#000000' }]}>
                Loading chapter...
              </Text>
            </View>
          ) : error ? (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity 
                style={styles.retryButton}
                onPress={() => selectedChapter && fetchInitialPages()}
              >
                <Text style={styles.retryButtonText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : pages.length > 0 ? (
            <>
              <FlatList
                data={pages}
                renderItem={renderPage}
                keyExtractor={keyExtractor}
                contentContainerStyle={styles.listContent}
                numColumns={2}
                showsVerticalScrollIndicator={false}
                removeClippedSubviews={true}
                initialNumToRender={PAGES_PER_BATCH}
                maxToRenderPerBatch={PAGES_PER_BATCH}
                windowSize={5}
              />
              <TouchableOpacity style={styles.readButton} onPress={handlePagePress}>
                <Text style={styles.readButtonText}>
                  Read Chapter ({pageUrls.length} pages)
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>No pages available.</Text>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
    width: '100%',
  },
  modalContent: {
    width: '100%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    paddingHorizontal: 16,
    paddingBottom: 0,
  },
  modalHeader: {
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(150, 150, 150, 0.2)',
  },
  closeButton: {
    position: 'absolute',
    top: 0,
    right: 0,
    padding: 8,
    zIndex: 10,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginRight: 40,
  },
  chapterTitle: {
    fontSize: 16,
    marginTop: 4,
    marginRight: 40,
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  errorContainer: {
    alignItems: 'center',
    padding: 32,
  },
  errorText: {
    color: '#ff4444',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: '#02A9FF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  listContent: {
    padding: 8,
  },
  pageItem: {
    flex: 1,
    margin: 8,
  },
  pageImageContainer: {
    aspectRatio: 0.7,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(150, 150, 150, 0.2)',
  },
  pageImage: {
    width: '100%',
    height: '100%',
  },
  pageNumberBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  pageNumberText: {
    color: '#fff',
    fontSize: 12,
  },
  readButton: {
    margin: 16,
    backgroundColor: '#02A9FF',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  readButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
}); 