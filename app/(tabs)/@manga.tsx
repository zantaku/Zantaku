import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform, ActivityIndicator, FlatList, useWindowDimensions, Dimensions, Animated, DeviceEventEmitter } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { useRouter } from 'expo-router';
import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { FontAwesome5 } from '@expo/vector-icons';
import { useTheme, lightTheme, darkTheme } from '../../hooks/useTheme';
import { useSettings } from '../../hooks/useSettings';
import * as SecureStore from 'expo-secure-store';
import { STORAGE_KEY } from '../../constants/auth';
import MangaSearchGlobal from '../../components/MangaSearchGlobal';

const ANILIST_API = 'https://graphql.anilist.co';

interface Manga {
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
  bannerImage: string;
  description: string | null;
  chapters: number;
  averageScore: number;
  trending: number;
  popularity: number;
  status: string;
  format?: string;
  startDate?: {
    year: number;
  };
  nextAiringChapter: {
    chapter: number;
    timeUntilAiring: number;
  } | null;
}

interface Character {
  id: number;
  name: {
    userPreferred: string;
    first: string;
    middle: string;
    last: string;
    full: string;
    native: string;
  };
  image: {
    medium: string;
  };
  dateOfBirth: {
    month: number;
    day: number;
  };
}

interface Staff {
  id: number;
  name: {
    userPreferred: string;
    first: string;
    middle: string;
    last: string;
    full: string;
    native: string;
  };
  image: {
    medium: string;
  };
  dateOfBirth: {
    month: number;
    day: number;
  };
}

const { width, height } = Dimensions.get('window');

