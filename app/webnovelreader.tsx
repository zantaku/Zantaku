import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { View, StyleSheet, Platform, StatusBar, TouchableOpacity, Modal, Text, NativeScrollEvent, NativeSyntheticEvent, Switch, Dimensions, Animated, ScrollView, FlatList } from 'react-native';
import Slider from '@react-native-community/slider';
import Reanimated, { 
  useSharedValue, 
  useAnimatedStyle, 
  useAnimatedGestureHandler,
  withTiming, 
  withSpring,
  runOnJS
} from 'react-native-reanimated';
import { PanGestureHandler } from 'react-native-gesture-handler';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { FontAwesome5 } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { FlashList } from '@shopify/flash-list';
import { DeviceEventEmitter } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image as ExpoImage } from 'expo-image';

import { useOrientation } from '../hooks/useOrientation';
import { useIncognito } from '../hooks/useIncognito';
import { useImageLoader } from '../hooks/useImageLoader';
import { useChapterNavigation } from '../hooks/useChapterNavigation';
import { useReadingProgress } from '../hooks/useReadingProgress';
import { useTheme } from '../hooks/useTheme';

import WebtoonImage from '../components/WebtoonImage';
import ReaderUI from '../components/ReaderUI';
import ChapterSourcesModal from '../components/ChapterSourcesModal';


const WINDOW_HEIGHT = Dimensions.get('window').height;
const WINDOW_WIDTH = Dimensions.get('window').width;

// Reduced memory constants for better performance
const INITIAL_LOAD_COUNT = 2; // Reduced from 5 to 2
const PRELOAD_BUFFER = 1; // Reduced from 3 to 1
const MAX_CACHE_SIZE = 20; // Maximum number of images to keep in memory

interface Chapter {
  id: string;
  number: string;
  title: string;
  url: string;
  source: string;
}

