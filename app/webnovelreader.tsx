import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { View, StyleSheet, Platform, StatusBar, TouchableOpacity, Modal, Text, NativeScrollEvent, NativeSyntheticEvent, Switch, Dimensions } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { FontAwesome5 } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { FlashList } from '@shopify/flash-list';
import { DeviceEventEmitter } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
  
  // Settings state
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [shouldAutoSave, setShouldAutoSave] = useState(false);
  const [debugMode, setDebugMode] = useState(false);
  const [debugLevel, setDebugLevel] = useState(1);
  const [showDebugDropdown, setShowDebugDropdown] = useState(false);

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

  // Image headers for bypassing referer checks
  const imageHeaders = useMemo(() => ({
    'Referer': 'https://mangakatana.com/',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Origin': 'https://mangakatana.com'
  }), []);

  // Memoize chapter navigation handlers
  const nextChapter = useMemo(() => chapterNav.getChapterByType('next'), [chapterNav]);
  const previousChapter = useMemo(() => chapterNav.getChapterByType('previous'), [chapterNav]);

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
    const loadImages = () => {
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
      } catch (err) {
        console.error('Error loading images:', err);
        setError('Failed to load chapter images');
      }
    };

    loadImages();
  }, [params, setLocalHasPreviousChapter, setLocalHasNextChapter]);

  // Handle orientation
  useEffect(() => {
    unlockOrientation();
    return () => {
      lockPortrait();
    };
  }, [unlockOrientation, lockPortrait]);

  // UI toggle
  const toggleUI = useCallback(() => {
    setShowUI(prev => !prev);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

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
    
    return (
      <WebtoonImage
        imageUrl={imageUrl}
        index={index}
        imageHeaders={imageHeaders}
        onPress={toggleUI}
        onLoadStart={() => imageLoader.handleImageLoadStart(index)}
        onLoadSuccess={(width, height) => imageLoader.handleImageLoadSuccess(index, width, height)}
        onLoadError={(error) => imageLoader.handleImageLoadError(index)}
        isLoading={imageState.isLoading}
        hasError={imageState.hasError}
        onRetry={() => imageLoader.retryImage(index)}
        height={imageState.height}
      />
    );
  }, [imageHeaders, toggleUI, imageLoader]);

  const keyExtractor = useCallback((item: string, index: number) => `page-${index}`, []);

  // Render settings modal
  const renderSettingsModal = () => (
    <Modal
      visible={showSettingsModal}
      transparent={true}
      animationType="fade"
      onRequestClose={() => setShowSettingsModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: isDarkMode ? '#1A1A1A' : '#FFFFFF' }]}>
          <Text style={[styles.modalTitle, { color: isDarkMode ? '#FFFFFF' : '#333333' }]}>
            Webtoon Reader Settings
          </Text>
          
          <View style={styles.settingsSection}>
            <TouchableOpacity 
              style={[styles.checkboxContainer, { backgroundColor: isDarkMode ? '#333333' : '#F5F5F5' }]}
              onPress={toggleAutoSave}
            >
              <View style={[styles.checkbox, shouldAutoSave && styles.checkboxChecked]}>
                {shouldAutoSave && (
                  <FontAwesome5 name="check" size={12} color="#fff" />
                )}
              </View>
              <Text style={[styles.checkboxLabel, { color: isDarkMode ? '#FFFFFF' : '#333333' }]}>
                Auto-save Progress
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.checkboxContainer, { backgroundColor: isDarkMode ? '#333333' : '#F5F5F5' }]}
              onPress={toggleDebugMode}
            >
              <View style={[styles.checkbox, debugMode && styles.checkboxChecked]}>
                {debugMode && (
                  <FontAwesome5 name="check" size={12} color="#fff" />
                )}
              </View>
              <Text style={[styles.checkboxLabel, { color: isDarkMode ? '#FFFFFF' : '#333333' }]}>
                Debug Mode
              </Text>
            </TouchableOpacity>

            {debugMode && (
              <TouchableOpacity 
                style={[styles.checkboxContainer, { backgroundColor: isDarkMode ? '#333333' : '#F5F5F5' }]}
                onPress={() => setDebugLevel(prev => prev < 3 ? prev + 1 : 1)}
              >
                <View style={styles.debugLevelContainer}>
                  <Text style={[styles.checkboxLabel, { color: isDarkMode ? '#FFFFFF' : '#333333' }]}>
                    Debug Level: {debugLevel}
                  </Text>
                </View>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.modalButtons}>
            <TouchableOpacity 
              style={[styles.modalButton, styles.modalButtonYes]}
              onPress={() => setShowSettingsModal(false)}
            >
              <Text style={styles.modalButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

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
        onScroll={handleScroll}
        scrollEventThrottle={100}
        removeClippedSubviews={true}
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
}); 