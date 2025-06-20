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

import React, { useState, useEffect, useRef, useCallback } from 'react';
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
} from 'react-native';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';
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
  const { preferences, setPreferences, anilistUser, onSaveToAniList } = usePlayerContext();
  
  // Video refs and state
  const videoRef = useRef<Video>(null);
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
  
  // Buffering state
  const [isBuffering, setIsBuffering] = useState(false);
  const [bufferProgress, setBufferProgress] = useState(0);
  const [isSeeking, setIsSeeking] = useState(false);
  const [seekingPosition, setSeekingPosition] = useState(0);
  const [lastSeekTime, setLastSeekTime] = useState(0);
  
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
  
  // Animation refs
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const controlsTimeout = useRef<NodeJS.Timeout | null>(null);

  // Add ref to prevent multiple loads
  const hasLoadedData = useRef(false);
  
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

  // Update current subtitle based on time
  useEffect(() => {
    if (subtitleCues.length > 0 && preferences.subtitlesEnabled) {
      const currentCue = subtitleCues.find(
        cue => currentTime >= cue.startTime && currentTime <= cue.endTime
      );
      setCurrentSubtitle(currentCue ? currentCue.text : '');
    } else {
      setCurrentSubtitle('');
    }
  }, [currentTime, subtitleCues, preferences.subtitlesEnabled]);

  // Check for intro/outro timing
  useEffect(() => {
    if (videoData?.timings) {
      const { intro, outro } = videoData.timings;
      
      if (intro && currentTime >= intro.start && currentTime <= intro.end) {
        setShowSkipIntro(true);
      } else {
        setShowSkipIntro(false);
      }
      
      if (outro && currentTime >= outro.start && currentTime <= outro.end) {
        setShowSkipOutro(true);
      } else {
        setShowSkipOutro(false);
      }
    }
  }, [currentTime, videoData?.timings]);

  // Handle video playback status updates
  const handlePlaybackStatusUpdate = useCallback((status: AVPlaybackStatus) => {
    if (status.isLoaded) {
      const currentTimeSeconds = status.positionMillis ? status.positionMillis / 1000 : 0;
      const durationSeconds = status.durationMillis ? status.durationMillis / 1000 : 0;
      const playableDurationSeconds = status.playableDurationMillis ? status.playableDurationMillis / 1000 : 0;
      
      setCurrentTime(currentTimeSeconds);
      setDuration(durationSeconds);
      setPaused(!status.shouldPlay);
      
      // Handle buffering state
      const isCurrentlyBuffering = status.shouldPlay && !status.isPlaying && !paused;
      setIsBuffering(isCurrentlyBuffering);
      
      // Calculate buffer progress (how much is buffered ahead)
      const bufferAhead = Math.max(0, playableDurationSeconds - currentTimeSeconds);
      const bufferPercentage = durationSeconds > 0 ? (playableDurationSeconds / durationSeconds) * 100 : 0;
      setBufferProgress(bufferPercentage);
      
      setProgress({
        currentTime: currentTimeSeconds,
        playableDuration: playableDurationSeconds,
        seekableDuration: durationSeconds,
      });
      
      // Log quality information periodically (every 30 seconds)
      const now = Date.now();
      if (now - lastSeekTime > 30000) {
        console.log(`📊 Video Quality Status:`);
        console.log(`   Duration: ${Math.round(durationSeconds)}s`);
        console.log(`   Current Time: ${Math.round(currentTimeSeconds)}s`);
        console.log(`   Buffer: ${bufferPercentage.toFixed(1)}%`);
        console.log(`   Playing: ${status.isPlaying ? 'Yes' : 'No'}`);
        console.log(`   Buffering: ${isCurrentlyBuffering ? 'Yes' : 'No'}`);
        // Check for video resolution if available
        const statusWithSize = status as any;
        if (statusWithSize.naturalSize && statusWithSize.naturalSize.width && statusWithSize.naturalSize.height) {
          console.log(`   Video Resolution: ${statusWithSize.naturalSize.width}x${statusWithSize.naturalSize.height}`);
        }
      }
      
      // Auto-save progress (throttled to avoid excessive writes)
      if (videoData?.episodeId && preferences.rememberPosition) {
        if (now - lastSeekTime > 5000) { // Only save every 5 seconds
          const progressData = {
            currentTime: currentTimeSeconds,
            duration: durationSeconds,
            timestamp: now,
          };
          AsyncStorage.setItem(`${STORAGE_KEYS.VIDEO_PROGRESS}${videoData.episodeId}`, JSON.stringify(progressData));
        }
      }
    } else {
      // Video is not loaded, show buffering
      setIsBuffering(true);
      console.log('⚠️ Video not loaded - showing buffering indicator');
    }
  }, [videoData?.episodeId, preferences.rememberPosition, paused, lastSeekTime]);

  // Control handlers
  const handlePlayPause = useCallback(() => {
    if (videoRef.current) {
      if (paused) {
        videoRef.current.playAsync();
      } else {
        videoRef.current.pauseAsync();
      }
    }
  }, [paused]);

  // Debounced seek to reduce buffering
  const seekTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isSeekingRef = useRef(false);
  
  const handleSeek = useCallback((time: number) => {
    if (videoRef.current && !isSeekingRef.current) {
      // Prevent multiple simultaneous seeks
      isSeekingRef.current = true;
      setSeekingPosition(time);
      setLastSeekTime(Date.now());
      
      // Clear previous timeout
      if (seekTimeoutRef.current) {
        clearTimeout(seekTimeoutRef.current);
      }
      
      // Debounce the actual seek operation
      seekTimeoutRef.current = setTimeout(() => {
        if (videoRef.current) {
          setIsBuffering(true);
          
          // Perform the seek operation
          videoRef.current.setPositionAsync(time * 1000, {
            toleranceMillisBefore: PLAYER_BEHAVIOR.SEEK_TOLERANCE_MS,
            toleranceMillisAfter: PLAYER_BEHAVIOR.SEEK_TOLERANCE_MS,
          }).then(() => {
            setIsBuffering(false);
            isSeekingRef.current = false;
            console.log(`📍 Seeked to ${time.toFixed(1)}s`);
          }).catch((error) => {
            console.error('Seek error:', error);
            setIsBuffering(false);
            isSeekingRef.current = false;
          });
        }
      }, PLAYER_BEHAVIOR.SEEK_DEBOUNCE_MS);
    }
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
    if (videoData?.timings?.intro) {
      handleSeek(videoData.timings.intro.end);
    }
  }, [videoData?.timings, handleSeek]);

  const handleSkipOutro = useCallback(() => {
    if (videoData?.timings?.outro) {
      handleSeek(videoData.timings.outro.end);
    }
  }, [videoData?.timings, handleSeek]);

  // Toggle controls visibility
  const toggleControls = useCallback(() => {
    setShowControls(prev => !prev);
  }, []);

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
  const handleToggleFullscreen = useCallback(() => {
    const resizeModes = [ResizeMode.CONTAIN, ResizeMode.COVER, ResizeMode.STRETCH];
    const currentIndex = resizeModes.indexOf(scalingMode as ResizeMode);
    const nextIndex = (currentIndex + 1) % resizeModes.length;
    const nextMode = resizeModes[nextIndex];
    
    setScalingMode(nextMode);
    
    // Show a brief toast/feedback about the current mode
    const modeNames = ['Fit', 'Fill', 'Stretch'];
    console.log(`📺 Video resize mode: ${modeNames[nextIndex]}`);
  }, [scalingMode, setScalingMode]);

  // Audio track switching
  const handleAudioTrackChange = useCallback(async (track: 'sub' | 'dub') => {
    if (videoData?.audioTracks && track !== currentAudioTrack) {
      setCurrentAudioTrack(track);
      // Here you would implement the logic to switch audio tracks
      // This might involve loading a different video source
      console.log(`🎵 Switching to ${track} audio track`);
    }
  }, [videoData?.audioTracks, currentAudioTrack]);

  // Get video source with proxy if needed
  const getVideoSource = useCallback(() => {
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

  // Handle AniList save
  const handleSaveToAniListProgress = async (rememberChoice: boolean) => {
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
      handleExit();
    }
  };

  // Handle local save
  const handleSaveLocalProgress = async (rememberChoice: boolean) => {
    if (!videoData?.episodeId) {
      console.log('[PLAYER_SCREEN] ⚠️ Cannot save locally: missing episode ID');
      setShowSaveProgressModal(false);
      handleExit();
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
      handleExit();
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
      
      {/* Video Player */}
      <Video
        ref={videoRef}
        style={styles.video}
        source={{
          uri: getVideoSource(),
          headers: videoData.headers,
        }}
        shouldPlay={!paused}
        isLooping={false}
        resizeMode={scalingMode as ResizeMode}
        onPlaybackStatusUpdate={handlePlaybackStatusUpdate}
        rate={playbackSpeed}
        volume={preferences.volume}
        // Enhanced video quality settings
        shouldRasterizeIOS={false}
        useNativeControls={false}
        progressUpdateIntervalMillis={500}
      />

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
        progress={progress}
        onSettingsPress={() => setShowSettingsModal(true)}
        onSubtitlePress={() => setShowSubtitleOptions(true)}
        onQualityPress={() => setShowSettingsModal(true)}
        onSpeedPress={() => setShowSpeedOptions(true)}
        bufferProgress={bufferProgress}
        onSeekStart={() => {
          setIsSeeking(true);
          setSeekingPosition(currentTime);
        }}
        onSeekEnd={() => {
          setIsSeeking(false);
        }}
        animeTitle={videoData.animeTitle}
        episodeNumber={videoData.episodeNumber}
        onBackPress={handleBackPress}
      />

      {/* Subtitles */}
      {currentSubtitle && preferences.subtitlesEnabled && subtitleCues.length > 0 && (
        <View style={[styles.subtitleContainer, { bottom: subtitlePosition.y }]}>
          <Text style={[styles.subtitleText, {
            fontSize: preferences.subtitleStyle?.fontSize || 18,
            color: preferences.subtitleStyle?.textColor || '#FFFFFF',
            fontWeight: preferences.subtitleStyle?.boldText ? 'bold' : 'normal',
          }]}>
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
            if (videoRef.current) {
              videoRef.current.setRateAsync(speed, true);
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
          onSave={handleSaveLocalProgress}
          onSaveToAniList={anilistUser && videoData?.anilistId ? handleSaveToAniListProgress : undefined}
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
    backgroundColor: '#000',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  loadingText: {
    color: PLAYER_COLORS.TEXT_LIGHT,
    fontSize: 16,
  },
  video: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
    backgroundColor: '#000',
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
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    overflow: 'hidden',
  },
});

export default PlayerScreen;