import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Animated, View, Text, TouchableOpacity, ActivityIndicator, StyleSheet, Dimensions, Platform, TextInput, ScrollView } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useTheme } from '../hooks/useTheme';
import { Image as ExpoImage } from 'expo-image';
import { MaterialIcons } from '@expo/vector-icons';
import { DeviceEventEmitter } from 'react-native';
import ChapterSourcesModal from './ChapterSourcesModal';
import * as SecureStore from 'expo-secure-store';
import { STORAGE_KEY } from '../constants/auth';
// Import providers and types from our new modules
import {
  MANGADEX_API_URL,
  KATANA_API_URL,
  MangaDexProvider,
  KatanaProvider,
  Chapter,
  MangaSource,
  Provider,
  languageFlags
} from '../api/proxy/providers/manga';
import MangaFireProvider from '../api/proxy/providers/manga/mangafire';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { useIncognito } from '../hooks/useIncognito';

interface AnimeAdaptation {
  title: string;
  start_chapter: number;
  end_chapter: number;
}

interface LoadingState {
  currentPage: number;
  totalPages: number;
  type: string;
  message: string;
}

// type MangaSource = 'mangadex' | 'katana';
// type Provider = 'mangadex' | 'katana';

interface ChapterListProps {
  mangaTitle: {
    english: string;
    userPreferred: string;
    romaji?: string;
    native?: string;
  };
  anilistId?: string;
  countryOfOrigin?: string;
  coverImage?: string;
  mangaId?: string;
}

interface ProviderPreferences {
  defaultProvider: 'katana' | 'mangadex' | 'mangafire';
  autoSelectSource: boolean;
  preferredChapterLanguage: string;
  preferredScanlationGroup: string;
  showDataSaver: boolean;
  cacheImages: boolean;
  cacheDuration: number;
}

// Define styles outside of the component function
const { width } = Dimensions.get('window');
const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 10,
    marginTop: 80,
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    backgroundColor: 'transparent',
  },
  sourceContainer: {
    flexDirection: 'row',
    borderRadius: 20,
    overflow: 'hidden',
  },
  sourceButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  activeSourceButton: {
    backgroundColor: '#02A9FF',
  },
  sourceButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  activeSourceText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  sortButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Updated chapter item styles for modern UI
  chapterItemContainer: {
    marginBottom: 0, // Remove bottom margin as we're using separator
  },
  latestBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#02A9FF',
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
  },
  latestIcon: {
    marginRight: 12,
  },
  latestText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16,
    flex: 1,
  },
  latestDate: {
    color: '#FFFFFF',
    fontSize: 12,
    opacity: 0.8,
  },
  // Modern card layout
  chapterCard: {
    flexDirection: 'row',
    alignItems: 'flex-start', // Changed from 'center' to 'flex-start'
    paddingVertical: 12, // Slightly reduced
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#121212',
    borderWidth: 1,
    borderColor: '#1E1E1E',
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#2c2c2c',
    minHeight: 80, // Ensure consistent height
  },
  latestChapterCard: {
    borderColor: '#02A9FF',
    backgroundColor: '#151A28',
  },
  readChapterCard: {
    backgroundColor: '#121A26',
    borderLeftWidth: 3,
    borderLeftColor: '#02A9FF',
  },
  unreadChapterCard: {
    borderLeftWidth: 3,
    borderLeftColor: '#FF5722',
    backgroundColor: '#1A1511',
  },
  newestChapterCard: {
    borderWidth: 2,
    borderColor: '#02A9FF',
    backgroundColor: '#151A28',
  },
  chapterThumbnail: {
    width: 56, // Slightly smaller
    height: 72, // Taller aspect ratio
    borderRadius: 8,
    marginRight: 12,
  },
  chapterContent: {
    flex: 1,
    marginRight: 10,
    justifyContent: 'space-between', // Better spacing
    minHeight: 64, // Ensure content fills properly
  },
  chapterHeader: { // Combined Chapter/Volume header style
    fontSize: 16, // Reduced from 18 for better fit
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4, // Reduced spacing
    flexShrink: 1, // Allow text to shrink if needed
    flexWrap: 'wrap', // Allow text to wrap
  },
  chapterTitle: {
    fontSize: 14,
    color: '#CCCCCC',
    marginBottom: 6,
    flexShrink: 1,
  },
  chapterMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap', // Allow meta items to wrap
    gap: 12, // Consistent spacing
  },
  metaText: {
    fontSize: 12, // Slightly smaller
    color: '#AAAAAA',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4, // Reduced gap
    flexShrink: 1, // Allow to shrink
  },
  readText: {
    color: '#02A9FF',
  },
  readMetaText: {
    color: '#02A9FF',
    opacity: 0.8,
  },
  // Modern button style
  readButton: {
    backgroundColor: '#02A9FF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 80, // Adjusted width
  },
  rereadButton: {
    backgroundColor: '#0277B5',
  },
  readButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
    marginLeft: 5, // Space for icon
  },
  // Loading states
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#02A9FF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
  },
  listContent: {
    paddingBottom: 100,
  },
  progressContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    borderTopWidth: 1,
    borderTopColor: '#02A9FF',
    alignItems: 'center',
  },
  progressText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  controlButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    borderWidth: 1,
    borderColor: '#333333',
  },
  activeControlButton: {
    backgroundColor: 'rgba(2, 169, 255, 0.2)',
    borderColor: '#02A9FF',
  },
  searchContainer: {
    backgroundColor: '#1A1A1A',
    borderRadius: 20,
    marginVertical: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#333333',
  },
  searchInput: {
    color: '#FFFFFF',
    fontSize: 15,
    padding: 4,
  },
  newBadge: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#FFFFFF',
    backgroundColor: '#FF5722',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  loadMoreContainer: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  loadMoreText: {
    marginTop: 8,
    fontSize: 14,
  },
  skeletonText: {
    height: 16,
    borderRadius: 4,
    marginVertical: 4,
  },
  progressBar: {
    width: '100%',
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
    marginTop: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#02A9FF',
    borderRadius: 2,
  },
  volumeRangeContainer: {
    flexDirection: 'row',
    marginBottom: 12,
    marginTop: 12,
    marginHorizontal: -10,
  },
  volumeRangeButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#1A1A1A',
    marginHorizontal: 10,
    borderWidth: 1,
    borderColor: '#333333',
  },
  activeVolumeRangeButton: {
    backgroundColor: '#02A9FF',
    borderColor: '#02A9FF',
  },
  volumeRangeButtonText: {
    color: '#FFFFFF',
    fontWeight: '500',
    fontSize: 14,
  },
});

// Add this utility function for parsing dates above the component function
const parseChapterDate = (dateString: string | undefined): string => {
  if (!dateString) return 'Unknown';
  
  // First try to parse as ISO date
  const isoDate = new Date(dateString);
  if (!isNaN(isoDate.getTime())) {
    return isoDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }
  
  // If that fails, try to parse the "Mar-12-2025" format
  const parts = dateString.split('-');
  if (parts.length === 3) {
    // Format is already close to what we want
    return `${parts[0]} ${parts[1]}, ${parts[2]}`;
  }
  
  // Return the original string if we can't parse it
  return dateString;
};

