import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Animated,
  TouchableOpacity,
  PanResponder,
  GestureResponderEvent,
  PanResponderGestureState,
} from 'react-native';
import { PLAYER_COLORS } from '../constants';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface CustomSeekBarProps {
  currentTime: number;
  duration: number;
  bufferedTime: number;
  onSeekStart?: () => void;
  onSeekChange?: (time: number) => void;
  onSeekEnd?: (time: number) => void;
  onSeek: (time: number) => void;
  disabled?: boolean;
  style?: any;
}

const CustomSeekBar: React.FC<CustomSeekBarProps> = ({
  currentTime,
  duration,
  bufferedTime,
  onSeekStart,
  onSeekChange,
  onSeekEnd,
  onSeek,
  disabled = false,
  style,
}) => {
  const [isSeeking, setIsSeeking] = useState(false);
  const [seekTime, setSeekTime] = useState(0);
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState(0);
  const [tooltipTime, setTooltipTime] = useState(0);
  
  const seekBarRef = useRef<View>(null);
  const rippleAnim = useRef(new Animated.Value(0)).current;
  const tooltipAnim = useRef(new Animated.Value(0)).current;
  const thumbScaleAnim = useRef(new Animated.Value(1)).current;
  
  const THUMB_SIZE = 16;

  // Format time as mm:ss
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // Calculate progress percentages
  const currentProgress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const bufferProgress = duration > 0 ? (bufferedTime / duration) * 100 : 0;
  const seekProgress = duration > 0 ? (seekTime / duration) * 100 : 0;

  // Convert touch position to time
  const positionToTime = useCallback((x: number, containerWidth: number) => {
    const progress = Math.max(0, Math.min(1, x / containerWidth));
    return progress * duration;
  }, [duration]);

  // Show tooltip with animation
  const showTooltipWithAnimation = useCallback(() => {
    setShowTooltip(true);
    Animated.timing(tooltipAnim, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, []);

  // Hide tooltip with animation
  const hideTooltipWithAnimation = useCallback(() => {
    Animated.timing(tooltipAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      setShowTooltip(false);
    });
  }, []);

  // Scale thumb animation
  const scaleThumb = useCallback((scale: number) => {
    Animated.timing(thumbScaleAnim, {
      toValue: scale,
      duration: 150,
      useNativeDriver: true,
    }).start();
  }, []);

  // Handle tap on seekbar track
  const handleTrackPress = useCallback((event: GestureResponderEvent) => {
    if (disabled || duration === 0 || isSeeking) return;

    const { locationX } = event.nativeEvent;
    
    seekBarRef.current?.measure((fx, fy, width, height, px, py) => {
      const adjustedX = Math.max(8, Math.min(width - 8, locationX)); // Account for padding
      const relativeX = adjustedX - 8;
      const availableWidth = width - 16; // Account for padding on both sides
      const time = positionToTime(relativeX, availableWidth);
      
      // Create ripple effect
      setTooltipPosition(adjustedX);
      setTooltipTime(time);
      
      // Animate ripple
      rippleAnim.setValue(0);
      Animated.sequence([
        Animated.timing(rippleAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(rippleAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
      
      // Seek to tapped position
      console.log(`🎯 Tap-to-seek: ${time.toFixed(1)}s at position ${adjustedX}px`);
      onSeek(time);
    });
  }, [disabled, duration, isSeeking, onSeek, positionToTime]);

  // Pan responder for dragging the thumb
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !disabled && duration > 0,
      onMoveShouldSetPanResponder: () => !disabled && duration > 0,
      
      onPanResponderGrant: (event: GestureResponderEvent) => {
        setIsSeeking(true);
        scaleThumb(1.3);
        showTooltipWithAnimation();
        onSeekStart?.();
        console.log('🎯 Started seeking (drag)');
      },
      
      onPanResponderMove: (event: GestureResponderEvent, gestureState: PanResponderGestureState) => {
        seekBarRef.current?.measure((fx, fy, width, height, px, py) => {
          const { moveX } = gestureState;
          const relativeX = moveX - px;
          const adjustedX = Math.max(8, Math.min(width - 8, relativeX));
          const seekableX = adjustedX - 8;
          const availableWidth = width - 16;
          const time = positionToTime(seekableX, availableWidth);
          
          setSeekTime(time);
          setTooltipTime(time);
          setTooltipPosition(adjustedX);
          onSeekChange?.(time);
        });
      },
      
      onPanResponderRelease: () => {
        setIsSeeking(false);
        scaleThumb(1);
        hideTooltipWithAnimation();
        
        console.log(`🎯 Completed seeking (drag) to ${seekTime.toFixed(1)}s`);
        onSeek(seekTime);
        onSeekEnd?.(seekTime);
      },
      
      onPanResponderTerminate: () => {
        setIsSeeking(false);
        scaleThumb(1);
        hideTooltipWithAnimation();
      },
    })
  ).current;

  const rippleScale = rippleAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 2],
  });

  const rippleOpacity = rippleAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, 0.8, 0],
  });

  return (
    <View style={[styles.container, style]}>
      <View style={styles.seekBarContainer}>
        {/* Tooltip */}
        {showTooltip && (
          <Animated.View
            style={[
              styles.tooltip,
              {
                left: Math.max(25, Math.min(SCREEN_WIDTH - 75, tooltipPosition - 25)),
                opacity: tooltipAnim,
                transform: [
                  {
                    translateY: tooltipAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [10, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <Text style={styles.tooltipText}>{formatTime(tooltipTime)}</Text>
          </Animated.View>
        )}

        {/* Ripple effect for tap-to-seek */}
        <Animated.View
          style={[
            styles.ripple,
            {
              left: tooltipPosition - 15,
              opacity: rippleOpacity,
              transform: [{ scale: rippleScale }],
            },
          ]}
        />

        {/* Seekbar track - touchable area */}
        <TouchableOpacity
          ref={seekBarRef}
          style={styles.seekBarTrack}
          onPress={handleTrackPress}
          activeOpacity={1}
          disabled={disabled}
        >
          {/* Background track */}
          <View style={styles.backgroundTrack} />
          
          {/* Buffer progress */}
          <View
            style={[
              styles.bufferTrack,
              { width: `${Math.min(100, bufferProgress)}%` },
            ]}
          />
          
          {/* Current progress */}
          <View
            style={[
              styles.progressTrack,
              { 
                width: `${Math.min(100, isSeeking ? seekProgress : currentProgress)}%` 
              },
            ]}
          />
          
          {/* Thumb - draggable */}
          <Animated.View
            style={[
              styles.thumb,
              {
                left: `${Math.min(100, isSeeking ? seekProgress : currentProgress)}%`,
                transform: [
                  { translateY: -8 },
                  { translateX: -8 },
                  { scale: thumbScaleAnim }
                ],
              },
            ]}
            {...panResponder.panHandlers}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: 40,
    justifyContent: 'center',
  },
  seekBarContainer: {
    position: 'relative',
    height: 40,
    justifyContent: 'center',
  },
  seekBarTrack: {
    height: 40,
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  backgroundTrack: {
    height: 4,
    backgroundColor: PLAYER_COLORS.SLIDER_TRACK,
    borderRadius: 2,
  },
  bufferTrack: {
    position: 'absolute',
    left: 8,
    height: 4,
    backgroundColor: 'rgba(173, 216, 230, 0.5)',
    borderRadius: 2,
  },
  progressTrack: {
    position: 'absolute',
    left: 8,
    height: 4,
    backgroundColor: PLAYER_COLORS.PRIMARY,
    borderRadius: 2,
  },
  thumb: {
    position: 'absolute',
    top: '50%',
    width: 16,
    height: 16,
    backgroundColor: PLAYER_COLORS.PRIMARY,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    transform: [{ translateY: -8 }, { translateX: -8 }],
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  tooltip: {
    position: 'absolute',
    top: -35,
    width: 50,
    height: 25,
    backgroundColor: 'rgba(13, 27, 42, 0.9)',
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: PLAYER_COLORS.PRIMARY,
  },
  tooltipText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '500',
  },
  ripple: {
    position: 'absolute',
    top: '50%',
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: PLAYER_COLORS.PRIMARY,
    transform: [{ translateY: -15 }],
    pointerEvents: 'none',
  },
});

export default CustomSeekBar; 