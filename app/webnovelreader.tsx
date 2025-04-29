import React, { useState, useRef, useEffect, useCallback, useMemo, memo } from 'react';
import { View, Text, StyleSheet, Platform, StatusBar, TouchableOpacity, Dimensions, FlatList, ActivityIndicator, NativeScrollEvent, NativeSyntheticEvent, Modal } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { FontAwesome5 } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useOrientation } from '../hooks/useOrientation';
import { useIncognito } from '../hooks/useIncognito';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import ChapterSourcesModal from '../components/ChapterSourcesModal';
import { DeviceEventEmitter } from 'react-native';

const WINDOW_WIDTH = Dimensions.get('window').width;
const INITIAL_RENDER_COUNT = 3;
const ANILIST_API_URL = 'https://graphql.anilist.co';
const STORAGE_KEY = {
  AUTH_TOKEN: 'auth_token',
  USER_DATA: 'user_data'
};

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

const ImageItem = memo(({ 
    imageUrl, 
    index,
    imageHeaders,
    onPress,
    onLoadStart,
    onLoadSuccess,
    onLoadError,
    isLoading,
    hasError,
    onRetry,
    imageSize,
  }: {
    imageUrl: string;
    index: number;
    imageHeaders: { [key: string]: string };
    onPress: () => void;
    onLoadStart: () => void;
    onLoadSuccess: (height: number) => void;
    onLoadError: (error: any) => void;
    isLoading: boolean;
    hasError: boolean;
    onRetry: () => void;
    imageSize: { width: number; height: number } | null;
  }) => {
    return (
      <View style={styles.imageWrapper}>
        <TouchableOpacity 
          activeOpacity={1} 
          onPress={onPress}
          style={styles.imageContainer}
        >
          <Image
            source={{ uri: imageUrl, headers: imageHeaders }}
            style={styles.image}
            contentFit="contain"
            onLoadStart={onLoadStart}
            onLoad={(e) => {
              const { width, height } = e.source;
              const scaledHeight = (height / width) * WINDOW_WIDTH;
              onLoadSuccess(scaledHeight);
            }}
            onError={onLoadError}
          />
          {isLoading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#02A9FF" />
            </View>
          )}
          
          {hasError && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>Failed to load image</Text>
              <TouchableOpacity style={styles.retryButton} onPress={onRetry}>
                <Text style={styles.retryButtonText}>Retry</Text>
              </TouchableOpacity>
            </View>
          )}
        </TouchableOpacity>
      </View>
    );
  });
  