export default function WebNovelReader() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const flashListRef = useRef<FlatList<string>>(null);
  const lastScrollTime = useRef<number>(0);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastUpdatedPage = useRef<number>(-1);
  const mangaIdRef = useRef<string | null>(null);
  const isMounted = useRef(true);
  
  // State
  const [images, setImages] = useState<string[]>([]);
  const [showUI, setShowUI] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showExitModal, setShowExitModal] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showNotification, setShowNotification] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState('');
  const [shouldSaveProgress, setShouldSaveProgress] = useState(false);
  const [pendingNextChapter, setPendingNextChapter] = useState(false);
  const [navigationType, setNavigationType] = useState<'next' | 'previous' | null>(null);
  
  // Chapter navigation modal state
  const [showChapterModal, setShowChapterModal] = useState(false);
  const [selectedChapter, setSelectedChapter] = useState<Chapter | null>(null);

  
  // Progressive loading state - simplified
  const [loadedImageIndices, setLoadedImageIndices] = useState<Set<number>>(new Set());
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);
  
  // Zoom state
  const [isZoomed, setIsZoomed] = useState(false);
  const [zoomScale, setZoomScale] = useState(1);
  const zoomAnimatedValue = useRef(new Animated.Value(1)).current;
  
  // Pan gesture state for dragging when zoomed
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  
  // Settings state
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [shouldAutoSave, setShouldAutoSave] = useState(false);
  const [debugMode, setDebugMode] = useState(false);
  const [debugLevel, setDebugLevel] = useState(1);
  const [showDebugDropdown, setShowDebugDropdown] = useState(false);
  
  // Simplified webtoon reader preferences
  const [webtoonReaderPreferences, setWebtoonReaderPreferences] = useState({
    readingDirection: 'vertical' as 'vertical',
    rememberPosition: true,
    autoNavigateNextChapter: true,
    keepScreenOn: true,
    showPageNumber: true,
    tapToNavigate: true,
    zoomEnabled: true,
    preloadPages: 3, // Reduced from 5 to 3
    scrollSpeed: 1.0,
    autoScrollEnabled: false,
    autoScrollSpeed: 2,
    debugMode: false,
    appearance: {
      backgroundColor: '#000000',
      pageGap: 8,
      imageQuality: 'medium' as 'high' | 'medium' | 'low' // Changed from high to medium
    }
  });

  // Local navigation state for fallback
  const [localHasNextChapter, setLocalHasNextChapter] = useState(false);
  const [localHasPreviousChapter, setLocalHasPreviousChapter] = useState(false);

  // Hooks
  const { unlockOrientation, lockPortrait } = useOrientation();
  const { isIncognito } = useIncognito();
  const { currentTheme: theme, isDarkMode } = useTheme();
  const imageLoader = useImageLoader(images.length);
  const chapterNav = useChapterNavigation(params.mangaId as string, params.chapter as string);
  const progressTracker = useReadingProgress();

  // Helper function to get current mangaId consistently
  const getCurrentMangaId = useCallback(() => {
    return mangaIdRef.current || params.mangaId as string || params.anilistId as string;
  }, [params.mangaId, params.anilistId]);

  // Memoized image headers to prevent recreation
  const imageHeaders = useMemo(() => {
    // Extract headers from params if available
    const headerKeys = Object.keys(params).filter(key => key.startsWith('header'));
    if (headerKeys.length > 0) {
      try {
        const firstHeaderKey = headerKeys[0];
        const headerData = JSON.parse(params[firstHeaderKey] as string);
        return headerData;
      } catch (error) {
        console.warn('[WebNovelReader] Failed to parse headers from params:', error);
      }
    }
    
    // Default headers based on the image URLs
    const firstImage = images[0];
    if (firstImage && firstImage.includes('mangafire')) {
      return {
        'Referer': 'https://mangafire.to/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      };
    }
    
    // Fallback headers
    return {
      'Referer': 'https://mangakatana.com/',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Origin': 'https://mangakatana.com'
    };
  }, [params, images.length > 0 ? images[0] : '']); // Only depend on first image

  // Memoize chapter navigation handlers
  const nextChapter = useMemo(() => chapterNav.getChapterByType('next'), [chapterNav]);
  const previousChapter = useMemo(() => chapterNav.getChapterByType('previous'), [chapterNav]);

  // Extract mangaId from previous route or params when component mounts
  useEffect(() => {
    const extractMangaId = async () => {
      if (!isMounted.current) return;
      
      try {
        // First try to get mangaId from params
        if (params.mangaId && typeof params.mangaId === 'string') {
          console.log('Storing mangaId from params:', params.mangaId);
          mangaIdRef.current = params.mangaId;
          await AsyncStorage.setItem('current_manga_id', params.mangaId);
          
          // Store the AniList ID mapping if available
          if (params.anilistId && typeof params.anilistId === 'string') {
            console.log('Storing AniList ID mapping:', params.anilistId, 'for manga:', params.mangaId);
            await AsyncStorage.setItem(`anilist_id_for_${params.mangaId}`, params.anilistId);
          }
          return;
        }
        
        // Check if we have an existingParams object with mangaId
        if (params.existingParams && typeof params.existingParams === 'string') {
          try {
            const existingParams = JSON.parse(params.existingParams);
            if (existingParams.mangaId) {
              console.log('Storing mangaId from existingParams:', existingParams.mangaId);
              mangaIdRef.current = existingParams.mangaId;
              await AsyncStorage.setItem('current_manga_id', existingParams.mangaId);
              return;
            }
          } catch (e) {
            console.warn('Failed to parse existingParams:', e);
          }
        }
        
        // If not in params, check if we stored it in AsyncStorage previously
        const storedMangaId = await AsyncStorage.getItem('current_manga_id');
        if (storedMangaId) {
          console.log('Retrieved mangaId from storage:', storedMangaId);
          mangaIdRef.current = storedMangaId;
          return;
        }
        
        // Use anilistId as a fallback
        if (params.anilistId && typeof params.anilistId === 'string') {
          console.log('Storing anilistId as fallback for mangaId:', params.anilistId);
          mangaIdRef.current = params.anilistId;
          await AsyncStorage.setItem('current_manga_id', params.anilistId);
          return;
        }
        
        console.warn('Could not find mangaId from any source');
      } catch (error) {
        console.error('Error extracting mangaId:', error);
      }
    };
    
    extractMangaId();
  }, [params.mangaId, params.anilistId, params.existingParams]);

  // Optimized progressive loading function with memory management
  const loadImagesAroundCurrentView = useCallback(async (currentIndex: number) => {
    if (images.length === 0 || !isMounted.current) return;
    
    const indicesToLoad: number[] = [];
    
    // Load current view and buffer around it
    for (let i = Math.max(0, currentIndex - PRELOAD_BUFFER); 
         i <= Math.min(images.length - 1, currentIndex + PRELOAD_BUFFER); 
         i++) {
      if (!loadedImageIndices.has(i)) {
        indicesToLoad.push(i);
      }
    }
    
    // Memory management: Remove old images if we exceed cache limit
    if (loadedImageIndices.size > MAX_CACHE_SIZE) {
      const indicesToRemove: number[] = [];
      loadedImageIndices.forEach(index => {
        if (Math.abs(index - currentIndex) > PRELOAD_BUFFER * 2) {
          indicesToRemove.push(index);
        }
      });
      
      if (indicesToRemove.length > 0) {
        setLoadedImageIndices(prev => {
          const newSet = new Set(prev);
          indicesToRemove.forEach(index => newSet.delete(index));
          return newSet;
        });
        
        // Clear image cache for removed indices
        indicesToRemove.forEach(index => {
          if (images[index]) {
            ExpoImage.clearMemoryCache();
          }
        });
      }
    }
    
    if (indicesToLoad.length > 0) {
      // Batch load with reduced concurrency
      const batchSize = 2; // Process only 2 images at a time
      for (let i = 0; i < indicesToLoad.length; i += batchSize) {
        if (!isMounted.current) break;
        
        const batch = indicesToLoad.slice(i, i + batchSize);
        const loadPromises = batch.map(async (index) => {
          if (loadedImageIndices.has(index) || index >= images.length || !isMounted.current) {
            return;
          }
          
          try {
            const imageUrl = images[index];
            
            await ExpoImage.prefetch(imageUrl, {
              headers: imageHeaders,
              cachePolicy: 'memory'
            });
            
            if (isMounted.current) {
              setLoadedImageIndices(prev => new Set([...prev, index]));
            }
          } catch (error) {
            if (error instanceof Error) {
              console.warn(`[WebNovelReader] Failed to preload image ${index + 1}:`, error.message);
            }
          }
        });
        
        await Promise.allSettled(loadPromises);
        
        // Small delay between batches to prevent overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      
      // Update loading progress
      if (isMounted.current) {
        const totalLoaded = loadedImageIndices.size + indicesToLoad.filter(i => loadedImageIndices.has(i)).length;
        setLoadingProgress((totalLoaded / images.length) * 100);
      }
    }
  }, [images, imageHeaders, loadedImageIndices]);

  // Chapter navigation - optimized
  const handleChapterNavigation = useCallback(async (type: 'next' | 'previous') => {
    if (!isMounted.current) return;
    
    const currentChapterNum = parseFloat(String(params.chapter));
    if (isNaN(currentChapterNum)) return;
    
    const targetChapterNum = type === 'next' 
      ? currentChapterNum + 1 
      : currentChapterNum - 1;
    
    if (targetChapterNum <= 0) return;
    
    // Create a chapter object for the modal
    const targetChapter: Chapter = {
      id: `chapter-${targetChapterNum}`,
      number: String(targetChapterNum),
      title: `Chapter ${targetChapterNum}`,
      url: '',
      source: 'unknown'
    };
    
    setNavigationType(type);
    setSelectedChapter(targetChapter);
    
    try {
      // Check if we need to show save modal for next chapter navigation
      if (type === 'next' && !progressTracker.hasUpdatedProgress && !isIncognito) {
        const shouldAutoSave = await AsyncStorage.getItem('autoSaveProgress');
        const showProgressModalPref = await AsyncStorage.getItem('showProgressModal');
        const shouldShowProgressModal = showProgressModalPref !== 'false';
        
        if (shouldAutoSave === 'true') {
          // Auto-save and go directly to chapter modal
          await progressTracker.saveProgress(
            {
              mangaId: getCurrentMangaId(),
              chapter: params.chapter as string,
              title: params.title as string,
              anilistId: params.anilistId as string,
            },
            isIncognito,
            images.length
          );
          if (isMounted.current) {
            setShowChapterModal(true);
          }
        } else if (shouldShowProgressModal) {
          // Show save modal first
          if (isMounted.current) {
            setShowSaveModal(true);
            setPendingNextChapter(true);
          }
        } else {
          // Auto-save when progress modal is disabled
          await progressTracker.saveProgress(
            {
              mangaId: getCurrentMangaId(),
              chapter: params.chapter as string,
              title: params.title as string,
              anilistId: params.anilistId as string,
            },
            isIncognito,
            images.length
          );
          if (isMounted.current) {
            setShowChapterModal(true);
          }
        }
      } else {
        // For previous chapter or when progress is already saved, go directly to chapter modal
        if (isMounted.current) {
          setShowChapterModal(true);
        }
      }
    } catch (error) {
      console.error('Error in chapter navigation:', error);
      // On error, still show the chapter modal
      if (isMounted.current) {
        setShowChapterModal(true);
      }
    }
  }, [params.chapter, params.title, params.anilistId, isIncognito, progressTracker, images.length, getCurrentMangaId]);

  // Load images from params with better error handling
  useEffect(() => {
    const loadImages = async () => {
      if (!isMounted.current) return;
      
      // Add dev warnings for missing essential props
      if (__DEV__) {
        if (!params.chapter) {
          console.warn('⚠️ Missing chapter number. Reader may not work properly.');
        }
        if (!params.mangaId && !params.anilistId) {
          console.warn('⚠️ Missing mangaId/anilistId. Reader may not work properly.');
        }
        if (!params.image1) {
          console.warn('⚠️ Missing image1. No images to load.');
        }
      }
      
      try {
        const imageUrls: string[] = [];
        let index = 1;

        // Extract all image URLs from params
        while (params[`image${index}`]) {
          const imageUrl = params[`image${index}`] as string;
          imageUrls.push(imageUrl);
          index++;
        }

        if (imageUrls.length === 0) {
          console.error('❌ No images found in params. Available params:', Object.keys(params));
          throw new Error('No images found - check if image params are being passed correctly');
        }

                  console.log(`[WebNovelReader] ✅ Loaded ${imageUrls.length} images for chapter ${params.chapter}`);
          if (isMounted.current) {
            setImages(imageUrls);
            
            // Mark ALL images as ready to load immediately to fix loading issues
            const allLoadedSet = new Set<number>();
            for (let i = 0; i < imageUrls.length; i++) {
              allLoadedSet.add(i);
            }
            setLoadedImageIndices(allLoadedSet);
            setLoadingProgress(100); // All images ready to load
            setIsInitialLoading(false);
            
            console.log(`[WebNovelReader] ✅ Marked all ${allLoadedSet.size} images as ready to load immediately`);
          }
          
          // Set fallback chapter navigation based on chapter number
          const currentChapterNum = parseFloat(String(params.chapter));
          if (!isNaN(currentChapterNum) && isMounted.current) {
            // Always allow previous chapter if not chapter 1
            if (currentChapterNum > 1) {
              setLocalHasPreviousChapter(true);
            }
            
            // Always allow next chapter unless explicitly marked as latest
            if (params.isLatestChapter !== 'true') {
              setLocalHasNextChapter(true);
            }
          }
        
      } catch (err) {
        console.error('Error loading images:', err);
        if (isMounted.current) {
          setError('Failed to load chapter images');
          setIsInitialLoading(false);
        }
      }
    };

    loadImages();
  }, [
    params.image1, // Only depend on the first image to detect new chapters
    params.chapter,
    params.isLatestChapter
  ]);

  // Handle orientation
  useEffect(() => {
    unlockOrientation();
    return () => {
      lockPortrait();
    };
  }, [unlockOrientation, lockPortrait]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMounted.current = false;
      // Clear all timeouts
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
      // Clear image cache
      ExpoImage.clearMemoryCache();
    };
  }, []);

  // Handle zoom functionality
  const handleZoomToggle = useCallback(() => {
    if (isZoomed) {
      // Zoom out: restore UI and navigation, reset pan position
      setIsZoomed(false);
      setZoomScale(1);
      setShowUI(true);
      
      // Reset pan position
      translateX.value = withSpring(0);
      translateY.value = withSpring(0);
      
      Animated.timing(zoomAnimatedValue, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      // Zoom in: hide UI and disable navigation
      setIsZoomed(true);
      setZoomScale(2);
      setShowUI(false);
      
      Animated.timing(zoomAnimatedValue, {
        toValue: 2,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [isZoomed, zoomAnimatedValue, translateX, translateY]);

  // UI toggle
  const toggleUI = useCallback(() => {
    if (isZoomed) {
      // If zoomed, clicking should zoom out instead of toggling UI
      handleZoomToggle();
    } else {
      // Normal UI toggle when not zoomed
      setShowUI(prev => !prev);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, [isZoomed, handleZoomToggle]);

  // Handle back navigation
  const handleBack = useCallback(() => {
    // Skip save modal if in incognito mode, auto-save enabled, or progress already updated
    if (isIncognito || shouldAutoSave || progressTracker.hasUpdatedProgress) {
      DeviceEventEmitter.emit('refreshMangaDetails');
      router.back();
    } else {
      // Only show exit modal if not in incognito mode and progress hasn't been updated
      setShowExitModal(true);
    }
  }, [progressTracker.hasUpdatedProgress, router, isIncognito, shouldAutoSave]);

  // Optimized scroll handler with improved throttling and error handling
  const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!isMounted.current) return;
    
    const now = Date.now();
    
    // Increased throttle to 200ms for better performance on Android
    if (now - lastScrollTime.current < 200) {
      return;
    }
    lastScrollTime.current = now;

    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    
    // Clear any existing timeout
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }

    // Debounce the expensive calculations with longer delay
    scrollTimeoutRef.current = setTimeout(() => {
      if (!isMounted.current) return;
      
      try {
        // Calculate scroll progress percentage
        const scrollY = Math.max(0, contentOffset.y);
        const totalScrollHeight = Math.max(1, contentSize.height - layoutMeasurement.height);
        const scrollProgress = Math.min(100, Math.max(0, (scrollY / totalScrollHeight) * 100));
        
        // Calculate which image we're currently viewing
        const estimatedImageHeight = WINDOW_WIDTH * 1.4; // Assume typical webtoon aspect ratio
        const currentPage = Math.floor(scrollY / estimatedImageHeight);
        const validCurrentPage = Math.max(0, Math.min(currentPage, images.length - 1));
        
        // Update scroll progress
        progressTracker.updateScrollProgress(scrollProgress);
        
        // Also update page index if it changed
        if (validCurrentPage !== lastUpdatedPage.current && validCurrentPage >= 0 && validCurrentPage < images.length) {
          progressTracker.updateProgress(validCurrentPage, images.length);
          lastUpdatedPage.current = validCurrentPage;
        }

        // Check if we're at the bottom with larger buffer for better UX
        const isAtBottom = contentOffset.y + layoutMeasurement.height >= contentSize.height - 200;
        
        if (isAtBottom && (chapterNav.hasNextChapter || localHasNextChapter)) {
          // Throttle chapter navigation to prevent multiple triggers
          if (now - lastScrollTime.current > 1000) {
            handleChapterNavigation('next');
          }
        }
      } catch (error) {
        console.warn('[WebNovelReader] Error in scroll handler:', error);
      }
    }, 100); // Increased debounce for better performance
  }, [images.length, progressTracker, chapterNav.hasNextChapter, localHasNextChapter, handleChapterNavigation, loadImagesAroundCurrentView]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  // Load settings preferences
  useEffect(() => {
    const loadPreferences = async () => {
      try {
        const autoSave = await AsyncStorage.getItem('autoSaveProgress');
        const savedDebugMode = await AsyncStorage.getItem('reader_debug_mode');
        const savedDebugLevel = await AsyncStorage.getItem('reader_debug_level');
        
        setShouldAutoSave(autoSave === 'true');
        setDebugMode(savedDebugMode === 'true');
        setDebugLevel(savedDebugLevel ? parseInt(savedDebugLevel) : 1);
      } catch (err) {
        console.error('Error loading preferences:', err);
      }
    };
    loadPreferences();
  }, []);

  // Save settings when they change
  useEffect(() => {
    const savePreferences = async () => {
      try {
        await AsyncStorage.setItem('autoSaveProgress', shouldAutoSave.toString());
        await AsyncStorage.setItem('reader_debug_mode', debugMode.toString());
        await AsyncStorage.setItem('reader_debug_level', debugLevel.toString());
      } catch (err) {
        console.error('Error saving preferences:', err);
      }
    };
    savePreferences();
  }, [shouldAutoSave, debugMode, debugLevel]);

  // Load webtoon reader preferences
  useEffect(() => {
    const loadWebtoonReaderPreferences = async () => {
      try {
        const saved = await AsyncStorage.getItem('webtoon_reader_preferences');
        if (saved) {
          const preferences = JSON.parse(saved);
          setWebtoonReaderPreferences(preferences);
          setDebugMode(preferences.debugMode);
        }
      } catch (error) {
        console.error('Error loading webtoon reader preferences:', error);
      }
    };
    loadWebtoonReaderPreferences();
  }, []);

  // Save webtoon reader preferences function
  const saveWebtoonReaderPreferences = useCallback(async (preferences: typeof webtoonReaderPreferences) => {
    try {
      await AsyncStorage.setItem('webtoon_reader_preferences', JSON.stringify(preferences));
      setWebtoonReaderPreferences(preferences);
      setDebugMode(preferences.debugMode);
    } catch (error) {
      console.error('Error saving webtoon reader preferences:', error);
    }
  }, []);

  // Toggle functions
  const toggleDebugMode = useCallback(() => {
    setDebugMode(prev => !prev);
  }, []);

  const toggleAutoSave = useCallback(() => {
    setShouldAutoSave(prev => !prev);
  }, []);

  // Save progress and navigate
  const handleSaveAndNavigate = useCallback(async () => {
    try {
      const message = await progressTracker.saveProgress(
        {
          mangaId: getCurrentMangaId(),
          chapter: params.chapter as string,
          title: params.title as string,
          anilistId: params.anilistId as string,
        },
        isIncognito,
        images.length
      );
      
      setNotificationMessage(message);
      setShowNotification(true);
      setTimeout(() => setShowNotification(false), 3000);
      
      setShowSaveModal(false);
      setPendingNextChapter(false);
      
      // Show chapter modal after saving
      if (navigationType && selectedChapter) {
        setShowChapterModal(true);
      }
    } catch (err) {
      setNotificationMessage(err instanceof Error ? err.message : 'Failed to save progress');
      setShowNotification(true);
      setTimeout(() => setShowNotification(false), 3000);
      
      setShowSaveModal(false);
      setPendingNextChapter(false);
    }
  }, [progressTracker, params, isIncognito, images.length, navigationType, selectedChapter, getCurrentMangaId]);

  // Webtoon-style image rendering with dynamic heights
  const renderItem = useCallback(({ item: imageUrl, index }: { item: string, index: number }) => {
    if (!isMounted.current) return null;
    
    const imageState = imageLoader.getImageState(index);
    
    // All images should load immediately (progressive loading disabled for stability)
    const shouldLoad = true;
    
    // Calculate height based on image dimensions
    let dynamicHeight = WINDOW_WIDTH; // Default to square if no dimensions yet
    
    if (imageState.height) {
      // We have height from previous calculation
      dynamicHeight = imageState.height;
    } else {
      // No dimensions yet, use fallback
      dynamicHeight = 600;
    }
    
    // Clamp height to reasonable bounds for webtoons (no minimum for proper display)
    dynamicHeight = Math.min(dynamicHeight, WINDOW_HEIGHT * 3); // Allow very tall panels
    
    return (
      <TouchableOpacity 
        style={[styles.imageContainer, { height: dynamicHeight }]} 
        activeOpacity={1} 
        onPress={toggleUI}
      >
        {shouldLoad ? (
          <ExpoImage
            source={{ 
              uri: imageUrl,
              headers: imageHeaders 
            }}
            style={{
              width: WINDOW_WIDTH,
              height: dynamicHeight,
              backgroundColor: '#000',
              alignSelf: 'stretch',
            }}
            contentFit="contain" // Using contain to show full image while filling width
            onLoadStart={() => {
              if (isMounted.current) {
                imageLoader.handleImageLoadStart(index);
                console.log(`[WebNovelReader] 🔄 Loading image ${index + 1}/${images.length}`);
              }
            }}
            onLoad={(event) => {
              if (isMounted.current) {
                const { width, height } = event.source;
                imageLoader.handleImageLoadSuccess(index, width, height);
                
                // Log the actual aspect ratio for debugging
                const actualRatio = width / height;
                console.log(`[WebNovelReader] ✅ Loaded image ${index + 1}/${images.length} (${width}x${height}, ratio: ${actualRatio.toFixed(2)})`);
              }
            }}
            onError={(error) => {
              if (isMounted.current) {
                console.error(`[WebNovelReader] ❌ Failed to load image ${index + 1}/${images.length}:`, error);
                imageLoader.handleImageLoadError(index);
              }
            }}
            cachePolicy="memory"
            placeholder={{ blurhash: 'L6PZfSi_.AyE_3t7t7R**0o#DgR4' }}
            transition={200}
          />
        ) : (
          <View style={[styles.placeholderContainer, { height: dynamicHeight }]}>
            <Text style={styles.placeholderText}>Loading page {index + 1}...</Text>
          </View>
        )}
        
        {imageState.isLoading && shouldLoad && (
          <View style={styles.loadingOverlay}>
            <Text style={styles.loadingText}>Loading page {index + 1}...</Text>
          </View>
        )}
        
        {imageState.hasError && shouldLoad && (
          <TouchableOpacity 
            style={styles.errorOverlay}
            onPress={() => {
              if (isMounted.current) {
                console.log(`[WebNovelReader] Retrying image ${index + 1}`);
                imageLoader.retryImage(index);
              }
            }}
          >
            <FontAwesome5 name="exclamation-triangle" size={24} color="#ff4444" />
            <Text style={styles.imageErrorText}>Tap to retry</Text>
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  }, [imageHeaders, imageLoader, loadedImageIndices]);

  const keyExtractor = useCallback((item: string, index: number) => `page-${index}`, []);

  // Render settings modal
  const renderSettingsModal = () => {
    const renderDropdownMenu = () => {
      if (!showDebugDropdown) return null;
      
      return (
        <View style={styles.dropdownMenu}>
          {[1, 2, 3].map((level) => (
            <TouchableOpacity
              key={level}
              style={styles.dropdownMenuItem}
              onPress={() => {
                setDebugLevel(level);
                setShowDebugDropdown(false);
                saveWebtoonReaderPreferences({
                  ...webtoonReaderPreferences,
                  debugMode: debugMode
                });
              }}
            >
              <Text style={styles.dropdownMenuItemText}>Level {level}</Text>
              {debugLevel === level && (
                <FontAwesome5 name="check" size={12} color="#02A9FF" />
              )}
            </TouchableOpacity>
          ))}
        </View>
      );
    };

    return (
      <Modal
        visible={showSettingsModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowSettingsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[
            styles.settingsModal,
            { backgroundColor: isDarkMode ? '#1A1A1A' : '#FFFFFF' }
          ]}>
            <Text style={[
              styles.settingsTitle,
              { color: isDarkMode ? '#FFFFFF' : '#333333' }
            ]}>
              Webtoon Reader Settings
            </Text>
            
            <ScrollView style={styles.settingsScrollView} showsVerticalScrollIndicator={false}>
              {/* Reading Settings Section */}
              <View style={styles.settingsSection}>
                <View style={styles.sectionHeader}>
                  <FontAwesome5 name="book-open" size={20} color="#42A5F5" />
                  <Text style={[styles.settingsSectionTitle, { color: isDarkMode ? '#FFFFFF' : '#333333' }]}>
                    Reading Settings
                  </Text>
                </View>

                {/* Reading Direction (Fixed for Webtoons) */}
                <View style={[styles.settingItem, { borderBottomColor: isDarkMode ? '#333' : '#E0E0E0' }]}>
                  <View style={{ marginBottom: 12 }}>
                    <Text style={[styles.settingLabel, { color: isDarkMode ? '#FFFFFF' : '#333333' }]}>Reading Direction</Text>
                    <Text style={[styles.settingDescription, { color: isDarkMode ? '#AAAAAA' : '#666666' }]}>
                      Webtoons are read vertically from top to bottom
                    </Text>
                  </View>
                  <View style={styles.directionOptions}>
                    <View style={[styles.directionOption, styles.directionOptionSelected]}>
                      <FontAwesome5 name="arrow-down" size={14} color="#fff" />
                      <Text style={[styles.directionOptionText, { color: '#fff' }]}>
                        Vertical (Top to Bottom)
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Toggle Settings */}
                <View style={[styles.settingItem, { borderBottomColor: isDarkMode ? '#333' : '#E0E0E0' }]}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={[styles.settingLabel, { color: isDarkMode ? '#FFFFFF' : '#333333', marginBottom: 0 }]}>Remember Reading Position</Text>
                    <Switch
                      value={webtoonReaderPreferences.rememberPosition}
                      onValueChange={(value) => {
                        saveWebtoonReaderPreferences({
                          ...webtoonReaderPreferences,
                          rememberPosition: value
                        });
                      }}
                      trackColor={{ false: '#767577', true: '#42A5F5' }}
                      thumbColor={webtoonReaderPreferences.rememberPosition ? '#fff' : '#f4f3f4'}
                    />
                  </View>
                </View>

                <View style={[styles.settingItem, { borderBottomColor: isDarkMode ? '#333' : '#E0E0E0' }]}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={[styles.settingLabel, { color: isDarkMode ? '#FFFFFF' : '#333333', marginBottom: 0 }]}>Auto-Navigate to Next Chapter</Text>
                    <Switch
                      value={webtoonReaderPreferences.autoNavigateNextChapter}
                      onValueChange={(value) => {
                        saveWebtoonReaderPreferences({
                          ...webtoonReaderPreferences,
                          autoNavigateNextChapter: value
                        });
                      }}
                      trackColor={{ false: '#767577', true: '#42A5F5' }}
                      thumbColor={webtoonReaderPreferences.autoNavigateNextChapter ? '#fff' : '#f4f3f4'}
                    />
                  </View>
                </View>

                <View style={[styles.settingItem, { borderBottomColor: isDarkMode ? '#333' : '#E0E0E0' }]}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={[styles.settingLabel, { color: isDarkMode ? '#FFFFFF' : '#333333', marginBottom: 0 }]}>Keep Screen On While Reading</Text>
                    <Switch
                      value={webtoonReaderPreferences.keepScreenOn}
                      onValueChange={(value) => {
                        saveWebtoonReaderPreferences({
                          ...webtoonReaderPreferences,
                          keepScreenOn: value
                        });
                      }}
                      trackColor={{ false: '#767577', true: '#42A5F5' }}
                      thumbColor={webtoonReaderPreferences.keepScreenOn ? '#fff' : '#f4f3f4'}
                    />
                  </View>
                </View>

                <View style={[styles.settingItem, { borderBottomColor: isDarkMode ? '#333' : '#E0E0E0' }]}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={[styles.settingLabel, { color: isDarkMode ? '#FFFFFF' : '#333333', marginBottom: 0 }]}>Show Page Number</Text>
                    <Switch
                      value={webtoonReaderPreferences.showPageNumber}
                      onValueChange={(value) => {
                        saveWebtoonReaderPreferences({
                          ...webtoonReaderPreferences,
                          showPageNumber: value
                        });
                      }}
                      trackColor={{ false: '#767577', true: '#42A5F5' }}
                      thumbColor={webtoonReaderPreferences.showPageNumber ? '#fff' : '#f4f3f4'}
                    />
                  </View>
                </View>

                {/* Preload Pages */}
                <View style={[styles.settingItem, { borderBottomColor: isDarkMode ? '#333' : '#E0E0E0' }]}>
                  <Text style={[styles.settingLabel, { color: isDarkMode ? '#FFFFFF' : '#333333' }]}>Preload Pages</Text>
                  <View style={styles.sliderContainer}>
                    <Slider
                      style={{ width: '90%', height: 40 }}
                      minimumValue={1}
                      maximumValue={10}
                      step={1}
                      value={webtoonReaderPreferences.preloadPages}
                      onValueChange={(value) => {
                        saveWebtoonReaderPreferences({
                          ...webtoonReaderPreferences,
                          preloadPages: value
                        });
                      }}
                      minimumTrackTintColor="#42A5F5"
                      maximumTrackTintColor="#777777"
                      thumbTintColor="#42A5F5"
                    />
                    <Text style={[styles.sliderValue, { color: isDarkMode ? '#FFFFFF' : '#333333' }]}>
                      {webtoonReaderPreferences.preloadPages}
                    </Text>
                  </View>
                </View>

                {/* Scroll Speed */}
                <View style={[styles.settingItem, { borderBottomColor: isDarkMode ? '#333' : '#E0E0E0' }]}>
                  <Text style={[styles.settingLabel, { color: isDarkMode ? '#FFFFFF' : '#333333' }]}>Scroll Speed</Text>
                  <View style={styles.sliderContainer}>
                    <Slider
                      style={{ width: '90%', height: 40 }}
                      minimumValue={0.5}
                      maximumValue={2.0}
                      step={0.1}
                      value={webtoonReaderPreferences.scrollSpeed}
                      onValueChange={(value) => {
                        saveWebtoonReaderPreferences({
                          ...webtoonReaderPreferences,
                          scrollSpeed: value
                        });
                      }}
                      minimumTrackTintColor="#42A5F5"
                      maximumTrackTintColor="#777777"
                      thumbTintColor="#42A5F5"
                    />
                    <Text style={[styles.sliderValue, { color: isDarkMode ? '#FFFFFF' : '#333333' }]}>
                      {webtoonReaderPreferences.scrollSpeed.toFixed(1)}x
                    </Text>
                  </View>
                </View>
              </View>

              {/* Advanced Options Section */}
              <View style={styles.settingsSection}>
                <View style={styles.sectionHeader}>
                  <FontAwesome5 name="cogs" size={20} color="#9C27B0" />
                  <Text style={[styles.settingsSectionTitle, { color: isDarkMode ? '#FFFFFF' : '#333333' }]}>
                    Advanced Options
                  </Text>
                </View>
                
                <View style={[styles.settingItem, { borderBottomColor: isDarkMode ? '#333' : '#E0E0E0' }]}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={[styles.settingLabel, { color: isDarkMode ? '#FFFFFF' : '#333333', marginBottom: 0 }]}>Auto-save Progress</Text>
                    <Switch
                      value={shouldAutoSave}
                      onValueChange={setShouldAutoSave}
                      trackColor={{ false: '#767577', true: '#9C27B0' }}
                      thumbColor={shouldAutoSave ? '#fff' : '#f4f3f4'}
                    />
                  </View>
                </View>

                <View style={[styles.settingItem, { borderBottomColor: isDarkMode ? '#333' : '#E0E0E0' }]}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={[styles.settingLabel, { color: isDarkMode ? '#FFFFFF' : '#333333', marginBottom: 0 }]}>Tap to Navigate</Text>
                    <Switch
                      value={webtoonReaderPreferences.tapToNavigate}
                      onValueChange={(value) => {
                        saveWebtoonReaderPreferences({
                          ...webtoonReaderPreferences,
                          tapToNavigate: value
                        });
                      }}
                      trackColor={{ false: '#767577', true: '#9C27B0' }}
                      thumbColor={webtoonReaderPreferences.tapToNavigate ? '#fff' : '#f4f3f4'}
                    />
                  </View>
                </View>

                <View style={[styles.settingItem, { borderBottomColor: isDarkMode ? '#333' : '#E0E0E0' }]}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={[styles.settingLabel, { color: isDarkMode ? '#FFFFFF' : '#333333', marginBottom: 0 }]}>Zoom Enabled</Text>
                    <Switch
                      value={webtoonReaderPreferences.zoomEnabled}
                      onValueChange={(value) => {
                        saveWebtoonReaderPreferences({
                          ...webtoonReaderPreferences,
                          zoomEnabled: value
                        });
                      }}
                      trackColor={{ false: '#767577', true: '#9C27B0' }}
                      thumbColor={webtoonReaderPreferences.zoomEnabled ? '#fff' : '#f4f3f4'}
                    />
                  </View>
                </View>

                <View style={[styles.settingItem, { borderBottomColor: isDarkMode ? '#333' : '#E0E0E0' }]}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={[styles.settingLabel, { color: isDarkMode ? '#FFFFFF' : '#333333', marginBottom: 0 }]}>Auto-scroll Enabled</Text>
                    <Switch
                      value={webtoonReaderPreferences.autoScrollEnabled}
                      onValueChange={(value) => {
                        saveWebtoonReaderPreferences({
                          ...webtoonReaderPreferences,
                          autoScrollEnabled: value
                        });
                      }}
                      trackColor={{ false: '#767577', true: '#9C27B0' }}
                      thumbColor={webtoonReaderPreferences.autoScrollEnabled ? '#fff' : '#f4f3f4'}
                    />
                  </View>
                </View>

                {/* Auto-scroll Speed */}
                {webtoonReaderPreferences.autoScrollEnabled && (
                  <View style={[styles.settingItem, { borderBottomColor: isDarkMode ? '#333' : '#E0E0E0' }]}>
                    <Text style={[styles.settingLabel, { color: isDarkMode ? '#FFFFFF' : '#333333' }]}>Auto-scroll Speed</Text>
                    <View style={styles.sliderContainer}>
                      <Slider
                        style={{ width: '90%', height: 40 }}
                        minimumValue={1}
                        maximumValue={5}
                        step={1}
                        value={webtoonReaderPreferences.autoScrollSpeed}
                        onValueChange={(value) => {
                          saveWebtoonReaderPreferences({
                            ...webtoonReaderPreferences,
                            autoScrollSpeed: value
                          });
                        }}
                        minimumTrackTintColor="#9C27B0"
                        maximumTrackTintColor="#777777"
                        thumbTintColor="#9C27B0"
                      />
                      <Text style={[styles.sliderValue, { color: isDarkMode ? '#FFFFFF' : '#333333' }]}>
                        {webtoonReaderPreferences.autoScrollSpeed}
                      </Text>
                    </View>
                  </View>
                )}
              </View>
              
              {/* Debug Options Section */}
              <View style={styles.settingsSection}>
                <View style={styles.sectionHeader}>
                  <FontAwesome5 name="bug" size={20} color="#f44336" />
                  <Text style={[styles.settingsSectionTitle, { color: isDarkMode ? '#FFFFFF' : '#333333' }]}>
                    Debug Options
                  </Text>
                </View>
                
                <View style={[styles.settingItem, { borderBottomColor: isDarkMode ? '#333' : '#E0E0E0' }]}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={[styles.settingLabel, { color: isDarkMode ? '#FFFFFF' : '#333333', marginBottom: 0 }]}>Debug Mode</Text>
                    <Switch
                      value={debugMode}
                      onValueChange={(value) => {
                        setDebugMode(value);
                        saveWebtoonReaderPreferences({
                          ...webtoonReaderPreferences,
                          debugMode: value
                        });
                      }}
                      trackColor={{ false: '#767577', true: '#f44336' }}
                      thumbColor={debugMode ? '#fff' : '#f4f3f4'}
                    />
                  </View>
                </View>
                
                {debugMode && (
                  <View style={[
                    styles.settingsDropdown,
                    { backgroundColor: isDarkMode ? '#333333' : '#F5F5F5', position: 'relative' }
                  ]}>
                    <Text style={[
                      styles.settingsDropdownLabel,
                      { color: isDarkMode ? '#FFFFFF' : '#333333' }
                    ]}>
                      Debug Level
                    </Text>
                    <TouchableOpacity 
                      style={[
                        styles.dropdownButton,
                        { backgroundColor: isDarkMode ? '#444' : '#E0E0E0' }
                      ]}
                      onPress={() => setShowDebugDropdown(!showDebugDropdown)}
                    >
                      <Text 
                        style={[
                          styles.dropdownButtonText, 
                          { color: isDarkMode ? '#FFF' : '#333' }
                        ]}
                      >
                        {debugLevel}
                      </Text>
                      <FontAwesome5 
                        name={showDebugDropdown ? "chevron-up" : "chevron-down"} 
                        size={10} 
                        color={isDarkMode ? '#FFF' : '#333'} 
                      />
                    </TouchableOpacity>
                    {renderDropdownMenu()}
                  </View>
                )}
              </View>

              {/* Reset Section */}
              <View style={styles.settingsSection}>
                <TouchableOpacity 
                  style={[styles.settingItem, { borderBottomColor: isDarkMode ? '#333' : '#E0E0E0' }]}
                  onPress={() => {
                    // Reset all webtoon reader settings to default
                    const defaultSettings = {
                      readingDirection: 'vertical' as 'vertical',
                      rememberPosition: true,
                      autoNavigateNextChapter: true,
                      keepScreenOn: true,
                      showPageNumber: true,
                      tapToNavigate: true,
                      zoomEnabled: true,
                      preloadPages: 3,
                      scrollSpeed: 1.0,
                      autoScrollEnabled: false,
                      autoScrollSpeed: 2,
                      debugMode: false,
                      appearance: {
                        backgroundColor: '#000000',
                        pageGap: 8,
                        imageQuality: 'medium' as 'high' | 'medium' | 'low'
                      }
                    };
                    saveWebtoonReaderPreferences(defaultSettings);
                  }}
                >
                  <Text style={[styles.settingLabel, { color: isDarkMode ? '#FFFFFF' : '#333333' }]}>Reset to Default Settings</Text>
                  <FontAwesome5 name="undo" size={20} color="#f44336" />
                </TouchableOpacity>
              </View>
            </ScrollView>
            
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[
                  styles.modalButton,
                  styles.modalButtonYes,
                  { backgroundColor: theme.colors.primary }
                ]}
                onPress={() => setShowSettingsModal(false)}
              >
                <Text style={styles.modalButtonText}>
                  Close
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  };

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <FontAwesome5 name="exclamation-circle" size={40} color="#ff4444" />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={handleBack}>
          <Text style={styles.retryText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Don't render if images are not loaded or component is unmounted
  if (!isMounted.current || images.length === 0) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Loading images...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        ref={flashListRef}
        data={images}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={200}
        scrollEnabled={true}
        // Performance optimizations for Android - increased for better loading
        initialNumToRender={10}
        maxToRenderPerBatch={5}
        windowSize={10}
        removeClippedSubviews={true}
        updateCellsBatchingPeriod={100}
        // Remove getItemLayout for dynamic heights
        // Memory optimization
        legacyImplementation={false}
        disableVirtualization={false}
        // Webtoon-specific optimizations
        bounces={true}
        bouncesZoom={false}
        alwaysBounceVertical={true}
        decelerationRate="normal"
      />

      <ReaderUI
        showUI={showUI}
        title={params.title as string}
        chapter={params.chapter as string}
        currentPageIndex={progressTracker.currentPageIndex}
        totalPages={images.length}
        readingProgress={progressTracker.scrollProgress}
        hasNextChapter={chapterNav.hasNextChapter || localHasNextChapter}
        hasPreviousChapter={chapterNav.hasPreviousChapter || localHasPreviousChapter}
        nextChapter={nextChapter || undefined}
        previousChapter={previousChapter || undefined}
        onBack={handleBack}
        onNextChapter={() => handleChapterNavigation('next')}
        onPreviousChapter={() => handleChapterNavigation('previous')}
        onSettings={() => setShowSettingsModal(true)}
        isInitialLoading={isInitialLoading}
        loadingProgress={loadingProgress}
      />

      {/* Save Progress Modal */}
      <Modal
        visible={showSaveModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowSaveModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Save Progress?</Text>
            <Text style={styles.modalText}>
              Would you like to save your progress for this chapter?
            </Text>
            
            <TouchableOpacity 
              style={styles.checkboxContainer}
              onPress={() => setShouldSaveProgress(!shouldSaveProgress)}
            >
              <View style={[styles.checkbox, shouldSaveProgress && styles.checkboxChecked]}>
                {shouldSaveProgress && (
                  <FontAwesome5 name="check" size={12} color="#fff" />
                )}
              </View>
              <Text style={styles.checkboxLabel}>Do not show this again</Text>
            </TouchableOpacity>

            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => {
                  setShowSaveModal(false);
                  setPendingNextChapter(false);
                  setNavigationType(null);
                }}
              >
                <Text style={[styles.modalButtonText, styles.modalButtonTextCancel]}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.modalButton, styles.modalButtonNo]}
                onPress={() => {
                  setShowSaveModal(false);
                  setPendingNextChapter(false);
                  if (navigationType && selectedChapter) {
                    setShowChapterModal(true);
                  }
                }}
              >
                <Text style={[styles.modalButtonText, styles.modalButtonTextNo]}>No</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.modalButton, styles.modalButtonYes]}
                onPress={handleSaveAndNavigate}
              >
                <Text style={styles.modalButtonText}>Yes</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Exit Modal */}
      <Modal
        visible={showExitModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowExitModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Save Progress?</Text>
            <Text style={styles.modalText}>
              Would you like to save your progress before leaving?
            </Text>
            
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.modalButtonNo]}
                onPress={() => {
                  setShowExitModal(false);
                  DeviceEventEmitter.emit('refreshMangaDetails');
                  router.back();
                }}
              >
                <Text style={[styles.modalButtonText, styles.modalButtonTextNo]}>No</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.modalButton, styles.modalButtonYes]}
                onPress={async () => {
                  await handleSaveAndNavigate();
                  DeviceEventEmitter.emit('refreshMangaDetails');
                  router.back();
                }}
              >
                <Text style={styles.modalButtonText}>Yes</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Notification */}
      {showNotification && (
        <View style={styles.notification}>
          <Text style={styles.notificationText}>{notificationMessage}</Text>
        </View>
      )}

      {/* Chapter Navigation Buttons */}
      {showUI && images.length > 0 && (
        <View style={styles.chapterNavigation}>
          {(chapterNav.hasPreviousChapter || localHasPreviousChapter) && (
            <TouchableOpacity
              style={[styles.chapterNavButton, styles.chapterNavButtonLeft]}
              onPress={() => handleChapterNavigation('previous')}
              activeOpacity={0.7}
            >
              <FontAwesome5 name="chevron-left" size={16} color="#FFFFFF" />
              <Text style={styles.chapterNavButtonText}>Previous</Text>
            </TouchableOpacity>
          )}
          
          {(chapterNav.hasNextChapter || localHasNextChapter) && (
            <TouchableOpacity
              style={[styles.chapterNavButton, styles.chapterNavButtonRight]}
              onPress={() => handleChapterNavigation('next')}
              activeOpacity={0.7}
            >
              <Text style={styles.chapterNavButtonText}>Next</Text>
              <FontAwesome5 name="chevron-right" size={16} color="#FFFFFF" />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Chapter Sources Modal */}
      <ChapterSourcesModal
        visible={showChapterModal}
        onClose={() => {
          setShowChapterModal(false);
          setNavigationType(null);
          setPendingNextChapter(false);
          setSelectedChapter(null);
        }}
        chapter={selectedChapter ? { ...selectedChapter, source: 'unknown' } : null}
        mangaTitle={{
          english: typeof params.title === 'string' ? params.title : "",
          userPreferred: typeof params.title === 'string' ? params.title : ""
        }}
        mangaId={mangaIdRef.current || params.mangaId as string}
        anilistId={params.anilistId as string}
        currentProvider={params.readerCurrentProvider as 'mangadex' | 'katana' | 'mangafire' | 'unknown' || 'unknown'}
        mangaSlugId={params.readerMangaSlugId as string}
        chapterManager={undefined}
        format={params.format as string}
        countryOfOrigin={params.countryOfOrigin as string}
      />

      {/* Settings Modal */}
      {renderSettingsModal()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
    padding: 20,
  },
  errorText: {
    color: '#fff',
    fontSize: 16,
    marginTop: 16,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#02A9FF',
    borderRadius: 8,
  },
  retryText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    width: '80%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  modalText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 20,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#02A9FF',
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#02A9FF',
  },
  checkboxLabel: {
    fontSize: 16,
    color: '#333',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
  },
  modalButton: {
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
    minWidth: 100,
    alignItems: 'center',
  },
  modalButtonNo: {
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  modalButtonYes: {
    backgroundColor: '#02A9FF',
  },
  modalButtonCancel: {
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  modalButtonTextNo: {
    color: '#666',
  },
  modalButtonTextCancel: {
    color: '#666',
  },
  notification: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 100 : 80,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1001,
  },
  notificationText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
  },
  settingsSection: {
    marginBottom: 24,
  },
  debugLevelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  chapterNavigation: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 120 : 100,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    zIndex: 1000,
  },
  chapterNavButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 25,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 5,
  },
  chapterNavButtonLeft: {
    marginRight: 'auto',
  },
  chapterNavButtonRight: {
    marginLeft: 'auto',
  },
  chapterNavButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginHorizontal: 8,
  },
  // Settings Modal Styles
  settingsModal: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 0,
    width: '90%',
    maxWidth: 500,
    maxHeight: '80%',
  },
  settingsTitle: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 0,
    paddingVertical: 20,
    paddingHorizontal: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  settingsScrollView: {
    maxHeight: 500,
    paddingHorizontal: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    marginTop: 20,
  },
  settingsSectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 12,
  },
  settingItem: {
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 8,
  },
  settingDescription: {
    fontSize: 14,
    marginTop: 4,
  },
  directionOptions: {
    flexDirection: 'row',
    gap: 12,
  },
  directionOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    backgroundColor: '#F5F5F5',
  },
  directionOptionSelected: {
    backgroundColor: '#42A5F5',
    borderColor: '#42A5F5',
  },
  directionOptionText: {
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
  },
  sliderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  sliderValue: {
    fontSize: 16,
    fontWeight: '600',
    minWidth: 40,
    textAlign: 'center',
  },
  settingsDropdown: {
    padding: 16,
    borderRadius: 8,
    marginVertical: 8,
  },
  settingsDropdownLabel: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 8,
  },
  dropdownButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
  },
  dropdownButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  dropdownMenu: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    zIndex: 1000,
  },
  dropdownMenuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  dropdownMenuItemText: {
    fontSize: 14,
    color: '#333',
  },
  imageContainer: {
    position: 'relative',
    width: WINDOW_WIDTH,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  mangaImage: {
    width: WINDOW_WIDTH,
    backgroundColor: '#000',
    alignSelf: 'stretch', // Ensure image stretches to fill container width
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  loadingText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  errorOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  imageErrorText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  placeholderContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#222',
    width: WINDOW_WIDTH,
    height: 600, // Fixed reasonable height for placeholder
  },
  placeholderText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
}); 