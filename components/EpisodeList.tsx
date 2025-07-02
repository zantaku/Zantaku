import React, { useState, useEffect, useCallback, useMemo, useRef, memo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList, ActivityIndicator, Platform, useWindowDimensions } from 'react-native';
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

    // NEW: Function to fetch episodes from selected provider
    const fetchEpisodesFromProvider = useCallback(async (provider: 'animepahe' | 'zoro') => {
        console.log(`\n🔄 [EPISODE_LIST] PROVIDER EPISODE FETCH START ===================`);
        console.log(`[EPISODE_LIST] 🔄 Fetching episodes from provider: ${provider}`);
        console.log(`[EPISODE_LIST] 📊 Context:`, {
            animeTitle,
            anilistId,
            malId,
            provider
        });
        
        setProviderLoading(true);
        setProviderError(null);
        
        try {
            let fetchedEpisodes: Episode[] = [];
            
            if (provider === 'animepahe') {
                if (!animeTitle) {
                    throw new Error('Anime title is required for AnimePahe provider');
                }
                
                console.log(`[EPISODE_LIST] 🔍 [ANIMEPAHE] Step 1: Getting anime ID for: "${animeTitle}"`);
                const animeId = await animePaheProvider.getAnimeIdByTitle(animeTitle);
                
                if (!animeId) {
                    throw new Error(`Could not find AnimePahe ID for: ${animeTitle}`);
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
                if (!animeTitle) {
                    throw new Error('Anime title is required for Zoro provider');
                }
                
                const isDub = preferredAudioType === 'dub';
                console.log(`[EPISODE_LIST] 🔍 [ZORO] Getting episodes for anime title: "${animeTitle}", audio type: ${preferredAudioType.toUpperCase()}`);
                console.log(`[EPISODE_LIST] 🔄 [ZORO] Using new reliable search+info method (instead of AniList meta)`);
                fetchedEpisodes = await zoroProvider.getEpisodes(animeTitle, isDub);
                
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
                    console.log(`[EPISODE_LIST] ❌ [ZORO] No episodes found for anime title: "${animeTitle}"`);
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
                stack: (error as any)?.stack?.split('\n').slice(0, 3).join('\n')
            });
            console.log(`🔄 [EPISODE_LIST] PROVIDER EPISODE FETCH ERROR END ===================\n`);
            
            setProviderError(`Failed to fetch episodes from ${provider}: ${(error as any)?.message || 'Unknown error'}`);
            setProviderEpisodes([]);
        } finally {
            setProviderLoading(false);
        }
    }, [animeTitle, anilistId]);

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
                    const key = `episode_progress_${anilistId}_${episode.number}`;
                    const stored = await AsyncStorage.getItem(key);
                    if (stored) {
                        progressData[episode.id] = JSON.parse(stored);
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
        setCurrentAnimeTitle(anime.title);
        setShowCorrectAnimeModal(false);
        // Additional logic for anime selection if needed
    }, []);

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

    const renderProviderChanger = () => {
        return (
            <View style={[styles.providerChanger, { backgroundColor: currentTheme.colors.surface }]}>
                <View style={styles.providerInfo}>
                    <View style={styles.providerRow}>
                        <View style={[styles.providerBadge, { backgroundColor: currentProvider === 'animepahe' ? '#4CAF50' : '#2196F3' }]}>
                            <Text style={styles.providerBadgeText}>
                                {getProviderName(currentProvider)}
                            </Text>
                        </View>
                        <TouchableOpacity
                            style={styles.changeProviderButton}
                            onPress={() => setShowProviderDropdown(!showProviderDropdown)}
                        >
                            <FontAwesome5 name="chevron-down" size={14} color={currentTheme.colors.text} />
                        </TouchableOpacity>
                    </View>
                    <View style={styles.animeTitleContainer}>
                        <Text style={[styles.animeTitle, { color: currentTheme.colors.text }]} numberOfLines={1}>
                            {currentAnimeTitle}
                        </Text>
                        <TouchableOpacity onPress={() => setShowCorrectAnimeModal(true)}>
                            <FontAwesome5 name="edit" size={14} color={currentTheme.colors.textSecondary} />
                        </TouchableOpacity>
                    </View>
                </View>
                
                {showProviderDropdown && (
                    <View style={[styles.providerDropdown, { backgroundColor: currentTheme.colors.surface, borderColor: currentTheme.colors.border }]}>
                        {(['animepahe', 'zoro'] as const).map((provider) => (
                            <TouchableOpacity
                                key={provider}
                                style={[
                                    styles.providerDropdownItem,
                                    currentProvider === provider && styles.providerDropdownItemActive,
                                    { borderBottomColor: currentTheme.colors.border }
                                ]}
                                onPress={() => handleProviderChange(provider)}
                            >
                                <View style={[
                                    styles.providerDropdownBadge,
                                    { backgroundColor: provider === 'animepahe' ? '#4CAF50' : '#2196F3' }
                                ]} />
                                <Text style={[
                                    styles.providerDropdownText,
                                    { color: currentTheme.colors.text },
                                    currentProvider === provider && styles.providerDropdownTextActive
                                ]}>
                                    {getProviderName(provider)}
                                </Text>
                                {currentProvider === provider && (
                                    <FontAwesome5 name="check" size={14} color={currentTheme.colors.primary} />
                                )}
                            </TouchableOpacity>
                        ))}
                    </View>
                )}
            </View>
        );
    };

    const renderHeader = () => {
        const rangeKeys = Object.keys(episodeRanges);
        if (rangeKeys.length <= 1) return null;

        return (
            <FlatList
                data={rangeKeys}
                renderItem={({ item }) => (
                    <TouchableOpacity
                        style={[
                            styles.rangeButton,
                            activeTab === item && styles.activeRangeButton
                        ]}
                        onPress={() => setActiveTab(item)}
                    >
                        <Text style={[
                            styles.rangeButtonText,
                            activeTab === item && styles.activeRangeButtonText
                        ]}>
                            {item}
                        </Text>
                    </TouchableOpacity>
                )}
                keyExtractor={(item) => item}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.rangeSelector}
            />
        );
    };

    const ContinueWatchingButton = ({ episodes, currentProgress, onPress, currentTheme, coverImage, preferredAudioType }: any) => {
        const nextEpisode = episodes.find((ep: Episode) => ep.number === currentProgress + 1);
        if (!nextEpisode) return null;

        return (
            <TouchableOpacity
                style={[styles.continueButton, { backgroundColor: currentTheme.colors.surface }]}
                onPress={() => onPress(nextEpisode)}
            >
                <View style={styles.continueButtonContent}>
                    <View style={styles.continueThumbnailContainer}>
                        <OptimizedImage
                            uri={nextEpisode.image || coverImage || ''}
                            width={80}
                            height={60}
                            style={styles.continueThumbnail}
                            placeholder={PLACEHOLDER_BLUR_HASH}
                            resizeMode="cover"
                            isVisible={true}
                            priority="high"
                            reduceMemoryUsage={false}
                            index={0}
                        />
                        <View style={styles.continueOverlay}>
                            <FontAwesome5 name="play" size={20} color="#FFFFFF" />
                        </View>
                    </View>
                    <View style={styles.continueTextContainer}>
                        <Text style={[styles.continueButtonText, { color: currentTheme.colors.text }]}>
                            Continue Watching
                        </Text>
                        <Text style={[styles.continueProgressText, { color: currentTheme.colors.textSecondary }]}>
                            Episode {nextEpisode.number} • {preferredAudioType === 'sub' ? 'Subbed' : 'Dubbed'}
                        </Text>
                        <Text style={[styles.continueEpisodeTitle, { color: currentTheme.colors.textSecondary }]} numberOfLines={1}>
                            {nextEpisode.title || `Episode ${nextEpisode.number}`}
                        </Text>
                    </View>
                    <FontAwesome5 name="chevron-right" size={16} color={currentTheme.colors.textSecondary} style={styles.continueArrow} />
                </View>
            </TouchableOpacity>
        );
    };

    const AudioTypeToggle = () => {
        return (
            <View style={styles.audioToggleContainer}>
                <TouchableOpacity
                    style={[
                        styles.audioToggleButton,
                        !canToggle && styles.audioToggleDisabled,
                        { backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)' }
                    ]}
                    onPress={canToggle ? handleAudioTypeToggle : undefined}
                    disabled={!canToggle}
                >
                    <View style={styles.audioToggleContent}>
                        <Text style={[
                            styles.audioToggleText,
                            preferredAudioType === 'sub' && styles.audioToggleTextActive,
                            !audioTypeAvailability.sub && styles.audioToggleTextDisabled,
                            { color: currentTheme.colors.text }
                        ]}>
                            SUB
                        </Text>
                        <View style={[
                            styles.audioToggleSwitch,
                            preferredAudioType === 'dub' && styles.audioToggleSwitchDub,
                            !canToggle && styles.audioToggleSwitchDisabled
                        ]}>
                            <View style={[
                                styles.audioToggleSwitchThumb,
                                preferredAudioType === 'dub' && styles.audioToggleSwitchThumbDub
                            ]} />
                        </View>
                        <Text style={[
                            styles.audioToggleText,
                            preferredAudioType === 'dub' && styles.audioToggleTextActive,
                            !audioTypeAvailability.dub && styles.audioToggleTextDisabled,
                            { color: currentTheme.colors.text }
                        ]}>
                            DUB
                        </Text>
                    </View>
                    {!audioTypeAvailability.dub && (
                        <Text style={[styles.audioToggleHint, { color: currentTheme.colors.textSecondary }]}>
                            SUB only
                        </Text>
                    )}
                </TouchableOpacity>
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
                <TouchableOpacity 
                    style={[styles.headerButton, { backgroundColor: currentTheme.colors.primary, marginTop: 16 }]}
                    onPress={() => fetchEpisodesFromProvider(currentProvider)}
                >
                    <Text style={[styles.emptyText, { color: '#FFFFFF' }]}>Retry</Text>
                </TouchableOpacity>
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
            {showProviderDropdown && (
                <TouchableOpacity 
                    style={styles.dropdownOverlay}
                    activeOpacity={1}
                    onPress={() => setShowProviderDropdown(false)}
                />
            )}
            {renderProviderChanger()}
            <ContinueWatchingButton 
                episodes={episodesToShow}
                currentProgress={currentProgress}
                onPress={handleEpisodePress}
                currentTheme={currentTheme}
                coverImage={coverImage}
                preferredAudioType={preferredAudioType}
            />
            <View style={styles.headerWrapper}>
                <View style={styles.header}>
                    <Text style={[styles.titleText, { color: currentTheme.colors.text }]}>Episodes</Text>
                    <View style={styles.headerButtons}>
                        <AudioTypeToggle />
                        <TouchableOpacity style={[styles.headerButton, { backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)' }]} onPress={handleSortToggle}>
                            <FontAwesome5 name={isNewestFirst ? "sort-numeric-down" : "sort-numeric-up"} size={16} color={currentTheme.colors.text} />
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.notificationButton, notificationsEnabled && styles.notificationButtonEnabled]} onPress={handleNotificationToggle}>
                            <FontAwesome5 name={notificationsEnabled ? "bell" : "bell-slash"} size={16} color={notificationsEnabled ? "#FFFFFF" : currentTheme.colors.text} />
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.headerButton, { backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)' }]} onPress={handleColumnToggle}>
                            <FontAwesome5 name={columnCount === 1 ? "th-large" : "th-list"} size={16} color={currentTheme.colors.text} />
                        </TouchableOpacity>
                    </View>
                </View>
                {renderHeader()}
                {isBackgroundRefreshing && (
                    <View style={styles.backgroundRefreshIndicator}>
                        <ActivityIndicator size="small" color="#02A9FF" />
                        <Text style={styles.backgroundRefreshText}>Updating from {getProviderName(currentProvider)}...</Text>
                    </View>
                )}
            </View>

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
    headerWrapper: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8 },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
    titleText: { fontSize: 20, fontWeight: '700' },
    headerButtons: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    headerButton: { padding: 8, borderRadius: 20, width: 38, height: 38, justifyContent: 'center', alignItems: 'center' },
    notificationButton: { padding: 8, borderRadius: 20, backgroundColor: 'rgba(128, 128, 128, 0.2)', width: 38, height: 38, justifyContent: 'center', alignItems: 'center' },
    notificationButtonEnabled: { backgroundColor: '#02A9FF' },
    latestEpisodeBanner: { marginBottom: 12, borderRadius: 12, borderWidth: 1, overflow: 'hidden' },
    latestEpisodeContent: { flexDirection: 'row', alignItems: 'center', padding: 12 },
    latestEpisodeIconContainer: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(2, 169, 255, 0.1)', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
    latestEpisodeInfo: { flex: 1 },
    latestEpisodeText: { fontSize: 15, fontWeight: '600' },
    nextEpisodeText: { fontSize: 13, marginTop: 2 },
    rangeSelector: { paddingVertical: 4, paddingHorizontal: 4 },
    rangeButton: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(128, 128, 128, 0.3)', marginHorizontal: 4, backgroundColor: 'transparent' },
    activeRangeButton: { backgroundColor: '#02A9FF', borderColor: '#02A9FF' },
    rangeButtonText: { fontWeight: '600', fontSize: 13, color: 'rgba(255, 255, 255, 0.7)' },
    activeRangeButtonText: { color: '#FFFFFF' },
    backgroundRefreshIndicator: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 4, gap: 6 },
    backgroundRefreshText: { fontSize: 12, color: '#02A9FF', fontWeight: '500' },
    listContentContainer: { paddingHorizontal: 10, paddingBottom: Platform.OS === 'ios' ? 100 : 90 },
    cardWrapper: { flex: 1, padding: 6 },
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
    
    // Provider changer styles
    providerChanger: {
        marginHorizontal: 16,
        marginBottom: 16,
        borderRadius: 12,
        padding: 16,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        zIndex: 10000,
        position: 'relative',
    },
    providerInfo: {
        gap: 12,
    },
    providerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    providerBadge: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        flexDirection: 'row',
        alignItems: 'center',
    },
    providerBadgeText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '600',
    },
    changeProviderButton: {
        padding: 8,
        borderRadius: 20,
        backgroundColor: 'rgba(128,128,128,0.2)',
        width: 36,
        height: 36,
        justifyContent: 'center',
        alignItems: 'center',
    },
    animeTitleContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 4,
    },
    animeTitle: {
        fontSize: 16,
        fontWeight: '600',
        flex: 1,
        marginRight: 8,
    },
    // Provider dropdown styles
    providerDropdown: {
        position: 'absolute',
        top: 50,
        left: 0,
        right: 0,
        borderRadius: 8,
        borderWidth: 1,
        elevation: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        zIndex: 9999,
    },
    providerDropdownItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
    },
    providerDropdownItemActive: {
        backgroundColor: 'rgba(128,128,128,0.1)',
    },
    providerDropdownBadge: {
        width: 12,
        height: 12,
        borderRadius: 6,
        marginRight: 12,
    },
    providerDropdownText: {
        fontSize: 14,
        fontWeight: '500',
        flex: 1,
    },
    providerDropdownTextActive: {
        fontWeight: '600',
    },
    dropdownOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 9998,
    },
    
    // Continue Watching Button Styles
    continueButton: {
        marginHorizontal: 16,
        marginBottom: 16,
        borderRadius: 12,
        overflow: 'hidden',
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    continueButtonContent: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
    },
    continueThumbnailContainer: {
        width: 80,
        height: 60,
        borderRadius: 8,
        overflow: 'hidden',
        position: 'relative',
        marginRight: 16,
    },
    continueThumbnail: {
        width: '100%',
        height: '100%',
    },
    continueOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    continueTextContainer: {
        flex: 1,
        justifyContent: 'center',
    },
    continueButtonText: {
        fontSize: 18,
        fontWeight: '700',
        marginBottom: 4,
    },
    continueProgressText: {
        fontSize: 14,
        marginBottom: 2,
    },
    continueEpisodeTitle: {
        fontSize: 12,
        fontStyle: 'italic',
    },
    continueArrow: {
        marginLeft: 12,
    },
    
    // Audio Type Toggle Styles
    audioToggleContainer: {
        marginRight: 8,
    },
    audioToggleButton: {
        flexDirection: 'column',
        alignItems: 'center',
        padding: 8,
        borderRadius: 20,
        minWidth: 60,
    },
    audioToggleDisabled: {
        opacity: 0.5,
    },
    audioToggleContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    audioToggleText: {
        fontSize: 11,
        fontWeight: '600',
        textAlign: 'center',
    },
    audioToggleTextActive: {
        fontWeight: '700',
        color: '#02A9FF',
    },
    audioToggleTextDisabled: {
        opacity: 0.4,
    },
    audioToggleSwitch: {
        width: 24,
        height: 12,
        borderRadius: 6,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        position: 'relative',
        marginHorizontal: 2,
    },
    audioToggleSwitchDub: {
        backgroundColor: '#02A9FF',
    },
    audioToggleSwitchDisabled: {
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
    },
    audioToggleSwitchThumb: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: '#FFFFFF',
        position: 'absolute',
        top: 1,
        left: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 2,
        elevation: 2,
    },
    audioToggleSwitchThumbDub: {
        left: 13,
    },
    audioToggleHint: {
        fontSize: 9,
        fontWeight: '500',
        marginTop: 2,
        textAlign: 'center',
    },

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
});