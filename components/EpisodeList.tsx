import React, { useState, useEffect, useCallback, useMemo, useRef, memo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList, ActivityIndicator, Platform, useWindowDimensions, ScrollView } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { FontAwesome5 } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import EpisodeSourcesModal from '../app/components/EpisodeSourcesModal';
import CorrectAnimeSearchModal from './CorrectAnimeSearchModal';
import { requestNotificationPermissions, toggleNotifications, isNotificationEnabled } from '../utils/notifications';
import axios from 'axios';
import { JIKAN_API_ENDPOINT } from '../app/constants/api';
import { STORAGE_KEY } from '../constants/auth';
import * as SecureStore from 'expo-secure-store';
import { FlashList } from '@shopify/flash-list';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  MAX_INITIAL_EPISODES,
  saveEpisodesToCache,
} from '../utils/episodeOptimization';
import { animeProviderManager } from '../api/proxy/providers/anime';
import { zoroProvider } from '../api/proxy/providers/anime/zorohianime';
import { animePaheProvider } from '../api/proxy/providers/anime/animepahe';
import {
  getOptimizedListProps, 
  detectDeviceCapabilities, 
  PERFORMANCE_CONFIG,
  useOptimizedScrollHandler,
  MemoryManager 
} from '../utils/performanceOptimization';
import OptimizedImage from './OptimizedImage';
import { fetchRelatedSeasons } from '../api/anilist/queries';

// Device capabilities for performance optimization
const deviceCapabilities = detectDeviceCapabilities();

// Hook to load source settings
const useSourceSettings = () => {
  const [sourceSettings, setSourceSettings] = useState({
    preferredType: 'sub' as 'sub' | 'dub',
    autoTryAlternateVersion: true,
    preferHLSStreams: true,
    logSourceDetails: true,
    defaultProvider: 'animepahe' as 'animepahe' | 'zoro',
    autoSelectSource: true,
    providerPriority: ['animepahe', 'zoro'] as ('animepahe' | 'zoro')[],
  });

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const sourceData = await AsyncStorage.getItem('sourceSettings');
        if (sourceData) {
          const parsedSettings = JSON.parse(sourceData);
          setSourceSettings(prev => ({ ...prev, ...parsedSettings }));
        }
      } catch (error) {
        console.error('Failed to load source settings:', error);
      }
    };

    loadSettings();
  }, []);

  return sourceSettings;
};

// #region Constants & Interfaces
const ANILIST_GRAPHQL_ENDPOINT = 'https://graphql.anilist.co';
const MAL_API_ENDPOINT = 'https://api.myanimelist.net/v2';

const PLACEHOLDER_BLUR_HASH = PERFORMANCE_CONFIG.BLUR_HASH_PLACEHOLDER;

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
  isSubbed?: boolean;
  isDubbed?: boolean;
  providerIds?: {
    animepahe?: string;
    zoro?: string;
  };
}

interface EpisodeProgress {
  timestamp: number;
  duration: number;
  percentage: number;
}

interface EpisodeListProps {
  episodes: Episode[];
  loading: boolean;
  animeTitle: string;
  anilistId?: string;
  malId?: string;
  coverImage?: string;
  mangaTitle?: string;
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

interface NotificationItem {
  id: string;
  type: 'anime' | 'manga';
  title: string;
  lastKnownNumber: number;
  anilistId?: string;
}

interface Season {
  id: string;
  title: {
    userPreferred: string;
    english?: string;
    romaji?: string;
    native?: string;
  };
  format: string;
  status: string;
  startDate: {
    year?: number;
    month?: number;
    day?: number;
  };
  episodes?: number;
  coverImage?: {
    large: string;
    color?: string;
  };
  averageScore?: number;
  season?: string;
  seasonYear?: number;
}
// #endregion

// #region Production-Safe Helper Functions
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const fetchWithRetry = async (url: string, options: any = {}, maxRetries = 3) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await axios.get(url, options);
      return response;
    } catch (error: any) {
      if (error?.response?.status === 429 && i < maxRetries - 1) {
        const delay = Math.pow(2, i) * 1000;
        console.warn(`Rate limited. Retrying in ${delay}ms...`);
        await wait(delay);
      } else {
        throw error;
      }
    }
  }
  throw new Error('Max retries reached');
};

const safeFormatDate = (dateString?: string, options?: Intl.DateTimeFormatOptions): string | null => {
  try {
    if (!dateString) return null;
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      console.warn('[safeFormatDate] Invalid date string provided:', dateString);
      return null;
    }
    return date.toLocaleDateString(undefined, options);
  } catch (error) {
    console.error('[safeFormatDate] Error formatting date:', error);
    return null;
  }
};
// #endregion

