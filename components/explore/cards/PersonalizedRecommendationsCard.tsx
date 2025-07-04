import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { FontAwesome5 } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

interface PersonalizedRecommendationsCardProps {
  data: {
    items?: any[];
    title?: string;
    subtitle?: string;
    algorithm?: string;
    confidence?: number;
    showAddToListButton?: boolean;
  } | any[];
  theme: any;
  isDarkMode: boolean;
}

export default function PersonalizedRecommendationsCard({ data, theme, isDarkMode }: PersonalizedRecommendationsCardProps) {
  const router = useRouter();
  
  // Handle both old array format and new object format
  const items = Array.isArray(data) ? data : (data?.items || []);
  const title = Array.isArray(data) ? 'Because You Watched' : (data?.title || 'Because You Watched');
  const subtitle = Array.isArray(data) ? 'Handpicked for your taste' : (data?.subtitle || 'Handpicked for your taste');

  const getFriendActivity = (animeId: number) => {
    // This would come from social activity data
    return null;
  };

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
              styles.animeCard,
              { 
                backgroundColor: theme.colors.surface,
                shadowColor: isDarkMode ? '#000' : '#666'
              }
            ]}
            onPress={() => router.push(`/anime/${anime.id}`)}
            activeOpacity={0.7}
          >
            <View style={styles.recommendationBadge}>
              <FontAwesome5 name="heart" size={10} color="#FF6B6B" solid />
              <Text style={styles.recommendationBadgeText}>For You</Text>
            </View>
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
              <View style={styles.scoreContainer}>
                <FontAwesome5 name="star" size={10} color="#FFD700" solid />
                <Text style={[styles.scoreText, { color: theme.colors.textSecondary }]}>
                  {anime.averageScore.toFixed(1)}
                </Text>
              </View>
              {getFriendActivity(anime.id) && (
                <View style={[styles.socialProofBadge, { backgroundColor: theme.colors.primary + '20' }]}>
                  <FontAwesome5 name="users" size={8} color={theme.colors.primary} />
                  <Text style={[styles.socialProofText, { color: theme.colors.primary }]}>
                    {getFriendActivity(anime.id)}
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
  animeCard: {
    width: 160,
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
  animeImage: {
    width: '100%',
    height: 220,
    borderRadius: 16,
  },
  animeInfo: {
    padding: 12,
    paddingBottom: 8,
  },
  animeTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 6,
    lineHeight: 20,
  },
  scoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  scoreText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  socialProofBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 8,
    gap: 4,
    marginTop: 4,
  },
  socialProofText: {
    fontSize: 9,
    fontWeight: '600',
  },
  recommendationBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 107, 107, 0.9)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 8,
    gap: 3,
    zIndex: 1,
  },
  recommendationBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#fff',
  },
}); 