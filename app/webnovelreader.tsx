import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { View, StyleSheet, Platform, StatusBar, TouchableOpacity, Modal, Text, NativeScrollEvent, NativeSyntheticEvent, Switch, Dimensions, Animated, ScrollView } from 'react-native';
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

interface Chapter {
  id: string;
  number: string;
  title: string;
  url: string;
}

export default function WebNovelReader() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const flashListRef = useRef<FlashList<string>>(null);
  const lastScrollTime = useRef<number>(0);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastUpdatedPage = useRef<number>(-1);
  
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
  const [showChapterModal, setShowChapterModal] = useState(false);
  const [selectedChapter, setSelectedChapter] = useState<Chapter | null>(null);
  const [autoLoadChapter, setAutoLoadChapter] = useState(false);
  
  // Progressive loading state
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
  
  // Comprehensive webtoon reader preferences
  const [webtoonReaderPreferences, setWebtoonReaderPreferences] = useState({
    readingDirection: 'vertical' as 'vertical',
    rememberPosition: true,
    autoNavigateNextChapter: true,
    keepScreenOn: true,
    showPageNumber: true,
    tapToNavigate: true,
    zoomEnabled: true,
    preloadPages: 5,
    scrollSpeed: 1.0,
    autoScrollEnabled: false,
    autoScrollSpeed: 2,
    debugMode: false,
    appearance: {
      backgroundColor: '#000000',
      pageGap: 8,
      imageQuality: 'high' as 'high' | 'medium' | 'low'
    }
  });

  // Local navigation state for fallback
  const [localHasNextChapter, setLocalHasNextChapter] = useState(false);
  const [localHasPreviousChapter, setLocalHasPreviousChapter] = useState(false);

  // Progressive loading constants
  const INITIAL_LOAD_COUNT = 5; // Load first 5 images immediately for webtoon
  const PRELOAD_BUFFER = 3; // Preload 3 images ahead and behind current view

  // Hooks
  const { unlockOrientation, lockPortrait } = useOrientation();
  const { isIncognito } = useIncognito();
  const { currentTheme: theme, isDarkMode } = useTheme();
  const imageLoader = useImageLoader(images.length);
  const chapterNav = useChapterNavigation(params.mangaId as string, params.chapter as string);
  const progressTracker = useReadingProgress();

  // Image headers for bypassing referer checks
  const imageHeaders = useMemo(() => ({
    'Referer': 'https://mangakatana.com/',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Origin': 'https://mangakatana.com'
  }), []);

  // Memoize chapter navigation handlers
  const nextChapter = useMemo(() => chapterNav.getChapterByType('next'), [chapterNav]);
  const previousChapter = useMemo(() => chapterNav.getChapterByType('previous'), [chapterNav]);



  // Load images progressively based on current scroll position
  const loadImagesAroundCurrentView = useCallback(async (currentIndex: number) => {
    if (images.length === 0) return;
    
    const indicesToLoad: number[] = [];
    
    // Load current view and buffer around it
    for (let i = Math.max(0, currentIndex - PRELOAD_BUFFER); 
         i <= Math.min(images.length - 1, currentIndex + PRELOAD_BUFFER); 
         i++) {
      if (!loadedImageIndices.has(i)) {
        indicesToLoad.push(i);
      }
    }
    
    if (indicesToLoad.length > 0) {
      // Create a local batch loading function to avoid dependency issues
      const loadBatch = async (indices: number[]) => {
        console.log(`[WebNovelReader] Loading batch of ${indices.length} images:`, indices);
        
        const loadPromises = indices.map(async (index) => {
          if (loadedImageIndices.has(index) || index >= images.length) {
            return;
          }
          
          try {
            // Preload the image using ExpoImage prefetch
            const imageUrl = images[index];
            
            await ExpoImage.prefetch(imageUrl, {
              headers: imageHeaders,
              cachePolicy: 'memory-disk'
            });
            
            setLoadedImageIndices(prev => new Set([...prev, index]));
            console.log(`[WebNovelReader] Successfully preloaded image ${index + 1}`);
          } catch (error) {
            if (error instanceof Error) {
              console.warn(`[WebNovelReader] Failed to preload image ${index + 1}:`, error.message);
            }
          }
        });
        
        await Promise.allSettled(loadPromises);
        
        // Update loading progress
        const totalLoaded = loadedImageIndices.size + indices.filter(i => loadedImageIndices.has(i)).length;
        setLoadingProgress((totalLoaded / images.length) * 100);
      };
      
      await loadBatch(indicesToLoad);
    }
  }, [images, imageHeaders, loadedImageIndices]);

  // Chapter navigation - moved before handleScroll
  const handleChapterNavigation = useCallback((type: 'next' | 'previous') => {
    let targetChapter = chapterNav.getChapterByType(type);
    
    // If API didn't provide chapter data, create synthetic chapter
    if (!targetChapter) {
      const currentChapterNum = parseFloat(String(params.chapter));
      if (!isNaN(currentChapterNum)) {
        const targetChapterNum = type === 'next' 
          ? currentChapterNum + 1 
          : currentChapterNum - 1;
        
        if (targetChapterNum > 0) {
          targetChapter = {
            id: `chapter-${targetChapterNum}`,
            number: String(targetChapterNum),
            title: `Chapter ${targetChapterNum}`,
            url: `chapter-${targetChapterNum}`
          };
        }
      }
    }
    
    if (targetChapter) {
      // Skip save modal if in incognito mode, auto-save enabled, or progress already updated
      if (isIncognito || shouldAutoSave || progressTracker.hasUpdatedProgress) {
        setSelectedChapter(targetChapter);
        setAutoLoadChapter(true);
        setShowChapterModal(true);
      } else {
        // Only show save modal if not in incognito mode and progress hasn't been updated
        setPendingNextChapter(true);
        setShowSaveModal(true);
        setNavigationType(type);
        setSelectedChapter(targetChapter);
      }
    }
  }, [chapterNav, progressTracker.hasUpdatedProgress, isIncognito, shouldAutoSave, params.chapter]);

  // Load images from params
  useEffect(() => {
    const loadImages = async () => {
      try {
        const imageUrls: string[] = [];
        let index = 1;

        while (params[`image${index}`]) {
          const imageUrl = params[`image${index}`] as string;
          imageUrls.push(imageUrl);
          index++;
        }

        if (imageUrls.length === 0) {
          throw new Error('No images found');
        }

        console.log(`[WebNovelReader] Loaded ${imageUrls.length} images`);
        setImages(imageUrls);
        
        // Set fallback chapter navigation based on chapter number
        // This ensures navigation buttons show even if API fails
        const currentChapterNum = parseFloat(String(params.chapter));
        if (!isNaN(currentChapterNum)) {
          // Always allow previous chapter if not chapter 1
          if (currentChapterNum > 1) {
            setLocalHasPreviousChapter(true);
          }
          
          // Always allow next chapter unless explicitly marked as latest
          if (params.isLatestChapter !== 'true') {
            setLocalHasNextChapter(true);
          }
        }
        
        // Start progressive loading with first few images
        console.log(`[WebNovelReader] Starting progressive loading with first ${INITIAL_LOAD_COUNT} images`);
        const initialIndices = Array.from({ length: Math.min(INITIAL_LOAD_COUNT, imageUrls.length) }, (_, i) => i);
        
        // Load initial batch - create a local function to avoid dependency issues
        const loadInitialBatch = async (indices: number[]) => {
          console.log(`[WebNovelReader] Loading batch of ${indices.length} images:`, indices);
          
          const loadPromises = indices.map(async (index) => {
            if (index >= imageUrls.length) {
              return;
            }
            
            try {
              // Preload the image using ExpoImage prefetch
              const imageUrl = imageUrls[index];
              
              await ExpoImage.prefetch(imageUrl, {
                headers: imageHeaders,
                cachePolicy: 'memory-disk'
              });
              
              setLoadedImageIndices(prev => new Set([...prev, index]));
              console.log(`[WebNovelReader] Successfully preloaded image ${index + 1}`);
            } catch (error) {
              if (error instanceof Error) {
                console.warn(`[WebNovelReader] Failed to preload image ${index + 1}:`, error.message);
              }
            }
          });
          
          await Promise.allSettled(loadPromises);
          
          // Update loading progress
          setLoadingProgress((indices.length / imageUrls.length) * 100);
        };
        
        setTimeout(async () => {
          await loadInitialBatch(initialIndices);
          setIsInitialLoading(false);
          console.log(`[WebNovelReader] Initial loading complete`);
        }, 100);
        
      } catch (err) {
        console.error('Error loading images:', err);
        setError('Failed to load chapter images');
        setIsInitialLoading(false);
      }
    };

    loadImages();
  }, []); // Remove problematic dependencies to prevent infinite loop

  // Handle orientation
  useEffect(() => {
    unlockOrientation();
    return () => {
      lockPortrait();
    };
  }, [unlockOrientation, lockPortrait]);

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

  // Optimized scroll handler with throttling and efficient page calculation
  const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const now = Date.now();
    
    // Throttle scroll events to every 100ms for better performance
    if (now - lastScrollTime.current < 100) {
      return;
    }
    lastScrollTime.current = now;

    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    
    // Clear any existing timeout
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }

    // Debounce the expensive calculations
    scrollTimeoutRef.current = setTimeout(() => {
      // More efficient current page calculation using binary search approach
      let currentPage = 0;
      let accumulatedHeight = 0;
      const scrollY = contentOffset.y;
      
      // Find the current page more efficiently
      for (let i = 0; i < images.length; i++) {
        const imageState = imageLoader.getImageState(i);
        const imageHeight = imageState.height || 400;
        
        if (scrollY < accumulatedHeight + imageHeight / 2) {
          currentPage = i;
          break;
        }
        accumulatedHeight += imageHeight;
        currentPage = i;
      }
      
      // Only update progress if the page actually changed
      if (currentPage !== lastUpdatedPage.current) {
        progressTracker.updateProgress(currentPage, images.length);
        lastUpdatedPage.current = currentPage;
        
        // Progressive loading: Load images around the current view
        loadImagesAroundCurrentView(currentPage);
      }

      // Check if we're at the bottom with some buffer
      const isAtBottom = contentOffset.y + layoutMeasurement.height >= contentSize.height - 100;
      
      if (isAtBottom) {
        // Skip save modal if in incognito mode, auto-save enabled, or progress already updated
        if (isIncognito || shouldAutoSave || progressTracker.hasUpdatedProgress) {
          if (chapterNav.hasNextChapter) {
            handleChapterNavigation('next');
          }
        } else {
          // Only show save modal if not in incognito mode and progress hasn't been updated
          setPendingNextChapter(true);
          setShowSaveModal(true);
          setNavigationType('next');
        }
      }
    }, 50); // Debounce by 50ms
  }, [images.length, imageLoader, progressTracker, chapterNav.hasNextChapter, isIncognito, handleChapterNavigation]);

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
          mangaId: params.mangaId as string,
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
      
      if (navigationType) {
        const targetChapter = chapterNav.getChapterByType(navigationType);
        if (targetChapter) {
          setSelectedChapter(targetChapter);
          setAutoLoadChapter(true);
          setShowChapterModal(true);
        }
      }
    } catch (err) {
      setNotificationMessage(err instanceof Error ? err.message : 'Failed to save progress');
      setShowNotification(true);
      setTimeout(() => setShowNotification(false), 3000);
      
      setShowSaveModal(false);
      setPendingNextChapter(false);
    }
  }, [progressTracker, params, isIncognito, images.length, navigationType, chapterNav]);

  // Render image item with better memoization
  const renderItem = useCallback(({ item: imageUrl, index }: { item: string, index: number }) => {
    const imageState = imageLoader.getImageState(index);
    
    // Check if this image should be loaded based on progressive loading
    const shouldLoad = loadedImageIndices.has(index) || index < INITIAL_LOAD_COUNT;
    
    return (
      <WebtoonImage
        imageUrl={imageUrl}
        index={index}
        imageHeaders={imageHeaders}
        onPress={handleZoomToggle}
        onLoadStart={() => imageLoader.handleImageLoadStart(index)}
        onLoadSuccess={(width, height) => imageLoader.handleImageLoadSuccess(index, width, height)}
        onLoadError={(error) => imageLoader.handleImageLoadError(index)}
        isLoading={imageState.isLoading}
        hasError={imageState.hasError}
        onRetry={() => imageLoader.retryImage(index)}
        height={imageState.height}
        shouldLoad={shouldLoad}
        isZoomed={isZoomed}
        zoomAnimatedValue={zoomAnimatedValue}
        translateX={translateX}
        translateY={translateY}
      />
    );
  }, [imageHeaders, handleZoomToggle, imageLoader, loadedImageIndices, isZoomed, zoomAnimatedValue, translateX, translateY]);

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
                      preloadPages: 5,
                      scrollSpeed: 1.0,
                      autoScrollEnabled: false,
                      autoScrollSpeed: 2,
                      debugMode: false,
                      appearance: {
                        backgroundColor: '#000000',
                        pageGap: 8,
                        imageQuality: 'high' as 'high' | 'medium' | 'low'
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

  return (
    <View style={styles.container}>
      <FlashList
        ref={flashListRef}
        data={images}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        estimatedItemSize={400}
        showsVerticalScrollIndicator={false}
        onScroll={isZoomed ? undefined : handleScroll}
        scrollEventThrottle={100}
        removeClippedSubviews={true}
        scrollEnabled={!isZoomed}
      />

      <ReaderUI
        showUI={showUI}
        title={params.title as string}
        chapter={params.chapter as string}
        currentPageIndex={progressTracker.currentPageIndex}
        totalPages={images.length}
        readingProgress={progressTracker.readingProgress}
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
                  const targetChapter = chapterNav.getChapterByType(navigationType!);
                  if (targetChapter) {
                    setSelectedChapter(targetChapter);
                    setAutoLoadChapter(true);
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

      {/* Chapter Sources Modal */}
      <ChapterSourcesModal
        visible={showChapterModal}
        onClose={() => {
          setShowChapterModal(false);
          setSelectedChapter(null);
          setAutoLoadChapter(false);
        }}
        chapter={selectedChapter}
        mangaTitle={{
          english: params.title as string,
          userPreferred: params.title as string
        }}
        mangaId={params.mangaId as string}
        autoLoad={autoLoadChapter}
        currentReader="webnovel"
        existingParams={params}
      />

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
}); 