// #region Optimized Episode Card Components
const OptimizedGridEpisodeCard = memo<{
  episode: Episode;
  onPress: (episode: Episode) => void;
  currentProgress: number;
  currentTheme: any;
  isDarkMode: boolean;
  coverImage?: string;
  index: number;
  isVisible: boolean;
  preferredAudioType: 'sub' | 'dub';
  onAudioError: (episode: Episode, requestedType: 'sub' | 'dub') => void;
  episodeProgress?: EpisodeProgress;
}>(({ episode, onPress, currentProgress, currentTheme, isDarkMode, coverImage, index, isVisible, preferredAudioType, onAudioError, episodeProgress }) => {
  const isWatched = useMemo(() => currentProgress >= (episode.number ?? 0), [currentProgress, episode.number]);
  const safeEpisodeNumber = useMemo(() => String(episode?.number ?? '??'), [episode.number]);
  const safeEpisodeTitle = useMemo(() => episode?.title || `Episode ${safeEpisodeNumber}`, [episode.title, safeEpisodeNumber]);
  const formattedDate = useMemo(() => safeFormatDate(episode?.aired, { month: 'short', day: 'numeric' }), [episode.aired]);

  // Check if preferred audio type is available
  const audioAvailable = useMemo(() => {
    if (preferredAudioType === 'sub') {
      return episode.isSubbed === true;
    } else {
      return episode.isDubbed === true;
    }
  }, [episode.isSubbed, episode.isDubbed, preferredAudioType]);

  const handlePress = useCallback(() => {
    if (!audioAvailable) {
      onAudioError(episode, preferredAudioType);
      return;
    }
    onPress(episode);
  }, [onPress, episode, audioAvailable, preferredAudioType, onAudioError]);

  const cardStyle = useMemo(() => [
    styles.gridEpisodeCard, 
    { backgroundColor: isDarkMode ? 'rgba(28, 28, 30, 0.95)' : 'rgba(255, 255, 255, 0.95)' }, 
    isWatched && styles.watchedGridCard,
    !audioAvailable && styles.unavailableCard
  ], [isDarkMode, isWatched, audioAvailable]);

  return (
    <TouchableOpacity
      style={cardStyle}
      onPress={handlePress}
      activeOpacity={0.8}
    >
      {/* Thumbnail Section */}
      <View style={styles.gridThumbnailContainer}>
        <OptimizedImage
          uri={episode.image || coverImage || ''}
          width={160}
          height={90}
          style={[styles.gridEpisodeThumbnail, isWatched && styles.watchedGridThumbnail, !audioAvailable && styles.unavailableThumbnail]}
          placeholder={PLACEHOLDER_BLUR_HASH}
          resizeMode="cover"
          isVisible={isVisible}
          priority={index < 6 ? 'high' : 'normal'}
          reduceMemoryUsage={deviceCapabilities.isLowEndDevice}
          index={index}
        />
        
        {/* Episode Number Badge */}
        <View style={styles.gridEpisodeNumberBadge}>
          <Text style={styles.gridEpisodeNumberText}>EP {safeEpisodeNumber}</Text>
        </View>
        
        {/* Watched Indicator */}
        {isWatched && (
          <View style={styles.gridWatchedBadge}>
            <FontAwesome5 name="check" size={10} color="#FFFFFF" />
          </View>
        )}
        
        {/* Unavailable Warning */}
        {!audioAvailable && (
          <View style={styles.gridUnavailableBadge}>
            <FontAwesome5 name="exclamation-triangle" size={12} color="#FFFFFF" />
          </View>
        )}
      </View>

      {/* Content Section */}
      <View style={styles.gridEpisodeContent}>
        {/* Episode Title - Most Prominent */}
        <Text style={[styles.gridEpisodeTitle, { color: currentTheme.colors.text }, !audioAvailable && styles.unavailableText]} numberOfLines={2}>
          Ep {safeEpisodeNumber}: {safeEpisodeTitle}
        </Text>
        
        {/* Audio Pills & Meta Row */}
        <View style={styles.gridMetaRow}>
          {/* Audio Type Pills */}
          <View style={styles.gridAudioPills}>
            {episode.isSubbed && (
              <View style={[
                styles.gridAudioPill, 
                styles.gridSubPill,
                preferredAudioType === 'sub' && styles.gridPreferredPill
              ]}>
                <Text style={styles.gridPillText}>🈸 SUB</Text>
              </View>
            )}
            {episode.isDubbed && (
              <View style={[
                styles.gridAudioPill, 
                styles.gridDubPill,
                preferredAudioType === 'dub' && styles.gridPreferredPill
              ]}>
                <Text style={styles.gridPillText}>🎧 DUB</Text>
              </View>
            )}
          </View>
          
          {/* Date */}
          {formattedDate && (
            <Text style={[styles.gridDateText, { color: currentTheme.colors.textSecondary }]}>
              {formattedDate}
            </Text>
          )}
        </View>
        
        {/* Watch Button */}
        <TouchableOpacity 
          style={[
            styles.gridWatchButton, 
            isWatched && styles.gridRewatchButton,
            !audioAvailable && styles.gridUnavailableButton
          ]} 
          onPress={handlePress}
        >
          <FontAwesome5 
            name={!audioAvailable ? "exclamation-triangle" : isWatched ? "redo" : "play"} 
            size={12} 
            color="#FFFFFF" 
            style={{ marginRight: 6 }}
          />
          <Text style={styles.gridWatchButtonText}>
            {!audioAvailable 
              ? "Unavailable" 
              : `${isWatched ? "Rewatch" : "Watch"} (${preferredAudioType === 'sub' ? 'Subbed' : 'Dubbed'})`
            }
          </Text>
        </TouchableOpacity>
        
        {/* Progress Bar */}
        {episodeProgress && episodeProgress.percentage > 0 && !isWatched && (
          <View style={styles.progressContainer}>
            <View style={styles.progressBarBackground}>
              <View 
                style={[
                  styles.progressBarFill, 
                  { width: `${episodeProgress.percentage}%` }
                ]} 
              />
            </View>
            <Text style={[styles.progressText, { color: currentTheme.colors.textSecondary }]}>
              {Math.floor(episodeProgress.timestamp / 60)}:{Math.floor(episodeProgress.timestamp % 60).toString().padStart(2, '0')} / {Math.floor(episodeProgress.duration / 60)}:{Math.floor(episodeProgress.duration % 60).toString().padStart(2, '0')}
            </Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.episode.id === nextProps.episode.id &&
    prevProps.episode.number === nextProps.episode.number &&
    prevProps.currentProgress === nextProps.currentProgress &&
    prevProps.isVisible === nextProps.isVisible &&
    prevProps.index === nextProps.index &&
    prevProps.preferredAudioType === nextProps.preferredAudioType &&
    prevProps.episode.isSubbed === nextProps.episode.isSubbed &&
    prevProps.episode.isDubbed === nextProps.episode.isDubbed
  );
});

const OptimizedListEpisodeCard = memo<{
  episode: Episode;
  onPress: (episode: Episode) => void;
  currentProgress: number;
  currentTheme: any;
  isDarkMode: boolean;
  coverImage?: string;
  index: number;
  isVisible: boolean;
  preferredAudioType: 'sub' | 'dub';
  onAudioError: (episode: Episode, requestedType: 'sub' | 'dub') => void;
  episodeProgress?: EpisodeProgress;
}>(({ episode, onPress, currentProgress, currentTheme, isDarkMode, coverImage, index, isVisible, preferredAudioType, onAudioError, episodeProgress }) => {
  const isWatched = useMemo(() => currentProgress >= (episode.number ?? 0), [currentProgress, episode.number]);
  const safeEpisodeNumber = useMemo(() => String(episode?.number ?? '??'), [episode.number]);
  const safeEpisodeTitle = useMemo(() => episode?.title || `Episode ${safeEpisodeNumber}`, [episode.title, safeEpisodeNumber]);
  const formattedDate = useMemo(() => safeFormatDate(episode?.aired, { month: 'short', day: 'numeric' }), [episode.aired]);

  // Check if preferred audio type is available
  const audioAvailable = useMemo(() => {
    if (preferredAudioType === 'sub') {
      return episode.isSubbed === true;
    } else {
      return episode.isDubbed === true;
    }
  }, [episode.isSubbed, episode.isDubbed, preferredAudioType]);

  const handlePress = useCallback(() => {
    if (!audioAvailable) {
      onAudioError(episode, preferredAudioType);
      return;
    }
    onPress(episode);
  }, [onPress, episode, audioAvailable, preferredAudioType, onAudioError]);

  const cardStyle = useMemo(() => [
    styles.listEpisodeCard, 
    { backgroundColor: currentTheme.colors.surface }, 
    isWatched && styles.watchedListCard,
    !audioAvailable && styles.unavailableCard
  ], [currentTheme.colors.surface, isWatched, audioAvailable]);

  return (
    <TouchableOpacity
      style={cardStyle}
      onPress={handlePress}
      activeOpacity={0.8}
    >
      {/* Thumbnail Section */}
      <View style={styles.listThumbnailContainer}>
        <OptimizedImage
          uri={episode.image || coverImage || ''}
          width={120}
          height={68}
          style={[styles.listEpisodeThumbnail, isWatched && styles.watchedListThumbnail, !audioAvailable && styles.unavailableThumbnail]}
          placeholder={PLACEHOLDER_BLUR_HASH}
          resizeMode="cover"
          isVisible={isVisible}
          priority={index < 6 ? 'high' : 'normal'}
          reduceMemoryUsage={deviceCapabilities.isLowEndDevice}
          index={index}
        />
        
        {/* Watched Indicator */}
        {isWatched && (
          <View style={styles.listWatchedBadge}>
            <FontAwesome5 name="check" size={10} color="#FFFFFF" />
          </View>
        )}
        
        {/* Unavailable Warning */}
        {!audioAvailable && (
          <View style={styles.listUnavailableBadge}>
            <FontAwesome5 name="exclamation-triangle" size={12} color="#FFFFFF" />
          </View>
        )}
      </View>

      {/* Content Section */}
      <View style={styles.listEpisodeContent}>
        {/* Episode Title - Most Prominent */}
        <Text style={[styles.listEpisodeTitle, { color: currentTheme.colors.text }, !audioAvailable && styles.unavailableText]} numberOfLines={2}>
          Ep {safeEpisodeNumber}: {safeEpisodeTitle}
        </Text>
        
        {/* Audio Pills & Meta Row */}
        <View style={styles.listMetaRow}>
          {/* Audio Type Pills */}
          <View style={styles.listAudioPills}>
            {episode.isSubbed && (
              <View style={[
                styles.listAudioPill, 
                styles.listSubPill,
                preferredAudioType === 'sub' && styles.listPreferredPill
              ]}>
                <Text style={styles.listPillText}>🈸 SUB</Text>
              </View>
            )}
            {episode.isDubbed && (
              <View style={[
                styles.listAudioPill, 
                styles.listDubPill,
                preferredAudioType === 'dub' && styles.listPreferredPill
              ]}>
                <Text style={styles.listPillText}>🎧 DUB</Text>
              </View>
            )}
          </View>
          
          {/* Date */}
          {formattedDate && (
            <Text style={[styles.listDateText, { color: currentTheme.colors.textSecondary }]}>
              Aired: {formattedDate}
            </Text>
          )}
        </View>
        
        {/* Watch Button */}
        <TouchableOpacity 
          style={[
            styles.listWatchButton, 
            isWatched && styles.listRewatchButton,
            !audioAvailable && styles.listUnavailableButton
          ]} 
          onPress={handlePress}
        >
          <FontAwesome5 
            name={!audioAvailable ? "exclamation-triangle" : isWatched ? "redo" : "play"} 
            size={12} 
            color="#FFFFFF" 
            style={{ marginRight: 6 }}
          />
          <Text style={styles.listWatchButtonText}>
            {!audioAvailable 
              ? "Unavailable" 
              : `${isWatched ? "Rewatch" : "Watch"} (${preferredAudioType === 'sub' ? 'Subbed' : 'Dubbed'})`
            }
          </Text>
        </TouchableOpacity>
        
        {/* Progress Bar */}
        {episodeProgress && episodeProgress.percentage > 0 && !isWatched && (
          <View style={styles.progressContainer}>
            <View style={styles.progressBarBackground}>
              <View 
                style={[
                  styles.progressBarFill, 
                  { width: `${episodeProgress.percentage}%` }
                ]} 
              />
            </View>
            <Text style={[styles.progressText, { color: currentTheme.colors.textSecondary }]}>
              {Math.floor(episodeProgress.timestamp / 60)}:{Math.floor(episodeProgress.timestamp % 60).toString().padStart(2, '0')} / {Math.floor(episodeProgress.duration / 60)}:{Math.floor(episodeProgress.duration % 60).toString().padStart(2, '0')}
            </Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.episode.id === nextProps.episode.id &&
    prevProps.episode.number === nextProps.episode.number &&
    prevProps.currentProgress === nextProps.currentProgress &&
    prevProps.isVisible === nextProps.isVisible &&
    prevProps.index === nextProps.index &&
    prevProps.preferredAudioType === nextProps.preferredAudioType &&
    prevProps.episode.isSubbed === nextProps.episode.isSubbed &&
    prevProps.episode.isDubbed === nextProps.episode.isDubbed
  );
});

// Main EpisodeList Component
const EpisodeList: React.FC<EpisodeListProps> = ({ episodes, loading, animeTitle, anilistId, malId, coverImage, mangaTitle }) => {
    const { currentTheme, isDarkMode } = useTheme();
    const router = useRouter();
    const { width } = useWindowDimensions();
    const sourceSettings = useSourceSettings();
    
    // State for UI
    const [modalVisible, setModalVisible] = useState(false);
    const [selectedEpisode, setSelectedEpisode] = useState<Episode | null>(null);
    const [currentProgress, setCurrentProgress] = useState(0);
    const [notificationsEnabled, setNotificationsEnabled] = useState(false);
    const [isNewestFirst, setIsNewestFirst] = useState(false);
    const [columnCount, setColumnCount] = useState(width > 600 ? 2 : 1);
    const [showCorrectAnimeModal, setShowCorrectAnimeModal] = useState(false);
    const [currentAnimeTitle, setCurrentAnimeTitle] = useState(animeTitle);
    const [preferredAudioType, setPreferredAudioType] = useState<'sub' | 'dub'>(sourceSettings.preferredType);
    const [showProviderDropdown, setShowProviderDropdown] = useState(false);
    const [currentProvider, setCurrentProvider] = useState<'animepahe' | 'zoro'>(sourceSettings.defaultProvider);
    const [isBackgroundRefreshing, setIsBackgroundRefreshing] = useState(false);
    const [airingSchedule, setAiringSchedule] = useState<AiringSchedule>({});
    const [episodeRanges, setEpisodeRanges] = useState<Record<string, Episode[]>>({});
    const [activeTab, setActiveTab] = useState('1-12');
    const [episodeProgressMap, setEpisodeProgressMap] = useState<Record<string, EpisodeProgress>>({});
    
    // NEW: State for season switching
    const [availableSeasons, setAvailableSeasons] = useState<Season[]>([]);
    const [currentSeason, setCurrentSeason] = useState<Season | null>(null);
    const [showSeasonDropdown, setShowSeasonDropdown] = useState(false);
    const [seasonsLoading, setSeasonsLoading] = useState(false);
    const [seasonsCache, setSeasonsCache] = useState<Record<string, Season[]>>({});
    
    // NEW: State for provider-specific episodes
    const [providerEpisodes, setProviderEpisodes] = useState<Episode[]>([]);
    const [providerLoading, setProviderLoading] = useState(false);
    const [providerError, setProviderError] = useState<string | null>(null);
    const [animePaheAnimeId, setAnimePaheAnimeId] = useState<string | null>(null);
    
    // Refs for optimization
    const flashListRef = useRef<any>(null);
    const lastRefreshTime = useRef(0);
    
    // Memory management
    useEffect(() => {
        return () => {
            MemoryManager.clearCache();
        };
    }, []);

    // NEW: Function to fetch related seasons
    const fetchRelatedSeasonsData = useCallback(async (anilistId: string, animeTitle: string) => {
        console.log(`\n🔄 [EPISODE_LIST] SEASONS FETCH START ===================`);
        console.log(`[EPISODE_LIST] 🔄 Fetching seasons for:`, { anilistId, animeTitle });
        
        // Check cache first
        const cacheKey = `${anilistId}_${animeTitle}`;
        if (seasonsCache[cacheKey]) {
            console.log(`[EPISODE_LIST] 📦 Using cached seasons for ${animeTitle}`);
            setAvailableSeasons(seasonsCache[cacheKey]);
            return seasonsCache[cacheKey];
        }
        
        setSeasonsLoading(true);
        
        try {
            // Fetch related seasons using AniList API
            const seasons = await fetchRelatedSeasons(anilistId, animeTitle);
            
            console.log(`[EPISODE_LIST] ✅ Fetched ${seasons.length} seasons:`, 
                seasons.map(s => ({
                    id: s.id,
                    title: s.title.userPreferred || s.title.romaji,
                    year: s.startDate?.year,
                    episodes: s.episodes
                }))
            );
            
            setAvailableSeasons(seasons);
            
            // Cache the results
            setSeasonsCache(prev => ({
                ...prev,
                [cacheKey]: seasons
            }));
            
            // Set current season if not already set
            if (!currentSeason) {
                const currentSeasonData = seasons.find(s => s.id === anilistId) || seasons[0];
                setCurrentSeason(currentSeasonData);
                console.log(`[EPISODE_LIST] 🎯 Set current season:`, currentSeasonData?.title.userPreferred);
            }
            
            console.log(`🔄 [EPISODE_LIST] SEASONS FETCH END ===================\n`);
            return seasons;
            
        } catch (error) {
            console.error(`[EPISODE_LIST] ❌ Error fetching seasons:`, error);
            setAvailableSeasons([]);
            return [];
        } finally {
            setSeasonsLoading(false);
        }
    }, [anilistId, seasonsCache, currentSeason]);

    // NEW: Function to fetch episodes from selected provider
    const fetchEpisodesFromProvider = useCallback(async (provider: 'animepahe' | 'zoro') => {
        console.log(`\n🔄 [EPISODE_LIST] PROVIDER EPISODE FETCH START ===================`);
        console.log(`[EPISODE_LIST] 🔄 Fetching episodes from provider: ${provider}`);
        
        // Use current season's title if available, otherwise use the current anime title (which may have been updated by CorrectAnimeSearchModal)
        // This ensures that the season switcher and correct anime search work independently
        const titleToUse = currentSeason?.title.userPreferred || currentSeason?.title.romaji || currentAnimeTitle || animeTitle;
        const anilistIdToUse = currentSeason?.id || anilistId;
        
        console.log(`[EPISODE_LIST] 📊 Context:`, {
            originalTitle: animeTitle,
            currentAnimeTitle,
            currentSeasonTitle: currentSeason?.title.userPreferred,
            titleToUse,
            originalAnilistId: anilistId,
            currentSeasonId: anilistIdToUse,
            provider,
            hasCurrentSeason: !!currentSeason
        });
        
        setProviderLoading(true);
        setProviderError(null);
        
        try {
            let fetchedEpisodes: Episode[] = [];
            
            if (provider === 'animepahe') {
                if (!titleToUse) {
                    throw new Error('Anime title is required for AnimePahe provider');
                }
                
                console.log(`[EPISODE_LIST] 🔍 [ANIMEPAHE] Step 1: Getting anime ID for: "${titleToUse}"`);
                const animeId = await animePaheProvider.getAnimeIdByTitle(titleToUse);
                
                if (!animeId) {
                    throw new Error(`Could not find AnimePahe ID for: ${titleToUse}`);
                }
                
                console.log(`[EPISODE_LIST] ✅ [ANIMEPAHE] Found anime ID: ${animeId}`);
                setAnimePaheAnimeId(animeId);
                
                console.log(`[EPISODE_LIST] 🔍 [ANIMEPAHE] Step 2: Getting episodes for anime ID: ${animeId}`);
                fetchedEpisodes = await animePaheProvider.getEpisodes(animeId);
                
                // Enhance episodes with providerIds
                fetchedEpisodes = fetchedEpisodes.map(ep => ({
                    ...ep,
                    providerIds: {
                        animepahe: animeId
                    }
                }));
                
                console.log(`[EPISODE_LIST] ✅ [ANIMEPAHE] Fetched ${fetchedEpisodes.length} episodes`);
                if (fetchedEpisodes.length > 0) {
                    console.log(`[EPISODE_LIST] 📝 [ANIMEPAHE] First few episodes:`, 
                        fetchedEpisodes.slice(0, 3).map(ep => ({
                            id: ep.id,
                            number: ep.number,
                            title: ep.title,
                            isSubbed: ep.isSubbed,
                            isDubbed: ep.isDubbed,
                            provider: ep.provider,
                            animeId: ep.providerIds?.animepahe
                        }))
                    );
                } else {
                    console.log(`[EPISODE_LIST] ❌ [ANIMEPAHE] No episodes found for anime ID: ${animeId}`);
                }
                
            } else if (provider === 'zoro') {
                if (!titleToUse) {
                    throw new Error('Anime title is required for Zoro provider');
                }
                
                const isDub = preferredAudioType === 'dub';
                console.log(`[EPISODE_LIST] 🔍 [ZORO] Getting episodes for anime title: "${titleToUse}", audio type: ${preferredAudioType.toUpperCase()}`);
                console.log(`[EPISODE_LIST] 🔄 [ZORO] Using new reliable search+info method (instead of AniList meta)`);
                fetchedEpisodes = await zoroProvider.getEpisodes(titleToUse, isDub);
                
                console.log(`[EPISODE_LIST] ✅ [ZORO] Fetched ${fetchedEpisodes.length} episodes using search+info method`);
                if (fetchedEpisodes.length > 0) {
                    console.log(`[EPISODE_LIST] 📝 [ZORO] First few episodes:`, 
                        fetchedEpisodes.slice(0, 3).map(ep => ({
                            id: ep.id,
                            number: ep.number,
                            title: ep.title,
                            isSubbed: ep.isSubbed,
                            isDubbed: ep.isDubbed,
                            provider: ep.provider
                        }))
                    );
                } else {
                    console.log(`[EPISODE_LIST] ❌ [ZORO] No episodes found for anime title: "${titleToUse}"`);
                }
            }
            
            console.log(`[EPISODE_LIST] 📊 Provider episode fetch summary:`, {
                provider,
                episodesCount: fetchedEpisodes.length,
                hasEpisodes: fetchedEpisodes.length > 0,
                allSubbed: fetchedEpisodes.every(ep => ep.isSubbed),
                anyDubbed: fetchedEpisodes.some(ep => ep.isDubbed),
                sampleEpisode: fetchedEpisodes[0] ? {
                    id: fetchedEpisodes[0].id,
                    number: fetchedEpisodes[0].number,
                    title: fetchedEpisodes[0].title,
                    isSubbed: fetchedEpisodes[0].isSubbed,
                    isDubbed: fetchedEpisodes[0].isDubbed,
                    provider: fetchedEpisodes[0].provider
                } : null
            });
            
            setProviderEpisodes(fetchedEpisodes);
            
            console.log(`🔄 [EPISODE_LIST] PROVIDER EPISODE FETCH END ===================\n`);
            
        } catch (error) {
            console.log(`🔄 [EPISODE_LIST] PROVIDER EPISODE FETCH ERROR ===================`);
            console.error(`[EPISODE_LIST] ❌ Error fetching episodes from ${provider}:`, {
                errorMessage: (error as any)?.message,
                errorCode: (error as any)?.code,
                httpStatus: (error as any)?.response?.status,
                titleUsed: titleToUse,
                anilistIdUsed: anilistIdToUse,
                stack: (error as any)?.stack?.split('\n').slice(0, 3).join('\n')
            });
            console.log(`🔄 [EPISODE_LIST] PROVIDER EPISODE FETCH ERROR END ===================\n`);
            
            // More specific error messages
            let errorMessage = `Failed to fetch episodes from ${provider}`;
            if ((error as any)?.response?.status === 404) {
                errorMessage = `Season not found on ${getProviderName(provider)}. Try switching to ${getProviderName(provider === 'animepahe' ? 'zoro' : 'animepahe')} provider.`;
            } else if ((error as any)?.code === 'ERR_NETWORK') {
                errorMessage = `Network error. Please check your connection and try again.`;
            } else if ((error as any)?.message) {
                errorMessage = `${getProviderName(provider)} error: ${(error as any).message}`;
            }
            
            setProviderError(errorMessage);
            setProviderEpisodes([]);
        } finally {
            setProviderLoading(false);
        }
    }, [animeTitle, anilistId, currentSeason, currentAnimeTitle, preferredAudioType]);

    // NEW: Effect to fetch seasons when component mounts
    useEffect(() => {
        if (anilistId && animeTitle) {
            fetchRelatedSeasonsData(anilistId, animeTitle);
        }
    }, [anilistId, animeTitle, fetchRelatedSeasonsData]);

    // NEW: Effect to fetch episodes when provider changes
    useEffect(() => {
        console.log(`[EPISODE_LIST] 🔄 Provider changed to: ${currentProvider}`);
        if (currentProvider && (currentProvider !== sourceSettings.defaultProvider || providerEpisodes.length === 0)) {
            console.log(`[EPISODE_LIST] 🚀 Triggering episode fetch for provider: ${currentProvider}`);
            fetchEpisodesFromProvider(currentProvider);
        }
    }, [currentProvider, fetchEpisodesFromProvider]);

    // NEW: Effect to refetch episodes when audio type changes for Zoro provider
    useEffect(() => {
        if (currentProvider === 'zoro' && providerEpisodes.length > 0) {
            console.log(`[EPISODE_LIST] 🔄 Audio type changed to: ${preferredAudioType} for Zoro provider`);
            console.log(`[EPISODE_LIST] 🚀 Refetching Zoro episodes for ${preferredAudioType.toUpperCase()}`);
            fetchEpisodesFromProvider(currentProvider);
        }
    }, [preferredAudioType, currentProvider, fetchEpisodesFromProvider]);

    // Audio type availability check - use provider episodes if available, otherwise use props episodes
    const episodesToCheck = providerEpisodes.length > 0 ? providerEpisodes : episodes;
    const audioTypeAvailability = useMemo(() => {
        // For Zoro provider, assume both sub and dub are available since HiAnime supports both
        if (currentProvider === 'zoro') {
            console.log(`[EPISODE_LIST] 🔊 Audio availability check (Zoro):`, {
                provider: currentProvider,
                episodeSource: providerEpisodes.length > 0 ? 'provider' : 'props',
                episodeCount: episodesToCheck.length,
                assumingBothAvailable: true,
                reason: 'HiAnime/Zoro supports both SUB and DUB'
            });
            return { sub: true, dub: true };
        }
        
        const hasSubbed = episodesToCheck.some(ep => ep.isSubbed === true);
        const hasDubbed = episodesToCheck.some(ep => ep.isDubbed === true);
        
        console.log(`[EPISODE_LIST] 🔊 Audio availability check:`, {
            provider: currentProvider,
            episodeSource: providerEpisodes.length > 0 ? 'provider' : 'props',
            episodeCount: episodesToCheck.length,
            hasSubbed,
            hasDubbed,
            sampleEpisode: episodesToCheck[0] ? {
                isSubbed: episodesToCheck[0].isSubbed,
                isDubbed: episodesToCheck[0].isDubbed,
                provider: episodesToCheck[0].provider
            } : null
        });
        
        return { sub: hasSubbed, dub: hasDubbed };
    }, [episodesToCheck, currentProvider, providerEpisodes.length]);

    const canToggle = audioTypeAvailability.sub && audioTypeAvailability.dub;

    // Episode processing and sorting - use provider episodes if available
    const episodesToProcess = providerEpisodes.length > 0 ? providerEpisodes : episodes;
    const processedEpisodes = useMemo(() => {
        if (!episodesToProcess || episodesToProcess.length === 0) return [];
        
        console.log(`[EPISODE_LIST] 📋 Processing episodes:`, {
            source: providerEpisodes.length > 0 ? 'provider' : 'props',
            count: episodesToProcess.length,
            isNewestFirst,
            currentProvider,
            preferredAudioType
        });
        
        // Apply audio preference filtering only for Zoro provider
        let filteredEpisodes = episodesToProcess;
        if (currentProvider === 'zoro') {
            console.log(`[EPISODE_LIST] 🔊 Applying Zoro audio filtering for ${preferredAudioType.toUpperCase()}...`);
            
            const prefersDub = preferredAudioType === 'dub';
            const matchesAudioType = (ep: Episode) => {
                // Handle undefined values with defaults
                const isSubbed = ep.isSubbed ?? true; // assume subbed if undefined
                const isDubbed = ep.isDubbed ?? false; // assume not dubbed if undefined
                
                return prefersDub ? isDubbed === true : isSubbed === true;
            };
            
            const matchingEpisodes = episodesToProcess.filter(matchesAudioType);
            
            console.log(`[EPISODE_LIST] 📊 Zoro filtering results:`, {
                originalCount: episodesToProcess.length,
                matchingCount: matchingEpisodes.length,
                preferredType: preferredAudioType,
                removedCount: episodesToProcess.length - matchingEpisodes.length,
                willFallback: matchingEpisodes.length === 0
            });
            
            // Use matching episodes if found, otherwise fallback to all episodes
            if (matchingEpisodes.length > 0) {
                filteredEpisodes = matchingEpisodes;
                console.log(`[EPISODE_LIST] ✅ Using ${matchingEpisodes.length} episodes matching ${preferredAudioType.toUpperCase()} preference`);
            } else {
                console.warn(`[EPISODE_LIST] ⚠️ No episodes found matching ${preferredAudioType.toUpperCase()}. Using fallback (showing all episodes).`);
                filteredEpisodes = episodesToProcess;
            }
            
            // Add matchesPreference flag for UI purposes
            filteredEpisodes = filteredEpisodes.map(ep => ({
                ...ep,
                matchesPreference: matchesAudioType(ep)
            }));
            
            // Log sample of final episodes with preference flags
            if (filteredEpisodes.length > 0) {
                console.log(`[EPISODE_LIST] 📝 Sample final episodes with preference flags:`, 
                    filteredEpisodes.slice(0, 3).map(ep => ({
                        number: ep.number,
                        title: ep.title,
                        isSubbed: ep.isSubbed ?? true,
                        isDubbed: ep.isDubbed ?? false,
                        matchesPreference: (ep as any).matchesPreference,
                        preferredType: preferredAudioType
                    }))
                );
                
                const matchingCount = filteredEpisodes.filter(ep => (ep as any).matchesPreference).length;
                const nonMatchingCount = filteredEpisodes.length - matchingCount;
                console.log(`[EPISODE_LIST] 📊 Final preference breakdown: ${matchingCount} matching, ${nonMatchingCount} non-matching (${preferredAudioType.toUpperCase()} preference)`);
            }
        } else {
            console.log(`[EPISODE_LIST] ℹ️ Skipping audio filtering for ${currentProvider} provider`);
        }
        
        const sorted = [...filteredEpisodes].sort((a, b) => {
            const aNum = a.number ?? 0;
            const bNum = b.number ?? 0;
            return isNewestFirst ? bNum - aNum : aNum - bNum;
        });
        
        return sorted;
    }, [episodesToProcess, isNewestFirst, providerEpisodes.length, currentProvider, preferredAudioType]);

    // Episode ranges for pagination
    const createEpisodeRanges = useCallback((episodesList: Episode[]) => {
        const ranges: Record<string, Episode[]> = {};
        const totalEpisodes = episodesList.length;
        
        if (totalEpisodes <= 12) {
            ranges['All'] = episodesList;
        } else {
            // For newest first, we want to start from the highest episode number
            const rangeSize = 12;
            const numRanges = Math.ceil(totalEpisodes / rangeSize);
            
            for (let i = 0; i < numRanges; i++) {
                const start = i * rangeSize;
                const end = Math.min(start + rangeSize, totalEpisodes);
                const rangeEpisodes = episodesList.slice(start, end);
                
                // Calculate the episode numbers for the range label
                const firstEp = rangeEpisodes[0].number || 0;
                const lastEp = rangeEpisodes[rangeEpisodes.length - 1].number || 0;
                
                // Create range key based on sort order
                const rangeKey = isNewestFirst
                    ? `${Math.max(firstEp, lastEp)}-${Math.min(firstEp, lastEp)}`
                    : `${Math.min(firstEp, lastEp)}-${Math.max(firstEp, lastEp)}`;
                
                ranges[rangeKey] = rangeEpisodes;
            }
        }
        
        return ranges;
    }, [isNewestFirst]);

    useEffect(() => {
        const ranges = createEpisodeRanges(processedEpisodes);
        setEpisodeRanges(ranges);
        
        // Set active tab to first available range if current doesn't exist
        const rangeKeys = Object.keys(ranges);
        if (rangeKeys.length > 0 && !ranges[activeTab]) {
            setActiveTab(rangeKeys[0]);
        }
    }, [processedEpisodes, createEpisodeRanges, activeTab]);

    // Load episode progress - use correct episodes
    useEffect(() => {
        const episodesToUse = providerEpisodes.length > 0 ? providerEpisodes : episodes;
        
        const loadEpisodeProgress = async () => {
            if (!anilistId || episodesToUse.length === 0) return;
            
            try {
                const progressData: Record<string, EpisodeProgress> = {};
                
                for (const episode of episodesToUse.slice(0, 20)) { // Load first 20 for performance
                    // Try both key formats for compatibility
                    const keys = [
                        `episode_progress_${anilistId}_${episode.number}`,
                        `progress_anilist_${anilistId}_ep_${episode.number}`,
                    ];
                    
                    for (const key of keys) {
                        const stored = await AsyncStorage.getItem(key);
                        if (stored) {
                            const progressInfo = JSON.parse(stored);
                            // Convert to EpisodeProgress format if needed
                            if (progressInfo.timestamp !== undefined) {
                                progressData[episode.id] = {
                                    timestamp: progressInfo.timestamp,
                                    duration: progressInfo.duration || 0,
                                    percentage: progressInfo.percentage || 0,
                                };
                            }
                            break; // Use first available format
                        }
                    }
                }
                
                setEpisodeProgressMap(progressData);
                console.log('[EPISODE_LIST] 📊 Loaded progress for', Object.keys(progressData).length, 'episodes from', providerEpisodes.length > 0 ? 'provider' : 'props');
            } catch (error) {
                console.error('[EPISODE_LIST] Failed to load episode progress:', error);
            }
        };

        loadEpisodeProgress();
    }, [anilistId, episodes, providerEpisodes]);

    // Event handlers
    const handleEpisodePress = useCallback((episode: Episode) => {
        console.log(`\n🎬 [EPISODE_LIST] EPISODE PRESS ===================`);
        console.log(`[EPISODE_LIST] 🎬 User clicked episode:`, {
            number: episode.number,
            title: episode.title,
            provider: episode.provider,
            currentProvider,
            providerIds: episode.providerIds
        });
        
        // Generate the episode ID that will be passed to EpisodeSourcesModal
        let episodeId = '';
        if (currentProvider === 'zoro') {
            episodeId = episode.id;
        } else if (currentProvider === 'animepahe' && episode.providerIds?.animepahe) {
            episodeId = `${episode.providerIds.animepahe}/episode-${episode.number}`;
        } else {
            episodeId = `${anilistId}?ep=${episode.number}`;
        }
        
        console.log(`[EPISODE_LIST] 📡 Episode ID for modal: "${episodeId}"`);
        console.log(`[EPISODE_LIST] 🎯 This will be used for: https://takiapi.xyz/anime/animepahe/watch/${episodeId}`);
        console.log(`🎬 [EPISODE_LIST] EPISODE PRESS END ===================\n`);
        
        setSelectedEpisode(episode);
        setModalVisible(true);
    }, [currentProvider, anilistId]);

    const handleSourceSelect = useCallback((url: string, headers: any, episodeId: string, episodeNumber: string, subtitles?: any[], timings?: any, anilistIdParam?: string, dataKey?: string) => {
        if (!selectedEpisode) return;
        
        console.log(`\n🎬 [EPISODE_LIST] SOURCE SELECT ===================`);
        console.log(`[EPISODE_LIST] 🎬 Source selected from modal:`, {
            url: url.substring(0, 50) + '...',
            episodeId,
            episodeNumber,
            dataKey,
            hasHeaders: headers && Object.keys(headers).length > 0,
            hasSubtitles: subtitles && subtitles.length > 0,
            hasTimings: Boolean(timings)
        });
        
        router.push({
            pathname: '/player',
            params: {
                episodeId: episodeId, // Use the episodeId from the modal
                animeTitle: animeTitle,
                episodeNumber: episodeNumber, // Use the episodeNumber from the modal
                source: url, // Use the direct URL, not JSON.stringify
                anilistId: anilistIdParam || anilistId,
                malId: malId,
                dataKey: dataKey, // Pass the dataKey for stored data
            },
        });
        
        console.log(`[EPISODE_LIST] 🚀 Navigating to player with:`, {
            episodeId,
            episodeNumber,
            dataKey,
            url: url.substring(0, 50) + '...'
        });
        console.log(`🎬 [EPISODE_LIST] SOURCE SELECT END ===================\n`);
        
        setModalVisible(false);
    }, [selectedEpisode, animeTitle, anilistId, malId, router]);

    const handleAudioTypeToggle = useCallback(() => {
        if (!canToggle) return;
        const newType = preferredAudioType === 'sub' ? 'dub' : 'sub';
        setPreferredAudioType(newType);
        
        // Save to settings
        AsyncStorage.setItem('sourceSettings', JSON.stringify({
            ...sourceSettings,
            preferredType: newType
        })).catch(console.error);
    }, [preferredAudioType, canToggle, sourceSettings]);

    const handleAudioError = useCallback((episode: Episode, requestedType: 'sub' | 'dub') => {
        console.log(`[EPISODE_LIST] Audio type ${requestedType} not available for episode ${episode.number}`);
        // Could show a toast or modal here
    }, []);

    const handleSortToggle = useCallback(() => {
        setIsNewestFirst(!isNewestFirst);
        // Reset active tab to first range when sort order changes
        const ranges = createEpisodeRanges(processedEpisodes);
        const rangeKeys = Object.keys(ranges);
        if (rangeKeys.length > 0) {
            setActiveTab(rangeKeys[0]);
        }
    }, [isNewestFirst, createEpisodeRanges, processedEpisodes]);

    const handleColumnToggle = useCallback(() => {
        setColumnCount(columnCount === 1 ? 2 : 1);
    }, [columnCount]);

    const handleNotificationToggle = useCallback(async () => {
        if (!anilistId) return;
        
        const episodesToUse = providerEpisodes.length > 0 ? providerEpisodes : episodes;
        
        try {
            if (!notificationsEnabled) {
                const hasPermission = await requestNotificationPermissions();
                if (!hasPermission) return;
            }
            
            await toggleNotifications({
                id: anilistId,
                type: 'anime',
                title: animeTitle,
                lastKnownNumber: Math.max(...episodesToUse.map(ep => ep.number || 0))
            });
            
            const enabled = await isNotificationEnabled(anilistId);
            setNotificationsEnabled(enabled);
        } catch (error) {
            console.error('Failed to toggle notifications:', error);
        }
    }, [anilistId, animeTitle, episodes, providerEpisodes, notificationsEnabled]);

    const handleProviderChange = useCallback((provider: 'animepahe' | 'zoro') => {
        console.log(`[EPISODE_LIST] 🔄 User changed provider to: ${provider}`);
        
        setCurrentProvider(provider);
        setShowProviderDropdown(false);
        setIsBackgroundRefreshing(true);
        
        // Save to settings
        AsyncStorage.setItem('sourceSettings', JSON.stringify({
            ...sourceSettings,
            defaultProvider: provider
        })).catch(console.error);
        
        console.log(`[EPISODE_LIST] 🚀 Starting episode fetch for ${provider}`);
        
        // Actually fetch episodes from the new provider
        fetchEpisodesFromProvider(provider).finally(() => {
            setIsBackgroundRefreshing(false);
            console.log(`[EPISODE_LIST] ✅ Provider change complete for ${provider}`);
        });
    }, [sourceSettings, fetchEpisodesFromProvider]);

    const handleAnimeSelect = useCallback((anime: any) => {
        console.log(`[EPISODE_LIST] 🔄 User selected new anime from search:`, {
            title: anime.title,
            id: anime.id,
            currentSeasonTitle: currentSeason?.title.userPreferred,
            currentSeasonId: currentSeason?.id
        });
        
        setCurrentAnimeTitle(anime.title);
        setShowCorrectAnimeModal(false);
        
        // Clear current episodes and fetch new ones for the selected anime
        setProviderEpisodes([]);
        setProviderError(null);
        
        // Fetch episodes for the selected anime with current provider
        fetchEpisodesFromProvider(currentProvider);
    }, [currentProvider, fetchEpisodesFromProvider, currentSeason]);

    const handleSeasonChange = useCallback((season: Season) => {
        console.log(`[EPISODE_LIST] 🔄 Season changed to:`, season.title.userPreferred);
        setCurrentSeason(season);
        setShowSeasonDropdown(false);
        
        // Clear current episodes and fetch new ones for the selected season
        setProviderEpisodes([]);
        setProviderError(null);
        
        // Update anime title for the new season
        const newTitle = season.title.userPreferred || season.title.romaji || season.title.english || '';
        setCurrentAnimeTitle(newTitle);
        
        console.log(`[EPISODE_LIST] 📝 Season change details:`, {
            oldTitle: currentAnimeTitle,
            newTitle,
            seasonId: season.id,
            originalAnilistId: anilistId,
            provider: currentProvider
        });
        
        // Fetch episodes for the new season
        fetchEpisodesFromProvider(currentProvider);
    }, [currentProvider, fetchEpisodesFromProvider, currentAnimeTitle, anilistId]);

    // Render functions
    const getProviderName = useCallback((provider: string) => {
        return provider === 'animepahe' ? 'AnimePahe' : 'Zoro';
    }, []);

    const renderItem = useCallback(({ item, index }: { item: Episode; index: number }) => {
        const isVisible = true; // Could implement viewport detection here
        const episodeProgress = episodeProgressMap[item.id];
        
        if (columnCount === 1) {
            return (
                <View style={styles.cardWrapper}>
                    <OptimizedListEpisodeCard
                        episode={item}
                        onPress={handleEpisodePress}
                        currentProgress={currentProgress}
                        currentTheme={currentTheme}
                        isDarkMode={isDarkMode}
                        coverImage={coverImage}
                        index={index}
                        isVisible={isVisible}
                        preferredAudioType={preferredAudioType}
                        onAudioError={handleAudioError}
                        episodeProgress={episodeProgress}
                    />
                </View>
            );
        } else {
            return (
                <View style={styles.cardWrapper}>
                    <OptimizedGridEpisodeCard
                        episode={item}
                        onPress={handleEpisodePress}
                        currentProgress={currentProgress}
                        currentTheme={currentTheme}
                        isDarkMode={isDarkMode}
                        coverImage={coverImage}
                        index={index}
                        isVisible={isVisible}
                        preferredAudioType={preferredAudioType}
                        onAudioError={handleAudioError}
                        episodeProgress={episodeProgress}
                    />
                </View>
            );
        }
    }, [columnCount, handleEpisodePress, currentProgress, currentTheme, isDarkMode, coverImage, preferredAudioType, handleAudioError, episodeProgressMap]);

    // NEW: Unified Filter Card Component
    const renderUnifiedFilterCard = () => {
        return (
            <View style={[styles.unifiedFilterCard, { backgroundColor: currentTheme.colors.surface }]}>
                {/* Anime Title Row */}
                <View style={styles.filterRow}>
                    <View style={styles.filterSection}>
                        <Text style={[styles.filterLabel, { color: currentTheme.colors.textSecondary }]}>🎬 Anime Title</Text>
                        <TouchableOpacity 
                            style={[styles.filterDropdown, { borderColor: currentTheme.colors.border }]}
                            onPress={() => setShowCorrectAnimeModal(true)}
                        >
                            <Text style={[styles.filterDropdownText, { color: currentTheme.colors.text }]} numberOfLines={1}>
                                {currentAnimeTitle}
                            </Text>
                            <FontAwesome5 name="chevron-down" size={12} color={currentTheme.colors.textSecondary} />
                        </TouchableOpacity>
                        </View>
                </View>

                {/* Three-Column Filter Row */}
                <View style={styles.filterTripleRow}>
                    {/* Season Selector */}
                    {availableSeasons.length > 1 && (
                        <View style={styles.filterSectionSmall}>
                            <Text style={[styles.filterLabelSmall, { color: currentTheme.colors.textSecondary }]}>📺 Season</Text>
                        <TouchableOpacity
                                style={[styles.filterDropdownSmall, { borderColor: currentTheme.colors.border }]}
                            onPress={() => setShowSeasonDropdown(!showSeasonDropdown)}
                            disabled={seasonsLoading}
                        >
                                <Text style={[styles.filterDropdownTextSmall, { color: currentTheme.colors.text }]} numberOfLines={1}>
                                    {currentSeason?.startDate?.year ? `S${currentSeason.startDate.year}` : 'S1'}
                                </Text>
                            {seasonsLoading ? (
                                    <ActivityIndicator size="small" color={currentTheme.colors.textSecondary} />
                            ) : (
                                    <FontAwesome5 name="chevron-down" size={10} color={currentTheme.colors.textSecondary} />
                            )}
                        </TouchableOpacity>
                    </View>
                    )}

                    {/* Provider Selector */}
                    <View style={styles.filterSectionSmall}>
                        <Text style={[styles.filterLabelSmall, { color: currentTheme.colors.textSecondary }]}>🌐 Provider</Text>
                        <TouchableOpacity 
                            style={[styles.filterDropdownSmall, { borderColor: currentTheme.colors.border }]}
                            onPress={() => setShowProviderDropdown(!showProviderDropdown)}
                        >
                            <Text style={[styles.filterDropdownTextSmall, { color: currentTheme.colors.text }]}>
                                {getProviderName(currentProvider)}
                        </Text>
                            <FontAwesome5 name="chevron-down" size={10} color={currentTheme.colors.textSecondary} />
                        </TouchableOpacity>
                    </View>

                    {/* Audio Preference */}
                    <View style={styles.filterSectionSmall}>
                        <Text style={[styles.filterLabelSmall, { color: currentTheme.colors.textSecondary }]}>🎧 Language</Text>
                        <TouchableOpacity 
                            style={[
                                styles.filterDropdownSmall, 
                                { borderColor: currentTheme.colors.border },
                                !canToggle && styles.filterDropdownDisabled
                            ]}
                            onPress={canToggle ? handleAudioTypeToggle : undefined}
                            disabled={!canToggle}
                        >
                            <Text style={[
                                styles.filterDropdownTextSmall, 
                                { color: currentTheme.colors.text },
                                !canToggle && styles.filterDropdownTextDisabled
                            ]}>
                                {preferredAudioType.toUpperCase()}
                            </Text>
                            <FontAwesome5 name="chevron-down" size={10} color={currentTheme.colors.textSecondary} />
                        </TouchableOpacity>
                    </View>
                </View>
                
                {/* Reset/Refresh Button */}
                <View style={styles.filterActionsRow}>
                    <TouchableOpacity 
                        style={[styles.refreshButton, { backgroundColor: currentTheme.colors.primary }]}
                        onPress={() => fetchEpisodesFromProvider(currentProvider)}
                    >
                        <FontAwesome5 name="sync-alt" size={12} color="#FFFFFF" />
                        <Text style={styles.refreshButtonText}>Refresh Episodes</Text>
                    </TouchableOpacity>
                    
                    {notificationsEnabled && (
                        <View style={styles.notificationIndicator}>
                            <FontAwesome5 name="bell" size={12} color="#02A9FF" />
                            <Text style={[styles.notificationText, { color: currentTheme.colors.textSecondary }]}>
                                Notifications On
                            </Text>
                        </View>
                    )}
                </View>

                {/* Dropdowns */}
                {showSeasonDropdown && availableSeasons.length > 1 && (
                    <View style={[styles.inlineDropdown, { backgroundColor: currentTheme.colors.surface, borderColor: currentTheme.colors.border }]}>
                        <ScrollView style={styles.inlineDropdownScroll} showsVerticalScrollIndicator={false}>
                            {availableSeasons.map((season) => (
                                <TouchableOpacity
                                    key={season.id}
                                    style={[
                                        styles.inlineDropdownItem,
                                        currentSeason?.id === season.id && styles.inlineDropdownItemActive,
                                        { borderBottomColor: currentTheme.colors.border }
                                    ]}
                                    onPress={() => handleSeasonChange(season)}
                                >
                                        <Text style={[
                                        styles.inlineDropdownItemText,
                                            { color: currentTheme.colors.text },
                                        currentSeason?.id === season.id && styles.inlineDropdownItemTextActive
                                        ]} numberOfLines={1}>
                                            {season.title.userPreferred || season.title.romaji}
                                        </Text>
                                    <Text style={[styles.inlineDropdownItemMeta, { color: currentTheme.colors.textSecondary }]}>
                                        {season.startDate?.year || 'Unknown'} • {season.episodes || '?'} eps
                                        </Text>
                                    {currentSeason?.id === season.id && (
                                        <FontAwesome5 name="check" size={12} color={currentTheme.colors.primary} />
                                    )}
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                )}
                
                {showProviderDropdown && (
                    <View style={[styles.inlineDropdown, { backgroundColor: currentTheme.colors.surface, borderColor: currentTheme.colors.border }]}>
                        {(['animepahe', 'zoro'] as const).map((provider) => (
                            <TouchableOpacity
                                key={provider}
                                style={[
                                    styles.inlineDropdownItem,
                                    currentProvider === provider && styles.inlineDropdownItemActive,
                                    { borderBottomColor: currentTheme.colors.border }
                                ]}
                                onPress={() => handleProviderChange(provider)}
                            >
                                <View style={[
                                    styles.inlineProviderDot,
                                    { backgroundColor: provider === 'animepahe' ? '#4CAF50' : '#2196F3' }
                                ]} />
                                <Text style={[
                                    styles.inlineDropdownItemText,
                                    { color: currentTheme.colors.text },
                                    currentProvider === provider && styles.inlineDropdownItemTextActive
                                ]}>
                                    {getProviderName(provider)}
                                </Text>
                                {currentProvider === provider && (
                                    <FontAwesome5 name="check" size={12} color={currentTheme.colors.primary} />
                                )}
                            </TouchableOpacity>
                        ))}
                    </View>
                )}

                {/* Status Messages */}
                {isBackgroundRefreshing && (
                    <View style={styles.statusMessage}>
                        <ActivityIndicator size="small" color="#02A9FF" />
                        <Text style={[styles.statusMessageText, { color: currentTheme.colors.textSecondary }]}>
                            ✅ Switched to {getProviderName(currentProvider)} • Fetching episodes...
                        </Text>
                    </View>
                )}
            </View>
        );
    };

    // NEW: Simplified Continue Watching Banner
    const renderContinueWatchingBanner = () => {
        const episodesToUse = providerEpisodes.length > 0 ? providerEpisodes : episodes;
        const nextEpisode = episodesToUse.find((ep: Episode) => ep.number === currentProgress + 1);
        if (!nextEpisode) return null;

        return (
            <TouchableOpacity
                style={[styles.continueWatchingBanner, { backgroundColor: currentTheme.colors.surface }]}
                onPress={() => handleEpisodePress(nextEpisode)}
            >
                <View style={styles.continueWatchingContent}>
                    <View style={styles.continueWatchingThumbnail}>
                        <OptimizedImage
                            uri={nextEpisode.image || coverImage || ''}
                            width={60}
                            height={40}
                            style={styles.continueWatchingImage}
                            placeholder={PLACEHOLDER_BLUR_HASH}
                            resizeMode="cover"
                            isVisible={true}
                            priority="high"
                            reduceMemoryUsage={false}
                            index={0}
                        />
                        <View style={styles.continueWatchingPlayIcon}>
                            <FontAwesome5 name="play" size={12} color="#FFFFFF" />
                        </View>
                    </View>
                    <View style={styles.continueWatchingText}>
                        <Text style={[styles.continueWatchingTitle, { color: currentTheme.colors.text }]}>
                            ⏯️ Continue Watching: Ep {nextEpisode.number}
                        </Text>
                        <Text style={[styles.continueWatchingSubtitle, { color: currentTheme.colors.textSecondary }]} numberOfLines={1}>
                            {nextEpisode.title || `Episode ${nextEpisode.number}`}
                        </Text>
                    </View>
                    <View style={styles.continueWatchingButton}>
                        <Text style={styles.continueWatchingButtonText}>▶ Resume</Text>
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    // NEW: Swipeable Episode Range Tabs
    const renderEpisodeRangeTabs = () => {
        const rangeKeys = Object.keys(episodeRanges);
        if (rangeKeys.length <= 1) return null;

        return (
            <View style={styles.episodeRangeTabsContainer}>
                <FlatList
                    data={rangeKeys}
                    renderItem={({ item }) => (
                <TouchableOpacity
                    style={[
                                styles.episodeRangeTab,
                                activeTab === item && [styles.episodeRangeTabActive, { backgroundColor: currentTheme.colors.primary }],
                                { borderColor: currentTheme.colors.border }
                    ]}
                            onPress={() => setActiveTab(item)}
                >
                        <Text style={[
                                styles.episodeRangeTabText,
                                { color: currentTheme.colors.text },
                                activeTab === item && styles.episodeRangeTabTextActive
                        ]}>
                                {item === 'All' ? 'All Episodes' : `Episodes ${item}`}
                        </Text>
                        </TouchableOpacity>
                    )}
                    keyExtractor={(item) => item}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.episodeRangeTabsList}
                />
                        </View>
        );
    };

    // NEW: Episode Header with Controls
    const renderEpisodeHeader = () => {
        const episodesToUse = providerEpisodes.length > 0 ? providerEpisodes : episodes;
        
        return (
            <View style={styles.episodeHeader}>
                <View style={styles.episodeHeaderLeft}>
                    <Text style={[styles.episodeHeaderTitle, { color: currentTheme.colors.text }]}>
                        Episodes
                        </Text>
                    <Text style={[styles.episodeHeaderCount, { color: currentTheme.colors.textSecondary }]}>
                        {episodesToUse.length} episodes
                        </Text>
                </View>
                <View style={styles.episodeHeaderRight}>
                    <TouchableOpacity 
                        style={[styles.episodeHeaderButton, { backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)' }]} 
                        onPress={handleSortToggle}
                    >
                        <FontAwesome5 name={isNewestFirst ? "sort-numeric-down" : "sort-numeric-up"} size={14} color={currentTheme.colors.text} />
                    </TouchableOpacity>
                    <TouchableOpacity 
                        style={[styles.episodeHeaderButton, { backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)' }]} 
                        onPress={handleColumnToggle}
                    >
                        <FontAwesome5 name={columnCount === 1 ? "th-large" : "th-list"} size={14} color={currentTheme.colors.text} />
                    </TouchableOpacity>
                    <TouchableOpacity 
                        style={[
                            styles.episodeHeaderButton, 
                            notificationsEnabled && styles.episodeHeaderButtonActive,
                            { backgroundColor: notificationsEnabled ? currentTheme.colors.primary : (isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)') }
                        ]} 
                        onPress={handleNotificationToggle}
                    >
                        <FontAwesome5 name={notificationsEnabled ? "bell" : "bell-slash"} size={14} color={notificationsEnabled ? "#FFFFFF" : currentTheme.colors.text} />
                </TouchableOpacity>
                </View>
            </View>
        );
    };

    // #region Main Return
    // Show loading if either main loading or provider loading
    const isLoading = loading || providerLoading || isBackgroundRefreshing;
    const episodesToShow = providerEpisodes.length > 0 ? providerEpisodes : episodes;
    
    console.log(`[EPISODE_LIST] 🎬 Render state check:`, {
        mainLoading: loading,
        providerLoading,
        isBackgroundRefreshing,
        isLoading,
        mainEpisodesCount: episodes.length,
        providerEpisodesCount: providerEpisodes.length,
        episodesToShowCount: episodesToShow.length,
        currentProvider,
        providerError
    });
    
    if (isLoading && episodesToShow.length === 0) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={currentTheme.colors.primary} />
                <Text style={[styles.emptyText, { color: currentTheme.colors.textSecondary }]}>
                    {providerLoading ? `Loading episodes from ${getProviderName(currentProvider)}...` : 'Loading Episodes...'}
                </Text>
            </View>
        );
    }
    
    // Show provider error if exists
    if (providerError && episodesToShow.length === 0) {
        return (
            <View style={styles.emptyEpisodes}>
                <FontAwesome5 name="exclamation-triangle" size={48} color={isDarkMode ? '#ff6666' : '#ff4444'} />
                <Text style={[styles.emptyText, { color: currentTheme.colors.textSecondary }]}>
                    {providerError}
                </Text>
                <View style={styles.errorButtons}>
                    <TouchableOpacity 
                        style={[styles.headerButton, { backgroundColor: currentTheme.colors.primary, marginTop: 16 }]}
                        onPress={() => fetchEpisodesFromProvider(currentProvider)}
                    >
                        <Text style={[styles.emptyText, { color: '#FFFFFF' }]}>Retry</Text>
                    </TouchableOpacity>
                    {currentProvider === 'animepahe' && (
                        <TouchableOpacity 
                            style={[styles.headerButton, { backgroundColor: '#2196F3', marginTop: 8 }]}
                            onPress={() => handleProviderChange('zoro')}
                        >
                            <Text style={[styles.emptyText, { color: '#FFFFFF' }]}>Try Zoro</Text>
                        </TouchableOpacity>
                    )}
                    {currentProvider === 'zoro' && (
                        <TouchableOpacity 
                            style={[styles.headerButton, { backgroundColor: '#4CAF50', marginTop: 8 }]}
                            onPress={() => handleProviderChange('animepahe')}
                        >
                            <Text style={[styles.emptyText, { color: '#FFFFFF' }]}>Try AnimePahe</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </View>
        );
    }
    
    if (!isLoading && episodesToShow.length === 0) {
        return (
            <View style={styles.emptyEpisodes}>
                <FontAwesome5 name="video-slash" size={48} color={isDarkMode ? '#666' : '#ccc'} />
                <Text style={[styles.emptyText, { color: currentTheme.colors.textSecondary }]}>
                    No episodes available from {getProviderName(currentProvider)} for this series yet.
                </Text>
            </View>
        );
    }

    const activeRange = episodeRanges[activeTab] || [];

    return (
        <View style={styles.container}>
            {/* Dropdown Overlay */}
            {(showProviderDropdown || showSeasonDropdown) && (
                <TouchableOpacity 
                    style={styles.dropdownOverlay}
                    activeOpacity={1}
                    onPress={() => {
                        setShowProviderDropdown(false);
                        setShowSeasonDropdown(false);
                    }}
                />
            )}

            {/* NEW: Unified Filter Card */}
            {renderUnifiedFilterCard()}

            {/* NEW: Simplified Continue Watching Banner */}
            {renderContinueWatchingBanner()}

            {/* NEW: Swipeable Episode Range Tabs */}
            {renderEpisodeRangeTabs()}

            {/* NEW: Episode Header with Controls */}
            {renderEpisodeHeader()}

            {/* Episode List */}
            <FlashList
                ref={flashListRef}
                data={activeRange}
                renderItem={renderItem}
                keyExtractor={(item: Episode) => `episode-${item.id}`}
                numColumns={columnCount}
                key={columnCount}
                estimatedItemSize={columnCount === 1 ? 140 : 220}
                contentContainerStyle={styles.listContentContainer}
            />

            {/* Modals */}
            <EpisodeSourcesModal
                visible={modalVisible}
                episodeId={selectedEpisode ? (
                    currentProvider === 'zoro' 
                        ? selectedEpisode.id  // Use actual episode ID for Zoro (e.g., "episode$1304")
                        : currentProvider === 'animepahe' && selectedEpisode.providerIds?.animepahe
                            ? `${selectedEpisode.providerIds.animepahe}/episode-${selectedEpisode.number}`  // AnimePahe format: {anime_id}/episode-{num}
                            : `${anilistId}?ep=${selectedEpisode.number}`  // Legacy format fallback
                ) : ''}
                onClose={() => setModalVisible(false)}
                onSelectSource={handleSourceSelect}
                preferredType={preferredAudioType}
                animeTitle={animeTitle}
                anilistId={anilistId}
                malId={malId}
                mangaTitle={mangaTitle}
                currentProvider={currentProvider}
                skipTypeSelection={true}
                episodeNumber={selectedEpisode?.number}
            />

            <CorrectAnimeSearchModal
                visible={showCorrectAnimeModal}
                onClose={() => setShowCorrectAnimeModal(false)}
                onSelectAnime={handleAnimeSelect}
                initialQuery={currentAnimeTitle}
                currentProvider={currentProvider}
                onProviderChange={(provider: string) => handleProviderChange(provider as 'animepahe' | 'zoro')}
            />
        </View>
    );
    // #endregion
};

export default EpisodeList;

const styles = StyleSheet.create({
    container: { flex: 1, width: '100%' },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
          emptyEpisodes: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 40, paddingHorizontal: 20 },
      emptyText: { marginTop: 16, fontSize: 16, textAlign: 'center' },
      errorButtons: { alignItems: 'center', marginTop: 8 },
    
    // NEW: Unified Filter Card Styles
    unifiedFilterCard: {
        marginHorizontal: 16,
        marginTop: 16,
        marginBottom: 12,
        borderRadius: 16,
        padding: 20,
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 6,
        zIndex: 1000,
        position: 'relative',
    },
    filterRow: {
        marginBottom: 16,
    },
    filterSection: {
        gap: 8,
    },
    filterLabel: {
        fontSize: 12,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    filterDropdown: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderWidth: 1, 
        borderRadius: 12,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
    },
    filterDropdownText: {
        fontSize: 16,
        fontWeight: '600',
        flex: 1,
    },
    filterTripleRow: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 16,
    },
    filterSectionSmall: {
        flex: 1,
        gap: 6,
    },
    filterLabelSmall: {
        fontSize: 11, 
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 0.3,
    },
    filterDropdownSmall: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderWidth: 1,
        borderRadius: 10,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        minHeight: 40,
    },
    filterDropdownTextSmall: {
        fontSize: 13,
        fontWeight: '600',
        flex: 1,
    },
    filterDropdownDisabled: {
        opacity: 0.5,
    },
    filterDropdownTextDisabled: {
        opacity: 0.6,
    },
    filterActionsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    refreshButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 12,
        gap: 8,
    },
    refreshButtonText: {
        color: '#FFFFFF',
        fontSize: 13,
        fontWeight: '600',
    },
    notificationIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    notificationText: {
        fontSize: 12,
        fontWeight: '500',
    },
    
    // Inline Dropdown Styles
    inlineDropdown: {
        marginTop: 12,
        borderRadius: 12,
        borderWidth: 1,
        maxHeight: 200,
        elevation: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
    },
    inlineDropdownScroll: {
        maxHeight: 200,
    },
    inlineDropdownItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        gap: 12,
    },
    inlineDropdownItemActive: {
        backgroundColor: 'rgba(2, 169, 255, 0.1)',
    },
    inlineDropdownItemText: {
        fontSize: 14,
        fontWeight: '500',
        flex: 1,
    },
    inlineDropdownItemTextActive: {
        fontWeight: '600',
        color: '#02A9FF',
    },
    inlineDropdownItemMeta: {
        fontSize: 12,
        fontWeight: '400',
    },
    inlineProviderDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    statusMessage: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 12,
        gap: 8,
    },
    statusMessageText: {
        fontSize: 13,
        fontWeight: '500',
    },
    
    // NEW: Continue Watching Banner Styles
    continueWatchingBanner: {
        marginHorizontal: 16,
        marginBottom: 12,
        borderRadius: 12,
        overflow: 'hidden',
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    continueWatchingContent: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
    },
    continueWatchingThumbnail: {
        width: 60,
        height: 40,
        borderRadius: 8,
        overflow: 'hidden',
        position: 'relative',
        marginRight: 16,
    },
    continueWatchingImage: {
        width: '100%',
        height: '100%',
    },
    continueWatchingPlayIcon: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    continueWatchingText: {
        flex: 1,
    },
    continueWatchingTitle: {
        fontSize: 15,
        fontWeight: '600',
        marginBottom: 2,
    },
    continueWatchingSubtitle: {
        fontSize: 12,
        fontWeight: '400',
    },
    continueWatchingButton: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        backgroundColor: '#02A9FF',
        borderRadius: 8,
    },
    continueWatchingButtonText: {
        color: '#FFFFFF',
        fontSize: 13,
        fontWeight: '600',
    },
    
    // NEW: Episode Range Tabs Styles
    episodeRangeTabsContainer: {
        marginBottom: 12,
    },
    episodeRangeTabsList: {
        paddingHorizontal: 16,
        gap: 8,
    },
    episodeRangeTab: {
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 20,
        borderWidth: 1,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        marginRight: 8,
    },
    episodeRangeTabActive: {
        borderColor: '#02A9FF',
        shadowColor: '#02A9FF',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 4,
    },
    episodeRangeTabText: {
        fontSize: 13,
        fontWeight: '600',
    },
    episodeRangeTabTextActive: {
        color: '#FFFFFF',
    },
    
    // NEW: Episode Header Styles
    episodeHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        marginBottom: 8,
    },
    episodeHeaderLeft: {
        gap: 4,
    },
    episodeHeaderTitle: {
        fontSize: 20,
        fontWeight: '700',
    },
    episodeHeaderCount: {
        fontSize: 13,
        fontWeight: '500',
    },
    episodeHeaderRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    episodeHeaderButton: {
        padding: 10,
        borderRadius: 20,
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
    episodeHeaderButtonActive: {
        shadowColor: '#02A9FF',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 4,
    },
    
    // Existing styles with some cleanup
    dropdownOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 999,
    },
    listContentContainer: { paddingHorizontal: 10, paddingBottom: Platform.OS === 'ios' ? 100 : 90 },
    cardWrapper: { flex: 1, padding: 6 },
    
    // ... rest of existing styles remain the same ...
    // Modern Grid Card Styles
    gridEpisodeCard: { 
        backgroundColor: '#1c1c1e', 
        borderRadius: 16, 
        overflow: 'hidden', 
        shadowColor: '#000', 
        shadowOpacity: 0.4, 
        shadowRadius: 8, 
        shadowOffset: { width: 0, height: 4 }, 
        elevation: 8,
        marginBottom: 4,
    },
    gridThumbnailContainer: { width: '100%', aspectRatio: 16 / 9, position: 'relative' },
    gridEpisodeThumbnail: { width: '100%', height: '100%' },
    gridWatchedBadge: { 
        position: 'absolute', 
        top: 8, 
        right: 8, 
        backgroundColor: '#02A9FF', 
        width: 22, 
        height: 22, 
        borderRadius: 11, 
        justifyContent: 'center', 
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 4,
    },
    gridEpisodeNumberBadge: { 
        position: 'absolute', 
        bottom: 8, 
        left: 8, 
        backgroundColor: 'rgba(0, 0, 0, 0.8)', 
        paddingHorizontal: 10, 
        paddingVertical: 4, 
        borderRadius: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.3,
        shadowRadius: 2,
        elevation: 2,
    },
    gridEpisodeNumberText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
    gridEpisodeContent: { padding: 16 },
    gridEpisodeTitle: { 
        fontSize: 16, 
        fontWeight: '700', 
        lineHeight: 22,
        marginBottom: 12,
    },
    
    // New Grid Audio Pills & Meta
    gridMetaRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    gridAudioPills: {
        flexDirection: 'row',
        gap: 8,
    },
    gridAudioPill: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 2,
        elevation: 2,
    },
    gridSubPill: {
        backgroundColor: 'rgba(76, 175, 80, 0.9)',
    },
    gridDubPill: {
        backgroundColor: 'rgba(255, 152, 0, 0.9)',
    },
    gridPreferredPill: {
        opacity: 1,
        shadowOpacity: 0.4,
        elevation: 4,
        transform: [{ scale: 1.05 }],
    },
    gridPillText: {
        color: '#FFFFFF',
        fontSize: 11,
        fontWeight: '700',
    },
    gridDateText: {
        fontSize: 12,
        fontWeight: '500',
    },
    
    // Updated Grid Watch Button
    gridWatchButton: { 
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#02A9FF', 
        paddingVertical: 12, 
        paddingHorizontal: 20,
        borderRadius: 12,
        shadowColor: '#02A9FF',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 6,
        elevation: 6,
    },
    gridRewatchButton: { 
        backgroundColor: '#01579B',
        shadowColor: '#01579B',
    },
    watchedGridCard: { opacity: 0.8 },
    watchedGridThumbnail: { opacity: 0.6 },
    // Modern List Card Styles
    listEpisodeCard: { 
        flexDirection: 'row', 
        backgroundColor: '#1c1c1e', 
        borderRadius: 14, 
        padding: 12, 
        alignItems: 'flex-start',
        shadowColor: '#000',
        shadowOpacity: 0.3,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 3 },
        elevation: 4,
        marginBottom: 3,
    },
    listThumbnailContainer: { position: 'relative' },
    listEpisodeThumbnail: { width: 110, height: 75, borderRadius: 8, marginRight: 16 },
    watchedListThumbnail: { opacity: 0.6 },
    listWatchedBadge: { 
        position: 'absolute', 
        top: 6, 
        right: 20, 
        backgroundColor: '#02A9FF', 
        width: 20, 
        height: 20, 
        borderRadius: 10, 
        justifyContent: 'center', 
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.3,
        shadowRadius: 2,
        elevation: 3,
    },
    listEpisodeContent: { flex: 1, justifyContent: 'space-between' },
    listEpisodeTitle: { 
        fontSize: 16, 
        fontWeight: '700',
        lineHeight: 22,
        marginBottom: 8,
    },
    
    // New List Audio Pills & Meta
    listMetaRow: { 
        flexDirection: 'row', 
        justifyContent: 'space-between',
        alignItems: 'center', 
        marginBottom: 12,
        flexWrap: 'wrap',
    },
    listAudioPills: {
        flexDirection: 'row',
        gap: 6,
    },
    listAudioPill: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 2,
        elevation: 2,
    },
    listSubPill: {
        backgroundColor: 'rgba(76, 175, 80, 0.9)',
    },
    listDubPill: {
        backgroundColor: 'rgba(255, 152, 0, 0.9)',
    },
    listPreferredPill: {
        opacity: 1,
        shadowOpacity: 0.4,
        elevation: 3,
        transform: [{ scale: 1.03 }],
    },
    listPillText: {
        color: '#FFFFFF',
        fontSize: 10,
        fontWeight: '700',
    },
    listDateText: {
        fontSize: 12,
        fontWeight: '500',
    },
    
    // Updated List Watch Button
    listWatchButton: { 
        backgroundColor: '#02A9FF', 
        paddingHorizontal: 16, 
        paddingVertical: 10, 
        borderRadius: 10, 
        flexDirection: 'row', 
        alignItems: 'center',
        shadowColor: '#02A9FF',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 4,
    },
    listRewatchButton: { 
        backgroundColor: '#01579B',
        shadowColor: '#01579B',
    },
    listWatchButtonText: { color: '#FFFFFF', fontWeight: '600', fontSize: 13 },
    watchedListCard: { backgroundColor: '#2c2c2e' },

    // Unavailable Episode Styles
    unavailableCard: {
        opacity: 0.6,
        borderWidth: 1,
        borderColor: '#FF4444',
    },
    unavailableText: {
        opacity: 0.7,
    },
    unavailableThumbnail: {
        opacity: 0.4,
    },
    gridUnavailableBadge: {
        position: 'absolute',
        top: 6,
        right: 6,
        backgroundColor: 'rgba(255, 68, 68, 0.9)',
        width: 20,
        height: 20,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#1c1c1e',
    },
    listUnavailableBadge: {
        position: 'absolute',
        top: 4,
        right: 16,
        backgroundColor: 'rgba(255, 68, 68, 0.9)',
        width: 20,
        height: 20,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#1c1c1e',
    },
    gridEpisodeAudioType: {
        fontSize: 11,
        fontWeight: '500',
        marginTop: 2,
    },
    listEpisodeAudioType: {
        fontSize: 12,
        fontWeight: '500',
        marginRight: 8,
    },
    gridUnavailableButton: {
        backgroundColor: '#FF4444',
    },
    listUnavailableButton: {
        backgroundColor: '#FF4444',
    },
    gridWatchButtonText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '700',
        marginLeft: 4,
    },
    // Badge priority styles
    gridPreferredBadge: {
        opacity: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.3,
        shadowRadius: 2,
        elevation: 3,
    },
    gridNonPreferredBadge: {
        opacity: 0.6,
    },
    listPreferredBadge: {
        opacity: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.3,
        shadowRadius: 2,
        elevation: 3,
    },
    listNonPreferredBadge: {
        opacity: 0.6,
    },
    // Progress Bar Styles
    progressContainer: {
        marginTop: 12,
    },
    progressBarBackground: {
        height: 4,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderRadius: 2,
        overflow: 'hidden',
    },
    progressBarFill: {
        height: '100%',
        backgroundColor: '#02A9FF',
        borderRadius: 2,
    },
    progressText: {
        fontSize: 11,
        marginTop: 4,
        fontWeight: '500',
    },
    
    // Legacy styles that are still needed
    headerButton: { padding: 8, borderRadius: 20, width: 38, height: 38, justifyContent: 'center', alignItems: 'center' },
});