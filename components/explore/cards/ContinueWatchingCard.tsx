import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform, Animated } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { FontAwesome5 } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';

interface ContinueWatchingCardProps {
  data: {
    items?: any[];
    title?: string;
    subtitle?: string;
    showProgress?: boolean;
    showNextEpisode?: boolean;
    showFriendActivity?: boolean;
  } | any[];
  theme: any;
  isDarkMode: boolean;
}

export default function ContinueWatchingCard({ data, theme, isDarkMode }: ContinueWatchingCardProps) {
  const router = useRouter();
  
  // Handle both old array format and new object format
  const items = Array.isArray(data) ? data : (data?.items || []);
  const title = Array.isArray(data) ? 'Continue Watching' : (data?.title || 'Continue Watching');
  const subtitle = Array.isArray(data) ? 'Pick up where you left off' : (data?.subtitle || 'Pick up where you left off');
  const showProgress = Array.isArray(data) ? true : (data?.showProgress ?? true);
  const showNextEpisode = Array.isArray(data) ? true : (data?.showNextEpisode ?? true);
  const showFriendActivity = Array.isArray(data) ? false : (data?.showFriendActivity ?? false);

  const [progressAnim] = useState(new Animated.Value(0));

  useEffect(() => {
    // Animate progress bars on mount
    Animated.timing(progressAnim, {
      toValue: 1,
      duration: 1000,
      useNativeDriver: false,
    }).start();
  }, []);

  const getProgressPercentage = (anime: any) => {
    if (!anime.progress || !anime.episodes) return 0;
    return Math.min((anime.progress / anime.episodes) * 100, 100);
  };

  const getNextEpisodeNumber = (anime: any) => {
    if (!anime.progress || !anime.episodes) return 1;
    return Math.min(anime.progress + 1, anime.episodes);
  };

  const getFriendActivity = (animeId: number) => {
    // This would come from social activity data
    const activities = [
      { type: 'watching', count: 3, friends: ['Alice', 'Bob'] },
      { type: 'completed', count: 1, friends: ['Charlie'] },
      { type: 'planning', count: 2, friends: ['David', 'Eve'] }
    ];
    
    const activity = activities.find(a => a.count > 0);
    if (!activity) return null;
    
    return {
      text: `${activity.count} friend${activity.count > 1 ? 's' : ''} ${activity.type}`,
      type: activity.type,
      friends: activity.friends
    };
  };

  const getProgressColor = (percentage: number) => {
    if (percentage >= 80) return '#4CAF50'; // Green for almost done
    if (percentage >= 50) return '#FF9800'; // Orange for halfway
    return '#02A9FF'; // Blue for early progress
  };

  const getProgressEmoji = (percentage: number) => {
    if (percentage >= 80) return '🔥';
    if (percentage >= 50) return '⚡';
    if (percentage >= 25) return '🚀';
    return '🎬';
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
        <TouchableOpacity 
          style={[styles.viewAllButton, { backgroundColor: theme.colors.primary + '20' }]}
          onPress={() => router.push('/watchlist')}
        >
          <Text style={[styles.viewAllText, { color: theme.colors.primary }]}>View All</Text>
          <FontAwesome5 name="chevron-right" size={12} color={theme.colors.primary} />
        </TouchableOpacity>
      </View>
      
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {items.map((anime: any) => {
          const progressPercentage = getProgressPercentage(anime);
          const nextEpisode = getNextEpisodeNumber(anime);
          const progressColor = getProgressColor(progressPercentage);
          const progressEmoji = getProgressEmoji(progressPercentage);
          const friendActivity = showFriendActivity ? getFriendActivity(anime.id) : null;
          
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
              {/* Progress Badge */}
              {showProgress && (
                <View style={styles.progressBadge}>
                  <Text style={styles.progressEmoji}>{progressEmoji}</Text>
                  <Text style={styles.progressText}>{Math.round(progressPercentage)}%</Text>
                </View>
              )}

              {/* Friend Activity Badge */}
              {friendActivity && (
                <View style={[styles.friendBadge, { backgroundColor: theme.colors.primary + '20' }]}>
                  <FontAwesome5 name="users" size={10} color={theme.colors.primary} />
                  <Text style={[styles.friendText, { color: theme.colors.primary }]}>
                    {friendActivity.text}
                  </Text>
                </View>
              )}

              <ExpoImage
                source={{ uri: anime.coverImage.large }}
                style={styles.animeImage}
                contentFit="cover"
                transition={500}
              />
              
              {/* Progress Overlay */}
              {showProgress && progressPercentage > 0 && (
                <View style={styles.progressOverlay}>
                  <Animated.View 
                    style={[
                      styles.progressBar,
                      { 
                        width: progressAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: ['0%', `${progressPercentage}%`]
                        }),
                        backgroundColor: progressColor
                      }
                    ]} 
                  />
                </View>
              )}
              
              <View style={styles.animeInfo}>
                <Text style={[styles.animeTitle, { color: theme.colors.text }]} numberOfLines={2}>
                  {anime.title.english || anime.title.userPreferred}
                </Text>
                
                <View style={styles.animeMeta}>
                  {showProgress && anime.progress && (
                    <View style={styles.progressInfo}>
                      <FontAwesome5 name="play-circle" size={12} color={progressColor} />
                      <Text style={[styles.progressInfoText, { color: theme.colors.textSecondary }]}>
                        Ep {anime.progress} of {anime.episodes || '?'}
                      </Text>
                    </View>
                  )}
                  
                  {showNextEpisode && nextEpisode && (
                    <View style={styles.nextEpisodeInfo}>
                      <FontAwesome5 name="forward" size={10} color={theme.colors.primary} />
                      <Text style={[styles.nextEpisodeText, { color: theme.colors.primary }]}>
                        Next: Ep {nextEpisode}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Continue Button */}
                <TouchableOpacity 
                  style={[styles.continueButton, { backgroundColor: progressColor }]}
                  onPress={() => router.push(`/anime/${anime.id}`)}
                >
                  <FontAwesome5 name="play" size={12} color="#fff" />
                  <Text style={styles.continueButtonText}>
                    {progressPercentage >= 80 ? 'Finish' : 'Continue'}
                  </Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          );
        })}
        
        {/* Add to List Card */}
        <TouchableOpacity
          style={[styles.addToListCard, { backgroundColor: theme.colors.surface }]}
          onPress={() => router.push('/watchlist')}
          activeOpacity={0.7}
        >
          <View style={styles.addToListContent}>
            <FontAwesome5 name="plus-circle" size={24} color={theme.colors.primary} />
            <Text style={[styles.addToListText, { color: theme.colors.primary }]}>Add More</Text>
            <Text style={[styles.addToListSubtext, { color: theme.colors.textSecondary }]}>
              Discover new anime
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
    alignItems: 'flex-start',
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
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  viewAllText: {
    fontSize: 12,
    fontWeight: '600',
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
  progressBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
    zIndex: 2,
  },
  progressEmoji: {
    fontSize: 12,
  },
  progressText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
  },
  friendBadge: {
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
  friendText: {
    fontSize: 9,
    fontWeight: '600',
  },
  progressOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    zIndex: 1,
  },
  progressBar: {
    height: '100%',
    borderRadius: 2,
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
    gap: 4,
  },
  progressInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  progressInfoText: {
    fontSize: 12,
    fontWeight: '500',
  },
  nextEpisodeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  nextEpisodeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  continueButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 6,
    marginTop: 4,
  },
  continueButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },
  addToListCard: {
    width: 160,
    marginRight: 16,
    borderRadius: 16,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: 'rgba(2, 169, 255, 0.3)',
    height: 280,
  },
  addToListContent: {
    alignItems: 'center',
    gap: 8,
  },
  addToListText: {
    fontSize: 14,
    fontWeight: '600',
  },
  addToListSubtext: {
    fontSize: 12,
    textAlign: 'center',
  },
}); 