// Add this utility function for getting a random page number
const getRandomPageNumber = (min: number = 3, max: number = 8): number => {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

// Define default thumbnail for chapters if specific thumbnails aren't available
const defaultThumbnail = 'https://via.placeholder.com/150';

// Update the fetchChapterThumbnail function to include the coverImage parameter
const fetchChapterThumbnail = async (chapter: Chapter, coverImage?: string): Promise<string> => {
  try {
    // Get a random page number between 3 and 8
    const randomPage = getRandomPageNumber(3, 8);
    
    if (chapter.source === 'katana') {
      // For Katana chapters, use the provider methods
      const slugId = chapter.url.split('/').filter(Boolean).slice(-2, -1)[0] || chapter.url;
      const chapterId = chapter.url.split('/').filter(Boolean).pop() || '';
      
      // Construct the URL using the provider
      const katanaUrl = KatanaProvider.getSeriesUrl(slugId);
      
      const response = await fetch(katanaUrl, {
        headers: KatanaProvider.getHeaders()
      });
      
      if (response.ok) {
        const responseData = await response.json();
        
        // Use the provider's parser to extract images
        const images = KatanaProvider.parseChapterResponse(responseData);
        if (images.length > 0) {
          // Get the random page, but make sure it's within bounds
          const pageIndex = Math.min(randomPage, images.length - 1);
          return images[pageIndex] || (coverImage || defaultThumbnail);
        }
        
        // Fallback to previous formats
        if (responseData && responseData.success && responseData.data && responseData.data.images) {
          const images = responseData.data.images.map((img: any) => typeof img === 'string' ? img : img.url || img);
          const pageIndex = Math.min(randomPage, images.length - 1);
          return images[pageIndex] || (coverImage || defaultThumbnail);
        }
      }
    } else {
      // For MangaDex, use the provider methods
      const chapterUrl = MangaDexProvider.getChapterUrl(chapter.id);
      
      const response = await fetch(chapterUrl, {
        headers: MangaDexProvider.getHeaders()
      });
      
      if (response.ok) {
        const responseData = await response.json();
        
        // Use the provider's parser to extract images
        const images = MangaDexProvider.parseChapterPagesResponse(responseData);
        if (images.length > 0) {
          // Get a random page between 3-8 but make sure it's within bounds
          const pageIndex = Math.min(randomPage, images.length - 1);
          return images[pageIndex] || (coverImage || defaultThumbnail);
        }
      }
    }
    
    // Return the cover image as fallback if available
    return coverImage || defaultThumbnail;
  } catch (error) {
    console.error('Error fetching chapter thumbnail:', error);
    // Return the cover image as fallback if available
    return coverImage || defaultThumbnail;
  }
};

// Update the generateRandomPageThumbnails function to process chapters in batches
const generateRandomPageThumbnails = async (chapters: Chapter[], coverImage?: string, startIndex: number = 0, batchSize: number = 10) => {
  const thumbnailMap: Record<string, string> = {};
  
  // Process a batch of chapters starting from startIndex
  const endIndex = Math.min(startIndex + batchSize, chapters.length);
  const chaptersToProcess = chapters.slice(startIndex, endIndex);
  
  console.log(`[Thumbnails] Processing chapters ${startIndex} to ${endIndex-1} out of ${chapters.length}`);
  
  await Promise.all(chaptersToProcess.map(async (chapter) => {
    try {
      const thumbnailUrl = await fetchChapterThumbnail(chapter, coverImage);
      if (thumbnailUrl) {
        thumbnailMap[chapter.id] = thumbnailUrl;
      } else {
        thumbnailMap[chapter.id] = coverImage || defaultThumbnail;
      }
    } catch (error) {
      console.error(`Error fetching thumbnail for chapter ${chapter.number}:`, error);
      thumbnailMap[chapter.id] = coverImage || defaultThumbnail;
    }
  }));
  
  return thumbnailMap;
};

// Add this improved helper function to parse MangaDex responses that don't match the expected format
const parseMangaDexResponse = (responseData: any): Chapter[] => {
  if (!responseData) {
    console.log('[MangaDex Helper] No response data to parse');
    return [];
  }
  
  console.log('[MangaDex Helper] Parsing response of type:', typeof responseData);
  console.log('[MangaDex Helper] Response keys:', responseData ? Object.keys(responseData).join(', ') : 'No data');
  
  // Check for Consumet API format (id, title, chapters structure)
  if (responseData.id && responseData.title && Array.isArray(responseData.chapters)) {
    console.log('[MangaDex Helper] Found Consumet API format with', responseData.chapters.length, 'chapters');
    
    // No filtering by language - take all chapters except those with 0 pages
    const filteredChapters = responseData.chapters.filter((ch: any) => {
      return ch.pages && ch.pages > 0;
    });
    
    console.log('[MangaDex Helper] Filtered out', responseData.chapters.length - filteredChapters.length, 'chapters with 0 pages');
    
    return filteredChapters.map((ch: any, index: number) => ({
      id: ch.id || '',
      number: ch.chapterNumber || ch.number || '',
      title: ch.title || `Chapter ${ch.chapterNumber || ch.number || ''}`,
      url: ch.id || '',
      volume: ch.volumeNumber || ch.volume || '',
      pages: ch.pages || 0,
      translatedLanguage: ch.translatedLanguage || ch.lang || 'en',
      updatedAt: ch.releaseDate || ch.updatedAt || '',
      thumbnail: responseData.image || ch.thumbnail || '',
      isLatest: index === 0,
      source: 'mangadex'
    }));
  }
  
  // Check if the response has a chapters array
  if (responseData.chapters && Array.isArray(responseData.chapters)) {
    console.log('[MangaDex Helper] Found standard chapters array with', responseData.chapters.length, 'chapters');
    
    // Filter out chapters with 0 pages
    const filteredChapters = responseData.chapters.filter((ch: any) => {
      return ch.pages && ch.pages > 0;
    });
    
    console.log('[MangaDex Helper] Filtered out', responseData.chapters.length - filteredChapters.length, 'chapters with 0 pages');
    
    return filteredChapters.map((ch: any, index: number) => ({
      id: ch.id || '',
      number: ch.chapterNumber || ch.number || '',
      title: ch.title || `Chapter ${ch.chapterNumber || ch.number || ''}`,
      url: ch.id || '',
      volume: ch.volumeNumber || ch.volume || '',
      pages: ch.pages || 0,
      translatedLanguage: ch.translatedLanguage || ch.lang || 'en',
      updatedAt: ch.updatedAt || '',
      thumbnail: ch.thumbnail || '',
      isLatest: index === 0,
      source: 'mangadex'
    }));
  }
  
  // Check if the response itself is an array of chapters
  if (Array.isArray(responseData)) {
    console.log('[MangaDex Helper] Response is directly an array of', responseData.length, 'items');
    
    // Filter out chapters with 0 pages
    const filteredChapters = responseData.filter((ch: any) => {
      return ch.pages && ch.pages > 0;
    });
    
    console.log('[MangaDex Helper] Filtered out', responseData.length - filteredChapters.length, 'chapters with 0 pages');
    
    return filteredChapters.map((ch: any, index: number) => ({
      id: ch.id || '',
      number: ch.chapterNumber || ch.number || '',
      title: ch.title || `Chapter ${ch.chapterNumber || ch.number || ''}`,
      url: ch.id || '',
      volume: ch.volumeNumber || ch.volume || '',
      pages: ch.pages || 0,
      translatedLanguage: ch.translatedLanguage || ch.lang || 'en',
      updatedAt: ch.updatedAt || ch.releaseDate || '',
      thumbnail: ch.thumbnail || '',
      isLatest: index === 0,
      source: 'mangadex'
    }));
  }
  
  // Last resort: check if the response is a manga with data property containing chapters
  if (responseData.data && responseData.data.chapters && Array.isArray(responseData.data.chapters)) {
    console.log('[MangaDex Helper] Found chapters in data.chapters property with', responseData.data.chapters.length, 'chapters');
    
    // Filter out chapters with 0 pages
    const filteredChapters = responseData.data.chapters.filter((ch: any) => {
      return ch.pages && ch.pages > 0;
    });
    
    console.log('[MangaDex Helper] Filtered out', responseData.data.chapters.length - filteredChapters.length, 'chapters with 0 pages');
    
    return filteredChapters.map((ch: any, index: number) => ({
      id: ch.id || '',
      number: ch.chapterNumber || ch.number || '',
      title: ch.title || `Chapter ${ch.chapterNumber || ch.number || ''}`,
      url: ch.id || '',
      volume: ch.volumeNumber || ch.volume || '',
      pages: ch.pages || 0,
      translatedLanguage: ch.translatedLanguage || ch.lang || 'en',
      updatedAt: ch.updatedAt || ch.releaseDate || '',
      thumbnail: ch.thumbnail || responseData.image || responseData.data.image || '',
      isLatest: index === 0,
      source: 'mangadex'
    }));
  }
  
  console.log('[MangaDex Helper] No recognized chapter format found in the response');
  return [];
};

export default function ChapterList({ mangaTitle, anilistId, countryOfOrigin, coverImage, mangaId }: ChapterListProps) {
  const { currentTheme } = useTheme();
  const { isDarkMode } = useTheme();
  const { isIncognito } = useIncognito();
  
  // STATE VARIABLES
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [allChapters, setAllChapters] = useState<Chapter[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMoreChapters, setHasMoreChapters] = useState(true);
  const [readProgress, setReadProgress] = useState(0);
  const [sortAscending, setSortAscending] = useState(false);
  const [provider, setProvider] = useState<Provider>('katana');
  const [showChapterModal, setShowChapterModal] = useState(false);
  const [selectedChapter, setSelectedChapter] = useState<Chapter | null>(null);
  const [chapterThumbnails, setChapterThumbnails] = useState<Record<string, string>>({});
  const [columnCount, setColumnCount] = useState(1);
  const [searchVisible, setSearchVisible] = useState(false);
  const [adaptationInfo, setAdaptationInfo] = useState<AnimeAdaptation[] | null>(null);
  const [selectedSource, setSelectedSource] = useState<string>('');
  const [showNotification, setShowNotification] = useState(false);
  const [providerPreferences, setProviderPreferences] = useState<ProviderPreferences>({
    defaultProvider: 'katana',
    autoSelectSource: true,
    preferredChapterLanguage: 'en',
    preferredScanlationGroup: '',
    showDataSaver: false,
    cacheImages: true,
    cacheDuration: 7
  });
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);
  const [internalMangaId, setInternalMangaId] = useState<string | null>(mangaId || null);
  
  // Add volume range state variables similar to EpisodeList
  const [volumeRanges, setVolumeRanges] = useState<Chapter[][]>([]);
  const [activeVolumeTab, setActiveVolumeTab] = useState(0);
  const [isNewestFirst, setIsNewestFirst] = useState(true);
  
  // Add these constants inside the component
  const CHAPTERS_PER_PAGE = 20;
  const INITIAL_LOAD_COUNT = 40;
  const THUMBNAIL_BATCH_SIZE = 100;
  const ANILIST_GRAPHQL_ENDPOINT = 'https://graphql.anilist.co';

  // Add these state variables inside the component
  const [processedBatches, setProcessedBatches] = useState<number[]>([]);
  const [isLoadingMoreThumbnails, setIsLoadingMoreThumbnails] = useState(false);

  // Define the helper components here inside the main component
  // Update the EmptyView component to properly wrap text
  const EmptyView = ({ message, style }: { message?: string, style?: any }) => (
    <View style={[styles.emptyContainer, style]}>
      {message && (
        <Text style={[styles.emptyText, { color: currentTheme.colors.textSecondary }]}>
          {message}
        </Text>
      )}
    </View>
  );

  // Update the loading state component
  const LoadingView = ({ message }: { message?: string }) => (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color="#02A9FF" />
      {message && (
        <Text style={[styles.loadingText, { color: currentTheme.colors.textSecondary }]}>
          {message}
        </Text>
      )}
    </View>
  );

  // Update the error state component
  const ErrorView = ({ message, onRetry }: { message: string, onRetry: () => void }) => (
    <View style={styles.errorContainer}>
      <Text style={[styles.errorText, { color: currentTheme.colors.textSecondary }]}>
        {message}
      </Text>
      <TouchableOpacity style={styles.retryButton} onPress={onRetry}>
        <Text style={styles.retryButtonText}>Retry</Text>
      </TouchableOpacity>
    </View>
  );

  // Define the missing variables and functions
  const imageHeaders = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Referer': 'https://takiapi.xyz/'
  };

  // Remove the defaultThumbnail definition from here since we moved it above
  const actualThumbnail = coverImage || defaultThumbnail;

  // Fetch user's reading progress from AniList
  const fetchAniListProgress = useCallback(async () => {
    if (!anilistId) return;
    
    try {
      const token = await SecureStore.getItemAsync(STORAGE_KEY.AUTH_TOKEN);
      if (!token) {
        console.log('[ChapterList] No auth token found, skipping AniList progress fetch');
        return;
      }
      
      const query = `
        query ($mediaId: Int) {
          Media(id: $mediaId) {
            mediaListEntry {
              progress
            }
          }
        }
      `;
      
      const response = await fetch(ANILIST_GRAPHQL_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          query,
          variables: {
            mediaId: parseInt(anilistId)
          }
        })
      });
      
      const data = await response.json();
      
      if (data?.data?.Media?.mediaListEntry?.progress) {
        const progress = data.data.Media.mediaListEntry.progress;
        console.log(`[ChapterList] Fetched user progress from AniList: ${progress} chapters`);
        setReadProgress(progress);
      } else {
        console.log('[ChapterList] No user progress found on AniList');
      }
    } catch (error) {
      console.error('[ChapterList] Error fetching AniList progress:', error);
    }
  }, [anilistId]);

  useEffect(() => {
    // Only search once preferences are loaded
    if (!preferencesLoaded) {
      console.log('[ChapterList] Waiting for provider preferences to load...');
      return;
    }

    console.log('[ChapterList] Provider preferences loaded, continuing with search');

    // Initialize search when component mounts
    if (mangaId) {
      console.log('[ChapterList] Using existing mangaId, fetching chapters directly');
      fetchChapters(mangaId);
    } else {
      // Add debug logging for the manga titles we received
      console.log('[DEBUG] About to search manga with preferences:', {
        autoSelectSource: providerPreferences.autoSelectSource,
        defaultProvider: providerPreferences.defaultProvider,
        english: mangaTitle?.english || 'None',
        userPreferred: mangaTitle?.userPreferred || 'None',
        anilistId: anilistId || 'None',
        mangaId: mangaId || 'None'
      });
      searchManga();
    }
    
    // Fetch AniList progress if anilistId is provided
    if (anilistId) {
      fetchAniListProgress();
    }
  }, [mangaId, anilistId, fetchAniListProgress, preferencesLoaded]);

  // Add listener for updates to user progress
  useEffect(() => {
    const progressUpdateListener = DeviceEventEmitter.addListener('refreshMangaDetails', () => {
      if (anilistId) {
        fetchAniListProgress();
      }
    });
    
    return () => {
      progressUpdateListener.remove();
    };
  }, [anilistId, fetchAniListProgress]);

  // Add volume range creation effect similar to EpisodeList
  useEffect(() => {
    if (chapters && chapters.length > 0) {
      console.log('[ChapterList] Creating volume ranges from', chapters.length, 'chapters');
      
      // Sort chapters based on the current sort order
      const sortedChapters = [...chapters].sort((a, b) => {
        const numA = parseFloat(a.number) || 0;
        const numB = parseFloat(b.number) || 0;
        return isNewestFirst ? numB - numA : numA - numB;
      });
      
      // Group chapters by volume
      const volumeGroups = new Map<string, Chapter[]>();
      const noVolumeChapters: Chapter[] = [];
      
      sortedChapters.forEach(chapter => {
        if (chapter.volume && chapter.volume.trim() !== '') {
          const volumeKey = chapter.volume.trim();
          if (!volumeGroups.has(volumeKey)) {
            volumeGroups.set(volumeKey, []);
          }
          volumeGroups.get(volumeKey)!.push(chapter);
        } else {
          noVolumeChapters.push(chapter);
        }
      });
      
      // Convert to ranges array
      const ranges: Chapter[][] = [];
      
      // Sort volume keys numerically
      const sortedVolumeKeys = Array.from(volumeGroups.keys()).sort((a, b) => {
        const numA = parseFloat(a) || 0;
        const numB = parseFloat(b) || 0;
        return isNewestFirst ? numB - numA : numA - numB;
      });
      
      // Add volume groups to ranges
      sortedVolumeKeys.forEach(volumeKey => {
        const volumeChapters = volumeGroups.get(volumeKey)!;
        // Sort chapters within the volume
        volumeChapters.sort((a, b) => {
          const numA = parseFloat(a.number) || 0;
          const numB = parseFloat(b.number) || 0;
          return isNewestFirst ? numB - numA : numA - numB;
        });
        ranges.push(volumeChapters);
      });
      
      // Add chapters without volume info as a separate range if any exist
      if (noVolumeChapters.length > 0) {
        noVolumeChapters.sort((a, b) => {
          const numA = parseFloat(a.number) || 0;
          const numB = parseFloat(b.number) || 0;
          return isNewestFirst ? numB - numA : numA - numB;
        });
        ranges.push(noVolumeChapters);
      }
      
      // If no volume information is available, create ranges based on chapter count (24 chapters per range)
      if (ranges.length === 0 || (ranges.length === 1 && ranges[0] === noVolumeChapters && noVolumeChapters.length === sortedChapters.length)) {
        console.log('[ChapterList] No volume info found, creating chapter-based ranges');
        const chapterRanges: Chapter[][] = [];
        const rangeSize = 24;
        
        for (let i = 0; i < sortedChapters.length; i += rangeSize) {
          chapterRanges.push(sortedChapters.slice(i, i + rangeSize));
        }
        
        setVolumeRanges(chapterRanges);
      } else {
        setVolumeRanges(ranges);
      }
      
      console.log('[ChapterList] Created', ranges.length, 'volume ranges');
    } else {
      setVolumeRanges([]);
    }
  }, [chapters, isNewestFirst]);

  // Load provider preferences
  useEffect(() => {
    const loadProviderPreferences = async () => {
      try {
        const providerData = await AsyncStorage.getItem('mangaProviderPreferences');
        if (providerData) {
          const preferences = JSON.parse(providerData);
          console.log('[ChapterList] Loaded provider preferences from AsyncStorage:', preferences);
          setProviderPreferences(preferences);
          
          // Set initial provider based on preferences
          if (!preferences.autoSelectSource) {
            console.log('[ChapterList] Auto-select OFF, setting provider to:', preferences.defaultProvider);
            setProvider(preferences.defaultProvider);
          } else {
            console.log('[ChapterList] Auto-select ON, defaulting to:', preferences.defaultProvider);
          }
        } else {
          console.log('[ChapterList] No provider preferences found in AsyncStorage, using defaults');
        }
        
        // Mark preferences as loaded
        setPreferencesLoaded(true);
      } catch (error) {
        console.error('[ChapterList] Failed to load provider preferences:', error);
        // Even on error, mark as loaded with defaults
        setPreferencesLoaded(true);
      }
    };

    loadProviderPreferences();

    // Add listener for preference changes
    const preferenceListener = DeviceEventEmitter.addListener(
      'mangaProviderPreferencesChanged', 
      (newPreferences) => {
        console.log('[ChapterList] Provider preferences changed event received:', newPreferences);
        setProviderPreferences(newPreferences);
        
        // Update provider/source if auto-select is off
        if (!newPreferences.autoSelectSource) {
          console.log('[ChapterList] Updating provider to:', newPreferences.defaultProvider);
          setProvider(newPreferences.defaultProvider);
          
          // If the page is already loaded, re-search with new provider
          if (mangaTitle && !isLoading) {
            console.log('[ChapterList] Re-searching with new provider settings');
            searchManga();
          }
        }
      }
    );

    return () => {
      preferenceListener.remove();
    };
  }, []);

  const applyAdaptationToChapters = (chapters: Chapter[], adaptationInfo?: AnimeAdaptation[]) => {
    if (!adaptationInfo || !Array.isArray(adaptationInfo) || adaptationInfo.length === 0) {
      return chapters;
    }

    return chapters.map(chapter => {
      const chapterNum = parseFloat(chapter.number);
      if (isNaN(chapterNum)) return chapter;

      for (const adaptation of adaptationInfo) {
        if (adaptation.start_chapter && adaptation.end_chapter) {
          if (chapterNum >= adaptation.start_chapter && chapterNum <= adaptation.end_chapter) {
            return {
              ...chapter,
              isAnimeAdapted: true,
              adaptationInfo: adaptation.title
            };
          }
        }
      }
      return chapter;
    });
  };

  const handleLoadMore = async () => {
    if (isLoadingMore || !hasMoreChapters) return;
    
    console.log('[Chapters] Loading more chapters...');
    await loadMoreChapters();
  };

  const searchManga = async () => {
    if (!mangaTitle) {
      console.error('[ChapterList] No manga title provided for search');
      setError('No manga title provided');
      setIsLoading(false);
      return;
    }

    if (!preferencesLoaded) {
      console.log('[ChapterList] Preferences not loaded yet, waiting...');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      
      const titleToSearch = mangaTitle.userPreferred || mangaTitle.english || '';
      
      if (!titleToSearch) {
        setError('No valid title available for search');
        setIsLoading(false);
        return;
      }
      
      // Log if we have an AniList ID to help with matching
      if (anilistId) {
        console.log(`[API] Will try to match with AniList ID: ${anilistId}`);
      }
      
      // Create variations of the title to try
      const titleVariations = [titleToSearch];
      
      // Add romaji title if available and different from other titles
      if (mangaTitle.romaji && 
          mangaTitle.romaji !== mangaTitle.userPreferred && 
          mangaTitle.romaji !== mangaTitle.english) {
        titleVariations.push(mangaTitle.romaji);
      }
      
      // Add native title if available and different from other titles
      if (mangaTitle.native && 
          mangaTitle.native !== mangaTitle.userPreferred && 
          mangaTitle.native !== mangaTitle.english && 
          mangaTitle.native !== mangaTitle.romaji) {
        titleVariations.push(mangaTitle.native);
      }
      
      console.log('[API] Will try these title variations:', JSON.stringify(titleVariations));
      
      let mangadexId = null;
      let katanaResult = null;
      let mangafireResult = null;
      
      // Try each title variation
      for (let i = 0; i < titleVariations.length; i++) {
        const currentTitle = titleVariations[i];
        console.log(`[API] Trying title variation ${i+1}/${titleVariations.length}: "${currentTitle}"`);
        
        // Decide which providers to search based on auto-select setting
        if (providerPreferences.autoSelectSource) {
          console.log('[API] Auto-select is ON, will try Katana first, then MangaDex, then MangaFire');
          
          // Try Katana first when auto-select is on
          try {
            const katanaSearchUrl = KatanaProvider.getSearchUrl(currentTitle);
            console.log('[API] Search URL (Katana): ', katanaSearchUrl);
            
            // Use the new fetchWithFallback method
            const searchResponse = await KatanaProvider.fetchWithFallback(
              katanaSearchUrl, 
              currentTitle,
              true, // isMangaSearch
              false, // isChapterFetch
              '' // chapterId
            );
            
            if (searchResponse.success && searchResponse.data?.results && searchResponse.data.results.length > 0) {
              // Instead of just taking the first result, try to find the best match
              // This helps avoid choosing side stories or related manga
              let bestMatch = null;
              
              console.log(`[API] Found ${searchResponse.data.results.length} results on Katana`);
              
              // First, log all results for debugging
              searchResponse.data.results.forEach((result: any, index: number) => {
                console.log(`[API] Katana result ${index+1}: ${result.title} (${result.slugId})`);
              });
              
              // If we have an AniList ID, we should prioritize exact title matches
              const exactTitleMatch = searchResponse.data.results.find((result: any) => {
                // Normalize titles for comparison by removing special chars and whitespace
                const normalizedResultTitle = result.title.toLowerCase().replace(/[^\w\s]/g, '').trim();
                const normalizedSearchTitle = currentTitle.toLowerCase().replace(/[^\w\s]/g, '').trim();
                
                // Check for exact match (ignoring case and special chars)
                return normalizedResultTitle === normalizedSearchTitle;
              });
              
              if (exactTitleMatch) {
                console.log('[API] Found exact title match on Katana:', exactTitleMatch.title);
                bestMatch = exactTitleMatch;
              } else {
                // If no exact match, look for the result with the shortest title 
                // that contains the search title (often the main series rather than a side story)
                let mainSeriesMatch = null;
                let shortestTitleLength = Infinity;
                
                searchResponse.data.results.forEach((result: any) => {
                  const normalizedResultTitle = result.title.toLowerCase().replace(/[^\w\s]/g, '').trim();
                  const normalizedSearchTitle = currentTitle.toLowerCase().replace(/[^\w\s]/g, '').trim();
                  
                  if (normalizedResultTitle.includes(normalizedSearchTitle) && 
                      result.title.length < shortestTitleLength) {
                    shortestTitleLength = result.title.length;
                    mainSeriesMatch = result;
                  }
                });
                
                if (mainSeriesMatch) {
                  console.log('[API] Found main series match on Katana:', (mainSeriesMatch as any).title);
                  bestMatch = mainSeriesMatch;
                } else {
                  // Fallback to first result
                  bestMatch = searchResponse.data.results[0];
                }
              }
              
              // Use the best match
              katanaResult = bestMatch;
              console.log('[API] Selected manga on Katana:', katanaResult.title);
              console.log('[API] Katana slug ID:', katanaResult.slugId);
              break;
            }
          } catch (error) {
            console.error('[API] Katana search error:', error);
          }
          
          // If Katana fails, try MangaDex
          if (!katanaResult) {
            try {
              const mangadexSearchUrl = MangaDexProvider.getSearchUrl(currentTitle);
              console.log('[API] Search URL (MangaDex): ', mangadexSearchUrl);
              
              const mangadexResponse = await fetch(mangadexSearchUrl, {
                headers: MangaDexProvider.getHeaders()
              });
              
              if (mangadexResponse.ok) {
                const responseData = await mangadexResponse.json();
                const results = MangaDexProvider.formatSearchResults(responseData);
                
                if (results && results.length > 0) {
                  mangadexId = results[0].id;
                  console.log('[API] Found manga on MangaDx:', results[0].title);
                  console.log('[API] MangaDx ID:', mangadexId);
                  break;
                }
              }
            } catch (error) {
              console.error('[API] MangaDx search error:', error);
            }
          }
          
          // If both Katana and MangaDex fail, try MangaFire
          if (!katanaResult && !mangadexId) {
            try {
              console.log('[API] Search URL (MangaFire): ', `https://magaapinovel.xyz/api/search/${encodeURIComponent(currentTitle)}`);
              
              const mangafireResults = await MangaFireProvider.search(currentTitle);
              
              if (mangafireResults && mangafireResults.length > 0) {
                mangafireResult = mangafireResults[0];
                console.log('[API] Found manga on MangaFire:', mangafireResult.title);
                console.log('[API] MangaFire ID:', mangafireResult.id);
                break;
              }
            } catch (error) {
              console.error('[API] MangaFire search error:', error);
            }
          }
        } else {
          // Auto-select is OFF, use only the selected provider
          const selectedProvider = providerPreferences.defaultProvider;
          console.log('[API] Auto-select is OFF, using selected provider:', selectedProvider);
          
          if (selectedProvider === 'mangadex') {
            try {
              const mangadexSearchUrl = MangaDexProvider.getSearchUrl(currentTitle);
              console.log('[API] Search URL (MangaDex only):', mangadexSearchUrl);
              
              const mangadexResponse = await fetch(mangadexSearchUrl, {
                headers: MangaDexProvider.getHeaders()
              });
              
              if (mangadexResponse.ok) {
                const responseData = await mangadexResponse.json();
                const results = MangaDexProvider.formatSearchResults(responseData);
                
                if (results && results.length > 0) {
                  mangadexId = results[0].id;
                  console.log('[API] Found manga on MangaDex:', results[0].title);
                  console.log('[API] MangaDex ID:', mangadexId);
                  break;
                }
              }
            } catch (error) {
              console.error('[API] MangaDex search error:', error);
            }
          } else if (selectedProvider === 'katana') {
            try {
              const katanaSearchUrl = KatanaProvider.getSearchUrl(currentTitle);
              console.log('[API] Search URL (Katana only):', katanaSearchUrl);
              
              const katanaResponse = await fetch(katanaSearchUrl, {
                headers: KatanaProvider.getHeaders()
              });
              
              if (katanaResponse.ok) {
                const responseData = await katanaResponse.json();
                
                if (responseData?.data?.results && responseData.data.results.length > 0) {
                  katanaResult = responseData.data.results[0];
                  console.log('[API] Found manga on Katana:', katanaResult.title);
                  console.log('[API] Katana slug ID:', katanaResult.slugId);
                  break;
                }
              }
            } catch (error) {
              console.error('[API] Katana search error:', error);
            }
          } else if (selectedProvider === 'mangafire') {
            try {
              console.log('[API] Search URL (MangaFire only): ', `https://magaapinovel.xyz/api/search/${encodeURIComponent(currentTitle)}`);
              
              const mangafireResults = await MangaFireProvider.search(currentTitle);
              
              if (mangafireResults && mangafireResults.length > 0) {
                mangafireResult = mangafireResults[0];
                console.log('[API] Found manga on MangaFire:', mangafireResult.title);
                console.log('[API] MangaFire ID:', mangafireResult.id);
                break;
              }
            } catch (error) {
              console.error('[API] MangaFire search error:', error);
            }
          }
        }
      }
      
      // Set the manga ID based on available results
      let mangaInfo = null;
      
      if (providerPreferences.autoSelectSource) {
        // Auto-select is ON, prefer Katana, fallback to MangaDex, then MangaFire
        if (katanaResult) {
          console.log('[API] Auto-select is ON: Using Katana ID:', katanaResult.slugId);
          mangaInfo = {
            id: katanaResult.slugId,
            provider: 'katana'
          };
        } else if (mangadexId) {
          console.log('[API] Auto-select is ON: Falling back to MangaDex ID:', mangadexId);
          mangaInfo = {
            id: mangadexId,
            provider: 'mangadex'
          };
        } else if (mangafireResult) {
          console.log('[API] Auto-select is ON: Falling back to MangaFire ID:', mangafireResult.id);
          mangaInfo = {
            id: mangafireResult.id,
            provider: 'mangafire'
          };
        }
      } else {
        // Auto-select is OFF, use the provider from preferences
        const selectedProvider = providerPreferences.defaultProvider;
        
        if (selectedProvider === 'mangadex' && mangadexId) {
          console.log('[API] Using selected provider (mangadex):', { id: mangadexId });
          mangaInfo = {
            id: mangadexId,
            provider: 'mangadex'
          };
        } else if (selectedProvider === 'katana' && katanaResult) {
          console.log('[API] Using selected provider (katana):', { id: katanaResult.slugId });
          mangaInfo = {
            id: katanaResult.slugId,
            provider: 'katana'
          };
        } else if (selectedProvider === 'mangafire' && mangafireResult) {
          console.log('[API] Using selected provider (mangafire):', { id: mangafireResult.id });
          mangaInfo = {
            id: mangafireResult.id,
            provider: 'mangafire'
          };
        }
      }
      
      if (!mangaInfo) {
        console.error('[API] No manga IDs found for any provider');
        setError('Could not find the manga. Please try a different title.');
        setIsLoading(false);
        return;
      }
      
      console.log('[API] Final manga info for fetch:', mangaInfo);
      
      // Update state with the selected manga ID
      setInternalMangaId(mangaInfo.id);
      setProvider(mangaInfo.provider as 'katana' | 'mangadex' | 'mangafire');
      
      // Verify the ID was set properly
      console.log('[API] ID to be used for fetching:', mangaInfo.id);

      // Fetch chapters directly with the manga info ID instead of waiting for state
      await fetchChapters(mangaInfo.id, mangaInfo.provider);
      
    } catch (error: any) {
      console.error('[API] Error in searchManga:', error);
      setError(error.message || 'Failed to search for manga');
      setIsLoading(false);
    }
  };
  
  const fetchMergedChapters = async (firstPage: boolean = true, language?: string, directMangaId?: string) => {
    if (firstPage) {
      setIsLoading(true);
    } else {
      setIsLoadingMore(true);
    }
      
    // Use the direct manga ID if provided, otherwise use the state
    const mangaIdToUse = directMangaId || internalMangaId;
    
    // Check explicitly for mangaIdToUse and log its value
    console.log('[ChapterList] fetchMergedChapters called with mangaId:', mangaIdToUse);
    
    if (!mangaIdToUse) {
      console.error('[ChapterList] No manga ID provided for fetching chapters');
      setIsLoading(false);
      setIsLoadingMore(false);
      setError('No manga ID available. Please try searching again.');
      return;
    }
    
    try {
      console.log(`[ChapterList] Fetching chapters for ${mangaIdToUse}`);
      console.log(`[ChapterList] Provider preferences:`, providerPreferences);
      
      // Calculate offset for pagination
      const offset = firstPage ? 0 : currentPage * CHAPTERS_PER_PAGE;
      
      // Check if auto-select is enabled or not
      if (providerPreferences?.autoSelectSource) {
        // With auto-select turned ON:
        // Fetch from both providers and select the one with more chapters
        console.log('[ChapterList] Auto-select is ON - fetching from both providers');
        
        // Variables to store chapters from each provider
        let katanaChapters: Chapter[] = [];
        let mangadexChapters: Chapter[] = [];
        let mangafireChapters: Chapter[] = [];
        let katanaSlugId = mangaIdToUse;
        let mangaDexId = null;
        let mangaFireId = null;
        
        // Step 1: Fetch from Katana first
        try {
          console.log('[ChapterList] Attempting to fetch from Katana');
          
          // If we need to search for the manga first
          if ((!katanaSlugId || provider !== 'katana') && mangaTitle) {
            // (Existing Katana search logic)
            // ...
          }
          
          // If we have a Katana slug ID, try to fetch chapters
          if (katanaSlugId) {
            try {
              const katanaUrl = KatanaProvider.getSeriesUrl(katanaSlugId);
              console.log('[ChapterList] Fetching chapters from Katana:', katanaUrl);
              
              // Use fetchWithFallback for better error handling
              const response = await KatanaProvider.fetchWithFallback(
                katanaUrl,
                mangaTitle?.userPreferred || mangaTitle?.english || '',
                false, // isMangaSearch
                true,  // isChapterFetch
                katanaSlugId // chapterId
              );
              
              if (response.success && response.data) {
                console.log('[ChapterList] Successfully received Katana response');
                
                // Format chapters from the response
                katanaChapters = KatanaProvider.formatChaptersFromResponse(response, 'katana');
                
                if (katanaChapters && katanaChapters.length > 0) {
                  console.log('[ChapterList] Got', katanaChapters.length, 'chapters from Katana');
                }
              }
            } catch (katanaError: any) {
              console.error('[ChapterList] Error fetching from Katana:', katanaError.message);
            }
          }
        } catch (katanaProviderError: any) {
          console.error('[ChapterList] Error in Katana provider:', katanaProviderError.message);
        }
        
        // Step 2: Fetch from MangaDex
        try {
          console.log('[ChapterList] Attempting to fetch from MangaDex');
          
          // If we need to search for MangaDex ID
          if (!mangaDexId && mangaTitle) {
            try {
              // Create a list of titles to try
              const titlesToSearch = [];
              
              // Add primary titles
              if (mangaTitle.userPreferred) titlesToSearch.push(mangaTitle.userPreferred);
              if (mangaTitle.english && mangaTitle.english !== mangaTitle.userPreferred) {
                titlesToSearch.push(mangaTitle.english);
              }
              
              // Add romaji and native titles
              if (mangaTitle.romaji && 
                  mangaTitle.romaji !== mangaTitle.userPreferred && 
                  mangaTitle.romaji !== mangaTitle.english) {
                titlesToSearch.push(mangaTitle.romaji);
              }
              
              if (mangaTitle.native && 
                  mangaTitle.native !== mangaTitle.userPreferred && 
                  mangaTitle.native !== mangaTitle.english && 
                  mangaTitle.native !== mangaTitle.romaji) {
                titlesToSearch.push(mangaTitle.native);
              }
              
              // If no titles available, use a fallback
              if (titlesToSearch.length === 0) {
                titlesToSearch.push(mangaTitle.userPreferred || mangaTitle.english || '');
              }
              
              console.log(`[ChapterList] Title variations to search: ${JSON.stringify(titlesToSearch)}`);
              
              // Try each title until we find a match
              for (const titleToSearch of titlesToSearch) {
                if (mangaDexId || !titleToSearch) continue;
                
                console.log(`[ChapterList] Searching MangaDex for: "${titleToSearch}"`);
                
                try {
                  const mangadexSearchUrl = MangaDexProvider.getSearchUrl(titleToSearch);
                  const searchResponse = await axios.get(mangadexSearchUrl, {
                    headers: MangaDexProvider.getHeaders()
                  });
                  
                  if (searchResponse.status === 200 && searchResponse.data?.results?.length) {
                    mangaDexId = searchResponse.data.results[0].id;
                    console.log('[ChapterList] Found manga on MangaDex:', mangaDexId);
                    break;
                  } else {
                    console.log(`[ChapterList] No results found for "${titleToSearch}" on MangaDex`);
                  }
                } catch (searchErr) {
                  console.error(`[ChapterList] Error searching MangaDex with title "${titleToSearch}":`, searchErr);
                }
              }
            } catch (searchError: any) {
              console.error('[ChapterList] Error searching MangaDex:', searchError.message);
            }
          }
          
          // Now that we have a MangaDex ID, fetch the chapters
          if (mangaDexId) {
            const mangaDexUrl = MangaDexProvider.getSeriesInfoUrl(mangaDexId, 0, 100, language || 'en');
            console.log('[ChapterList] Fetching from MangaDex:', mangaDexUrl);
            
            const response = await axios.get(mangaDexUrl, {
              headers: MangaDexProvider.getHeaders()
            });
            
            if (response.status === 200 && response.data) {
              // Process MangaDex response
              if (response.data.id && response.data.title && Array.isArray(response.data.chapters)) {
                console.log('[ChapterList] Got Consumet format response with', response.data.chapters.length, 'chapters');
                
                // Filter chapters with 0 pages
                const filteredChapters = response.data.chapters.filter((ch: any) => {
                  return ch.pages && ch.pages > 0;
                });
                
                if (filteredChapters.length > 0) {
                  console.log('[ChapterList] Using', filteredChapters.length, 'chapters from MangaDex');
                  
                  // Map to our Chapter format
                  mangadexChapters = filteredChapters.map((ch: any, index: number) => ({
                    id: ch.id || '',
                    number: ch.chapterNumber || ch.number || '',
                    title: ch.title || `Chapter ${ch.chapterNumber || ch.number || ''}`,
                    url: ch.id || '',
                    volume: ch.volumeNumber || ch.volume || '',
                    pages: ch.pages || 0,
                    translatedLanguage: ch.translatedLanguage || ch.lang || 'en',
                    updatedAt: ch.releaseDate || ch.updatedAt || '',
                    thumbnail: response.data.image || ch.thumbnail || coverImage || '',
                    isLatest: index === 0,
                    source: 'mangadex'
                  }));
                  
                  // Sort chapters by number in descending order (newest first)
                  mangadexChapters.sort((a: Chapter, b: Chapter) => {
                    const numA = parseFloat(a.number) || 0;
                    const numB = parseFloat(b.number) || 0;
                    return numB - numA;
                  });
                }
              } else {
                // Try to parse other response formats
                mangadexChapters = parseMangaDexResponse(response.data);
                
                // Sort chapters
                if (mangadexChapters.length > 0) {
                  mangadexChapters.sort((a: Chapter, b: Chapter) => {
                    const numA = parseFloat(a.number) || 0;
                    const numB = parseFloat(b.number) || 0;
                    return numB - numA;
                  });
                }
              }
            }
          }
        } catch (mdProviderError: any) {
          console.error('[ChapterList] Error in MangaDex provider:', mdProviderError.message);
        }
        
        // Step 3: Fetch from MangaFire
        try {
          console.log('[ChapterList] Attempting to fetch from MangaFire');
          
          // If we need to search for MangaFire ID
          if (!mangaFireId && mangaTitle) {
            try {
              // Create a list of titles to try
              const titlesToSearch = [];
              
              // Add primary titles
              if (mangaTitle.userPreferred) titlesToSearch.push(mangaTitle.userPreferred);
              if (mangaTitle.english && mangaTitle.english !== mangaTitle.userPreferred) {
                titlesToSearch.push(mangaTitle.english);
              }
              
              // Add romaji and native titles
              if (mangaTitle.romaji && 
                  mangaTitle.romaji !== mangaTitle.userPreferred && 
                  mangaTitle.romaji !== mangaTitle.english) {
                titlesToSearch.push(mangaTitle.romaji);
              }
              
              if (mangaTitle.native && 
                  mangaTitle.native !== mangaTitle.userPreferred && 
                  mangaTitle.native !== mangaTitle.english && 
                  mangaTitle.native !== mangaTitle.romaji) {
                titlesToSearch.push(mangaTitle.native);
              }
              
              // If no titles available, use a fallback
              if (titlesToSearch.length === 0) {
                titlesToSearch.push(mangaTitle.userPreferred || mangaTitle.english || '');
              }
              
              console.log(`[ChapterList] Title variations to search on MangaFire: ${JSON.stringify(titlesToSearch)}`);
              
              // Try each title until we find a match
              for (const titleToSearch of titlesToSearch) {
                if (mangaFireId || !titleToSearch) continue;
                
                console.log(`[ChapterList] Searching MangaFire for: "${titleToSearch}"`);
                
                try {
                  const mangafireResults = await MangaFireProvider.search(titleToSearch);
                  
                  if (mangafireResults && mangafireResults.length > 0) {
                    mangaFireId = mangafireResults[0].id;
                    console.log('[ChapterList] Found manga on MangaFire:', mangaFireId);
                    break;
                  } else {
                    console.log(`[ChapterList] No results found for "${titleToSearch}" on MangaFire`);
                  }
                } catch (searchErr) {
                  console.error(`[ChapterList] Error searching MangaFire with title "${titleToSearch}":`, searchErr);
                }
              }
            } catch (searchError: any) {
              console.error('[ChapterList] Error searching MangaFire:', searchError.message);
            }
          }
          
          // Now that we have a MangaFire ID, fetch the chapters
          if (mangaFireId) {
            console.log('[ChapterList] Fetching chapters from MangaFire for ID:', mangaFireId);
            
            try {
              const chapters = await MangaFireProvider.getChapters(mangaFireId, {
                offset: 0,
                limit: 100,
                includePages: true
              });
              
              if (chapters && chapters.length > 0) {
                console.log('[ChapterList] Got', chapters.length, 'chapters from MangaFire');
                
                // Map to our Chapter format and ensure source is set
                mangafireChapters = chapters.map((ch: any, index: number) => ({
                  id: ch.id || '',
                  number: ch.number || '',
                  title: ch.title || `Chapter ${ch.number || ''}`,
                  url: ch.url || ch.id || '',
                  volume: ch.volume || '',
                  pages: ch.pages || 0,
                  translatedLanguage: ch.translatedLanguage || 'en',
                  updatedAt: ch.updatedAt || '',
                  thumbnail: coverImage || '',
                  isLatest: index === 0,
                  source: 'mangafire',
                  scanlationGroup: ch.scanlationGroup || ch.scanlator || 'Unknown'
                }));
                
                // Sort chapters by number in descending order (newest first)
                mangafireChapters.sort((a: Chapter, b: Chapter) => {
                  const numA = parseFloat(a.number) || 0;
                  const numB = parseFloat(b.number) || 0;
                  return numB - numA;
                });
              }
            } catch (fetchError: any) {
              console.error('[ChapterList] Error fetching chapters from MangaFire:', fetchError.message);
            }
          }
        } catch (mfProviderError: any) {
          console.error('[ChapterList] Error in MangaFire provider:', mfProviderError.message);
        }
        
        // Step 4: Compare results and use the one with more chapters
        console.log(`[ChapterList] Provider comparison - Katana: ${katanaChapters.length} chapters, MangaDex: ${mangadexChapters.length} chapters, MangaFire: ${mangafireChapters.length} chapters`);
        
        if (katanaChapters.length > 0 || mangadexChapters.length > 0 || mangafireChapters.length > 0) {
          let selectedChapters: Chapter[] = [];
          let selectedProvider: 'katana' | 'mangadex' | 'mangafire' = 'katana';
          let selectedMangaId: string = katanaSlugId;
          
          // Find the provider with the most chapters
          if (mangafireChapters.length > katanaChapters.length && mangafireChapters.length > mangadexChapters.length) {
            console.log('[ChapterList] Auto-select chose MangaFire with more chapters');
            selectedChapters = mangafireChapters;
            selectedProvider = 'mangafire';
            selectedMangaId = mangaFireId || '';
          } else if (mangadexChapters.length > katanaChapters.length) {
            console.log('[ChapterList] Auto-select chose MangaDex with more chapters');
            selectedChapters = mangadexChapters;
            selectedProvider = 'mangadex';
            selectedMangaId = mangaDexId || '';
          } else {
            console.log('[ChapterList] Auto-select chose Katana with more chapters');
            selectedChapters = katanaChapters;
            selectedProvider = 'katana';
            selectedMangaId = katanaSlugId;
          }
          
          // Update state with selected provider's data
          setInternalMangaId(selectedMangaId);
          setProvider(selectedProvider);
          setChapters(selectedChapters);
          setCurrentPage(firstPage ? 1 : currentPage + 1);
          setIsLoading(false);
          setIsLoadingMore(false);
          setSelectedChapter(selectedChapters[0]);
          setSelectedSource(selectedProvider);
          return;
        }
      } else {
        // Auto-select is OFF, use the provider from preferences
        console.log('[ChapterList] Auto-select is OFF, using provider:', provider);
        
        // Use existing logic for non-auto-select mode
        if (provider === 'mangadex') {
          try {
            // If we need to search for MangaDex ID first
            let mangaDexId = null;
            
            if ((!mangaIdToUse || mangaIdToUse.includes('katana-')) && mangaTitle) {
              try {
                // Create a list of titles to try
                const titlesToSearch = [];
                
                // Add primary titles
                if (mangaTitle.userPreferred) titlesToSearch.push(mangaTitle.userPreferred);
                if (mangaTitle.english && mangaTitle.english !== mangaTitle.userPreferred) {
                  titlesToSearch.push(mangaTitle.english);
                }
                
                // Add additional titles if available
                if (mangaTitle.romaji && 
                    mangaTitle.romaji !== mangaTitle.userPreferred && 
                    mangaTitle.romaji !== mangaTitle.english) {
                  titlesToSearch.push(mangaTitle.romaji);
                }
                
                if (mangaTitle.native && 
                    mangaTitle.native !== mangaTitle.userPreferred && 
                    mangaTitle.native !== mangaTitle.english && 
                    mangaTitle.native !== mangaTitle.romaji) {
                  titlesToSearch.push(mangaTitle.native);
                }
                
                // If no titles available, use a fallback
                if (titlesToSearch.length === 0) {
                  titlesToSearch.push(mangaTitle.userPreferred || mangaTitle.english || '');
                }
                
                console.log(`[ChapterList] Title variations to search: ${JSON.stringify(titlesToSearch)}`);
                
                // Try each title until we find a match
                for (const titleToSearch of titlesToSearch) {
                  if (mangaDexId || !titleToSearch) continue;
                  
                  console.log(`[ChapterList] Searching MangaDex for: "${titleToSearch}"`);
                  
                  try {
                    const mangadexSearchUrl = MangaDexProvider.getSearchUrl(titleToSearch);
                    const searchResponse = await axios.get(mangadexSearchUrl, {
                      headers: MangaDexProvider.getHeaders()
                    });
                    
                    if (searchResponse.status === 200 && searchResponse.data?.results?.length) {
                      mangaDexId = searchResponse.data.results[0].id;
                      console.log('[ChapterList] Found manga on MangaDex:', mangaDexId);
                      break;
                    } else {
                      console.log(`[ChapterList] No results found for "${titleToSearch}" on MangaDex`);
                    }
                  } catch (searchErr) {
                    console.error(`[ChapterList] Error searching MangaDex with title "${titleToSearch}":`, searchErr);
                  }
                }
              } catch (searchError: any) {
                console.error('[ChapterList] Error searching MangaDex:', searchError.message);
              }
            } else {
              // Use the provided ID directly
              mangaDexId = mangaIdToUse;
            }
            
            // Now that we have a MangaDex ID, fetch the chapters
            if (mangaDexId) {
              const mangaDexUrl = MangaDexProvider.getSeriesInfoUrl(mangaDexId, 0, 100, language || 'en');
              console.log('[ChapterList] Fetching from MangaDex:', mangaDexUrl);
              
              const response = await axios.get(mangaDexUrl, {
                headers: MangaDexProvider.getHeaders()
              });
              
              if (response.status === 200 && response.data) {
                // Process MangaDex response
                if (response.data.id && response.data.title && Array.isArray(response.data.chapters)) {
                  console.log('[ChapterList] Got Consumet format response with', response.data.chapters.length, 'chapters');
                  
                  // Save the MangaDex ID for future use
                  setInternalMangaId(mangaDexId);
                  setProvider('mangadex');
                  
                  // Filter chapters with 0 pages
                  const filteredChapters = response.data.chapters.filter((ch: any) => {
                    return ch.pages && ch.pages > 0;
                  });
                  
                  if (filteredChapters.length > 0) {
                    console.log('[ChapterList] Using', filteredChapters.length, 'chapters from MangaDex');
                    
                    // Map to our Chapter format
                    const mappedChapters = filteredChapters.map((ch: any, index: number) => ({
                      id: ch.id || '',
                      number: ch.chapterNumber || ch.number || '',
                      title: ch.title || `Chapter ${ch.chapterNumber || ch.number || ''}`,
                      url: ch.id || '',
                      volume: ch.volumeNumber || ch.volume || '',
                      pages: ch.pages || 0,
                      translatedLanguage: ch.translatedLanguage || ch.lang || 'en',
                      updatedAt: ch.releaseDate || ch.updatedAt || '',
                      thumbnail: response.data.image || ch.thumbnail || coverImage || '',
                      isLatest: index === 0,
                      source: 'mangadex'
                    }));
                    
                    // Sort chapters by number in descending order (newest first)
                    mappedChapters.sort((a: Chapter, b: Chapter) => {
                      const numA = parseFloat(a.number) || 0;
                      const numB = parseFloat(b.number) || 0;
                      return numB - numA;
                    });
                    
                    // Success with MangaDex!
                    setChapters(mappedChapters);
                    setCurrentPage(firstPage ? 1 : currentPage + 1);
                    setIsLoading(false);
                    setIsLoadingMore(false);
                    setSelectedChapter(mappedChapters[0]);
                    setSelectedSource('mangadex');
                    return;
                  } else {
                    console.log('[ChapterList] MangaDex found no chapters with pages');
                  }
                } else {
                  // Try to parse other response formats
                  const chapters = parseMangaDexResponse(response.data);
                  
                  if (chapters.length > 0) {
                    console.log('[ChapterList] Parsed', chapters.length, 'chapters from MangaDex alternate format');
                    
                    // Sort chapters
                    chapters.sort((a: Chapter, b: Chapter) => {
                      const numA = parseFloat(a.number) || 0;
                      const numB = parseFloat(b.number) || 0;
                      return numB - numA;
                    });
                    
                    setInternalMangaId(mangaDexId);
                    setProvider('mangadex');
                    setChapters(chapters);
                    setCurrentPage(firstPage ? 1 : currentPage + 1);
                    setIsLoading(false);
                    setIsLoadingMore(false);
                    setSelectedChapter(chapters[0]);
                    setSelectedSource('mangadex');
                    return;
                  }
                }
              }
            }
          } catch (error) {
            console.error('[ChapterList] Error fetching MangaDex chapters:', error);
          }
        } else if (provider === 'katana') {
          // Try Katana if selected
          try {
            let katanaSlugId = mangaIdToUse;
            
            // If we have a Katana slug ID, try to fetch chapters
            if (katanaSlugId) {
              const katanaUrl = KatanaProvider.getSeriesUrl(katanaSlugId);
              console.log('[ChapterList] Fetching chapters from Katana:', katanaUrl);
              
              // Use fetchWithFallback for better error handling
              const response = await KatanaProvider.fetchWithFallback(
                katanaUrl,
                mangaTitle?.userPreferred || mangaTitle?.english || '',
                false, // isMangaSearch
                true,  // isChapterFetch
                katanaSlugId // chapterId
              );
              
              if (response.success && response.data) {
                console.log('[ChapterList] Successfully received Katana response');
                
                // Format chapters from the response
                const formattedChapters = KatanaProvider.formatChaptersFromResponse(response, 'katana');
                
                if (formattedChapters && formattedChapters.length > 0) {
                  console.log('[ChapterList] Got', formattedChapters.length, 'chapters from Katana');
                  
                  // Save state
                  setInternalMangaId(katanaSlugId);
                  setProvider('katana');
                  
                  setChapters(formattedChapters);
                  setCurrentPage(firstPage ? 1 : currentPage + 1);
                  setIsLoading(false);
                  setIsLoadingMore(false);
                  setSelectedChapter(formattedChapters[0]);
                  setSelectedSource('katana');
                  return;
                }
              }
            }
          } catch (katanaError: any) {
            console.error('[ChapterList] Error fetching from Katana:', katanaError.message);
          }
        } else if (provider === 'mangafire') {
          // Try MangaFire if selected
          try {
            let mangaFireId = mangaIdToUse;
            
            // If we need to search for MangaFire ID first
            if ((!mangaFireId || mangaFireId.includes('katana-') || mangaFireId.includes('mangadex-')) && mangaTitle) {
              try {
                // Create a list of titles to try
                const titlesToSearch = [];
                
                // Add primary titles
                if (mangaTitle.userPreferred) titlesToSearch.push(mangaTitle.userPreferred);
                if (mangaTitle.english && mangaTitle.english !== mangaTitle.userPreferred) {
                  titlesToSearch.push(mangaTitle.english);
                }
                
                // Add additional titles if available
                if (mangaTitle.romaji && 
                    mangaTitle.romaji !== mangaTitle.userPreferred && 
                    mangaTitle.romaji !== mangaTitle.english) {
                  titlesToSearch.push(mangaTitle.romaji);
                }
                
                if (mangaTitle.native && 
                    mangaTitle.native !== mangaTitle.userPreferred && 
                    mangaTitle.native !== mangaTitle.english && 
                    mangaTitle.native !== mangaTitle.romaji) {
                  titlesToSearch.push(mangaTitle.native);
                }
                
                // If no titles available, use a fallback
                if (titlesToSearch.length === 0) {
                  titlesToSearch.push(mangaTitle.userPreferred || mangaTitle.english || '');
                }
                
                console.log(`[ChapterList] Title variations to search on MangaFire: ${JSON.stringify(titlesToSearch)}`);
                
                // Try each title until we find a match
                for (const titleToSearch of titlesToSearch) {
                  if (mangaFireId || !titleToSearch) continue;
                  
                  console.log(`[ChapterList] Searching MangaFire for: "${titleToSearch}"`);
                  
                  try {
                    const mangafireResults = await MangaFireProvider.search(titleToSearch);
                    
                    if (mangafireResults && mangafireResults.length > 0) {
                      mangaFireId = mangafireResults[0].id;
                      console.log('[ChapterList] Found manga on MangaFire:', mangaFireId);
                      break;
                    } else {
                      console.log(`[ChapterList] No results found for "${titleToSearch}" on MangaFire`);
                    }
                  } catch (searchErr) {
                    console.error(`[ChapterList] Error searching MangaFire with title "${titleToSearch}":`, searchErr);
                  }
                }
              } catch (searchError: any) {
                console.error('[ChapterList] Error searching MangaFire:', searchError.message);
              }
            }
            
            // Now that we have a MangaFire ID, fetch the chapters
            if (mangaFireId) {
              console.log('[ChapterList] Fetching chapters from MangaFire for ID:', mangaFireId);
              
              try {
                const chapters = await MangaFireProvider.getChapters(mangaFireId, {
                  offset: 0,
                  limit: 100,
                  includePages: true
                });
                
                if (chapters && chapters.length > 0) {
                  console.log('[ChapterList] Got', chapters.length, 'chapters from MangaFire');
                  
                  // Map to our Chapter format and ensure source is set
                  const mappedChapters = chapters.map((ch: any, index: number) => ({
                    id: ch.id || '',
                    number: ch.number || '',
                    title: ch.title || `Chapter ${ch.number || ''}`,
                    url: ch.url || ch.id || '',
                    volume: ch.volume || '',
                    pages: ch.pages || 0,
                    translatedLanguage: ch.translatedLanguage || 'en',
                    updatedAt: ch.updatedAt || '',
                    thumbnail: coverImage || '',
                    isLatest: index === 0,
                    source: 'mangafire',
                    scanlationGroup: ch.scanlationGroup || ch.scanlator || 'Unknown'
                  }));
                  
                  // Sort chapters by number in descending order (newest first)
                  mappedChapters.sort((a: Chapter, b: Chapter) => {
                    const numA = parseFloat(a.number) || 0;
                    const numB = parseFloat(b.number) || 0;
                    return numB - numA;
                  });
                  
                  // Save state
                  setInternalMangaId(mangaFireId);
                  setProvider('mangafire');
                  
                  setChapters(mappedChapters);
                  setCurrentPage(firstPage ? 1 : currentPage + 1);
                  setIsLoading(false);
                  setIsLoadingMore(false);
                  setSelectedChapter(mappedChapters[0]);
                  setSelectedSource('mangafire');
                  return;
                } else {
                  console.log('[ChapterList] MangaFire found no chapters');
                }
              } catch (fetchError: any) {
                console.error('[ChapterList] Error fetching chapters from MangaFire:', fetchError.message);
              }
            }
          } catch (mangafireError: any) {
            console.error('[ChapterList] Error fetching from MangaFire:', mangafireError.message);
          }
        }
      }
    } catch (error: any) {
      console.error('[API ERROR] Fatal error fetching chapters:', error);
      setError(error.message || 'Failed to load chapters. Please try again.');
    } finally {
      if (firstPage) {
        setIsLoading(false);
      } else {
        setIsLoadingMore(false);
      }
    }
  };
  
  // Update the loadMoreChapters function
  const loadMoreChapters = async () => {
    if (isLoadingMore || !hasMoreChapters) return;
    
    const nextPage = currentPage + 1;
    setCurrentPage(nextPage);
    
    // Use the current manga ID directly if available
    if (internalMangaId) {
      console.log(`[ChapterList] Loading more chapters for ${internalMangaId}`);
      await fetchMergedChapters(false, providerPreferences.preferredChapterLanguage, internalMangaId);
    } else {
      console.error('[ChapterList] No manga ID available for loading more chapters');
      setIsLoadingMore(false);
    }
  };

  // Update the existing fetchChapters to call the new merged function for backward compatibility
  const fetchChapters = async (id: string, source: string = 'mangadex') => {
    console.log(`[ChapterList] fetchChapters called with ID: ${id}, source: ${source}`);
    
    // Use the ID directly without prefix
    const formattedId = id;
    
    // Update the state with the new ID
    setInternalMangaId(formattedId);
    setProvider(source as 'katana' | 'mangadex' | 'mangafire');
    
    // Fetch chapters directly with the ID
    console.log(`[ChapterList] Fetching chapters with ID: ${formattedId}, source: ${source}`);
    await fetchMergedChapters(true, providerPreferences.preferredChapterLanguage, formattedId);
  };

  const toggleSort = () => {
    setSortAscending(!sortAscending);
    // Sort the chapters
    const sortedChapters = [...chapters].sort((a: Chapter, b: Chapter) => {
      const numA = parseFloat(a.number) || 0;
      const numB = parseFloat(b.number) || 0;
      return sortAscending ? numA - numB : numB - numA;
    });
    setChapters(sortedChapters);
  };

  const handleChapterPress = (chapter: Chapter, index: number) => {
    console.log('[ChapterList] Chapter pressed:', {
      id: chapter.id,
      number: chapter.number,
      source: chapter.source,
      hasKatanaUrl: !!chapter.katanaUrl,
      isLatest: chapter.isLatest || index === 0,
      autoSelectSource: providerPreferences?.autoSelectSource,
      defaultProvider: providerPreferences?.defaultProvider,
      currentProvider: provider
    });
    
    // Handle Katana URLs correctly
    let url = chapter.url || chapter.id;
    
    // If this is a Katana chapter or we're converting to Katana
    if (chapter.source === 'katana' || chapter.katanaUrl) {
      // Use provided katanaUrl if available
      url = chapter.katanaUrl || url;
      
      // If the URL doesn't contain the full path (just the chapter ID)
      // We might need to construct it using the slugId format
      if (!url.includes('/') && internalMangaId) {
        // For katana provider, we need to construct the full path
        if (provider === 'katana') {
          // No need to split by katana- prefix anymore
          const katanaId = internalMangaId;
          url = `${katanaId}/${url}`;
          console.log('[ChapterList] Constructed full Katana URL path:', url);
        }
      }
    }
    
    // Determine which source to use
    let sourceToUse;
    if (providerPreferences?.autoSelectSource === true) {
      // When auto-select is ON, use the selected provider (which is based on chapter count)
      sourceToUse = provider || 'katana';
      console.log('[ChapterList] Auto-select is ON, using selected provider:', sourceToUse);
    } else {
      // When auto-select is OFF, use the current active provider 
      sourceToUse = provider || providerPreferences?.defaultProvider || 'mangadex';
      console.log('[ChapterList] Auto-select is OFF, using current provider:', sourceToUse);
    }

    const selectedChapter = {
      ...chapter,
      source: sourceToUse,
      id: url,
      url: url,
      isLatest: chapter.isLatest || index === 0 // Set isLatest if it's the first chapter in the list
    };
    
    console.log('[ChapterList] Passing chapter with source:', {
      id: selectedChapter.id,
      number: selectedChapter.number,
      source: selectedChapter.source,
      url: selectedChapter.url,
      isLatest: selectedChapter.isLatest
    });
    
    // Set the selected chapter first, then show the modal
    setSelectedChapter(selectedChapter);
    
    // Use setTimeout to ensure the state update happens before opening the modal
    setTimeout(() => {
      // Emit event after state is updated
      DeviceEventEmitter.emit('chapterSelected', selectedChapter);
      setShowChapterModal(true);
    }, 0);
  };

  // Add onCloseModal function
  const onCloseModal = () => {
    setShowChapterModal(false);
    setSelectedChapter(null);
  };

  // Update the renderChapterItem function to handle loading state
  const renderChapterItem = ({ item, index }: { item: Chapter, index: number }) => {
    // If the item is not fully loaded yet, show a loading placeholder
    if (!item || !item.number || !item.id) {
      return (
        <View style={styles.chapterItemContainer}>
          <View style={[styles.chapterCard, { opacity: 0.7 }]}>
            <View style={[styles.chapterThumbnail, { backgroundColor: '#1A1A1A' }]} />
            <View style={styles.chapterContent}>
              <View style={{ backgroundColor: '#1A1A1A', width: '60%', height: 20, borderRadius: 4 }} />
              <View style={styles.chapterMeta}>
                <View style={{ backgroundColor: '#1A1A1A', width: 80, height: 16, borderRadius: 4 }} />
              </View>
            </View>
            <View style={[styles.readButton, { opacity: 0.5 }]} />
          </View>
        </View>
      );
    }

    // Only proceed if we have valid data
    const releaseDate = parseChapterDate(item.updatedAt);
    const chapterNum = parseFloat(item.number);
    const isRead = !isNaN(chapterNum) && chapterNum <= readProgress;
    const isNewest = index === 0;
    const thumbnailUrl = chapterThumbnails[item.id] || coverImage || defaultThumbnail;

    return (
      <View style={styles.chapterItemContainer}>
        <View style={[
          styles.chapterCard,
          isRead && styles.readChapterCard,
          !isRead && styles.unreadChapterCard,
        ]}>
          <ExpoImage
            source={{ uri: thumbnailUrl }}
            style={styles.chapterThumbnail}
            contentFit="cover"
            onError={() => {
              if (chapterThumbnails[item.id] !== coverImage && coverImage) {
                setChapterThumbnails(prev => ({
                  ...prev,
                  [item.id]: coverImage
                }));
              }
            }}
          />

          <View style={styles.chapterContent}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 4, flex: 1 }}>
              {isNewest && (
                <MaterialIcons
                  name="star"
                  size={16}
                  color="#FFD700"
                  style={{ marginRight: 6, marginTop: 1 }}
                />
              )}
              {isRead && (
                <MaterialIcons
                  name="check-circle"
                  size={16}
                  color="#02A9FF"
                  style={{ marginRight: 6, marginTop: 1 }}
                />
              )}
              <View style={{ flex: 1 }}>
                <Text 
                  style={[styles.chapterHeader, isRead && styles.readText]}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  Chapter {item.number || 'Unknown'}
                </Text>
                {item.volume && item.volume.trim() && (
                  <Text 
                    style={[styles.chapterTitle, isRead && styles.readText]}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                  >
                    Volume {item.volume}
                  </Text>
                )}
              </View>
            </View>

            <View style={styles.chapterMeta}>
              {item.pages && item.pages > 0 && (
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <MaterialIcons
                    name="description"
                    size={12}
                    color={isRead ? '#02A9FF' : '#999999'}
                    style={{ marginRight: 4 }}
                  />
                  <Text style={[styles.metaText, isRead && styles.readMetaText]}>
                    {item.pages || 0}p
                  </Text>
                </View>
              )}
              {releaseDate && releaseDate !== 'Unknown' && (
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <MaterialIcons
                    name="calendar-today"
                    size={12}
                    color={isRead ? '#02A9FF' : '#999999'}
                    style={{ marginRight: 4 }}
                  />
                  <Text style={[styles.metaText, isRead && styles.readMetaText]} numberOfLines={1}>
                    {releaseDate}
                  </Text>
                </View>
              )}
              {isNewest && (
                <Text style={styles.newBadge}>NEW</Text>
              )}
            </View>
          </View>

          <TouchableOpacity
            style={[styles.readButton, isRead && styles.rereadButton]}
            onPress={() => handleChapterPress(item, index)}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <MaterialIcons
                name={isRead ? "menu-book" : "book"}
                size={14}
                color="#FFFFFF"
                style={{ marginRight: 4 }}
              />
              <Text style={styles.readButtonText}>
                {isRead ? 'Reread' : 'Read Now'}
              </Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // Add this new function to handle column/view toggle
  const handleColumnToggle = () => {
    setColumnCount(prev => (prev === 1 ? 2 : 1));
  };

  // Add this new function to handle notification toggle
  const handleNotificationToggle = async () => {
    setShowNotification(!showNotification);
    // Here you would implement actual notification logic similar to EpisodeList
  };

  // Add this new function to handle search toggle
  const handleSearchToggle = () => {
    setSearchVisible(!searchVisible);
  };

  // Add sort toggle handler for volume ranges
  const handleSortToggle = () => {
    setIsNewestFirst(prev => !prev);
  };

  // Add helper function for rendering volume range labels
  const renderVolumeRangeLabel = useCallback((range: Chapter[]) => {
    if (!range || range.length === 0) return `Range`;
    
    // Check if this range has volume information
    const hasVolumeInfo = range.some(chapter => chapter.volume && chapter.volume.trim() !== '');
    
    if (hasVolumeInfo) {
      // Get unique volumes in this range
      const volumes = [...new Set(range.map(ch => ch.volume).filter(vol => vol && vol.trim() !== ''))];
      volumes.sort((a, b) => {
        const numA = parseFloat(a!) || 0;
        const numB = parseFloat(b!) || 0;
        return isNewestFirst ? numB - numA : numA - numB;
      });
      
      if (volumes.length === 1) {
        return `Vol. ${volumes[0]}`;
      } else if (volumes.length > 1) {
        return `Vol. ${volumes[0]} - ${volumes[volumes.length - 1]}`;
      }
    }
    
    // Fallback to chapter range
    const first = range[0]?.number;
    const last = range[range.length - 1]?.number;
    
    if (first === last) return `Ch. ${first}`;
    return `Ch. ${first} - ${last}`;
  }, [isNewestFirst]);

  // Update the onViewableItemsChanged function to use the new thumbnail loading logic
  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: any[] }) => {
    if (viewableItems.length > 0) {
      // Find the largest index that's currently visible
      const visibleIndices = viewableItems.map(item => item.index);
      const maxVisibleIndex = Math.max(...visibleIndices);
      
      // Calculate which batch this would be in
      const batchForIndex = Math.floor(maxVisibleIndex / THUMBNAIL_BATCH_SIZE);
      
      // Only load if:
      // 1. We haven't processed this batch yet
      // 2. We're not currently loading
      // 3. The batch is within our total chapters range
      if (!processedBatches.includes(batchForIndex) && 
          !isLoadingMoreThumbnails && 
          batchForIndex * THUMBNAIL_BATCH_SIZE < chapters.length) {
        console.log(`[Thumbnails] Loading batch ${batchForIndex} for visible item at index ${maxVisibleIndex}`);
        // Generate thumbnails for the visible batch
        const startIndex = batchForIndex * THUMBNAIL_BATCH_SIZE;
        const endIndex = Math.min(startIndex + THUMBNAIL_BATCH_SIZE, chapters.length);
        const chaptersToProcess = chapters.slice(startIndex, endIndex);
        
        generateRandomPageThumbnails(chaptersToProcess, coverImage, 0, chaptersToProcess.length)
          .then(newThumbnails => {
            setChapterThumbnails(prev => ({
              ...prev,
              ...newThumbnails
            }));
            setProcessedBatches(prev => [...prev, batchForIndex]);
          })
          .catch(error => {
            console.error('[Thumbnails] Error loading batch:', error);
          });
      }
    }
  }).current;

  // Add new loading skeleton component
  const LoadingSkeletonCard = () => {
    return (
      <View style={styles.chapterItemContainer}>
        <View style={[
          styles.chapterCard,
          { backgroundColor: isDarkMode ? '#1A1A1A' : '#f5f5f5' }
        ]}>
          <View style={[
            styles.chapterThumbnail,
            { backgroundColor: isDarkMode ? '#252525' : '#e0e0e0' }
          ]} />
          <View style={styles.chapterContent}>
            <View>
              <View style={[
                styles.skeletonText,
                { backgroundColor: isDarkMode ? '#252525' : '#e0e0e0', width: '40%' }
              ]} />
              <View style={[
                styles.skeletonText,
                { backgroundColor: isDarkMode ? '#252525' : '#e0e0e0', width: '70%', marginTop: 8 }
              ]} />
            </View>
            <View style={styles.chapterMeta}>
              <View style={[
                styles.skeletonText,
                { backgroundColor: isDarkMode ? '#252525' : '#e0e0e0', width: '30%' }
              ]} />
            </View>
          </View>
          <View style={[
            styles.readButton,
            { backgroundColor: isDarkMode ? '#252525' : '#e0e0e0' }
          ]} />
        </View>
      </View>
    );
  };

  // First check if preferences are loaded
  if (!preferencesLoaded) {
    return (
      <View style={[styles.container, { backgroundColor: 'transparent' }]}>
        <LoadingView message="Loading preferences..." />
      </View>
    );
  }

  // Then check for main loading state
  if (isLoading) {
    const skeletonCount = 8; // Number of skeleton items to show
    return (
      <View style={[styles.container, { backgroundColor: 'transparent' }]}>
        <View style={styles.headerContainer}>
          <View style={styles.headerButtons}>
            {/* Keep the header buttons disabled during loading */}
            <View style={[styles.controlButton, { opacity: 0.5 }]}>
              <MaterialIcons name="sort" size={18} color="#666" />
            </View>
            <View style={[styles.controlButton, { opacity: 0.5 }]}>
              <MaterialIcons name="search" size={18} color="#666" />
            </View>
            <View style={[styles.controlButton, { opacity: 0.5 }]}>
              <MaterialIcons name="grid-view" size={18} color="#666" />
            </View>
          </View>
        </View>

        <FlashList
          data={Array(skeletonCount).fill(0)}
          renderItem={() => <LoadingSkeletonCard />}
          estimatedItemSize={110}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          numColumns={columnCount}
        />
      </View>
    );
  }

  // Main render
  return (
    <View style={[styles.container, { backgroundColor: 'transparent' }]}>
      <View style={styles.headerContainer}>
        <View style={styles.headerButtons}>
          <TouchableOpacity 
            style={[styles.controlButton, { backgroundColor: 'rgba(255, 255, 255, 0.1)' }]} 
            onPress={handleSortToggle}
          >
            <MaterialIcons 
              name={isNewestFirst ? "keyboard-arrow-down" : "keyboard-arrow-up"} 
              size={18} 
              color="#FFFFFF" 
            />
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.controlButton, { backgroundColor: 'rgba(255, 255, 255, 0.1)' }]} 
            onPress={handleSearchToggle}
          >
            <MaterialIcons name="search" size={18} color="#FFFFFF" />
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.controlButton, { backgroundColor: 'rgba(255, 255, 255, 0.1)' }]} 
            onPress={handleColumnToggle}
          >
            <MaterialIcons 
              name={columnCount === 1 ? "view-list" : "grid-view"} 
              size={18} 
              color="#FFFFFF" 
            />
          </TouchableOpacity>

          <TouchableOpacity 
            style={[
              styles.controlButton,
              { backgroundColor: 'rgba(255, 255, 255, 0.1)' },
              showNotification && styles.activeControlButton
            ]} 
            onPress={handleNotificationToggle}
          >
            <MaterialIcons 
              name={showNotification ? "notifications" : "notifications-off"} 
              size={18} 
              color={showNotification ? "#02A9FF" : "#FFFFFF"} 
            />
          </TouchableOpacity>
        </View>
      </View>

      {searchVisible && (
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search chapters..."
            placeholderTextColor="#999"
            value={''}
            onChangeText={() => {}}
          />
        </View>
      )}

      {volumeRanges && volumeRanges.length > 1 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.volumeRangeContainer}
        >
          {volumeRanges.map((range, index) => (
            <TouchableOpacity
              key={index}
              style={[
                styles.volumeRangeButton,
                activeVolumeTab === index && styles.activeVolumeRangeButton
              ]}
              onPress={() => setActiveVolumeTab(index)}
            >
              <Text style={styles.volumeRangeButtonText}>
                {range && range.length > 0 ? renderVolumeRangeLabel(range) : 'Range'}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {isLoading ? (
        <LoadingView message="Loading chapters..." />
      ) : error ? (
        <ErrorView message={error} onRetry={() => searchManga()} />
      ) : chapters.length === 0 ? (
        <EmptyView message="No chapters found. Try another source." />
      ) : (
        <FlashList
          data={
            volumeRanges && volumeRanges.length > 0 && volumeRanges[activeVolumeTab] 
              ? volumeRanges[activeVolumeTab].filter(Boolean) 
              : chapters && chapters.length > 0 
                ? chapters.filter(Boolean) 
                : []
          }
          renderItem={renderChapterItem}
          keyExtractor={item => item?.id || ''}
          estimatedItemSize={110}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          numColumns={columnCount}
          key={`chapter-list-${columnCount}-${activeVolumeTab}`}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={{
            itemVisiblePercentThreshold: 20,
            minimumViewTime: 300
          }}
          ListFooterComponent={isLoadingMore ? (
            <View style={styles.loadMoreContainer}>
              <ActivityIndicator size="small" color="#02A9FF" />
              <Text style={[styles.loadMoreText, { color: currentTheme.colors.textSecondary }]}>
                Loading more chapters...
              </Text>
            </View>
          ) : null}
        />
      )}

      {showChapterModal && selectedChapter && (
        <ChapterSourcesModal
          visible={showChapterModal}
          onClose={onCloseModal}
          chapter={selectedChapter}
          mangaTitle={mangaTitle}
          mangaId={internalMangaId || ''}
          countryOfOrigin={countryOfOrigin}
          anilistId={anilistId || ''}
        />
      )}
    </View>
  );
}