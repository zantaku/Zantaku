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

// Optimized constants for better performance and reduced flickering
const INITIAL_LOAD_COUNT = 8;
const PRELOAD_BUFFER = 3;
const MAX_CACHE_SIZE = 20;
const DEFAULT_IMAGE_HEIGHT = Math.floor(WINDOW_WIDTH * 1.8); // Better default for webtoon panels
const ESTIMATED_ITEM_SIZE = DEFAULT_IMAGE_HEIGHT;

// Simple debounce utility function
function debounce<T extends (...args: any[]) => any>(func: T, wait: number): T {
  let timeout: NodeJS.Timeout;
  return ((...args: any[]) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  }) as T;
}

interface Chapter {
  id: string;
  number: string;
  title: string;
  url: string;
  source: string;
}

// Memoized image item component to prevent unnecessary re-renders
const MemoizedImageItem = React.memo<{
  imageUrl: string;
  index: number;
  imageHeaders: Record<string, string>;
  onToggleUI: () => void;
  windowWidth: number;
  preCalculatedHeight?: number;
  onHeightCalculated?: (index: number, height: number) => void;
}>(({ imageUrl, index, imageHeaders, onToggleUI, windowWidth, preCalculatedHeight, onHeightCalculated }) => {
  // Use pre-calculated height to prevent layout shifts
  const [imageHeight, setImageHeight] = useState(preCalculatedHeight || DEFAULT_IMAGE_HEIGHT);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [shouldRetry, setShouldRetry] = useState(0);
  const [isImageLoaded, setIsImageLoaded] = useState(false);
  const [imageWidth, setImageWidth] = useState(WINDOW_WIDTH);

  const handleImageLoad = useCallback((event: any) => {
    const { width: originalWidth, height: originalHeight } = event.source;
    if (originalWidth && originalHeight) {
      const aspectRatio = originalHeight / originalWidth;
      
      // Check if image is smaller than screen width
      if (originalWidth < WINDOW_WIDTH) {
        // For small images, don't scale up too much to avoid pixelation
        const maxScale = 1.2; // Limit scaling to 120% to reduce pixelation
        const scale = Math.min(WINDOW_WIDTH / originalWidth, maxScale);
        const calculatedWidth = Math.floor(originalWidth * scale);
        const calculatedHeight = Math.floor(originalHeight * scale);
        
        setImageWidth(calculatedWidth);
        if (!preCalculatedHeight || Math.abs(calculatedHeight - imageHeight) > 50) {
          setImageHeight(calculatedHeight);
          if (onHeightCalculated) {
            onHeightCalculated(index, calculatedHeight);
          }
        }
      } else {
        // For larger images, scale down to fit screen width
        const calculatedHeight = Math.floor(WINDOW_WIDTH * aspectRatio);
        
        setImageWidth(WINDOW_WIDTH);
        if (!preCalculatedHeight || Math.abs(calculatedHeight - imageHeight) > 50) {
          setImageHeight(calculatedHeight);
          if (onHeightCalculated) {
            onHeightCalculated(index, calculatedHeight);
          }
        }
      }
    }
    setIsLoading(false);
    setHasError(false);
    setIsImageLoaded(true);
  }, [preCalculatedHeight, imageHeight, index, onHeightCalculated]);

  const handleImageError = useCallback(() => {
    setIsLoading(false);
    setHasError(true);
    setIsImageLoaded(false);
  }, []);

  const handleRetry = useCallback(() => {
    setIsLoading(true);
    setHasError(false);
    setIsImageLoaded(false);
    setShouldRetry(prev => prev + 1);
  }, []);

  // Memoized styles to prevent recalculation - use fixed height to prevent layout shifts
  const containerStyle = useMemo(() => [
    styles.imageContainer, 
    { 
      height: imageHeight,
      width: WINDOW_WIDTH // Ensure container uses full width
    }
  ], [imageHeight]);

  const imageStyle = useMemo(() => ({
    width: imageWidth,
    height: imageHeight,
    backgroundColor: '#000',
  }), [imageWidth, imageHeight]);

  return (
    <TouchableOpacity 
      style={containerStyle} 
      activeOpacity={1} 
      onPress={onToggleUI}
    >
      <ExpoImage
        key={`${imageUrl}-${shouldRetry}`} // Force re-render on retry
        source={{ 
          uri: imageUrl,
          headers: imageHeaders,
          width: 2048, // Request higher resolution if available
          height: 2048
        }}
        style={imageStyle}
        contentFit="contain" // Show full image without cropping
        onLoad={handleImageLoad}
        onError={handleImageError}
        cachePolicy="memory-disk"
        placeholder={{ blurhash: 'L6PZfSi_.AyE_3t7t7R**0o#DgR4' }}
        transition={isImageLoaded ? 150 : 0} // Reduce transition when not loaded to prevent flicker
        priority={index < 10 ? "high" : "normal"} // High priority for first 10 images
        recyclingKey={`page-${index}`} // Help with memory management
        allowDownscaling={false} // Prevent downscaling which can cause blur
        responsivePolicy="live" // Use best quality for current size
      />
      
      {isLoading && (
        <View style={styles.loadingOverlay}>
          <Text style={styles.loadingText}>Loading page {index + 1}...</Text>
        </View>
      )}
      
      {hasError && (
        <TouchableOpacity 
          style={styles.errorOverlay}
          onPress={handleRetry}
        >
          <FontAwesome5 name="exclamation-triangle" size={24} color="#ff4444" />
          <Text style={styles.imageErrorText}>Tap to retry</Text>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
}, (prevProps, nextProps) => {
  // Custom comparison function to prevent unnecessary re-renders
  return (
    prevProps.imageUrl === nextProps.imageUrl &&
    prevProps.index === nextProps.index &&
    prevProps.windowWidth === nextProps.windowWidth &&
    prevProps.preCalculatedHeight === nextProps.preCalculatedHeight &&
    JSON.stringify(prevProps.imageHeaders) === JSON.stringify(nextProps.imageHeaders)
  );
});

/* 
 * PERFORMANCE OPTIMIZATIONS IMPLEMENTED TO FIX SCROLLING FLICKER:
 * 
 * 1. PRE-CALCULATED IMAGE HEIGHTS: Images now use estimated heights to prevent layout shifts
 * 2. getItemLayout: Added for optimal FlatList performance - eliminates dynamic layout calculations  
 * 3. OPTIMIZED FLATLIST PROPS: Better configuration for smooth scrolling
 * 4. IMPROVED SCROLL HANDLER: Better throttling and immediate progress updates
 * 5. MEMOIZED COMPONENTS: Prevent unnecessary re-renders
 * 6. STABLE IMAGE DIMENSIONS: Use fixed heights to prevent layout jumps
 * 7. FLASHLIST ALTERNATIVE: Available as commented code for even better performance
 * 
 * Key changes:
 * - Images start with fixed dimensions instead of 0x0
 * - FlatList knows exact item positions via getItemLayout
 * - Reduced scroll event throttling for smoother experience
 * - Better memory management and view recycling
 */

export default function WebNovelReader() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const flatListRef = useRef<FlatList<string>>(null);
  const lastScrollTime = useRef<number>(0);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastUpdatedPage = useRef<number>(-1);
  const mangaIdRef = useRef<string | null>(null);
  const isMounted = useRef(true);
  
  // Simplified state to reduce re-renders
  const [images, setImages] = useState<string[]>([]);
  const [imageHeights, setImageHeights] = useState<number[]>([]);
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

  // Removed progressive loading state that was causing flickering
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  
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

  // Stable memoized image headers to prevent recreation
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
  }, [params, images[0]]);

  // Memoize chapter navigation handlers
  const nextChapter = useMemo(() => {
    try {
      return chapterNav.getChapterByType('next');
    } catch (error) {
      console.warn('Error getting next chapter:', error);
      return null;
    }
  }, [chapterNav]);
  
  const previousChapter = useMemo(() => {
    try {
      return chapterNav.getChapterByType('previous');
    } catch (error) {
      console.warn('Error getting previous chapter:', error);
      return null;
    }
  }, [chapterNav]);

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
          // Initialize image heights with estimated values to prevent layout shifts
          const estimatedHeights = new Array(imageUrls.length).fill(DEFAULT_IMAGE_HEIGHT);
          setImageHeights(estimatedHeights);
          setIsInitialLoading(false);
          
          console.log(`[WebNovelReader] ✅ Images ready for rendering: ${imageUrls.length} images`);
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
    
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const now = Date.now();
    
    // Immediate scroll progress update (no throttling for smooth UI)
    const scrollY = Math.max(0, contentOffset.y);
    const totalScrollHeight = Math.max(1, contentSize.height - layoutMeasurement.height);
    const scrollProgress = Math.min(100, Math.max(0, (scrollY / totalScrollHeight) * 100));
    
    // Update scroll progress immediately for smooth progress bar
    progressTracker.updateScrollProgress(scrollProgress);
    
    // Throttle the expensive calculations
    if (now - lastScrollTime.current < 150) {
      return;
    }
    lastScrollTime.current = now;

    // Clear any existing timeout
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }

    // Debounce the expensive calculations
    scrollTimeoutRef.current = setTimeout(() => {
      if (!isMounted.current) return;
      
      try {
        // Calculate which image we're currently viewing using actual heights
        let currentPage = 0;
        let cumulativeHeight = 0;
        
        for (let i = 0; i < imageHeights.length; i++) {
          const imageHeight = imageHeights[i] || DEFAULT_IMAGE_HEIGHT;
          if (scrollY >= cumulativeHeight && scrollY < cumulativeHeight + imageHeight) {
            currentPage = i;
            break;
          }
          cumulativeHeight += imageHeight;
        }
        
        const validCurrentPage = Math.max(0, Math.min(currentPage, images.length - 1));
        
        // Update page index if it changed
        if (validCurrentPage !== lastUpdatedPage.current && validCurrentPage >= 0 && validCurrentPage < images.length) {
          progressTracker.updateProgress(validCurrentPage, images.length);
          lastUpdatedPage.current = validCurrentPage;
        }

        // Check if we're at the bottom with buffer for better UX
        const isAtBottom = contentOffset.y + layoutMeasurement.height >= contentSize.height - 300;
        
        if (isAtBottom && (chapterNav.hasNextChapter || localHasNextChapter)) {
          // Throttle chapter navigation to prevent multiple triggers
          const timeSinceLastNav = now - lastScrollTime.current;
          if (timeSinceLastNav > 2000) { // Increased throttle time
            handleChapterNavigation('next');
          }
        }
      } catch (error) {
        console.warn('[WebNovelReader] Error in scroll handler:', error);
      }
    }, 100); // Balanced debounce time
  }, [images.length, imageHeights, progressTracker, chapterNav.hasNextChapter, localHasNextChapter, handleChapterNavigation]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  // Stable settings loading to prevent re-renders
  useEffect(() => {
    let isCancelled = false;
    
    const loadPreferences = async () => {
      try {
        const [autoSave, savedDebugMode, savedDebugLevel, webtoonPrefs] = await Promise.all([
          AsyncStorage.getItem('autoSaveProgress'),
          AsyncStorage.getItem('reader_debug_mode'),
          AsyncStorage.getItem('reader_debug_level'),
          AsyncStorage.getItem('webtoon_reader_preferences')
        ]);
        
        if (isCancelled) return;
        
        setShouldAutoSave(autoSave === 'true');
        setDebugMode(savedDebugMode === 'true');
        setDebugLevel(savedDebugLevel ? parseInt(savedDebugLevel) : 1);
        
        if (webtoonPrefs) {
          try {
            const preferences = JSON.parse(webtoonPrefs);
            setWebtoonReaderPreferences(preferences);
            setDebugMode(preferences.debugMode);
          } catch (error) {
            console.error('Error parsing webtoon reader preferences:', error);
          }
        }
      } catch (err) {
        console.error('Error loading preferences:', err);
      }
    };
    
    loadPreferences();
    
    return () => {
      isCancelled = true;
    };
  }, []);

  // Debounced settings save to prevent excessive writes
  const savePreferencesDebounced = useMemo(
    () => debounce(async (autoSave: boolean, debug: boolean, level: number, prefs: typeof webtoonReaderPreferences) => {
      try {
        await Promise.all([
          AsyncStorage.setItem('autoSaveProgress', autoSave.toString()),
          AsyncStorage.setItem('reader_debug_mode', debug.toString()),
          AsyncStorage.setItem('reader_debug_level', level.toString()),
          AsyncStorage.setItem('webtoon_reader_preferences', JSON.stringify(prefs))
        ]);
      } catch (err) {
        console.error('Error saving preferences:', err);
      }
    }, 500),
    []
  );

  // Save webtoon reader preferences function
  const saveWebtoonReaderPreferences = useCallback(async (preferences: typeof webtoonReaderPreferences) => {
    setWebtoonReaderPreferences(preferences);
    setDebugMode(preferences.debugMode);
    savePreferencesDebounced(shouldAutoSave, preferences.debugMode, debugLevel, preferences);
  }, [shouldAutoSave, debugLevel, savePreferencesDebounced]);

  // Toggle functions with debounced saves
  const toggleDebugMode = useCallback(() => {
    setDebugMode(prev => {
      const newValue = !prev;
      savePreferencesDebounced(shouldAutoSave, newValue, debugLevel, webtoonReaderPreferences);
      return newValue;
    });
  }, [shouldAutoSave, debugLevel, webtoonReaderPreferences, savePreferencesDebounced]);

  const toggleAutoSave = useCallback(() => {
    setShouldAutoSave(prev => {
      const newValue = !prev;
      savePreferencesDebounced(newValue, debugMode, debugLevel, webtoonReaderPreferences);
      return newValue;
    });
  }, [debugMode, debugLevel, webtoonReaderPreferences, savePreferencesDebounced]);

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

  // Render settings modal
  const renderSettingsModal = useCallback(() => {
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
  }, [isDarkMode, theme, showSettingsModal, showDebugDropdown, debugLevel, webtoonReaderPreferences, shouldAutoSave, debugMode, saveWebtoonReaderPreferences]);

  // Memoized container style to prevent re-calculations
  const containerStyle = useMemo(() => [styles.container], []);

  // Function to update image height when image loads
  const updateImageHeight = useCallback((index: number, height: number) => {
    setImageHeights(prev => {
      const newHeights = [...prev];
      // Only update if the height is significantly different
      if (Math.abs(newHeights[index] - height) > 50) {
        newHeights[index] = height;
        return newHeights;
      }
      return prev;
    });
  }, []);

  // Memoized render item function to prevent recreation
  const renderItem = useCallback(({ item: imageUrl, index }: { item: string, index: number }) => (
    <MemoizedImageItem
      imageUrl={imageUrl}
      index={index}
      imageHeaders={imageHeaders}
      onToggleUI={toggleUI}
      windowWidth={WINDOW_WIDTH}
      preCalculatedHeight={imageHeights[index]}
      onHeightCalculated={updateImageHeight}
    />
  ), [imageHeaders, toggleUI, imageHeights, updateImageHeight]);

  // Memoized key extractor
  const keyExtractor = useCallback((item: string, index: number) => `page-${index}`, []);

  // getItemLayout for optimal FlatList performance - prevents layout calculations
  const getItemLayout = useCallback((data: any, index: number) => {
    const height = imageHeights[index] || DEFAULT_IMAGE_HEIGHT;
    let offset = 0;
    for (let i = 0; i < index; i++) {
      offset += imageHeights[i] || DEFAULT_IMAGE_HEIGHT;
    }
    
    return {
      length: height,
      offset,
      index,
    };
  }, [imageHeights]);

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
    <View style={containerStyle}>
      <FlatList
        ref={flatListRef}
        data={images}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        getItemLayout={getItemLayout}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        scrollEnabled={true}
        // Optimized performance settings to reduce flickering
        initialNumToRender={INITIAL_LOAD_COUNT}
        maxToRenderPerBatch={5}
        windowSize={10}
        removeClippedSubviews={true}
        updateCellsBatchingPeriod={100}
        legacyImplementation={false}
        disableVirtualization={false}
        // Stable scrolling behavior - optimized
        bounces={true}
        bouncesZoom={false}
        alwaysBounceVertical={true}
        decelerationRate="normal"
        // Performance optimizations
        directionalLockEnabled={true}
        overScrollMode="never"
        scrollToOverflowEnabled={true}
        // Reduce memory usage for large lists
        onEndReachedThreshold={0.8}
        onScrollToIndexFailed={() => {}}
        // Additional optimizations to prevent flickering
        persistentScrollbar={false}
        indicatorStyle="white"
        scrollIndicatorInsets={{right: 1}}
        // Remove any default spacing
        ItemSeparatorComponent={null}
        contentContainerStyle={{ flexGrow: 1 }}
      />
      
      {/* Alternative: Use FlashList for even better performance
      <FlashList
        ref={flatListRef as any}
        data={images}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        estimatedItemSize={ESTIMATED_ITEM_SIZE}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        // FlashList handles most optimizations automatically
        removeClippedSubviews={true}
        drawDistance={WINDOW_HEIGHT * 2}
      />
      */}

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
        loadingProgress={100}
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
    width: '100%', // Ensure full width
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
    width: WINDOW_WIDTH,
    backgroundColor: '#000',
    alignItems: 'center', // Center images horizontally
    justifyContent: 'center',
    overflow: 'hidden', // Prevent overflow
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