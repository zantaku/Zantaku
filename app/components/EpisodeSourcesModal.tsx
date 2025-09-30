import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Animated, Dimensions, TouchableWithoutFeedback, FlatList, ActivityIndicator } from 'react-native';
import { BlurView } from 'expo-blur';
import axios from 'axios';
import Reanimated, { Easing } from 'react-native-reanimated';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { FontAwesome5 } from '@expo/vector-icons';
import { ScrollView } from 'react-native';
  // Removed unused heavy imports - no fallback allowed
// Removed AnimePahe import - no fallback allowed
import { animeZoneProvider } from '../../api/animezone';
import { 
  fetchRawByAnilistId, 
  fetchFileDetailsByAccessId, 
  getCachedRaw, 
  setCachedRaw,
  getCachedFileDetails,
  setCachedFileDetails,
  maskToken,
  ZenRawItem,
  ZenFileData 
} from '../../services/zencloud';

const ReanimatedTouchableOpacity = Reanimated.createAnimatedComponent(TouchableOpacity);

// Color tokens
const COLOR = {
  primary: '#02A9FF',
  success: '#3CCB7F',
  warning: '#FFB020',
  danger: '#FF5E5E',
  backdrop: 'rgba(0,0,0,0.85)'
};

// Hook to load source settings
const useSourceSettings = (currentProvider?: string) => {
  const [sourceSettings, setSourceSettings] = useState({
    preferredType: 'sub' as 'sub' | 'dub',
    autoTryAlternateVersion: true,
    preferHLSStreams: true,
    logSourceDetails: true,
    defaultProvider: 'animepahe' as 'animepahe' | 'zoro' | 'animezone',
    autoSelectSource: true,
    providerPriority: [currentProvider || 'animezone'] as ('animepahe' | 'zoro' | 'animezone')[],
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

// Simple bottom toast for auto-select message (no loops)
const AutoSelectPill = ({ visible, message = 'Loading…' }: { visible: boolean; message?: string }) => {
  const fade = new Animated.Value(0);
  useEffect(() => {
    if (visible) {
      Animated.timing(fade, { toValue: 1, duration: 180, useNativeDriver: true }).start();
    } else {
      Animated.timing(fade, { toValue: 0, duration: 180, useNativeDriver: true }).start();
    }
  }, [visible]);
  if (!visible) return null;
  return (
    <Animated.View style={[styles.pillContainer, { opacity: fade }]}> 
      <View style={styles.pillBackground}>
        <Text style={styles.pillText}>{message}</Text>
      </View>
    </Animated.View>
  );
};

// Update the loading messages with more anime personality
const LoadingMessages = [
  "Summoning your episode...",
  "Preparing the adventure...",
  "Almost there...",
  "Loading awesome content...",
  "Charging up the next arc...",
  "Powering up! Almost at 100%...",
  "Gathering chakra...",
  "Readying your anime journey..."
];

// Removed animated particles per perf guidelines

// Minimal thin progress bar (indeterminate look without loops)
const ThinProgressBar = () => (
  <View style={{ width: '100%', height: 4, backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 2, overflow: 'hidden' }}>
    <View style={{ width: '55%', height: '100%', backgroundColor: COLOR.primary, borderRadius: 2 }} />
  </View>
);

// Deleted shimmer/indeterminate loops

// Simple loading body
const AutoLoadingMessage = ({ episodeNumber }: { episodeNumber: string }) => (
  <View style={styles.loadingSimple}>
    <Text style={styles.bodyTitle}>Fetching sources…</Text>
    <ThinProgressBar />
  </View>
);

const ANILIST_GRAPHQL_ENDPOINT = 'https://graphql.anilist.co';

interface Source {
  quality: string;
  url: string;
  type: 'sub' | 'dub';
  headers: Record<string, string>;
  isM3U8?: boolean;
  name?: string;
}

interface Subtitle {
  url: string;
  lang: string;
}

interface VideoTimings {
  intro?: { start: number; end: number; };
  outro?: { start: number; end: number; };
}

// Enhanced segmented control with availability checking
const Segmented = ({ value, onChange, disabled, episodeId, anilistId, onCheck }: { 
  value: 'sub' | 'dub', 
  onChange: (v: 'sub' | 'dub') => void, 
  disabled?: boolean,
  episodeId?: string,
  anilistId?: string,
  onCheck?: (episodeId: string, anilistId: string) => Promise<{ sub: boolean; dub: boolean }>
}) => {
  const [availability, setAvailability] = useState<{ sub: boolean; dub: boolean }>({ sub: true, dub: true });
  const [checkingAvailability, setCheckingAvailability] = useState(false);

  // Check availability when component mounts or episode changes
  useEffect(() => {
    if (episodeId && anilistId && !checkingAvailability && onCheck) {
      setCheckingAvailability(true);
      onCheck(episodeId, anilistId)
        .then(setAvailability)
        .catch(() => setAvailability({ sub: true, dub: true }))
        .finally(() => setCheckingAvailability(false));
    }
  }, [episodeId, anilistId]);

  return (
    <View style={[styles.segmented, disabled && { opacity: 0.6 }]}> 
      {(['sub','dub'] as const).map(opt => {
        const isAvailable = availability[opt];
        const isDisabled = disabled || !isAvailable;
        
        return (
          <TouchableOpacity 
            key={opt} 
            onPress={() => !isDisabled && onChange(opt)} 
            style={[
              styles.segment, 
              value === opt && styles.segmentActive,
              !isAvailable && styles.segmentUnavailable
            ]} 
            accessibilityRole="button" 
            accessibilityLabel={`Audio: ${opt==='sub'?'Sub':'Dub'}${!isAvailable ? ' (Unavailable)' : ''}`}
            disabled={isDisabled}
          >
            <Text style={[
              styles.segmentText, 
              value === opt && styles.segmentTextActive,
              !isAvailable && styles.segmentTextUnavailable
            ]}>
              {opt==='sub'?'Sub':'Dub'}
              {!isAvailable && ' ✗'}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const MetaChip = ({ label }: { label: string }) => (
  <View style={styles.metaChip}><Text style={styles.metaChipText}>{label}</Text></View>
);

type RowItem = { label: string; url: string; headers: Record<string,string>; isM3U8: boolean; note?: string };
  const SourceRow = React.memo(({ selected, item, onPress }: { selected: boolean; item: RowItem; onPress: () => void }) => (
    <TouchableOpacity onPress={onPress} style={styles.row} accessibilityRole="button" accessibilityLabel={`Play ${item.label} ${item.isM3U8 ? 'HLS' : 'MP4'}${item.note?`, ${item.note}`:''}`}>
    <View style={{ flex: 1 }}>
      <Text style={styles.rowLabel}>{item.label}</Text>
      <View style={styles.rowTags}>
        <Text style={[styles.tag, { borderColor: 'rgba(255,255,255,0.2)'}]}>{item.isM3U8 ? 'HLS' : 'MP4'}</Text>
        {item.note ? <Text style={[styles.tag, { borderColor: COLOR.primary, color: COLOR.primary }]}>{item.note}</Text> : null}
      </View>
    </View>
    <FontAwesome5 name="play" color={COLOR.primary} size={16} />
  </TouchableOpacity>
));

export default function EpisodeSourcesModal({ 
  visible, 
  episodeId, 
  onClose, 
  onSelectSource,
  preferredType = 'sub',
  animeTitle,
  malId,
  anilistId,
  autoSelectSource = false,
  mangaTitle,
  currentProvider,
  skipTypeSelection = false,
  episodeNumber
}: {
  visible: boolean;
  episodeId: string;
  onClose: () => void;
  onSelectSource: (
    url: string,
    headers: any,
    episodeId: string,
    episodeNumber: string,
    subtitles?: Subtitle[],
    timings?: VideoTimings,
    anilistId?: string,
    dataKey?: string,
    provider?: string,
    audioType?: 'sub' | 'dub'
  ) => void;
  preferredType?: 'sub' | 'dub';
  animeTitle?: string;
  malId?: string;
  anilistId?: string;
  autoSelectSource?: boolean;
  mangaTitle?: string;
  currentProvider?: string;
  skipTypeSelection?: boolean;
  episodeNumber?: number;
}) {
  // Load source settings
  const sourceSettings = useSourceSettings(currentProvider);
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [sources, setSources] = useState<Source[]>([]);
  const [type, setType] = useState<'sub' | 'dub'>(preferredType || 'sub');
  const [error, setError] = useState<string | null>(null);
  const [fadeAnim] = useState(new Animated.Value(0));
  const [scaleAnim] = useState(new Animated.Value(0.95));
  const [introStartTime, setIntroStartTime] = useState<number | null>(null);
  const [introEndTime, setIntroEndTime] = useState<number | null>(null);
  const [outroStartTime, setOutroStartTime] = useState<number | null>(null);
  const [outroEndTime, setOutroEndTime] = useState<number | null>(null);
  const [timings, setTimings] = useState<VideoTimings | null>(null);
  const [subtitles, setSubtitles] = useState<Subtitle[]>([]);
  const subtitlesRef = useRef<Subtitle[]>([]);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [showProgress, setShowProgress] = useState(false);
  const [animeId, setAnimeId] = useState('');
  const [pillVisible, setPillVisible] = useState(false);
  const [pillMessage, setPillMessage] = useState('Loading video...');
  const [showQualitySelection, setShowQualitySelection] = useState(false);
  const [availableQualities, setAvailableQualities] = useState<{
    quality: string;
    url: string;
    isDefault: boolean;
    headers: Record<string, string>;
    isZoroServer?: boolean;
  }[]>([]);
  const [serverProcessingMessage, setServerProcessingMessage] = useState<string>('');
  
  // Zencloud state
  const [zencloudLoading, setZencloudLoading] = useState(false);
  const [zencloudRaw, setZencloudRaw] = useState<ZenRawItem[] | null>(null);
  const [zencloudFile, setZencloudFile] = useState<ZenFileData | null>(null);
  const [zencloudError, setZencloudError] = useState<string | null>(null);
  
  // Convert episodeNumber to string for use in the component
  const episodeNumberStr = episodeNumber?.toString() || '';

  // Extract anime ID from the episode ID
  useEffect(() => {
    if (episodeId) {
      let animeIdMatch;
      
      console.log(`🎬 [EPISODE DETECTION] Raw episodeId: "${episodeId}"`);
      
      // Support new simplified format: {anime id}/{episode number}
      if (episodeId.includes('/')) {
        // New format: animeId/episodeNumber
        const parts = episodeId.split('/');
        animeIdMatch = parts[0];
        console.log(`🎬 [EPISODE DETECTION] Split format: animeId="${animeIdMatch}"`);
      } else if (episodeId.includes('?ep=')) {
        // Legacy format: animeId?ep=episodeNumber
        animeIdMatch = episodeId.split('?')[0];
        console.log(`🎬 [EPISODE DETECTION] Legacy format: animeId="${animeIdMatch}"`);
      } else {
        // Default fallback
        animeIdMatch = episodeId;
        console.log(`🎬 [EPISODE DETECTION] Fallback format: animeId="${animeIdMatch}"`);
      }
      
      if (animeIdMatch) {
        setAnimeId(animeIdMatch);
      }
      
      // Debug log for URL format detection
      console.log(`🎬 [EPISODE DETECTION] FINAL: episodeId="${episodeId}" => animeId="${animeIdMatch}", episodeNumber="${episodeNumberStr}"`);
    }
  }, [episodeId, episodeNumberStr]);

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 220,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        })
      ]).start();

      // Log user settings when modal is shown
      const logUserSettings = async () => {
        try {
          console.log('\n=== EPISODE SOURCES MODAL USER SETTINGS ===');
          console.log('Modal visible with preferred type:', preferredType);
          console.log('Skip type selection:', skipTypeSelection);
          console.log('Auto-selection mode:', sourceSettings.autoSelectSource ? 'ON' : 'OFF');
          
          // Source settings are now loaded via hook at component level
          console.log('Source Settings:', sourceSettings);
          
          const episodeListSettingsData = await AsyncStorage.getItem('episodeListSettings');
          if (episodeListSettingsData) {
            console.log('Episode List Settings:', JSON.parse(episodeListSettingsData));
          }
          
          const playerPreferencesData = await AsyncStorage.getItem('playerPreferences');
          if (playerPreferencesData) {
            console.log('Player Preferences:', JSON.parse(playerPreferencesData));
          }
          console.log('=== END EPISODE SOURCES MODAL USER SETTINGS ===\n');
        } catch (error) {
          console.error('Error fetching user settings:', error);
        }
      };

      logUserSettings();

      // Always fetch sources on open, but never auto-play
      setLoading(true);
      let initialType = preferredType || sourceSettings.preferredType || 'sub';
                  // For AnimePahe and Jikan, force SUB type since they don't support DUB
            if (currentProvider === 'animepahe' || currentProvider === 'jikan') {
                initialType = 'sub';
            }
            // For AnimeZone, allow both SUB and DUB since the API supports both
            // (The actual filtering happens in the provider's getWatchData method)
      setType(initialType);
      // Never show auto-select pill
      setPillVisible(false);

      // Fetch sources for the initial type
      fetchSources(episodeId, initialType);
      
      // Always fetch Zencloud data
      if (anilistId && episodeNumber) {
        console.log(`🌟 [ZENCLOUD] Modal opened, fetching Zencloud data...`);
        fetchZencloudData();
      }
    } else {
      fadeAnim.setValue(0);
      scaleAnim.setValue(0.95);
      // Hide pill when modal closes
      setPillVisible(false);
      // Reset Zencloud state when modal closes
      setZencloudRaw(null);
      setZencloudFile(null);
      setZencloudError(null);
    }
  }, [visible, skipTypeSelection, currentProvider, anilistId, episodeNumber, fetchZencloudData]);

  const formatSourceWithHeaders = (source: any, apiHeaders: any, sourceType: 'sub' | 'dub', provider?: string): Source => {
    console.log(`[FORMAT_SOURCE] 🔧 Formatting source for provider: ${provider}`);
    console.log(`[FORMAT_SOURCE] 📊 Original source:`, {
      url: source.url?.substring(0, 80) + '...',
      quality: source.quality,
      name: source.name,
      hasHeaders: !!source.headers,
      originalHeaders: source.headers
    });
    
    let headers: Record<string, string> = {};
    const urlStr: string = source.url || '';
    const isKurojiProxied = typeof urlStr === 'string' && urlStr.includes('kuroji.1ani.me/api/proxy?url=');
    
    if (isKurojiProxied) {
      // When using Kuroji proxy, don't attach third-party referers; proxy handles upstream
      headers = {};
      console.log(`[FORMAT_SOURCE] ✅ [KUROJI] Using empty headers for proxied stream`);
    } else if (provider === 'animepahe') {
      // AnimePahe: Use AnimePahe-specific headers, NO PROXY
      headers = {
        ...apiHeaders,
        Referer: 'https://animepahe.com/',
        Origin: 'https://animepahe.com',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/98.0.4758.102 Safari/537.36'
      };
      console.log(`[FORMAT_SOURCE] ✅ [ANIMEPAHE] Using direct AnimePahe headers (no proxy)`);
    } else if (provider === 'animezone') {
      // AnimeZone (HolyShit): Use minimal headers for direct streaming
      headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/98.0.4758.102 Safari/537.36'
      };
      console.log(`[FORMAT_SOURCE] ✅ [ANIMEZONE] Using minimal headers for direct streaming`);
    } else {
      // Zoro via Kuroji: trust payload; only apply headers when not already proxied
      headers = isKurojiProxied ? {} : (apiHeaders || {});
      if (isKurojiProxied) {
        console.log(`[FORMAT_SOURCE] ✅ [ZORO] Kuroji-proxied; not adding headers`);
      }
    }
    
    // For AnimeZone, use the actual source name if available, otherwise fall back to quality
    let displayQuality = source.quality || 'default';
    if (provider === 'animezone' && source.name) {
      // Extract the server name from the full name (e.g., "sam (SUB) - Japanese" -> "sam (SUB)")
      const nameMatch = source.name.match(/^([^(]+\([^)]+\))/);
      if (nameMatch) {
        displayQuality = nameMatch[1].trim();
      } else {
        displayQuality = source.name;
      }
    }
    
    const formattedSource = {
      url: source.url,
      quality: displayQuality,
      type: source.type || sourceType, // Preserve original source type if available, otherwise use sourceType
      headers: headers,
      isM3U8: source.url.includes('.m3u8') || source.isM3U8
    };
    
    console.log(`[FORMAT_SOURCE] 📊 Formatted source:`, {
      url: formattedSource.url?.substring(0, 80) + '...',
      quality: formattedSource.quality,
      originalQuality: source.quality,
      originalName: source.name,
      type: formattedSource.type,
      originalSourceType: source.type,
      sourceTypeParam: sourceType,
      isM3U8: formattedSource.isM3U8,
      provider,
      referer: (headers as any).Referer
    });
    
    return formattedSource;
  };

  // Function to fetch anime titles from AniList
  const fetchAnimeFromAniList = async (): Promise<{
    title: string;
    englishTitle?: string;
    romajiTitle?: string;
    nativeTitle?: string;
    synonyms?: string[];
  } | null> => {
    if (!anilistId) return null;
    
    try {
      console.log(`🔍 Fetching anime details from AniList ID: ${anilistId}`);
      
      const query = `
        query ($id: Int) {
          Media(id: $id, type: ANIME) {
            title {
              romaji
              english
              native
            }
            synonyms
          }
        }
      `;
      
      const response = await axios.post(
        ANILIST_GRAPHQL_ENDPOINT,
        {
          query,
          variables: {
            id: parseInt(anilistId)
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
        console.log(`✅ AniList data:`, {
          romaji: media.title.romaji,
          english: media.title.english,
          native: media.title.native,
          synonyms: media.synonyms
        });
        
        return {
          title: media.title.english || media.title.romaji || animeTitle || '',
          englishTitle: media.title.english,
          romajiTitle: media.title.romaji,
          nativeTitle: media.title.native,
          synonyms: media.synonyms || []
        };
      }
    } catch (error) {
      console.error('Error fetching from AniList:', error);
    }
    
    return null;
  };

  // Fetch OP/ED timings from AniSkip using MAL id
  const fetchAniSkipTimings = async (
    malIdValue?: string,
    episodeNum?: number
  ): Promise<VideoTimings | null> => {
    try {
      if (!malIdValue || !episodeNum || Number.isNaN(episodeNum)) {
        return null;
      }

      const mal = String(malIdValue).trim();
      const url = `https://api.aniskip.com/v2/skip-times/${encodeURIComponent(mal)}/${encodeURIComponent(
        String(episodeNum)
      )}`;

      // Build query correctly as an array: types=op&types=ed&types=mixed-op&types=mixed-ed
      const qs = new URLSearchParams();
      ['op', 'ed', 'mixed-op', 'mixed-ed'].forEach((t) => qs.append('types', t));
      // Per API docs: use 0 to get proper response without extra filtering
      qs.append('episodeLength', '0');
      const fullUrl = `${url}?${qs.toString()}`;
      console.log(`[ANISKIP] 🔎 Request → ${fullUrl}`);
      const res = await axios.get(url, {
        params: qs,
        // Ensure axios doesn't re-index arrays; we already built URLSearchParams
        paramsSerializer: {
          serialize: (p: any) => (p instanceof URLSearchParams ? p.toString() : new URLSearchParams(p).toString()),
        },
        headers: {
          accept: 'application/json',
        },
      });

      const data = res?.data;
      try {
        console.log('[ANISKIP] 🧾 Raw response JSON:', JSON.stringify(data, null, 2));
      } catch {}
      if (!data?.found || !Array.isArray(data?.results)) {
        console.log('[ANISKIP] ℹ️ No skip timings found or invalid response shape');
        return null;
      }

      // Group results
      const opItems = data.results.filter((r: any) => ['op', 'mixed-op'].includes(r?.skipType));
      const edItems = data.results.filter((r: any) => ['ed', 'mixed-ed'].includes(r?.skipType));

      const pickBestOp = (items: any[]) => {
        if (!items || items.length === 0) return undefined;
        // Prefer earliest plausible OP (usually < 3m or < 60% of episode)
        const scored = items
          .filter((r) => r?.interval && typeof r.interval.startTime === 'number' && typeof r.interval.endTime === 'number')
          .map((r) => {
            const len = Number(r.episodeLength || 0);
            const start = Number(r.interval.startTime);
            const end = Number(r.interval.endTime);
            const typicalCap = len > 0 ? Math.min(220, len * 0.6) : 220;
            const plausibility = start <= typicalCap ? 1 : 0; // 1 if plausible early
            const width = Math.max(1, end - start);
            const confidence = Number(r.confidence || 0);
            const score = plausibility * 1000 + (220 - Math.min(220, start)) + confidence - Math.min(60, width);
            return { r, score };
          })
          .sort((a, b) => b.score - a.score);
        return scored.length ? scored[0].r : items[0];
      };

      const pickBestEd = (items: any[]) => {
        if (!items || items.length === 0) return undefined;
        // Prefer latest plausible ED (usually in last 40% of episode)
        const scored = items
          .filter((r) => r?.interval && typeof r.interval.startTime === 'number' && typeof r.interval.endTime === 'number')
          .map((r) => {
            const len = Number(r.episodeLength || 0);
            const start = Number(r.interval.startTime);
            const end = Number(r.interval.endTime);
            const threshold = len > 0 ? len * 0.4 : 0;
            const plausibility = start >= threshold ? 1 : 0;
            const confidence = Number(r.confidence || 0);
            const score = plausibility * 1000 + start + confidence;
            return { r, score };
          })
          .sort((a, b) => b.score - a.score);
        return scored.length ? scored[0].r : items[0];
      };

      const bestOp = pickBestOp(opItems);
      const bestEd = pickBestEd(edItems);

      console.log('[ANISKIP] 🎯 Selection:', {
        pickOpFrom: opItems.length,
        pickEdFrom: edItems.length,
        chosenOp: bestOp ? { start: bestOp.interval.startTime, end: bestOp.interval.endTime, epLen: bestOp.episodeLength } : null,
        chosenEd: bestEd ? { start: bestEd.interval.startTime, end: bestEd.interval.endTime, epLen: bestEd.episodeLength } : null,
      });

      const timings: VideoTimings = {};
      if (bestOp) {
        timings.intro = {
          start: Number(bestOp.interval.startTime),
          end: Number(bestOp.interval.endTime),
        };
      }
      if (bestEd) {
        timings.outro = {
          start: Number(bestEd.interval.startTime),
          end: Number(bestEd.interval.endTime),
        };
      }

      if (timings.intro || timings.outro) {
        console.log('[ANISKIP] ✅ Timings found:', timings);
        return timings;
      }
      return null;
    } catch (err) {
      console.log('[ANISKIP] ❌ Failed to fetch timings:', err);
      return null;
    }
  };

  const fetchSources = async (episodeId: string, type: 'sub' | 'dub') => {
    // Use source settings for auto-select behavior
    const shouldAutoSelect = sourceSettings.autoSelectSource && autoSelectSource;
    
    try {
      console.log(`\n=== EPISODE SOURCES MODAL DEBUG (FAST MODE) ===`);
      console.log(`📡 Fast-fetching ${type.toUpperCase()} server options for episode ${episodeId}`);
      console.log(`📺 Anime title:`, animeTitle);
      console.log(`🆔 AniList ID:`, anilistId);
      console.log(`🔄 Auto-select mode: ${shouldAutoSelect ? 'ON' : 'OFF'} (from settings)`);
      console.log(`🌐 Current provider: ${currentProvider}`);
      
      setError(null);
      setLoading(true);

      // Extract episode number from episodeId or use the provided episodeNumber
      let episodeNum = episodeNumber;
      if (!episodeNum && episodeId) {
        if (episodeId.includes('/')) {
          const parts = episodeId.split('/')[1];
          if (parts && parts.startsWith('episode-')) {
            episodeNum = parseInt(parts.replace('episode-', ''));
          }
        } else if (episodeId.includes('?ep=')) {
          episodeNum = parseInt(episodeId.split('?ep=')[1]);
        }
      }
      
      // Ensure we have a valid episode number
      if (!episodeNum || isNaN(episodeNum)) {
        throw new Error('Invalid episode number');
      }
      
      console.log(`📺 Episode number:`, episodeNum);
      
      // CRITICAL FIX: When currentProvider is set, use ONLY that provider
      // Don't fall back to other providers unless explicitly requested
      const providersToTry = currentProvider ? [currentProvider] : sourceSettings.providerPriority;
          
      console.log(`🎯 Providers to try: ${providersToTry.join(' → ')}`);

      // Try each provider in sequence
      for (const provider of providersToTry) {
        console.log(`🚀 Fast-checking provider: ${provider}`);
        
        try {
          // AnimePahe provider is currently disabled, but Zencloud will provide sources
          if (provider === 'animepahe') {
            console.log(`❌ [ANIMEPAHE] Skipping AnimePahe: Provider disabled, but Zencloud will provide sources`);
            continue;
          } else if (provider === 'zoro') {
            // Zoro is currently disabled - working on fixing
            console.log(`❌ [ZORO] Skipping Zoro: Currently disabled - working on fixing`);
            continue;
          } else if (provider === 'animezone') {
            // CRITICAL FIX: AnimeZone (HolyShit) provider - this should ALWAYS be used when currentProvider === 'animezone'
            console.log(`\n🎯 [ANIMEZONE] =================== ANIMEZONE PROVIDER FLOW START ===================`);
            console.log(`🎯 [ANIMEZONE] Using AnimeZone provider for streaming (currentProvider: ${currentProvider})`);
            console.log(`🎯 [ANIMEZONE] Episode details:`, {
              episodeId,
              episodeNumber: episodeNum,
              animeTitle,
              anilistId,
              type,
              isDub: type === 'dub'
            });
            
            if (!animeTitle) {
              console.log(`❌ [ANIMEZONE] Skipping: Anime title required`);
              console.log(`🎯 [ANIMEZONE] =================== ANIMEZONE PROVIDER FLOW END (NO TITLE) ===================\n`);
              continue;
            }
            
            console.log(`📡 [ANIMEZONE] Step 1: Starting smart search for title: "${animeTitle}"`);
            console.log(`📡 [ANIMEZONE] AniList ID context: ${anilistId || 'Not provided'}`);
            
            // Use smart search that tries multiple variations automatically
            try {
              console.log(`🔍 [ANIMEZONE] Calling animeZoneProvider.smartSearch("${animeTitle}", ${anilistId})`);
              const results = await animeZoneProvider.smartSearch(animeTitle, anilistId);
              console.log(`📊 [ANIMEZONE] Smart search response:`, {
                hasResults: !!results,
                resultsCount: results?.length || 0,
                resultsType: typeof results,
                isArray: Array.isArray(results),
                rawResults: results
              });
              
              if (results && Array.isArray(results) && results.length > 0) {
                console.log(`📝 [ANIMEZONE] Search results details:`, results.map((r: any, i: number) => ({
                  index: i + 1,
                  id: r?.id,
                  title: r?.title,
                  anilistId: r?.anilistId,
                  hasId: !!r?.id,
                  hasTitle: !!r?.title
                })));
              }
              
              const azId = results?.[0]?.id;
              console.log(`🎯 [ANIMEZONE] Selected ID from search:`, {
                azId,
                hasId: !!azId,
                idType: typeof azId,
                firstResult: results?.[0]
              });
              
              if (!azId) {
                console.log(`❌ [ANIMEZONE] No valid ID found from smart search`);
                console.log(`🎯 [ANIMEZONE] =================== ANIMEZONE PROVIDER FLOW END (NO ID) ===================\n`);
                continue;
              }
              
              console.log(`📡 [ANIMEZONE] Step 2: Fetching streams for id=${azId}, episode=${episodeNum}`);
              console.log(`📡 [ANIMEZONE] Calling animeZoneProvider.getWatchData(${azId}, ${episodeNum})`);
              
              try {
                const watchData = await animeZoneProvider.getWatchData(azId, episodeNum!);
                console.log(`📊 [ANIMEZONE] getWatchData response:`, {
                  hasData: !!watchData,
                  dataType: typeof watchData,
                  hasSources: !!watchData?.sources,
                  sourcesCount: watchData?.sources?.length || 0,
                  hasSubtitles: !!watchData?.subtitles,
                  subtitlesCount: watchData?.subtitles?.length || 0,
                  hasHeaders: !!watchData?.headers,
                  rawData: watchData
                });
                
                if (watchData && Array.isArray(watchData.sources) && watchData.sources.length > 0) {
                  console.log(`✅ [ANIMEZONE] Found ${watchData.sources.length} sources`);
                  console.log(`📝 [ANIMEZONE] Sources details:`, watchData.sources.map((s: any, i: number) => ({
                    index: i + 1,
                    quality: s?.quality,
                    type: s?.type,
                    dubType: s?.dubType,
                    url: s?.url ? `${s.url.substring(0, 50)}...` : 'No URL',
                    hasUrl: !!s?.url,
                    isM3U8: s?.url?.includes('.m3u8') || false
                  })));
                  
                  // Filter sources by the requested type (sub/dub)
                  console.log(`🔍 [ANIMEZONE] Step 3: Filtering sources by requested type: ${type}`);
                  console.log(`🔍 [ANIMEZONE] Available source types:`, watchData.sources.map((s: any) => ({
                    quality: s.quality,
                    type: s.type,
                    dubType: s.dubType
                  })));
                  
                  const typeFilteredSources = watchData.sources.filter((source: any) => {
                    const sourceType = source.type;
                    const matchesType = sourceType === type;
                    console.log(`🔍 [ANIMEZONE] Source ${source.quality}: type=${sourceType}, requested=${type}, matches=${matchesType}`);
                    return matchesType;
                  });
                  
                  console.log(`📊 [ANIMEZONE] Type filtering results:`, {
                    originalCount: watchData.sources.length,
                    filteredCount: typeFilteredSources.length,
                    requestedType: type,
                    removedCount: watchData.sources.length - typeFilteredSources.length
                  });
                  
                  if (typeFilteredSources.length === 0) {
                    console.log(`⚠️ [ANIMEZONE] No ${type} sources found, using all sources as fallback`);
                    typeFilteredSources.push(...watchData.sources);
                  }
                  
                  console.log(`📊 [ANIMEZONE] Final sources to use: ${typeFilteredSources.length}`);
                  
                  console.log(`🔧 [ANIMEZONE] Step 4: Formatting sources with headers...`);
                  const formattedSources = typeFilteredSources.map((source: any, index: number) => {
                    const formatted = formatSourceWithHeaders(source, watchData.headers || {}, type, 'animezone');
                    console.log(`🔧 [ANIMEZONE] Formatted source ${index + 1}:`, {
                      originalQuality: source.quality,
                      formattedQuality: formatted.quality,
                      originalType: source.type,
                      formattedType: formatted.type,
                      hasUrl: !!formatted.url,
                      urlPreview: formatted.url ? `${formatted.url.substring(0, 50)}...` : 'No URL',
                      hasHeaders: !!formatted.headers,
                      headerKeys: formatted.headers ? Object.keys(formatted.headers) : [],
                      isM3U8: formatted.isM3U8
                    });
                    return formatted;
                  });
                  
                  console.log(`✅ [ANIMEZONE] Successfully formatted ${formattedSources.length} sources`);
                  
                  // Handle subtitles
                  const subs = Array.isArray(watchData.subtitles) ? watchData.subtitles : [];
                  console.log(`🎞️ [ANIMEZONE] Subtitles:`, {
                    hasSubtitles: !!watchData.subtitles,
                    subtitlesCount: subs.length,
                    subtitlesType: typeof watchData.subtitles,
                    isArray: Array.isArray(watchData.subtitles),
                    rawSubtitles: watchData.subtitles
                  });
                  
                  if (subs.length > 0) {
                    console.log(`📝 [ANIMEZONE] Subtitle details:`, subs.map((s: any, i: number) => ({
                      index: i + 1,
                      lang: s?.lang,
                      language: s?.language,
                      url: s?.url ? `${s.url.substring(0, 50)}...` : 'No URL',
                      hasUrl: !!s?.url,
                      hasLang: !!(s?.lang || s?.language)
                    })));
                  }
                  
                  setSources(formattedSources);
                  setSubtitles(subs);
                  subtitlesRef.current = subs;
                  
                  // Handle timings
                  console.log(`⏱️ [ANIMEZONE] Fetching AniSkip timings for episode ${episodeNum}...`);
                  const aniTimings = await fetchAniSkipTimings(malId, episodeNum!);
                  console.log(`⏱️ [ANIMEZONE] AniSkip timings result:`, {
                    hasTimings: !!aniTimings,
                    timings: aniTimings,
                    malId,
                    episodeNum
                  });
                  setTimings(aniTimings || null);
                  
                  // Build quality options
                  const qualityOptions = formattedSources.map((source: Source, index: number) => ({
                    quality: source.quality || `Source ${index + 1}`,
                    url: source.url,
                    headers: source.headers,
                    isDefault: index === 0,
                    isZoroServer: false
                  }));
                  
                  console.log(`📋 [ANIMEZONE] Quality options built:`, {
                    optionsCount: qualityOptions.length,
                    options: qualityOptions.map((opt, i) => ({
                      index: i + 1,
                      quality: opt.quality,
                      hasUrl: !!opt.url,
                      hasHeaders: !!opt.headers,
                      isDefault: opt.isDefault
                    }))
                  });
                  
                  setAvailableQualities(qualityOptions);
                  setShowQualitySelection(true);
                  setLoading(false);
                  
                  console.log(`✅ [ANIMEZONE] SUCCESS: Successfully loaded ${formattedSources.length} sources from AnimeZone`);
                  console.log(`🎯 [ANIMEZONE] =================== ANIMEZONE PROVIDER FLOW END (SUCCESS) ===================\n`);
                  return;
                  
                } else {
                  console.log(`❌ [ANIMEZONE] No valid sources found in watchData`);
                  console.log(`❌ [ANIMEZONE] watchData structure:`, {
                    hasData: !!watchData,
                    dataType: typeof watchData,
                    hasSources: !!watchData?.sources,
                    sourcesType: typeof watchData?.sources,
                    sourcesIsArray: Array.isArray(watchData?.sources),
                    sourcesLength: watchData?.sources?.length || 0,
                    rawSources: watchData?.sources
                  });
                  console.log(`🎯 [ANIMEZONE] =================== ANIMEZONE PROVIDER FLOW END (NO SOURCES) ===================\n`);
                }
                
              } catch (watchDataError: any) {
                console.log(`❌ [ANIMEZONE] Error in getWatchData:`, {
                  errorMessage: watchDataError?.message,
                  errorCode: watchDataError?.code,
                  errorType: typeof watchDataError,
                  errorStack: watchDataError?.stack?.split('\n').slice(0, 5).join('\n'),
                  fullError: watchDataError
                });
                console.log(`🎯 [ANIMEZONE] =================== ANIMEZONE PROVIDER FLOW END (WATCH DATA ERROR) ===================\n`);
              }
              
            } catch (searchError: any) {
              console.log(`❌ [ANIMEZONE] Error in smartSearch:`, {
                errorMessage: searchError?.message,
                errorCode: searchError?.code,
                errorType: typeof searchError,
                errorStack: searchError?.stack?.split('\n').slice(0, 5).join('\n'),
                fullError: searchError
              });
              console.log(`🎯 [ANIMEZONE] =================== ANIMEZONE PROVIDER FLOW END (SEARCH ERROR) ===================\n`);
            }
          }
          
        } catch (providerError: any) {
          console.error(`❌ [${provider.toUpperCase()}] Provider error:`, {
            provider,
            errorMessage: providerError?.message,
            errorCode: providerError?.code,
            httpStatus: providerError?.response?.status,
            errorStack: providerError?.stack?.split('\n').slice(0, 3).join('\n')
          });
          console.error(`❌ [${provider.toUpperCase()}] Full error object:`, providerError);
          
          // CRITICAL FIX: If this is the currentProvider and it fails, don't try other providers
          // This ensures we respect the user's provider choice
          if (provider === currentProvider) {
            console.log(`❌ [${provider.toUpperCase()}] This is the current provider, not falling back to others`);
            break;
          }
          continue;
        }
      }
      
      // If we get here, no providers worked
      console.log(`❌ [SOURCES_MODAL] No providers returned sources. Tried: ${providersToTry.join(', ')}`);
      console.log(`❌ [SOURCES_MODAL] Episode details: episodeId="${episodeId}", type="${type}", episodeNum=${episodeNum}`);
      console.log(`❌ [SOURCES_MODAL] Available data: animeTitle="${animeTitle}", anilistId="${anilistId}"`);
      console.log(`❌ [SOURCES_MODAL] Current provider: ${currentProvider}`);
      
      // More specific error message based on current provider
      let errorMessage = `No ${type.toUpperCase()} sources found from ${currentProvider || 'any provider'}`;
      if (currentProvider === 'animezone') {
        errorMessage = `AnimeZone couldn't find streaming sources for this episode. Try switching to a different provider.`;
      } else if (currentProvider === 'animepahe') {
        errorMessage = `AnimePahe provider is currently disabled. Use Zencloud below for premium streaming.`;
      } else if (currentProvider === 'zoro') {
        errorMessage = `HiAnime is currently being worked on and may not work properly. Try switching to a different provider.`;
      }
      
      throw new Error(errorMessage);
      
    } catch (error) {
      console.error(`❌ [SOURCES_MODAL] Outer catch - Error:`, error);
      setError(error instanceof Error ? error.message : 'Failed to fetch sources');
      
      if (shouldAutoSelect) {
        onClose();
      }
    } finally {
      setLoading(false);
    }
  };

  // Update the handleDirectSourceSelect to forward provider explicitly
  const handleDirectSourceSelect = (
    source: Source,
    directSubtitles: Subtitle[],
    directTimings?: VideoTimings,
    anilistId?: string,
    selectedProvider?: string
  ) => {
    // Log detailed information about the selected source
    console.log('\n=== SOURCE SELECT DEBUG (DIRECT DATA) ===');
    console.log('[SOURCE SELECT DEBUG] Source URL:', source.url.substring(0, 50) + '...');
    console.log('[SOURCE SELECT DEBUG] Source type:', source.type);
    console.log('[SOURCE SELECT DEBUG] Episode ID:', episodeId);
    console.log('[SOURCE SELECT DEBUG] Episode Number:', episodeNumberStr);
    console.log('[SOURCE SELECT DEBUG] Episode Number (parsed as int):', episodeNumberStr ? parseInt(episodeNumberStr) : undefined);
    console.log('[SOURCE SELECT DEBUG] Anime ID:', animeId || '');
    console.log('[SOURCE SELECT DEBUG] AniList ID:', anilistId || 'Not provided');
    console.log('[SOURCE SELECT DEBUG] URL Format:', episodeId.includes('/') ? 'New (animeId/episodeNumber)' : 'Legacy');
    
    // Generate unique store key for dataKey
    const dataKey = `source_${Date.now().toString()}`;
    console.log('[SOURCE SELECT DEBUG] Generated dataKey:', dataKey);
    
    // Check if we have subtitles and log them
    console.log('[SOURCE SELECT DEBUG] 🔒 Using direct subtitles array, count:', directSubtitles.length);
    if (directSubtitles.length > 0) {
      console.log('[SOURCE SELECT DEBUG] Subtitle languages:', directSubtitles.map(s => s.lang).join(', '));
      // Debug log the first subtitle
      console.log('[SOURCE SELECT DEBUG] First subtitle URL:', directSubtitles[0].url ? directSubtitles[0].url.substring(0, 50) + '...' : 'none');
      // Log all subtitles in detail
      console.log('[SOURCE SELECT DEBUG] All subtitles:');
      directSubtitles.forEach((sub, index) => {
        console.log(`[SOURCE SELECT DEBUG] Subtitle #${index + 1}:`, {
          lang: sub.lang,
          url: sub.url ? sub.url.substring(0, 50) + '...' : 'none',
          valid: Boolean(sub.url && sub.lang)
        });
      });
    } else {
      console.log('[SOURCE SELECT DEBUG] ⚠️ No subtitles available in direct data');
    }
    
    // Log the timings that will be sent
    if (directTimings) {
      console.log('[SOURCE SELECT DEBUG] 🔒 Using direct timings object:',
        directTimings.intro ? `Intro: ${directTimings.intro.start}s-${directTimings.intro.end}s` : 'No intro',
        directTimings.outro ? `Outro: ${directTimings.outro.start}s-${directTimings.outro.end}s` : 'No outro'
      );
    } else {
      console.log('[SOURCE SELECT DEBUG] ⚠️ No video timings in direct data');
    }
    
    // Log the subtitles that will be sent
    console.log('[SOURCE SELECT DEBUG] Sending subtitles:', directSubtitles.length);
    
      // Store data that will be needed by the player
      const payload = {
        source: source.url,
        headers: source.headers,
        episodeId: episodeId,
        episodeNumber: episodeNumberStr ? parseInt(episodeNumberStr) : undefined,
        subtitles: (directSubtitles || []).map(sub => ({
          ...sub,
          url: sub.url?.replace('cdn.zencloud.cc', 'zantaku.zencloud.cc') || sub.url
        })),
        timings: directTimings || null,
        anilistId: anilistId || '',
        animeTitle: animeTitle || '',
        provider: selectedProvider || currentProvider || 'animepahe',
        audioType: source.type,
        timestamp: Date.now(),
        // Store full Zencloud data if available (regardless of provider)
        zencloudData: zencloudFile ? {
          ...zencloudFile,
          // Ensure all required fields are present
          file_code: zencloudFile?.file_code || '',
          m3u8_url: zencloudFile?.m3u8_url?.replace('cdn.zencloud.cc', 'zantaku.zencloud.cc') || '',
          original_filename: zencloudFile?.original_filename || 'Unknown',
          subtitles: zencloudFile?.subtitles?.map(sub => ({
            ...sub,
            url: sub.url?.replace('cdn.zencloud.cc', 'zantaku.zencloud.cc') || sub.url
          })) || [],
          chapters: zencloudFile?.chapters || [],
          fonts: zencloudFile?.fonts?.map(font => ({
            ...font,
            url: font.url?.replace('cdn.zencloud.cc', 'zantaku.zencloud.cc') || font.url
          })) || [],
          token: zencloudFile?.token || '',
          token_expires: zencloudFile?.token_expires || '',
          client_ip: zencloudFile?.client_ip || '',
          token_ip_bound: zencloudFile?.token_ip_bound || false
        } : null
      };
    AsyncStorage.setItem(dataKey, JSON.stringify(payload))
      .then(() => {
        console.log('[SOURCE SELECT DEBUG] Successfully stored video data with key:', dataKey, {
          hasTimings: Boolean(payload.timings),
          intro: payload.timings?.intro,
          outro: payload.timings?.outro,
          subtitles: payload.subtitles?.length || 0,
          provider: payload.provider,
          hasZencloudData: Boolean(payload.zencloudData),
          zencloudFileCode: payload.zencloudData?.file_code || 'none'
        });
      })
      .catch(err => {
        console.error('[SOURCE SELECT DEBUG] Error storing video data:', err);
      });
    
    // Update pill message before navigating
    if (autoSelectSource) {
      setPillMessage(`Starting Episode ${episodeNumberStr}...`);
    }
    
    // Close the modal if auto-selecting
    if (autoSelectSource) {
      onClose();
    }
    
    // Close current modal and pass data back to caller
    // IMPORTANT: Use direct data references instead of state
    console.log('[SOURCE SELECT DEBUG] Final onSelectSource call (direct) with audio type:', source.type);
    onSelectSource(
      source.url,
      source.headers,
      episodeId,
      episodeNumberStr,
      directSubtitles,
      directTimings,
      anilistId,
      dataKey,
      selectedProvider || currentProvider || 'animepahe',
      source.type
    );
  };

  // Similarly update the handleSourceSelect function
  const handleSourceSelect = (source: Source) => {
    // Capture subtitles state here to avoid race conditions
    // This ensures we always use the latest subtitles available
    let currentSubtitles = [...subtitles];
    if (currentSubtitles.length === 0 && subtitlesRef.current.length > 0) {
      console.log('[SOURCES_MODAL] ℹ️ State subtitles empty; using latest fetched subtitles from ref');
      currentSubtitles = [...subtitlesRef.current];
    }
    const currentTimings = timings;

    // Log detailed information about the selected source
    console.log('\n=== SOURCE SELECT DEBUG (STATE DATA) ===');
    console.log('[SOURCE SELECT DEBUG] Source URL:', source.url.substring(0, 50) + '...');
    console.log('[SOURCE SELECT DEBUG] Source type:', source.type);
    console.log('[SOURCE SELECT DEBUG] Episode ID:', episodeId);
    console.log('[SOURCE SELECT DEBUG] Episode Number:', episodeNumberStr);
    console.log('[SOURCE SELECT DEBUG] Episode Number (parsed as int):', episodeNumberStr ? parseInt(episodeNumberStr) : undefined);
    console.log('[SOURCE SELECT DEBUG] Anime ID:', animeId || '');
    console.log('[SOURCE SELECT DEBUG] AniList ID:', anilistId || 'Not provided');
    console.log('[SOURCE SELECT DEBUG] Subtitle count (state/ref):', subtitles.length, '/', subtitlesRef.current.length);
    
    // Generate unique store key for dataKey
    const dataKey = `source_${Date.now().toString()}`;
    console.log('[SOURCE SELECT DEBUG] Generated dataKey:', dataKey);
    
    // Create video timings object if available
    let videoTimings: VideoTimings | undefined;
    if (introStartTime !== null && introEndTime !== null) {
      videoTimings = {
        intro: {
          start: introStartTime,
          end: introEndTime
        }
      };
      
      if (outroStartTime !== null && outroEndTime !== null) {
        videoTimings.outro = {
          start: outroStartTime,
          end: outroEndTime
        };
      }
    } else if (currentTimings) {
      // Use timings object if directly available
      videoTimings = currentTimings;
    }
    
    // Store data for player to access
    AsyncStorage.setItem(dataKey, JSON.stringify({
      source: source.url,
      headers: source.headers,
      episodeId: episodeId,
      episodeNumber: episodeNumberStr ? parseInt(episodeNumberStr) : undefined,
      subtitles: (currentSubtitles || []).map(sub => ({
        ...sub,
        url: sub.url?.replace('cdn.zencloud.cc', 'zantaku.zencloud.cc') || sub.url
      })),
      timings: videoTimings || null,
      anilistId: anilistId || '',
      animeTitle: animeTitle || '',
      provider: currentProvider || 'zoro',
      audioType: source.type,
      timestamp: Date.now()
    })).then(() => {
      console.log('[SOURCE SELECT DEBUG] Successfully stored video data with key:', dataKey);
      console.log('[SOURCE SELECT DEBUG] Stored subtitles:', (currentSubtitles || []).length);
      if ((currentSubtitles || []).length) {
        try {
          console.log('[SOURCE SELECT DEBUG] Subtitles detail:', (currentSubtitles || []).map((s: any, i: number) => ({
            index: i + 1,
            lang: s?.lang || s?.language || '',
            url: (s?.url || '').substring(0, 100) + '...'
          })));
        } catch {}
      }
    }).catch(err => {
      console.error('[SOURCE SELECT DEBUG] Error storing video data:', err);
    });
    
    // Close the modal if auto-selecting
    if (autoSelectSource) {
      onClose();
    }
    
    // Close current modal and pass data back to caller
    // Use the captured subtitles to avoid race conditions
    console.log('[SOURCE SELECT DEBUG] Final onSelectSource call with audio type:', source.type);
    onSelectSource(
      source.url,
      source.headers,
      episodeId,
      episodeNumberStr,
      currentSubtitles,
      videoTimings,
      anilistId,
      dataKey,
      currentProvider || 'zoro',
      source.type
    );
  };

  const handleTypeSelect = (selectedType: 'sub' | 'dub') => {
    setType(selectedType);
    setLoading(true);
    setError(null);
    fetchSources(episodeId, selectedType);
  };

  // Removed Zoro server selection - no fallback allowed

  // Zencloud section component - always visible
  const ZencloudSection = () => {
    
    const handleZencloudPlay = () => {
      if (!zencloudFile) return;
      
      console.log(`🌟 [ZENCLOUD] User selected Zencloud source:`, {
        file_code: zencloudFile.file_code,
        m3u8_url: zencloudFile.m3u8_url ? zencloudFile.m3u8_url.split('?')[0] + '?token=...' : 'none',
        subtitles_count: zencloudFile.subtitles?.length || 0,
        chapters_count: zencloudFile.chapters?.length || 0,
        fonts_count: zencloudFile.fonts?.length || 0,
        has_thumbnails: !!zencloudFile.thumbnails_vtt_url,
        token_expires: zencloudFile.token_expires
      });
      
      console.log(`🌟 [ZENCLOUD] Full Zencloud data being passed to VLC player:`, {
        original_filename: zencloudFile.original_filename,
        file_id: zencloudFile.file_id,
        client_ip: zencloudFile.client_ip,
        token_ip_bound: zencloudFile.token_ip_bound,
        premium_status: zencloudFile.premium_status
      });
      
      // Create a source object compatible with the existing player
      const zencloudSource: Source = {
        url: zencloudFile.m3u8_url,
        quality: 'Zencloud HLS',
        type: type, // Use current selected type (sub/dub)
        headers: {}, // Zencloud URLs are pre-signed, no additional headers needed
        isM3U8: true
      };
      
      // Convert Zencloud subtitles to the expected format
      const zencloudSubtitles = zencloudFile.subtitles?.map(sub => ({
        url: sub.url,
        lang: sub.language_name || sub.language
      })) || [];
      
      // Convert Zencloud chapters to timings format if available
      let zencloudTimings: VideoTimings | undefined;
      if (zencloudFile.chapters && zencloudFile.chapters.length > 0) {
        // Find intro/outro chapters by title keywords
        const introChapter = zencloudFile.chapters.find(c => 
          c.title.toLowerCase().includes('intro') || 
          c.title.toLowerCase().includes('opening') ||
          c.title.toLowerCase().includes('op')
        );
        const outroChapter = zencloudFile.chapters.find(c => 
          c.title.toLowerCase().includes('outro') || 
          c.title.toLowerCase().includes('ending') ||
          c.title.toLowerCase().includes('ed')
        );
        
        if (introChapter || outroChapter) {
          zencloudTimings = {};
          if (introChapter) {
            zencloudTimings.intro = {
              start: introChapter.start_time,
              end: introChapter.end_time
            };
          }
          if (outroChapter) {
            zencloudTimings.outro = {
              start: outroChapter.start_time,
              end: outroChapter.end_time
            };
          }
        }
      }
      
      // Verify Zencloud data completeness before passing to VLC player
      console.log(`🌟 [ZENCLOUD] Data verification before VLC player:`, {
        has_m3u8_url: !!zencloudFile.m3u8_url,
        has_file_code: !!zencloudFile.file_code,
        has_original_filename: !!zencloudFile.original_filename,
        subtitles_ready: zencloudSubtitles.length,
        chapters_ready: zencloudFile.chapters?.length || 0,
        fonts_ready: zencloudFile.fonts?.length || 0,
        token_valid: !!zencloudFile.token,
        token_expires_valid: !!zencloudFile.token_expires
      });

      // Use the existing handleDirectSourceSelect function
      handleDirectSourceSelect(
        zencloudSource,
        zencloudSubtitles,
        zencloudTimings,
        anilistId,
        'zencloud'
      );
    };
    
    return (
      <View style={styles.zencloudSection}>
        <View style={styles.zencloudHeader}>
          <Text style={styles.zencloudTitle}>🌟 Premium Streaming</Text>
          <Text style={styles.zencloudSubtitle}>High-quality streaming with subtitles & chapters</Text>
        </View>
        
        {zencloudLoading && (
          <View style={styles.zencloudLoading}>
            <ActivityIndicator size="small" color="#FFD700" />
            <Text style={styles.zencloudLoadingText}>Loading Zencloud data...</Text>
          </View>
        )}
        
        {zencloudError && (
          <View style={styles.zencloudError}>
            <Text style={styles.zencloudErrorText}>⚠️ {zencloudError}</Text>
            <TouchableOpacity 
              style={styles.zencloudRetryButton}
              onPress={fetchZencloudData}
            >
              <Text style={styles.zencloudRetryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}
        
        {zencloudFile && (
          <View style={styles.zencloudContent}>
            <TouchableOpacity 
              style={styles.zencloudPlayButton}
              onPress={handleZencloudPlay}
            >
              <FontAwesome5 name="play" size={14} color="#000" style={{ marginRight: 8 }} />
              <Text style={styles.zencloudPlayText}>Play from Zencloud</Text>
              <View style={styles.zencloudQualityBadge}>
                <Text style={styles.zencloudQualityText}>HLS</Text>
              </View>
            </TouchableOpacity>
            
          </View>
        )}
      </View>
    );
  };

  // Add new component for quality selection (calm layout)
  const QualitySelectionView = () => {
    // Removed Zoro server selection - no fallback allowed
    
    // Regular quality selection: calm list with radio
    const data: RowItem[] = availableQualities.map((q, idx) => ({
      label: `${q.quality}`,
      url: q.url,
      headers: q.headers,
      isM3U8: q.url.includes('.m3u8'),
      note: idx === 0 ? 'Recommended' : undefined,
    }));

    return (
      <View style={{ width: '100%', marginTop: 8 }}>
        {currentProvider === 'animezone' && (
          <View style={styles.warningBox}>
            <Text style={styles.warningText}>⚠️ New API - Some anime may not work properly</Text>
          </View>
        )}
        <Text style={styles.bodyTitle}>{availableQualities.length} {availableQualities.length>1?'sources':'source'} available</Text>
        <FlatList
          data={data}
          keyExtractor={(item, index) => `${item.label}-${index}`}
          renderItem={({ item, index }) => (
            <SourceRow
              selected={index===0}
              item={item}
              onPress={() => {
                console.log(`🔍 [ANIMEZONE] Source selected:`, {
                  quality: item.label,
                  type: type,
                  url: item.url.substring(0, 50) + '...'
                });
                handleSourceSelect({ url: item.url, quality: item.label, type: type, headers: item.headers, isM3U8: item.isM3U8 });
              }}
            />
          )}
          style={{ maxHeight: 360 }}
        />
        <View style={styles.footerRow}>
          <TouchableOpacity style={[styles.secondaryBtn, { flex: 1 }]} onPress={() => handleTypeSelect(type)}>
            <Text style={styles.secondaryBtnText}>Refresh</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.smallHint}>HLS adapts quality automatically.</Text>
      </View>
    );
  };

  // Zencloud fetching logic
  const fetchZencloudData = useCallback(async () => {
    if (!anilistId || !episodeNumber) return;
    
    console.log(`\n🌟 [ZENCLOUD] =================== ZENCLOUD FETCH START ===================`);
    console.log(`🌟 [ZENCLOUD] Fetching Zencloud data for AniList ID: ${anilistId}, Episode: ${episodeNumber}`);
    
    setZencloudLoading(true);
    setZencloudError(null);
    setZencloudFile(null);
    
    try {
      // Try to get cached raw data first
      let rawData = await getCachedRaw(parseInt(anilistId));
      
      if (!rawData) {
        console.log(`🌟 [ZENCLOUD] No cached data, fetching from API...`);
        rawData = await fetchRawByAnilistId(parseInt(anilistId));
        await setCachedRaw(parseInt(anilistId), rawData);
      } else {
        console.log(`🌟 [ZENCLOUD] Using cached raw data (${rawData.length} episodes)`);
      }
      
      setZencloudRaw(rawData);
      
      // Find the episode we want
      const targetEpisode = rawData.find(item => item.episode === episodeNumber);
      if (!targetEpisode) {
        console.log(`🌟 [ZENCLOUD] Episode ${episodeNumber} not found in raw data`);
        console.log(`🌟 [ZENCLOUD] Available episodes:`, rawData.map(r => r.episode));
        throw new Error(`Episode ${episodeNumber} not available on Zencloud`);
      }
      
      console.log(`🌟 [ZENCLOUD] Found episode ${episodeNumber}:`, {
        access_id: targetEpisode.access_id.substring(0, 8) + '...',
        audio: targetEpisode.audio,
        player_url: targetEpisode.player_url
      });
      
      // Try to get cached file details
      let fileData = await getCachedFileDetails(targetEpisode.access_id);
      
      if (!fileData) {
        console.log(`🌟 [ZENCLOUD] No cached file details, fetching from API...`);
        fileData = await fetchFileDetailsByAccessId(targetEpisode.access_id);
        await setCachedFileDetails(targetEpisode.access_id, fileData);
      } else {
        console.log(`🌟 [ZENCLOUD] Using cached file details`);
      }
      
      setZencloudFile(fileData);
      
      console.log(`🌟 [ZENCLOUD] ✅ Successfully loaded Zencloud data:`, {
        file_code: fileData.file_code,
        has_m3u8: !!fileData.m3u8_url,
        subtitles_count: fileData.subtitles?.length || 0,
        chapters_count: fileData.chapters?.length || 0,
        token_expires: fileData.token_expires
      });
      
      // Log full Zencloud data for debugging
      console.log(`🌟 [ZENCLOUD] 📋 FULL ZENCLOUD DATA:`, JSON.stringify(fileData, null, 2));
      
      console.log(`🌟 [ZENCLOUD] =================== ZENCLOUD FETCH END (SUCCESS) ===================\n`);
      
    } catch (error: any) {
      console.log(`🌟 [ZENCLOUD] ❌ Error fetching Zencloud data:`, {
        errorMessage: error?.message,
        errorType: typeof error,
        anilistId,
        episodeNumber
      });
      console.log(`🌟 [ZENCLOUD] =================== ZENCLOUD FETCH END (ERROR) ===================\n`);
      
      setZencloudError(error?.message || 'Failed to load Zencloud data');
    } finally {
      setZencloudLoading(false);
    }
  }, [anilistId, episodeNumber]);

  // Add function to check availability of both sub and dub
  const checkAvailability = useCallback(async (episodeId: string, anilistId: string) => {
    if (!anilistId && !animeTitle) return { sub: false, dub: false };
    
    try {
      // Extract episode number
      let episodeNum;
      if (episodeId.includes('/')) {
        episodeNum = episodeId.split('/')[1] || '1';
      } else if (episodeId.includes('?ep=')) {
        episodeNum = episodeId.split('?ep=')[1] || '1';
      } else {
        episodeNum = '1';
      }
      
      console.log(`🔍 Checking SUB/DUB availability for episode ${episodeNum}`);
      
      let subAvailable = false;
      let dubAvailable = false;
      
      // NEW: Check AniAnime API first for accurate server availability
      try {
        console.log(`🔍 [ANIANIME] Checking episode servers via API: ${episodeId}`);
        const anianimeUrl = `https://anianiwatchwatching.vercel.app/api/v2/hianime/episode/servers?animeEpisodeId=${encodeURIComponent(episodeId)}`;
        const response = await axios.get(anianimeUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
          },
          timeout: 10000
        });
        
        const serversData = response?.data?.data;
        if (serversData) {
          // Schema returns { sub: Server[], dub: Server[], episodeId, episodeNo, raw }
          const subArr = Array.isArray(serversData.sub) ? serversData.sub : [];
          const dubArr = Array.isArray(serversData.dub) ? serversData.dub : [];
          subAvailable = subArr.length > 0;
          dubAvailable = dubArr.length > 0;
          console.log(`📊 [ANIANIME] Server availability: SUB=${subAvailable} (${subArr.length}), DUB=${dubAvailable} (${dubArr.length})`);
          console.log(`📊 [ANIANIME] Sub names:`, subArr.map((s: any) => s?.name || s?.server || 'unknown'));
          console.log(`📊 [ANIANIME] Dub names:`, dubArr.map((s: any) => s?.name || s?.server || 'unknown'));
        } else {
          console.log(`⚠️ [ANIANIME] Unexpected response shape:`, response?.data);
        }
      } catch (anianimeError: any) {
        console.log(`❌ [ANIANIME] API check failed:`, {
          errorMessage: anianimeError?.message,
          status: anianimeError?.response?.status,
          data: anianimeError?.response?.data
        });
      }
      
      // Fallback to provider checks if AniAnime API didn't work
      if (!subAvailable && !dubAvailable) {
        console.log(`🔄 [FALLBACK] AniAnime API failed, trying provider checks...`);
        
        // Removed Zoro provider check - no fallback allowed
        
        // Removed AnimePahe fallback - if AnimeZone fails, it should fail completely
      }
      
      console.log(`📊 Final availability: SUB=${subAvailable}, DUB=${dubAvailable}`);
      
      return { sub: subAvailable, dub: dubAvailable };
    } catch (error) {
      console.error('Error checking availability:', error);
      return { sub: true, dub: true }; // Assume both available if check fails
    }
  }, [animeTitle]);

  const hasResults = availableQualities && availableQualities.length > 0;

  // Now replace the return statement entirely
  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <Animated.View style={[styles.container, { opacity: fadeAnim }]} />
      </TouchableWithoutFeedback>
      <BlurView intensity={10} tint="dark" style={styles.blurContainer}>
        <Animated.View style={[styles.content, { transform: [{ scale: scaleAnim }] }]}> 
          {/* Header */}
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={onClose} style={styles.headerCloseLeft} accessibilityRole="button" accessibilityLabel="Close">
              <FontAwesome5 name="times" size={18} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.titleText}>Episode {episodeNumberStr}</Text>
            <View style={{ width: 32 }} />
          </View>

          {/* Meta - Zencloud only */}
          <View style={styles.metaRow}> 
            <View style={styles.metaStatic}><Text style={styles.metaStaticText}>Audio: Sub</Text></View>
            <View style={styles.metaStatic}><Text style={styles.metaStaticText}>HLS</Text></View>
          </View>

          {/* Body - Zencloud Only */}
          <View style={{ width: '100%' }}>
            {/* ZENCLOUD SECTION - ALWAYS RENDER */}
            <ZencloudSection />
          </View>
        </Animated.View>
      </BlurView>
      {(autoSelectSource || skipTypeSelection) && (
        <AutoSelectPill visible={pillVisible && !hasResults && (loading || (!error))} message={pillMessage} />
      )}
    </Modal>
  );
}

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: COLOR.backdrop,
  },
  blurContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    width: Math.min(width * 0.92, 420),
    backgroundColor: '#151515',
    borderRadius: 12,
    padding: 16,
    alignItems: 'stretch',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  headerCloseLeft: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.18)' },
  titleText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  metaChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: 'rgba(2,169,255,0.12)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(2,169,255,0.35)' },
  metaChipText: { color: '#DFF4FF', fontSize: 12, fontWeight: '700' },
  metaStatic: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.18)' },
  metaStaticText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  segmented: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 8, overflow: 'hidden' },
  segment: { paddingVertical: 8, paddingHorizontal: 14 },
  segmentActive: { backgroundColor: 'rgba(2,169,255,0.15)' },
  segmentUnavailable: { backgroundColor: 'rgba(255,68,68,0.15)', opacity: 0.5 },
  segmentText: { color: 'rgba(255,255,255,0.9)', fontSize: 12, fontWeight: '700' },
  segmentTextActive: { color: '#fff' },
  segmentTextUnavailable: { color: 'rgba(255,255,255,0.5)' },
  bodyTitle: { color: '#FFFFFF', fontSize: 14, fontWeight: '800', marginBottom: 8 },
  loadingSimple: { paddingVertical: 12 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, gap: 12 },
  rowLabel: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  rowTags: { flexDirection: 'row', gap: 8, marginTop: 4 },
  tag: { color: '#FFFFFF', borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, fontSize: 11 },
  footerRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  primaryBtn: { flex: 1, backgroundColor: COLOR.primary, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  primaryBtnText: { color: '#000', fontWeight: '800' },
  secondaryBtn: { flex: 1, borderColor: 'rgba(255,255,255,0.2)', borderWidth: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  secondaryBtnText: { color: '#fff', fontWeight: '700' },
  smallHint: { color: 'rgba(255,255,255,0.7)', marginTop: 8, fontSize: 12 },
  errorBox: { paddingVertical: 12 },
  errorTextPlain: { color: COLOR.danger, fontSize: 13, marginBottom: 6 },
  warningBox: { 
    backgroundColor: 'rgba(255, 176, 32, 0.1)', 
    borderWidth: 1, 
    borderColor: 'rgba(255, 176, 32, 0.3)', 
    borderRadius: 8, 
    padding: 8, 
    marginBottom: 12 
  },
  warningText: { 
    color: COLOR.warning, 
    fontSize: 12, 
    fontWeight: '600', 
    textAlign: 'center' 
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  loadingContent: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    width: '100%',
  },
  spinnerContainer: {
    position: 'relative',
    width: 140,
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spinnerGlow: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#02A9FF',
    opacity: 0.3,
    shadowColor: '#02A9FF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 15,
    elevation: 10,
  },
  spinner: {
    width: 80,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spinnerRing: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 6,
    borderColor: 'rgba(2, 169, 255, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    borderLeftColor: '#02A9FF',
    borderTopColor: 'rgba(2, 169, 255, 0.8)',
    borderRightColor: 'rgba(2, 169, 255, 0.6)',
    borderBottomColor: 'rgba(2, 169, 255, 0.9)',
    shadowColor: '#02A9FF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 8,
  },
  spinnerDot: {
    position: 'absolute',
    top: -6,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#02A9FF',
    shadowColor: '#02A9FF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 5,
  },
  particleContainer: {
    position: 'absolute',
    width: 140,
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
  },
  autoLoadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    width: '100%',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(2, 169, 255, 0.3)',
    backgroundColor: 'rgba(0, 10, 20, 0.7)',
    shadowColor: '#02A9FF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 5,
  },
  autoLoadingContent: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    gap: 12,
  },
  glowContainer: {
    marginVertical: 8,
  },
  autoLoadingTitle: {
    color: '#fff',
    fontSize: 26,
    fontWeight: '700',
    marginTop: 12,
    textAlign: 'center',
    textShadowColor: '#02A9FF',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  autoLoadingSubtitle: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 17,
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 4,
    textShadowColor: 'rgba(2, 169, 255, 0.5)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 3,
  },
  progressBarContainer: {
    width: '100%',
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 4,
    marginVertical: 8,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#02A9FF',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarShimmer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '50%',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    transform: [{ skewX: '-20deg' }],
  },
  cancelButton: {
    marginTop: 16,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  cancelButtonGradient: {
    paddingVertical: 12,
    paddingHorizontal: 28,
  },
  cancelButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    opacity: 0.9,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  qualitySelectionContainer: {
    alignItems: 'center',
    width: '100%',
  },
  sourceCountBadge: {
    backgroundColor: 'rgba(2, 169, 255, 0.2)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginTop: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(2, 169, 255, 0.4)',
  },
  sourceCountText: {
    color: '#02A9FF',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  qualityList: {
    width: '100%',
    maxHeight: 300,
    marginVertical: 16,
  },
  qualityButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(30, 30, 30, 0.6)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  defaultQualityButton: {
    borderColor: '#02A9FF',
    backgroundColor: 'rgba(2, 169, 255, 0.1)',
  },
  qualityButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  qualityInfo: {
    flex: 1,
    flexDirection: 'column',
  },
  qualityLabel: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  sourceTypeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
  },
  sourceTypeText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
    fontWeight: '500',
  },
  recommendedBadge: {
    backgroundColor: '#02A9FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginLeft: 8,
  },
  recommendedText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  selectionFooter: {
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 8,
  },
  footerHint: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
    fontWeight: '500',
  },
  shimmer: {
    width: '100%',
    height: 60,
    borderRadius: 12,
    marginTop: 24,
  },
  typeSelection: {
    alignItems: 'center',
    width: '100%',
  },
  title: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 8,
    textAlign: 'center',
    textShadowColor: 'rgba(2, 169, 255, 0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  subtitle: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 16,
    marginBottom: 32,
    textAlign: 'center',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    width: '100%',
    gap: 16,
  },
  buttonWrapper: {
    position: 'relative',
    marginHorizontal: 8,
    flex: 1,
  },
  buttonGlow: {
    position: 'absolute',
    top: -8,
    left: -8,
    right: -8,
    bottom: -8,
    backgroundColor: '#02A9FF',
    borderRadius: 24,
    opacity: 0,
  },
  buttonGlowActive: {
    opacity: 0.2,
  },
  versionButton: {
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  versionButtonActive: {
    elevation: 8,
    shadowOpacity: 0.5,
    shadowRadius: 8,
    borderColor: '#02A9FF',
  },
  buttonGradient: {
    paddingVertical: 18,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonIcon: {
    fontSize: 22,
    marginRight: 10,
  },
  versionButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    opacity: 0.8,
  },
  versionButtonTextActive: {
    opacity: 1,
  },
  loadingTextContainer: {
    alignItems: 'center',
    marginTop: 24,
    width: '100%',
  },
  loadingText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 24,
    textAlign: 'center',
  },
  errorContainer: {
    alignItems: 'center',
    padding: 32,
  },
  errorText: {
    color: '#ff4444',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: '#02A9FF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  pillContainer: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    pointerEvents: 'none',
  },
  pillBackground: {
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    borderRadius: 30,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: '#02A9FF',
    shadowColor: '#02A9FF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 6,
  },
  pillContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#02A9FF',
    marginRight: 10,
    shadowColor: '#02A9FF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 5,
  },
  pillText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  zoroServerButton: {
    borderColor: '#FF6B6B',
    backgroundColor: 'rgba(255, 107, 107, 0.1)',
  },
  serverBadge: {
    backgroundColor: '#FF6B6B',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginLeft: 8,
  },
  serverText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  zoroScrollContainer: {
    maxHeight: 400,
    width: '100%',
    marginVertical: 16,
  },
  serverSection: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  sectionCount: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 14,
    fontWeight: '500',
  },
  serverGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  serverButton: {
    backgroundColor: 'rgba(30, 30, 30, 0.6)',
    borderRadius: 12,
    padding: 12,
    minWidth: 80,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  defaultServerButton: {
    borderColor: '#02A9FF',
    backgroundColor: 'rgba(2, 169, 255, 0.1)',
  },
  dubServerButton: {
    borderColor: '#FF6B6B',
    backgroundColor: 'rgba(255, 107, 107, 0.1)',
  },
  serverButtonContent: {
    alignItems: 'center',
  },
  serverButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  closeButtonTop: {
    position: 'absolute',
    top: -8,
    right: -8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  
  // Zencloud Section Styles
  zencloudSection: {
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 215, 0, 0.2)',
    paddingTop: 16,
  },
  zencloudHeader: {
    marginBottom: 12,
  },
  zencloudTitle: {
    color: '#FFD700',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 4,
  },
  zencloudSubtitle: {
    color: 'rgba(255, 215, 0, 0.8)',
    fontSize: 12,
    fontWeight: '500',
  },
  zencloudLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 8,
  },
  zencloudLoadingText: {
    color: '#FFD700',
    fontSize: 13,
    fontWeight: '500',
  },
  zencloudError: {
    backgroundColor: 'rgba(255, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 68, 68, 0.3)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  zencloudErrorText: {
    color: '#FF4444',
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 8,
  },
  zencloudRetryButton: {
    backgroundColor: 'rgba(255, 68, 68, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  zencloudRetryText: {
    color: '#FF4444',
    fontSize: 12,
    fontWeight: '600',
  },
  zencloudContent: {
    gap: 12,
  },
  zencloudPlayButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFD700',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  zencloudPlayText: {
    color: '#000',
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
  },
  zencloudQualityBadge: {
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  zencloudQualityText: {
    color: '#000',
    fontSize: 11,
    fontWeight: '600',
  },
});
