import React, { useState, useEffect, useCallback, useMemo, useRef, memo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList, ActivityIndicator, ScrollView, Platform, StatusBar, Dimensions, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { FontAwesome5 } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import EpisodeSourcesModal from '../app/components/EpisodeSourcesModal';
import { requestNotificationPermissions, toggleNotifications, isNotificationEnabled } from '../utils/notifications';
import { BlurView } from 'expo-blur';
import axios from 'axios';
import { JIKAN_API_ENDPOINT } from '../app/constants/api';
import { STORAGE_KEY } from '../constants/auth';
import * as SecureStore from 'expo-secure-store';
import { FlashList } from '@shopify/flash-list';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Animated, { FadeIn, FadeOut, Layout } from 'react-native-reanimated';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { createSelector } from 'reselect';
// Import our episode optimization utilities
import {
  CACHE_EXPIRY_TIME,
  MAX_INITIAL_EPISODES,
  delay,
  rateLimitedFetch,
  compactEpisodeData,
  saveEpisodesToCache,
  loadEpisodesFromCache,
  createEpisodeRanges,
  formatRangeLabel
} from '../utils/episodeOptimization';

// Fixed API endpoint constants
const ANILIST_GRAPHQL_ENDPOINT = 'https://graphql.anilist.co';
const MAL_API_ENDPOINT = 'https://api.myanimelist.net/v2';
const CONSUMET_API_URL = 'https://takiapi.xyz';
const CONSUMET_API_BASE = `${CONSUMET_API_URL}/anime/zoro`;

const PLACEHOLDER_BLUR_HASH = 'L6PZfSi_.AyE_3t7t7R**0o#DgR4';

interface JikanEpisode {
  mal_id: number;
  title: string;
  episode: string;
  synopsis?: string;
  aired?: string;
  filler?: boolean;
  recap?: boolean;
  duration?: number;
}

interface EpisodeListProps {
  episodes: Episode[];
  loading: boolean;
  animeTitle: string;
  anilistId?: string;
  malId?: string;
  coverImage?: string;
  renderControlsInParent?: boolean;
  mangaTitle?: string;
}

interface Episode {
  id: string;
  number: number;
  title?: string;
  image?: string;
  progress?: number;
  isFiller?: boolean;
  isRecap?: boolean;
  aired?: string;
  anilistId?: string;
  description?: string;
  duration?: number;
  provider?: string;
}

interface AiringSchedule {
  nextEpisode?: number;
  nextAiringAt?: number;
  timeUntilAiring?: number;
  lastEpisode?: number;
  lastAiredAt?: number;
  status?: string;
}

interface LoadingState {
  currentPage: number;
  totalPages: number;
  type: string;
  message: string;
}

interface JikanVideo {
  mal_id: number;
  title: string;
  episode: string;
  url: string;
  images: {
    jpg: {
      image_url: string;
    };
  };
}

interface Subtitle {
  url: string;
  lang: string;
}

interface VideoTimings {
  intro?: {
    start: number;
    end: number;
  };
  outro?: {
    start: number;
    end: number;
  };
}

interface TrackingProgress {
  anilist?: number;
  mal?: number;
}

// Add a new interface for Consumet episode data
interface ConsumetEpisode {
  id: string;
  number: number;
  title?: string;
  description?: string;
  image?: string;
  aired?: string;
}

// Define NotificationItem interface locally to match what's in utils/notifications.ts
interface NotificationItem {
  id: string;
  type: 'anime' | 'manga';
  title: string;
  lastKnownNumber: number;
  anilistId?: string;
  malId?: string;
  manganatoId?: string;
}

// Add interface for HiAnime/Zoro episode data
interface ZoroEpisode {
  id: string;
  number: number;
  url?: string;
  title?: string;
}

interface ZoroAnimeInfo {
  id: string;
  title: string;
  url?: string;
  image?: string;
  totalEpisodes?: number;
  episodes: ZoroEpisode[];
  // Add other fields as needed
}

// Create a separate GridEpisodeCard component for grid layouts
const GridEpisodeCard = ({ episode, onPress, currentProgress, currentTheme, isDarkMode, coverImage }: {
  episode: Episode;
  onPress: (episode: Episode) => void;
  currentProgress: number;
  currentTheme: any;
  isDarkMode: boolean;
  coverImage?: string;
}) => {
  const isWatched = currentProgress >= episode.number;
  
  return (
    <TouchableOpacity
      style={[
        styles.gridEpisodeCard,
        { backgroundColor: isDarkMode ? 'rgba(28, 28, 30, 0.9)' : 'rgba(255, 255, 255, 0.9)' },
        isWatched && styles.watchedGridCard
      ]}
      onPress={() => onPress(episode)}
      activeOpacity={0.7}
    >
      <View style={styles.gridThumbnailContainer}>
        <Image
          source={{ uri: episode.image || coverImage || '' }}
          placeholder={PLACEHOLDER_BLUR_HASH}
          style={[
            styles.gridEpisodeThumbnail,
            isWatched && styles.watchedGridThumbnail
          ]}
          contentFit="cover"
          transition={200}
        />
        {isWatched && (
          <View style={styles.gridWatchedBadge}>
            <FontAwesome5 name="check" size={8} color="#FFFFFF" />
          </View>
        )}
        <View style={styles.gridEpisodeNumberBadge}>
          <Text style={styles.gridEpisodeNumberText}>
            {episode.number}
          </Text>
        </View>
      </View>
      
      <View style={styles.gridEpisodeContent}>
        <Text style={[styles.gridEpisodeTitle, { color: currentTheme.colors.text }]} numberOfLines={2}>
          {episode.title || `Episode ${episode.number}`}
        </Text>
        
        {episode.aired && (
          <Text style={[styles.gridEpisodeMeta, { color: currentTheme.colors.textSecondary }]} numberOfLines={1}>
            {new Date(episode.aired).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric'
            })}
          </Text>
        )}
        
        <TouchableOpacity 
          style={[
            styles.gridWatchButton,
            isWatched && styles.gridRewatchButton
          ]}
          onPress={() => onPress(episode)}
        >
          <FontAwesome5 
            name={isWatched ? "redo" : "play"} 
            size={10} 
            color="#FFFFFF" 
          />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
};

const MemoizedGridEpisodeCard = memo(GridEpisodeCard);