export default function WebNovelReader() {
  const params = useLocalSearchParams();
  const [images, setImages] = useState<string[]>([]);
  const [showUI, setShowUI] = useState(true);
  const [loadingStates, setLoadingStates] = useState<{ [key: number]: boolean }>({});
  const [errorStates, setErrorStates] = useState<{ [key: number]: boolean }>({});
  const [imageSizes, setImageSizes] = useState<{ [key: number]: { width: number; height: number } }>({});
  const [error, setError] = useState<string | null>(null);
  const [readingProgress, setReadingProgress] = useState(0);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [hasUpdatedProgress, setHasUpdatedProgress] = useState(false);
  const [shouldSaveProgress, setShouldSaveProgress] = useState(true);
  const [showExitModal, setShowExitModal] = useState(false);
  const [showNotification, setShowNotification] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState('');
  const flatListRef = useRef<FlatList>(null);
  const router = useRouter();
  const { unlockOrientation, lockPortrait } = useOrientation();
  const { isIncognito } = useIncognito();
  const [hasNextChapter, setHasNextChapter] = useState(false);
  const [hasPreviousChapter, setHasPreviousChapter] = useState(false);
  const [allChapters, setAllChapters] = useState<Chapter[]>([]);
  const [currentChapterIndex, setCurrentChapterIndex] = useState<number>(-1);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [pendingNextChapter, setPendingNextChapter] = useState(false);
  const [navigationType, setNavigationType] = useState<'next' | 'previous' | null>(null);
  const [showChapterModal, setShowChapterModal] = useState(false);
  const [selectedChapter, setSelectedChapter] = useState<Chapter | null>(null);
  const [autoLoadChapter, setAutoLoadChapter] = useState(false);

  const imageHeaders = useMemo(() => ({
    'Referer': 'https://mangakatana.com/',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Origin': 'https://mangakatana.com'
  }), []);

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

        const initialStates = Object.fromEntries(
          imageUrls.slice(0, INITIAL_RENDER_COUNT).map((_, i) => [i, true])
        );
        setLoadingStates(initialStates);
      } catch (err) {
        console.error('Error loading images:', err);
        setError('Failed to load chapter images');
      }
    };

    loadImages();
  }, []);

  const handleBack = useCallback(() => {
    // Always show save modal when not in incognito mode and there's unsaved progress
    if (!isIncognito && !hasUpdatedProgress) {
      setShowExitModal(true);
    } else {
      // Navigate back
      DeviceEventEmitter.emit('refreshMangaDetails');
      router.back();
    }
  }, [hasUpdatedProgress, router, isIncognito]);

  const toggleUI = useCallback(() => {
    setShowUI(prev => !prev);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

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

  const fetchPagesAndNavigate = useCallback(async (chapter: Chapter) => {
    try {
      const pagesUrl = `https://enoki-api.vercel.app/manganato/read/${params.mangaId}/${chapter.id}`;
      const response = await fetch(pagesUrl);
      const data = await response.json();

      if (data?.result?.images && Array.isArray(data.result.images)) {
        const imageUrls = data.result.images
          .filter((img: { url: string }) => 
            img.url && 
            typeof img.url === 'string' && 
            !img.url.includes('logo-chap.png') && 
            !img.url.includes('gohome.png') &&
            !img.url.includes('chapmanganato.to')
          )
          .map((img: { url: string }) => img.url);

        if (imageUrls.length > 0) {
          router.push({
            pathname: '/webnovelreader',
            params: {
              ...params,
              chapter: chapter.number,
              title: chapter.title,
              ...Object.fromEntries(imageUrls.map((url: string, i: number) => [`image${i + 1}`, url]))
            }
          });
        }
      }
    } catch (err) {
      console.error('Error fetching chapter pages:', err);
    }
  }, [params, router]);

  const handleChapterNavigation = useCallback((type: 'next' | 'previous') => {
    const targetChapter = getChapterByType(type);
    if (targetChapter) {
      // Show save modal only when not in incognito mode and there's unsaved progress
      if (!isIncognito && !hasUpdatedProgress) {
        setPendingNextChapter(true);
        setShowSaveModal(true);
        setNavigationType(type);
      } else {
        // Set the selected chapter and show modal
        setSelectedChapter(targetChapter);
        setAutoLoadChapter(true);
        setShowChapterModal(true);
      }
    }
  }, [getChapterByType, hasUpdatedProgress, isIncognito]);

  const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    
    // Calculate which page we're currently viewing based on scroll position
    const pageHeight = WINDOW_WIDTH * 1.4;
    const currentPage = Math.floor(contentOffset.y / pageHeight);
    
    // Update current page index
    setCurrentPageIndex(currentPage);
    
    // Calculate progress as a percentage of total pages
    const progress = Math.min((currentPage / (images.length - 1)) * 100, 100);
    setReadingProgress(Math.max(0, progress));

    // Check if we're at the bottom and scrolling further
    if (contentOffset.y + layoutMeasurement.height >= contentSize.height) {
      // Show save modal only when not in incognito mode and there's unsaved progress
      if (!isIncognito && !hasUpdatedProgress) {
        setPendingNextChapter(true);
        setShowSaveModal(true);
        setNavigationType('next');
      } else if (hasNextChapter) {
        handleChapterNavigation('next');
      }
    }
  }, [images.length, hasNextChapter, isIncognito, hasUpdatedProgress, handleChapterNavigation]);

  const handleImageLoadSuccess = useCallback((index: number, height: number) => {
    setLoadingStates(prev => ({ ...prev, [index]: false }));
    setImageSizes(prev => ({
      ...prev,
      [index]: { width: WINDOW_WIDTH, height }
    }));
  }, []);

  const handleImageLoadError = useCallback((index: number, error: any) => {
    console.error(`Error loading image ${index + 1}:`, {
      error,
      url: images[index]
    });
    setLoadingStates(prev => ({ ...prev, [index]: false }));
    setErrorStates(prev => ({ ...prev, [index]: true }));
  }, [images]);

  const retryImage = useCallback((index: number) => {
    setLoadingStates(prev => ({ ...prev, [index]: true }));
    setErrorStates(prev => ({ ...prev, [index]: false }));
  }, []);

  const handleImageLoadStart = useCallback((index: number) => {
    setLoadingStates(prev => ({ ...prev, [index]: true }));
    setErrorStates(prev => ({ ...prev, [index]: false }));
  }, []);

  const renderItem = useCallback(({ item: imageUrl, index }: { item: string, index: number }) => {
    return (
      <ImageItem
        imageUrl={imageUrl}
        index={index}
        imageHeaders={imageHeaders}
        onPress={toggleUI}
        onLoadStart={() => handleImageLoadStart(index)}
        onLoadSuccess={(height) => handleImageLoadSuccess(index, height)}
        onLoadError={(error) => handleImageLoadError(index, error)}
        isLoading={loadingStates[index]}
        hasError={errorStates[index]}
        onRetry={() => retryImage(index)}
        imageSize={imageSizes[index]}
      />
    );
  }, [
    imageHeaders,
    toggleUI,
    handleImageLoadStart,
    handleImageLoadSuccess,
    handleImageLoadError,
    loadingStates,
    errorStates,
    retryImage,
    imageSizes
  ]);

  const keyExtractor = useCallback((item: string, index: number) => `page-${index}`, []);

  useEffect(() => {
    unlockOrientation();
    return () => {
      lockPortrait();
    };
  }, [unlockOrientation, lockPortrait]);

  const fetchChapters = useCallback(async () => {
    try {
      if (params.mangaId) {
        const response = await fetch(`https://enoki-api.vercel.app/manganato/details/${params.mangaId}`);
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
            (ch: Chapter) => ch.number === params.chapter
          );
          setCurrentChapterIndex(index);
          
          // Set navigation availability
          setHasNextChapter(index > 0);
          setHasPreviousChapter(index < formattedChapters.length - 1);
        }
      }
    } catch (err) {
      console.error('Error fetching chapters:', err);
    }
  }, [params.mangaId, params.chapter]);

  useEffect(() => {
    fetchChapters();
  }, [fetchChapters]);

  const handleNextChapterConfirmed = useCallback(async () => {
    try {
      // Save progress locally regardless of incognito mode
      const key = `reading_progress_${params.mangaId}_${params.chapter}`;
      const progress = {
        page: currentPageIndex + 1,
        totalPages: images.length,
        lastRead: new Date().toISOString(),
        chapterTitle: params.title,
        isCompleted: currentPageIndex + 1 === images.length
      };
      await AsyncStorage.setItem(key, JSON.stringify(progress));

      // Mark as completed if on last page
      if (currentPageIndex + 1 === images.length) {
        const completedKey = `completed_${params.mangaId}_${params.chapter}`;
        await AsyncStorage.setItem(completedKey, 'true');
      }

      // Only sync with AniList if not in incognito mode
      if (!isIncognito) {
        const token = await SecureStore.getItemAsync(STORAGE_KEY.AUTH_TOKEN);
        if (token) {
          // If anilistId is missing, search for the manga
          let anilistId = params.anilistId;
          if (!anilistId) {
            // Get manga details to get the correct title
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
          
          setNotificationMessage(`Progress saved to AniList: Chapter ${chapterNumber}`);
          setShowNotification(true);
          setTimeout(() => setShowNotification(false), 3000);
        }
      }
      
      setHasUpdatedProgress(true);
      if (shouldSaveProgress) {
        await AsyncStorage.setItem('autoSaveProgress', 'true');
      }
      
      setShowSaveModal(false);
      setPendingNextChapter(false);
      
      // Show ChapterSourcesModal for the next chapter
      if (navigationType) {
        const targetChapter = getChapterByType(navigationType);
        if (targetChapter) {
          setSelectedChapter(targetChapter);
          setAutoLoadChapter(true);
          setShowChapterModal(true);
        }
      }
    } catch (err) {
      console.error('Error saving progress:', err);
      setNotificationMessage('Failed to save progress' + (isIncognito ? '' : ' to AniList'));
      setShowNotification(true);
      setTimeout(() => setShowNotification(false), 3000);
      
      setShowSaveModal(false);
      setPendingNextChapter(false);
      
      // Still try to show ChapterSourcesModal even if saving fails
      if (navigationType) {
        const targetChapter = getChapterByType(navigationType);
        if (targetChapter) {
          setSelectedChapter(targetChapter);
          setAutoLoadChapter(true);
          setShowChapterModal(true);
        }
      }
    }
  }, [
    currentPageIndex,
    images.length,
    params.mangaId,
    params.chapter,
    params.title,
    params.anilistId,
    shouldSaveProgress,
    navigationType,
    getChapterByType,
    isIncognito
  ]);

  // Add function to search manga on AniList
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
      console.log('[WebNovelReader] AniList search response:', data);
      
      if (data?.data?.Media?.id) {
        // Return both the ID and all title variations for more flexible searching
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
      <FlatList
        ref={flatListRef}
        data={images}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews={true}
        maxToRenderPerBatch={3}
        windowSize={5}
        initialNumToRender={INITIAL_RENDER_COUNT}
        onEndReachedThreshold={2}
        contentContainerStyle={styles.listContainer}
        ItemSeparatorComponent={() => (
          <View style={{ height: 10 }}>
            <Text style={{ display: 'none' }}></Text>
          </View>
        )}
        style={{ backgroundColor: '#000' }}
        maintainVisibleContentPosition={{
          minIndexForVisible: 0,
          autoscrollToTopThreshold: 10,
        }}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      />

      {showUI && (
        <>
          <View style={styles.header}>
            <TouchableOpacity onPress={handleBack} style={styles.backButton}>
              <FontAwesome5 name="arrow-left" size={20} color="#fff" />
            </TouchableOpacity>
            <View style={styles.titleContainer}>
              <Text style={styles.title} numberOfLines={1}>
                {typeof params.title === 'string' ? params.title.replace(/Chapter \d+:?\s*/, '') : params.title}
              </Text>
              <Text style={styles.subtitle}>
                Chapter {params.chapter} • Page {currentPageIndex + 1}/{images.length}
              </Text>
            </View>
          </View>
          <View style={styles.progressBarContainer}>
            <View style={[styles.progressBar, { width: `${readingProgress}%` }]} />
          </View>
          <View style={styles.chapterNavigation}>
            {hasPreviousChapter && (
              <TouchableOpacity 
                style={styles.chapterNavButton}
                onPress={() => handleChapterNavigation('previous')}
              >
                <FontAwesome5 name="chevron-left" size={20} color="#fff" />
                <Text style={styles.chapterNavText}>Chapter {allChapters[currentChapterIndex + 1].number}</Text>
              </TouchableOpacity>
            )}
            {hasNextChapter && (
              <TouchableOpacity 
                style={[styles.chapterNavButton, styles.nextChapterButton]}
                onPress={() => handleChapterNavigation('next')}
              >
                <Text style={styles.chapterNavText}>Chapter {allChapters[currentChapterIndex - 1].number}</Text>
                <FontAwesome5 name="chevron-right" size={20} color="#fff" />
              </TouchableOpacity>
            )}
          </View>
        </>
      )}

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
                  const targetChapter = getChapterByType(navigationType!);
                  if (targetChapter) {
                    fetchPagesAndNavigate(targetChapter);
                  }
                }}
              >
                <Text style={[styles.modalButtonText, styles.modalButtonTextNo]}>No</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.modalButton, styles.modalButtonYes]}
                onPress={handleNextChapterConfirmed}
              >
                <Text style={styles.modalButtonText}>Yes</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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
                  router.back();
                }}
              >
                <Text style={[styles.modalButtonText, styles.modalButtonTextNo]}>No</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.modalButton, styles.modalButtonYes]}
                onPress={async () => {
                  await handleNextChapterConfirmed();
                  router.back();
                }}
              >
                <Text style={styles.modalButtonText}>Yes</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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

      {showNotification && (
        <View style={styles.notification}>
          <Text style={styles.notificationText}>{notificationMessage}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 44 : StatusBar.currentHeight,
    paddingHorizontal: 16,
    paddingBottom: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  titleContainer: {
    flex: 1,
    marginLeft: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  subtitle: {
    fontSize: 14,
    color: '#fff',
    opacity: 0.8,
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
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
  retryButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  imageWrapper: {
    backgroundColor: '#000',
    width: WINDOW_WIDTH,
    padding: 0,
    margin: 0,
  },

  imageContainer: {
    backgroundColor: '#000',
    width: WINDOW_WIDTH,
    height: WINDOW_WIDTH * 1.4,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 0,
    margin: 0,
  },
  image: {
    width: WINDOW_WIDTH,
    height: WINDOW_WIDTH * 1.4,
    padding: 0,
    margin: 0,
  },
  listContainer: {
    backgroundColor: '#000',
    margin: 0,
    padding: 0,
    gap: 0,
  },
  progressBarContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#02A9FF',
  },
  chapterNavigation: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 44 : 24,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  chapterNavButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 24,
    gap: 8,
  },
  nextChapterButton: {
    marginLeft: 'auto',
  },
  chapterNavText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
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
  },
  notificationText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
  },
}); 