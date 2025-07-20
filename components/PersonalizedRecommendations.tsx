import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView, Platform } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { useRouter } from 'expo-router';
import { FontAwesome5 } from '@expo/vector-icons';
import { useTheme, lightTheme, darkTheme } from '../hooks/useTheme';
import * as SecureStore from 'expo-secure-store';
import { STORAGE_KEY } from '../constants/auth';
import { axios } from '../services/api';

const ANILIST_API = 'https://graphql.anilist.co';

interface Anime {
  id: number;
  title: {
    userPreferred: string;
    english: string;
    romaji: string;
    native: string;
  };
  coverImage: {
    extraLarge: string;
    large: string;
    color: string;
  };
  averageScore: number;
  episodes: number;
  status: string;
  format?: string;
  season?: string;
  seasonYear?: number;
  startDate?: {
    year: number;
    month: number;
    day: number;
  };
  genres?: string[];
  source?: string;
}

interface RecommendationProps {
  userId?: number;
  showAdultContent?: boolean;
}

const PersonalizedRecommendations: React.FC<RecommendationProps> = ({ userId, showAdultContent = false }) => {
  const router = useRouter();
  const { isDarkMode } = useTheme();
  const currentTheme = isDarkMode ? darkTheme : lightTheme;
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [historyBasedRecs, setHistoryBasedRecs] = useState<Anime[]>([]);
  const [friendWatchingRecs, setFriendWatchingRecs] = useState<Anime[]>([]);
  const [genreBasedRecs, setGenreBasedRecs] = useState<Anime[]>([]);
  const [topGenres, setTopGenres] = useState<string[]>([]);
  const [hasData, setHasData] = useState(false);

  useEffect(() => {
    fetchRecommendations();
  }, [userId]);

  const fetchRecommendations = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const token = await SecureStore.getItemAsync(STORAGE_KEY.AUTH_TOKEN);
      if (!token && !userId) {
        setError('Please log in to see personalized recommendations');
        setLoading(false);
        return;
      }

      // Fetch user's watching history
      const historyQuery = `
        query ($userId: Int, $isAdult: Boolean) {
          MediaListCollection(userId: $userId, type: ANIME) {
            lists {
              entries {
                score
                media {
                  id
                  title {
                    userPreferred
                    english
                    romaji
                    native
                  }
                  genres
                  tags {
                    name
                  }
                }
              }
            }
          }
          
          # Get recommendations based on user's list
          Recommendations: Page(perPage: 10) {
            recommendations(sort: RATING_DESC) {
              mediaRecommendation {
                id
                title {
                  userPreferred
                  english
                  romaji
                  native
                }
                coverImage {
                  extraLarge
                  large
                  color
                }
                averageScore
                episodes
                status
                format
                season
                seasonYear
                startDate {
                  year
                  month
                  day
                }
                genres
              }
            }
          }
          
          # Get user's genre stats
          User(id: $userId) {
            statistics {
              anime {
                genres {
                  genre
                  count
                  meanScore
                  minutesWatched
                }
              }
            }
          }
          
          # Get user's following list
          Viewer {
            following {
              id
              name
            }
          }
        }
      `;

      const response = await axios.post(
        ANILIST_API,
        {
          query: historyQuery,
          variables: { 
            userId: userId, 
            isAdult: showAdultContent 
          }
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
          },
          timeout: 30000
        }
      );

      if (response.data?.errors) {
        console.error('GraphQL Errors:', response.data.errors);
        setError('Failed to fetch recommendations');
        setLoading(false);
        return;
      }

      // Process history-based recommendations
      const recommendations = response.data?.data?.Recommendations?.recommendations || [];
      const processedRecs = recommendations.map((rec: any) => ({
        ...rec.mediaRecommendation,
        averageScore: rec.mediaRecommendation.averageScore ? rec.mediaRecommendation.averageScore / 10 : 0
      }));
      
      setHistoryBasedRecs(processedRecs);

      // Process genre stats
      const genreStats = response.data?.data?.User?.statistics?.anime?.genres || [];
      if (genreStats.length > 0) {
        // Get top 3 genres by count
        const userTopGenres = genreStats
          .sort((a: any, b: any) => b.count - a.count)
          .slice(0, 3)
          .map((g: any) => g.genre);
        
        setTopGenres(userTopGenres);
        
        // Fetch genre-based recommendations
        await fetchGenreRecommendations(userTopGenres, token);
      }

      // Process friend watching data
      const following = response.data?.data?.Viewer?.following || [];
      if (following.length > 0) {
        const friendIds = following.map((user: any) => user.id);
        await fetchFriendWatching(friendIds, token);
      }

      setHasData(true);
    } catch (error) {
      console.error('Error fetching recommendations:', error);
      setError('Failed to load recommendations');
    } finally {
      setLoading(false);
    }
  };

  const fetchGenreRecommendations = async (genres: string[], token: string | null) => {
    try {
      const query = `
        query ($genres: [String], $isAdult: Boolean) {
          Page(perPage: 10) {
            media(
              genre_in: $genres
              sort: POPULARITY_DESC
              type: ANIME
              isAdult: $isAdult
            ) {
              id
              title {
                userPreferred
                english
                romaji
                native
              }
              coverImage {
                extraLarge
                large
                color
              }
              averageScore
              episodes
              status
              format
              season
              seasonYear
              startDate {
                year
                month
                day
              }
              genres
            }
          }
        }
      `;

      const response = await axios.post(
        ANILIST_API,
        {
          query,
          variables: { 
            genres, 
            isAdult: showAdultContent 
          }
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
          },
          timeout: 30000
        }
      );

      const genreAnime = response.data?.data?.Page?.media || [];
      const processedGenreRecs = genreAnime.map((anime: any) => ({
        ...anime,
        averageScore: anime.averageScore ? anime.averageScore / 10 : 0
      }));
      
      setGenreBasedRecs(processedGenreRecs);
    } catch (error) {
      console.error('Error fetching genre recommendations:', error);
    }
  };

  const fetchFriendWatching = async (friendIds: number[], token: string | null) => {
    try {
      if (friendIds.length === 0) return;

      const queries = friendIds.map(userId => `
        user_${userId}: MediaListCollection(userId: ${userId}, type: ANIME, status: CURRENT) {
          lists {
            entries {
              progress
              media {
                id
                title {
                  userPreferred
                  english
                  romaji
                }
                coverImage {
                  large
                }
                averageScore
                episodes
                status
                format
                season
                seasonYear
                startDate {
                  year
                  month
                  day
                }
              }
            }
          }
        }
      `);

      const query = `
        query {
          ${queries.join('\n')}
        }
      `;

      const response = await axios.post(
        ANILIST_API,
        { query },
        {
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
          },
          timeout: 30000
        }
      );

      // Process friend watching data
      const friendWatching: Anime[] = [];
      Object.entries(response.data.data).forEach(([key, value]: [string, any]) => {
        const entries = value.lists?.[0]?.entries || [];
        entries.forEach((entry: any) => {
          if (entry.media) {
            friendWatching.push({
              ...entry.media,
              averageScore: entry.media.averageScore ? entry.media.averageScore / 10 : 0
            });
          }
        });
      });

      // Remove duplicates
      const uniqueAnime = friendWatching.filter((anime, index, self) =>
        index === self.findIndex((a) => a.id === anime.id)
      );

      setFriendWatchingRecs(uniqueAnime);
    } catch (error) {
      console.error('Error fetching friend watching:', error);
    }
  };

  const renderAnimeItem = (anime: Anime) => (
    <TouchableOpacity
      key={anime.id}
      style={[styles.animeCard, { backgroundColor: currentTheme.colors.surface }]}
      onPress={() => router.push(`/anime/${anime.id}`)}
      activeOpacity={0.7}
    >
      <ExpoImage
        source={{ uri: anime.coverImage.large }}
        style={styles.animeImage}
        contentFit="cover"
        transition={500}
      />
      <View style={styles.animeInfo}>
        <Text style={[styles.animeTitle, { color: currentTheme.colors.text }]} numberOfLines={2}>
          {anime.title.english || anime.title.userPreferred}
        </Text>
        <View style={styles.scoreContainer}>
          <FontAwesome5 name="star" size={10} color="#FFD700" solid />
          <Text style={[styles.scoreText, { color: currentTheme.colors.textSecondary }]}>
            {anime.averageScore.toFixed(1)}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: currentTheme.colors.background }]}>
        <ActivityIndicator size="small" color={currentTheme.colors.primary} />
        <Text style={[styles.loadingText, { color: currentTheme.colors.textSecondary }]}>
          Finding recommendations for you...
        </Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.errorContainer, { backgroundColor: currentTheme.colors.background }]}>
        <FontAwesome5 name="exclamation-circle" size={24} color={currentTheme.colors.textSecondary} />
        <Text style={[styles.errorText, { color: currentTheme.colors.textSecondary }]}>{error}</Text>
        <TouchableOpacity 
          style={[styles.retryButton, { backgroundColor: currentTheme.colors.primary }]}
          onPress={fetchRecommendations}
        >
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!hasData) {
    return (
      <View style={[styles.errorContainer, { backgroundColor: currentTheme.colors.background }]}>
        <FontAwesome5 name="info-circle" size={24} color={currentTheme.colors.textSecondary} />
        <Text style={[styles.errorText, { color: currentTheme.colors.textSecondary }]}>
          No recommendations available. Try watching more anime to get personalized suggestions.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {historyBasedRecs.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: currentTheme.colors.text }]}>Based on Your History</Text>
            <Text style={[styles.sectionSubtitle, { color: currentTheme.colors.textSecondary }]}>
              Recommendations from your watching patterns
            </Text>
          </View>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {historyBasedRecs.map(anime => renderAnimeItem(anime))}
          </ScrollView>
        </View>
      )}

      {friendWatchingRecs.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: currentTheme.colors.text }]}>Friends Are Watching</Text>
            <Text style={[styles.sectionSubtitle, { color: currentTheme.colors.textSecondary }]}>
              Popular among people you follow
            </Text>
          </View>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {friendWatchingRecs.map(anime => renderAnimeItem(anime))}
          </ScrollView>
        </View>
      )}

      {genreBasedRecs.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: currentTheme.colors.text }]}>For You</Text>
            <Text style={[styles.sectionSubtitle, { color: currentTheme.colors.textSecondary }]}>
              Based on your {topGenres.slice(0, 2).join(' & ')} preferences
            </Text>
          </View>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {genreBasedRecs.map(anime => renderAnimeItem(anime))}
          </ScrollView>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    height: 200,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    fontWeight: '500',
  },
  errorContainer: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    height: 200,
  },
  errorText: {
    marginTop: 12,
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    marginBottom: 12,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 4,
    letterSpacing: -0.5,
  },
  sectionSubtitle: {
    fontSize: 14,
    opacity: 0.7,
  },
  scrollContent: {
    paddingLeft: 20,
    paddingRight: 8,
  },
  animeCard: {
    width: 140,
    marginRight: 12,
    borderRadius: 12,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  animeImage: {
    width: '100%',
    height: 190,
    borderRadius: 12,
  },
  animeInfo: {
    padding: 10,
  },
  animeTitle: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 4,
    lineHeight: 18,
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
});

export default PersonalizedRecommendations;