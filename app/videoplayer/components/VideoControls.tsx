import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Dimensions, TouchableWithoutFeedback } from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { usePlayerContext } from '../PlayerContext';
import { VideoProgressData } from '../types';
import { PLAYER_COLORS, PLAYER_BEHAVIOR, ANIMATIONS, PLAYER_UI } from '../constants';
import CustomSeekBar from './CustomSeekBar';

interface VideoControlsProps {
  paused: boolean;
  currentTime: number;
  duration: number;
  onPlayPause: () => void;
  onSeek: (time: number) => void;
  onSkipForward: () => void;
  onSkipBackward: () => void;
  onToggleFullscreen: () => void;
  onSkipIntro?: () => void;
  showSkipIntro?: boolean;
  onSkipOutro?: () => void;
  showSkipOutro?: boolean;
  progress: VideoProgressData;
  onSettingsPress?: () => void;
  onSubtitlePress?: () => void;
  onQualityPress?: () => void;
  onSpeedPress?: () => void;
  bufferProgress?: number;
  onSeekStart?: () => void;
  onSeekChange?: (time: number) => void;
  onSeekEnd?: () => void;
  animeTitle?: string;
  episodeNumber?: number;
  onBackPress?: () => void;
  showControls: boolean;
  onToggleControls: () => void;
  disabled?: boolean;
  onPiPPress?: () => void;
  onSystemPiPPress?: () => void;
  onVideoFitPress?: () => void;
  timingMarkers?: {
    intro?: { start: number; end: number };
    outro?: { start: number; end: number };
  };
  showMarkers?: boolean;
}

