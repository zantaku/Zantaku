import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, Animated } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { FontAwesome5 } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../hooks/useTheme';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';

interface TrendingAnime {
  id: number;
  title: {
    userPreferred: string;
    english: string;
    romaji: string;
  };
  coverImage: {
    large: string;
    extraLarge: string;
  };
  trending: number;
  popularity: number;
  averageScore: number;
  trendingIntensity: number;
  status: string;
  format: string;
}

interface TrendingFOMOProps {
  anime: TrendingAnime;
  trendingChange?: number; // Percentage change from last week
  popularityRank?: number;
  viewerCount?: number;
}

export const TrendingFOMOCard: React.FC<TrendingFOMOProps> = ({ 
  anime, 
  trendingChange = 0, 
  popularityRank = 1,
  viewerCount = 0 
}) => {
  const router = useRouter();
  const { isDarkMode, currentTheme } = useTheme();

  const getTrendingBadgeColor = () => {
    if (trendingChange > 50) return '#FF6B6B'; // High growth - red
    if (trendingChange > 25) return '#FF9800'; // Medium growth - orange  
    if (trendingChange > 10) return '#4CAF50'; // Some growth - green
    return currentTheme.colors.primary; // Default - blue
  };

  const getTrendingText = () => {
    if (trendingChange > 50) return '🔥 EXPLODING';
    if (trendingChange > 25) return '📈 SURGING';
    if (trendingChange > 10) return '⬆️ RISING FAST';
    return '🌟 TRENDING';
  };

  const getUrgencyText = () => {
    if (trendingChange > 50) return 'Everyone\'s talking about this!';
    if (trendingChange > 25) return 'Don\'t miss the hype!';
    if (trendingChange > 10) return 'Join the conversation';
    return 'Currently trending';
  };

  return (
    <TouchableOpacity
      style={[
        styles.card,
        {
          backgroundColor: currentTheme.colors.surface,
          shadowColor: isDarkMode ? '#000' : '#666',
        }
      ]}
      onPress={() => router.push(`/anime/${anime.id}`)}
      activeOpacity={0.9}
    >
      {/* Background Image with Overlay */}
      <ExpoImage
        source={{ uri: anime.coverImage.extraLarge || anime.coverImage.large }}
        style={styles.backgroundImage}
        contentFit="cover"
      />
      
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.3)', 'rgba(0,0,0,0.8)']}
        locations={[0.3, 0.6, 1]}
        style={styles.gradient}
      >
        {/* Trending Badge */}
        <View style={styles.topSection}>
          <BlurView intensity={60} tint="dark" style={styles.trendingBadge}>
            <View style={[styles.trendingIndicator, { backgroundColor: getTrendingBadgeColor() }]} />
            <Text style={styles.trendingText}>{getTrendingText()}</Text>
          </BlurView>

          <View style={styles.statsContainer}>
            <BlurView intensity={60} tint="dark" style={styles.statBadge}>
              <FontAwesome5 name="fire-alt" size={10} color="#FF6B6B" />
              <Text style={styles.statText}>#{popularityRank}</Text>
            </BlurView>

            {trendingChange > 0 && (
              <BlurView intensity={60} tint="dark" style={styles.statBadge}>
                <FontAwesome5 name="arrow-up" size={8} color="#4CAF50" />
                <Text style={styles.statText}>+{trendingChange.toFixed(0)}%</Text>
              </BlurView>
            )}
          </View>
        </View>

        {/* Content Section */}
        <View style={styles.contentSection}>
          <Text style={styles.title} numberOfLines={2}>
            {anime.title.english || anime.title.userPreferred}
          </Text>
          
          <Text style={styles.urgencyText}>
            {getUrgencyText()}
          </Text>

          {/* Stats Row */}
          <View style={styles.statsRow}>
            {anime.averageScore > 0 && (
              <View style={styles.statItem}>
                <FontAwesome5 name="star" size={10} color="#FFD700" solid />
                <Text style={styles.statValue}>{(anime.averageScore / 10).toFixed(1)}</Text>
              </View>
            )}

            <View style={styles.statItem}>
              <FontAwesome5 name="tv" size={10} color="#4CAF50" />
              <Text style={styles.statValue}>{anime.format}</Text>
            </View>

            <View style={styles.statItem}>
              <FontAwesome5 name="users" size={10} color={currentTheme.colors.primary} />
              <Text style={styles.statValue}>
                {viewerCount > 1000 ? `${(viewerCount / 1000).toFixed(1)}K` : viewerCount} watching
              </Text>
            </View>
          </View>

          {/* Fire Meter */}
          <View style={styles.fireMeter}>
            <Text style={styles.fireMeterLabel}>Hype Level:</Text>
            <View style={styles.fireContainer}>
              {[...Array(5)].map((_, i) => (
                <FontAwesome5
                  key={i}
                  name="fire-alt"
                  size={12}
                  color={i < anime.trendingIntensity ? "#FF6B6B" : "rgba(255, 107, 107, 0.3)"}
                  solid
                />
              ))}
            </View>
          </View>

          {/* Call to Action */}
          <TouchableOpacity
            style={[styles.ctaButton, { backgroundColor: getTrendingBadgeColor() }]}
            onPress={() => router.push(`/anime/${anime.id}`)}
          >
            <FontAwesome5 name="play" size={12} color="#fff" />
            <Text style={styles.ctaText}>Watch Now</Text>
            <FontAwesome5 name="chevron-right" size={10} color="#fff" />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* Pulsing Animation for High Trending */}
      {trendingChange > 50 && (
        <View style={[styles.pulseRing, { borderColor: getTrendingBadgeColor() }]} />
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    height: 320,
    borderRadius: 20,
    overflow: 'hidden',
    marginHorizontal: 20,
    marginVertical: 8,
    ...Platform.select({
      ios: {
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.15,
        shadowRadius: 16,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  backgroundImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  gradient: {
    ...StyleSheet.absoluteFillObject,
    padding: 20,
    justifyContent: 'space-between',
  },
  topSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  trendingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  trendingIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  trendingText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  statsContainer: {
    gap: 6,
  },
  statBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  statText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  contentSection: {
    gap: 8,
  },
  title: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '800',
    lineHeight: 26,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  urgencyText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    opacity: 0.9,
    fontStyle: 'italic',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  fireMeter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  fireMeterLabel: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
    opacity: 0.8,
  },
  fireContainer: {
    flexDirection: 'row',
    gap: 3,
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 16,
    gap: 8,
    marginTop: 8,
  },
  ctaText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  pulseRing: {
    position: 'absolute',
    top: -2,
    left: -2,
    right: -2,
    bottom: -2,
    borderWidth: 3,
    borderRadius: 22,
    opacity: 0.6,
  },
}); 