export default function MangaScreen() {
  const router = useRouter();
  const { isDarkMode } = useTheme();
  const currentTheme = isDarkMode ? darkTheme : lightTheme;
  const { settings } = useSettings();
  const [trendingManga, setTrendingManga] = useState<Manga[]>([]);
  const [recentlyUpdated, setRecentlyUpdated] = useState<Manga[]>([]);
  const [birthdays, setBirthdays] = useState<(Character | Staff)[]>([]);
  const [popularManga, setPopularManga] = useState<Manga[]>([]);
  const [lightNovels, setLightNovels] = useState<Manga[]>([]);
  const [manhwa, setManhwa] = useState<Manga[]>([]);
  const [manhua, setManhua] = useState<Manga[]>([]);
  const [taihua, setTaihua] = useState<Manga[]>([]);
  const [loading, setLoading] = useState(true);
  const [heroManga, setHeroManga] = useState<Manga | null>(null);
  const [activeHeroIndex, setActiveHeroIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const [oneShots, setOneShots] = useState<Manga[]>([]);
  const [lastYearManga, setLastYearManga] = useState<Manga[]>([]);
  const [top100Manga, setTop100Manga] = useState<Manga[]>([]);
  const currentYear = new Date().getFullYear();
  const progressAnim = useRef(new Animated.Value(0)).current;
  const [showSearch, setShowSearch] = useState(false);

  useEffect(() => {
    // Fetch data immediately without waiting for settings
    fetchData();

    // Listen for search event
    const searchSubscription = DeviceEventEmitter.addListener('showSearch', () => {
      setShowSearch(true);
    });

    // Listen for genre search requests to show the search modal
    const genreSearchListener = DeviceEventEmitter.addListener('openGenreSearch', (genre) => {
      console.log('[MangaScreen] Received openGenreSearch event for:', genre);
      setShowSearch(true);
    });

    return () => {
      searchSubscription.remove();
      genreSearchListener.remove();
    };
  }, []); // Remove settings dependency

  useEffect(() => {
    const startAnimations = () => {
      // Reset progress animation
      progressAnim.setValue(0);
      
      // Start progress bar animation
      Animated.timing(progressAnim, {
        toValue: 1,
        duration: 60000, // 1 minute
        useNativeDriver: false,
      }).start();
    };

    startAnimations();

    const timer = setInterval(() => {
      if (trendingManga.length > 0) {
        const nextIndex = (activeHeroIndex + 1) % Math.min(trendingManga.length, 5);
        flatListRef.current?.scrollToIndex({
          index: nextIndex,
          animated: true
        });
        setActiveHeroIndex(nextIndex);
        startAnimations();
      }
    }, 60000); // 60000ms = 1 minute

    return () => clearInterval(timer);
  }, [activeHeroIndex, trendingManga]);

  const fetchData = async () => {
    try {
      setLoading(true);
      // Use a default value for adult content if settings is not available
      const showAdultContent = settings?.displayAdultContent || false;
      console.log('Fetching manga data with adult content:', showAdultContent);

      // Try to get token but don't require it
      const token = await SecureStore.getItemAsync(STORAGE_KEY.AUTH_TOKEN);
      console.log('Token available:', !!token);

      const query = `
        query ($lastYear: Int, $isAdult: Boolean) {
          trending: Page(page: 1, perPage: 5) {
            media(sort: TRENDING_DESC, type: MANGA, isAdult: $isAdult) {
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
              bannerImage
              description
              chapters
              averageScore
              trending
              popularity
              status
              format
            }
          }
          recentlyUpdated: Page(page: 1, perPage: 10) {
            media(sort: UPDATED_AT_DESC, type: MANGA, isAdult: $isAdult) {
              id
              title {
                userPreferred
                english
                romaji
                native
              }
              coverImage {
                large
              }
              chapters
              averageScore
              format
            }
          }
          lastYearManga: Page(page: 1, perPage: 50) {
            media(sort: POPULARITY_DESC, type: MANGA, seasonYear: $lastYear, isAdult: $isAdult) {
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
              bannerImage
              description
              chapters
              averageScore
              trending
              popularity
              status
              format
              startDate {
                year
              }
            }
          }
          oneShots: Page(page: 1, perPage: 10) {
            media(sort: POPULARITY_DESC, type: MANGA, format: ONE_SHOT, isAdult: $isAdult) {
              id
              title {
                userPreferred
                english
                romaji
                native
              }
              coverImage {
                large
              }
              chapters
              averageScore
            }
          }
          lightNovels: Page(page: 1, perPage: 10) {
            media(sort: POPULARITY_DESC, type: MANGA, format: NOVEL, isAdult: $isAdult) {
              id
              title {
                userPreferred
                english
                romaji
                native
              }
              coverImage {
                large
              }
              chapters
              averageScore
            }
          }
          manhwa: Page(page: 1, perPage: 10) {
            media(sort: POPULARITY_DESC, type: MANGA, countryOfOrigin: "KR", isAdult: $isAdult) {
              id
              title {
                userPreferred
                english
                romaji
                native
              }
              coverImage {
                large
              }
              chapters
              averageScore
            }
          }
          manhua: Page(page: 1, perPage: 10) {
            media(sort: POPULARITY_DESC, type: MANGA, countryOfOrigin: "CN", isAdult: $isAdult) {
              id
              title {
                userPreferred
                english
                romaji
                native
              }
              coverImage {
                large
              }
              chapters
              averageScore
            }
          }
          taihua: Page(page: 1, perPage: 10) {
            media(sort: POPULARITY_DESC, type: MANGA, countryOfOrigin: "TW", isAdult: $isAdult) {
              id
              title {
                userPreferred
                english
                romaji
                native
              }
              coverImage {
                large
              }
              chapters
              averageScore
            }
          }
          top100: Page(page: 1, perPage: 100) {
            media(sort: SCORE_DESC, type: MANGA, isAdult: $isAdult) {
              id
              title {
                userPreferred
                english
                romaji
                native
              }
              coverImage {
                large
              }
              chapters
              averageScore
              format
              startDate {
                year
              }
            }
          }
        }
      `;

      const response = await axios.post(
        ANILIST_API,
        {
          query,
          variables: {
            lastYear: currentYear - 1,
            isAdult: showAdultContent
          }
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
          },
          timeout: 30000 // Increase timeout to 30 seconds
        }
      );

      console.log('API Response Status:', response.status);
      console.log('API Response Data:', JSON.stringify(response.data, null, 2));

      if (response.data?.errors) {
        console.error('GraphQL Errors:', response.data.errors);
        throw new Error(response.data.errors[0]?.message || 'GraphQL Error');
      }

      if (!response.data?.data) {
        console.error('Invalid API Response:', response.data);
        throw new Error('Invalid response from AniList API');
      }

      const data = response.data.data;
      
      // Process trending manga even if other data is missing
      const processedTrending = (data.trending?.media || []).map((manga: any) => ({
        ...manga,
        title: {
          ...manga.title,
          userPreferred: manga.title.userPreferred || manga.title.romaji || manga.title.english || 'Unknown Title'
        },
        averageScore: manga.averageScore ? manga.averageScore / 10 : null
      }));

      if (processedTrending.length > 0) {
        console.log('Successfully processed trending manga:', processedTrending.length);
        setTrendingManga(processedTrending);
        setHeroManga(processedTrending[0]);
      } else {
        console.warn('No trending manga data available');
      }

      // Process recently updated manga
      const processedRecent = data.recentlyUpdated.media.map((manga: any) => ({
        ...manga,
        title: {
          ...manga.title,
          userPreferred: manga.title.userPreferred || manga.title.romaji || manga.title.english || 'Unknown Title'
        },
        averageScore: manga.averageScore ? manga.averageScore / 10 : null
      }));

      // Process last year manga
      const processedLastYear = data.lastYearManga.media.map((manga: any) => ({
        ...manga,
        title: {
          ...manga.title,
          userPreferred: manga.title.userPreferred || manga.title.romaji || manga.title.english || 'Unknown Title'
        },
        averageScore: manga.averageScore ? manga.averageScore / 10 : null
      }));

      // Process one shots
      const processedOneShots = data.oneShots.media.map((manga: any) => ({
        ...manga,
        title: {
          ...manga.title,
          userPreferred: manga.title.userPreferred || manga.title.romaji || manga.title.english || 'Unknown Title'
        },
        averageScore: manga.averageScore ? manga.averageScore / 10 : null
      }));

      // Process light novels
      const processedLightNovels = data.lightNovels.media.map((manga: any) => ({
        ...manga,
        title: {
          ...manga.title,
          userPreferred: manga.title.userPreferred || manga.title.romaji || manga.title.english || 'Unknown Title'
        },
        averageScore: manga.averageScore ? manga.averageScore / 10 : null
      }));

      // Process manhwa
      const processedManhwa = data.manhwa.media.map((manga: any) => ({
        ...manga,
        title: {
          ...manga.title,
          userPreferred: manga.title.userPreferred || manga.title.romaji || manga.title.english || 'Unknown Title'
        },
        averageScore: manga.averageScore ? manga.averageScore / 10 : null
      }));

      // Process manhua
      const processedManhua = data.manhua.media.map((manga: any) => ({
        ...manga,
        title: {
          ...manga.title,
          userPreferred: manga.title.userPreferred || manga.title.romaji || manga.title.english || 'Unknown Title'
        },
        averageScore: manga.averageScore ? manga.averageScore / 10 : null
      }));

      // Process taihua
      const processedTaihua = data.taihua.media.map((manga: any) => ({
        ...manga,
        title: {
          ...manga.title,
          userPreferred: manga.title.userPreferred || manga.title.romaji || manga.title.english || 'Unknown Title'
        },
        averageScore: manga.averageScore ? manga.averageScore / 10 : null
      }));

      // Process top 100 manga
      const processedTop100 = data.top100.media.map((manga: any) => ({
        ...manga,
        title: {
          ...manga.title,
          userPreferred: manga.title.userPreferred || manga.title.romaji || manga.title.english || 'Unknown Title'
        },
        averageScore: manga.averageScore ? manga.averageScore / 10 : null
      }));

      setRecentlyUpdated(processedRecent);
      setLastYearManga(processedLastYear);
      setOneShots(processedOneShots);
      setLightNovels(processedLightNovels);
      setManhwa(processedManhwa);
      setManhua(processedManhua);
      setTaihua(processedTaihua);
      setTop100Manga(processedTop100);

    } catch (error: any) {
      console.error('Error fetching manga data:', error);
      console.error('Error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      });
      
      // Set empty arrays but don't throw - let the UI handle the empty state
      setTrendingManga([]);
      setRecentlyUpdated([]);
      setLastYearManga([]);
      setOneShots([]);
      setLightNovels([]);
      setManhwa([]);
      setManhua([]);
      setTaihua([]);
      setTop100Manga([]);
      setHeroManga(null);
    } finally {
      setLoading(false);
    }
  };

  const renderHeroItem = ({ item: manga }: { item: Manga }) => (
    <TouchableOpacity
      style={[styles.heroContainer, { width }]}
      onPress={() => router.push(`/manga/${manga.id}`)}
      activeOpacity={0.9}
    >
      <ExpoImage
        source={{ uri: manga.bannerImage || manga.coverImage.extraLarge }}
        style={styles.heroBanner}
        contentFit="cover"
        transition={1000}
      />
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.7)', 'rgba(0,0,0,0.95)']}
        locations={[0.3, 0.6, 1]}
        style={styles.heroGradient}
      >
        <View style={styles.heroContent}>
          <BlurView intensity={30} tint="dark" style={styles.heroMetaContainer}>
            <View style={styles.heroStats}>
              {manga.averageScore && (
                <View style={styles.heroStatItem}>
                  <FontAwesome5 name="star" size={14} color="#FFD700" solid />
                  <Text style={styles.heroStatText}>
                    {manga.averageScore.toFixed(1)}
                  </Text>
                </View>
              )}
              {manga.trending && (
                <View style={styles.heroStatItem}>
                  <FontAwesome5 name="fire-alt" size={14} color="#FF6B6B" solid />
                  <Text style={styles.heroStatText}>#{manga.trending}</Text>
                </View>
              )}
              <View style={styles.heroStatItem}>
                <FontAwesome5 name="book" size={14} color="#4CAF50" solid />
                <Text style={styles.heroStatText}>
                  {manga.chapters ? `${manga.chapters} Ch` : 'Ongoing'}
                </Text>
              </View>
            </View>
          </BlurView>

          <View style={styles.heroTitleContainer}>
            <Text style={styles.heroTitle} numberOfLines={2}>
              {manga.title.userPreferred}
            </Text>
            {manga.description && (
              <Text style={styles.heroDescription} numberOfLines={2}>
                {manga.description?.replace(/<[^>]*>/g, '')}
              </Text>
            )}
          </View>

          <TouchableOpacity
            style={styles.readNowButton}
            onPress={() => router.push(`/manga/${manga.id}`)}
          >
            <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} />
            <FontAwesome5 name="book-reader" size={16} color="#fff" />
            <Text style={styles.readNowText}>Read Now</Text>
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

  const renderPaginationDots = () => (
    <View style={styles.paginationContainer}>
      {trendingManga.slice(0, 5).map((_, index) => (
        <View
          key={index}
          style={[
            styles.paginationDot,
            index === activeHeroIndex && styles.paginationDotActive,
          ]}
        />
      ))}
    </View>
  );

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: currentTheme.colors.background }]}>
        <ActivityIndicator size="large" color="#02A9FF" />
        <Text style={[styles.loadingText, { color: currentTheme.colors.textSecondary }]}>Loading manga...</Text>
        <TouchableOpacity 
          style={[styles.retryButton, { backgroundColor: currentTheme.colors.primary }]}
          onPress={fetchData}
        >
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!heroManga && !loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: currentTheme.colors.background }]}>
        <FontAwesome5 name="exclamation-circle" size={48} color={currentTheme.colors.textSecondary} />
        <Text style={[styles.loadingText, { color: currentTheme.colors.textSecondary, marginTop: 16 }]}>
          Failed to load content
        </Text>
        <TouchableOpacity 
          style={[styles.retryButton, { backgroundColor: currentTheme.colors.primary, marginTop: 16 }]}
          onPress={fetchData}
        >
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <>
      <ScrollView style={[styles.container, { backgroundColor: currentTheme.colors.background }]} showsVerticalScrollIndicator={false}>
        <View style={styles.heroWrapper}>
          <FlatList
            ref={flatListRef}
            data={trendingManga.slice(0, 5)}
            renderItem={renderHeroItem}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(e) => {
              const newIndex = Math.round(e.nativeEvent.contentOffset.x / width);
              setActiveHeroIndex(newIndex);
            }}
          />
          {renderPaginationDots()}
        </View>

        {[
          { title: 'Trending Now', data: trendingManga },
          { title: 'Just Added Chapters', data: recentlyUpdated },
          { title: 'One-shots', data: oneShots },
          { title: 'Light Novels', data: lightNovels },
          { title: 'Manhwa', data: manhwa },
          { title: 'Donghua', data: manhua },
          { title: 'Manhua', data: taihua }
        ].map((section) => (
          <View key={section.title} style={styles.section}>
            <Text style={[styles.sectionTitle, { color: currentTheme.colors.text }]}>{section.title}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {section.data.map((manga) => (
                <TouchableOpacity
                  key={manga.id}
                  style={[styles.card, { 
                    backgroundColor: currentTheme.colors.surface,
                    shadowColor: isDarkMode ? '#000' : '#666'
                  }]}
                  onPress={() => router.push(`/manga/${manga.id}`)}
                >
                  <ExpoImage
                    source={{ uri: manga.coverImage.large }}
                    style={styles.cardImage}
                    contentFit="cover"
                  />
                  <Text style={[styles.cardTitle, { color: currentTheme.colors.text }]} numberOfLines={2}>
                    {manga.title.userPreferred}
                  </Text>
                  <View style={styles.cardRating}>
                    <FontAwesome5 
                      name={section.title === 'Just Added Chapters' ? 'book-reader' : 'star'} 
                      size={12} 
                      color={section.title === 'Just Added Chapters' ? currentTheme.colors.textSecondary : '#FFD700'} 
                    />
                    <Text style={[styles.ratingText, { color: currentTheme.colors.textSecondary }]}>
                      {section.title === 'Just Added Chapters' ? (manga.format || 'Manga') : 
                        manga.averageScore ? manga.averageScore.toFixed(1) : 'N/A'}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        ))}

        <View style={[styles.section, styles.lastSection]}>
          <Text style={[styles.sectionTitle, { color: currentTheme.colors.text }]}>Top 50</Text>
          <View style={styles.top100Container}>
            {top100Manga.map((manga, index) => (
              <TouchableOpacity 
                key={manga.id}
                style={[
                  styles.top100Card, 
                  { 
                    backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : '#fff',
                  }
                ]}
                onPress={() => router.push(`/manga/${manga.id}`)}
                activeOpacity={0.7}
              >
                <View style={styles.rankContainer}>
                  <Text style={[styles.rankNumber, { 
                    color: index < 3 ? '#02A9FF' : isDarkMode ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)',
                    fontSize: index < 3 ? 24 : 20,
                  }]}>#{index + 1}</Text>
                </View>
                
                <ExpoImage
                  source={{ uri: manga.coverImage.large }}
                  style={styles.top100Image}
                  contentFit="cover"
                  transition={500}
                />

                <View style={styles.top100Info}>
                  <Text style={[styles.top100Title, { 
                    color: currentTheme.colors.text,
                    fontSize: index < 3 ? 16 : 15,
                    fontWeight: index < 3 ? '800' : '600',
                  }]} numberOfLines={2}>
                    {manga.title.userPreferred}
                  </Text>

                  <View style={styles.top100Meta}>
                    <View style={[styles.scoreContainer, { 
                      backgroundColor: isDarkMode ? 'rgba(255, 215, 0, 0.15)' : '#FFF9E6'
                    }]}>
                      <FontAwesome5 name="star" size={12} color="#FFD700" solid />
                      <Text style={[styles.scoreText, { color: currentTheme.colors.text }]}>
                        {manga.averageScore.toFixed(1)}
                      </Text>
                    </View>

                    {manga.format && (
                      <View style={[styles.formatBadge, {
                        backgroundColor: isDarkMode ? 'rgba(2, 169, 255, 0.15)' : 'rgba(2, 169, 255, 0.1)'
                      }]}>
                        <Text style={[styles.formatText, { color: '#02A9FF' }]}>
                          {manga.format}
                        </Text>
                      </View>
                    )}

                    {manga.chapters && (
                      <View style={[styles.chapterBadge, {
                        backgroundColor: isDarkMode ? 'rgba(76, 175, 80, 0.15)' : 'rgba(76, 175, 80, 0.1)'
                      }]}>
                        <FontAwesome5 name="book" size={10} color="#4CAF50" />
                        <Text style={[styles.chapterText, { color: '#4CAF50' }]}>
                          {manga.chapters} CH
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>
      <MangaSearchGlobal 
        visible={showSearch} 
        onClose={() => setShowSearch(false)} 
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    paddingTop: 0,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroContainer: {
    width: '100%',
    height: height * 0.75,
    position: 'relative',
  },
  heroBanner: {
    width: '100%',
    height: '100%',
  },
  heroGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '80%',
    justifyContent: 'flex-end',
    padding: 24,
    paddingBottom: 48,
  },
  heroContent: {
    width: '100%',
    gap: 24,
  },
  heroMetaContainer: {
    alignSelf: 'flex-start',
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 8,
  },
  heroStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  heroStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  heroStatText: {
    fontSize: 15,
    color: '#fff',
    fontWeight: '700',
  },
  heroTitleContainer: {
    gap: 16,
  },
  heroTitle: {
    fontSize: 40,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -0.5,
    lineHeight: 48,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  heroDescription: {
    fontSize: 17,
    color: '#fff',
    opacity: 0.9,
    lineHeight: 26,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  readNowButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 18,
    borderRadius: 16,
    gap: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    marginTop: 8,
  },
  readNowText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 16,
    letterSpacing: -0.5,
  },
  card: {
    width: 160,
    marginRight: 16,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  cardImage: {
    width: '100%',
    height: 220,
    borderRadius: 16,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginTop: 12,
    marginBottom: 6,
    paddingHorizontal: 4,
    lineHeight: 20,
  },
  cardRating: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  ratingText: {
    fontSize: 13,
    marginLeft: 6,
    fontWeight: '600',
  },
  paginationContainer: {
    position: 'absolute',
    bottom: 24,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    zIndex: 2,
  },
  paginationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  paginationDotActive: {
    width: 24,
    backgroundColor: '#02A9FF',
  },
  heroWrapper: {
    position: 'relative',
  },
  lastSection: {
    marginBottom: Platform.OS === 'ios' ? 80 : 70,
  },
  top100Container: {
    marginTop: 16,
  },
  top100Card: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    borderRadius: 16,
    padding: 12,
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
  rankContainer: {
    width: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankNumber: {
    fontSize: 20,
    fontWeight: '800',
  },
  top100Image: {
    width: 70,
    height: 100,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
  },
  top100Info: {
    flex: 1,
    marginLeft: 16,
    gap: 8,
  },
  top100Title: {
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 20,
  },
  top100Meta: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  scoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  scoreText: {
    fontSize: 13,
    fontWeight: '600',
  },
  formatBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  formatText: {
    fontSize: 12,
    fontWeight: '600',
  },
  chapterBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  chapterText: {
    fontSize: 12,
    fontWeight: '600',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: '500',
  },
  progressBarContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    zIndex: 10,
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#02A9FF',
  },
  retryButton: {
    padding: 16,
    borderRadius: 8,
    backgroundColor: '#02A9FF',
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
}); 