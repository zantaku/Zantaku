import React, { useEffect } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withRepeat, 
  withTiming,
  withSequence,
  Easing
} from 'react-native-reanimated';

const { width } = Dimensions.get('window');

interface SkeletonCardProps {
  theme: any;
  isDarkMode: boolean;
  type?: 'hero' | 'anime' | 'schedule' | 'birthday' | 'top100';
  height?: number;
}

export default function SkeletonCard({ theme, isDarkMode, type = 'anime', height }: SkeletonCardProps) {
  const shimmerValue = useSharedValue(0);
  const pulseValue = useSharedValue(1);

  useEffect(() => {
    // Shimmer animation
    shimmerValue.value = withRepeat(
      withTiming(1, { duration: 1500, easing: Easing.linear }),
      -1,
      false
    );

    // Subtle pulse animation
    pulseValue.value = withRepeat(
      withSequence(
        withTiming(1.02, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.98, { duration: 2000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
  }, []);

  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shimmerValue.value * width }],
  }));

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: 0.7 + (pulseValue.value * 0.3),
  }));

  const renderHeroSkeleton = () => (
    <View style={[styles.heroContainer, { height: height || 300 }]}>
      <Animated.View style={[styles.heroImage, pulseStyle]}>
        <LinearGradient
          colors={isDarkMode 
            ? ['rgba(255, 255, 255, 0.1)', 'rgba(255, 255, 255, 0.05)'] 
            : ['rgba(0, 0, 0, 0.1)', 'rgba(0, 0, 0, 0.05)']
          }
          style={StyleSheet.absoluteFill}
        />
        <Animated.View style={[styles.shimmer, shimmerStyle]}>
          <LinearGradient
            colors={['transparent', 'rgba(255, 255, 255, 0.3)', 'transparent']}
            style={StyleSheet.absoluteFill}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          />
        </Animated.View>
      </Animated.View>
      
      <View style={styles.heroContent}>
        <View style={styles.heroMeta}>
          <View style={[styles.heroStat, { width: 60 }]} />
          <View style={[styles.heroStat, { width: 40 }]} />
          <View style={[styles.heroStat, { width: 80 }]} />
        </View>
        
        <View style={styles.heroTitle}>
          <View style={[styles.titleLine, { width: '80%' }]} />
          <View style={[styles.titleLine, { width: '60%' }]} />
        </View>
        
        <View style={styles.heroDescription}>
          <View style={[styles.descLine, { width: '100%' }]} />
          <View style={[styles.descLine, { width: '90%' }]} />
          <View style={[styles.descLine, { width: '70%' }]} />
        </View>
        
        <View style={styles.watchButton} />
      </View>
    </View>
  );

  const renderAnimeSkeleton = () => (
    <View style={[styles.animeContainer, { height: height || 280 }]}>
      <Animated.View style={[styles.animeImage, pulseStyle]}>
        <LinearGradient
          colors={isDarkMode 
            ? ['rgba(255, 255, 255, 0.1)', 'rgba(255, 255, 255, 0.05)'] 
            : ['rgba(0, 0, 0, 0.1)', 'rgba(0, 0, 0, 0.05)']
          }
          style={StyleSheet.absoluteFill}
        />
        <Animated.View style={[styles.shimmer, shimmerStyle]}>
          <LinearGradient
            colors={['transparent', 'rgba(255, 255, 255, 0.3)', 'transparent']}
            style={StyleSheet.absoluteFill}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          />
        </Animated.View>
      </Animated.View>
      
      <View style={styles.animeInfo}>
        <View style={[styles.titleLine, { width: '90%' }]} />
        <View style={[styles.titleLine, { width: '70%' }]} />
        <View style={styles.scoreContainer}>
          <View style={[styles.scoreDot, { width: 12, height: 12 }]} />
          <View style={[styles.scoreLine, { width: 30 }]} />
        </View>
      </View>
    </View>
  );

  const renderScheduleSkeleton = () => (
    <View style={[styles.scheduleContainer, { height: height || 280 }]}>
      <Animated.View style={[styles.scheduleImage, pulseStyle]}>
        <LinearGradient
          colors={isDarkMode 
            ? ['rgba(255, 255, 255, 0.1)', 'rgba(255, 255, 255, 0.05)'] 
            : ['rgba(0, 0, 0, 0.1)', 'rgba(0, 0, 0, 0.05)']
          }
          style={StyleSheet.absoluteFill}
        />
        <Animated.View style={[styles.shimmer, shimmerStyle]}>
          <LinearGradient
            colors={['transparent', 'rgba(255, 255, 255, 0.3)', 'transparent']}
            style={StyleSheet.absoluteFill}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          />
        </Animated.View>
      </Animated.View>
      
      <View style={styles.scheduleInfo}>
        <View style={[styles.timeLine, { width: 60 }]} />
        <View style={[styles.titleLine, { width: '85%' }]} />
        <View style={[styles.titleLine, { width: '60%' }]} />
        <View style={styles.scheduleMeta}>
          <View style={[styles.metaItem, { width: 40 }]} />
          <View style={[styles.metaItem, { width: 50 }]} />
        </View>
      </View>
    </View>
  );

  const renderBirthdaySkeleton = () => (
    <View style={[styles.birthdayContainer, { height: height || 120 }]}>
      <Animated.View style={[styles.birthdayImage, pulseStyle]}>
        <LinearGradient
          colors={isDarkMode 
            ? ['rgba(255, 255, 255, 0.1)', 'rgba(255, 255, 255, 0.05)'] 
            : ['rgba(0, 0, 0, 0.1)', 'rgba(0, 0, 0, 0.05)']
          }
          style={StyleSheet.absoluteFill}
        />
        <Animated.View style={[styles.shimmer, shimmerStyle]}>
          <LinearGradient
            colors={['transparent', 'rgba(255, 255, 255, 0.3)', 'transparent']}
            style={StyleSheet.absoluteFill}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          />
        </Animated.View>
      </Animated.View>
      
      <View style={styles.birthdayName}>
        <View style={[styles.nameLine, { width: '80%' }]} />
        <View style={[styles.nameLine, { width: '60%' }]} />
      </View>
    </View>
  );

  const renderTop100Skeleton = () => (
    <View style={[styles.top100Container, { height: height || 120 }]}>
      <View style={styles.rankContainer}>
        <View style={[styles.rankNumber, { width: 40, height: 24 }]} />
      </View>
      
      <Animated.View style={[styles.top100Image, pulseStyle]}>
        <LinearGradient
          colors={isDarkMode 
            ? ['rgba(255, 255, 255, 0.1)', 'rgba(255, 255, 255, 0.05)'] 
            : ['rgba(0, 0, 0, 0.1)', 'rgba(0, 0, 0, 0.05)']
          }
          style={StyleSheet.absoluteFill}
        />
        <Animated.View style={[styles.shimmer, shimmerStyle]}>
          <LinearGradient
            colors={['transparent', 'rgba(255, 255, 255, 0.3)', 'transparent']}
            style={StyleSheet.absoluteFill}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          />
        </Animated.View>
      </Animated.View>
      
      <View style={styles.top100Info}>
        <View style={[styles.titleLine, { width: '90%' }]} />
        <View style={[styles.titleLine, { width: '70%' }]} />
        <View style={styles.top100Meta}>
          <View style={[styles.metaItem, { width: 50 }]} />
          <View style={[styles.metaItem, { width: 40 }]} />
          <View style={[styles.metaItem, { width: 60 }]} />
        </View>
      </View>
    </View>
  );

  switch (type) {
    case 'hero':
      return renderHeroSkeleton();
    case 'schedule':
      return renderScheduleSkeleton();
    case 'birthday':
      return renderBirthdaySkeleton();
    case 'top100':
      return renderTop100Skeleton();
    default:
      return renderAnimeSkeleton();
  }
}

