import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Dimensions, TouchableWithoutFeedback } from 'react-native';
import Slider from '@react-native-community/slider';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { usePlayerContext } from '../PlayerContext';
import { VideoProgressData } from '../types';
import { PLAYER_COLORS, PLAYER_BEHAVIOR, ANIMATIONS, PLAYER_UI } from '../constants';

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
  progress: VideoProgressData;
  onSettingsPress?: () => void;
  onSubtitlePress?: () => void;
  onQualityPress?: () => void;
  onSpeedPress?: () => void;
  bufferProgress?: number;
  onSeekStart?: () => void;
  onSeekEnd?: () => void;
  animeTitle?: string;
  episodeNumber?: number;
  onBackPress?: () => void;
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
  progress,
  onSettingsPress,
  onSubtitlePress,
  onQualityPress,
  onSpeedPress,
  bufferProgress = 0,
  onSeekStart,
  onSeekEnd,
  animeTitle,
  episodeNumber,
  onBackPress
}: VideoControlsProps) => {
  const { preferences } = usePlayerContext();
  const [showControls, setShowControls] = useState(true);
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
      
      // Auto-hide controls after delay unless paused or seeking
      if (!paused && !isSeeking) {
        if (hideControlsTimeout.current) {
          clearTimeout(hideControlsTimeout.current);
        }
        hideControlsTimeout.current = setTimeout(() => {
          Animated.timing(fadeAnim, {
            toValue: 0,
            duration: ANIMATIONS.CONTROLS_FADE_DURATION,
            useNativeDriver: true,
          }).start(() => {
            setShowControls(false);
          });
        }, PLAYER_BEHAVIOR.CONTROLS_HIDE_DELAY);
      }
    }
    
    return () => {
      if (hideControlsTimeout.current) {
        clearTimeout(hideControlsTimeout.current);
      }
    };
  }, [showControls, paused, isSeeking]);
  
  // Reset hide timeout on user interactions
  const resetHideTimeout = () => {
    if (hideControlsTimeout.current) {
      clearTimeout(hideControlsTimeout.current);
    }
    
    if (!showControls) {
      setShowControls(true);
    } else {
      hideControlsTimeout.current = setTimeout(() => {
        if (!paused && !isSeeking) {
          Animated.timing(fadeAnim, {
            toValue: 0,
            duration: ANIMATIONS.CONTROLS_FADE_DURATION,
            useNativeDriver: true,
          }).start(() => {
            setShowControls(false);
          });
        }
      }, PLAYER_BEHAVIOR.CONTROLS_HIDE_DELAY);
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
    // Real-time feedback during seeking - no restrictions on where user can seek
    console.log(`🎯 Seeking to ${value.toFixed(1)}s (${((value / duration) * 100).toFixed(1)}%)`);
  };
  
  const handleSeekComplete = () => {
    console.log(`🎯 Seek completed to ${seekValue.toFixed(1)}s - HLS will start buffering from this position`);
    onSeek(seekValue);
    setIsSeeking(false);
    onSeekEnd?.();
    resetHideTimeout();
  };
  
  return (
    <TouchableWithoutFeedback onPress={resetHideTimeout}>
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
        
        {/* Center Controls */}
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
            {/* Full seekable range background - shows user can seek anywhere */}
            <View style={styles.seekableRangeContainer}>
              <View style={styles.seekableRange} />
            </View>
            
            {/* Buffer progress background */}
            <View style={styles.bufferProgressContainer}>
              <View 
                style={[
                  styles.bufferProgress, 
                  { 
                    width: duration > 0 ? `${(progress.playableDuration / duration) * 100}%` : '0%' 
                  }
                ]} 
              />
            </View>
            
            <Slider
              style={styles.progressSlider}
              minimumValue={0}
              maximumValue={duration}
              value={isSeeking ? seekValue : currentTime}
              minimumTrackTintColor={PLAYER_COLORS.PRIMARY}
              maximumTrackTintColor="rgba(255, 255, 255, 0.3)"
              thumbTintColor={PLAYER_COLORS.PRIMARY}
              onSlidingStart={handleSeekStart}
              onValueChange={handleSeekChange}
              onSlidingComplete={handleSeekComplete}
              // Enhanced seeking properties for better HLS experience
              step={0.1}  // Allow fine-grained seeking
              tapToSeek={true}  // Allow tapping anywhere on the slider to seek
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
              
              {/* Playback Speed */}
              <TouchableOpacity 
                style={styles.controlButton} 
                onPress={onSpeedPress}
                accessibilityLabel="Speed"
              >
                <View style={styles.iconWrapper}>
                  <Ionicons 
                    name="speedometer" 
                    size={24} 
                    color={PLAYER_COLORS.TEXT_LIGHT} 
                  />
                </View>
              </TouchableOpacity>
              
              {/* Fullscreen Toggle */}
              <TouchableOpacity 
                style={styles.controlButton} 
                onPress={onToggleFullscreen}
                accessibilityLabel="Fullscreen"
              >
                <View style={styles.iconWrapper}>
                  <Ionicons 
                    name="resize-outline" 
                    size={24} 
                    color={PLAYER_COLORS.TEXT_LIGHT} 
                  />
                </View>
              </TouchableOpacity>
</View>

          </View>
        </Animated.View>
      </View>
    </TouchableWithoutFeedback>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
    zIndex: 100,
  },
  hidden: {
    display: 'none',
  },
  topControls: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingTop: 20,
    paddingHorizontal: 20,
    zIndex: 150,
  },
  topControlsInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  topButton: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    elevation: 4,
    zIndex: 160,
  },
  topRightButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  titleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  titleText: {
    color: PLAYER_COLORS.TEXT_LIGHT,
    fontSize: 16,
    fontWeight: 'bold',
  },
  centerControls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
    top: '50%',
    left: 0,
    right: 0,
    transform: [{ translateY: -25 }],
    zIndex: 200,
  },
  playPauseButton: {
    backgroundColor: PLAYER_COLORS.OVERLAY_BACKGROUND,
    borderRadius: PLAYER_UI.PLAY_BUTTON_SIZE / 2,
    width: PLAYER_UI.PLAY_BUTTON_SIZE,
    height: PLAYER_UI.PLAY_BUTTON_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 30,
    borderWidth: 1,
    borderColor: `rgba(255, 102, 196, 0.5)`,
    shadowColor: PLAYER_COLORS.PRIMARY,
    shadowOffset: {
      width: 0,
      height: 0,
    },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 8,
    zIndex: 250,
  },
  seekButton: {
    width: PLAYER_UI.SEEK_BUTTON_SIZE,
    height: PLAYER_UI.SEEK_BUTTON_SIZE,
    backgroundColor: PLAYER_COLORS.OVERLAY_BACKGROUND,
    borderRadius: PLAYER_UI.SEEK_BUTTON_SIZE / 2,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    zIndex: 220,
  },
  seekButtonText: {
    color: PLAYER_COLORS.TEXT_LIGHT,
    fontSize: 10,
    marginTop: -5,
  },
  bottomControls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: 20,
    paddingHorizontal: 20,
    backgroundColor: PLAYER_COLORS.OVERLAY_BACKGROUND,
    zIndex: 150,
  },
  progressBarContainer: {
    width: '100%',
    marginBottom: 12,
    position: 'relative',
  },
  seekableRangeContainer: {
    position: 'absolute',
    top: 18,
    left: 0,
    right: 0,
    height: 4,
    borderRadius: 2,
    zIndex: 0,
  },
  seekableRange: {
    height: '100%',
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 2,
  },
  bufferProgressContainer: {
    position: 'absolute',
    top: 18,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: 'transparent',
    borderRadius: 2,
    zIndex: 1,
  },
  bufferProgress: {
    height: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
    borderRadius: 2,
  },
  progressSlider: {
    width: '100%',
    height: 40,
    zIndex: 2,
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
    fontSize: 14,
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
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    marginHorizontal: 2,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
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
    backgroundColor: `rgba(255, 102, 196, 0.3)`,
    borderWidth: 1,
    borderColor: PLAYER_COLORS.PRIMARY,
  },
  subtitleIcon: {
    // Additional styling for subtitle icon if needed
  },
  // Legacy styles for compatibility
  timeControls: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  slider: {
    flex: 1,
    height: 40,
    marginHorizontal: 10,
  },
  bottomButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  iconButton: {
    padding: 10,
  },
  skipIntroContainer: {
    position: 'absolute',
    top: '30%',
    right: 20,
    zIndex: 180,
  },
  skipIntroButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `rgba(255, 102, 196, 0.8)`,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  skipIntroText: {
    color: PLAYER_COLORS.TEXT_LIGHT,
    marginRight: 4,
    fontWeight: 'bold',
  },
  activeIconButton: {
    backgroundColor: 'rgba(255, 107, 0, 0.3)',
    borderRadius: 20,
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