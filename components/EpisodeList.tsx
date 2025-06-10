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

const PLACEHOLDER_BLUR_HASH = 'L6PZfSi_.AyE_3t7t7R**0o#DgR4';

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

// #region Production-Safe Episode Card Components
const GridEpisodeCard = memo(({ episode, onPress, currentProgress, currentTheme, isDarkMode, coverImage }: {
  episode: Episode;
  onPress: (episode: Episode) => void;
  currentProgress: number;
  currentTheme: any;
  isDarkMode: boolean;
  coverImage?: string;
}) => {
  try {
    const isWatched = currentProgress >= (episode.number ?? 0);
    const safeEpisodeNumber = String(episode?.number ?? '??');
    const safeEpisodeTitle = episode?.title || `Episode ${safeEpisodeNumber}`;
    const formattedDate = safeFormatDate(episode?.aired, { month: 'short', day: 'numeric' });

    return (
      <TouchableOpacity
        style={[styles.gridEpisodeCard, { backgroundColor: isDarkMode ? 'rgba(28, 28, 30, 0.9)' : 'rgba(255, 255, 255, 0.9)' }, isWatched && styles.watchedGridCard]}
        onPress={() => onPress(episode)}
        activeOpacity={0.7}
      >
        <View style={styles.gridThumbnailContainer}>
          <Image source={{ uri: episode.image || coverImage || '' }} placeholder={PLACEHOLDER_BLUR_HASH} style={[styles.gridEpisodeThumbnail, isWatched && styles.watchedGridThumbnail]} contentFit="cover" transition={200} />
          {isWatched && <View style={styles.gridWatchedBadge}><FontAwesome5 name="check" size={8} color="#FFFFFF" /></View>}
          <View style={styles.gridEpisodeNumberBadge}><Text style={styles.gridEpisodeNumberText}>{safeEpisodeNumber}</Text></View>
          {(episode.isSubbed || episode.isDubbed) && (
            <View style={styles.gridAvailabilityContainer}>
              {episode.isSubbed && <View style={[styles.gridAvailabilityBadge, styles.gridSubBadge]}><Text style={styles.gridAvailabilityText}>SUB</Text></View>}
              {episode.isDubbed && <View style={[styles.gridAvailabilityBadge, styles.gridDubBadge]}><Text style={styles.gridAvailabilityText}>DUB</Text></View>}
            </View>
          )}
        </View>
        <View style={styles.gridEpisodeContent}>
          <Text style={[styles.gridEpisodeTitle, { color: currentTheme.colors.text }]} numberOfLines={2}>{safeEpisodeTitle}</Text>
          {formattedDate && <Text style={[styles.gridEpisodeMeta, { color: currentTheme.colors.textSecondary }]} numberOfLines={1}>{formattedDate}</Text>}
          <TouchableOpacity style={[styles.gridWatchButton, isWatched && styles.gridRewatchButton]} onPress={() => onPress(episode)}>
            <FontAwesome5 name={isWatched ? "redo" : "play"} size={10} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  } catch (error: any) {
    console.error('[CRITICAL] GridEpisodeCard render crashed.', { episode, error });
    return (
      <View style={[styles.gridEpisodeCard, { backgroundColor: 'rgba(255, 0, 0, 0.1)', borderColor: 'red', borderWidth: 1 }]}>
        <View style={{ padding: 10, alignItems: 'center', justifyContent: 'center', flex: 1 }}>
          <FontAwesome5 name="exclamation-triangle" size={24} color="red" />
          <Text style={{ color: 'red', fontWeight: 'bold', fontSize: 12, marginTop: 8, textAlign: 'center' }}>{`Error in Ep ${episode?.number ?? '??'}`}</Text>
          <Text style={{ color: 'red', fontSize: 10, marginTop: 2, textAlign: 'center' }}>{error?.message || 'Render Failed'}</Text>
        </View>
      </View>
    );
  }
});

const ListEpisodeCard = memo(({ episode, onPress, currentProgress, currentTheme, isDarkMode, coverImage }: {
  episode: Episode;
  onPress: (episode: Episode) => void;
  currentProgress: number;
  currentTheme: any;
  isDarkMode: boolean;
  coverImage?: string;
}) => {
  try {
    const isWatched = currentProgress >= (episode.number ?? 0);
    const safeEpisodeNumber = String(episode?.number ?? '??');
    const safeEpisodeTitle = episode?.title || `Episode ${safeEpisodeNumber}`;
    const safeDurationText = episode?.duration ? `${episode.duration}m` : '';
    const formattedDate = safeFormatDate(episode?.aired, { year: 'numeric', month: 'short', day: 'numeric' });
    const watchButtonText = isWatched ? "Rewatch" : "Watch";
    const progressText = isWatched ? 'Watched' : 'Not watched';

    return (
      <TouchableOpacity
        style={[styles.listEpisodeCard, { backgroundColor: isDarkMode ? 'rgba(28, 28, 30, 0.95)' : 'rgba(255, 255, 255, 0.95)' }, isWatched && styles.watchedListCard]}
        onPress={() => onPress(episode)}
        activeOpacity={0.7}
      >
        <View style={styles.listThumbnailContainer}>
          <Image source={{ uri: episode.image || coverImage || '' }} placeholder={PLACEHOLDER_BLUR_HASH} style={[styles.listEpisodeThumbnail, isWatched && styles.watchedListThumbnail]} contentFit="cover" transition={200} />
          {isWatched && <View style={styles.listWatchedBadge}><FontAwesome5 name="check" size={12} color="#FFFFFF" /></View>}
          <View style={styles.listEpisodeNumberBadge}><Text style={styles.listEpisodeNumberText}>{safeEpisodeNumber}</Text></View>
        </View>
        <View style={styles.listEpisodeContent}>
          <Text style={[styles.listEpisodeTitle, { color: currentTheme.colors.text }]} numberOfLines={2}>{safeEpisodeTitle}</Text>
          <View style={styles.listMetaRow}>
            {formattedDate && <View style={styles.listMetaItem}><FontAwesome5 name="calendar-alt" size={12} color={currentTheme.colors.textSecondary} /><Text style={[styles.listMetaText, { color: currentTheme.colors.textSecondary }]}>{formattedDate}</Text></View>}
            {!!safeDurationText && <View style={styles.listMetaItem}><FontAwesome5 name="clock" size={12} color={currentTheme.colors.textSecondary} /><Text style={[styles.listMetaText, { color: currentTheme.colors.textSecondary }]}>{safeDurationText}</Text></View>}
          </View>
          <View style={styles.listTagsContainer}>
            {episode.isFiller && <View style={[styles.listEpisodeTypeBadge, { backgroundColor: '#F44336' }]}><Text style={styles.listEpisodeTypeText}>Filler</Text></View>}
            {episode.isRecap && <View style={[styles.listEpisodeTypeBadge, { backgroundColor: '#2196F3' }]}><Text style={styles.listEpisodeTypeText}>Recap</Text></View>}
            {episode.isSubbed && <View style={[styles.listAvailabilityBadge, styles.listSubBadge]}><Text style={styles.listAvailabilityText}>SUB</Text></View>}
            {episode.isDubbed && <View style={[styles.listAvailabilityBadge, styles.listDubBadge]}><Text style={styles.listAvailabilityText}>DUB</Text></View>}
          </View>
          <View style={styles.listEpisodeFooter}>
            <View style={styles.listProgressContainer}>
              <View style={[styles.listProgressBar, { backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' }]}><View style={[styles.listProgressFill, { width: `${isWatched ? 100 : 0}%` }]} /></View>
              <Text style={[styles.listProgressText, { color: currentTheme.colors.textSecondary }]}>{progressText}</Text>
            </View>
            <TouchableOpacity style={[styles.listWatchButton, isWatched && styles.listRewatchButton]} onPress={() => onPress(episode)}>
              <FontAwesome5 name={isWatched ? "redo" : "play"} size={13} color="#FFFFFF" style={{ marginRight: 6 }} /><Text style={styles.listWatchButtonText}>{watchButtonText}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  } catch (error: any) {
    console.error('[CRITICAL] ListEpisodeCard render crashed.', { episode, error });
    return (
      <View style={[styles.listEpisodeCard, { backgroundColor: 'rgba(255, 0, 0, 0.1)', borderColor: 'red', borderWidth: 1 }]}>
        <View style={{ padding: 10, flexDirection: 'row', alignItems: 'center' }}>
          <FontAwesome5 name="exclamation-triangle" size={24} color="red" />
          <View style={{ marginLeft: 10 }}>
            <Text style={{ color: 'red', fontWeight: 'bold' }}>{`Error: Ep ${episode?.number ?? '??'}`}</Text>
            <Text style={{ color: 'red', fontSize: 12, marginTop: 4 }}>{error?.message || 'Render failed'}</Text>
          </View>
        </View>
      </View>
    );
  }
});
// #endregion

export default function EpisodeList({ episodes: initialEpisodes, loading: initialLoading, animeTitle, anilistId, malId, coverImage, mangaTitle }: EpisodeListProps) {
    // #region State and Hooks
    const { isDarkMode, currentTheme } = useTheme();
    const router = useRouter();
    
    // Load source settings
    const sourceSettings = useSourceSettings();
  
    const [episodes, setEpisodes] = useState<Episode[]>(initialEpisodes || []);
    const [isLoading, setIsLoading] = useState(initialLoading);
    const [selectedEpisode, setSelectedEpisode] = useState<Episode | null>(null);
    const [modalVisible, setModalVisible] = useState(false);
    const [activeTab, setActiveTab] = useState(0);
    const [currentProgress, setCurrentProgress] = useState(0);
    const [airingSchedule, setAiringSchedule] = useState<AiringSchedule | null>(null);
    const [timeUntilAiring, setTimeUntilAiring] = useState<string>('');
    const [notificationsEnabled, setNotificationsEnabled] = useState(false);
    const [columnCount, setColumnCount] = useState<number>(1);
    const [isNewestFirst, setIsNewestFirst] = useState(true);
    const [latestEpisodeInfo, setLatestEpisodeInfo] = useState<{ number: number; date: string; source: string; } | null>(null);

    const [isBackgroundRefreshing, setIsBackgroundRefreshing] = useState<boolean>(false);
    const [episodeRanges, setEpisodeRanges] = useState<Episode[][]>([]);
    const [hiAnimeEpisodesLoaded, setHiAnimeEpisodesLoaded] = useState<boolean>(false);
    
    // Provider and search modal state
    const [currentProvider, setCurrentProvider] = useState<string>('animepahe');
    const [showCorrectAnimeModal, setShowCorrectAnimeModal] = useState(false);
    const [currentAnimeTitle, setCurrentAnimeTitle] = useState<string>('');
    const [showProviderDropdown, setShowProviderDropdown] = useState(false);

    const flashListRef = useRef<FlashList<any>>(null);
    const fetchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    // #endregion

    // #region Data Fetching and Management Callbacks
    const fetchUserProgress = useCallback(async () => {
        if (!anilistId) return;
        try {
            const token = await SecureStore.getItemAsync(STORAGE_KEY.AUTH_TOKEN);
            if (!token) return;
            const query = `query ($mediaId: Int) { Media(id: $mediaId, type: ANIME) { mediaListEntry { progress } } }`;
            const response = await axios.post(ANILIST_GRAPHQL_ENDPOINT, { query, variables: { mediaId: parseInt(anilistId) } }, { headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } });
            const progress = response.data?.data?.Media?.mediaListEntry?.progress;
            if (typeof progress === 'number') {
                setCurrentProgress(progress);
            }
        } catch (error) {
            console.error('Error fetching user progress:', error);
        }
    }, [anilistId]);
    
    const mergeEpisodes = useCallback((jikanEpisodes: Episode[], zoroEpisodes: any[]): Episode[] => {
        const episodeMap = new Map<number, Episode>();
        jikanEpisodes.forEach(ep => episodeMap.set(ep.number, ep));
        
        let highestJikanEpisode = jikanEpisodes.reduce((max, ep) => Math.max(max, ep.number), 0);
        
        zoroEpisodes.forEach((zoroEp: any) => {
            if (zoroEp.number && !isNaN(zoroEp.number) && (!episodeMap.has(zoroEp.number) || zoroEp.number > highestJikanEpisode)) {
                episodeMap.set(zoroEp.number, {
                    id: zoroEp.id || `zoro-${zoroEp.number}`,
                    number: zoroEp.number,
                    title: zoroEp.title || `Episode ${zoroEp.number}`,
                    image: coverImage,
                    provider: 'Zoro/HiAnime'
                });
            }
        });
        
        return Array.from(episodeMap.values()).sort((a, b) => a.number - b.number);
    }, [coverImage]);

    const fetchEpisodeAvailability = useCallback(async (animeId: string): Promise<{sub: Episode[], dub: Episode[]}> => {
        try {
            const [subResult, dubResult] = await Promise.all([
                animeProviderManager.getEpisodesFromProvider('zoro', animeId, undefined, false),
                animeProviderManager.getEpisodesFromProvider('zoro', animeId, undefined, true)
            ]);
            return { 
                sub: subResult.success ? subResult.episodes : [], 
                dub: dubResult.success ? dubResult.episodes : [] 
            };
        } catch (error) {
            console.error('Error fetching episode availability:', error);
            return { sub: [], dub: [] };
        }
    }, []);

    const fetchHiAnimeEpisodes = useCallback(async () => {
        const searchTitle = mangaTitle || animeTitle;
        if (!searchTitle || !anilistId || hiAnimeEpisodesLoaded || isBackgroundRefreshing) {
            return; // Prevent multiple simultaneous fetches
        }

        setIsBackgroundRefreshing(true);
        try {
            console.log(`[EpisodeList] Fetching episodes from multiple providers for: ${searchTitle}`);
            
            // Get episodes from all available providers
            const providerResults = await animeProviderManager.getEpisodesFromAllProviders(
                anilistId, 
                animeTitle, 
                mangaTitle
            );

            console.log(`[EpisodeList] Provider results:`, providerResults.map(r => ({
                provider: r.provider,
                success: r.success,
                episodeCount: r.episodes.length,
                error: r.error
            })));

            // Merge episodes from all providers
            const newEpisodes = animeProviderManager.mergeEpisodesFromProviders(providerResults, coverImage);

            if (newEpisodes.length > 0) {
                console.log(`[EpisodeList] Merged ${newEpisodes.length} episodes from providers`);
                setEpisodes(newEpisodes);
                await saveEpisodesToCache(newEpisodes, anilistId, malId, animeTitle);
            }
            
            setHiAnimeEpisodesLoaded(true); // Always mark as loaded after attempt
        } catch (error) {
            console.error('Error fetching episodes from providers:', error);
            setHiAnimeEpisodesLoaded(true); // Mark as loaded even on error to prevent infinite retries
        } finally {
            setIsBackgroundRefreshing(false);
        }
    }, [mangaTitle, animeTitle, anilistId, malId, episodes, coverImage, hiAnimeEpisodesLoaded, isBackgroundRefreshing]);

    const fetchAiringSchedule = useCallback(async () => {
        if (!anilistId) return;
        try {
            const query = `query ($id: Int) { Media(id: $id, type: ANIME) { nextAiringEpisode { episode, airingAt, timeUntilAiring }, status } }`;
            const response = await axios.post(ANILIST_GRAPHQL_ENDPOINT, { query, variables: { id: parseInt(anilistId) } });
            const media = response.data?.data?.Media;
            if (media?.nextAiringEpisode) {
                setAiringSchedule({
                    nextEpisode: media.nextAiringEpisode.episode,
                    timeUntilAiring: media.nextAiringEpisode.timeUntilAiring,
                    status: media.status
                });
                const timeUntil = media.nextAiringEpisode.timeUntilAiring;
                if (timeUntil) {
                    const d = Math.floor(timeUntil / 86400);
                    const h = Math.floor((timeUntil % 86400) / 3600);
                    const m = Math.floor((timeUntil % 3600) / 60);
                    setTimeUntilAiring(`${d > 0 ? `${d}d ` : ''}${h > 0 ? `${h}h ` : ''}${m > 0 && d === 0 ? `${m}m` : ''}`.trim() || 'Soon');
                }
            } else {
                setAiringSchedule({ status: media?.status });
            }
        } catch (error) {
            console.error('Error fetching airing schedule:', error);
        }
    }, [anilistId]);
    // #endregion

    // #region Side Effects
    useEffect(() => {
        fetchUserProgress();
        fetchAiringSchedule();
        if (anilistId) {
            isNotificationEnabled(anilistId).then(setNotificationsEnabled);
        }
        AsyncStorage.getItem('episodeColumnCount').then(val => {
            if (val) setColumnCount(Number(val));
        });
        // Load provider settings
        AsyncStorage.getItem('animeProviderSettings').then(val => {
            if (val) {
                const settings = JSON.parse(val);
                setCurrentProvider(settings.defaultProvider || 'animepahe');
            }
        });
        // Reset HiAnime episodes loaded flag when anime changes
        setHiAnimeEpisodesLoaded(false);
        setCurrentAnimeTitle(animeTitle);
    }, [fetchUserProgress, fetchAiringSchedule, anilistId]);

    useEffect(() => {
        if (initialEpisodes && initialEpisodes.length > 0) {
            setEpisodes(initialEpisodes);
            setIsLoading(false);
            // Only fetch HiAnime episodes if we haven't loaded them yet and we have initial episodes
            if (!hiAnimeEpisodesLoaded && !isBackgroundRefreshing && !fetchTimeoutRef.current) {
                fetchTimeoutRef.current = setTimeout(() => {
                    fetchHiAnimeEpisodes();
                    fetchTimeoutRef.current = null;
                }, 1000); // Fetch supplementary sources after a delay
            }
        }
        
        // Cleanup timeout on unmount or when dependencies change
        return () => {
            if (fetchTimeoutRef.current) {
                clearTimeout(fetchTimeoutRef.current);
                fetchTimeoutRef.current = null;
            }
        };
    }, [initialEpisodes]);

    useEffect(() => {
        if (episodes && episodes.length > 0) {
            const sorted = [...episodes].sort((a, b) => isNewestFirst ? (b.number ?? 0) - (a.number ?? 0) : (a.number ?? 0) - (b.number ?? 0));
            const ranges = [];
            for (let i = 0; i < sorted.length; i += 24) {
                ranges.push(sorted.slice(i, i + 24));
            }
            setEpisodeRanges(ranges);
            if(activeTab >= ranges.length) setActiveTab(0);
        } else {
            setEpisodeRanges([]);
        }
    }, [episodes, isNewestFirst, activeTab]);
    
    useEffect(() => {
        AsyncStorage.setItem('episodeColumnCount', String(columnCount));
    }, [columnCount]);

    useEffect(() => {
        if (hiAnimeEpisodesLoaded) {
            console.log('HiAnime episodes have been loaded successfully');
        }
    }, [hiAnimeEpisodesLoaded]);
    // #endregion

    // #region Handlers & Callbacks
    const handleEpisodePress = useCallback((episode: Episode) => {
        setSelectedEpisode(episode);
        setModalVisible(true);
    }, []);

    const handleSourceSelect = useCallback((sourceUrl: string, headers: any, episodeId: string, episodeNumber: string, subtitles?: any[], timings?: any, anilistIdParam?: string, dataKey?: string) => {
        if (!selectedEpisode) return;
        router.push({
            pathname: '/player',
            params: {
                source: sourceUrl,
                episode: episodeId,
                title: animeTitle,
                episodeNumber: selectedEpisode.number.toString(),
                anilistId: anilistIdParam || anilistId || '',
                dataKey: dataKey || ''
            }
        });
        setModalVisible(false);
        setSelectedEpisode(null);
        if (currentProgress < selectedEpisode.number) {
            // syncProgress(selectedEpisode.number); // Call your progress sync function here
        }
    }, [selectedEpisode, router, animeTitle, anilistId, currentProgress]);
    
    const handleSortToggle = useCallback(() => setIsNewestFirst(prev => !prev), []);
    const handleColumnToggle = useCallback(() => setColumnCount(prev => (prev === 1 ? 2 : 1)), []);
    
    const handleNotificationToggle = useCallback(async () => {
        if (!anilistId) return;
        const hasPermission = await requestNotificationPermissions();
        if (hasPermission) {
            const item: NotificationItem = {
                id: anilistId,
                title: animeTitle,
                type: 'anime',
                lastKnownNumber: episodes.reduce((max, ep) => Math.max(max, ep.number), 0),
                anilistId: anilistId
            };
            const isEnabled = await toggleNotifications(item);
            setNotificationsEnabled(isEnabled);
        }
    }, [anilistId, animeTitle, episodes]);

    const handleProviderChange = useCallback((newProvider: string) => {
        setCurrentProvider(newProvider);
        const settings = { defaultProvider: newProvider };
        AsyncStorage.setItem('animeProviderSettings', JSON.stringify(settings));
        // Trigger re-fetch with new provider
        setHiAnimeEpisodesLoaded(false);
        fetchHiAnimeEpisodes();
    }, [fetchHiAnimeEpisodes]);

    const handleAnimeChange = useCallback(() => {
        setShowCorrectAnimeModal(true);
    }, []);

    const handleAnimeSelect = useCallback((animeId: string, poster: string, provider: string) => {
        setCurrentProvider(provider);
        setShowCorrectAnimeModal(false);
        // Here you could implement logic to switch to the selected anime
        // For now, we'll just update the provider and re-fetch
        handleProviderChange(provider);
    }, [handleProviderChange]);

    const renderItem = useCallback(({ item }: { item: Episode }) => (
        <View style={styles.cardWrapper}>
            {columnCount === 1 ? (
                <ListEpisodeCard episode={item} onPress={handleEpisodePress} currentProgress={currentProgress} currentTheme={currentTheme} isDarkMode={isDarkMode} coverImage={coverImage} />
            ) : (
                <GridEpisodeCard episode={item} onPress={handleEpisodePress} currentProgress={currentProgress} currentTheme={currentTheme} isDarkMode={isDarkMode} coverImage={coverImage} />
            )}
        </View>
    ), [columnCount, handleEpisodePress, currentProgress, currentTheme, isDarkMode, coverImage]);
    // #endregion

    // #region Production-Safe Render Functions
    const renderTabLabel = useCallback((index: number, range: Episode[]) => {
        if (!range || range.length === 0) return <Text style={[styles.rangeButtonText, activeTab === index && styles.activeRangeButtonText]}>...</Text>;
        const first = range[0]?.number;
        const last = range[range.length - 1]?.number;
        const label = (typeof first === 'number' && typeof last === 'number') ? (first === last ? String(first) : `${first}-${last}`) : `Range ${index + 1}`;
        return <Text style={[styles.rangeButtonText, activeTab === index && styles.activeRangeButtonText]} numberOfLines={1}>{label}</Text>;
    }, [activeTab]);

    const getProviderColor = (provider: string) => {
        switch (provider) {
            case 'animepahe': return '#02A9FF';
            case 'zoro': return '#4CAF50';
            case 'gogoanime': return '#FF6740';
            default: return '#02A9FF';
        }
    };

    const getProviderName = (provider: string) => {
        switch (provider) {
            case 'animepahe': return 'AnimePahe';
            case 'zoro': return 'Zoro/HiAnime';
            case 'gogoanime': return 'GogoAnime';
            default: return 'Unknown';
        }
    };

    const renderProviderChanger = () => (
        <View style={[styles.providerChanger, { backgroundColor: currentTheme.colors.surface }]}>
            <View style={styles.providerInfo}>
                <View style={styles.providerRow}>
                    <TouchableOpacity 
                        style={[styles.providerBadge, { backgroundColor: getProviderColor(currentProvider) }]}
                        onPress={() => setShowProviderDropdown(!showProviderDropdown)}
                    >
                        <Text style={styles.providerBadgeText}>{getProviderName(currentProvider)}</Text>
                        <FontAwesome5 
                            name={showProviderDropdown ? "chevron-up" : "chevron-down"} 
                            size={10} 
                            color="#fff" 
                            style={{ marginLeft: 6 }}
                        />
                    </TouchableOpacity>
                    <TouchableOpacity 
                        style={styles.changeProviderButton}
                        onPress={() => {
                            // Cycle through providers
                            const providers = ['animepahe', 'zoro', 'gogoanime'];
                            const currentIndex = providers.indexOf(currentProvider);
                            const nextProvider = providers[(currentIndex + 1) % providers.length];
                            handleProviderChange(nextProvider);
                        }}
                    >
                        <FontAwesome5 name="sync-alt" size={14} color={currentTheme.colors.text} />
                    </TouchableOpacity>
                </View>
                
                {showProviderDropdown && (
                    <View style={[styles.providerDropdown, { backgroundColor: currentTheme.colors.surface, borderColor: currentTheme.colors.border }]}>
                        {[
                            { id: 'animepahe', name: 'AnimePahe', color: '#02A9FF' },
                            { id: 'zoro', name: 'Zoro/HiAnime', color: '#4CAF50' },
                            { id: 'gogoanime', name: 'GogoAnime', color: '#FF6740' }
                        ].map((providerOption) => (
                            <TouchableOpacity
                                key={providerOption.id}
                                style={[
                                    styles.providerDropdownItem,
                                    currentProvider === providerOption.id && styles.providerDropdownItemActive,
                                    { borderBottomColor: currentTheme.colors.border }
                                ]}
                                onPress={() => {
                                    handleProviderChange(providerOption.id);
                                    setShowProviderDropdown(false);
                                }}
                            >
                                <View style={[styles.providerDropdownBadge, { backgroundColor: providerOption.color }]} />
                                <Text style={[
                                    styles.providerDropdownText, 
                                    { color: currentTheme.colors.text },
                                    currentProvider === providerOption.id && styles.providerDropdownTextActive
                                ]}>
                                    {providerOption.name}
                                </Text>
                                {currentProvider === providerOption.id && (
                                    <FontAwesome5 name="check" size={14} color={providerOption.color} />
                                )}
                            </TouchableOpacity>
                        ))}
                    </View>
                )}
                
                <TouchableOpacity 
                    style={styles.animeTitleContainer}
                    onPress={handleAnimeChange}
                >
                    <Text style={[styles.animeTitle, { color: currentTheme.colors.text }]} numberOfLines={1}>
                        {currentAnimeTitle}
                    </Text>
                    <FontAwesome5 name="edit" size={12} color={currentTheme.colors.textSecondary} />
                </TouchableOpacity>
            </View>
        </View>
    );

    const renderHeader = () => {
        const formatBannerDate = (dateInput: string | number) => safeFormatDate(String(dateInput), { month: 'short', day: 'numeric' }) || 'a recent date';
        const hasAiringInfo = airingSchedule || latestEpisodeInfo;

        return (
            <View>
                {hasAiringInfo && (
                    <View style={[styles.latestEpisodeBanner, { backgroundColor: isDarkMode ? 'rgba(2, 169, 255, 0.1)' : 'rgba(2, 169, 255, 0.05)', borderColor: '#02A9FF' }]}>
                        <View style={styles.latestEpisodeContent}>
                            <View style={styles.latestEpisodeIconContainer}><FontAwesome5 name="play-circle" size={24} color="#02A9FF" /></View>
                            <View style={styles.latestEpisodeInfo}>
                                {latestEpisodeInfo ? (
                                    <>
                                        <Text style={[styles.latestEpisodeText, { color: currentTheme.colors.text }]}>{`Latest: Ep ${latestEpisodeInfo.number} - Released ${formatBannerDate(latestEpisodeInfo.date)}`}</Text>
                                        <Text style={[styles.nextEpisodeText, { color: currentTheme.colors.textSecondary }]}>{`Source: ${latestEpisodeInfo.source}`}</Text>
                                    </>
                                ) : airingSchedule?.lastEpisode && (
                                    <Text style={[styles.latestEpisodeText, { color: currentTheme.colors.text }]}>{`Latest: Episode ${airingSchedule.lastEpisode}`}</Text>
                                )}
                                {airingSchedule?.nextEpisode && airingSchedule.status === 'RELEASING' && (
                                    <Text style={[styles.nextEpisodeText, { color: currentTheme.colors.textSecondary, marginTop: 4 }]}>{`Next: Ep ${airingSchedule.nextEpisode} - Airing in ${timeUntilAiring || 'soon'}`}</Text>
                                )}
                            </View>
                        </View>
                    </View>
                )}
                {episodeRanges.length > 1 && (
                    <FlatList horizontal data={episodeRanges} keyExtractor={(_, index) => `range-${index}`} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rangeSelector}
                        renderItem={({ item, index }) => (
                            <TouchableOpacity style={[styles.rangeButton, activeTab === index && styles.activeRangeButton]} onPress={() => setActiveTab(index)}>
                                {renderTabLabel(index, item)}
                            </TouchableOpacity>
                        )} />
                )}
            </View>
        );
    };
    // #endregion

    // #region Main Return
    if (isLoading && episodes.length === 0) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={currentTheme.colors.primary} />
                <Text style={[styles.emptyText, { color: currentTheme.colors.textSecondary }]}>Loading Episodes...</Text>
            </View>
        );
    }
    
    if (!isLoading && episodes.length === 0) {
        return (
            <View style={styles.emptyEpisodes}>
                <FontAwesome5 name="video-slash" size={48} color={isDarkMode ? '#666' : '#ccc'} />
                <Text style={[styles.emptyText, { color: currentTheme.colors.textSecondary }]}>No episodes available for this series yet.</Text>
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
            <View style={styles.headerWrapper}>
                <View style={styles.header}>
                    <Text style={[styles.titleText, { color: currentTheme.colors.text }]}>Episodes</Text>
                    <View style={styles.headerButtons}>
                        <TouchableOpacity style={[styles.headerButton, { backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)' }]} onPress={handleSortToggle}><FontAwesome5 name={isNewestFirst ? "sort-numeric-down" : "sort-numeric-up"} size={16} color={currentTheme.colors.text} /></TouchableOpacity>
                        <TouchableOpacity style={[styles.notificationButton, notificationsEnabled && styles.notificationButtonEnabled]} onPress={handleNotificationToggle}><FontAwesome5 name={notificationsEnabled ? "bell" : "bell-slash"} size={16} color={notificationsEnabled ? "#FFFFFF" : currentTheme.colors.text} /></TouchableOpacity>
                        <TouchableOpacity style={[styles.headerButton, { backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)' }]} onPress={handleColumnToggle}><FontAwesome5 name={columnCount === 1 ? "th-large" : "th-list"} size={16} color={currentTheme.colors.text} /></TouchableOpacity>
                    </View>
                </View>
                {renderHeader()}
                {isBackgroundRefreshing && <View style={styles.backgroundRefreshIndicator}><ActivityIndicator size="small" color="#02A9FF" /><Text style={styles.backgroundRefreshText}>Updating...</Text></View>}
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
                episodeId={selectedEpisode ? `${anilistId}?ep=${selectedEpisode.number}` : ''}
                animeTitle={animeTitle}
                onClose={() => setModalVisible(false)}
                onSelectSource={handleSourceSelect}
                preferredType={sourceSettings.preferredType}
                anilistId={anilistId}
                malId={malId}
                mangaTitle={mangaTitle}
            />

            <CorrectAnimeSearchModal
                visible={showCorrectAnimeModal}
                onClose={() => setShowCorrectAnimeModal(false)}
                onSelectAnime={handleAnimeSelect}
                initialQuery={currentAnimeTitle}
                currentProvider={currentProvider}
                onProviderChange={handleProviderChange}
            />
        </View>
    );
    // #endregion
}

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
    gridEpisodeCard: { backgroundColor: '#1c1c1e', borderRadius: 12, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 5, shadowOffset: { width: 0, height: 3 }, elevation: 5 },
    gridThumbnailContainer: { width: '100%', aspectRatio: 16 / 9, position: 'relative' },
    gridEpisodeThumbnail: { width: '100%', height: '100%' },
    gridWatchedBadge: { position: 'absolute', top: 6, right: 6, backgroundColor: '#02A9FF', width: 18, height: 18, borderRadius: 9, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#1c1c1e' },
    gridEpisodeNumberBadge: { position: 'absolute', bottom: 6, left: 6, backgroundColor: 'rgba(0, 0, 0, 0.7)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
    gridEpisodeNumberText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
    gridAvailabilityContainer: { position: 'absolute', top: 6, left: 6, flexDirection: 'row', gap: 4 },
    gridAvailabilityBadge: { paddingHorizontal: 5, paddingVertical: 2, borderRadius: 3 },
    gridSubBadge: { backgroundColor: 'rgba(76, 175, 80, 0.9)' },
    gridDubBadge: { backgroundColor: 'rgba(255, 152, 0, 0.9)' },
    gridAvailabilityText: { color: '#FFFFFF', fontSize: 9, fontWeight: 'bold' },
    gridEpisodeContent: { padding: 8 },
    gridEpisodeTitle: { fontSize: 13, fontWeight: '600', minHeight: 32 },
    gridEpisodeMeta: { fontSize: 11, marginTop: 4 },
    gridWatchButton: { marginTop: 8, backgroundColor: '#02A9FF', paddingVertical: 8, borderRadius: 6, alignItems: 'center' },
    gridRewatchButton: { backgroundColor: '#01579B' },
    watchedGridCard: { opacity: 0.8 },
    watchedGridThumbnail: { opacity: 0.6 },
    listEpisodeCard: { flexDirection: 'row', backgroundColor: '#1c1c1e', borderRadius: 10, padding: 8, alignItems: 'flex-start' },
    listThumbnailContainer: { position: 'relative' },
    listEpisodeThumbnail: { width: 100, height: 65, borderRadius: 6, marginRight: 12 },
    watchedListThumbnail: { opacity: 0.6 },
    listWatchedBadge: { position: 'absolute', top: 4, right: 16, backgroundColor: '#02A9FF', width: 18, height: 18, borderRadius: 9, justifyContent: 'center', alignItems: 'center' },
    listEpisodeNumberBadge: { position: 'absolute', bottom: 4, left: 4, backgroundColor: 'rgba(0, 0, 0, 0.7)', paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4 },
    listEpisodeNumberText: { color: '#FFFFFF', fontSize: 10, fontWeight: '700' },
    listEpisodeContent: { flex: 1, justifyContent: 'space-between' },
    listEpisodeTitle: { fontSize: 14, fontWeight: '600' },
    listMetaRow: { flexDirection: 'row', gap: 12, alignItems: 'center', marginTop: 4, flexWrap: 'wrap' },
    listMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    listMetaText: { fontSize: 11 },
    listTagsContainer: { flexDirection: 'row', gap: 6, marginTop: 6, flexWrap: 'wrap' },
    listEpisodeTypeBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
    listEpisodeTypeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '600' },
    listAvailabilityBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
    listSubBadge: { backgroundColor: 'rgba(76, 175, 80, 0.9)' },
    listDubBadge: { backgroundColor: 'rgba(255, 152, 0, 0.9)' },
    listAvailabilityText: { color: '#FFFFFF', fontSize: 10, fontWeight: '600' },
    listEpisodeFooter: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
    listProgressContainer: { flex: 1, marginRight: 12 },
    listProgressBar: { height: 4, backgroundColor: 'rgba(255, 255, 255, 0.1)', borderRadius: 2, overflow: 'hidden', marginBottom: 4 },
    listProgressFill: { height: '100%', backgroundColor: '#02A9FF' },
    listProgressText: { fontSize: 11 },
    listWatchButton: { backgroundColor: '#02A9FF', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 6, flexDirection: 'row', alignItems: 'center' },
    listRewatchButton: { backgroundColor: '#01579B' },
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
});