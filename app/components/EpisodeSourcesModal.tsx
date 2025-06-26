import React, { useState, useEffect, useCallback } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Animated, Dimensions, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import axios from 'axios';
import LottieView from 'lottie-react-native';
import { LinearGradient as ExpoLinearGradient } from 'expo-linear-gradient';
import Reanimated, { 
  useAnimatedStyle, 
  withRepeat, 
  withSequence,
  useSharedValue,
  withTiming,
  Easing,
  FadeIn,
  FadeOut
} from 'react-native-reanimated';
import { createShimmerPlaceholder } from 'react-native-shimmer-placeholder';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { FontAwesome5 } from '@expo/vector-icons';
import { ScrollView } from 'react-native';
import { animeProviderManager } from '../../api/proxy/providers/anime';
import { zoroProvider } from '../../api/proxy/providers/anime/zorohianime';
import { animePaheProvider } from '../../api/proxy/providers/anime/animepahe';

const ShimmerPlaceholder = createShimmerPlaceholder(ExpoLinearGradient);
const AnimatedLinearGradient = Reanimated.createAnimatedComponent(ExpoLinearGradient);
const ReanimatedTouchableOpacity = Reanimated.createAnimatedComponent(TouchableOpacity);

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

// Add this new component for the auto-select mode pill indicator
const AutoSelectPill = ({ visible, message = "Loading video..." }: { visible: boolean; message?: string }) => {
  const opacity = useSharedValue(0.7);
  const scale = useSharedValue(1);
  
  useEffect(() => {
    // Create a subtle pulsing effect
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.95, { duration: 800, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.7, { duration: 800, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
    
    scale.value = withRepeat(
      withSequence(
        withTiming(1.05, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
  }, []);
  
  const pillStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }]
  }));
  
  if (!visible) return null;
  
  return (
    <Reanimated.View 
      style={[styles.pillContainer]}
      entering={FadeIn.duration(300)}
      exiting={FadeOut.duration(300)}
    >
      <Reanimated.View style={[styles.pillBackground, pillStyle]}>
        <View style={styles.pillContent}>
          <View style={styles.loadingDot} />
          <Text style={styles.pillText}>{message}</Text>
        </View>
      </Reanimated.View>
    </Reanimated.View>
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

// Add this new component for animated particles
const AnimatedParticle = ({ index, totalParticles }: { index: number; totalParticles: number }) => {
  const animatedValue = useSharedValue(0);
  
  useEffect(() => {
    const delay = index * 200;
    setTimeout(() => {
      animatedValue.value = withRepeat(
        withTiming(1, { duration: 1500 + Math.random() * 1000 }),
        -1,
        false
      );
    }, delay);
  }, [index]);
  
  const particleStyle = useAnimatedStyle(() => {
    const size = 4 + Math.random() * 4;
    const angle = (index / totalParticles) * Math.PI * 2;
    const radius = 30 + Math.random() * 40;
    
    return {
      width: size,
      height: size,
      borderRadius: size / 2,
      backgroundColor: index % 3 === 0 ? '#02A9FF' : index % 3 === 1 ? '#5D3FD3' : '#FF6B6B',
      position: 'absolute',
      opacity: 0.2 + (animatedValue.value * 0.8),
      transform: [
        { translateX: radius * Math.cos(angle) * (0.4 + animatedValue.value * 0.6) },
        { translateY: radius * Math.sin(angle) * (0.4 + animatedValue.value * 0.6) },
        { scale: 0.5 + animatedValue.value * 1 }
      ]
    };
  });
  
  return <Reanimated.View style={particleStyle} />;
};

const AnimatedParticles = () => {
  const particles = Array(12).fill(0);
  
  return (
    <View style={styles.particleContainer}>
      {particles.map((_, index) => (
        <AnimatedParticle key={index} index={index} totalParticles={particles.length} />
      ))}
    </View>
  );
};

// Enhanced loading spinner with glow effect
const LoadingSpinner = () => {
  const spinAnim = useSharedValue(0);
  const glowAnim = useSharedValue(0);

  useEffect(() => {
    spinAnim.value = withRepeat(
      withTiming(1, { 
        duration: 1000,
        easing: Easing.linear
      }),
      -1
    );
    
    glowAnim.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.4, { duration: 800, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
  }, []);

  const spinStyle = useAnimatedStyle(() => ({
    transform: [
      { rotate: `${spinAnim.value * 360}deg` }
    ]
  }));
  
  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowAnim.value,
    transform: [
      { scale: 0.8 + (glowAnim.value * 0.4) }
    ]
  }));

  return (
    <View style={styles.spinnerContainer}>
      <Reanimated.View style={[styles.spinnerGlow, glowStyle]} />
      <Reanimated.View style={[styles.spinner, spinStyle]}>
        <View style={styles.spinnerRing}>
          <View style={styles.spinnerDot} />
          <View style={[styles.spinnerDot, { transform: [{ rotate: '90deg' }, { translateY: -40 }] }]} />
          <View style={[styles.spinnerDot, { transform: [{ rotate: '180deg' }, { translateY: -40 }] }]} />
          <View style={[styles.spinnerDot, { transform: [{ rotate: '270deg' }, { translateY: -40 }] }]} />
        </View>
      </Reanimated.View>
      <AnimatedParticles />
    </View>
  );
};

