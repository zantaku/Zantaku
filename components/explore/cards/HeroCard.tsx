import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, Animated, FlatList } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { FontAwesome5 } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { getRatingColor, formatScore } from '../../../utils/colors';

const { width, height } = Dimensions.get('window');

interface HeroCardProps {
  data: {
    items?: any[];
    title?: string;
    subtitle?: string;
    autoScroll?: boolean;
    showProgress?: boolean;
  } | any[];
  theme: any;
  isDarkMode: boolean;
}

export default function HeroCard({ data, theme, isDarkMode }: HeroCardProps) {
  // Handle both old array format and new object format
  const items = Array.isArray(data) ? data : (data?.items || []);
  const router = useRouter();
  const [activeIndex, setActiveIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const progressAnim = useRef(new Animated.Value(0)).current;

  // Auto-scroll effect
  useEffect(() => {
    const startAnimations = () => {
      progressAnim.setValue(0);
      
      Animated.timing(progressAnim, {
        toValue: 1,
        duration: 60000,
        useNativeDriver: false,
      }).start();
    };

    startAnimations();

    const timer = setInterval(() => {
      if (items.length > 0) {
        const nextIndex = (activeIndex + 1) % Math.min(items.length, 5);
        flatListRef.current?.scrollToIndex({
          index: nextIndex,
          animated: true
        });
        setActiveIndex(nextIndex);
        startAnimations();
      }
    }, 60000);

    return () => clearInterval(timer);
  }, [activeIndex, data]);

  const renderHeroItem = ({ item: anime }: { item: any }) => {
    if (!anime || !anime.id) return null;

    const imageSource = anime.bannerImage || anime.coverImage?.extraLarge || anime.coverImage?.large;
    const title = anime.title?.english || anime.title?.userPreferred || anime.title?.romaji || 'Unknown Title';
    const description = anime.description?.replace(/<[^>]*>/g, '') || '';

    return (
      <TouchableOpacity 
        style={[styles.heroSection, { width }]}
        onPress={() => router.push(`/anime/${anime.id}`)}
        activeOpacity={0.9}
      >
        <ExpoImage
          source={{ uri: imageSource }}
          style={styles.heroImage}
          contentFit="cover"
          transition={1000}
          placeholder="https://via.placeholder.com/400x600/1a1a1a/666666?text=Loading"
        />
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.4)', 'rgba(0,0,0,0.8)', 'rgba(0,0,0,0.95)']}
          locations={[0.2, 0.5, 0.7, 1]}
          style={styles.heroGradient}
        >
          <View style={styles.heroContent}>
            <BlurView intensity={40} tint="dark" style={styles.heroMetaContainer}>
              <View style={styles.heroStats}>
                {anime.averageScore > 0 && (
                  <View style={styles.heroStatItem}>
                    <FontAwesome5 name="star" size={12} color="#FFD700" solid />
                    <Text style={styles.heroStatText}>
                      {anime.averageScore.toFixed(1)}
                    </Text>
                  </View>
                )}
                {anime.trending && (
                  <View style={styles.heroStatItem}>
                    <View style={styles.fireMeterContainer}>
                      {[...Array(5)].map((_, i) => (
                        <FontAwesome5 
                          key={i}
                          name="fire-alt" 
                          size={10} 
                          color={i < (anime.trendingIntensity || 0) ? "#FF6B6B" : "rgba(255, 107, 107, 0.3)"} 
                          solid 
                        />
                      ))}
                    </View>
                    <Text style={styles.heroStatText}>#{anime.trending}</Text>
                  </View>
                )}
                <View style={styles.heroStatItem}>
                  <FontAwesome5 name="tv" size={12} color="#4CAF50" solid />
                  <Text style={styles.heroStatText}>
                    {anime.episodes ? `${anime.episodes} Ep` : 'Ongoing'}
                  </Text>
                </View>
              </View>
            </BlurView>

            <View style={styles.heroTitleContainer}>
              <Text style={styles.heroTitle} numberOfLines={2}>
                {title}
              </Text>
              {description && (
                <Text style={styles.heroDescription} numberOfLines={3}>
                  {description}
                </Text>
              )}
            </View>

            <TouchableOpacity 
              style={styles.watchButton}
              onPress={() => router.push(`/anime/${anime.id}`)}
            >
              <BlurView intensity={60} tint="dark" style={StyleSheet.absoluteFill} />
              <FontAwesome5 name="play" size={14} color="#fff" />
              <Text style={styles.watchButtonText}>Watch Now</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>
        <View style={styles.progressBarContainer}>
          <Animated.View 
            style={[
              styles.progressBar,
              {
                width: progressAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0%', '100%']
                })
              }
            ]} 
          />
        </View>
      </TouchableOpacity>
    );
  };

  const renderPaginationDots = () => (
    <View style={styles.paginationContainer}>
      {items.slice(0, 5).map((_: any, index: number) => (
        <View
          key={index}
          style={[
            styles.paginationDot,
            index === activeIndex && styles.paginationDotActive,
          ]}
        />
      ))}
    </View>
  );

  if (!items || items.length === 0) return null;

  return (
    <View style={styles.heroWrapper}>
      <FlatList
        ref={flatListRef}
        data={items.slice(0, 5)}
        renderItem={renderHeroItem}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(event) => {
          const newIndex = Math.round(
            event.nativeEvent.contentOffset.x / width
          );
          setActiveIndex(newIndex);
        }}
        decelerationRate="fast"
        snapToInterval={width}
        snapToAlignment="start"
      />
      {renderPaginationDots()}
    </View>
  );
}

const styles = StyleSheet.create({
  heroWrapper: {
    height: height * 0.5,
    position: 'relative',
  },
  heroSection: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '70%',
    justifyContent: 'flex-end',
    padding: 16,
    paddingBottom: 40,
  },
  heroContent: {
    width: '100%',
    gap: 16,
  },
  heroMetaContainer: {
    alignSelf: 'flex-start',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 4,
  },
  heroStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  heroStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  heroStatText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '600',
  },
  fireMeterContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  heroTitleContainer: {
    gap: 12,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -0.5,
    lineHeight: 28,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  heroDescription: {
    fontSize: 14,
    color: '#fff',
    opacity: 0.9,
    lineHeight: 20,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  watchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  watchButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  progressBarContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    zIndex: 2,
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#02A9FF',
    opacity: 0.8,
  },
  paginationContainer: {
    position: 'absolute',
    bottom: 30,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    zIndex: 3,
  },
  paginationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
  },
  paginationDotActive: {
    width: 20,
    backgroundColor: '#02A9FF',
  },
}); 