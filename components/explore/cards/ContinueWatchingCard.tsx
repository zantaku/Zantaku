import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { FontAwesome5 } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

interface ContinueWatchingCardProps {
  data: {
    items?: any[];
    title?: string;
    subtitle?: string;
    showProgress?: boolean;
    personalizedMessage?: string;
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

  if (!items || items.length === 0) return null;

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View>
                  <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>{title}</Text>
        <Text style={[styles.sectionSubtitle, { color: theme.colors.textSecondary }]}>
          {subtitle}
        </Text>
        </View>
      </View>
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {items.map((anime: any) => (
          <TouchableOpacity 
            key={anime.id}
            style={[
              styles.continueWatchingCard,
              { 
                backgroundColor: theme.colors.surface,
                shadowColor: isDarkMode ? '#000' : '#666'
              }
            ]}
            onPress={() => router.push(`/anime/${anime.id}`)}
            activeOpacity={0.7}
          >
            <ExpoImage
              source={{ uri: anime.coverImage.large }}
              style={styles.continueWatchingImage}
              contentFit="cover"
              transition={500}
            />
            <View style={styles.continueWatchingInfo}>
              <Text style={[styles.continueWatchingTitle, { color: theme.colors.text }]} numberOfLines={2}>
                {anime.title.english || anime.title.userPreferred}
              </Text>
              <View style={styles.continueWatchingProgress}>
                <View style={styles.progressInfo}>
                  <FontAwesome5 name="play" size={10} color={theme.colors.primary} />
                  <Text style={[styles.progressText, { color: theme.colors.textSecondary }]}>
                    Episode {anime.progress || 0}
                    {anime.episodes && ` / ${anime.episodes}`}
                  </Text>
                </View>
                {anime.episodes && (
                  <View style={[styles.continueProgressBar, { backgroundColor: theme.colors.background }]}>
                    <View 
                      style={[
                        styles.progressFill,
                        { 
                          width: `${((anime.progress || 0) / anime.episodes) * 100}%`,
                          backgroundColor: theme.colors.primary
                        }
                      ]} 
                    />
                  </View>
                )}
              </View>
              {anime.nextAiringEpisode && (
                <View style={styles.nextEpisodeInfo}>
                  <FontAwesome5 name="clock" size={10} color="#FF9800" />
                  <Text style={[styles.nextEpisodeText, { color: '#FF9800' }]}>
                    Ep {anime.nextAiringEpisode.episode} in {Math.ceil(anime.nextAiringEpisode.timeUntilAiring / 3600)}h
                  </Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
        ))}
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
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  sectionSubtitle: {
    fontSize: 15,
    opacity: 0.7,
  },
  scrollContent: {
    paddingRight: 20,
    paddingBottom: 4,
  },
  continueWatchingCard: {
    width: 180,
    marginRight: 16,
    borderRadius: 16,
    overflow: 'hidden',
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
  continueWatchingImage: {
    width: '100%',
    height: 240,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  continueWatchingInfo: {
    padding: 12,
    gap: 8,
  },
  continueWatchingTitle: {
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 20,
  },
  continueWatchingProgress: {
    gap: 6,
  },
  progressInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  progressText: {
    fontSize: 12,
    fontWeight: '600',
  },
  continueProgressBar: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  nextEpisodeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingTop: 2,
  },
  nextEpisodeText: {
    fontSize: 11,
    fontWeight: '600',
  },
}); 