// Create a ListEpisodeCard component for single-column list view
const ListEpisodeCard = ({ episode, onPress, currentProgress, currentTheme, isDarkMode, coverImage }: {
  episode: Episode;
  onPress: (episode: Episode) => void;
  currentProgress: number;
  currentTheme: any;
  isDarkMode: boolean;
  coverImage?: string;
}) => {
  const isWatched = currentProgress >= episode.number;
  const progressPercentage = isWatched ? 100 : 0; // Future: could store partial progress
  
  // Format the aired date nicely
  const formatDate = (dateString?: string) => {
    if (!dateString) return null;
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };
  
  return (
    <TouchableOpacity
      style={[
        styles.listEpisodeCard,
        { backgroundColor: isDarkMode ? 'rgba(28, 28, 30, 0.95)' : 'rgba(255, 255, 255, 0.95)' },
        isWatched && styles.watchedListCard
      ]}
      onPress={() => onPress(episode)}
      activeOpacity={0.7}
    >
      {/* Episode thumbnail */}
      <View style={styles.listThumbnailContainer}>
        <Image
          source={{ uri: episode.image || coverImage || '' }}
          placeholder={PLACEHOLDER_BLUR_HASH}
          style={[
            styles.listEpisodeThumbnail,
            isWatched && styles.watchedListThumbnail
          ]}
          contentFit="cover"
          transition={200}
        />
        {isWatched && (
          <View style={styles.listWatchedBadge}>
            <FontAwesome5 name="check" size={12} color="#FFFFFF" />
          </View>
        )}
        <View style={styles.listEpisodeNumberBadge}>
          <Text style={styles.listEpisodeNumberText}>
            {episode.number}
          </Text>
        </View>
      </View>
      
      {/* Episode content */}
      <View style={styles.listEpisodeContent}>
        <View style={styles.listEpisodeHeader}>
          <View style={styles.listEpisodeTitleContainer}>
            <Text style={[styles.listEpisodeTitle, { color: currentTheme.colors.text }]} numberOfLines={2}>
              {episode.title || `Episode ${episode.number}`}
            </Text>
            {episode.provider && (
              <Text style={[styles.listEpisodeProvider, { color: currentTheme.colors.textSecondary }]}>
                {episode.provider}
              </Text>
            )}
          </View>
          
          {/* Episode metadata */}
          <View style={styles.listEpisodeMetaContainer}>
            {episode.aired && (
              <View style={styles.listMetaItem}>
                <FontAwesome5 name="calendar-alt" size={12} color={currentTheme.colors.textSecondary} />
                <Text style={[styles.listMetaText, { color: currentTheme.colors.textSecondary }]}>
                  {formatDate(episode.aired)}
                </Text>
              </View>
            )}
            
            {episode.duration && (
              <View style={styles.listMetaItem}>
                <FontAwesome5 name="clock" size={12} color={currentTheme.colors.textSecondary} />
                <Text style={[styles.listMetaText, { color: currentTheme.colors.textSecondary }]}>
                  {episode.duration}m
                </Text>
              </View>
            )}
            
            {(episode.isFiller || episode.isRecap) && (
              <View style={[
                styles.listEpisodeTypeBadge,
                { backgroundColor: episode.isFiller ? '#F44336' : '#2196F3' }
              ]}>
                <Text style={styles.listEpisodeTypeText}>
                  {episode.isFiller ? 'Filler' : 'Recap'}
                </Text>
              </View>
            )}
          </View>
        </View>
        
        {/* Progress bar and watch button */}
        <View style={styles.listEpisodeFooter}>
          <View style={styles.listProgressContainer}>
            <View style={[styles.listProgressBar, { backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' }]}>
              <View 
                style={[
                  styles.listProgressFill, 
                  { width: `${progressPercentage}%` }
                ]} 
              />
            </View>
            <Text style={[styles.listProgressText, { color: currentTheme.colors.textSecondary }]}>
              {isWatched ? 'Watched' : 'Not watched'}
            </Text>
          </View>
          
          <TouchableOpacity 
            style={[
              styles.listWatchButton,
              isWatched && styles.listRewatchButton
            ]}
            onPress={() => onPress(episode)}
          >
            <FontAwesome5 
              name={isWatched ? "redo" : "play"} 
              size={14} 
              color="#FFFFFF" 
              style={{ marginRight: 6 }}
            />
            <Text style={styles.listWatchButtonText}>
              {isWatched ? "Rewatch" : "Watch"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const MemoizedListEpisodeCard = memo(ListEpisodeCard);

const ITEMS_PER_PAGE = 12; // 2x6 grid
const NUM_COLUMNS = 2;

// Add these utility functions at the top with other imports
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const fetchWithRetry = async (url: string, options: any = {}, maxRetries = 3) => {
  let retryCount = 0;
  let lastError = null;

  while (retryCount < maxRetries) {
    try {
      const response = await axios.get(url, options);
      return response;
    } catch (error: any) {
      lastError = error;
      
      // Check if it's a rate limit error (429)
      if (error?.response?.status === 429) {
        // Calculate delay with exponential backoff (1s, 2s, 4s, etc)
        const delay = Math.pow(2, retryCount) * 1000;
        console.log(`Rate limited. Retrying in ${delay}ms... (Attempt ${retryCount + 1}/${maxRetries})`);
        await wait(delay);
        retryCount++;
      } else {
        // For other errors, throw immediately
        throw error;
      }
    }
  }
  
  // If we've exhausted all retries, throw the last error
  throw lastError;
};

export default function EpisodeList({ episodes: initialEpisodes, loading: initialLoading, animeTitle, anilistId, malId, coverImage, renderControlsInParent = false, mangaTitle }: EpisodeListProps) {
  const { isDarkMode, currentTheme } = useTheme();
  const router = useRouter();
  
  const [episodes, setEpisodes] = useState<Episode[]>(initialEpisodes || []);
  const [loading, setLoading] = useState<boolean>(initialLoading);
  const [error, setError] = useState<string | null>(null);
  const [selectedEpisodeId, setSelectedEpisodeId] = useState<string>('');
  const [selectedEpisode, setSelectedEpisode] = useState<Episode | null>(null);
  const [sourceModalVisible, setSourceModalVisible] = useState<boolean>(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [trackingProgress, setTrackingProgress] = useState<TrackingProgress>({});
  const [currentProgress, setCurrentProgress] = useState(0);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [airingSchedule, setAiringSchedule] = useState<AiringSchedule | null>(null);
  const [timeUntilAiring, setTimeUntilAiring] = useState<string>('');
  const [currentEpisodes, setCurrentEpisodes] = useState<Episode[]>(initialEpisodes);
  const [isLoading, setIsLoading] = useState(initialLoading);
  const [loadingState, setLoadingState] = useState<LoadingState | null>(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [columnCount, setColumnCount] = useState<number>(1);
  const [visibleEpisodes, setVisibleEpisodes] = useState<string[]>([]);
  const [isLoadingBatch, setIsLoadingBatch] = useState(false);
  const [isNewestFirst, setIsNewestFirst] = useState(true);
  const [latestEpisodeInfo, setLatestEpisodeInfo] = useState<{
    number: number;
    date: string;
    source: string;
  } | null>(null);
  
  // Source settings state
  const [sourceSettings, setSourceSettings] = useState({
    preferredType: 'auto' as 'auto' | 'sub' | 'dub',
    autoTryAlternateVersion: true,
  });

  // Cache and pagination states
  const [loadingCache, setLoadingCache] = useState<boolean>(true);
  const [loadedFromCache, setLoadedFromCache] = useState<boolean>(false);
  const [isBackgroundRefreshing, setIsBackgroundRefreshing] = useState<boolean>(false);
  const [hasMoreEpisodes, setHasMoreEpisodes] = useState<boolean>(true);
  const [visibleEpisodeCount, setVisibleEpisodeCount] = useState<number>(MAX_INITIAL_EPISODES);
  // Add episodeRanges state
  const [episodeRanges, setEpisodeRanges] = useState<Episode[][]>([]);
  // Add state to track when episodes are fetched from HiAnime
  const [hiAnimeEpisodesLoaded, setHiAnimeEpisodesLoaded] = useState<boolean>(false);

  // Add a reference to the FlashList with proper typing
  const flashListRef = useRef<FlashList<Episode>>(null);

  // Add state for user's watch progress
  const [userProgress, setUserProgress] = useState<{
    watchedEpisodes: number;
    lastWatchedDate?: string;
  } | null>(null);

  // Add function to fetch user's watch progress from AniList
  const fetchUserProgress = useCallback(async () => {
    if (!anilistId) return;
    
    try {
      const token = await SecureStore.getItemAsync(STORAGE_KEY.AUTH_TOKEN);
      if (!token) return;
      
      const query = `
        query ($mediaId: Int) {
          Media(id: $mediaId, type: ANIME) {
            mediaListEntry {
              progress
              updatedAt
              status
            }
          }
        }
      `;
      
      const response = await axios.post(
        ANILIST_GRAPHQL_ENDPOINT,
        {
          query,
          variables: {
            mediaId: parseInt(anilistId)
          }
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          }
        }
      );
      
      if (response.data?.data?.Media?.mediaListEntry) {
        const entry = response.data.data.Media.mediaListEntry;
        setUserProgress({
          watchedEpisodes: entry.progress || 0,
          lastWatchedDate: entry.updatedAt ? new Date(entry.updatedAt * 1000).toISOString() : undefined
        });
        setCurrentProgress(entry.progress || 0);
        console.log(`User progress: ${entry.progress} episodes watched`);
      }
    } catch (error) {
      console.error('Error fetching user progress:', error);
    }
  }, [anilistId]);

  // Fetch user progress when component mounts
  useEffect(() => {
    fetchUserProgress();
  }, [fetchUserProgress]);

  // Add function to merge episodes from Jikan and Zoro
  const mergeEpisodes = useCallback((jikanEpisodes: Episode[], zoroEpisodes: any[]): Episode[] => {
    // Create a map of all Jikan episodes by episode number
    const episodeMap = new Map<number, Episode>();
    jikanEpisodes.forEach(episode => {
      episodeMap.set(episode.number, episode);
    });
    
    // Find the highest episode number in Jikan episodes
    let highestJikanEpisode = 0;
    jikanEpisodes.forEach(episode => {
      if (episode.number > highestJikanEpisode) {
        highestJikanEpisode = episode.number;
      }
    });
    
    console.log(`Merging episodes - Jikan has ${jikanEpisodes.length} episodes, highest: ${highestJikanEpisode}`);
    console.log(`Zoro has ${zoroEpisodes.length} episodes`);
    
    // Process Zoro episodes, adding any that don't exist in Jikan
    zoroEpisodes.forEach((zoroEp: any) => {
      // Skip if episode number is invalid
      if (!zoroEp.number || isNaN(zoroEp.number)) return;
      
      // If this episode doesn't exist in the map or it's newer than what Jikan has
      if (!episodeMap.has(zoroEp.number) || zoroEp.number > highestJikanEpisode) {
        const newEpisode: Episode = {
          id: zoroEp.id || `zoro-${zoroEp.number}`,
          number: zoroEp.number,
          title: zoroEp.title || `Episode ${zoroEp.number}`, // Zoro sometimes provides titles
          image: coverImage, // Use anime cover image
          provider: 'Zoro'
        };
        
        console.log(`Adding episode ${zoroEp.number} from Zoro (newer than Jikan data)`);
        episodeMap.set(zoroEp.number, newEpisode);
      }
    });
    
    // Convert the map back to an array and sort by episode number
    const mergedEpisodes = Array.from(episodeMap.values()).sort((a, b) => a.number - b.number);
    
    console.log(`Merged episode list contains ${mergedEpisodes.length} episodes`);
    
    // Update the latest episode info with more accurate data
    if (mergedEpisodes.length > 0) {
      // Find the actual latest episode (highest episode number)
      const latestEp = mergedEpisodes.reduce((latest, current) => 
        current.number > latest.number ? current : latest, mergedEpisodes[0]);
      
      // Get the most recent aired episode (prefer episodes with aired dates)
      const airedEpisodes = mergedEpisodes.filter(ep => ep.aired);
      let mostRecentAired = latestEp;
      
      if (airedEpisodes.length > 0) {
        mostRecentAired = airedEpisodes.reduce((latest, current) => {
          if (!latest.aired || !current.aired) return latest;
          return new Date(current.aired) > new Date(latest.aired) ? current : latest;
        }, airedEpisodes[0]);
      }
      
      // Prioritize episodes from HiAnime/Zoro as they tend to be more up-to-date
      const hiAnimeEpisodes = mergedEpisodes.filter(ep => ep.provider === 'Zoro' || ep.provider === 'HiAnime');
      let newestUploadedEpisode = latestEp;
      
      if (hiAnimeEpisodes.length > 0) {
        // Get the highest numbered episode from HiAnime/Zoro
        newestUploadedEpisode = hiAnimeEpisodes.reduce((latest, current) => 
          current.number > latest.number ? current : latest, hiAnimeEpisodes[0]);
      }
      
      // Use the newest uploaded episode if it's higher than the most recent aired
      const episodeToShow = newestUploadedEpisode.number >= (mostRecentAired?.number || 0) ? 
        newestUploadedEpisode : mostRecentAired;
      
      setLatestEpisodeInfo({
        number: episodeToShow.number,
        date: episodeToShow.aired || new Date().toISOString(),
        source: episodeToShow.provider || 'Jikan'
      });
      
      console.log(`Latest uploaded episode: Episode ${episodeToShow.number} from ${episodeToShow.provider || 'Jikan'}`);
    }
    
    return mergedEpisodes;
  }, [coverImage]);

  // Add function to fetch episodes from HiAnime
  const fetchHiAnimeEpisodes = useCallback(async (): Promise<void> => {
    // Use manga title if available, otherwise fall back to anime title
    const searchTitle = mangaTitle || animeTitle;
    if (!searchTitle) return;
    
    try {
      console.log(`Fetching episodes from HiAnime (Zoro) for: ${searchTitle}${mangaTitle ? ' (using manga title)' : ' (using anime title)'}`);
      setIsBackgroundRefreshing(true);
      setLoadingState({
        currentPage: 0,
        totalPages: 1,
        type: 'loading',
        message: 'Fetching episodes...'
      });
      
      // Create a URL-safe version of the title for the API request
      const encodedTitle = encodeURIComponent(searchTitle);
      
      // First, search for the anime with retry mechanism
      const searchUrl = `${CONSUMET_API_BASE}/${encodedTitle}?type=1`;
      
      const response = await fetchWithRetry(searchUrl);
      const results = response.data.results || [];
      
      if (!results.length) {
        console.log(`No results found on HiAnime (Zoro) for ${searchTitle}`);
        return;
      }
      
      // Improve the matching algorithm for better results:
      // 1. First try exact title match (case insensitive)
      // 2. Then try exact match without special characters
      // 3. Then try contains match
      // 4. Finally fallback to first result
      
      const normalizedSearchTitle = searchTitle.toLowerCase().trim();
      
      // Try exact match first (case insensitive)
      let matchedAnime = results.find((anime: any) => 
        anime.title.toLowerCase().trim() === normalizedSearchTitle
      );
      
      // For popular anime like "ONE PIECE", prioritize exact matching
      if (!matchedAnime && (searchTitle === "ONE PIECE" || searchTitle === "One Piece")) {
        matchedAnime = results.find((anime: any) => 
          anime.title === "One Piece" || 
          anime.title === "ONE PIECE"
        );
      }
      
      // If no exact match, try normalized comparison (remove spaces and special chars)
      if (!matchedAnime) {
        const simplifiedSearchTitle = normalizedSearchTitle.replace(/[^a-z0-9]/gi, '');
        matchedAnime = results.find((anime: any) => 
          anime.title.toLowerCase().replace(/[^a-z0-9]/gi, '') === simplifiedSearchTitle
        );
      }
      
      // If still no match, try contains (for titles that might have season info)
      if (!matchedAnime) {
        matchedAnime = results.find((anime: any) => 
          anime.title.toLowerCase().includes(normalizedSearchTitle) ||
          normalizedSearchTitle.includes(anime.title.toLowerCase())
        );
      }
      
      // Last resort: use first TV series, or first result
      if (!matchedAnime) {
        matchedAnime = results.find((anime: any) => anime.type === "TV") || results[0];
      }
      
      if (!matchedAnime) {
        console.log(`Could not find a match for ${searchTitle} in Zoro results`);
        return;
      }
      
      console.log(`Found anime on HiAnime (Zoro): ${matchedAnime.title}`);
      
      // Now get the detailed info with episodes
      const infoUrl = `${CONSUMET_API_BASE}/info?id=${matchedAnime.id}`;
      const infoResponse = await axios.get(infoUrl);
      
      if (!infoResponse.data || !infoResponse.data.episodes) {
        console.log(`No episode data returned from HiAnime (Zoro) for ${matchedAnime.title}`);
        return;
      }
      
      const animeInfo = infoResponse.data;
      console.log(`HiAnime (Zoro) reports ${animeInfo.episodes.length} episodes for ${matchedAnime.title}`);
      
      // Update merged episodes if we have both Jikan and HiAnime data
      if (animeInfo.episodes && animeInfo.episodes.length > 0) {
        if (currentEpisodes && currentEpisodes.length > 0) {
          // Merge with current episodes (from Jikan)
          const newMergedEpisodes = mergeEpisodes(currentEpisodes, animeInfo.episodes);
          setCurrentEpisodes(newMergedEpisodes);
          setEpisodes(newMergedEpisodes);
          
          // Save the merged episodes to cache
          await saveEpisodesToCache(newMergedEpisodes, anilistId, malId, animeTitle);
        } else {
          // No Jikan episodes yet, just use HiAnime episodes
          const hiAnimeConverted: Episode[] = animeInfo.episodes.map((ep: any) => ({
            id: ep.id || `hianime-${ep.number}`,
            number: ep.number,
            title: ep.title || `Episode ${ep.number}`,
            image: coverImage,
            provider: 'HiAnime'
          }));
          
          setCurrentEpisodes(hiAnimeConverted);
          setEpisodes(hiAnimeConverted);
          
          // Save the HiAnime episodes to cache
          await saveEpisodesToCache(hiAnimeConverted, anilistId, malId, animeTitle);
        }
        
        setHiAnimeEpisodesLoaded(true);
      }
    } catch (error) {
      console.error('Error fetching HiAnime episodes:', error);
      setLoadingState({
        currentPage: 0,
        totalPages: 1,
        type: 'error',
        message: 'Temporarily rate limited. Retrying automatically...'
      });
      
      // Retry the entire fetch after a delay
      setTimeout(() => {
        fetchHiAnimeEpisodes();
      }, 3000);
    } finally {
      setIsBackgroundRefreshing(false);
    }
  }, [mangaTitle, animeTitle, anilistId, malId, currentEpisodes, coverImage, mergeEpisodes, saveEpisodesToCache]);

  // Add effect to fetch HiAnime episodes after initial load
  useEffect(() => {
    if (initialEpisodes && initialEpisodes.length > 0 && !hiAnimeEpisodesLoaded) {
      fetchHiAnimeEpisodes();
    }
  }, [initialEpisodes, hiAnimeEpisodesLoaded, fetchHiAnimeEpisodes]);

  // Add a function to scroll to top
  const scrollToTop = useCallback(() => {
    if (flashListRef.current) {
      flashListRef.current.scrollToOffset({ offset: 0, animated: true });
    }
  }, []);

  // Add column toggle function
  const handleColumnToggle = useCallback(() => {
    setColumnCount(prev => {
      // Cycle between 1, 2, and 3 columns
      const newCount = prev >= 3 ? 1 : prev + 1;
      
      // Save preference to AsyncStorage
      AsyncStorage.setItem('episodeColumnCount', newCount.toString()).catch(err => {
        console.error('Failed to save column count preference:', err);
      });
      
      return newCount;
    });
  }, []);
  
  // Add notification toggle function
  const handleNotificationToggle = useCallback(() => {
    if (!anilistId) return;
    
    // Request permissions if needed
    requestNotificationPermissions().then(async hasPermission => {
      if (hasPermission) {
        // Create a proper NotificationItem object
        const notificationItem: NotificationItem = {
          id: anilistId,
          title: animeTitle,
          type: 'anime',
          lastKnownNumber: currentEpisodes.length > 0 ? 
            Math.max(...currentEpisodes.map(ep => ep.number)) : 0,
          anilistId: anilistId
        };
        
        // Pass the notification item object
        const isEnabled = await toggleNotifications(notificationItem);
        setNotificationsEnabled(isEnabled);
        
        // Show feedback
        console.log(`${isEnabled ? 'Enabled' : 'Disabled'} notifications for ${animeTitle}`);
      } else {
        console.log('Notification permission denied');
      }
    });
  }, [anilistId, animeTitle, currentEpisodes]);

  // Add sort toggle handler
  const handleSortToggle = useCallback(() => {
    setIsNewestFirst(prev => !prev);
  }, []);

  // Add helper function for rendering tab labels
  const renderTabLabel = useCallback((index: number, range: Episode[]) => {
    if (!range || range.length === 0) return `Range ${index + 1}`;
    
    const first = range[0]?.number;
    const last = range[range.length - 1]?.number;
    
    if (first === last) return `Episode ${first}`;
    return `${first} - ${last}`;
  }, []);

  // Effect to create episode ranges when episodes change
  useEffect(() => {
    if (currentEpisodes && currentEpisodes.length > 0) {
      // Sort episodes based on the current sort order
      const sortedEpisodes = [...currentEpisodes].sort((a, b) => 
        isNewestFirst ? b.number - a.number : a.number - b.number
      );
      
      // Split into ranges of 24 episodes each
      const ranges: Episode[][] = [];
      const rangeSize = 24;
      
      for (let i = 0; i < sortedEpisodes.length; i += rangeSize) {
        ranges.push(sortedEpisodes.slice(i, i + rangeSize));
      }
      
      setEpisodeRanges(ranges);
    } else {
      setEpisodeRanges([]);
    }
  }, [currentEpisodes, isNewestFirst]);

  // Forward declaration for preloadNextEpisodes
  const preloadNextEpisodes = useCallback(async (currentEpisodeNumber: string, animeId: string) => {
    try {
      const currentEpNum = parseInt(currentEpisodeNumber, 10);
      if (isNaN(currentEpNum)) return;
      
      // Find the next episodes in the list
      const nextEpisodes = currentEpisodes
        .filter(ep => ep.number > currentEpNum)
        .sort((a, b) => a.number - b.number)
        .slice(0, 3); // Preload next 3 episodes
      
      if (nextEpisodes.length === 0) return;
      
      console.log(`Preloading ${nextEpisodes.length} upcoming episodes in background`);
      
      // Store the list of preloaded episodes for quick access
      const preloadList = nextEpisodes.map(ep => `${animeId}?ep=${ep.number}`);
      await AsyncStorage.setItem('preloaded_episodes', JSON.stringify(preloadList));
      
      // Store compressed episode metadata to save space
      const compressedMetadata = nextEpisodes.map(ep => ({
        id: ep.id,
        number: ep.number,
        title: ep.title || `Episode ${ep.number}`,
        image: ep.image || coverImage
      }));
      
      // For each next episode, store its base info so we can quickly fetch sources later
      for (let i = 0; i < nextEpisodes.length; i++) {
        const episode = nextEpisodes[i];
        const preloadKey = `preload_${animeId}_${episode.number}`;
        const preloadData = {
          episodeId: `${animeId}?ep=${episode.number}`,
          episodeNumber: episode.number.toString(),
          animeId,
          animeTitle,
          metadata: compressedMetadata[i],
          timestamp: Date.now()
        };
        
        await AsyncStorage.setItem(preloadKey, JSON.stringify(preloadData));
        console.log(`Preloaded metadata for episode ${episode.number}`);
      }
    } catch (error) {
      console.error('Error preloading episodes:', error);
    }
  }, [currentEpisodes, coverImage, animeTitle]);

  // Helper functions for syncing progress
  const syncToAniList = async (token: string, episodeNumber: number) => {
    const mediaId = anilistId;
    if (!mediaId) {
      console.log('No AniList ID available for syncing');
      return;
    }

    const mutation = `
      mutation ($mediaId: Int, $progress: Int) {
        SaveMediaListEntry (mediaId: $mediaId, progress: $progress) {
          id
          progress
        }
      }
    `;

    await axios.post(
      ANILIST_GRAPHQL_ENDPOINT,
      {
        query: mutation,
        variables: {
          mediaId: parseInt(mediaId),
          progress: episodeNumber
        }
      },
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        }
      }
    );
  };

  const syncToMAL = async (token: string, episodeNumber: number) => {
    if (!malId) return;
    
    await axios.patch(
      `${MAL_API_ENDPOINT}/anime/${malId}/my_list_status`,
      {
        num_watched_episodes: episodeNumber,
        status: 'watching'
      },
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );
  };

  // Forward declaration for syncProgress
  const syncProgress = useCallback(async (episodeNumber: number) => {
    try {
      // Sync to AniList
      const anilistToken = await SecureStore.getItemAsync(STORAGE_KEY.AUTH_TOKEN);
      if (anilistToken) {
        await syncToAniList(anilistToken, episodeNumber);
      }

      // Sync to MAL
      const malToken = await SecureStore.getItemAsync(STORAGE_KEY.MAL_TOKEN);
      if (malToken) {
        await syncToMAL(malToken, episodeNumber);
      }

      // Update local progress state
      setCurrentProgress(episodeNumber);
      
      // Update user progress state to reflect the new progress immediately
      setUserProgress(prev => ({
        watchedEpisodes: episodeNumber,
        lastWatchedDate: new Date().toISOString()
      }));
      
      console.log(`Progress synced: Episode ${episodeNumber}`);
    } catch (error) {
      console.error('Error syncing progress:', error);
    }
  }, []);

  // Source selection handler
  const handleSourceSelect = useCallback((sourceUrl: string, headers: any, episodeId: string, episodeNumber: string, subtitles?: any[], timings?: any, anilistId?: string, dataKey?: string) => {
    if (!selectedEpisode) return;
    
    // Log the parameters we're receiving for debugging
    console.log('[EpisodeList] handleSourceSelect called with:');
    console.log('- sourceUrl:', sourceUrl.substring(0, 30) + '...');
    console.log('- headers:', Object.keys(headers).join(', '));
    console.log('- episodeId:', episodeId);
    console.log('- episodeNumber:', episodeNumber);
    console.log('- dataKey:', dataKey);
    
    // Construct the URL parameters to send to the player
    router.push({
      pathname: '/player',
      params: {
        source: sourceUrl,
        episode: episodeId,
        title: animeTitle,
        episodeNumber: selectedEpisode.number.toString(),
        anilistId: anilistId || '',
        dataKey: dataKey || '' // Use the proper dataKey from EpisodeSourcesModal
      }
    });
    
    // Reset modal state
    setModalVisible(false);
    setSelectedEpisodeId('');
    setSelectedEpisode(null);
    
    // Update progress (increment by one)
    if (currentProgress < selectedEpisode.number) {
      syncProgress(selectedEpisode.number);
    }
    
    // Preload next episodes in background
    preloadNextEpisodes(selectedEpisode.number.toString(), anilistId || '');
  }, [selectedEpisode, router, animeTitle, anilistId, currentProgress, syncProgress, preloadNextEpisodes]);

  // Create a memoized sort function instead of using createSelector
  const getSortedEpisodes = useMemo(() => {
    return (episodes: Episode[]) => {
      return [...episodes].sort((a, b) => 
        isNewestFirst ? b.number - a.number : a.number - b.number
      );
    };
  }, [isNewestFirst]);
  
  // Use the memoized sort function to compute displayedEpisodes
  const displayedEpisodes = useMemo(() => {
    const sortedEpisodes = getSortedEpisodes(currentEpisodes);
    return sortedEpisodes.slice(0, visibleEpisodeCount);
  }, [currentEpisodes, getSortedEpisodes, visibleEpisodeCount]);

  // Track visible episodes for optimizing loading
  const viewabilityConfig = useMemo(() => ({
    itemVisiblePercentThreshold: 50
  }), []);

  const onViewableItemsChanged = useCallback(({ viewableItems }: { 
    viewableItems: Array<{
      item: Episode;
      key: string;
      index: number | null;
      isViewable: boolean;
      section?: any;
    }>;
  }) => {
    const newVisibleEpisodes = viewableItems.map(({ item }) => item.id);
    setVisibleEpisodes(newVisibleEpisodes);
  }, []);

  // Handle loading more episodes when needed
  const loadMoreEpisodes = useCallback(() => {
    if (!hasMoreEpisodes || isLoadingBatch) return;
    
    setIsLoadingBatch(true);
    
    const increment = Math.min(MAX_INITIAL_EPISODES, 20);
    const newCount = Math.min(visibleEpisodeCount + increment, currentEpisodes.length);
    
    console.log(`Loading more episodes: ${visibleEpisodeCount} → ${newCount} of ${currentEpisodes.length}`);
    
    setVisibleEpisodeCount(newCount);
    
    // Update hasMoreEpisodes flag
    if (newCount >= currentEpisodes.length) {
      setHasMoreEpisodes(false);
      console.log('Reached the end of available episodes');
    }
    
    setIsLoadingBatch(false);
  }, [hasMoreEpisodes, isLoadingBatch, currentEpisodes.length, visibleEpisodeCount]);
  
  // Handle scroll end reached - checks if we need to load more episodes
  const handleLoadMore = useCallback(() => {
    if (isLoadingBatch) return;
    
    setIsLoadingBatch(true);
    
    // Determine if we need to load more episodes (if viewing last few episodes in current range)
    const currentTabEpisodes = episodeRanges[activeTab] || [];
    const isNearingEnd = currentTabEpisodes.length > 0 && 
      visibleEpisodes.includes(currentTabEpisodes[currentTabEpisodes.length - 3]?.id);
      
    if (isNearingEnd && hasMoreEpisodes) {
      loadMoreEpisodes();
    }
    
    setIsLoadingBatch(false);
  }, [isLoadingBatch, episodeRanges, activeTab, visibleEpisodes, hasMoreEpisodes, loadMoreEpisodes]);

  // Handle episode press
  const handleEpisodePress = useCallback((episode: Episode) => {
    const episodeId = `${anilistId || ''}?ep=${episode.number}`;
    setSelectedEpisodeId(episodeId);
    setSelectedEpisode(episode);
    console.log('Selected episode:', episodeId);
    
    // This object will store episode data and can be modified with the saved timestamp
    let episodeData = {
      id: episodeId,
      number: episode.number,
      startTime: 0 // Default to 0, will be updated if saved progress exists
    };
    
    // Check for saved timestamp in AsyncStorage
    const checkSavedProgress = async () => {
      try {
        // Create a unique key for this episode's progress
        const progressKey = `video_progress_${anilistId || malId}_${episode.number}`;
        const animeNameForKey = animeTitle ? animeTitle.toLowerCase().trim() : 'unknown';
        const legacyKey = `progress_${animeNameForKey}_ep${episode.number}`;
        
        console.log('Checking for saved timestamp with new key:', progressKey);
        console.log('Also checking with legacy key:', legacyKey);
        
        // Try to get saved progress from both key formats
        let savedProgressData = await AsyncStorage.getItem(progressKey);
        
        if (!savedProgressData) {
          savedProgressData = await AsyncStorage.getItem(legacyKey);
          
          if (savedProgressData) {
            await AsyncStorage.setItem(progressKey, savedProgressData);
          }
        }
        
        if (savedProgressData) {
          const { position, duration } = JSON.parse(savedProgressData);
          
          if (position !== undefined && duration !== undefined) {
            const isNearEnd = position >= duration - 30 || position / duration > 0.9;
            
            if (!isNearEnd) {
              episodeData.startTime = position;
            }
          }
        }
        
        // Store data for use in handleSourceSelect
        await AsyncStorage.setItem('temp_resume_position', JSON.stringify({
          startTime: episodeData.startTime,
          episodeId: episodeId
        }));
        
        // Show modal for source selection
        setModalVisible(true);
      } catch (error) {
        console.error('Error checking saved progress:', error);
        setModalVisible(true);
      }
    };
    
    checkSavedProgress();
  }, [anilistId, malId, animeTitle]);

  // Optimize FlashList by estimating item size based on column count
  const estimatedItemSize = useMemo(() => {
    return columnCount === 1 ? 120 : columnCount === 2 ? 200 : 260;
  }, [columnCount]);
  
  // Add window dimensions to optimize layout calculations
  const windowDimensions = useWindowDimensions();

  // Add useEffect to properly set episodes from props
  useEffect(() => {
    console.log('Initial episodes received:', initialEpisodes?.length);
    if (initialEpisodes && initialEpisodes.length > 0) {
      setCurrentEpisodes(initialEpisodes);
      setEpisodes(initialEpisodes);
      setIsLoading(false);
      console.log('Set current episodes:', initialEpisodes.length);
    } else {
      console.log('No episodes in initialEpisodes prop');
    }
  }, [initialEpisodes]);

  // Log when episodeRanges changes
  useEffect(() => {
    console.log('Episode ranges updated:', episodeRanges.length);
    console.log('Active tab:', activeTab);
    console.log('Episodes in active range:', episodeRanges[activeTab]?.length || 0);
  }, [episodeRanges, activeTab]);

  // Check notification status when the component mounts
  useEffect(() => {
    if (anilistId) {
      isNotificationEnabled(anilistId).then(enabled => {
        setNotificationsEnabled(enabled);
        console.log(`Notifications ${enabled ? 'enabled' : 'disabled'} for ${animeTitle}`);
      });
    }
  }, [anilistId, animeTitle]);

  // Add function to fetch airing schedule from AniList
  const fetchAiringSchedule = useCallback(async () => {
    if (!anilistId) return;
    
    try {
      const query = `
        query ($id: Int) {
          Media(id: $id, type: ANIME) {
            nextAiringEpisode {
              episode
              airingAt
              timeUntilAiring
            }
            status
          }
        }
      `;
      
      const response = await axios.post(
        ANILIST_GRAPHQL_ENDPOINT,
        {
          query,
          variables: {
            mediaId: parseInt(anilistId)
          }
        },
        {
          headers: {
            'Content-Type': 'application/json',
          }
        }
      );
      
      if (response.data?.data?.Media) {
        const media = response.data.data.Media;
        if (media.nextAiringEpisode) {
          setAiringSchedule({
            nextEpisode: media.nextAiringEpisode.episode,
            nextAiringAt: media.nextAiringEpisode.airingAt,
            timeUntilAiring: media.nextAiringEpisode.timeUntilAiring,
            status: media.status
          });
          
          // Calculate time until airing
          const timeUntil = media.nextAiringEpisode.timeUntilAiring;
          if (timeUntil) {
            const days = Math.floor(timeUntil / (24 * 60 * 60));
            const hours = Math.floor((timeUntil % (24 * 60 * 60)) / (60 * 60));
            const minutes = Math.floor((timeUntil % (60 * 60)) / 60);
            
            let timeString = '';
            if (days > 0) timeString += `${days}d `;
            if (hours > 0) timeString += `${hours}h `;
            if (minutes > 0 && days === 0) timeString += `${minutes}m`;
            
            setTimeUntilAiring(timeString.trim() || 'Soon');
          }
        } else {
          setAiringSchedule({ status: media.status });
        }
      }
    } catch (error) {
      console.error('Error fetching airing schedule:', error);
    }
  }, [anilistId]);

  // Fetch airing schedule when component mounts
  useEffect(() => {
    fetchAiringSchedule();
  }, [fetchAiringSchedule]);

  // Render the header with airing info and tabs
  const renderHeader = () => (
    <View style={{ backgroundColor: 'transparent' }}>
      {/* Latest Episode Banner - Show this if we have airing data or latest episode info */}
      {(airingSchedule || latestEpisodeInfo) && (
        <View style={[styles.latestEpisodeBanner, { 
          backgroundColor: isDarkMode ? 'rgba(2, 169, 255, 0.1)' : 'rgba(2, 169, 255, 0.05)',
          borderColor: '#02A9FF',
        }]}>
          <View style={styles.latestEpisodeContent}>
            <View style={styles.latestEpisodeIconContainer}>
              <FontAwesome5 name="play-circle" size={24} color="#02A9FF" />
            </View>
            <View style={styles.latestEpisodeInfo}>
              {/* Show latest episode info if available, otherwise fall back to airing schedule */}
              {latestEpisodeInfo ? (
                <>
                  <Text style={[styles.latestEpisodeText, { color: currentTheme.colors.text }]}>
                    Latest: Episode {latestEpisodeInfo.number}
                    <Text style={{ color: currentTheme.colors.textSecondary, fontSize: 14 }}>
                      {' '}- Released {new Date(latestEpisodeInfo.date).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric', 
                        year: 'numeric'
                      })}
                    </Text>
                  </Text>
                  <Text style={[styles.nextEpisodeText, { color: currentTheme.colors.textSecondary }]}>
                    Source: {latestEpisodeInfo.source}
                  </Text>
                </>
              ) : airingSchedule?.lastEpisode && (
                <>
                  <Text style={[styles.latestEpisodeText, { color: currentTheme.colors.text }]}>
                    Latest: Episode {airingSchedule.lastEpisode}
                    {airingSchedule.lastAiredAt && (
                      <Text style={{ color: currentTheme.colors.textSecondary, fontSize: 14 }}>
                        {' '}- Released {new Date(airingSchedule.lastAiredAt * 1000).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric', 
                          year: 'numeric'
                        })}
                      </Text>
                    )}
                  </Text>
                  <Text style={[styles.nextEpisodeText, { color: currentTheme.colors.textSecondary }]}>
                    Source: AniList
                  </Text>
                </>
              )}
              
              {/* Show next episode info from airing schedule if available */}
              {airingSchedule?.nextEpisode && airingSchedule.status === 'RELEASING' && (
                <Text style={[styles.nextEpisodeText, { color: currentTheme.colors.textSecondary, marginTop: 4 }]}>
                  Next: Episode {airingSchedule.nextEpisode} - {timeUntilAiring ? `Airing in ${timeUntilAiring}` : 'Coming soon'}
                </Text>
              )}
            </View>
          </View>
        </View>
      )}
      
      {/* Range selector - replaced ScrollView with non-scrollable View or FlatList as needed */}
      {columnCount > 1 ? (
        <View style={[
          styles.rangeSelector,
          {
            flexDirection: 'row',
            flexWrap: 'wrap',
            justifyContent: 'center',
            alignItems: 'center',
            paddingVertical: 4,
            gap: 6
          }
        ]}>
          {episodeRanges.map((range, index) => (
            <TouchableOpacity
              key={`range-${index}`}
              style={[
                styles.rangeButton,
                activeTab === index && styles.activeRangeButton
              ]}
              onPress={() => setActiveTab(index)}
            >
              <Text 
                style={[
                  styles.rangeButtonText,
                  activeTab === index && styles.activeRangeButtonText
                ]}
                numberOfLines={1}
              >
                {renderTabLabel(index, range)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : (
        // Replace ScrollView with FlatList for range buttons
        <FlatList
          data={episodeRanges}
          horizontal={true}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.rangeSelector}
          keyExtractor={(_, index) => `range-${index}`}
          ItemSeparatorComponent={() => (
            <View style={{ width: 4 }} />
          )}
          renderItem={({item: range, index}) => (
            <TouchableOpacity
              key={`range-${index}`}
              style={[
                styles.rangeButton,
                activeTab === index && styles.activeRangeButton
              ]}
              onPress={() => setActiveTab(index)}
            >
              <Text 
                style={[
                  styles.rangeButtonText,
                  activeTab === index && styles.activeRangeButtonText
                ]}
                numberOfLines={1}
              >
                {renderTabLabel(index, range)}
              </Text>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );

  // Show background loading indicator when refreshing in the background
  const renderBackgroundLoader = () => {
    if (!isBackgroundRefreshing) return null;
    
    return (
      <View style={styles.backgroundRefreshIndicator}>
        <ActivityIndicator size="small" color="#02A9FF" />
        <Text style={styles.backgroundRefreshText}>Updating...</Text>
      </View>
    );
  };

  // Update the loading state UI to show retry attempts
  const renderLoadingState = () => {
    if (!loadingState) return null;
    
    return (
      <View style={[styles.loadingContainer, { backgroundColor: currentTheme.colors.background }]}>
        <ActivityIndicator size="large" color="#02A9FF" />
        <View style={styles.loadingInfo}>
          <Text style={[styles.loadingMessage, { color: currentTheme.colors.textSecondary }]}>
            {loadingState.message}
          </Text>
          {loadingState.type === 'loading' && (
            <>
              <View style={[styles.progressBar, { backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : '#eee' }]}>
                <View 
                  style={[
                    styles.progressFill, 
                    { width: `${(loadingState.currentPage / loadingState.totalPages) * 100}%` }
                  ]} 
                />
              </View>
              <Text style={[styles.loadingProgress, { color: currentTheme.colors.textSecondary }]}>
                {loadingState.currentPage} / {loadingState.totalPages}
              </Text>
            </>
          )}
        </View>
      </View>
    );
  };

  // Only show empty state if we've actually checked for episodes and none were found
  if (!isLoading && currentEpisodes.length === 0 && initialEpisodes.length === 0) {
    console.log('Rendering empty state - no episodes available');
    return (
      <View style={[styles.emptyEpisodes, { backgroundColor: currentTheme.colors.background }]}>
        <FontAwesome5 name="video-slash" size={48} color={isDarkMode ? '#666' : '#ccc'} />
        <Text style={[styles.emptyText, { color: currentTheme.colors.textSecondary }]}>No episodes available</Text>
      </View>
    );
  }
  
  // Updated return statement with all optimizations
  return (
    <View style={[styles.container, { backgroundColor: 'transparent' }]}>
      <View style={styles.headerWrapper}>
        {/* Add a header with notification and sort controls */}
        <View style={styles.header}>
          <Text style={[styles.titleText, { color: currentTheme.colors.text }]}>
            Episodes
          </Text>
          <View style={styles.headerButtons}>
            <TouchableOpacity
              style={[styles.headerButton, { backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)' }]}
              onPress={handleSortToggle}
            >
              <FontAwesome5 
                name={isNewestFirst ? "sort-numeric-down" : "sort-numeric-up"} 
                size={16} 
                color={currentTheme.colors.text} 
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.notificationButton,
                notificationsEnabled && styles.notificationButtonEnabled
              ]}
              onPress={handleNotificationToggle}
            >
              <FontAwesome5 
                name={notificationsEnabled ? "bell" : "bell-slash"} 
                size={16} 
                color={notificationsEnabled ? "#FFFFFF" : currentTheme.colors.text} 
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.headerButton, { backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)' }]}
              onPress={handleColumnToggle}
            >
              <FontAwesome5 
                name={columnCount === 1 ? "th-large" : columnCount === 2 ? "th" : "list"} 
                size={16} 
                color={currentTheme.colors.text} 
              />
            </TouchableOpacity>
          </View>
        </View>
        {renderHeader()}
        {renderBackgroundLoader()}
      </View>
      
      {isBackgroundRefreshing && loadedFromCache ? (
        // When refreshing in background but we have cached data, show cached data
        <FlatList
          data={displayedEpisodes}
          renderItem={({ item }) => (
            <View style={styles.cardWrapper}>
              {columnCount === 1 ? (
                <MemoizedListEpisodeCard
                  episode={item}
                  onPress={handleEpisodePress}
                  currentProgress={currentProgress}
                  currentTheme={currentTheme}
                  isDarkMode={isDarkMode}
                  coverImage={coverImage}
                />
              ) : (
                <MemoizedGridEpisodeCard
                  episode={item}
                  onPress={handleEpisodePress}
                  currentProgress={currentProgress}
                  currentTheme={currentTheme}
                  isDarkMode={isDarkMode}
                  coverImage={coverImage}
                />
              )}
            </View>
          )}
          numColumns={columnCount}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: 10,
            paddingBottom: Platform.OS === 'ios' ? 100 : 90,
            paddingTop: 8,
          }}
          style={{ width: '100%' }}
          onEndReached={() => handleLoadMore()}
          onEndReachedThreshold={0.5}
          keyExtractor={(item) => item.id}
        />
      ) : currentEpisodes.length === 0 ? (
        // If no episodes are available
        <View style={[styles.emptyEpisodes, { backgroundColor: currentTheme.colors.background }]}>
          <FontAwesome5 name="video-slash" size={48} color={isDarkMode ? '#666' : '#ccc'} />
          <Text style={[styles.emptyText, { color: currentTheme.colors.textSecondary }]}>No episodes available</Text>
        </View>
      ) : (
        // Normal rendering with optimized FlashList
        <FlashList
          ref={flashListRef}
          data={episodeRanges[activeTab]?.length > 0 ? episodeRanges[activeTab] : currentEpisodes}
          renderItem={({ item: episode }) => (
            <View style={styles.cardWrapper}>
              {columnCount === 1 ? (
                <MemoizedListEpisodeCard
                  episode={episode as Episode}
                  onPress={handleEpisodePress}
                  currentProgress={currentProgress}
                  currentTheme={currentTheme}
                  isDarkMode={isDarkMode}
                  coverImage={coverImage}
                />
              ) : (
                <MemoizedGridEpisodeCard
                  episode={episode as Episode}
                  onPress={handleEpisodePress}
                  currentProgress={currentProgress}
                  currentTheme={currentTheme}
                  isDarkMode={isDarkMode}
                  coverImage={coverImage}
                />
              )}
            </View>
          )}
          estimatedItemSize={columnCount === 1 ? 120 : columnCount === 2 ? 200 : 260}
          numColumns={columnCount}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: 10,
            paddingBottom: Platform.OS === 'ios' ? 100 : 90,
            paddingTop: 8,
          }}
          style={{ width: '100%' }}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          keyExtractor={(item) => `episode-${(item as Episode).id}`}
          ListFooterComponent={
            isLoadingBatch ? (
              <View style={styles.loadMoreContainer}>
                <ActivityIndicator size="small" color="#02A9FF" />
                <Text style={styles.loadMoreText}>Loading more episodes...</Text>
              </View>
            ) : null
          }
        />
      )}

      <EpisodeSourcesModal
        visible={modalVisible}
        episodeId={selectedEpisodeId}
        animeTitle={animeTitle}
        onClose={() => setModalVisible(false)}
        onSelectSource={handleSourceSelect}
        preferredType={sourceSettings.preferredType}
        anilistId={anilistId}
        malId={malId}
        autoSelectSource={sourceSettings.preferredType === 'auto'}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    backgroundColor: 'transparent',
    marginTop: 0,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  tabsContainer: {
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginHorizontal: 4,
    borderRadius: 20,
  },
  activeTab: {
    backgroundColor: '#02A9FF',
  },
  tabText: {
    fontWeight: '600',
  },
  gridContainer: {
    width: '100%',
    alignItems: 'center',
  },
  columnWrapper: {
    justifyContent: 'center',
    width: '100%',
    gap: 16,
  },
  gridItem: {
    width: '48%',
    marginVertical: 8,
    alignItems: 'center',
  },
  episodeImageContainer: {
    width: '100%',
    aspectRatio: 16/9,
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
    marginBottom: 4,
  },
  episodeImage: {
    width: '100%',
    height: '100%',
  },
  episodeNumber: {
    fontSize: 14,
    fontWeight: '700',
  },
  episodeNumberText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  gridEpisodeTitle: {
    fontSize: 14,
    fontWeight: '500',
    marginTop: 4,
  },
  fillerBadge: {
    position: 'absolute',
    top: 4,
    left: 4,
    backgroundColor: 'rgba(244, 67, 54, 0.9)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  recapBadge: {
    backgroundColor: 'rgba(33, 150, 243, 0.9)',
  },
  fillerText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  watchedGridItem: {
    opacity: 1,
    borderRadius: 8,
    backgroundColor: 'rgba(128, 128, 128, 0.2)',
  },
  watchedEpisodeImage: {
    opacity: 0.7,
  },
  watchedEpisodeNumber: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  watchedOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(128, 128, 128, 0.3)',
  },
  airingInfoContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 4,
    borderBottomWidth: 1,
  },
  airingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  airingInfoContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  airingIcon: {
    marginRight: 8,
  },
  airingInfoLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  airingCountdown: {
    fontSize: 14,
    color: '#666',
  },
  episodeImagePlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  airedDate: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  episodeMetaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  episodeTypeLabel: {
    fontSize: 12,
    color: '#F44336',
    fontWeight: '500',
  },
  recapLabel: {
    color: '#2196F3',
  },
  loadingInfo: {
    marginTop: 20,
    alignItems: 'center',
    width: '100%',
  },
  loadingMessage: {
    fontSize: 16,
    color: '#666',
    marginBottom: 10,
    textAlign: 'center',
  },
  loadingProgress: {
    fontSize: 14,
    color: '#888',
    marginTop: 5,
  },
  progressBar: {
    width: '100%',
    height: 4,
    backgroundColor: '#eee',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#02A9FF',
    borderRadius: 2,
  },
  notificationButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notificationButtonEnabled: {
    backgroundColor: '#02A9FF',
  },
  emptyEpisodes: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    textAlign: 'center',
  },
  headerWrapper: {
    paddingHorizontal: 16,
    paddingTop: 0, // No padding on top
    paddingBottom: 8,
    marginBottom: 4,
    backgroundColor: 'transparent',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  titleText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    marginRight: 12,
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerButton: {
    padding: 8,
    borderRadius: 8,
  },
  rangeSelector: {
    flexDirection: 'row',
    paddingVertical: 8,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  rangeButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 70,
    backgroundColor: '#2c2c2e',
  },
  rangeButtonText: {
    fontWeight: '600',
    textAlign: 'center',
    fontSize: 13,
    color: '#fff',
  },
  activeRangeButton: {
    backgroundColor: '#02A9FF',
    borderColor: '#0290E0',
  },
  activeRangeButtonText: {
    color: '#fff',
  },
  gridWrapper: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
  },
  cardWrapper: {
    alignItems: 'center',
    marginVertical: 4,
    width: '100%',
    paddingHorizontal: 6,
  },
  watchedEpisodeTitle: {
    opacity: 0.7,
  },
  latestEpisodeBanner: {
    marginTop: 0, // Ensure no top margin
    marginBottom: 12, // Slightly reduced from 16
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  latestEpisodeContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  latestEpisodeIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(2, 169, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  latestEpisodeInfo: {
    flex: 1,
  },
  latestEpisodeText: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  nextEpisodeText: {
    fontSize: 14,
  },
  episodeItemContainer: {
    marginBottom: 8,
    width: '100%',
  },
  // New styles for redesigned episode cards
  episodeCard: {
    flexDirection: 'row',
    backgroundColor: '#1c1c1e',
    borderRadius: 10,
    marginVertical: 6,
    marginHorizontal: 2,
    padding: 10,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  thumbnailContainer: {
    position: 'relative',
  },
  episodeThumbnail: {
    width: 80,
    height: 80,
    borderRadius: 8,
    marginRight: 12,
  },
  watchedThumbnail: {
    opacity: 0.7,
    borderWidth: 1,
    borderColor: '#02A9FF',
  },
  watchedBadge: {
    position: 'absolute',
    top: 4,
    right: 16,
    backgroundColor: '#02A9FF',
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
  },
  episodeContent: {
    flex: 1,
    justifyContent: 'space-between',
  },
  episodeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  episodeTitle: {
    fontSize: 15,
    fontWeight: '500',
    marginBottom: 2,
  },
  episodeMeta: {
    fontSize: 12,
    marginTop: 2,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  progressBarContainer: {
    height: 4,
    flex: 1,
    backgroundColor: '#444',
    borderRadius: 2,
    overflow: 'hidden',
    marginRight: 12,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#02A9FF',
    borderRadius: 2,
  },
  episodeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    width: '100%',
    backgroundColor: 'rgba(30, 30, 30, 0.6)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  watchButton: {
    backgroundColor: '#02A9FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 70,
  },
  rewatchButton: {
    backgroundColor: '#0277B5', // Darker blue for rewatch button
  },
  watchButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 12,
  },
  watchedEpisodeItem: {
    borderLeftWidth: 3,
    borderLeftColor: '#02A9FF',
    backgroundColor: '#162032', // Darker card background for watched episodes
  },
  topControlsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 48 : 16,
    paddingBottom: 4,
  },
  controlsLeft: {
    flex: 1,
  },
  controlsRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  controlButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  activeControlButton: {
    backgroundColor: 'rgba(2, 169, 255, 0.1)',
  },
  headerButtonsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  episodeCountContainer: {
    padding: 16,
    alignItems: 'center',
  },
  episodeCountText: {
    fontSize: 14,
    fontWeight: '600',
  },
  backgroundRefreshIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(2, 169, 255, 0.1)',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
    alignSelf: 'center',
    marginBottom: 8,
  },
  backgroundRefreshText: {
    fontSize: 12,
    color: '#02A9FF',
    marginLeft: 4,
    fontWeight: '500',
  },
  loadMoreContainer: {
    padding: 16,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  loadMoreText: {
    fontSize: 14,
    color: '#02A9FF',
  },
  moveToTopButton: {
    backgroundColor: 'rgba(2, 169, 255, 0.1)',
    padding: 14,
    borderRadius: 30,
    marginVertical: 20,
    marginHorizontal: 40,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
  },
  moveToTopButtonText: {
    color: '#02A9FF',
    fontWeight: '600',
    fontSize: 14,
  },
  gridEpisodeCard: {
    flexDirection: 'column',
    backgroundColor: '#1c1c1e',
    borderRadius: 12,
    marginVertical: 4,
    marginHorizontal: 4,
    padding: 8,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
    aspectRatio: 0.75, // Make it more rectangular for grid
  },
  gridThumbnailContainer: {
    position: 'relative',
    width: '100%',
    aspectRatio: 16/9,
    marginBottom: 8,
  },
  gridEpisodeThumbnail: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  gridWatchedBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: '#02A9FF',
    width: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gridEpisodeContent: {
    flex: 1,
    justifyContent: 'space-between',
  },
  gridEpisodeMeta: {
    fontSize: 11,
    marginBottom: 6,
  },
  gridWatchButton: {
    backgroundColor: '#02A9FF',
    paddingVertical: 6,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
  },
  gridRewatchButton: {
    backgroundColor: '#0277B5',
  },
  watchedGridCard: {
    borderWidth: 1,
    borderColor: '#02A9FF',
    opacity: 0.8,
  },
  watchedGridThumbnail: {
    opacity: 0.7,
    borderWidth: 1,
    borderColor: '#02A9FF',
  },
  gridEpisodeNumberBadge: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    backgroundColor: 'rgba(2, 169, 255, 0.9)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    minWidth: 20,
    alignItems: 'center',
  },
  gridEpisodeNumberText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  listEpisodeCard: {
    flexDirection: 'row',
    backgroundColor: '#1c1c1e',
    borderRadius: 10,
    marginVertical: 6,
    marginHorizontal: 2,
    padding: 10,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  listThumbnailContainer: {
    position: 'relative',
  },
  listEpisodeThumbnail: {
    width: 80,
    height: 80,
    borderRadius: 8,
    marginRight: 12,
  },
  listWatchedThumbnail: {
    opacity: 0.7,
    borderWidth: 1,
    borderColor: '#02A9FF',
  },
  listWatchedBadge: {
    position: 'absolute',
    top: 4,
    right: 16,
    backgroundColor: '#02A9FF',
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listEpisodeContent: {
    flex: 1,
    justifyContent: 'space-between',
  },
  listEpisodeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  listEpisodeTitleContainer: {
    flex: 1,
  },
  listEpisodeTitle: {
    fontSize: 15,
    fontWeight: '500',
    marginBottom: 2,
  },
  listEpisodeProvider: {
    fontSize: 12,
    marginTop: 2,
  },
  listEpisodeMetaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  listMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  listMetaText: {
    fontSize: 12,
    marginTop: 2,
  },
  listEpisodeFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  listProgressContainer: {
    height: 4,
    flex: 1,
    backgroundColor: '#444',
    borderRadius: 2,
    overflow: 'hidden',
    marginRight: 12,
  },
  listProgressFill: {
    height: '100%',
    backgroundColor: '#02A9FF',
    borderRadius: 2,
  },
  listProgressText: {
    fontSize: 12,
    color: '#fff',
  },
  listWatchButton: {
    backgroundColor: '#02A9FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 70,
  },
  listRewatchButton: {
    backgroundColor: '#0277B5',
  },
  listWatchButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 12,
  },
  watchedListCard: {
    borderWidth: 1,
    borderColor: '#02A9FF',
    opacity: 0.9,
  },
  listEpisodeNumberBadge: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    backgroundColor: 'rgba(2, 169, 255, 0.9)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    minWidth: 20,
    alignItems: 'center',
  },
  listEpisodeNumberText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  listEpisodeTypeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 8,
  },
  listEpisodeTypeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
  },
  listProgressBar: {
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 4,
  },
  watchedListThumbnail: {
    opacity: 0.7,
    borderWidth: 1,
    borderColor: '#02A9FF',
  },
}); 