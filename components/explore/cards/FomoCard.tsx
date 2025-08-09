import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform, Animated } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { FontAwesome5 } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';

interface FomoCardProps {
  data: {
    items?: any[];
    title?: string;
    subtitle?: string;
    showLiveCount?: boolean;
    showTrendingBadge?: boolean;
    showUrgencyTimer?: boolean;
    showSocialProof?: boolean;
  } | any[];
  theme: any;
  isDarkMode: boolean;
}

export default function FomoCard({ data, theme, isDarkMode }: FomoCardProps) {
  const router = useRouter();
  
  // Handle both old array format and new object format
  const items = Array.isArray(data) ? data : (data?.items || []);
  const title = Array.isArray(data) ? 'Trending Now' : (data?.title || 'Trending Now');
  const subtitle = Array.isArray(data) ? 'Everyone is watching these' : (data?.subtitle || 'Everyone is watching these');
  const showLiveCount = Array.isArray(data) ? true : (data?.showLiveCount ?? true);
  const showTrendingBadge = Array.isArray(data) ? true : (data?.showTrendingBadge ?? true);
  const showUrgencyTimer = Array.isArray(data) ? false : (data?.showUrgencyTimer ?? false);
  const showSocialProof = Array.isArray(data) ? true : (data?.showSocialProof ?? true);

  const [liveCounts, setLiveCounts] = useState<{ [key: number]: number }>({});
  const [urgencyTimers, setUrgencyTimers] = useState<{ [key: number]: number }>({});

  useEffect(() => {
    // Simulate live viewer counts
    const generateLiveCounts = () => {
      const counts: { [key: number]: number } = {};
      items.forEach((anime: any) => {
        counts[anime.id] = Math.floor(Math.random() * 5000) + 1000;
      });
      setLiveCounts(counts);
    };

    // Simulate urgency timers (time until next episode)
    const generateUrgencyTimers = () => {
      const timers: { [key: number]: number } = {};
      items.forEach((anime: any) => {
        // Random time between 1-24 hours
        timers[anime.id] = Math.floor(Math.random() * 23) + 1;
      });
      setUrgencyTimers(timers);
    };

    generateLiveCounts();
    if (showUrgencyTimer) {
      generateUrgencyTimers();
    }

    // Update live counts every 30 seconds
    const interval = setInterval(() => {
      generateLiveCounts();
    }, 30000);

    return () => clearInterval(interval);
  }, [items, showUrgencyTimer]);

  const getTrendingBadge = (anime: any) => {
    const trending = anime.trending || Math.floor(Math.random() * 50) + 1;
    if (trending <= 5) return { text: '🔥 HOT', color: '#FF4444' };
    if (trending <= 15) return { text: '⚡ TRENDING', color: '#FF9800' };
    if (trending <= 30) return { text: '📈 RISING', color: '#4CAF50' };
    return { text: '⭐ POPULAR', color: '#02A9FF' };
  };

  const getSocialProof = (anime: any) => {
    const proofs = [
      { type: 'watching', count: Math.floor(Math.random() * 50000) + 10000, text: 'people watching' },
      { type: 'completed', count: Math.floor(Math.random() * 100000) + 50000, text: 'people completed' },
      { type: 'planning', count: Math.floor(Math.random() * 20000) + 5000, text: 'people planning' },
      { type: 'favorites', count: Math.floor(Math.random() * 30000) + 10000, text: 'people favorited' }
    ];
    
    return proofs[Math.floor(Math.random() * proofs.length)];
  };

  const formatLiveCount = (count: number) => {
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
    return count.toString();
  };

  const formatUrgencyTimer = (hours: number) => {
    if (hours < 1) return 'Less than 1 hour';
    if (hours === 1) return '1 hour left';
    return `${hours} hours left`;
  };

  const getUrgencyColor = (hours: number) => {
    if (hours <= 2) return '#FF4444'; // Red for very urgent
    if (hours <= 6) return '#FF9800'; // Orange for urgent
    return '#4CAF50'; // Green for not urgent
  };

  if (!items || items.length === 0) return null;

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={styles.headerLeft}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>{title}</Text>
          <Text style={[styles.sectionSubtitle, { color: theme.colors.textSecondary }]}>
            {subtitle}
          </Text>
        </View>
        {showLiveCount && (
          <View style={[styles.liveIndicator, { backgroundColor: '#FF4444' }]}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>LIVE</Text>
          </View>
        )}
      </View>
      
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {items.map((anime: any) => {
          const trendingBadge = getTrendingBadge(anime);
          const socialProof = getSocialProof(anime);
          const liveCount = liveCounts[anime.id] || 0;
          const urgencyTimer = urgencyTimers[anime.id] || 0;
          const urgencyColor = getUrgencyColor(urgencyTimer);
          
          return (
            <TouchableOpacity 
              key={anime.id}
              style={[
                styles.animeCard,
                { 
                  backgroundColor: theme.colors.surface,
                  shadowColor: isDarkMode ? '#000' : '#666'
                }
              ]}
              onPress={() => router.push(`/anime/${anime.id}`)}
              activeOpacity={0.7}
            >
              {/* Trending Badge */}
              {showTrendingBadge && (
                <View style={[styles.trendingBadge, { backgroundColor: trendingBadge.color }]}>
                  <Text style={styles.trendingBadgeText}>{trendingBadge.text}</Text>
                </View>
              )}

              {/* Live Count Badge */}
              {showLiveCount && (
                <View style={[styles.liveCountBadge, { backgroundColor: 'rgba(255, 68, 68, 0.9)' }]}>
                  <FontAwesome5 name="eye" size={10} color="#fff" />
                  <Text style={styles.liveCountText}>{formatLiveCount(liveCount)}</Text>
                </View>
              )}

              {/* Urgency Timer */}
              {showUrgencyTimer && urgencyTimer > 0 && (
                <View style={[styles.urgencyBadge, { backgroundColor: urgencyColor + '90' }]}>
                  <FontAwesome5 name="clock" size={10} color="#fff" />
                  <Text style={styles.urgencyText}>{formatUrgencyTimer(urgencyTimer)}</Text>
                </View>
              )}

              <ExpoImage
                source={{ uri: anime.coverImage.large }}
                style={styles.animeImage}
                contentFit="cover"
                transition={500}
              />
              
              <View style={styles.animeInfo}>
                <Text style={[styles.animeTitle, { color: theme.colors.text }]} numberOfLines={2}>
                  {anime.title.english || anime.title.userPreferred}
                </Text>
                
                <View style={styles.animeMeta}>
                  {anime.averageScore > 0 && (
                    <View style={styles.scoreContainer}>
                      <FontAwesome5 name="star" size={10} color="#FFD700" solid />
                      <Text style={[styles.scoreText, { color: theme.colors.textSecondary }]}>
                        {anime.averageScore.toFixed(1)}
                      </Text>
                    </View>
                  )}
                  
                  {anime.episodes && (
                    <View style={styles.episodeContainer}>
                      <FontAwesome5 name="tv" size={10} color={theme.colors.primary} />
                      <Text style={[styles.episodeText, { color: theme.colors.primary }]}>
                        {anime.episodes} EP
                      </Text>
                    </View>
                  )}
                </View>

                {/* Social Proof */}
                {showSocialProof && (
                  <View style={[styles.socialProofContainer, { backgroundColor: theme.colors.primary + '15' }]}>
                    <FontAwesome5 name="users" size={10} color={theme.colors.primary} />
                    <Text style={[styles.socialProofText, { color: theme.colors.primary }]}>
                      {formatLiveCount(socialProof.count)} {socialProof.text}
                    </Text>
                  </View>
                )}

                {/* FOMO Button */}
                <TouchableOpacity 
                  style={[styles.fomoButton, { backgroundColor: trendingBadge.color }]}
                  onPress={() => router.push(`/anime/${anime.id}`)}
                >
                  <FontAwesome5 name="play" size={12} color="#fff" />
                  <Text style={styles.fomoButtonText}>
                    {urgencyTimer <= 2 ? 'Watch Now!' : 'Join the Hype'}
                  </Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          );
        })}
        
        {/* More Trending Card */}
        <TouchableOpacity
          style={[styles.moreTrendingCard, { backgroundColor: theme.colors.surface }]}
          onPress={() => router.push('/anime-list?category=trending&title=Trending Anime')}
          activeOpacity={0.7}
        >
          <View style={styles.moreTrendingContent}>
            <FontAwesome5 name="fire" size={24} color="#FF4444" />
            <Text style={[styles.moreTrendingText, { color: '#FF4444' }]}>More Trending</Text>
            <Text style={[styles.moreTrendingSubtext, { color: theme.colors.textSecondary }]}>
              See what's hot
            </Text>
          </View>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    paddingHorizontal: 20,
    marginBottom: 40,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerLeft: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 4,
    letterSpacing: -0.5,
  },
  sectionSubtitle: {
    fontSize: 15,
    opacity: 0.7,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#fff',
  },
  liveText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
  },
  scrollContent: {
    paddingRight: 20,
    paddingBottom: 4,
  },
  animeCard: {
    width: 160,
    marginRight: 16,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  animeImage: {
    width: '100%',
    height: 220,
    borderRadius: 16,
  },
  trendingBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    zIndex: 2,
  },
  trendingBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
  },
  liveCountBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 8,
    gap: 3,
    zIndex: 2,
  },
  liveCountText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#fff',
  },
  urgencyBadge: {
    position: 'absolute',
    top: 40,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 8,
    gap: 3,
    zIndex: 2,
  },
  urgencyText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#fff',
  },
  animeInfo: {
    padding: 12,
    gap: 8,
  },
  animeTitle: {
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 20,
  },
  animeMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  scoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  scoreText: {
    fontSize: 12,
    fontWeight: '500',
  },
  episodeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  episodeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  socialProofContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  socialProofText: {
    fontSize: 10,
    fontWeight: '600',
  },
  fomoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 6,
    marginTop: 4,
  },
  fomoButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },
  moreTrendingCard: {
    width: 160,
    marginRight: 16,
    borderRadius: 16,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: 'rgba(255, 68, 68, 0.3)',
    height: 280,
  },
  moreTrendingContent: {
    alignItems: 'center',
    gap: 8,
  },
  moreTrendingText: {
    fontSize: 14,
    fontWeight: '600',
  },
  moreTrendingSubtext: {
    fontSize: 12,
    textAlign: 'center',
  },
}); 