const VideoControls = ({
  paused,
  currentTime,
  duration,
  onPlayPause,
  onSeek,
  onSkipForward,
  onSkipBackward,
  onToggleFullscreen,
  onSkipIntro,
  showSkipIntro = false,
  onSkipOutro,
  showSkipOutro = false,
  progress,
  onSettingsPress,
  onSubtitlePress,
  onQualityPress,
  onSpeedPress,
  bufferProgress = 0,
  onSeekStart,
  onSeekChange,
  onSeekEnd,
  animeTitle,
  episodeNumber,
  onBackPress,
  showControls,
  onToggleControls,
  disabled = false,
  onPiPPress,
  onSystemPiPPress,
  onVideoFitPress,
  timingMarkers,
  showMarkers = false
}: VideoControlsProps) => {
  const { preferences } = usePlayerContext();
  const [isSeeking, setIsSeeking] = useState(false);
  const [seekValue, setSeekValue] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const hideControlsTimeout = useRef<NodeJS.Timeout | null>(null);
  
  // Format time as mm:ss
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };
  
  // Control visibility
  useEffect(() => {
    if (showControls) {
      // Show controls
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: ANIMATIONS.CONTROLS_FADE_DURATION,
        useNativeDriver: true,
      }).start();
      
      // Auto-hide controls after delay unless paused, seeking, or disabled (modals open)
      if (!paused && !isSeeking && !disabled) {
        if (hideControlsTimeout.current) {
          clearTimeout(hideControlsTimeout.current);
        }
        hideControlsTimeout.current = setTimeout(() => {
          onToggleControls();
        }, PLAYER_BEHAVIOR.CONTROLS_HIDE_DELAY);
      }
    } else {
      // Hide controls
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: ANIMATIONS.CONTROLS_FADE_DURATION,
        useNativeDriver: true,
      }).start();
    }
    
    return () => {
      if (hideControlsTimeout.current) {
        clearTimeout(hideControlsTimeout.current);
      }
    };
  }, [showControls, paused, isSeeking, disabled, onToggleControls]);
  
  // Reset hide timeout on user interactions
  const resetHideTimeout = () => {
    if (hideControlsTimeout.current) {
      clearTimeout(hideControlsTimeout.current);
    }
    
    if (!showControls) {
      onToggleControls();
    } else {
      // If controls are already showing, reset the hide timer
      if (!paused && !isSeeking && !disabled) {
        hideControlsTimeout.current = setTimeout(() => {
          onToggleControls();
        }, PLAYER_BEHAVIOR.CONTROLS_HIDE_DELAY);
      }
    }
  };
  
  // Handle seeking with enhanced feedback
  const handleSeekStart = () => {
    setIsSeeking(true);
    setSeekValue(currentTime);
    onSeekStart?.();
    console.log(`🎯 Started seeking from ${currentTime.toFixed(1)}s`);
  };
  
  const handleSeekChange = (value: number) => {
    setSeekValue(value);
    // Only log occasionally during seeking to prevent spam
    if (Math.abs(value - seekValue) > 5) { // Only log every 5 seconds of difference
      console.log(`🎯 Seeking to ${value.toFixed(1)}s (${((value / duration) * 100).toFixed(1)}%)`);
    }
  };
  
  const handleSeekComplete = () => {
    console.log(`🎯 Seek completed to ${seekValue.toFixed(1)}s`);
    onSeek(seekValue);
    setIsSeeking(false);
    onSeekEnd?.();
    resetHideTimeout();
  };
  
  return (
    <View style={styles.container}>
      {/* Top Controls */}
      <Animated.View 
        style={[
          styles.topControls, 
          { opacity: fadeAnim },
          !showControls && styles.hidden
        ]}
      >
        <View style={styles.topControlsInner}>
          <TouchableOpacity onPress={onBackPress} style={styles.topButton}>
            <View style={styles.iconWrapper}>
              <Ionicons name="arrow-back" size={PLAYER_UI.ICON_SIZE.LARGE} color={PLAYER_COLORS.TEXT_LIGHT} />
            </View>
          </TouchableOpacity>
          
          <View style={styles.titleContainer}>
            <Text style={styles.titleText} numberOfLines={1}>
              {animeTitle && episodeNumber 
                ? `${animeTitle} - Episode ${episodeNumber}`
                : animeTitle || 'Current Episode'
              }
            </Text>
          </View>
          
          <TouchableOpacity style={styles.topButton} onPress={onSettingsPress}>
            <View style={styles.iconWrapper}>
              <Ionicons name="settings-outline" size={PLAYER_UI.ICON_SIZE.LARGE} color={PLAYER_COLORS.TEXT_LIGHT} />
            </View>
          </TouchableOpacity>
        </View>
      </Animated.View>
      
      {/* Center Controls - wrapped in TouchableWithoutFeedback for tap-to-toggle */}
      <TouchableWithoutFeedback onPress={resetHideTimeout}>
        <Animated.View 
          style={[
            styles.centerControls,
            { opacity: fadeAnim },
            !showControls && styles.hidden
          ]}
        >
          <TouchableOpacity onPress={onSkipBackward} style={styles.seekButton}>
            <View style={styles.iconWrapper}>
              <Ionicons name="play-back" size={PLAYER_UI.ICON_SIZE.LARGE} color={PLAYER_COLORS.TEXT_LIGHT} />
            </View>
            <Text style={styles.seekButtonText}>{PLAYER_BEHAVIOR.DOUBLE_TAP_SEEK_TIME}s</Text>
          </TouchableOpacity>
          
          <TouchableOpacity onPress={onPlayPause} style={styles.playPauseButton}>
            <View style={styles.iconWrapper}>
              <Ionicons 
                name={paused ? "play" : "pause"} 
                size={PLAYER_UI.ICON_SIZE.XLARGE} 
                color={PLAYER_COLORS.TEXT_LIGHT} 
              />
            </View>
          </TouchableOpacity>
          
          <TouchableOpacity onPress={onSkipForward} style={styles.seekButton}>
            <View style={styles.iconWrapper}>
              <Ionicons name="play-forward" size={PLAYER_UI.ICON_SIZE.LARGE} color={PLAYER_COLORS.TEXT_LIGHT} />
            </View>
            <Text style={styles.seekButtonText}>{PLAYER_BEHAVIOR.DOUBLE_TAP_SEEK_TIME}s</Text>
          </TouchableOpacity>
        </Animated.View>
      </TouchableWithoutFeedback>

      {/* Skip Intro Button */}
      {showSkipIntro && (
        <Animated.View 
          style={[
            styles.skipIntroContainer,
            { opacity: fadeAnim }
          ]}
        >
          <TouchableOpacity 
            style={styles.skipIntroButton}
            onPress={onSkipIntro}
          >
            <Text style={styles.skipIntroText}>Skip Intro</Text>
            <View style={styles.iconWrapper}>
              <Ionicons name="play-forward" size={PLAYER_UI.ICON_SIZE.SMALL} color={PLAYER_COLORS.TEXT_LIGHT} />
            </View>
          </TouchableOpacity>
        </Animated.View>
      )}
      
      {/* Skip Outro Button */}
      {showSkipOutro && (
        <Animated.View 
          style={[
            styles.skipOutroContainer,
            { opacity: fadeAnim }
          ]}
        >
          <TouchableOpacity 
            style={styles.skipOutroButton}
            onPress={onSkipOutro}
          >
            <Text style={styles.skipOutroText}>Skip Outro</Text>
            <View style={styles.iconWrapper}>
              <Ionicons name="play-forward" size={PLAYER_UI.ICON_SIZE.SMALL} color={PLAYER_COLORS.TEXT_LIGHT} />
            </View>
          </TouchableOpacity>
        </Animated.View>
      )}
      
      {/* Bottom Controls */}
      <Animated.View 
        style={[
          styles.bottomControls, 
          { opacity: fadeAnim },
          !showControls && styles.hidden
        ]}
      >
        {/* Progress Bar - Full Width */}
        <View style={styles.progressBarContainer}>
          <CustomSeekBar
            currentTime={currentTime}
            duration={duration}
            bufferedTime={progress.playableDuration}
            onSeekStart={handleSeekStart}
            onSeekChange={handleSeekChange}
            onSeekEnd={handleSeekComplete}
            onSeek={onSeek}
            disabled={duration === 0}
            style={styles.customSeekBar}
            timingMarkers={timingMarkers}
            showMarkers={showMarkers}
          />
        </View>
        
        {/* Bottom Row - Time and Controls */}
        <View style={styles.bottomRow}>
          {/* Time Display - Left Side */}
          <View style={styles.timeContainer}>
            <Text style={styles.timeText}>
              {formatTime(currentTime)} / {formatTime(duration)}
            </Text>
          </View>
          
          {/* Control Buttons - Right Side */}
          <View style={styles.controlButtonsContainer}>
            {/* Subtitles */}
            <TouchableOpacity 
              style={[
                styles.controlButton,
                preferences?.subtitlesEnabled && styles.activeControlButton
              ]} 
              onPress={onSubtitlePress}
              accessibilityLabel="Subtitles"
            >
              <View style={styles.iconWrapper}>
                <Ionicons 
                  name="chatbubble" 
                  size={24} 
                  color={preferences?.subtitlesEnabled ? PLAYER_COLORS.PRIMARY : PLAYER_COLORS.TEXT_LIGHT} 
                />
              </View>
            </TouchableOpacity>
            
            {/* Video Fit/Scale */}
            <TouchableOpacity 
              style={styles.controlButton} 
              onPress={onVideoFitPress}
              accessibilityLabel="Video Fit/Scale"
            >
              <View style={styles.iconWrapper}>
                <Ionicons 
                  name="resize" 
                  size={24} 
                  color={PLAYER_COLORS.TEXT_LIGHT} 
                />
              </View>
            </TouchableOpacity>
            
            {/* System Picture-in-Picture */}
            {onSystemPiPPress && (
              <TouchableOpacity 
                style={styles.controlButton} 
                onPress={onSystemPiPPress}
                accessibilityLabel="Picture in Picture"
              >
                <View style={styles.iconWrapper}>
                  <Ionicons 
                    name="phone-portrait-outline" 
                    size={24} 
                    color={PLAYER_COLORS.TEXT_LIGHT} 
                  />
                </View>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
    zIndex: 100,
    pointerEvents: 'box-none', // Allow touch events to pass through to children only
  },
  hidden: {
    display: 'none',
  },
  topControls: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingTop: 10,
    backgroundColor: 'rgba(13, 27, 42, 0.6)', // Updated to blue with transparency
    pointerEvents: 'auto', // Ensure this can receive touch events
    zIndex: 200, // Higher z-index to ensure it's on top
  },
  topControlsInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  topButton: {
    padding: 8,
  },
  titleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  titleText: {
    color: PLAYER_COLORS.TEXT_LIGHT,
    fontSize: 16,
    fontWeight: '500',
  },
  centerControls: {
    position: 'absolute',
    top: '30%',
    left: 0,
    right: 0,
    bottom: '30%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'box-none', // Allow touch events to pass through to children only
  },
  playPauseButton: {
    width: PLAYER_UI.PLAY_BUTTON_SIZE,
    height: PLAYER_UI.PLAY_BUTTON_SIZE,
    borderRadius: PLAYER_UI.PLAY_BUTTON_SIZE / 2,
    backgroundColor: 'rgba(13, 27, 42, 0.7)', // Updated to blue with transparency
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 40,
  },
  seekButton: {
    width: PLAYER_UI.SEEK_BUTTON_SIZE,
    height: PLAYER_UI.SEEK_BUTTON_SIZE,
    borderRadius: PLAYER_UI.SEEK_BUTTON_SIZE / 2,
    backgroundColor: 'rgba(13, 27, 42, 0.7)', // Updated to blue with transparency
    alignItems: 'center',
    justifyContent: 'center',
  },
  seekButtonText: {
    color: PLAYER_COLORS.TEXT_LIGHT,
    fontSize: 10,
    marginTop: 2,
  },
  bottomControls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: 20,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(13, 27, 42, 0.6)', // Updated to blue with transparency
    pointerEvents: 'auto', // Ensure this can receive touch events
    zIndex: 200, // Higher z-index to ensure it's on top
  },
  progressBarContainer: {
    width: '100%',
    height: 40,
    justifyContent: 'center',
  },
  customSeekBar: {
    width: '100%',
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  timeContainer: {
    flex: 1,
  },
  timeText: {
    color: PLAYER_COLORS.TEXT_LIGHT,
    fontSize: 12,
    fontWeight: '500',
  },
  controlButtonsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  controlButton: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(13, 27, 42, 0.7)', // Updated to blue with transparency
    marginHorizontal: 2,
    borderWidth: 1,
    borderColor: 'rgba(173, 216, 230, 0.3)', // Light blue border
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    zIndex: 160,
  },
  activeControlButton: {
    backgroundColor: 'rgba(52, 152, 219, 0.4)', // Blue active state
    borderWidth: 1,
    borderColor: PLAYER_COLORS.PRIMARY,
  },
  skipIntroContainer: {
    position: 'absolute',
    bottom: 100,
    right: 20,
    zIndex: 150,
  },
  skipIntroButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(13, 27, 42, 0.8)', // Updated to blue with transparency
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: PLAYER_COLORS.PRIMARY,
  },
  skipIntroText: {
    color: PLAYER_COLORS.TEXT_LIGHT,
    fontSize: 14,
    marginRight: 4,
  },
  skipOutroContainer: {
    position: 'absolute',
    bottom: 100,
    right: 20,
    zIndex: 150,
  },
  skipOutroButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(13, 27, 42, 0.8)', // Updated to blue with transparency
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: PLAYER_COLORS.PRIMARY,
  },
  skipOutroText: {
    color: PLAYER_COLORS.TEXT_LIGHT,
    fontSize: 14,
    marginRight: 4,
  },
  iconWrapper: {
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 300,
    // Ensure icons render properly on all platforms
    overflow: 'visible',
    backgroundColor: 'transparent',
  },
});

export default VideoControls; 