// Animated progress bar with shimmer effect
const LoadingProgress = () => {
  const progress = useSharedValue(0);
  const shimmer = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(0.95, { 
      duration: 5000, 
      easing: Easing.bezier(0.25, 0.1, 0.25, 1) 
    });
    
    shimmer.value = withRepeat(
      withTiming(1, { duration: 1000, easing: Easing.linear }),
      -1,
      false
    );
  }, []);

  const progressStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }));
  
  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -100 + shimmer.value * 200 }],
  }));

  return (
    <View style={styles.progressBarContainer}>
      <Reanimated.View style={[styles.progressBar, progressStyle]}>
        <Reanimated.View style={[styles.progressBarShimmer, shimmerStyle]} />
      </Reanimated.View>
    </View>
  );
};

// Replace the AutoLoadingMessage component
const AutoLoadingMessage = ({ 
  episodeNumber, 
  onClose 
}: { 
  episodeNumber: string; 
  onClose: () => void;
}) => {
  const scaleAnim = useSharedValue(1);
  const textOpacity = useSharedValue(1);
  const [messageIndex, setMessageIndex] = useState(0);
  
  useEffect(() => {
    // Subtle pulse animation
    scaleAnim.value = withRepeat(
      withSequence(
        withTiming(1.03, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
    
    // Cycle through loading messages
    const interval = setInterval(() => {
      textOpacity.value = withSequence(
        withTiming(0, { duration: 300 }),
        withTiming(1, { duration: 300 })
      );
      setMessageIndex((prev) => (prev + 1) % LoadingMessages.length);
    }, 3500);
    
    return () => clearInterval(interval);
  }, []);
  
  const containerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scaleAnim.value }]
  }));
  
  const msgStyle = useAnimatedStyle(() => ({
    opacity: textOpacity.value,
    transform: [{ translateY: (1 - textOpacity.value) * 8 }]
  }));

  return (
    <Reanimated.View style={[styles.autoLoadingContainer, containerStyle]}>
      <View style={styles.autoLoadingContent}>
        <View style={styles.glowContainer}>
          <LoadingSpinner />
        </View>
        <Reanimated.Text style={[styles.autoLoadingTitle, msgStyle]}>
          🔥 Finding Episode {episodeNumber}
        </Reanimated.Text>
        <Reanimated.Text style={[styles.autoLoadingSubtitle, msgStyle]}>
          {LoadingMessages[messageIndex]}
        </Reanimated.Text>
        <LoadingProgress />
        <ReanimatedTouchableOpacity 
          style={styles.cancelButton}
          onPress={() => {
            // Add micro-animation on press
            scaleAnim.value = withSequence(
              withTiming(0.95, { duration: 100 }),
              withTiming(1, { duration: 100 })
            );
            onClose();
          }}
        >
          <ExpoLinearGradient
            colors={['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.05)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.cancelButtonGradient}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </ExpoLinearGradient>
        </ReanimatedTouchableOpacity>
      </View>
    </Reanimated.View>
  );
};

const ANILIST_GRAPHQL_ENDPOINT = 'https://graphql.anilist.co';

interface Source {
  quality: string;
  url: string;
  type: 'sub' | 'dub';
  headers: Record<string, string>;
  isM3U8?: boolean;
}

interface Subtitle {
  url: string;
  lang: string;
}

interface VideoTimings {
  intro?: { start: number; end: number; };
  outro?: { start: number; end: number; };
}

const VersionButton = ({ 
  type, 
  isSelected, 
  onPress 
}: { 
  type: 'sub' | 'dub', 
  isSelected: boolean, 
  onPress: () => void 
}) => {
  const scale = useSharedValue(1);
  const glow = useSharedValue(0);
  
  const handlePressIn = () => {
    scale.value = withSequence(
      withTiming(0.95, { duration: 100 }),
      withTiming(1, { duration: 100 })
    );
    glow.value = withTiming(1, { duration: 200 });
  };

  const handlePressOut = () => {
    glow.value = withTiming(0, { duration: 200 });
  };

  const buttonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    shadowOpacity: glow.value * 0.5,
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glow.value * 0.4,
  }));

  return (
    <View style={styles.buttonWrapper}>
      <Reanimated.View style={[
        styles.buttonGlow,
        isSelected && styles.buttonGlowActive,
        glowStyle
      ]} />
      <ReanimatedTouchableOpacity
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={onPress}
        style={[
          styles.versionButton,
          isSelected && styles.versionButtonActive,
          buttonStyle
        ]}
      >
        <ExpoLinearGradient
          colors={isSelected ? ['#02A9FF', '#0066FF'] : ['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.05)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.buttonGradient}
        >
          <View style={styles.buttonContent}>
            <Text style={styles.buttonIcon}>
              {type === 'sub' ? '💬' : '🎤'}
            </Text>
            <Text style={[styles.versionButtonText, isSelected && styles.versionButtonTextActive]}>
              {type === 'sub' ? 'Subbed' : 'Dubbed'}
            </Text>
          </View>
        </ExpoLinearGradient>
      </ReanimatedTouchableOpacity>
    </View>
  );
};

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
  currentProvider
}: {
  visible: boolean;
  episodeId: string;
  onClose: () => void;
  onSelectSource: (url: string, headers: any, episodeId: string, episodeNumber: string, subtitles?: Subtitle[], timings?: VideoTimings, anilistId?: string, dataKey?: string) => void;
  preferredType?: 'sub' | 'dub';
  animeTitle?: string;
  malId?: string;
  anilistId?: string;
  autoSelectSource?: boolean;
  mangaTitle?: string;
  currentProvider?: string;
}) {
  // Load source settings
  const sourceSettings = useSourceSettings();
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
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [showProgress, setShowProgress] = useState(false);
  const [episodeNumber, setEpisodeNumber] = useState('');
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
  
  // Extract episode number from the episode ID
  useEffect(() => {
    if (episodeId) {
      let epNum;
      let animeIdMatch;
      
      // Support new simplified format: {anime id}/{episode number}
      if (episodeId.includes('/')) {
        // New format: animeId/episodeNumber
        const parts = episodeId.split('/');
        animeIdMatch = parts[0];
        epNum = parts[1] || '1';
      } else if (episodeId.includes('?ep=')) {
        // Legacy format: animeId?ep=episodeNumber
        epNum = episodeId.split('?ep=')[1] || '1';
        animeIdMatch = episodeId.split('?')[0];
      } else {
        // Default fallback
        epNum = '1';
        animeIdMatch = episodeId;
      }
      
      setEpisodeNumber(epNum);
      
      if (animeIdMatch) {
        setAnimeId(animeIdMatch);
      }
      
      // Debug log for URL format detection
      console.log(`🎬 [EPISODE DETECTION] episodeId="${episodeId}" => animeId="${animeIdMatch}", episodeNumber="${epNum}"`);
    }
  }, [episodeId]);

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        })
      ]).start();

      // Log user settings when modal is shown
      const logUserSettings = async () => {
        try {
          console.log('\n=== EPISODE SOURCES MODAL USER SETTINGS ===');
          console.log('Modal visible with preferred type:', preferredType);
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

      // Always fetch sources for the preferred type when modal opens
      setLoading(true);
      // Use source settings to determine initial type and auto-select behavior
      let initialType = sourceSettings.preferredType || preferredType || 'sub';
      const shouldAutoSelect = sourceSettings.autoSelectSource;
      
      // For AnimePahe, force SUB type since it doesn't support DUB
      if (currentProvider === 'animepahe') {
        initialType = 'sub';
      }
      
      setType(initialType);
      setPillVisible(shouldAutoSelect);
      
      if (shouldAutoSelect) {
        setPillMessage(`Loading ${initialType} version...`);
      }
      
      // For AnimePahe, automatically start fetching SUB sources without showing selection
      if (currentProvider === 'animepahe') {
        fetchSources(episodeId, 'sub');
      } else {
        fetchSources(episodeId, initialType);
      }
    } else {
      fadeAnim.setValue(0);
      scaleAnim.setValue(0.95);
      // Hide pill when modal closes
      setPillVisible(false);
    }
  }, [visible]);

  const formatSourceWithHeaders = (source: any, apiHeaders: any, sourceType: 'sub' | 'dub'): Source => {
    const headers = {
      ...apiHeaders,
      Referer: 'https://hianime.to/',
      Origin: 'https://hianime.to',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/98.0.4758.102 Safari/537.36'
    };
    
    return {
      url: source.url,
      quality: source.quality || 'default',
      type: sourceType,
      headers: headers,
      isM3U8: source.url.includes('.m3u8') || source.isM3U8
    };
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

  const fetchSources = async (episodeId: string, type: 'sub' | 'dub') => {
    // Use source settings for auto-select behavior
    const shouldAutoSelect = sourceSettings.autoSelectSource && autoSelectSource;
    
    try {
      console.log(`\n=== EPISODE SOURCES MODAL DEBUG (PROVIDER SEPARATION) ===`);
      console.log(`📡 Fetching ${type.toUpperCase()} sources for episode ${episodeId}`);
      console.log(`📺 Anime title:`, animeTitle);
      console.log(`🆔 AniList ID:`, anilistId);
      console.log(`🔄 Auto-select mode: ${shouldAutoSelect ? 'ON' : 'OFF'} (from settings)`);
      console.log(`🎯 Provider priority: ${sourceSettings.providerPriority.join(' → ')}`);
      console.log(`🎯 Default provider: ${sourceSettings.defaultProvider}`);
      
      setError(null);
      setLoading(true);

      // Extract episode number from episodeId
      let episodeNum;
      if (episodeId.includes('/')) {
        // New format: animeId/episodeNumber
        episodeNum = episodeId.split('/')[1] || '1';
      } else if (episodeId.includes('?ep=')) {
        // Legacy format: animeId?ep=episodeNumber
        episodeNum = episodeId.split('?ep=')[1] || '1';
      } else {
        episodeNum = '1';
      }
      
      console.log(`📺 Episode number:`, episodeNum);
      
      // Determine which providers to try based on settings and availability
      // If currentProvider is specified, use that first, otherwise use settings
      const providersToTry = currentProvider 
        ? [currentProvider] // Use the provider selected in EpisodeList
        : shouldAutoSelect && !sourceSettings.defaultProvider 
          ? sourceSettings.providerPriority 
          : sourceSettings.defaultProvider 
            ? [sourceSettings.defaultProvider]
            : sourceSettings.providerPriority;
          
      console.log(`🎯 Providers to try: ${providersToTry.join(' → ')}`);
      
      let watchResult: any = null;
      let successfulProvider: string = '';
      
      // Try each provider in order
      for (const provider of providersToTry) {
        try {
          console.log(`🔄 Trying provider: ${provider}`);
          
          if (provider === 'zoro') {
            // ZoroHiAnime Provider - uses new HiAnime endpoints
            if (!anilistId) {
              console.log(`❌ Skipping Zoro: AniList ID required`);
              continue;
            }
            
            console.log(`📡 [ZORO] Fetching ${type} data for AniList ID: ${anilistId}, Episode: ${episodeNum}`);
            
            const zoroWatchData = await zoroProvider.getWatchData(episodeId, type === 'dub');
            
            if (zoroWatchData && zoroWatchData.sources && zoroWatchData.sources.length > 0) {
              console.log(`✅ [ZORO] Found ${zoroWatchData.sources.length} sources`);
              watchResult = {
                success: true,
                provider: 'zoro',
                data: zoroWatchData
              };
              successfulProvider = 'Zoro/HiAnime';
              break;
            } else {
              console.log(`❌ [ZORO] No sources found`);
            }
            
          } else if (provider === 'animepahe') {
            // AnimePahe Provider - uses Consumet API
            if (!animeTitle) {
              console.log(`❌ Skipping AnimePahe: Anime title required`);
              continue;
            }
            
            console.log(`📡 [ANIMEPAHE] Fetching ${type} data for anime: ${animeTitle}, Episode: ${episodeNum}`);
            
            // First get the anime ID from AnimePahe
            const animeId = await animePaheProvider.getAnimeIdByTitle(animeTitle);
            if (!animeId) {
              console.log(`❌ [ANIMEPAHE] Could not find anime ID for: ${animeTitle}`);
              continue;
            }
            
            console.log(`✅ [ANIMEPAHE] Found anime ID: ${animeId}`);
            
            // Get watch data using anime ID and episode number
            const paheWatchData = await animePaheProvider.getWatchData(animeId, parseInt(episodeNum), type === 'dub');
            
            if (paheWatchData && paheWatchData.sources && paheWatchData.sources.length > 0) {
              console.log(`✅ [ANIMEPAHE] Found ${paheWatchData.sources.length} sources`);
              watchResult = {
                success: true,
                provider: 'animepahe',
                data: paheWatchData
              };
              successfulProvider = 'AnimePahe';
              break;
            } else {
              console.log(`❌ [ANIMEPAHE] No sources found`);
            }
          }
          
        } catch (providerError) {
          console.error(`❌ [${provider.toUpperCase()}] Error:`, providerError);
          continue;
        }
      }
      
      // Check if we found any sources
      if (!watchResult || !watchResult.success) {
        console.log(`❌ No sources found from any provider`);
        
        // If we're looking for dub and auto-select is enabled, automatically try sub
        if (type === 'dub' && shouldAutoSelect && sourceSettings.autoTryAlternateVersion) {
          console.log(`🔄 Auto-fallback: Trying SUB version instead...`);
          setPillMessage('Dub not available, loading sub version...');
          return fetchSources(episodeId, 'sub');
        }
        
        throw new Error(`No ${type.toUpperCase()} sources found from any provider`);
      }
      
      console.log(`✅ Found sources from provider: ${successfulProvider}`);
      console.log(`📊 Sources available: ${watchResult.data.sources.length}`);
      console.log(`📊 Subtitles available: ${watchResult.data.subtitles?.length || 0}`);
      
      // Create direct references to API data
      let directTimings: VideoTimings | undefined = undefined;
      if (watchResult.data.intro || watchResult.data.outro) {
        console.log(`✅ Video timings available:`, {
          intro: watchResult.data.intro ? `${watchResult.data.intro.start}s - ${watchResult.data.intro.end}s` : 'None',
          outro: watchResult.data.outro ? `${watchResult.data.outro.start}s - ${watchResult.data.outro.end}s` : 'None'
        });
        
        directTimings = {
          intro: watchResult.data.intro,
          outro: watchResult.data.outro
        };
        
        // Update state variables for UI display
        setTimings(directTimings);
        if (watchResult.data.intro) {
          setIntroStartTime(watchResult.data.intro.start);
          setIntroEndTime(watchResult.data.intro.end);
        }
        if (watchResult.data.outro) {
          setOutroStartTime(watchResult.data.outro.start);
          setOutroEndTime(watchResult.data.outro.end);
        }
      }

      // Process sources
      const allSources = watchResult.data.sources || [];
      console.log(`📊 RAW SOURCES:`, allSources.length);

      if (allSources.length > 0) {
        // Format sources with headers
        const formattedSources = allSources.map((source: any) => 
          formatSourceWithHeaders(source, watchResult.data.headers || {}, type)
        );
        
        console.log(`✅ Found ${type.toUpperCase()} sources: ${formattedSources.length}`);
        
        // Create direct subtitles array from API response
        let directSubtitles: Subtitle[] = watchResult.data.subtitles || [];
        
        if (directSubtitles.length > 0) {
          const subLangs = directSubtitles.map((sub: any) => sub.lang).join(', ');
          console.log(`✅ Subtitles available: ${directSubtitles.length} - Languages: ${subLangs}`);
          setSubtitles(directSubtitles);
        } else {
          console.log(`ℹ️ No subtitles available`);
          setSubtitles([]);
        }
        
        // Update sources state for UI
        setSources(formattedSources);
        
        // Determine if we should show source selection or auto-select
        const hasMultipleSources = formattedSources.length > 1;
        const shouldShowSelection = hasMultipleSources && !shouldAutoSelect;
        
        console.log(`📊 Multiple sources available: ${hasMultipleSources}`);
        console.log(`📊 Should show selection: ${shouldShowSelection}`);
        
        if (shouldShowSelection) {
          // Check if this is from Zoro provider and get both SUB/DUB servers
          const isZoroProvider = successfulProvider.includes('Zoro') || successfulProvider.includes('HiAnime');
          
          if (isZoroProvider && anilistId) {
            console.log(`📊 Zoro provider detected, checking for SUB/DUB server options...`);
            
            try {
              // Get all server options for both SUB and DUB
              const allServerOptions = await zoroProvider.getAllServerOptions(episodeId);
              
              if (allServerOptions.sub.length > 0 || allServerOptions.dub.length > 0) {
                console.log(`📊 Found SUB servers: ${allServerOptions.sub.length}, DUB servers: ${allServerOptions.dub.length}`);
                
                // Store all server options for the modal
                setAvailableQualities([]);
                setSubtitles(directSubtitles);
                setTimings(directTimings || null);
                
                // Set special flag for Zoro multi-server view
                setShowQualitySelection(true);
                setLoading(false);
                
                // Store server options in state (we'll use a different approach)
                (window as any).zoroServerOptions = {
                  sub: allServerOptions.sub,
                  dub: allServerOptions.dub,
                  subtitles: directSubtitles,
                  timings: directTimings
                };
                
                console.log(`📊 Prepared Zoro server selection with SUB/DUB sections`);
                return;
              }
            } catch (error) {
              console.warn(`❌ Failed to get Zoro server options, falling back to regular selection:`, error);
            }
          }
          
          // Fallback to regular quality selection for non-Zoro or if Zoro server fetch failed
          const qualityOptions = formattedSources.map((source: Source, index: number) => {
            // Check if this is from Zoro provider (has server name in quality)
            const isZoroSource = source.quality && source.quality.includes('HD-');
            
            return {
              quality: source.quality || `Source ${index + 1}`,
              url: source.url,
              isDefault: index === 0, // First source is default
              headers: source.headers,
              isZoroServer: isZoroSource
            };
          });
          
          // Sort sources: Zoro servers first (HD-1, HD-2, etc.), then others
          qualityOptions.sort((a: typeof qualityOptions[0], b: typeof qualityOptions[0]) => {
            if (a.isZoroServer && !b.isZoroServer) return -1;
            if (!a.isZoroServer && b.isZoroServer) return 1;
            
            if (a.isZoroServer && b.isZoroServer) {
              // Sort HD servers numerically (HD-1, HD-2, HD-3)
              const getHDNumber = (quality: string) => {
                const match = quality.match(/HD-(\d+)/);
                return match ? parseInt(match[1], 10) : 999;
              };
              return getHDNumber(a.quality) - getHDNumber(b.quality);
            }
            
            // For non-Zoro sources, sort by quality numbers
            const getQualityNumber = (q: string) => {
              const match = q.match(/(\d+)p/);
              return match ? parseInt(match[1], 10) : 0;
            };
            return getQualityNumber(b.quality) - getQualityNumber(a.quality);
          });
          
          setAvailableQualities(qualityOptions);
          setShowQualitySelection(true);
          setLoading(false);
          
          // Store subtitles and timings for later use
          setSubtitles(directSubtitles);
          setTimings(directTimings || null);
          
          console.log(`📊 Prepared ${qualityOptions.length} server/quality options for user selection`);
          return;
        } else {
          // Auto-select mode or single source - proceed with automatic selection
          setPillMessage(`Loading ${type} version from ${successfulProvider}...`);
          
          // Prefer HLS (m3u8) streams if available and setting is enabled
          let selectedSource: Source | null = null;
          
          if (sourceSettings.preferHLSStreams) {
            selectedSource = formattedSources.find((source: Source) => source.isM3U8) || null;
            if (selectedSource) {
              console.log(`✅ Selected HLS (m3u8) stream for ${type} from ${successfulProvider}`);
            }
          }
          
          // Fallback to first available source if no HLS found or HLS not preferred
          if (!selectedSource) {
            selectedSource = formattedSources[0];
            if (selectedSource) {
              console.log(`✅ Selected ${selectedSource.isM3U8 ? 'HLS' : 'direct'} stream for ${type} from ${successfulProvider}`);
            }
          }
          
          if (selectedSource) {
            handleDirectSourceSelect(selectedSource, directSubtitles, directTimings, anilistId);
            return;
          }
        }
      } else {
        console.log(`❌ No sources available from any provider`);
        
        // If we're looking for dub and auto-select is enabled, automatically try sub
        if (type === 'dub' && shouldAutoSelect && sourceSettings.autoTryAlternateVersion) {
          console.log(`🔄 Auto-fallback: No DUB sources available, trying SUB...`);
          setPillMessage('Dub sources not available, loading sub...');
          return fetchSources(episodeId, 'sub');
        }
        
        throw new Error(`No ${type} version available from any provider`);
      }
      
      console.log(`=== END EPISODE SOURCES MODAL DEBUG ===\n`);

      // Update pill message to reflect current status
      if (shouldAutoSelect) {
        setPillMessage(`Found episode ${episodeNum} from ${successfulProvider}...`);
      }
    } catch (error) {
      console.error(`❌ Error:`, error);
      console.error(`❌ ERROR STACK TRACE:`, error instanceof Error ? error.stack : 'No stack trace');
      
      // If we're looking for dub and auto-select is enabled, automatically try sub as last resort
      if (type === 'dub' && shouldAutoSelect && sourceSettings.autoTryAlternateVersion && !error?.toString().includes('SUB')) {
        console.log(`🔄 Final auto-fallback: DUB failed with error, trying SUB as last resort...`);
        setPillMessage('Dub failed, trying sub...');
        return fetchSources(episodeId, 'sub');
      }
      
      setError(error instanceof Error ? error.message : 'Failed to fetch sources');
      console.log(`=== END EPISODE SOURCES MODAL DEBUG ===\n`);
      
      // Update pill message for errors
      if (shouldAutoSelect) {
        setPillMessage(`Error: ${error instanceof Error ? error.message : 'Failed to load'}`);
        // Auto-hide pill after error is shown
        setTimeout(() => setPillVisible(false), 3000);
      }
      
      // If we're in auto-select mode and encounter an error, close the modal
      if (shouldAutoSelect) {
        onClose();
      }
    } finally {
      setLoading(false);
    }
  };

  // Update the handleDirectSourceSelect function to include a dataKey parameter
  const handleDirectSourceSelect = (source: Source, directSubtitles: Subtitle[], directTimings?: VideoTimings, anilistId?: string) => {
    // Log detailed information about the selected source
    console.log('\n=== SOURCE SELECT DEBUG (DIRECT DATA) ===');
    console.log('[SOURCE SELECT DEBUG] Source URL:', source.url.substring(0, 50) + '...');
    console.log('[SOURCE SELECT DEBUG] Episode ID:', episodeId);
    console.log('[SOURCE SELECT DEBUG] Episode Number:', episodeNumber || '');
    console.log('[SOURCE SELECT DEBUG] Episode Number (parsed as int):', episodeNumber ? parseInt(episodeNumber) : undefined);
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
    AsyncStorage.setItem(dataKey, JSON.stringify({
      source: source.url,
      headers: source.headers,
      episodeId: episodeId,
      episodeNumber: episodeNumber ? parseInt(episodeNumber) : undefined,
      subtitles: directSubtitles || [],
      timings: directTimings || null,
      anilistId: anilistId || '',
      animeTitle: animeTitle || '',
      timestamp: Date.now()
    })).then(() => {
      console.log('[SOURCE SELECT DEBUG] Successfully stored video data with key:', dataKey);
    }).catch(err => {
      console.error('[SOURCE SELECT DEBUG] Error storing video data:', err);
    });
    
    // Update pill message before navigating
    if (autoSelectSource) {
      setPillMessage(`Starting Episode ${episodeNumber || ''}...`);
    }
    
    // Close the modal if auto-selecting
    if (autoSelectSource) {
      onClose();
    }
    
    // Close current modal and pass data back to caller
    // IMPORTANT: Use direct data references instead of state
    onSelectSource(source.url, source.headers, episodeId, episodeNumber || '', directSubtitles, directTimings, anilistId, dataKey);
  };

  // Similarly update the handleSourceSelect function
  const handleSourceSelect = (source: Source) => {
    // Capture subtitles state here to avoid race conditions
    // This ensures we always use the latest subtitles available
    const currentSubtitles = [...subtitles];
    const currentTimings = timings;

    // Log detailed information about the selected source
    console.log('\n=== SOURCE SELECT DEBUG (STATE DATA) ===');
    console.log('[SOURCE SELECT DEBUG] Source URL:', source.url.substring(0, 50) + '...');
    console.log('[SOURCE SELECT DEBUG] Episode ID:', episodeId);
    console.log('[SOURCE SELECT DEBUG] Episode Number:', episodeNumber || '');
    console.log('[SOURCE SELECT DEBUG] Episode Number (parsed as int):', episodeNumber ? parseInt(episodeNumber) : undefined);
    console.log('[SOURCE SELECT DEBUG] Anime ID:', animeId || '');
    console.log('[SOURCE SELECT DEBUG] AniList ID:', anilistId || 'Not provided');
    
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
      episodeNumber: episodeNumber ? parseInt(episodeNumber) : undefined,
      subtitles: currentSubtitles || [],
      timings: videoTimings || null,
      anilistId: anilistId || '',
      animeTitle: animeTitle || '',
      timestamp: Date.now()
    })).then(() => {
      console.log('[SOURCE SELECT DEBUG] Successfully stored video data with key:', dataKey);
    }).catch(err => {
      console.error('[SOURCE SELECT DEBUG] Error storing video data:', err);
    });
    
    // Close the modal if auto-selecting
    if (autoSelectSource) {
      onClose();
    }
    
    // Close current modal and pass data back to caller
    // Use the captured subtitles to avoid race conditions
    onSelectSource(source.url, source.headers, episodeId, episodeNumber || '', currentSubtitles, videoTimings, anilistId, dataKey);
  };

  const handleTypeSelect = (selectedType: 'sub' | 'dub') => {
    setType(selectedType);
    setLoading(true);
    setError(null);
    fetchSources(episodeId, selectedType);
  };

  // Handle Zoro server selection for SUB/DUB
  const handleZoroServerSelect = async (server: any, serverType: 'sub' | 'dub') => {
    try {
      console.log(`[ZoroServerSelect] Selected ${server.name} (${serverType})`);
      
      // Get watch data for this specific server
      const watchData = await zoroProvider.getWatchData(episodeId, serverType === 'dub');
      
      if (watchData && watchData.sources && watchData.sources.length > 0) {
        // Find the source from this specific server
        const serverSource = watchData.sources.find((source: any) => 
          source.quality && source.quality.includes(server.name)
        ) || watchData.sources[0];
        
        const formattedSource = formatSourceWithHeaders(serverSource, watchData.headers || {}, serverType);
        
        // Get stored data
        const storedData = (window as any).zoroServerOptions;
        const directSubtitles = storedData?.subtitles || [];
        const directTimings = storedData?.timings;
        
        handleDirectSourceSelect(formattedSource, directSubtitles, directTimings, anilistId);
      } else {
        throw new Error(`No sources available from ${server.name}`);
      }
    } catch (error) {
      console.error(`[ZoroServerSelect] Error selecting ${server.name}:`, error);
      setError(`Failed to load ${server.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Add new component for quality selection
  const QualitySelectionView = () => {
    // Check if we have Zoro server options stored
    const zoroOptions = (window as any).zoroServerOptions;
    const hasZoroOptions = zoroOptions && (zoroOptions.sub.length > 0 || zoroOptions.dub.length > 0);
    
    if (hasZoroOptions) {
      // Get the servers for the currently selected type (sub or dub)
      const currentServers = type === 'dub' ? zoroOptions.dub : zoroOptions.sub;
      
      // Render Zoro server selection for the selected type only
      return (
        <View style={styles.qualitySelectionContainer}>
          <Text style={styles.title}>🔥 HiAnime Servers</Text>
          <Text style={styles.subtitle}>
            Choose your preferred server for {type === 'dub' ? 'dubbed' : 'subbed'} version
          </Text>
          
          <View style={styles.sourceCountBadge}>
            <Text style={styles.sourceCountText}>{currentServers.length} {type.toUpperCase()} Servers Available</Text>
          </View>
          
          <ScrollView style={styles.qualityList} showsVerticalScrollIndicator={false}>
            {currentServers.map((server: any, index: number) => (
              <ReanimatedTouchableOpacity
                key={`${type}-${index}`}
                style={[
                  styles.qualityButton,
                  index === 0 && styles.defaultQualityButton,
                  styles.zoroServerButton
                ]}
                onPress={() => handleZoroServerSelect(server, type)}
              >
                <View style={styles.qualityButtonContent}>
                  <View style={styles.qualityInfo}>
                    <View>
                      <Text style={styles.qualityLabel}>{server.name}</Text>
                      <View style={styles.sourceTypeContainer}>
                        <Text style={styles.sourceTypeText}>
                          🔥 HiAnime Server
                        </Text>
                        {index === 0 && (
                          <View style={styles.recommendedBadge}>
                            <Text style={styles.recommendedText}>Recommended</Text>
                          </View>
                        )}
                        {index !== 0 && (
                          <View style={styles.serverBadge}>
                            <Text style={styles.serverText}>HiAnime</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  </View>
                  <FontAwesome5 name="play-circle" size={20} color="#02A9FF" />
                </View>
              </ReanimatedTouchableOpacity>
            ))}
          </ScrollView>
          
          <View style={styles.selectionFooter}>
            <Text style={styles.footerHint}>
              🎬 All servers provide HLS streaming with auto quality adaptation
            </Text>
          </View>
          
          <ReanimatedTouchableOpacity
            style={styles.backButton}
            onPress={() => {
              setShowQualitySelection(false);
              // Clear stored options
              delete (window as any).zoroServerOptions;
            }}
          >
            <Text style={styles.backButtonText}>← Go Back</Text>
          </ReanimatedTouchableOpacity>
        </View>
      );
    }
    
    // Fallback to regular quality selection
    return (
      <View style={styles.qualitySelectionContainer}>
        <Text style={styles.title}>Multiple Sources Found</Text>
        <Text style={styles.subtitle}>
          Choose from {availableQualities.length} available streaming {availableQualities.length === 1 ? 'source' : 'sources'}
        </Text>
        
        <View style={styles.sourceCountBadge}>
          <Text style={styles.sourceCountText}>{availableQualities.length} Sources Available</Text>
        </View>
        
        <ScrollView style={styles.qualityList} showsVerticalScrollIndicator={false}>
          {availableQualities.map((quality, index) => (
            <ReanimatedTouchableOpacity
              key={`quality-${index}`}
              style={[
                styles.qualityButton,
                quality.isDefault && styles.defaultQualityButton,
                quality.isZoroServer && styles.zoroServerButton
              ]}
              onPress={() => {
                // Create source object from selected quality
                const selectedSource: Source = {
                  url: quality.url,
                  quality: quality.quality,
                  type,
                  headers: quality.headers,
                  isM3U8: quality.url.includes('.m3u8')
                };
                
                // Use existing handler with this selection
                handleSourceSelect(selectedSource);
              }}
            >
              <View style={styles.qualityButtonContent}>
                <View style={styles.qualityInfo}>
                  <View>
                    <Text style={styles.qualityLabel}>{quality.quality}</Text>
                    <View style={styles.sourceTypeContainer}>
                      <Text style={styles.sourceTypeText}>
                        {quality.isZoroServer ? '🔥 HiAnime Server' : quality.url.includes('.m3u8') ? '🎬 HLS Stream' : '📺 Direct Stream'}
                      </Text>
                      {quality.isDefault && (
                        <View style={styles.recommendedBadge}>
                          <Text style={styles.recommendedText}>Recommended</Text>
                        </View>
                      )}
                      {quality.isZoroServer && !quality.isDefault && (
                        <View style={styles.serverBadge}>
                          <Text style={styles.serverText}>HiAnime</Text>
                        </View>
                      )}
                    </View>
                  </View>
                </View>
                <FontAwesome5 name="play-circle" size={20} color="#02A9FF" />
              </View>
            </ReanimatedTouchableOpacity>
          ))}
        </ScrollView>
        
        <View style={styles.selectionFooter}>
          <Text style={styles.footerHint}>
            💡 HLS streams typically offer better stability and quality adaptation
          </Text>
        </View>
        
        <ReanimatedTouchableOpacity
          style={styles.backButton}
          onPress={() => {
            setShowQualitySelection(false);
            setType(type); // Reset back to type selection
          }}
        >
          <Text style={styles.backButtonText}>← Go Back</Text>
        </ReanimatedTouchableOpacity>
      </View>
    );
  };

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
      
      // Check Zoro provider if AniList ID is available
      if (anilistId) {
        try {
          const subCheck = await zoroProvider.checkEpisodeAvailability(anilistId, parseInt(episodeNum));
          subAvailable = subCheck.sub;
          dubAvailable = subCheck.dub;
          console.log(`📊 [ZORO] Availability: SUB=${subAvailable}, DUB=${dubAvailable}`);
        } catch (error) {
          console.log(`❌ [ZORO] Availability check failed:`, error);
        }
      }
      
      // Check AnimePahe provider if anime title is available
      if (animeTitle && (!subAvailable || !dubAvailable)) {
        try {
          const paheAvailable = await animePaheProvider.checkEpisodeAvailability(animeTitle, parseInt(episodeNum));
          if (!subAvailable) subAvailable = paheAvailable;
          if (!dubAvailable) dubAvailable = paheAvailable; // AnimePahe supports both
          console.log(`📊 [ANIMEPAHE] Availability: SUB=${paheAvailable}, DUB=${paheAvailable}`);
        } catch (error) {
          console.log(`❌ [ANIMEPAHE] Availability check failed:`, error);
        }
      }
      
      console.log(`📊 Final availability: SUB=${subAvailable}, DUB=${dubAvailable}`);
      
      return { sub: subAvailable, dub: dubAvailable };
    } catch (error) {
      console.error('Error checking availability:', error);
      return { sub: true, dub: true }; // Assume both available if check fails
    }
  }, [animeTitle]);

  // Now replace the return statement entirely
  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="none"
      onRequestClose={onClose}
    >
      <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
        <BlurView intensity={20} tint="dark" style={styles.blurContainer}>
          <Animated.View style={[styles.content, { transform: [{ scale: scaleAnim }] }]}>
            {autoSelectSource ? (
              // Show simplified UI with prominent loading for auto-select mode
              <AutoLoadingMessage episodeNumber={episodeNumber} onClose={onClose} />
            ) : loading ? (
              // Regular loading UI for manual mode
              <View style={styles.loadingContainer}>
                <View style={styles.loadingContent}>
                  <View style={styles.spinnerContainer}>
                    <LoadingSpinner />
                  </View>
                  <View style={styles.loadingTextContainer}>
                    <Reanimated.Text style={styles.loadingText}>
                      {LoadingMessages[Math.floor(Math.random() * LoadingMessages.length)]}
                    </Reanimated.Text>
                    <LoadingProgress />
                  </View>
                  <ShimmerPlaceholder
                    style={styles.shimmer}
                    shimmerColors={['#02A9FF20', '#02A9FF40', '#02A9FF20']}
                  />
                  <ReanimatedTouchableOpacity 
                    style={styles.cancelButton}
                    onPress={onClose}
                  >
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </ReanimatedTouchableOpacity>
                </View>
              </View>
            ) : error ? (
              // Error state
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{error}</Text>
                <ReanimatedTouchableOpacity 
                  style={styles.retryButton}
                  onPress={() => handleTypeSelect(type)}
                >
                  <Text style={styles.retryButtonText}>Retry</Text>
                </ReanimatedTouchableOpacity>
              </View>
            ) : showQualitySelection ? (
              // Quality selection UI
              <QualitySelectionView />
            ) : (
              // Type selection UI 
              <View style={styles.typeSelection}>
                <ReanimatedTouchableOpacity 
                  style={styles.closeButtonTop}
                  onPress={onClose}
                >
                  <FontAwesome5 name="times" size={18} color="#FFFFFF" />
                </ReanimatedTouchableOpacity>
                
                <Text style={styles.title}>Choose Your Experience!</Text>
                <Text style={styles.subtitle}>Select your preferred version</Text>
                <View style={styles.buttonContainer}>
                  <VersionButton
                    type="sub"
                    isSelected={type === 'sub'}
                    onPress={() => handleTypeSelect('sub')}
                  />
                  {/* Only show DUB option if the provider supports it */}
                  {currentProvider !== 'animepahe' && (
                    <VersionButton
                      type="dub"
                      isSelected={type === 'dub'}
                      onPress={() => handleTypeSelect('dub')}
                    />
                  )}
                </View>
                {/* Show a note for providers that only support SUB */}
                {currentProvider === 'animepahe' && (
                  <Text style={[styles.subtitle, { marginTop: 16, fontSize: 14, opacity: 0.6 }]}>
                    AnimePahe only provides subtitled content
                  </Text>
                )}
              </View>
            )}
          </Animated.View>
        </BlurView>
      </Animated.View>
      
      {/* Also keep the pill for additional subtle feedback */}
      {autoSelectSource && (
        <AutoSelectPill 
          visible={pillVisible} 
          message={pillMessage} 
        />
      )}
    </Modal>
  );
}

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  blurContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    width: width * 0.9,
    maxWidth: 400,
    backgroundColor: 'rgba(18, 18, 18, 0.95)',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
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
  backButton: {
    backgroundColor: 'rgba(30, 30, 30, 0.8)',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  backButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    opacity: 0.8,
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
});
