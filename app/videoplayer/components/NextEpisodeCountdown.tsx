import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
  Platform,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { PLAYER_COLORS } from '../constants';

interface NextEpisodeCountdownProps {
  isVisible: boolean;
  nextEpisodeTitle: string;
  nextEpisodeNumber: number;
  remainingSeconds: number;
  onSkipToNext: () => void;
  onDismiss: () => void;
  canAutoPlay: boolean; // Based on settings
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const NextEpisodeCountdown: React.FC<NextEpisodeCountdownProps> = ({
  isVisible,
  nextEpisodeTitle,
  nextEpisodeNumber,
  remainingSeconds,
  onSkipToNext,
  onDismiss,
  canAutoPlay,
}) => {
  const [countdown, setCountdown] = useState(10); // Countdown starts at 10 seconds
  const [isCountingDown, setIsCountingDown] = useState(false);
  
  // Animation values
  const slideAnim = useRef(new Animated.Value(SCREEN_WIDTH)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  
  // Countdown timer ref
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Show animation when visible
  useEffect(() => {
    if (isVisible) {
      // Reset animations
      slideAnim.setValue(SCREEN_WIDTH);
      scaleAnim.setValue(0.8);
      opacityAnim.setValue(0);
      progressAnim.setValue(0);
      
      // Start entrance animation
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 20,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
      ]).start();

      // Start pulse animation for urgency
      const pulseAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.05,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      );
      pulseAnimation.start();

      return () => {
        pulseAnimation.stop();
      };
    } else {
      // Hide animation
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: SCREEN_WIDTH,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [isVisible]);

  // Handle countdown logic when we're in the final 10 seconds
  useEffect(() => {
    if (isVisible && remainingSeconds <= 10 && remainingSeconds > 0 && canAutoPlay) {
      setIsCountingDown(true);
      setCountdown(Math.ceil(remainingSeconds));

      // Start progress bar animation
      Animated.timing(progressAnim, {
        toValue: 1,
        duration: remainingSeconds * 1000,
        useNativeDriver: false,
      }).start();

      // Start countdown interval
      countdownIntervalRef.current = setInterval(() => {
        setCountdown(prev => {
          const newCount = prev - 1;
          if (newCount <= 0) {
            // Auto-play next episode when countdown reaches 0
            onSkipToNext();
            return 0;
          }
          return newCount;
        });
      }, 1000);

      return () => {
        if (countdownIntervalRef.current) {
          clearInterval(countdownIntervalRef.current);
          countdownIntervalRef.current = null;
        }
      };
    } else {
      setIsCountingDown(false);
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
    }
  }, [isVisible, remainingSeconds, canAutoPlay, onSkipToNext]);

  // Don't render if not visible
  if (!isVisible) {
    return null;
  }

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: opacityAnim,
          transform: [
            { translateX: slideAnim },
            { scale: scaleAnim },
          ],
        },
      ]}
    >
      <BlurView intensity={95} tint="dark" style={styles.blurContainer}>
        <Animated.View
          style={[
            styles.content,
            {
              transform: [{ scale: pulseAnim }],
            },
          ]}
        >
          {/* Close button */}
          <TouchableOpacity style={styles.closeButton} onPress={onDismiss}>
            <Ionicons name="close" size={20} color={PLAYER_COLORS.TEXT_LIGHT} />
          </TouchableOpacity>

          {/* Main content */}
          <View style={styles.mainContent}>
            {/* Next episode icon */}
            <View style={styles.iconContainer}>
              <Ionicons name="play-forward" size={24} color={PLAYER_COLORS.PRIMARY} />
            </View>

            {/* Text content */}
            <View style={styles.textContainer}>
              <Text style={styles.upNextLabel}>Up Next</Text>
              <Text style={styles.episodeTitle} numberOfLines={2}>
                Episode {nextEpisodeNumber}: {nextEpisodeTitle}
              </Text>
              
              {isCountingDown && canAutoPlay ? (
                <Text style={styles.countdownText}>
                  Auto-play in {countdown}s
                </Text>
              ) : (
                <Text style={styles.timeRemainingText}>
                  Episode ends in {formatTime(remainingSeconds)}
                </Text>
              )}
            </View>

            {/* Action button */}
            <TouchableOpacity style={styles.playButton} onPress={onSkipToNext}>
              <Ionicons name="play" size={18} color="#FFFFFF" />
              <Text style={styles.playButtonText}>
                {isCountingDown ? 'Play Now' : 'Skip to Next'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Progress bar for countdown */}
          {isCountingDown && canAutoPlay && (
            <View style={styles.progressBarContainer}>
              <Animated.View
                style={[
                  styles.progressBar,
                  {
                    width: progressAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0%', '100%'],
                    }),
                  },
                ]}
              />
            </View>
          )}

          {/* Settings hint */}
          {!canAutoPlay && (
            <Text style={styles.settingsHint}>
              Auto-play disabled in settings
            </Text>
          )}
        </Animated.View>
      </BlurView>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: '50%',
    right: 0,
    width: SCREEN_WIDTH * 0.85,
    maxWidth: 400,
    marginTop: -80, // Center vertically
    zIndex: 1000,
  },
  blurContainer: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  content: {
    padding: 16,
    position: 'relative',
  },
  closeButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1001,
  },
  mainContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 40, // Space for close button
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(2, 169, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
    marginRight: 12,
  },
  upNextLabel: {
    fontSize: 12,
    color: PLAYER_COLORS.TEXT_LIGHT,
    opacity: 0.8,
    textTransform: 'uppercase',
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  episodeTitle: {
    fontSize: 14,
    color: PLAYER_COLORS.TEXT_LIGHT,
    fontWeight: '600',
    marginTop: 2,
    lineHeight: 18,
  },
  countdownText: {
    fontSize: 12,
    color: PLAYER_COLORS.PRIMARY,
    fontWeight: '600',
    marginTop: 4,
  },
  timeRemainingText: {
    fontSize: 12,
    color: PLAYER_COLORS.TEXT_LIGHT,
    opacity: 0.7,
    marginTop: 4,
  },
  playButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: PLAYER_COLORS.PRIMARY,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    minWidth: 80,
  },
  playButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  progressBarContainer: {
    height: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    marginTop: 12,
    borderRadius: 1.5,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: PLAYER_COLORS.PRIMARY,
    borderRadius: 1.5,
  },
  settingsHint: {
    fontSize: 11,
    color: PLAYER_COLORS.TEXT_LIGHT,
    opacity: 0.6,
    textAlign: 'center',
    marginTop: 8,
    fontStyle: 'italic',
  },
});

export default NextEpisodeCountdown; 