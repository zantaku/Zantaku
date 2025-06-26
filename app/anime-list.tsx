import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Platform } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { FontAwesome5 } from '@expo/vector-icons';
import { useTheme, lightTheme, darkTheme } from '../hooks/useTheme';
import { axios } from '../services/api';
import * as SecureStore from 'expo-secure-store';
import { STORAGE_KEY } from '../constants/auth';
import { useSettings } from '../hooks/useSettings';

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
}

export default function AnimeListScreen() {
  const router = useRouter();
  const { category, title } = useLocalSearchParams();
  const { isDarkMode } = useTheme();
  const { settings } = useSettings();
  const currentTheme = isDarkMode ? darkTheme : lightTheme;
  
  const [animeList, setAnimeList] = useState<Anime[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    fetchAnimeList();
  }, []);

  const getQueryVariables = () => {
    const currentYear = new Date().getFullYear();
    const showAdultContent = settings?.displayAdultContent || false;

    const baseVars = {
      page,
      perPage: 50, // Show more items per page
      isAdult: showAdultContent
    };

    switch (category) {
      case 'trending':
        return { ...baseVars, sort: 'TRENDING_DESC' };
      case 'anticipated':
        return { 
          ...baseVars, 
          sort: 'POPULARITY_DESC',
          status_in: ['NOT_YET_RELEASED', 'RELEASING']
        };
      case 'popular':
        return { 
          ...baseVars, 
          sort: 'TRENDING_DESC',
          status: 'RELEASING'
        };
      case 'lastYear':
        return { 
          ...baseVars, 
          sort: 'POPULARITY_DESC',
          seasonYear: currentYear - 1
        };
      case 'movies':
        return { 
          ...baseVars, 
          sort: 'POPULARITY_DESC',
          format: 'MOVIE',
          status: 'FINISHED'
        };
      case 'musicVideos':
        return { 
          ...baseVars, 
          sort: 'POPULARITY_DESC',
          format: 'MUSIC'
        };
      case 'top100':
        return { 
          ...baseVars, 
          sort: 'SCORE_DESC',
          perPage: 100 // Show all top 100
        };
      default:
        return { ...baseVars, sort: 'POPULARITY_DESC' };
    }
  };

  const fetchAnimeList = async (isLoadMore = false) => {
    try {
      if (isLoadMore) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }

      const token = await SecureStore.getItemAsync(STORAGE_KEY.AUTH_TOKEN);
      const variables = getQueryVariables();

      const query = `
        query ($page: Int, $perPage: Int, $sort: [MediaSort], $isAdult: Boolean, $status: MediaStatus, $status_in: [MediaStatus], $format: MediaFormat, $seasonYear: Int) {
          Page(page: $page, perPage: $perPage) {
            pageInfo {
              hasNextPage
              currentPage
            }
            media(
              type: ANIME, 
              sort: $sort, 
              isAdult: $isAdult,
              status: $status,
              status_in: $status_in,
              format: $format,
              seasonYear: $seasonYear
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
            }
          }
        }
      `;

      const response = await axios.post(
        ANILIST_API,
        { query, variables },
        {
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
          }
        }
      );

      if (response.data?.data?.Page) {
        const newAnime = response.data.data.Page.media.map((anime: any) => ({
          ...anime,
          averageScore: anime.averageScore ? anime.averageScore / 10 : 0
        }));

        if (isLoadMore) {
          setAnimeList(prev => [...prev, ...newAnime]);
        } else {
          setAnimeList(newAnime);
        }

        setHasNextPage(response.data.data.Page.pageInfo.hasNextPage);
      }
    } catch (error) {
      console.error('Error fetching anime list:', error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const loadMore = () => {
    if (hasNextPage && !loadingMore) {
      setPage(prev => prev + 1);
      setTimeout(() => fetchAnimeList(true), 100);
    }
  };

  const renderAnimeItem = ({ item }: { item: Anime }) => (
    <TouchableOpacity
      style={[styles.animeItem, { backgroundColor: currentTheme.colors.surface }]}
      onPress={() => router.push(`/anime/${item.id}`)}
      activeOpacity={0.7}
    >
      <ExpoImage
        source={{ uri: item.coverImage.large }}
        style={styles.animeImage}
        contentFit="cover"
        transition={300}
      />
      <View style={styles.animeInfo}>
        <Text style={[styles.animeTitle, { color: currentTheme.colors.text }]} numberOfLines={2}>
          {item.title.english || item.title.userPreferred || item.title.romaji}
        </Text>
        <View style={styles.animeMeta}>
          {item.averageScore > 0 && (
            <View style={styles.scoreContainer}>
              <FontAwesome5 name="star" size={12} color="#FFD700" solid />
              <Text style={[styles.scoreText, { color: currentTheme.colors.textSecondary }]}>
                {item.averageScore.toFixed(1)}
              </Text>
            </View>
          )}
          {item.format && (
            <View style={[styles.formatBadge, { backgroundColor: currentTheme.colors.primary + '20' }]}>
              <Text style={[styles.formatText, { color: currentTheme.colors.primary }]}>
                {item.format}
              </Text>
            </View>
          )}
          {item.episodes && (
            <View style={styles.episodeContainer}>
              <FontAwesome5 name="tv" size={10} color={currentTheme.colors.textSecondary} />
              <Text style={[styles.episodeText, { color: currentTheme.colors.textSecondary }]}>
                {item.episodes} EP
              </Text>
            </View>
          )}
        </View>
        {item.startDate && (
          <Text style={[styles.dateText, { color: currentTheme.colors.textSecondary }]}>
            {item.startDate.month}/{item.startDate.year}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );

  const renderFooter = () => {
    if (!loadingMore) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={currentTheme.colors.primary} />
      </View>
    );
  };

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: currentTheme.colors.background }]}>
        <ActivityIndicator size="large" color={currentTheme.colors.primary} />
        <Text style={[styles.loadingText, { color: currentTheme.colors.textSecondary }]}>
          Loading {title}...
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: currentTheme.colors.background }]}>
      <View style={[styles.header, { backgroundColor: currentTheme.colors.background }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <FontAwesome5 name="arrow-left" size={20} color={currentTheme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: currentTheme.colors.text }]}>
          {title}
        </Text>
        <View style={styles.placeholder} />
      </View>

      <FlatList
        data={animeList}
        renderItem={renderAnimeItem}
        keyExtractor={(item) => item.id.toString()}
        numColumns={2}
        contentContainerStyle={styles.listContainer}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={renderFooter}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  placeholder: {
    width: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: '500',
  },
  listContainer: {
    padding: 20,
  },
  animeItem: {
    flex: 1,
    margin: 8,
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
    height: 200,
  },
  animeInfo: {
    padding: 12,
  },
  animeTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    lineHeight: 18,
  },
  animeMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 4,
  },
  scoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  scoreText: {
    fontSize: 12,
    fontWeight: '600',
  },
  formatBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  formatText: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  episodeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  episodeText: {
    fontSize: 11,
    fontWeight: '500',
  },
  dateText: {
    fontSize: 11,
    fontWeight: '500',
  },
  footerLoader: {
    paddingVertical: 20,
    alignItems: 'center',
  },
}); 