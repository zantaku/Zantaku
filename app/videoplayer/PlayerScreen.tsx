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
} from 'react-native';
import * as ExpoVideo from 'expo-video';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';
import { VideoView, useVideoPlayer, VideoSource } from 'expo-video';
import { useEvent } from 'expo';
import { useLocalSearchParams, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
// import DebugOverlay from './components/DebugOverlay'; // Temporarily disabled

// Import types and constants
import { VideoProgressData, Subtitle, SubtitleCue, VideoTimings, AudioTrack } from './types';
import { usePlayerContext } from './PlayerContext';
import {
  PLAYER_COLORS,
  PLAYER_BEHAVIOR,
  ANIMATIONS,
  M3U8_PROXY_BASE_URL,
  USE_PROXY,
  STORAGE_KEYS,
  DEBUG,
  AUTO_DETECT_TIMING,
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
  
  // Subtitle state
  const [currentSubtitle, setCurrentSubtitle] = useState<string>('');
  const [subtitleCues, setSubtitleCues] = useState<SubtitleCue[]>([]);
  const [subtitlePosition, setSubtitlePosition] = useState({ x: 0, y: SCREEN_HEIGHT * 0.8 });
  
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
  
  // Memoized video source to prevent unnecessary recalculations
  const videoSource = useMemo(() => {
    if (!videoData?.source) return '';
    
    const finalUrl = USE_PROXY 
      ? `${M3U8_PROXY_BASE_URL}${encodeURIComponent(videoData.source)}`
      : videoData.source;
    
    console.log(`🎬 Video source URL: ${finalUrl.substring(0, 100)}...`);
    console.log(`🔗 Using proxy: ${USE_PROXY ? 'Yes' : 'No'}`);
    
    // Log if URL contains quality indicators
    if (finalUrl.includes('1080') || finalUrl.includes('720') || finalUrl.includes('480')) {
      console.log(`📺 Quality detected in URL: ${finalUrl.match(/\d+p?/g)?.join(', ')}`);
    }
    
    return finalUrl;
  }, [videoData?.source]);

  // Create expo-video player for system PiP
  const videoPlayer = useVideoPlayer(
    videoData && videoSource ? {
      uri: videoSource,
      headers: videoData.headers || {}
    } : null,
    (player) => {
      if (player && videoData) {
        player.loop = false;
        player.muted = false;
        player.volume = preferences.volume;
        player.playbackRate = playbackSpeed;
        player.timeUpdateEventInterval = 500; // Update every 500ms
        console.log('[EXPO-VIDEO] 🎬 Player created and configured');
      }
    }
  );

  // Simplified time update using refs to prevent infinite loops
  const lastTimeRef = useRef(0);
  const lastDurationRef = useRef(0);
  
  useEffect(() => {
    if (videoPlayer) {
      const timeUpdateInterval = setInterval(() => {
        try {
          const newTime = videoPlayer.currentTime || 0;
          const newDuration = videoPlayer.duration || 0;
          const isPlaying = videoPlayer.playing || false;
          
          // Only update time if there's a significant change
          if (Math.abs(newTime - lastTimeRef.current) > 0.5) {
            lastTimeRef.current = newTime;
            setCurrentTime(newTime);
          }
          
          // Set duration only once when video is loaded
          if (newDuration > 0 && lastDurationRef.current === 0) {
            lastDurationRef.current = newDuration;
            setDuration(newDuration);
          }
          
          // Update paused state
          setPaused(!isPlaying);
          
        } catch (error) {
          console.warn('[EXPO-VIDEO] Time update error:', error);
        }
      }, 500); // Update every 500ms
      
      return () => clearInterval(timeUpdateInterval);
    }
  }, [videoPlayer]); // Only depend on videoPlayer creation

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
      return `${videoData.animeTitle} - Episode ${videoData.episodeNumber}`;
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
          data = {
            source: params.url as string,
            headers: params.headers ? JSON.parse(params.headers as string) : undefined,
            subtitles: params.subtitles ? JSON.parse(params.subtitles as string) : [],
            timings: params.timings ? JSON.parse(params.timings as string) : undefined,
            episodeId: params.episodeId as string,
            episodeNumber: params.episodeNumber ? parseInt(params.episodeNumber as string) : undefined,
            animeTitle: params.animeTitle as string,
            anilistId: params.anilistId as string,
          };
        }

        if (data && data.source) {
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
          } else if (data.subtitles && data.subtitles[0]) {
            // Load subtitle cues if available
            await loadSubtitleCues(data.subtitles[0].url);
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

  // Load subtitle cues from URL
  const loadSubtitleCues = async (subtitleUrl: string) => {
    try {
      const response = await fetch(subtitleUrl);
      const vttContent = await response.text();
      const cues = parseVTT(vttContent);
      setSubtitleCues(cues);
      
      // If no cues were parsed from the VTT, disable subtitles
      if (cues.length === 0) {
        console.log('⚠️ No subtitle cues found in VTT file, disabling subtitles');
        setPreferences(prev => ({
          ...prev,
          subtitlesEnabled: false
        }));
      }
    } catch (error) {
      console.error('❌ Error loading subtitles:', error);
      // Disable subtitles on error
      setPreferences(prev => ({
        ...prev,
        subtitlesEnabled: false
      }));
    }
  };

  // Parse VTT subtitle format
  const parseVTT = (vttContent: string): SubtitleCue[] => {
    const cues: SubtitleCue[] = [];
    const lines = vttContent.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.includes('-->')) {
        const [startTime, endTime] = line.split('-->').map(t => parseTimeToSeconds(t.trim()));
        let text = '';
        
        // Collect subtitle text lines
        for (let j = i + 1; j < lines.length && lines[j].trim() !== ''; j++) {
          text += lines[j].trim() + ' ';
        }
        
        if (text.trim()) {
          cues.push({
            startTime,
            endTime,
            text: text.trim(),
          });
        }
      }
    }
    
    return cues;
  };

  // Convert time string to seconds
  const parseTimeToSeconds = (timeString: string): number => {
    const parts = timeString.split(':');
    const seconds = parseFloat(parts[parts.length - 1]);
    const minutes = parts.length > 1 ? parseInt(parts[parts.length - 2]) : 0;
    const hours = parts.length > 2 ? parseInt(parts[parts.length - 3]) : 0;
    
    return hours * 3600 + minutes * 60 + seconds;
  };

  // Update current subtitle based on time - optimized with useMemo
  useEffect(() => {
    if (subtitleCues.length > 0 && preferences.subtitlesEnabled) {
      const currentCue = subtitleCues.find(
        cue => currentTime >= cue.startTime && currentTime <= cue.endTime
      );
      const newSubtitle = currentCue ? currentCue.text : '';
      
      // Only update if subtitle actually changed
      if (newSubtitle !== currentSubtitle) {
        setCurrentSubtitle(newSubtitle);
      }
    } else if (currentSubtitle) {
      setCurrentSubtitle('');
    }
  }, [currentTime, subtitleCues, preferences.subtitlesEnabled, currentSubtitle]);

  // Check for intro/outro timing - optimized
  useEffect(() => {
    if (videoData?.timings) {
      const { intro, outro } = videoData.timings;
      
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
    // Use provided timing data if available, otherwise use auto-detected
    const timingData = videoData?.timings || autoDetectedTiming;
    
    console.log('[SKIP] 🔍 Checking skip buttons:', {
      currentTime,
      timingData,
      showSkipIntro,
      showSkipOutro
    });
    
    if (timingData) {
      const { intro, outro } = timingData;
      
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
  const [contentFitMode, setContentFitMode] = useState<"contain" | "cover" | "fill">("contain");
  
  const handleToggleFullscreen = useCallback(() => {
    // For expo-video, we need to use contentFit property
    const contentFitModes = ["contain", "cover", "fill"] as const;
    const modeNames = ['Fit', 'Fill', 'Stretch'];
    
    const currentIndex = contentFitModes.indexOf(contentFitMode);
    const nextIndex = (currentIndex + 1) % contentFitModes.length;
    const nextMode = contentFitModes[nextIndex];
    
    // Update the contentFit mode
    setContentFitMode(nextMode);
    
    // Also update the old scaling mode for compatibility
    const oldResizeModes = [ResizeMode.CONTAIN, ResizeMode.COVER, ResizeMode.STRETCH];
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
    
    // For iOS, we'll just use the console log for now
    // We could implement a custom toast component if needed
    
    // Force update the VideoView - try multiple approaches
    if (videoRef.current) {
      // Method 1: Try setNativeProps
      try {
        if (videoRef.current.setNativeProps) {
          videoRef.current.setNativeProps({ contentFit: nextMode });
        }
      } catch (error) {
        console.warn('Could not set native props on VideoView', error);
      }
      
      // Method 2: Try direct property update
      try {
        videoRef.current.contentFit = nextMode;
      } catch (error) {
        console.warn('Could not update contentFit directly', error);
      }
      
      // Method 3: Force remount by toggling a key
      setVideoKey(prevKey => prevKey + 1);
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
    if (!videoData || !onSaveToAniList || !videoData.anilistId) {
      console.log('[PLAYER_SCREEN] ⚠️ Cannot save to AniList: missing data');
      return;
    }

    try {
      const success = await onSaveToAniList({
        anilistId: videoData.anilistId,
        episodeNumber: videoData.episodeNumber || 1,
        currentTime,
        duration
      });

      if (success) {
        console.log('[PLAYER_SCREEN] ✅ Successfully saved to AniList');
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
      
      {/* System PiP Video Player - VideoView for native PiP support */}
      <VideoView
        key={`video-view-${videoKey}`}
        ref={videoRef}
        style={styles.video}
        player={videoPlayer}
        allowsFullscreen={true}
        allowsPictureInPicture={true}
        startsPictureInPictureAutomatically={false}
        nativeControls={false}
        contentFit={contentFitMode}
        onPictureInPictureStart={handlePiPStart}
        onPictureInPictureStop={handlePiPStop}
      />
      
      {/* Fallback: Original expo-av Video Player (commented out but kept for reference) */}
      {/* <Video
        ref={videoRef}
        style={styles.video}
        source={{
          uri: videoSource,
          headers: videoData.headers,
        }}
        shouldPlay={!paused}
        isLooping={false}
        resizeMode={scalingMode as ResizeMode}
        onPlaybackStatusUpdate={handlePlaybackStatusUpdate}
        rate={playbackSpeed}
        volume={preferences.volume}
        shouldRasterizeIOS={false}
        useNativeControls={false}
        progressUpdateIntervalMillis={500}
      /> */}

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
        animeTitle={displayTitle}
        episodeNumber={videoData.episodeNumber}
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
        <View style={[styles.subtitleContainer, { bottom: subtitlePosition.y }]}>
          <Text style={[styles.subtitleText, subtitleStyle]}>
            {currentSubtitle}
          </Text>
        </View>
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
          onSaveToAniList={anilistUser && videoData?.anilistId ? (rememberChoice) => handleSaveToAniListProgress(rememberChoice, true) : undefined}
          animeName={videoData.animeTitle}
          episodeNumber={videoData.episodeNumber}
          currentTime={currentTime}
          duration={duration}
          anilistId={videoData.anilistId}
          anilistUser={anilistUser || undefined}
        />
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
    backgroundColor: PLAYER_COLORS.BACKGROUND_DARK,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: PLAYER_COLORS.BACKGROUND_DARK,
  },
  loadingText: {
    color: PLAYER_COLORS.TEXT_LIGHT,
    fontSize: 16,
  },
  video: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
    backgroundColor: PLAYER_COLORS.BACKGROUND_DARK,
    // Ensure video maintains aspect ratio and quality
    overflow: 'hidden',
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
});

export default PlayerScreen;