const styles = StyleSheet.create({
  // Hero skeleton styles
  heroContainer: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
  },
  heroImage: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  heroContent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    gap: 12,
  },
  heroMeta: {
    flexDirection: 'row',
    gap: 12,
    alignSelf: 'flex-start',
  },
  heroStat: {
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  heroTitle: {
    gap: 8,
  },
  heroDescription: {
    gap: 6,
  },
  watchButton: {
    width: 120,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignSelf: 'flex-start',
  },

  // Anime skeleton styles
  animeContainer: {
    width: 160,
    borderRadius: 16,
    overflow: 'hidden',
  },
  animeImage: {
    width: '100%',
    height: 220,
    position: 'relative',
  },
  animeInfo: {
    padding: 12,
    gap: 8,
  },
  scoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  scoreDot: {
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  scoreLine: {
    height: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },

  // Schedule skeleton styles
  scheduleContainer: {
    width: 160,
    borderRadius: 16,
    overflow: 'hidden',
  },
  scheduleImage: {
    width: '100%',
    height: 220,
    position: 'relative',
  },
  scheduleInfo: {
    padding: 12,
    gap: 6,
  },
  timeLine: {
    height: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignSelf: 'center',
  },
  scheduleMeta: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 4,
  },
  metaItem: {
    height: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },

  // Birthday skeleton styles
  birthdayContainer: {
    width: 100,
    alignItems: 'center',
  },
  birthdayImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginBottom: 8,
    position: 'relative',
  },
  birthdayName: {
    alignItems: 'center',
    gap: 4,
  },
  nameLine: {
    height: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },

  // Top 100 skeleton styles
  top100Container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    padding: 12,
    gap: 16,
  },
  rankContainer: {
    width: 48,
    alignItems: 'center',
  },
  rankNumber: {
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  top100Image: {
    width: 70,
    height: 100,
    borderRadius: 12,
    position: 'relative',
  },
  top100Info: {
    flex: 1,
    gap: 8,
  },
  top100Meta: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },

  // Common skeleton elements
  titleLine: {
    height: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  descLine: {
    height: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  shimmer: {
    position: 'absolute',
    top: 0,
    left: -width,
    right: -width,
    bottom: 0,
  },
}); 