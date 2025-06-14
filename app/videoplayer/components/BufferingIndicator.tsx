import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Text } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { PLAYER_COLORS } from '../constants';

interface BufferingIndicatorProps {
  isVisible: boolean;
  bufferProgress?: number;
  isSeeking?: boolean;
  seekingPosition?: number;
  currentTime?: number;
  duration?: number;
}

const BufferingIndicator: React.FC<BufferingIndicatorProps> = ({
  isVisible,
  bufferProgress = 0,
  isSeeking = false,
  seekingPosition = 0,
  currentTime = 0,
  duration = 0,
}) => {
  const spinValue = useRef(new Animated.Value(0)).current;
  const fadeValue = useRef(new Animated.Value(0)).current;

  // Spinning animation
  useEffect(() => {
    if (isVisible) {
      // Start spinning animation
      const spinAnimation = Animated.loop(
        Animated.timing(spinValue, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        })
      );
      
      // Fade in
      Animated.timing(fadeValue, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
      
      spinAnimation.start();
      
      return () => {
        spinAnimation.stop();
      };
    } else {
      // Fade out
      Animated.timing(fadeValue, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [isVisible, spinValue, fadeValue]);

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  if (!isVisible) return null;

  return (
    <Animated.View 
      style={[
        styles.container,
        { opacity: fadeValue }
      ]}
    >
      <View style={styles.indicatorContainer}>
        {/* Main buffering spinner */}
        <Animated.View style={[styles.spinner, { transform: [{ rotate: spin }] }]}>
          <MaterialIcons 
            name="refresh" 
            size={48} 
            color={PLAYER_COLORS.PRIMARY} 
          />
        </Animated.View>
        
        {/* Buffer progress text */}
        {bufferProgress > 0 && !isSeeking && (
          <Text style={styles.bufferText}>
            Buffering... {Math.round(bufferProgress)}%
          </Text>
        )}
        
        {/* Seeking indicator */}
        {isSeeking && (
          <View style={styles.seekingContainer}>
            <Text style={styles.seekingText}>
              Seeking to {formatTime(seekingPosition)}
            </Text>
            <Text style={styles.seekingSubtext}>
              HLS will buffer from this position
            </Text>
            <View style={styles.seekingBar}>
              <View 
                style={[
                  styles.seekingProgress, 
                  { 
                    width: duration > 0 ? `${(seekingPosition / duration) * 100}%` : '0%' 
                  }
                ]} 
              />
            </View>
          </View>
        )}
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    zIndex: 1000,
  },
  indicatorContainer: {
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 12,
    padding: 20,
    minWidth: 120,
  },
  spinner: {
    marginBottom: 12,
  },
  bufferText: {
    color: PLAYER_COLORS.TEXT_LIGHT,
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  seekingContainer: {
    alignItems: 'center',
    minWidth: 200,
  },
  seekingText: {
    color: PLAYER_COLORS.TEXT_LIGHT,
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
    textAlign: 'center',
  },
  seekingSubtext: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
    fontWeight: '400',
    marginBottom: 8,
    textAlign: 'center',
  },
  seekingBar: {
    width: '100%',
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  seekingProgress: {
    height: '100%',
    backgroundColor: PLAYER_COLORS.PRIMARY,
    borderRadius: 2,
  },
});

export default BufferingIndicator; 