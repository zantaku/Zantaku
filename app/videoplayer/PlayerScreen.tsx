// player screen 
// 1. top bar with title and back button
// 2. bottom bar with play/pause button, progress bar, and time display
// 3. video player
// 4. subtitles
// 5. speed selector
// 6. audio selector
// 7. settings
// 8. about
// 9. feedback
// 10. logout
// modern ui with blur effect and clean design
// use react native video for video player
// use react native blur view for blur effect
// use react native icons for icons
// use react native text for text
// use react native view for view
// use react native image for image
// use react native touchable opacity for touchable opacity
// use react native touchable without feedback for touchable without feedback

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  Dimensions,
  Text,
  TouchableWithoutFeedback,
  Alert,
  BackHandler,
  Platform,
  StatusBar,
  Animated,
  ToastAndroid,
  TouchableOpacity,
} from 'react-native';
import * as ExpoVideo from 'expo-video';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';
import { VideoView, useVideoPlayer, VideoSource } from 'expo-video';
import { useEvent } from 'expo';
import { useLocalSearchParams, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { STORAGE_KEY, ANILIST_GRAPHQL_ENDPOINT } from '../../constants/auth';
import { BlurView } from 'expo-blur';
import * as ScreenOrientation from 'expo-screen-orientation';

// Import components
import VideoControls from './components/VideoControls';
import DoubleTapOverlay from './components/DoubleTapOverlay';
import SettingsModal from './components/SettingsModal';
import SubtitleOptions from './components/SubtitleOptions';
import SpeedOptions from './components/SpeedOptions';
import SaveProgressModal from './components/SaveProgressModal';
import EnhancedExitModal from './components/EnhancedExitModal';
import BufferingIndicator from './components/BufferingIndicator';
import NextEpisodeCountdown from './components/NextEpisodeCountdown';
// import DebugOverlay from './components/DebugOverlay'; // Temporarily disabled

// Import types and constants
import { VideoProgressData, Subtitle, SubtitleCue, VideoTimings, AudioTrack } from './types';
import { usePlayerContext } from './PlayerContext';
import { EpisodeNavigationUtils, NextEpisodeResult } from '../../utils/episodeNavigation';
import {
  PLAYER_COLORS,
  PLAYER_BEHAVIOR,
  ANIMATIONS,
  M3U8_PROXY_BASE_URL,
  USE_PROXY,
  STORAGE_KEYS,
  DEBUG,
  AUTO_DETECT_TIMING,
  MODAL_STYLES,
} from './constants';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface VideoData {
  source: string;
  headers?: Record<string, string>;
  subtitles?: Subtitle[];
  timings?: VideoTimings;
  episodeId?: string;
  episodeNumber?: number;
  animeTitle?: string;
  anilistId?: string;
  audioTracks?: AudioTrack;
}

const PlayerScreen: React.FC = () => {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { preferences, setPreferences, anilistUser, onSaveToAniList, onEnterPiP, isPipSupported, isInPipMode } = usePlayerContext();
  
  // Add a simple delay to prevent viewState errors
  const [isVideoReady, setIsVideoReady] = useState(false);
  
  // Enhanced System PiP functionality for true system-wide PiP
  const handleSystemPiP = async () => {
    try {
      console.log('[SYSTEM PiP] 🚀 Attempting to enter native Picture-in-Picture mode...');
      
      // Check if PiP is supported
      const isSupported = ExpoVideo.isPictureInPictureSupported();
      
      if (!isSupported) {
        console.log('[SYSTEM PiP] ⚠️ PiP not supported on this device');
        // Don't show alert, just silently fail for better UX
        return false;
      }
      
             // Try to enter PiP mode using VideoView ref (most reliable method)
       if (videoRef.current && videoRef.current.startPictureInPicture) {
         try {
           await videoRef.current.startPictureInPicture();
           setPipMode(true);
           console.log('[SYSTEM PiP] ✅ Successfully entered native Picture-in-Picture mode!');
           return true;
         } catch (pipError) {
           console.error('[SYSTEM PiP] ❌ Failed to enter PiP mode:', pipError);
           
           // Show user-friendly message
           Alert.alert(
             'Picture-in-Picture',
             'Unable to enter Picture-in-Picture mode. This feature may not be available on your device.',
             [{ text: 'OK' }]
           );
           return false;
         }
       } else {
         console.log('[SYSTEM PiP] ⚠️ Video player not ready or PiP method not available');
         return false;
       }
    } catch (error) {
      console.error('[SYSTEM PiP] ❌ Error with system PiP:', error);
      return false;
    }
  };

  // Handle PiP mode changes
  const handlePiPStart = useCallback(() => {
    console.log('[SYSTEM PiP] 📱 Entered system Picture-in-Picture mode');
    setPipMode(true);
  }, []);

  const handlePiPStop = useCallback(() => {
    console.log('[SYSTEM PiP] 📱 Exited system Picture-in-Picture mode');
    setPipMode(false);
  }, []);


  
  // Video refs and state
  const videoRef = useRef<any>(null);
  const [videoData, setVideoData] = useState<VideoData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [paused, setPaused] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [progress, setProgress] = useState<VideoProgressData>({
    currentTime: 0,
    playableDuration: 0,
    seekableDuration: 0,
  });
  
  // Expo-video player state
  const [pipMode, setPipMode] = useState(false);
  
  // Buffering state
  const [isBuffering, setIsBuffering] = useState(false);
  const [bufferProgress, setBufferProgress] = useState(0);
  const [isSeeking, setIsSeeking] = useState(false);
  const [seekingPosition, setSeekingPosition] = useState(0);
  
  // UI state
  const [showControls, setShowControls] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(true);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showSubtitleOptions, setShowSubtitleOptions] = useState(false);
  const [showSpeedOptions, setShowSpeedOptions] = useState(false);
  const [showSaveProgressModal, setShowSaveProgressModal] = useState(false);
  const [showExitModal, setShowExitModal] = useState(false);
  
  // Playback state
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [scalingMode, setScalingMode] = useState('contain');
  const [autoRotateEnabled, setAutoRotateEnabled] = useState(true);
  const [selectedSubtitleLanguage, setSelectedSubtitleLanguage] = useState('English');
  const [currentAudioTrack, setCurrentAudioTrack] = useState<'sub' | 'dub'>('sub');
  
  // Subtitle state - Enhanced with binary search index
  const [currentSubtitle, setCurrentSubtitle] = useState<string>('');
  const [subtitleCues, setSubtitleCues] = useState<SubtitleCue[]>([]);
  const [subtitlePosition, setSubtitlePosition] = useState({ x: 0, y: 120 });
  
  // NEW: Resume state
  const [showResumeModal, setShowResumeModal] = useState(false);
  const [savedTimestamp, setSavedTimestamp] = useState<number | null>(null);
  
  // NEW: Next episode countdown state
  const [showNextEpisodeCountdown, setShowNextEpisodeCountdown] = useState(false);
  const [nextEpisodeData, setNextEpisodeData] = useState<NextEpisodeResult | null>(null);
  const [countdownDismissed, setCountdownDismissed] = useState(false);
  
  // Progress save throttling
  const lastProgressSaveRef = useRef(0);
  
  // Optimized subtitle lookup with binary search and caching
  const currentSubtitleIndexRef = useRef<number>(-1);
  const lastSubtitleLookupTimeRef = useRef<number>(-1);
  
  // Enhanced subtitle cue cache for faster lookups
  const subtitleCacheRef = useRef<{
    cues: SubtitleCue[];
    timeIndex: Map<number, number>; // time (rounded to 100ms) -> cue index
    sortedStartTimes: number[];
  }>({
    cues: [],
    timeIndex: new Map(),
    sortedStartTimes: []
  });
  
  // Function to build subtitle index for fast lookups
  const buildSubtitleIndex = useCallback((cues: SubtitleCue[]) => {
    const cache = {
      cues: [...cues].sort((a, b) => a.startTime - b.startTime),
      timeIndex: new Map<number, number>(),
      sortedStartTimes: [] as number[]
    };
    
    // Build time-based index (100ms precision for balance between accuracy and performance)
    cache.cues.forEach((cue, index) => {
      const startTimeKey = Math.floor(cue.startTime * 10); // 100ms precision
      const endTimeKey = Math.floor(cue.endTime * 10);
      
      // Map all time slots this cue covers
      for (let timeKey = startTimeKey; timeKey <= endTimeKey; timeKey++) {
        if (!cache.timeIndex.has(timeKey)) {
          cache.timeIndex.set(timeKey, index);
        }
      }
    });
    
    cache.sortedStartTimes = cache.cues.map(cue => cue.startTime);
    subtitleCacheRef.current = cache;
    
    console.log(`🚀 [SUBTITLE OPTIMIZATION] Built index for ${cues.length} cues with ${cache.timeIndex.size} time slots`);
  }, []);
  
  // Optimized subtitle lookup function using binary search
  const findSubtitleAtTime = useCallback((time: number): string => {
    const cache = subtitleCacheRef.current;
    if (cache.cues.length === 0) return '';
    
    // Fast lookup using time index (100ms precision)
    const timeKey = Math.floor(time * 10);
    const indexFromCache = cache.timeIndex.get(timeKey);
    
    if (indexFromCache !== undefined) {
      const cue = cache.cues[indexFromCache];
      if (time >= cue.startTime && time <= cue.endTime) {
        return cue.text;
      }
    }
    
    // Fallback to binary search for edge cases
    let left = 0;
    let right = cache.cues.length - 1;
    
    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      const cue = cache.cues[mid];
      
      if (time >= cue.startTime && time <= cue.endTime) {
        return cue.text;
      } else if (time < cue.startTime) {
        right = mid - 1;
      } else {
        left = mid + 1;
      }
    }
    
    return '';
  }, []);
  
  // Enhanced VTT parser with better WebVTT support
  const parseVTT = useCallback((vttContent: string): SubtitleCue[] => {
    const cues: SubtitleCue[] = [];
    const lines = vttContent.trim().split('\n');
    let i = 0;
    
    // Skip WEBVTT header and any initial metadata
    while (i < lines.length && (!lines[i].includes('-->'))) {
      i++;
    }
    
    while (i < lines.length) {
      // Skip empty lines
      if (!lines[i].trim()) {
        i++;
        continue;
      }
      
      // Look for timestamp line
      const timestampLine = lines[i].trim();
      if (timestampLine.includes('-->')) {
        const parts = timestampLine.split('-->').map(p => p.trim());
        if (parts.length === 2) {
          const startTime = parseTimeToSeconds(parts[0].split(' ')[0]); // Remove any positioning info
          const endTime = parseTimeToSeconds(parts[1].split(' ')[0]);
          
          // Collect subtitle text (handle multi-line subtitles)
          i++;
          const textLines: string[] = [];
          
          while (i < lines.length && lines[i].trim() && !lines[i].includes('-->')) {
            const line = lines[i].trim();
            // Remove WebVTT styling tags for better performance
            const cleanLine = line
              .replace(/<[^>]*>/g, '') // Remove HTML/WebVTT tags
              .replace(/&lt;/g, '<')
              .replace(/&gt;/g, '>')
              .replace(/&amp;/g, '&')
              .trim();
            
            if (cleanLine) {
              textLines.push(cleanLine);
            }
            i++;
          }
          
          if (textLines.length > 0 && startTime >= 0 && endTime > startTime) {
            cues.push({
              startTime,
              endTime,
              text: textLines.join('\n')
            });
          }
        } else {
          i++;
        }
      } else {
        i++;
      }
    }
    
    console.log(`🎯 [VTT PARSER] Parsed ${cues.length} subtitle cues from ${lines.length} lines`);
    return cues;
  }, []);
  
  // Enhanced time parsing with better accuracy
  const parseTimeToSeconds = useCallback((timeString: string): number => {
    try {
      // Handle both formats: HH:MM:SS.mmm and MM:SS.mmm
      const parts = timeString.split(':');
      let hours = 0, minutes = 0, seconds = 0;
      
      if (parts.length === 3) {
        // HH:MM:SS.mmm format
        hours = parseInt(parts[0], 10);
        minutes = parseInt(parts[1], 10);
        seconds = parseFloat(parts[2]);
      } else if (parts.length === 2) {
        // MM:SS.mmm format
        minutes = parseInt(parts[0], 10);
        seconds = parseFloat(parts[1]);
      } else {
        console.warn('🎯 [VTT PARSER] Invalid time format:', timeString);
        return -1;
      }
      
      return Math.max(0, hours * 3600 + minutes * 60 + seconds);
    } catch (error) {
      console.error('🎯 [VTT PARSER] Error parsing time:', timeString, error);
      return -1;
    }
  }, []);
  
  // Timing and skip state
  const [showSkipIntro, setShowSkipIntro] = useState(false);
  const [showSkipOutro, setShowSkipOutro] = useState(false);
  
  // Auto-detected timing state (when source doesn't provide timing data)
  const [autoDetectedTiming, setAutoDetectedTiming] = useState<{
    intro?: { start: number; end: number };
    outro?: { start: number; end: number };
  } | null>(null);
  
  // Animation refs
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const controlsTimeout = useRef<NodeJS.Timeout | null>(null);
  const lastSeekTime = useRef(0);
  const lastProgressSave = useRef(0);

  // Add ref to prevent multiple loads
  const hasLoadedData = useRef(false);
  
  // Detect provider from episode ID or source URL
  const detectedProvider = useMemo(() => {
    if (!videoData) return 'unknown';
    // Prefer explicit provider if passed via params/storage
    const paramProvider = (params.provider as string) || (videoData as any).provider;
    if (paramProvider) return String(paramProvider).toLowerCase();

    // Fallback heuristics
    if (videoData.episodeId?.includes('/episode-')) return 'zoro';
    if (videoData.source?.includes('megacloud') || videoData.source?.includes('dotstream')) return 'zoro';
    return 'animepahe';
  }, [params.provider, videoData?.episodeId, videoData?.source]);

  // Provider-specific URL handling
  const videoSource = useMemo(() => {
    if (!videoData?.source) return '';
    
                  // Both providers use direct streaming - Megacloud decryption handles Zoro sources
    const finalUrl = videoData.source;
    
    console.log(`🎬 Video source URL: ${finalUrl.substring(0, 100)}...`);
    console.log(`🔗 Provider: ${detectedProvider.toUpperCase()}`);
    
    if (detectedProvider === 'zoro') {
                    console.log(`🔒 [ZORO] Using M3U8 from Megacloud decryption (already proxied)`);
    } else {
      console.log(`🔓 [ANIMEPAHE] Using direct stream`);
    }
    
    // Log if URL contains quality indicators
    if (finalUrl.includes('1080') || finalUrl.includes('720') || finalUrl.includes('480')) {
      console.log(`📺 Quality detected in URL: ${finalUrl.match(/\d+p?/g)?.join(', ')}`);
    }
    
    return finalUrl;
  }, [videoData?.source, detectedProvider]);

  // Provider-specific headers configuration
  const videoHeaders = useMemo(() => {
    if (!videoData?.headers) return {};
    
    // Use headers as provided by the source (Aniwatch requires Referer)
    const headers = { ...videoData.headers } as Record<string, string>;
    
    // For some players, having Origin alongside Referer helps; derive if missing
    if (headers.Referer && !headers.Origin) {
      try {
        const u = new URL(headers.Referer);
        headers.Origin = `${u.protocol}//${u.host}`;
      } catch {}
    }
    
    console.log(`📋 [${detectedProvider.toUpperCase()}] Using headers:`, headers);
    return headers;
  }, [videoData?.headers, detectedProvider]);

  // Create expo-video player for system PiP
      const videoPlayer = useVideoPlayer(
    videoData && videoSource ? (() => {
      const isKurojiProxied = typeof videoSource === 'string' && videoSource.includes('kuroji.1ani.me/api/proxy?url=');
      let finalUri = videoSource;
      const sourceObj: any = {
        uri: finalUri,
        headers: isKurojiProxied ? undefined : videoHeaders,
      };
      
      // Force HLS detection on Android/ExoPlayer when using proxied URLs
      // This is the exact fix from the image - tell the player explicitly it's HLS
      // 
      // Why this matters:
      // - Some players detect HLS purely from MIME type (application/vnd.apple.mpegurl)
      // - But many mobile/TV video players (especially Android's ExoPlayer) fall back to 
      //   guessing from the file extension
      // - If the URL doesn't end with .m3u8 (like our proxy URLs), players might fail
      //   to treat it as HLS, leading to "file can't be played" errors
      //
      // Fix: Tell the player explicitly it's HLS
          const isLocalM3u8 = typeof finalUri === 'string' && finalUri.startsWith('file://') && finalUri.toLowerCase().endsWith('.m3u8');
          const isExplicitM3u8 = typeof finalUri === 'string' && finalUri.toLowerCase().endsWith('.m3u8');
          if (isKurojiProxied || isLocalM3u8 || isExplicitM3u8) {
        // Option 1: For expo-av (what we're using)
        sourceObj.overrideFileExtensionAndroid = '.m3u8';
        sourceObj.contentType = 'application/x-mpegURL';
        
        // Option 2: For react-native-video (alternative)
        // sourceObj.type = 'm3u8';
        
        // Don't append ext=.m3u8 - the overrideFileExtensionAndroid is enough
        // finalUri = `${finalUri}${finalUri.includes('?') ? '&' : '?'}ext=.m3u8`;
        // sourceObj.uri = finalUri;
      }
      
      console.log('[EXPO-VIDEO] 🔧 Player source object:', {
        uri: sourceObj.uri,
        hasHeaders: !!sourceObj.headers && Object.keys(sourceObj.headers).length > 0,
        overrideFileExtensionAndroid: sourceObj.overrideFileExtensionAndroid,
        contentType: sourceObj.contentType,
        type: sourceObj.type, // For react-native-video alternative
      });
      
      // Add error handling for the player
      console.log('[EXPO-VIDEO] 🚀 Creating player with source:', {
        originalUrl: videoSource,
        finalUrl: sourceObj.uri,
        isKurojiProxied,
        hasHeaders: !!sourceObj.headers,
        hlsForced: !!sourceObj.overrideFileExtensionAndroid || !!sourceObj.type
      });
      
      return sourceObj;
    })() : null,
    (player) => {
      if (player && videoData) {
        player.loop = false;
        player.muted = false;
        player.volume = preferences.volume;
        player.playbackRate = playbackSpeed;
        // Reduce JS churn on lower-end devices/emulators
        // 100ms is very chatty; 250ms keeps subtitles in sync while cutting updates by ~2.5x
        player.timeUpdateEventInterval = 250;
        
        console.log(`[EXPO-VIDEO] 🎬 Player created and configured for ${detectedProvider.toUpperCase()}`);
        console.log(`[EXPO-VIDEO] 📡 Using ${videoHeaders && Object.keys(videoHeaders).length > 0 ? 'custom' : 'no'} headers`);
        if (detectedProvider === 'zoro') {
          console.log(`[EXPO-VIDEO] 🔒 Zoro stream: M3U8 from Megacloud decryption (pre-processed)`);
        }
        
        // Test the URL directly to see if it's accessible
        if (videoSource && videoSource.includes('kuroji.1ani.me/api/proxy?url=')) {
          fetch(videoSource)
            .then(res => {
              console.log('[EXPO-VIDEO] 🔍 URL test result:', {
                status: res.status,
                contentType: res.headers.get('content-type'),
                ok: res.ok
              });
            })
            .catch(err => {
              console.error('[EXPO-VIDEO] ❌ URL test failed:', err.message);
            });
        }
        
        // Test the URL directly to see if it's accessible
        if (videoSource && videoSource.includes('kuroji.1ani.me/api/proxy?url=')) {
          fetch(videoSource)
            .then(res => {
              console.log('[EXPO-VIDEO] 🔍 URL test result:', {
                status: res.status,
                contentType: res.headers.get('content-type'),
                ok: res.ok
              });
            })
            .catch(err => {
              console.error('[EXPO-VIDEO] ❌ URL test failed:', err.message);
            });
        }
        
        // Monitor video status and errors via polling
        const monitorVideoStatus = () => {
          try {
            const status = player.status;
            const currentTime = player.currentTime || 0;
            const duration = player.duration || 0;
            // Try to access error info if exposed
            const err: any = (player as any).error || undefined;
            
            console.log(`[EXPO-VIDEO] 📊 Status check:`, {
              status: status,
              provider: detectedProvider,
              currentTime: currentTime.toFixed(2),
              duration: duration.toFixed(2),
              playing: player.playing,
              error: err ? { message: String(err?.message || err), code: err?.code } : undefined,
              timestamp: new Date().toISOString()
            });
            
            // Check for specific error status
            if (status === 'error') {
              console.error(`🔥 [VIDEO ERROR] ===================`);
              console.error(`[EXPO-VIDEO] ❌ Video failed to load:`, {
                provider: detectedProvider,
                sourceUrl: videoSource.substring(0, 100) + '...',
                status: status,
                headers: videoHeaders,
                episodeId: videoData?.episodeId,
                playerError: err ? { message: String(err?.message || err), code: err?.code } : undefined,
                timestamp: new Date().toISOString()
              });
              console.error(`🔥 [VIDEO ERROR END] ===================`);
            }
            
            // Log successful load
            if (status === 'readyToPlay' || (duration > 0 && status === 'loading')) {
              console.log(`[EXPO-VIDEO] ✅ Video loaded successfully for ${detectedProvider.toUpperCase()}`);
            }
            
            // Check for stalled loading
            if (status === 'loading' && duration === 0) {
              console.warn(`[EXPO-VIDEO] ⚠️ Video stuck in loading state for ${detectedProvider.toUpperCase()}`);
            }
            
          } catch (err) {
            console.error(`[EXPO-VIDEO] ❌ Error monitoring video status:`, err);
          }
        };
        
        // Start monitoring after a short delay
        setTimeout(() => {
          monitorVideoStatus();
          // Check status every 2 seconds for the first 10 seconds
          const statusInterval = setInterval(() => {
            monitorVideoStatus();
          }, 2000);
          
          // Stop monitoring after 10 seconds
          setTimeout(() => {
            clearInterval(statusInterval);
          }, 10000);
        }, 1000);
      }
    }
  );

  // Add a simple delay to prevent viewState errors
  useEffect(() => {
    if (videoData && videoSource) {
      const timer = setTimeout(() => {
        setIsVideoReady(true);
      }, 100); // Small delay to ensure native view is ready
      
      return () => clearTimeout(timer);
    } else {
      setIsVideoReady(false);
    }
  }, [videoData, videoSource]);

  // Remove the problematic media probe that causes double-proxying
  // useEffect(() => {
  //   const runProbe = async () => {
  //     // ... removed entire probe logic that was double-proxying URLs
  //   };
  //   runProbe();
  // }, [videoSource]);

  // Monitor video status for debugging (without re-proxying)
  useEffect(() => {
    if (!videoPlayer) return;

    const monitorVideoStatus = () => {
      try {
        const status = videoPlayer.status;
        const currentTime = videoPlayer.currentTime || 0;
        const duration = videoPlayer.duration || 0;
        
        // Only log status, don't manipulate URLs
        console.log(`[EXPO-VIDEO] 📊 Status check:`, {
          status: status,
          provider: detectedProvider,
          currentTime: currentTime.toFixed(2),
          duration: duration.toFixed(2),
          hasError: status === 'error'
        });
        
        // Log any errors without URL manipulation
        if (status === 'error') {
          console.log(`[EXPO-VIDEO] ❌ Player error detected`);
        }
      } catch (error) {
        console.log(`[EXPO-VIDEO] ⚠️ Error monitoring status:`, error);
      }
    };

    const interval = setInterval(monitorVideoStatus, 2000);
    return () => clearInterval(interval);
  }, [videoPlayer, detectedProvider]);

  // Simplified time update using refs to prevent infinite loops
  const lastTimeRef = useRef(0);
  const lastDurationRef = useRef(0);
  const timeUpdateIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  useEffect(() => {
    // Clear any existing interval
    if (timeUpdateIntervalRef.current) {
      clearInterval(timeUpdateIntervalRef.current);
      timeUpdateIntervalRef.current = null;
    }
    
    if (videoPlayer && videoData) {
      console.log('[EXPO-VIDEO] ⏰ Setting up time update interval for video player');
      
      timeUpdateIntervalRef.current = setInterval(() => {
        try {
          // Check if videoPlayer is still valid and not released
          if (!videoPlayer) {
            console.warn('[EXPO-VIDEO] Video player is no longer valid, stopping time updates');
            if (timeUpdateIntervalRef.current) {
              clearInterval(timeUpdateIntervalRef.current);
              timeUpdateIntervalRef.current = null;
            }
            return;
          }
          
          // Check for error status during playback
          if (videoPlayer.status === 'error') {
            console.error('🔥 [PLAYBACK ERROR] ===================');
            console.error('[EXPO-VIDEO] ❌ Video error detected during playback:', {
              provider: detectedProvider,
              status: videoPlayer.status,
              currentTime: videoPlayer.currentTime || 0,
              duration: videoPlayer.duration || 0,
              playing: videoPlayer.playing
            });
            console.error('🔥 [PLAYBACK ERROR END] ===================');
          }
          
          const newTime = videoPlayer.currentTime || 0;
          const newDuration = videoPlayer.duration || 0;
          const isPlaying = videoPlayer.playing || false;
          
          // Only update time if there's a significant change (reduced threshold for smoother subtitles)
          if (Math.abs(newTime - lastTimeRef.current) > 0.1) {
            lastTimeRef.current = newTime;
            setCurrentTime(newTime);
            
            // Enhanced progress saving - save every 10 seconds during playback
            if (videoData && isPlaying && newTime > 30 && newDuration > 0) {
              const now = Date.now();
              if (now - lastProgressSaveRef.current > 10000) { // Save every 10 seconds
                lastProgressSaveRef.current = now;
                EpisodeNavigationUtils.saveProgressForNavigation(videoData, newTime, newDuration);
              }
            }
          }
          
          // Set duration only once when video is loaded
          if (newDuration > 0 && lastDurationRef.current === 0) {
            lastDurationRef.current = newDuration;
            setDuration(newDuration);
            console.log('[EXPO-VIDEO] ✅ Video duration set:', newDuration);
          }
          
          // Update paused state
          setPaused(!isPlaying);
          
          // NEW: Countdown logic - trigger when outro marker is reached (Netflix style)
          if (newDuration > 0 && !countdownDismissed && nextEpisodeData?.hasNext && preferences.markerSettings.autoPlayNextEpisode) {
            // Get timing data (provided or auto-detected)
            const timingData = videoData?.timings || autoDetectedTiming;
            let shouldShowCountdown = false;
            
            if (timingData?.outro) {
              // Use outro marker timing (like Netflix)
              const outroStart = timingData.outro.start;
              const outroEnd = timingData.outro.end;
              
              // Show countdown when we reach the outro marker
              shouldShowCountdown = newTime >= outroStart && newTime <= outroEnd + 10; // Add 10 seconds buffer after outro
              
              if (shouldShowCountdown && !showNextEpisodeCountdown) {
                console.log('[COUNTDOWN] 🎬 Reached outro marker, showing Netflix-style countdown overlay', {
                  currentTime: newTime.toFixed(2),
                  outroStart: outroStart.toFixed(2),
                  outroEnd: outroEnd.toFixed(2)
                });
                setShowNextEpisodeCountdown(true);
              }
            } else {
              // Fallback: Use last 30 seconds if no outro marker (more conservative than last minute)
              const remainingTime = newDuration - newTime;
              shouldShowCountdown = remainingTime <= 30 && remainingTime > 0;
              
              if (shouldShowCountdown && !showNextEpisodeCountdown) {
                console.log('[COUNTDOWN] ⏰ No outro marker found, using fallback (last 30 seconds)', {
                  remainingTime: remainingTime.toFixed(2)
                });
                setShowNextEpisodeCountdown(true);
              }
            }
            
            // Hide countdown if we're no longer in the trigger zone
            if (!shouldShowCountdown && showNextEpisodeCountdown) {
              console.log('[COUNTDOWN] 🚫 Left countdown trigger zone, hiding overlay');
              setShowNextEpisodeCountdown(false);
            }
          }
          
        } catch (error: any) {
          console.error('🔥 [TIME UPDATE ERROR] ===================');
          console.error('[EXPO-VIDEO] ❌ Time update error:', {
            provider: detectedProvider,
            error: error?.message || error,
            errorStack: error?.stack?.split('\n').slice(0, 3).join('\n'),
            playerStatus: videoPlayer?.status,
            timestamp: new Date().toISOString()
          });
          console.error('🔥 [TIME UPDATE ERROR END] ===================');
          
          // If we get a "shared object released" error, stop the interval
          if (error?.message?.includes('shared object') || error?.message?.includes('released')) {
            console.warn('[EXPO-VIDEO] 🛑 Stopping time updates due to released player object');
            if (timeUpdateIntervalRef.current) {
              clearInterval(timeUpdateIntervalRef.current);
              timeUpdateIntervalRef.current = null;
            }
          }
        }
      }, 100); // Update every 100ms for smooth subtitle tracking
      
      return () => {
        if (timeUpdateIntervalRef.current) {
          clearInterval(timeUpdateIntervalRef.current);
          timeUpdateIntervalRef.current = null;
        }
      };
    }
  }, [videoPlayer, videoData, autoDetectedTiming, nextEpisodeData, countdownDismissed, showNextEpisodeCountdown, preferences.markerSettings.autoPlayNextEpisode]); // Added dependencies for countdown logic

  // Auto-enter PiP when app goes to background (for seamless UX)
  useEffect(() => {
    const { AppState } = require('react-native');
    
    const handleAppStateChange = (nextAppState: string) => {
      if (nextAppState === 'background' && videoPlayer && !paused && videoData) {
        console.log('[AUTO PiP] 🔄 App going to background, attempting auto-PiP...');
        // Small delay to ensure app state transition is complete
        setTimeout(() => {
          handleSystemPiP().then((success) => {
            if (success) {
              console.log('[AUTO PiP] ✅ Auto-PiP successful');
            } else {
              console.log('[AUTO PiP] ❌ Auto-PiP failed');
            }
          });
        }, 100);
      }
    };

    const subscription = AppState?.addEventListener?.('change', handleAppStateChange);
    
    return () => {
      if (subscription) {
        subscription.remove();
      }
    };
  }, [videoPlayer, paused, videoData, handleSystemPiP]);

  // Sync preferences when videoPlayer is created or preferences change
  const lastVolumeRef = useRef(preferences.volume);
  const lastSpeedRef = useRef(playbackSpeed);
  
  useEffect(() => {
    if (videoPlayer && videoData) {
      try {
        // Only update if values actually changed
        if (lastVolumeRef.current !== preferences.volume) {
          videoPlayer.volume = preferences.volume;
          lastVolumeRef.current = preferences.volume;
          console.log('[EXPO-VIDEO] Updated volume:', preferences.volume);
        }
        
        if (lastSpeedRef.current !== playbackSpeed) {
          videoPlayer.playbackRate = playbackSpeed;
          lastSpeedRef.current = playbackSpeed;
          console.log('[EXPO-VIDEO] Updated playback speed:', playbackSpeed);
        }
      } catch (error) {
        console.warn('[EXPO-VIDEO] Failed to sync preferences:', error);
      }
    }
  }, [videoPlayer, videoData, preferences.volume, playbackSpeed]);

  // Memoized subtitle display check
  const shouldShowSubtitles = useMemo(() => {
    return currentSubtitle && preferences.subtitlesEnabled && subtitleCues.length > 0;
  }, [currentSubtitle, preferences.subtitlesEnabled, subtitleCues.length]);

  // Memoized subtitle style
  const subtitleStyle = useMemo(() => ({
    fontSize: preferences.subtitleStyle?.fontSize || 18,
    color: preferences.subtitleStyle?.textColor || '#FFFFFF',
    fontWeight: preferences.subtitleStyle?.boldText ? 'bold' : 'normal' as 'bold' | 'normal',
  }), [preferences.subtitleStyle]);

  // Memoized display title
  const displayTitle = useMemo(() => {
    if (videoData?.animeTitle && videoData?.episodeNumber) {
      return `${videoData.animeTitle} - Ep ${videoData.episodeNumber}`;
    }
    return videoData?.animeTitle || 'Current Episode';
  }, [videoData?.animeTitle, videoData?.episodeNumber]);
  
  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (seekTimeoutRef.current) {
        clearTimeout(seekTimeoutRef.current);
        seekTimeoutRef.current = null;
      }
      if (controlsTimeout.current) {
        clearTimeout(controlsTimeout.current);
        controlsTimeout.current = null;
      }
      // Reset seeking state
      isSeekingRef.current = false;
    };
  }, []);

  // Load video data from AsyncStorage or params
  useEffect(() => {
    // Prevent multiple loads
    if (hasLoadedData.current) return;
    
    const loadVideoData = async () => {
      try {
        setIsLoading(true);
        let data: VideoData | null = null;

        if (params.dataKey) {
          const storedData = await AsyncStorage.getItem(params.dataKey as string);
          if (storedData) {
            data = JSON.parse(storedData);
            console.log('📊 Loaded video data from storage:', data);
          }
        } else {
          // Fallback to direct params
          console.log('🎬 [PLAYER] No dataKey found, using direct params:', {
            hasSource: Boolean(params.source),
            hasUrl: Boolean(params.url),
            sourcePreview: params.source ? (params.source as string).substring(0, 50) + '...' : 'none',
            urlPreview: params.url ? (params.url as string).substring(0, 50) + '...' : 'none'
          });
          
          // Handle both 'source' and 'url' parameters for backward compatibility
          let sourceUrl = params.source as string || params.url as string;
          
          // Remove extra quotes if double-stringified
          if (sourceUrl && sourceUrl.startsWith('"') && sourceUrl.endsWith('"')) {
            sourceUrl = sourceUrl.slice(1, -1);
            console.log('🔧 [PLAYER] Removed extra quotes from source URL');
          }
          
          data = {
            source: sourceUrl,
            headers: params.headers ? JSON.parse(params.headers as string) : undefined,
            subtitles: params.subtitles ? JSON.parse(params.subtitles as string) : [],
            timings: params.timings ? JSON.parse(params.timings as string) : undefined,
            episodeId: params.episodeId as string,
            episodeNumber: params.episodeNumber ? parseInt(params.episodeNumber as string) : undefined,
            animeTitle: params.animeTitle as string,
            anilistId: params.anilistId as string,
          };
          
          console.log('🎬 [PLAYER] Created fallback video data:', {
            hasSource: Boolean(data.source),
            sourcePreview: data.source ? data.source.substring(0, 50) + '...' : 'none',
            episodeId: data.episodeId,
            episodeNumber: data.episodeNumber
          });
        }

        if (data && data.source) {
          console.log('🎬 [PLAYER] Loaded video data with episode info:', {
            animeTitle: data.animeTitle,
            episodeNumber: data.episodeNumber,
            episodeId: data.episodeId
          });
          setVideoData(data);
          hasLoadedData.current = true;
          
          // Check if subtitles are available and valid
          const hasValidSubtitles = data.subtitles && 
                                   data.subtitles.length > 0 && 
                                   data.subtitles[0]?.url;
          
          // Auto-disable subtitles if none are available (hardsub detection)
          if (!hasValidSubtitles) {
            console.log('⚠️ No valid subtitles found, disabling subtitle option (hardsub detected)');
            setPreferences(prev => ({
              ...prev,
              subtitlesEnabled: false
            }));
          } else if (data.subtitles && data.subtitles.length > 0) {
            // Set default subtitle language to the first available
            const defaultSubtitle = data.subtitles[0];
            console.log(`🎯 Setting default subtitle language: ${defaultSubtitle.lang}`);
            setSelectedSubtitleLanguage(defaultSubtitle.lang);
            // Note: The subtitle loading will be handled by the useEffect above
          }
          
          // Load saved progress
          if (data.episodeId && preferences.rememberPosition) {
            const savedProgress = await AsyncStorage.getItem(`${STORAGE_KEYS.VIDEO_PROGRESS}${data.episodeId}`);
            if (savedProgress) {
              const progressData = JSON.parse(savedProgress);
              if (progressData.currentTime > 30) { // Only resume if more than 30 seconds
                setCurrentTime(progressData.currentTime);
              }
            }
          }
          
          // NEW: Check for saved timestamp for resume functionality
          if (data.anilistId && data.episodeNumber) {
            const timestampKey = `progress_anilist_${data.anilistId}_ep_${data.episodeNumber}`;
            try {
              const savedTimestampData = await AsyncStorage.getItem(timestampKey);
              if (savedTimestampData) {
                const timestampData = JSON.parse(savedTimestampData);
                console.log('[PLAYER_SCREEN] 🕒 Found saved timestamp:', {
                  timestamp: timestampData.timestamp,
                  episodeNumber: timestampData.episodeNumber,
                  savedAt: new Date(timestampData.savedAt).toLocaleString()
                });
                
                // Only offer resume if timestamp is significant (> 30 seconds) and not near the end
                if (timestampData.timestamp > 30 && 
                    timestampData.duration && 
                    timestampData.timestamp < timestampData.duration - 60) {
                  setSavedTimestamp(timestampData.timestamp);
                  setShowResumeModal(true);
                }
              }
            } catch (error) {
              console.error('[PLAYER_SCREEN] ❌ Error checking for saved timestamp:', error);
            }
          }
        } else {
          console.error('❌ No valid video data found');
          Alert.alert('Error', 'No video data found');
          router.back();
        }
      } catch (error) {
        console.error('❌ Error loading video data:', error);
        Alert.alert('Error', 'Failed to load video data');
        router.back();
      } finally {
        setIsLoading(false);
      }
    };

    loadVideoData();
  }, [params.dataKey, params.url, preferences.rememberPosition, setPreferences]);

  // NEW: Find next episode for countdown functionality
  useEffect(() => {
    if (videoData && videoData.anilistId && videoData.episodeNumber) {
      console.log('[NEXT_EPISODE] 🔍 Finding next episode for countdown functionality');
      
      EpisodeNavigationUtils.findNextEpisode(videoData).then((result) => {
        setNextEpisodeData(result);
        console.log('[NEXT_EPISODE] 📊 Next episode lookup result:', {
          hasNext: result.hasNext,
          nextEpisode: result.nextEpisode?.number,
          nextTitle: result.nextEpisode?.title
        });
      }).catch((error) => {
        console.error('[NEXT_EPISODE] ❌ Error finding next episode:', error);
        setNextEpisodeData({ hasNext: false });
      });
    }
  }, [videoData]);

  // NEW: Handle skip to next episode
  const handleSkipToNextEpisode = async () => {
    if (!nextEpisodeData?.hasNext || !nextEpisodeData.nextEpisode) {
      console.log('[COUNTDOWN] ❌ No next episode available');
      return;
    }

    console.log('[COUNTDOWN] ⏭️ Skipping to next episode:', {
      current: videoData?.episodeNumber,
      next: nextEpisodeData.nextEpisode.number
    });

    try {
      // Save current progress before navigating
      if (videoData) {
        await EpisodeNavigationUtils.saveProgressForNavigation(videoData, currentTime, duration);
      }

      // Hide countdown overlay
      setShowNextEpisodeCountdown(false);
      setCountdownDismissed(true);

      // Navigate to next episode
      const nextEpisodeId = nextEpisodeData.episodeId;
      if (nextEpisodeId) {
        console.log('[COUNTDOWN] 🎯 Navigating to next episode ID:', nextEpisodeId);
        
        // Replace current route with next episode
        router.replace(`/anime/${nextEpisodeId}`);
      }
    } catch (error) {
      console.error('[COUNTDOWN] ❌ Error navigating to next episode:', error);
    }
  };

  // NEW: Handle dismiss countdown
  const handleDismissCountdown = () => {
    console.log('[COUNTDOWN] 🚫 User dismissed countdown overlay');
    setShowNextEpisodeCountdown(false);
    setCountdownDismissed(true);
  };

  // Load subtitle cues from URL - Enhanced with indexing
  const loadSubtitleCues = async (subtitleUrl: string) => {
    try {
      console.log('🎯 [SUBTITLE LOADER] Loading subtitles from:', subtitleUrl.substring(0, 100) + '...');
      
      // Try with the same headers required for video (Referer/Origin)
      const subtitleHeaders: Record<string, string> = { ...(videoHeaders || {}) };
      if (subtitleHeaders.Referer && !subtitleHeaders.Origin) {
        try {
          const u = new URL(subtitleHeaders.Referer);
          subtitleHeaders.Origin = `${u.protocol}//${u.host}`;
        } catch {}
      }
      subtitleHeaders.Accept = 'text/vtt, text/plain;q=0.9, */*;q=0.8';
      
      let response = await fetch(subtitleUrl, { headers: subtitleHeaders });
      
      // Fallback: retry without headers if we get a 403/401
      if (!response.ok && (response.status === 401 || response.status === 403)) {
        console.warn('⚠️ [SUBTITLE LOADER] Auth error loading VTT with headers. Retrying without headers...');
        try { response = await fetch(subtitleUrl); } catch {}
      }
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const vttContent = await response.text();
      console.log('🎯 [SUBTITLE LOADER] Downloaded VTT content:', vttContent.length, 'characters');
      
      const cues = parseVTT(vttContent);
      setSubtitleCues(cues);
      
      // Build optimized index for fast lookups
      if (cues.length > 0) {
        buildSubtitleIndex(cues);
        console.log('🚀 [SUBTITLE LOADER] Successfully loaded and indexed', cues.length, 'subtitle cues');
        
        // Enable subtitles if we successfully loaded cues
        setPreferences(prev => ({
          ...prev,
          subtitlesEnabled: true
        }));
      } else {
        console.log('⚠️ [SUBTITLE LOADER] No subtitle cues found in VTT file, disabling subtitles');
        setPreferences(prev => ({
          ...prev,
          subtitlesEnabled: false
        }));
      }
    } catch (error) {
      console.error('❌ [SUBTITLE LOADER] Error loading subtitles:', error);
      // Disable subtitles on error
      setPreferences(prev => ({
        ...prev,
        subtitlesEnabled: false
      }));
    }
  };

  // Load subtitles when language selection changes
  useEffect(() => {
    if (videoData?.subtitles && selectedSubtitleLanguage) {
      const selectedSubtitle = videoData.subtitles.find(
        sub => sub.lang === selectedSubtitleLanguage
      );
      
      if (selectedSubtitle && selectedSubtitle.url) {
        loadSubtitleCues(selectedSubtitle.url);
      } else {
        // Fallback to first available subtitle if selected language not found
        const fallbackSubtitle = videoData.subtitles[0];
        if (fallbackSubtitle && fallbackSubtitle.url) {
          setSelectedSubtitleLanguage(fallbackSubtitle.lang);
          loadSubtitleCues(fallbackSubtitle.url);
        }
      }
    }
  }, [videoData?.subtitles, selectedSubtitleLanguage]);

  // Optimized subtitle tracking with binary search and caching
  useEffect(() => {
    if (subtitleCues.length === 0 || !preferences.subtitlesEnabled) {
      if (currentSubtitle) {
        setCurrentSubtitle('');
        lastSubtitleLookupTimeRef.current = -1;
      }
      return;
    }

    // Skip lookup if time hasn't changed significantly (avoid unnecessary computations)
    const timeDiff = Math.abs(currentTime - lastSubtitleLookupTimeRef.current);
    if (timeDiff < 0.05) { // Skip if less than 50ms difference
      return;
    }

    const newSubtitle = findSubtitleAtTime(currentTime);
    
    // Only update if subtitle actually changed
    if (newSubtitle !== currentSubtitle) {
      setCurrentSubtitle(newSubtitle);
      lastSubtitleLookupTimeRef.current = currentTime;
      
      if (newSubtitle) {
        console.log(`🎯 [SUBTITLE TRACKING] Updated subtitle at ${currentTime.toFixed(2)}s: "${newSubtitle.substring(0, 50)}${newSubtitle.length > 50 ? '...' : ''}"`);
      }
    }
  }, [currentTime, subtitleCues.length, preferences.subtitlesEnabled, currentSubtitle, findSubtitleAtTime]);

  // Check for intro/outro timing - optimized (with logging and validation)
  useEffect(() => {
    if (videoData?.timings) {
      console.log('[PLAYER_SCREEN] ⏱️ Provided timings:', JSON.stringify(videoData.timings));
      const rawIntro = videoData.timings.intro;
      const rawOutro = videoData.timings.outro;
      const intro = rawIntro && rawIntro.start >= 0 && rawIntro.end > rawIntro.start ? rawIntro : undefined;
      const outro = rawOutro && rawOutro.start >= 0 && rawOutro.end > rawOutro.start ? rawOutro : undefined;
      if ((rawIntro && !intro) || (rawOutro && !outro)) {
        console.warn('[PLAYER_SCREEN] ⏱️ Invalid timing range ignored:', videoData.timings);
      }

      const shouldShowIntro = !!(intro && currentTime >= intro.start && currentTime <= intro.end);
      const shouldShowOutro = !!(outro && currentTime >= outro.start && currentTime <= outro.end);

      if (shouldShowIntro !== showSkipIntro) {
        setShowSkipIntro(shouldShowIntro);
      }

      if (shouldShowOutro !== showSkipOutro) {
        setShowSkipOutro(shouldShowOutro);
      }
    }
  }, [currentTime, videoData?.timings, showSkipIntro, showSkipOutro]);

  // Auto-detect intro/outro timing when not provided by source
  useEffect(() => {
    console.log('[AUTO-DETECT] 🔍 Checking conditions:', {
      hasTimings: !!videoData?.timings,
      duration,
      autoDetectEnabled: AUTO_DETECT_TIMING.ENABLED,
      hasAutoDetected: !!autoDetectedTiming
    });
    
    if (!videoData?.timings && duration > 0 && AUTO_DETECT_TIMING.ENABLED && !autoDetectedTiming) {
      console.log('[AUTO-DETECT] 🎯 No timing data provided, auto-detecting intro/outro...');
      
      const detectedTiming: { intro?: { start: number; end: number }; outro?: { start: number; end: number } } = {};
      
      // Auto-detect intro timing
      if (duration > AUTO_DETECT_TIMING.INTRO.END) {
        detectedTiming.intro = {
          start: AUTO_DETECT_TIMING.INTRO.START,
          end: AUTO_DETECT_TIMING.INTRO.END
        };
        console.log('[AUTO-DETECT] 🎵 Detected intro timing:', detectedTiming.intro);
      }
      
      // Auto-detect outro timing based on episode duration
      if (duration > AUTO_DETECT_TIMING.OUTRO.START_OFFSET_FROM_END + AUTO_DETECT_TIMING.OUTRO.MIN_DURATION) {
        const outroStart = duration - AUTO_DETECT_TIMING.OUTRO.START_OFFSET_FROM_END;
        const outroEnd = duration - AUTO_DETECT_TIMING.OUTRO.END_OFFSET_FROM_END;
        
        if (outroEnd > outroStart && (outroEnd - outroStart) >= AUTO_DETECT_TIMING.OUTRO.MIN_DURATION) {
          detectedTiming.outro = {
            start: outroStart,
            end: outroEnd
          };
          console.log('[AUTO-DETECT] 🎶 Detected outro timing:', detectedTiming.outro);
        }
      }
      
      if (detectedTiming.intro || detectedTiming.outro) {
        setAutoDetectedTiming(detectedTiming);
        console.log('[AUTO-DETECT] ✅ Auto-detection complete:', detectedTiming);
      } else {
        console.log('[AUTO-DETECT] ❌ No timing detected - duration too short?');
      }
    }
  }, [duration, videoData?.timings, autoDetectedTiming]);

  // Check for intro/outro timing using both provided and auto-detected data
  useEffect(() => {
    // Merge provided timing with auto-detected: fill missing or invalid parts with detected ones
    const provided = videoData?.timings;
    const detected = autoDetectedTiming;
    const isValid = (t?: { start: number; end: number }) => !!(t && t.start >= 0 && t.end > t.start);
    const merged = (provided || detected) ? {
      intro: isValid(provided?.intro) ? provided?.intro : (isValid(detected?.intro) ? detected?.intro : undefined),
      outro: isValid(provided?.outro) ? provided?.outro : (isValid(detected?.outro) ? detected?.outro : undefined),
    } : undefined;

    const timingData = merged;
    
    console.log('[SKIP] 🔍 Checking skip buttons:', {
      currentTime,
      timingData,
      showSkipIntro,
      showSkipOutro
    });
    
    if (timingData) {
      const { intro, outro } = timingData;
      if (provided && (!isValid(provided.intro) || !isValid(provided.outro))) {
        console.log('[SKIP] ⏱️ Using merged timings with auto-detect fallback:', timingData);
      }
      
      const shouldShowIntro = !!(intro && currentTime >= intro.start && currentTime <= intro.end);
      const shouldShowOutro = !!(outro && currentTime >= outro.start && currentTime <= outro.end);
      
      console.log('[SKIP] 📊 Skip button logic:', {
        intro,
        outro,
        shouldShowIntro,
        shouldShowOutro,
        currentTime
      });
      
      if (shouldShowIntro !== showSkipIntro) {
        setShowSkipIntro(shouldShowIntro);
        if (shouldShowIntro) {
          console.log('[SKIP] 🎵 Showing skip intro button');
        } else {
          console.log('[SKIP] 🎵 Hiding skip intro button');
        }
      }
      
      if (shouldShowOutro !== showSkipOutro) {
        setShowSkipOutro(shouldShowOutro);
        if (shouldShowOutro) {
          console.log('[SKIP] 🎶 Showing skip outro button');
        } else {
          console.log('[SKIP] 🎶 Hiding skip outro button');
        }
      }
    } else {
      console.log('[SKIP] ⚠️ No timing data available for skip buttons');
    }
  }, [currentTime, videoData?.timings, autoDetectedTiming, showSkipIntro, showSkipOutro]);

  // No longer needed - using expo-video's built-in event system

  // Control handlers - Updated for expo-video
  const handlePlayPause = useCallback(() => {
    if (videoPlayer) {
      if (paused || !videoPlayer.playing) {
        videoPlayer.play();
        console.log('▶️ Video resumed');
        setPaused(false);
      } else {
        videoPlayer.pause();
        console.log('⏸️ Video paused');
        setPaused(true);
      }
    }
  }, [paused, videoPlayer]);

  // Optimized seek with reduced debounce for better responsiveness
  const seekTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isSeekingRef = useRef(false);
  
  const handleSeek = useCallback((time: number) => {
    if (videoPlayer && !isSeekingRef.current) {
      // Prevent multiple simultaneous seeks
      isSeekingRef.current = true;
      setSeekingPosition(time);
      lastSeekTime.current = Date.now();
      
      // Clear previous timeout
      if (seekTimeoutRef.current) {
        clearTimeout(seekTimeoutRef.current);
      }
      
      // Optimized debounce for better responsiveness
      seekTimeoutRef.current = setTimeout(() => {
        if (videoPlayer) {
          setIsBuffering(true);
          
          try {
            // Perform the seek operation with expo-video
            videoPlayer.currentTime = time;
            setIsBuffering(false);
            isSeekingRef.current = false;
            console.log(`📍 Seeked to ${time.toFixed(1)}s`);
          } catch (error: any) {
            console.error('Seek error:', error);
            setIsBuffering(false);
            isSeekingRef.current = false;
          }
        }
      }, PLAYER_BEHAVIOR.SEEK_DEBOUNCE_MS);
    }
  }, [videoPlayer]);

  // Handle seek start - called when user starts dragging
  const handleSeekStart = useCallback(() => {
    setIsSeeking(true);
    console.log('🎯 User started seeking');
  }, []);

  // Handle seek change - called during dragging (real-time updates)
  const handleSeekChange = useCallback((time: number) => {
    // Update the seeking position for visual feedback
    setSeekingPosition(time);
    // Optionally update current time for immediate visual feedback
    // setCurrentTime(time); // Uncomment for real-time preview
    console.log(`🎯 Seeking to ${time.toFixed(1)}s`);
  }, []);

  // Handle seek end - called when user releases
  const handleSeekEnd = useCallback(() => {
    setIsSeeking(false);
    console.log('🎯 User finished seeking');
  }, []);

  const handleSkipForward = useCallback(() => {
    const newTime = Math.min(currentTime + PLAYER_BEHAVIOR.DOUBLE_TAP_SEEK_TIME, duration);
    handleSeek(newTime);
  }, [currentTime, duration, handleSeek]);

  const handleSkipBackward = useCallback(() => {
    const newTime = Math.max(currentTime - PLAYER_BEHAVIOR.DOUBLE_TAP_SEEK_TIME, 0);
    handleSeek(newTime);
  }, [currentTime, handleSeek]);

  const handleSkipIntro = useCallback(() => {
    // Use provided timing data if available, otherwise use auto-detected
    const timingData = videoData?.timings || autoDetectedTiming;
    
    if (timingData?.intro) {
      console.log('[SKIP] ⏭️ Skipping intro to:', timingData.intro.end);
      handleSeek(timingData.intro.end);
    } else {
      // Fallback: skip default intro duration from current time
      const skipTo = Math.min(currentTime + PLAYER_BEHAVIOR.SKIP_INTRO_DURATION, duration);
      console.log('[SKIP] ⏭️ Fallback intro skip to:', skipTo);
      handleSeek(skipTo);
    }
  }, [videoData?.timings, autoDetectedTiming, handleSeek, currentTime, duration]);

  const handleSkipOutro = useCallback(() => {
    // Use provided timing data if available, otherwise use auto-detected
    const timingData = videoData?.timings || autoDetectedTiming;
    
    if (timingData?.outro) {
      console.log('[SKIP] ⏭️ Skipping outro to:', timingData.outro.end);
      handleSeek(timingData.outro.end);
    } else {
      // Fallback: skip to near the end
      const skipTo = Math.max(duration - 30, currentTime + 30); // Skip to 30s before end or 30s forward
      console.log('[SKIP] ⏭️ Fallback outro skip to:', skipTo);
      handleSeek(skipTo);
    }
  }, [videoData?.timings, autoDetectedTiming, handleSeek, currentTime, duration]);

  // Toggle controls visibility
  const toggleControls = useCallback(() => {
    setShowControls(prev => !prev);
  }, []);

  // Auto-hide controls is now handled by VideoControls component to avoid conflicts

  // Handle back button (both hardware and UI)
  const handleBackPress = useCallback(() => {
    // Always show save progress modal if there's significant progress and AniList user
    if (videoData && currentTime > 30 && duration > 0) {
      setShowSaveProgressModal(true);
    } else {
      setShowExitModal(true);
    }
  }, [videoData, currentTime, duration]);

  // Handle hardware back button
  useEffect(() => {
    const backAction = () => {
      handleBackPress();
      return true;
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
    return () => backHandler.remove();
  }, [handleBackPress]);

  // Handle exit
  const handleExit = useCallback(() => {
    router.back();
  }, [router]);

  // Handle fullscreen toggle (cycle through resize modes)
  const [contentFitMode, setContentFitMode] = useState<"contain" | "cover" | "fill">("cover");
  
  const handleToggleFullscreen = useCallback(() => {
    // For expo-video, we use contentFit property
    type ContentFitMode = "contain" | "cover" | "fill";
    // Include 'fill' so users can force edge-to-edge if they want
    const contentFitModes: ContentFitMode[] = ["cover", "contain", "fill"]; 
    const modeNames = ['Fill', 'Fit', 'Stretch'];
    
    const currentIndex = contentFitModes.indexOf(contentFitMode as ContentFitMode);
    const nextIndex = (currentIndex + 1) % contentFitModes.length;
    const nextMode = contentFitModes[nextIndex];
    
    // Update the contentFit mode
    setContentFitMode(nextMode);
    
    // Also update the old scaling mode for compatibility
    const oldResizeModes = [ResizeMode.COVER, ResizeMode.CONTAIN, ResizeMode.STRETCH];
    setScalingMode(oldResizeModes[nextIndex]);
    
    console.log(`📺 Video resize mode: ${modeNames[nextIndex]}`);
    
    // Show toast notification on Android
    if (Platform.OS === 'android') {
      ToastAndroid.showWithGravity(
        `Video mode: ${modeNames[nextIndex]}`,
        ToastAndroid.SHORT,
        ToastAndroid.CENTER
      );
    }
    
    // Force update the VideoView
    if (videoRef.current) {
      try {
        videoRef.current.setNativeProps({ contentFit: nextMode });
      } catch (error) {
        console.warn('Could not update video scaling mode', error);
        // Force remount as fallback
        setVideoKey(prevKey => prevKey + 1);
      }
    }
  }, [contentFitMode]);
  
  // Add a key to force remount of the VideoView when needed
  const [videoKey, setVideoKey] = useState(0);

  // Audio track switching
  const handleAudioTrackChange = useCallback(async (track: 'sub' | 'dub') => {
    if (videoData?.audioTracks && track !== currentAudioTrack) {
      setCurrentAudioTrack(track);
      // Here you would implement the logic to switch audio tracks
      // This might involve loading a different video source
      console.log(`🎵 Switching to ${track} audio track`);
    }
  }, [videoData?.audioTracks, currentAudioTrack]);

  // Handle AniList save
  const handleSaveToAniListProgress = async (rememberChoice: boolean, shouldExit: boolean = true) => {
    if (!videoData || !videoData.anilistId) {
      console.log('[PLAYER_SCREEN] ⚠️ Cannot save to AniList: missing data');
      return;
    }

    try {
      // First save timestamp locally (for resume functionality)
      if (videoData.episodeNumber) {
        const timestampData = {
          timestamp: currentTime,
          episodeNumber: videoData.episodeNumber,
          anilistId: videoData.anilistId,
          duration: duration,
          savedAt: Date.now(),
          animeTitle: videoData.animeTitle || '',
        };
        
        const key = `progress_anilist_${videoData.anilistId}_ep_${videoData.episodeNumber}`;
        await AsyncStorage.setItem(key, JSON.stringify(timestampData));
        console.log('[PLAYER_SCREEN] 🕒 Saved timestamp before AniList sync');
      }
      
      // Then save to AniList
      let success = false;
      try {
        if (onSaveToAniList) {
          success = await onSaveToAniList({
            anilistId: videoData.anilistId,
            episodeNumber: videoData.episodeNumber || 1,
            currentTime,
            duration
          });
        } else {
          // Fallback: save directly using token from SecureStore (in case context user not loaded yet)
          console.log('[PLAYER_SCREEN] 🔄 Fallback AniList save (context unavailable)');
          const token = await SecureStore.getItemAsync(STORAGE_KEY.AUTH_TOKEN);
          if (!token) {
            console.warn('[PLAYER_SCREEN] ⚠️ No AniList token found; cannot save to AniList');
            success = false;
          } else {
            const mutation = `
              mutation ($mediaId: Int, $progress: Int, $status: MediaListStatus) {
                SaveMediaListEntry (mediaId: $mediaId, progress: $progress, status: $status) {
                  id progress status
                }
              }
            `;
            const res = await fetch(ANILIST_GRAPHQL_ENDPOINT, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json',
              },
              body: JSON.stringify({
                query: mutation,
                variables: {
                  mediaId: parseInt(String(videoData.anilistId), 10),
                  progress: videoData.episodeNumber || 1,
                  status: 'CURRENT'
                }
              })
            });
            const json = await res.json();
            if (json.errors) {
              console.error('[PLAYER_SCREEN] ❌ AniList API errors (fallback):', json.errors);
              success = false;
            } else {
              success = Boolean(json.data?.SaveMediaListEntry);
            }
          }
        }
      } catch (err) {
        console.error('[PLAYER_SCREEN] ❌ AniList save error:', err);
        success = false;
      }

      if (success) {
        console.log('[PLAYER_SCREEN] ✅ Successfully saved to AniList');
        
        // Clear the timestamp after successful AniList save (episode is marked as watched)
        if (videoData.episodeNumber) {
          const key = `progress_anilist_${videoData.anilistId}_ep_${videoData.episodeNumber}`;
          await AsyncStorage.removeItem(key);
          console.log('[PLAYER_SCREEN] 🧹 Cleared timestamp after AniList save');
        }
      }
    } catch (error) {
      console.error('[PLAYER_SCREEN] ❌ Failed to save to AniList:', error);
    } finally {
      setShowSaveProgressModal(false);
      if (shouldExit) {
        handleExit();
      }
    }
  };

  // Handle local save
  const handleSaveLocalProgress = async (rememberChoice: boolean, shouldExit: boolean = true) => {
    if (!videoData?.episodeId) {
      console.log('[PLAYER_SCREEN] ⚠️ Cannot save locally: missing episode ID');
      setShowSaveProgressModal(false);
      if (shouldExit) {
        handleExit();
      }
      return;
    }

    try {
      const progressData = {
        currentTime,
        duration,
        timestamp: Date.now(),
      };
      
      await AsyncStorage.setItem(`${STORAGE_KEYS.VIDEO_PROGRESS}${videoData.episodeId}`, JSON.stringify(progressData));
      console.log('[PLAYER_SCREEN] ✅ Successfully saved progress locally');
      
      // Save user preference if they chose to remember
      if (rememberChoice) {
        await AsyncStorage.setItem('autoSaveProgress', 'true');
        console.log('[PLAYER_SCREEN] 💾 Saved auto-save preference');
      }
    } catch (error) {
      console.error('[PLAYER_SCREEN] ❌ Failed to save locally:', error);
    } finally {
      setShowSaveProgressModal(false);
      if (shouldExit) {
        handleExit();
      }
    }
  };

  // NEW: Handle timestamp-only save (for "No, Exit" option)
  const handleSaveTimestampOnly = async () => {
    if (!videoData?.anilistId || !videoData?.episodeNumber) {
      console.log('[PLAYER_SCREEN] ⚠️ Cannot save timestamp: missing anilistId or episode number');
      setShowSaveProgressModal(false);
      handleExit();
      return;
    }

    try {
      // Save timestamp with AniList ID and episode number for resume functionality
      const timestampData = {
        timestamp: currentTime,
        episodeNumber: videoData.episodeNumber,
        anilistId: videoData.anilistId,
        duration: duration,
        savedAt: Date.now(),
        animeTitle: videoData.animeTitle || '',
      };
      
      const key = `progress_anilist_${videoData.anilistId}_ep_${videoData.episodeNumber}`;
      await AsyncStorage.setItem(key, JSON.stringify(timestampData));
      
      console.log('[PLAYER_SCREEN] 🕒 Saved timestamp for resume:', {
        key,
        timestamp: currentTime,
        episodeNumber: videoData.episodeNumber,
        anilistId: videoData.anilistId
      });
      
    } catch (error) {
      console.error('[PLAYER_SCREEN] ❌ Failed to save timestamp:', error);
    } finally {
      setShowSaveProgressModal(false);
      handleExit();
    }
  };

  // Add window dimensions calculation
  const window = Dimensions.get('window');
  const [dimensions, setDimensions] = useState({
    width: window.width,
    height: window.height
  });

  // Handle dimension changes (orientation changes)
  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setDimensions({
        width: window.width,
        height: window.height
      });
    });

    return () => subscription?.remove();
  }, []);

  // Calculate video dimensions maintaining 16:9 aspect ratio
  const videoStyle = useMemo(() => {
    // Fill the entire container; scaling handled by contentFit
    return {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: '#000000',
    } as const;
  }, []);

  if (isLoading || !videoData) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading video...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar hidden={true} />
      
      {/* Video container with proper centering */}
      <View style={styles.videoContainer}>
        {isVideoReady ? (
          <VideoView
            key={`video-view-${videoKey}`}
            ref={videoRef}
            style={videoStyle}
            player={videoPlayer}
            allowsFullscreen={true}
            allowsPictureInPicture={true}
            startsPictureInPictureAutomatically={false}
            nativeControls={false}
            contentFit={contentFitMode}
            onPictureInPictureStart={handlePiPStart}
            onPictureInPictureStop={handlePiPStop}
          />
        ) : (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading video...</Text>
          </View>
        )}
      </View>

      {/* Double Tap Overlay for Seeking */}
      <DoubleTapOverlay
        onSingleTap={toggleControls}
        onDoubleTapLeft={handleSkipBackward}
        onDoubleTapRight={handleSkipForward}
        disabled={showSettingsModal || showSubtitleOptions || showSpeedOptions}
      />

      {/* Buffering Indicator */}
      <BufferingIndicator
        isVisible={isBuffering || isSeeking}
        bufferProgress={bufferProgress}
        isSeeking={isSeeking}
        seekingPosition={seekingPosition}
        currentTime={currentTime}
        duration={duration}
      />

      {/* Video Controls */}
      <VideoControls
        paused={paused}
        currentTime={currentTime}
        duration={duration}
        onPlayPause={handlePlayPause}
        onSeek={handleSeek}
        onSkipForward={handleSkipForward}
        onSkipBackward={handleSkipBackward}
        onToggleFullscreen={handleToggleFullscreen}
        onSkipIntro={showSkipIntro ? handleSkipIntro : undefined}
        showSkipIntro={showSkipIntro}
        onSkipOutro={showSkipOutro ? handleSkipOutro : undefined}
        showSkipOutro={showSkipOutro}
        progress={progress}
        onSettingsPress={() => setShowSettingsModal(true)}
        onSubtitlePress={() => setShowSubtitleOptions(true)}
        onQualityPress={() => setShowSettingsModal(true)}
        onSpeedPress={() => setShowSpeedOptions(true)}
        bufferProgress={bufferProgress}
        onSeekStart={handleSeekStart}
        onSeekChange={handleSeekChange}
        onSeekEnd={handleSeekEnd}
        animeTitle={videoData?.animeTitle}
        episodeNumber={videoData?.episodeNumber}
        onBackPress={handleBackPress}
        showControls={showControls}
        onToggleControls={toggleControls}
        disabled={showSettingsModal || showSubtitleOptions || showSpeedOptions || showSaveProgressModal || showExitModal}
        onVideoFitPress={handleToggleFullscreen}
        onSystemPiPPress={handleSystemPiP}
        timingMarkers={videoData?.timings || autoDetectedTiming || undefined}
        showMarkers={preferences?.markerSettings?.showMarkers !== false}
      />

      {/* Subtitles */}
      {shouldShowSubtitles && (
        <View style={[
          styles.subtitleContainer, 
          { bottom: preferences.subtitleStyle?.positionY || subtitlePosition.y }
        ]}>
          <Text style={[
            styles.subtitleText, 
            subtitleStyle,
            {
              backgroundColor: preferences.subtitleStyle?.backgroundColor || 'rgba(13, 27, 42, 0.7)',
              textAlign: (preferences.subtitleStyle?.textAlign as 'left' | 'center' | 'right') || 'center',
            }
          ]}>
            {currentSubtitle}
          </Text>
        </View>
      )}
      
      {/* Exit Modal */}
      {showExitModal && (
        <EnhancedExitModal
          visible={showExitModal}
          onExit={handleExit}
          onCancel={() => setShowExitModal(false)}
          onSave={() => {
            setShowSaveProgressModal(true);
            setShowExitModal(false);
          }}
          isSaving={false}
          saveError={null}
          isIncognito={false}
          episodeProgress={duration > 0 ? currentTime / duration : 0}
        />
      )}

      {/* Resume Modal */}
      {showResumeModal && savedTimestamp !== null && (
        <BlurView
          style={styles.modalBlur}
          intensity={MODAL_STYLES.BLUR_INTENSITY}
          tint="dark"
        >
          <View style={styles.resumeModalCard}>
            <Text style={styles.resumeTitle}>Resume Playback?</Text>
            <Text style={styles.resumeBody}>
              Resume from where you left off?{'\n'}
              ({Math.floor(savedTimestamp / 60)}:{Math.floor(savedTimestamp % 60).toString().padStart(2, '0')})
            </Text>
            
            <View style={styles.resumeButtonContainer}>
              <TouchableOpacity 
                onPress={() => {
                  console.log('[PLAYER_SCREEN] 🔄 User chose to start over');
                  setShowResumeModal(false);
                  setSavedTimestamp(null);
                  // Start from beginning
                  if (videoPlayer) {
                    videoPlayer.currentTime = 0;
                  }
                }} 
                style={styles.startOverBtn}
              >
                <Text style={styles.resumeBtnText}>Start Over</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                onPress={() => {
                  console.log('[PLAYER_SCREEN] ▶️ User chose to resume from', savedTimestamp);
                  setShowResumeModal(false);
                  // Resume from saved timestamp
                  if (videoPlayer && savedTimestamp) {
                    videoPlayer.currentTime = savedTimestamp;
                    setCurrentTime(savedTimestamp);
                  }
                  setSavedTimestamp(null);
                }} 
                style={styles.resumeBtn}
              >
                <Text style={styles.resumeBtnText}>Resume</Text>
              </TouchableOpacity>
            </View>
          </View>
        </BlurView>
      )}

      {/* Settings Modal */}
      {showSettingsModal && (
        <SettingsModal
          onClose={() => setShowSettingsModal(false)}
          subtitles={videoData.subtitles || []}
          selectedLanguage={selectedSubtitleLanguage}
          setSelectedLanguage={setSelectedSubtitleLanguage}
          preferences={preferences}
          setPreferences={setPreferences}
          playbackSpeed={playbackSpeed}
          setPlaybackSpeed={setPlaybackSpeed}
          scalingMode={scalingMode}
          setScalingMode={setScalingMode}
          autoRotateEnabled={autoRotateEnabled}
          setAutoRotateEnabled={setAutoRotateEnabled}
          videoRef={videoRef}
          currentAudioTrack={currentAudioTrack}
          availableAudioTracks={videoData.audioTracks ? { sub: true, dub: true } : undefined}
          onAudioTrackChange={handleAudioTrackChange}
        />
      )}

      {/* Subtitle Options Modal */}
      {showSubtitleOptions && (
        <SubtitleOptions
          showSubtitleOptions={showSubtitleOptions}
          subtitles={videoData.subtitles || []}
          selectedSubtitleLanguage={selectedSubtitleLanguage}
          onSelectLanguage={(lang: string) => {
            setSelectedSubtitleLanguage(lang);
            setShowSubtitleOptions(false);
          }}
          onClose={() => setShowSubtitleOptions(false)}
        />
      )}

      {/* Speed Options Modal */}
      {showSpeedOptions && (
        <SpeedOptions
          showSpeedOptions={showSpeedOptions}
          currentSpeed={playbackSpeed}
          onSelectSpeed={(speed: number) => {
            setPlaybackSpeed(speed);
            if (videoPlayer) {
              videoPlayer.playbackRate = speed;
            }
            setShowSpeedOptions(false);
          }}
          onClose={() => setShowSpeedOptions(false)}
        />
      )}

      {/* Save Progress Modal */}
      {showSaveProgressModal && (
        <SaveProgressModal
          isVisible={showSaveProgressModal}
          onCancel={() => setShowSaveProgressModal(false)}
          onExitWithoutSaving={() => {
            setShowSaveProgressModal(false);
            handleExit();
          }}
          onSave={(rememberChoice) => handleSaveLocalProgress(rememberChoice, true)}
          onSaveToAniList={videoData?.anilistId ? (rememberChoice) => handleSaveToAniListProgress(rememberChoice, true) : undefined}
          onSaveTimestampOnly={handleSaveTimestampOnly}
          animeName={videoData.animeTitle}
          episodeNumber={videoData.episodeNumber}
          currentTime={currentTime}
          duration={duration}
          anilistId={videoData.anilistId}
          anilistUser={anilistUser || undefined}
        />
      )}

      {/* Next Episode Countdown */}
      {showNextEpisodeCountdown && nextEpisodeData?.hasNext && nextEpisodeData.nextEpisode && (
        <NextEpisodeCountdown
          isVisible={showNextEpisodeCountdown}
          nextEpisodeTitle={nextEpisodeData.nextEpisode.title || `Episode ${nextEpisodeData.nextEpisode.number}`}
          nextEpisodeNumber={nextEpisodeData.nextEpisode.number}
          remainingSeconds={(() => {
            // Calculate remaining seconds based on outro timing (Netflix style)
            const timingData = videoData?.timings || autoDetectedTiming;
            if (timingData?.outro) {
              // Show countdown time based on outro end + buffer time
              const outroEnd = timingData.outro.end;
              const bufferTime = 10; // 10 seconds buffer after outro
              const countdownEndTime = outroEnd + bufferTime;
              const remaining = Math.max(0, countdownEndTime - currentTime);
              return remaining;
            } else {
              // Fallback: remaining time from current position (for episodes without outro markers)
              return duration > 0 ? Math.max(0, duration - currentTime) : 0;
            }
          })()}
          onSkipToNext={handleSkipToNextEpisode}
          onDismiss={handleDismissCountdown}
          canAutoPlay={preferences.markerSettings?.autoPlayNextEpisode || false}
        />
      )}

      {/* Debug Overlay - Temporarily disabled due to type compatibility */}
      {/* {DEBUG.OVERLAY_ENABLED && preferences.debugOverlayEnabled && (
        <DebugOverlay />
      )} */}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  videoContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000000',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000000', // Pure black background
  },
  loadingText: {
    color: PLAYER_COLORS.TEXT_LIGHT,
    fontSize: 16,
  },
  video: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: '#000000',
    // Ensure video maintains aspect ratio and quality
    resizeMode: 'contain', // Default to contain for proper scaling
  },
  subtitleContainer: {
    position: 'absolute',
    left: 20,
    right: 20,
    alignItems: 'center',
    zIndex: 150,
  },
  subtitleText: {
    textAlign: 'center',
    backgroundColor: 'rgba(13, 27, 42, 0.7)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    overflow: 'hidden',
  },
  modalBlur: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  resumeModalCard: {
    width: '80%',
    backgroundColor: 'rgba(13, 27, 42, 0.9)',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(173, 216, 230, 0.2)',
  },
  resumeTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 16,
    textAlign: 'center',
  },
  resumeBody: {
    fontSize: 16,
    color: '#FFFFFF',
    marginBottom: 24,
    textAlign: 'center',
    opacity: 0.9,
  },
  resumeButtonContainer: {
    flexDirection: 'row',
    width: '100%',
    gap: 12,
  },
  startOverBtn: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    backgroundColor: 'rgba(255, 100, 100, 0.8)',
    borderRadius: 8,
    alignItems: 'center',
  },
  resumeBtn: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    backgroundColor: PLAYER_COLORS.PRIMARY,
    borderRadius: 8,
    alignItems: 'center',
  },
  resumeBtnText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#FFFFFF',
  },
});

export default PlayerScreen;