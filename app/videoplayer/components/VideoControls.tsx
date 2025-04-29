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
  onSpeedPress
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
  
  // Handle seeking
  const handleSeekStart = () => {
    setIsSeeking(true);
    setSeekValue(currentTime);
  };
  
  const handleSeekChange = (value: number) => {
    setSeekValue(value);
  };
  
  const handleSeekComplete = () => {
    onSeek(seekValue);
    setIsSeeking(false);
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
            <TouchableOpacity onPress={onToggleFullscreen} style={styles.iconButton}>
              <Ionicons name="arrow-back" size={PLAYER_UI.ICON_SIZE.MEDIUM} color={PLAYER_COLORS.TEXT_LIGHT} />
            </TouchableOpacity>
            
            <View style={styles.titleContainer}>
              <Text style={styles.titleText} numberOfLines={1}>
                Current Episode
              </Text>
            </View>
            
            <TouchableOpacity style={styles.iconButton} onPress={onSettingsPress}>
              <Ionicons name="settings-outline" size={PLAYER_UI.ICON_SIZE.MEDIUM} color={PLAYER_COLORS.TEXT_LIGHT} />
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
            <Ionicons name="play-back" size={PLAYER_UI.ICON_SIZE.LARGE} color={PLAYER_COLORS.TEXT_LIGHT} />
            <Text style={styles.seekButtonText}>{PLAYER_BEHAVIOR.DOUBLE_TAP_SEEK_TIME}s</Text>
          </TouchableOpacity>
          
          <TouchableOpacity onPress={onPlayPause} style={styles.playPauseButton}>
            <Ionicons 
              name={paused ? "play" : "pause"} 
              size={PLAYER_UI.ICON_SIZE.XLARGE} 
              color={PLAYER_COLORS.TEXT_LIGHT} 
            />
          </TouchableOpacity>
          
          <TouchableOpacity onPress={onSkipForward} style={styles.seekButton}>
            <Ionicons name="play-forward" size={PLAYER_UI.ICON_SIZE.LARGE} color={PLAYER_COLORS.TEXT_LIGHT} />
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
              <Ionicons name="play-forward" size={PLAYER_UI.ICON_SIZE.SMALL} color={PLAYER_COLORS.TEXT_LIGHT} />
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
          <View style={styles.timeControls}>
            <Text style={styles.timeText}>{formatTime(currentTime)}</Text>
            
            <Slider
              style={styles.slider}
              minimumValue={0}
              maximumValue={duration}
              value={isSeeking ? seekValue : currentTime}
              minimumTrackTintColor={PLAYER_COLORS.PRIMARY}
              maximumTrackTintColor={PLAYER_COLORS.SLIDER_TRACK}
              thumbTintColor={PLAYER_COLORS.PRIMARY}
              onSlidingStart={handleSeekStart}
              onValueChange={handleSeekChange}
              onSlidingComplete={handleSeekComplete}
            />
            
            <Text style={styles.timeText}>{formatTime(duration)}</Text>
          </View>
          
          <View style={styles.bottomButtonsRow}>
            <TouchableOpacity style={styles.iconButton} onPress={onSpeedPress}>
              <MaterialIcons name="speed" size={PLAYER_UI.ICON_SIZE.MEDIUM} color={PLAYER_COLORS.TEXT_LIGHT} />
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.iconButton} onPress={onQualityPress}>
              <Ionicons name="layers-outline" size={PLAYER_UI.ICON_SIZE.MEDIUM} color={PLAYER_COLORS.TEXT_LIGHT} />
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.iconButton} onPress={onSubtitlePress}>
              <Ionicons name="text" size={PLAYER_UI.ICON_SIZE.MEDIUM} color={PLAYER_COLORS.TEXT_LIGHT} />
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.iconButton} onPress={onToggleFullscreen}>
              <Ionicons name="expand" size={PLAYER_UI.ICON_SIZE.MEDIUM} color={PLAYER_COLORS.TEXT_LIGHT} />
            </TouchableOpacity>
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
    zIndex: 10,
  },
  topControlsInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
    elevation: 5,
  },
  seekButton: {
    width: PLAYER_UI.SEEK_BUTTON_SIZE,
    height: PLAYER_UI.SEEK_BUTTON_SIZE,
    backgroundColor: PLAYER_COLORS.OVERLAY_BACKGROUND,
    borderRadius: PLAYER_UI.SEEK_BUTTON_SIZE / 2,
    justifyContent: 'center',
    alignItems: 'center',
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
  },
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
  timeText: {
    color: PLAYER_COLORS.TEXT_LIGHT,
    fontSize: 12,
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
});

export default VideoControls; 