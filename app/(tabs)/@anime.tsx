import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions, Platform, ActivityIndicator, FlatList, useWindowDimensions, Animated, DeviceEventEmitter } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { useRouter } from 'expo-router';
import { useState, useEffect, useRef } from 'react';
import { axios } from '../../services/api';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { FontAwesome5 } from '@expo/vector-icons';
import { getRatingColor, formatScore } from '../../utils/colors';
import { useTheme, lightTheme, darkTheme } from '../../hooks/useTheme';
import { useOrientation } from '../../hooks/useOrientation';
import { useSettings } from '../../hooks/useSettings';
import * as SecureStore from 'expo-secure-store';
import { STORAGE_KEY } from '../../constants/auth';
import PersonalizedRecommendations from '../../components/PersonalizedRecommendations';

// Use the correct AniList GraphQL endpoint
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
  bannerImage: string;
  description: string;
  episodes: number;
  duration?: number;
  averageScore: number;
  trending: number;
  popularity: number;
  status: string;
  format?: string;
  season?: string;
  seasonYear?: number;
  startDate?: {
    year: number;
    month: number;
    day: number;
  };
  nextAiringEpisode: {
    episode: number;
    timeUntilAiring: number;
  } | null;
}

interface AiringSchedule {
  id: number;
  airingAt: number;
  timeUntilAiring: number;
  episode: number;
  media: {
    id: number;
    title: {
      userPreferred: string;
      english: string;
      romaji: string;
      native: string;
    };
    coverImage: {
      large: string;
      color: string;
    };
    averageScore: number;
    status: string;
    format: string;
  };
}

interface ScheduleDay {
  date: string;
  dayName: string;
  isToday: boolean;
  schedules: AiringSchedule[];
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
  type?: 'CHARACTER';
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
  type?: 'STAFF';
}

interface CharacterEdge {
  node: Character;
}

interface StaffEdge {
  node: Staff;
}

const { width, height } = Dimensions.get('window');

export default function AnimeScreen() {
  const router = useRouter();
  const { isDarkMode } = useTheme();
  const { lockPortrait } = useOrientation();
  const { settings } = useSettings();
  const currentTheme = isDarkMode ? darkTheme : lightTheme;
  const [trendingAnime, setTrendingAnime] = useState<Anime[]>([]);
  const [airingSchedule, setAiringSchedule] = useState<ScheduleDay[]>([]);
  const [selectedDay, setSelectedDay] = useState(0);
  const [birthdays, setBirthdays] = useState<(Character | Staff)[]>([]);
  const [anticipatedUpcoming, setAnticipatedUpcoming] = useState<Anime[]>([]);
  const [loading, setLoading] = useState(true);
  const [heroAnime, setHeroAnime] = useState<Anime | null>(null);
  const [activeHeroIndex, setActiveHeroIndex] = useState(0);
  const { width: windowWidth } = useWindowDimensions();
  const flatListRef = useRef<FlatList>(null);
  const currentYear = new Date().getFullYear();
  const [animeMovies, setAnimeMovies] = useState<Anime[]>([]);
  const [musicVideos, setMusicVideos] = useState<Anime[]>([]);
  const [lastYearAnime, setLastYearAnime] = useState<Anime[]>([]);
  const [anticipatedAnime, setAnticipatedAnime] = useState<Anime[]>([]);
  const [popularAnime, setPopularAnime] = useState<Anime[]>([]);
  const [top100Anime, setTop100Anime] = useState<Anime[]>([]);
  const progressAnim = useRef(new Animated.Value(0)).current;
  const [showSearch, setShowSearch] = useState(false);
  const [userId, setUserId] = useState<number | undefined>(undefined);

  useEffect(() => {
    // Fetch data immediately without waiting for settings
    fetchData();
    
    // Get user ID for personalized recommendations
    const getUserId = async () => {
      try {
        const userIdStr = await SecureStore.getItemAsync(STORAGE_KEY.USER_ID);
        if (userIdStr) {
          setUserId(parseInt(userIdStr, 10));
        }
      } catch (error) {
        console.error('Error getting user ID:', error);
      }
    };
    
    getUserId();

    // Listen for search event
    const searchSubscription = DeviceEventEmitter.addListener('showSearch', () => {
      setShowSearch(true);
    });

    // Listen for genre search events
    const genreSearchListener = DeviceEventEmitter.addListener('openAnimeGenreSearch', (genre) => {
      console.log('[AnimeScreen] Received openAnimeGenreSearch event for:', genre);
      setShowSearch(true);
    });

    return () => {
      searchSubscription.remove();
      genreSearchListener.remove();
    };
  }, []);

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
      if (trendingAnime.length > 0) {
        const nextIndex = (activeHeroIndex + 1) % Math.min(trendingAnime.length, 5);
        flatListRef.current?.scrollToIndex({
          index: nextIndex,
          animated: true
        });
        setActiveHeroIndex(nextIndex);
        startAnimations();
      }
    }, 60000);

    return () => clearInterval(timer);
  }, [activeHeroIndex, trendingAnime]);

  useEffect(() => {
    lockPortrait();
  }, [lockPortrait]);

  // Reset selected day to today (index 0) when airing schedule updates
  useEffect(() => {
    if (airingSchedule.length > 0) {
      setSelectedDay(0);
    }
  }, [airingSchedule]);

  const fetchData = async () => {
    try {
      setLoading(true);
      // Use a default value for adult content if settings is not available
      const showAdultContent = settings?.displayAdultContent || false;
      console.log('Fetching anime data with adult content:', showAdultContent);

      const date = new Date();
      const month = date.getMonth() + 1;
      let season = 'WINTER';
      if (month >= 4 && month <= 6) season = 'SPRING';
      else if (month >= 7 && month <= 9) season = 'SUMMER';
      else if (month >= 10 && month <= 12) season = 'FALL';
      const year = date.getFullYear();

      // Try to get token but don't require it
      const token = await SecureStore.getItemAsync(STORAGE_KEY.AUTH_TOKEN);
      console.log('Token available:', !!token);

      const query = `
        query ($season: MediaSeason, $seasonYear: Int, $lastYear: Int, $isAdult: Boolean) {
          trending: Page(page: 1, perPage: 5) {
            media(sort: TRENDING_DESC, type: ANIME, isAdult: $isAdult) {
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
              episodes
              averageScore
              trending
              popularity
              status
              nextAiringEpisode {
                episode
                timeUntilAiring
              }
            }
          }
          airingSchedule: Page(page: 1, perPage: 100) {
            airingSchedules(airingAt_greater: ${Math.floor(Date.now() / 1000) - (24 * 60 * 60)}, airingAt_lesser: ${Math.floor(Date.now() / 1000) + (8 * 24 * 60 * 60)}) {
              id
              airingAt
              timeUntilAiring
              episode
              media {
                id
                title {
                  userPreferred
                  english
                  romaji
                  native
                }
                coverImage {
                  large
                  color
                }
                averageScore
                status
                format
                type
                isAdult
                genres
              }
            }
          }
          anticipated: Page(page: 1, perPage: 10) {
            media(sort: POPULARITY_DESC, type: ANIME, season: $season, seasonYear: $seasonYear, status_in: [NOT_YET_RELEASED, RELEASING], isAdult: $isAdult) {
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
              episodes
              averageScore
              status
              startDate {
                year
                month
                day
              }
            }
          }
          popular: Page(page: 1, perPage: 10) {
            media(sort: TRENDING_DESC, type: ANIME, status: RELEASING, isAdult: $isAdult) {
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
              episodes
              averageScore
              popularity
            }
          }
          lastYear: Page(page: 1, perPage: 10) {
            media(sort: POPULARITY_DESC, type: ANIME, seasonYear: $lastYear, isAdult: $isAdult) {
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
              popularity
              format
            }
          }
          movies: Page(page: 1, perPage: 10) {
            media(sort: POPULARITY_DESC, type: ANIME, format: MOVIE, status: FINISHED, isAdult: $isAdult) {
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
              startDate {
                year
              }
            }
          }
          musicVideos: Page(page: 1, perPage: 10) {
            media(sort: POPULARITY_DESC, type: ANIME, format: MUSIC, isAdult: $isAdult) {
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
              duration
            }
          }
          birthdayCharacters: Page(page: 1, perPage: 25) {
            characters(sort: FAVOURITES_DESC, isBirthday: true) {
              id
              name {
                userPreferred
                first
                middle
                last
                full
                native
              }
              image {
                medium
              }
              dateOfBirth {
                month
                day
              }
              favourites
            }
          }
          birthdayStaff: Page(page: 1, perPage: 25) {
            staff(sort: FAVOURITES_DESC, isBirthday: true) {
              id
              name {
                userPreferred
                first
                middle
                last
                full
                native
              }
              image {
                medium
              }
              dateOfBirth {
                month
                day
              }
              favourites
            }
          }
          top100: Page(page: 1, perPage: 100) {
            media(sort: SCORE_DESC, type: ANIME, isAdult: $isAdult) {
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
              averageScore
              format
              episodes
              season
              seasonYear
            }
          }
          anticipatedUpcoming: Page(page: 1, perPage: 15) {
            media(sort: POPULARITY_DESC, type: ANIME, status: NOT_YET_RELEASED, isAdult: $isAdult) {
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
              episodes
              averageScore
              popularity
              status
              startDate {
                year
                month
                day
              }
              season
              seasonYear
            }
          }
        }
      `;

      const response = await axios.post(
        ANILIST_API,
        {
          query,
          variables: {
            season,
            seasonYear: year,
            lastYear: year - 1,
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

      const userTitleLanguage = data.Viewer?.options?.titleLanguage?.toLowerCase() || 'romaji';
      const userStaffNameLanguage = data.Viewer?.options?.staffNameLanguage?.toLowerCase() || 'romaji';
      const userScoreFormat = data.Viewer?.mediaListOptions?.scoreFormat || 'POINT_10';

      const formatTitle = (titles: any) => {
        return titles[userTitleLanguage] || titles.romaji;
      };

      const formatName = (names: any) => {
        if (userStaffNameLanguage === 'native' && names.native) {
          return names.native;
        }
        return names.userPreferred || `${names.first || ''} ${names.last || ''}`.trim();
      };

      const formatScore = (score: number) => {
        switch (userScoreFormat) {
          case 'POINT_100':
            return score;
          case 'POINT_10_DECIMAL':
            return score / 10;
          case 'POINT_10':
            return Math.round(score / 10);
          case 'POINT_5':
            return Math.round(score / 20);
          case 'POINT_3':
            return Math.round(score / 33.33);
          default:
            return score / 10;
        }
      };

      // Process trending anime even if other data is missing
      const processedTrending = (data.trending?.media || []).map((anime: any) => ({
        ...anime,
        title: {
          ...anime.title,
          userPreferred: anime.title.userPreferred || anime.title.romaji || anime.title.english || 'Unknown Title'
        },
        averageScore: anime.averageScore ? anime.averageScore / 10 : 0,
        description: anime.description || '',
        bannerImage: anime.bannerImage || anime.coverImage?.extraLarge || anime.coverImage?.large,
        episodes: anime.episodes || null,
        trending: anime.trending || null
      }));

      if (processedTrending.length > 0) {
        console.log('Successfully processed trending anime:', processedTrending.length);
        setTrendingAnime(processedTrending);
        setHeroAnime(processedTrending[0]);
      } else {
        console.warn('No trending anime data available');
      }

      // Process airing schedule
      const airingSchedules = data.airingSchedule?.airingSchedules || [];
      console.log('Airing schedules count:', airingSchedules.length);
      
      // Filter out null media, anime only, adult content, and organize by date
      const validSchedules = airingSchedules.filter((schedule: any) => {
        if (!schedule.media || 
            schedule.media.type !== 'ANIME' || 
            schedule.media.status !== 'RELEASING') {
          return false;
        }

        // Filter out explicitly adult content
        if (schedule.media.isAdult) {
          return false;
        }

        // Filter out by NSFW genres (only Hentai, not Ecchi since many mainstream anime have this)
        if (schedule.media.genres && schedule.media.genres.some((genre: string) => 
          ['Hentai'].includes(genre))) {
          return false;
        }

        // Filter out by explicit NSFW keywords in title
        const title = (schedule.media.title.english || schedule.media.title.userPreferred || schedule.media.title.romaji || '').toLowerCase();
        const nsfwKeywords = ['hentai'];
        if (nsfwKeywords.some(keyword => title.includes(keyword))) {
          return false;
        }

        return true;
      });
      console.log('Valid anime schedules count:', validSchedules.length);
      
      // Debug: Log schedules by day to see what we're getting
      const scheduleDays = organizeSchedulesByDate(validSchedules);
      scheduleDays.forEach((day, index) => {
        console.log(`Day ${index} (${day.dayName} ${day.date}): ${day.schedules.length} episodes`);
        if (day.schedules.length > 0) {
          day.schedules.forEach(schedule => {
            const airingDate = new Date(schedule.airingAt * 1000);
            console.log(`  - ${schedule.media.title.userPreferred} at ${airingDate.toLocaleString()}`);
          });
        }
      });
      
      setAiringSchedule(scheduleDays);

      const anticipatedData = data.anticipatedUpcoming?.media || [];
      console.log('Anticipated Upcoming anime count:', anticipatedData.length);
      const processedAnticipated = anticipatedData.map((anime: any) => ({
        ...anime,
        title: {
          ...anime.title,
          userPreferred: formatTitle(anime.title)
        },
        averageScore: formatScore(anime.averageScore)
      }));
      setAnticipatedUpcoming(processedAnticipated);

      const characters = data.birthdayCharacters?.characters || [];
      const staffMembers = data.birthdayStaff?.staff || [];
      console.log('Found birthday characters:', characters.length, 'birthday staff:', staffMembers.length);

      // Add type property to distinguish between character and staff
      const processedCharacters = characters.map((character: Character) => {
        return {
          ...character,
          type: 'CHARACTER' as const
        };
      });
      
      const processedStaff = staffMembers.map((staff: Staff) => {
        return {
          ...staff,
          type: 'STAFF' as const
        };
      });

      const todayBirthdays = [
        ...processedCharacters,
        ...processedStaff
      ].sort((a, b) => (b.favourites || 0) - (a.favourites || 0));

      console.log('Today\'s birthdays:', todayBirthdays.length);
      setBirthdays(todayBirthdays);

      const processedMovies = data.movies?.media.map((anime: any) => ({
        ...anime,
        title: {
          ...anime.title,
          userPreferred: formatTitle(anime.title)
        },
        averageScore: formatScore(anime.averageScore)
      })) || [];

      const mvs = data.musicVideos?.media || [];
      console.log('Music videos count:', mvs.length);
      const processedMusicVideos = mvs.map((anime: any) => ({
        ...anime,
        title: {
          ...anime.title,
          userPreferred: formatTitle(anime.title)
        },
        averageScore: formatScore(anime.averageScore)
      }));

      const processedLastYear = data.lastYear?.media.map((anime: any) => ({
        ...anime,
        title: {
          ...anime.title,
          userPreferred: formatTitle(anime.title)
        },
        averageScore: formatScore(anime.averageScore)
      })) || [];

      const processedAnticipatedOld = data.anticipated?.media.map((anime: any) => ({
        ...anime,
        title: {
          ...anime.title,
          userPreferred: formatTitle(anime.title)
        },
        averageScore: formatScore(anime.averageScore)
      })) || [];

      const processedPopular = data.popular?.media.map((anime: any) => ({
        ...anime,
        title: {
          ...anime.title,
          userPreferred: formatTitle(anime.title)
        },
        averageScore: formatScore(anime.averageScore)
      })) || [];

      const top100 = data.top100?.media || [];
      console.log('Top 100 anime count:', top100.length);
      const processedTop100 = top100.map((anime: any) => ({
        ...anime,
        title: {
          ...anime.title,
          userPreferred: formatTitle(anime.title)
        },
        averageScore: formatScore(anime.averageScore)
      }));

      setBirthdays(todayBirthdays);
      setAnimeMovies(processedMovies);
      setMusicVideos(processedMusicVideos);
      setLastYearAnime(processedLastYear);
      setAnticipatedAnime(processedAnticipatedOld);
      setPopularAnime(processedPopular);
      setTop100Anime(processedTop100);
      
    } catch (error: any) {
      console.error('Error fetching data:', error);
      console.error('Error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      });
      
      // Set empty arrays but don't throw - let the UI handle the empty state
      setTrendingAnime([]);
      setAiringSchedule([]);
      setBirthdays([]);
      setAnticipatedUpcoming([]);
      setHeroAnime(null);
    } finally {
      setLoading(false);
    }
  };

  const organizeSchedulesByDate = (schedules: any[]): ScheduleDay[] => {
    const today = new Date();
    const days: ScheduleDay[] = [];
    
    // Create 7 days starting from today using clean UTC date strings
    for (let i = 0; i < 7; i++) {
      // Generate UTC date key for this day
      const dateKey = new Date(today.getTime() + i * 86400000).toISOString().split('T')[0];
      
      // Filter schedules that match this UTC date
      const daySchedules = schedules.filter(schedule => {
        const airingDateKey = new Date(schedule.airingAt * 1000).toISOString().split('T')[0];
        return airingDateKey === dateKey;
      }).sort((a, b) => a.airingAt - b.airingAt);

      // Create display date for the day name (still use local time for display)
      const displayDate = new Date(today.getTime() + i * 86400000);
      
      days.push({
        date: dateKey,
        dayName: displayDate.toLocaleDateString('en-US', { weekday: 'short' }),
        isToday: i === 0,
        schedules: daySchedules
      });
    }
    
    return days;
  };

  const formatAiringTime = (airingAt: number) => {
    const airingDate = new Date(airingAt * 1000);
    const now = new Date();
    
    const timeDiff = airingDate.getTime() - now.getTime();
    const minutesDiff = Math.abs(timeDiff) / (1000 * 60);
    const hoursDiff = Math.abs(timeDiff) / (1000 * 60 * 60);
    
    // Currently airing (±15 minutes window)
    if (minutesDiff <= 15) {
      return 'AIRING NOW';
    }
    
    // Just aired (15-60 minutes ago)
    if (timeDiff < 0 && minutesDiff <= 60) {
      if (minutesDiff < 60) {
        return 'JUST AIRED';
      }
    }
    
    // Aired recently (1-24 hours ago)
    if (timeDiff < 0 && hoursDiff <= 24) {
      const hours = Math.floor(hoursDiff);
      return `AIRED ${hours}H AGO`;
    }
    
    // Aired more than 24 hours ago
    if (timeDiff < -24 * 60 * 60 * 1000) {
      const days = Math.floor(hoursDiff / 24);
      return `AIRED ${days}D AGO`;
    }
    
    // Upcoming episodes - show the actual time
    return airingDate.toLocaleTimeString([], { 
      hour: 'numeric', 
      minute: '2-digit'
    });
  };

  const getAiringStatus = (airingAt: number) => {
    const airingDate = new Date(airingAt * 1000);
    const now = new Date();
    const timeDiff = airingDate.getTime() - now.getTime();
    const minutesDiff = Math.abs(timeDiff) / (1000 * 60);
    
    // Currently airing (±15 minutes)
    if (minutesDiff <= 15) {
      return 'airing';
    } 
    // Just aired or recently aired (up to 1 hour)
    else if (timeDiff < 0 && minutesDiff <= 60) {
      return 'just-aired';
    }
    // Aired (more than 1 hour ago)
    else if (timeDiff < -60 * 60 * 1000) {
      return 'aired';
    } 
    // Upcoming
    else {
      return 'upcoming';
    }
  };

  const isAiringNow = (airingAt: number) => {
    return getAiringStatus(airingAt) === 'airing';
  };



  const renderHeroItem = ({ item: anime }: { item: Anime }) => {
    // Safety checks for required data
    if (!anime || !anime.id) {
      return null;
    }

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
                    <FontAwesome5 name="fire-alt" size={12} color="#FF6B6B" solid />
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
      {trendingAnime.slice(0, 5).map((_, index) => (
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
        <Text style={[styles.loadingText, { color: currentTheme.colors.textSecondary }]}>Loading anime...</Text>
        <TouchableOpacity 
          style={[styles.retryButton, { backgroundColor: currentTheme.colors.primary }]}
          onPress={fetchData}
        >
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!heroAnime && !loading) {
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
            data={trendingAnime.slice(0, 5)}
            renderItem={renderHeroItem}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(event) => {
              const newIndex = Math.round(
                event.nativeEvent.contentOffset.x / width
              );
              setActiveHeroIndex(newIndex);
            }}
            decelerationRate="fast"
            snapToInterval={width}
            snapToAlignment="start"
          />
          {renderPaginationDots()}
        </View>
        
        {/* Personalized Recommendations Section */}
        {userId && (
          <View style={styles.section}>
            <PersonalizedRecommendations userId={userId} showAdultContent={settings?.displayAdultContent || false} />
          </View>
        )}

        {/* Airing Schedule Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={[styles.sectionTitle, { color: currentTheme.colors.text }]}>Airing Schedule</Text>
            </View>
            {/* Compact Day Selector */}
            <View style={[styles.dayDropdown, { backgroundColor: currentTheme.colors.surface }]}>
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.compactDaySelector}
              >
                {airingSchedule.map((day, index) => (
                  <TouchableOpacity
                    key={day.date}
                    style={[
                      styles.compactDayButton,
                      { backgroundColor: selectedDay === index ? currentTheme.colors.primary : 'transparent' }
                    ]}
                    onPress={() => setSelectedDay(index)}
                    activeOpacity={0.7}
                  >
                    <Text style={[
                      styles.compactDayText,
                      { color: selectedDay === index ? '#fff' : currentTheme.colors.text }
                    ]}>
                      {day.dayName} {new Date(day.date).getDate()}
                    </Text>
                    {day.schedules.length > 0 && (
                      <View style={[
                        styles.compactDayBadge,
                        { backgroundColor: selectedDay === index ? '#fff' : currentTheme.colors.primary }
                      ]}>
                        <Text style={[
                          styles.compactDayBadgeText,
                          { color: selectedDay === index ? currentTheme.colors.primary : '#fff' }
                        ]}>
                          {day.schedules.length}
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>

          {/* Horizontal Schedule list */}
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {airingSchedule[selectedDay]?.schedules.length > 0 ? (
              airingSchedule[selectedDay].schedules.map((schedule) => (
                <TouchableOpacity 
                  key={schedule.id}
                  style={[
                    styles.horizontalScheduleCard, 
                    { 
                      backgroundColor: currentTheme.colors.surface,
                      shadowColor: isDarkMode ? '#000' : '#666',
                      opacity: getAiringStatus(schedule.airingAt) === 'aired' ? 0.7 : 
                               getAiringStatus(schedule.airingAt) === 'just-aired' ? 0.9 : 1.0
                    }
                  ]}
                  onPress={() => router.push(`/anime/${schedule.media.id}`)}
                  activeOpacity={0.7}
                >
                  <ExpoImage
                    source={{ uri: schedule.media.coverImage.large }}
                    style={[
                      styles.horizontalScheduleImage,
                      getAiringStatus(schedule.airingAt) === 'aired' && { opacity: 0.8 },
                      getAiringStatus(schedule.airingAt) === 'just-aired' && { opacity: 0.95 }
                    ]}
                    contentFit="cover"
                    transition={300}
                  />
                  
                  <View style={styles.horizontalScheduleInfo}>
                    <View style={styles.horizontalScheduleTime}>
                      <Text style={[
                        styles.horizontalTimeText, 
                        { 
                          color: getAiringStatus(schedule.airingAt) === 'airing' ? '#4CAF50' : 
                                 getAiringStatus(schedule.airingAt) === 'just-aired' ? '#FF9800' : 
                                 getAiringStatus(schedule.airingAt) === 'aired' ? '#9E9E9E' : 
                                 currentTheme.colors.primary 
                        }
                      ]}>
                        {formatAiringTime(schedule.airingAt)}
                      </Text>
                      {getAiringStatus(schedule.airingAt) === 'aired' && (
                        <Text style={[styles.horizontalOriginalTime, { color: currentTheme.colors.textSecondary }]}>
                          {new Date(schedule.airingAt * 1000).toLocaleTimeString([], { 
                            hour: 'numeric', 
                            minute: '2-digit'
                          })}
                        </Text>
                      )}
                      <Text style={[styles.horizontalEpisodeText, { color: currentTheme.colors.textSecondary }]}>
                        Ep {schedule.episode}
                      </Text>
                    </View>
                    
                    <Text style={[styles.horizontalScheduleTitle, { color: currentTheme.colors.text }]} numberOfLines={2}>
                      {schedule.media.title.english || schedule.media.title.userPreferred || schedule.media.title.romaji}
                    </Text>
                    
                    <View style={styles.horizontalScheduleMeta}>
                      {schedule.media.averageScore > 0 && (
                        <View style={styles.horizontalScoreContainer}>
                          <FontAwesome5 name="star" size={10} color="#FFD700" solid />
                          <Text style={[styles.horizontalScoreText, { color: currentTheme.colors.textSecondary }]}>
                            {(schedule.media.averageScore / 10).toFixed(1)}
                          </Text>
                        </View>
                      )}
                      <View style={[styles.horizontalFormatBadge, { backgroundColor: currentTheme.colors.primary + '20' }]}>
                        <Text style={[styles.horizontalFormatText, { color: currentTheme.colors.primary }]}>
                          {schedule.media.format}
                        </Text>
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
              ))
            ) : (
              <View style={[styles.horizontalNoSchedule, { backgroundColor: currentTheme.colors.surface }]}>
                <FontAwesome5 name="calendar-times" size={24} color={currentTheme.colors.textSecondary} />
                <Text style={[styles.horizontalNoScheduleText, { color: currentTheme.colors.textSecondary }]}>
                  No episodes airing this day
                </Text>
              </View>
            )}
          </ScrollView>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={[styles.sectionTitle, { color: currentTheme.colors.text }]}>Happy Birthday</Text>
              <Text style={[styles.sectionSubtitle, { color: currentTheme.colors.textSecondary }]}>
                {new Date().toLocaleDateString('en-US', { 
                  month: 'long',
                  day: 'numeric'
                })}
              </Text>
            </View>
          </View>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {birthdays.map((person) => (
              <TouchableOpacity 
                key={person.id} 
                style={styles.birthdayCard}
                onPress={() => router.push(`/${person.type === 'CHARACTER' ? 'character' : 'staff'}/${person.id}`)}
                activeOpacity={0.7}
              >
                <ExpoImage
                  source={{ uri: person.image.medium }}
                  style={styles.birthdayImage}
                  contentFit="cover"
                  transition={500}
                />
                <Text style={[styles.birthdayName, { color: currentTheme.colors.text }]} numberOfLines={2}>
                  {person.name.userPreferred}
                </Text>
              </TouchableOpacity>
            ))}
            {birthdays.length === 0 && (
              <View style={[styles.noBirthdays, { backgroundColor: currentTheme.colors.surface }]}>
                <FontAwesome5 name="birthday-cake" size={24} color={currentTheme.colors.textSecondary} />
                <Text style={[styles.noBirthdaysText, { color: currentTheme.colors.textSecondary }]}>No birthdays today</Text>
              </View>
            )}
          </ScrollView>
        </View>

        {[
          { title: 'Anticipated Anime', subtitle: 'Upcoming releases to watch for', data: anticipatedUpcoming, category: 'anticipated' },
          { title: 'New and Popular', subtitle: 'Trending this week', data: popularAnime, category: 'popular' },
          { title: `Best of ${currentYear - 1}`, data: lastYearAnime, category: 'lastYear' },
          { title: 'Anime Movies', subtitle: 'Popular theatrical releases', data: animeMovies, category: 'movies' },
          { title: 'Music Videos', subtitle: 'Anime music & performances', data: musicVideos, category: 'musicVideos' }
        ].map((section, index) => (
          <View key={section.title} style={[styles.section, index === 4 && styles.lastSection]}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={[styles.sectionTitle, { color: currentTheme.colors.text }]}>{section.title}</Text>
                {section.subtitle && (
                  <Text style={[styles.sectionSubtitle, { color: currentTheme.colors.textSecondary }]}>{section.subtitle}</Text>
                )}
              </View>
            </View>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.scrollContent}
            >
              {section.data.map((anime) => (
                <TouchableOpacity 
                  key={anime.id}
                  style={[styles.animeCard, { 
                    backgroundColor: currentTheme.colors.surface,
                    shadowColor: isDarkMode ? '#000' : '#666'
                  }]}
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
                      {section.title === 'Music Videos' ? (
                        <>
                          <FontAwesome5 name="clock" size={10} color={currentTheme.colors.textSecondary} solid />
                          <Text style={[styles.scoreText, { color: currentTheme.colors.textSecondary }]}>
                            {anime.duration} min
                          </Text>
                        </>
                      ) : section.title === 'Anticipated Anime' && anime.startDate ? (
                        <>
                          <FontAwesome5 name="calendar" size={10} color="#FF9800" solid />
                          <Text style={[styles.scoreText, { color: currentTheme.colors.textSecondary }]}>
                            {anime.startDate.month}/{anime.startDate.year}
                          </Text>
                        </>
                      ) : (
                        <>
                          <FontAwesome5 name="star" size={10} color="#FFD700" solid />
                          <Text style={[styles.scoreText, { color: currentTheme.colors.textSecondary }]}>
                            {formatScore(anime.averageScore)}
                          </Text>
                        </>
                      )}
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
              {/* See More Button */}
              <TouchableOpacity
                style={[styles.seeMoreCard, { backgroundColor: currentTheme.colors.surface }]}
                onPress={() => router.push(`/anime-list?category=${section.category}&title=${encodeURIComponent(section.title)}`)}
                activeOpacity={0.7}
              >
                <View style={styles.seeMoreContent}>
                  <FontAwesome5 name="plus" size={24} color={currentTheme.colors.primary} />
                  <Text style={[styles.seeMoreCardText, { color: currentTheme.colors.primary }]}>See More</Text>
                </View>
              </TouchableOpacity>
            </ScrollView>
          </View>
        ))}

        <View style={[styles.section, styles.lastSection]}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: currentTheme.colors.text }]}>Top 50</Text>
            <TouchableOpacity
              style={[styles.seeMoreButton, { backgroundColor: currentTheme.colors.primary + '20' }]}
              onPress={() => router.push(`/anime-list?category=top100&title=${encodeURIComponent('Top 100 Anime')}`)}
              activeOpacity={0.7}
            >
              <Text style={[styles.seeMoreText, { color: currentTheme.colors.primary }]}>See All</Text>
              <FontAwesome5 name="chevron-right" size={12} color={currentTheme.colors.primary} />
            </TouchableOpacity>
          </View>
          <View style={styles.top100Container}>
            {top100Anime.map((anime, index) => (
              <TouchableOpacity 
                key={anime.id}
                style={[
                  styles.top100Card, 
                  { 
                    backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : '#fff',
                  }
                ]}
                onPress={() => router.push(`/anime/${anime.id}`)}
                activeOpacity={0.7}
              >
                <View style={styles.rankContainer}>
                  <Text style={[styles.rankNumber, { 
                    color: index < 3 ? '#02A9FF' : isDarkMode ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)',
                    fontSize: index < 3 ? 24 : 20,
                  }]}>#{index + 1}</Text>
                </View>
                
                <ExpoImage
                  source={{ uri: anime.coverImage.large }}
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
                    {anime.title.english || anime.title.userPreferred}
                  </Text>

                  <View style={styles.top100Meta}>
                    <View style={[styles.top100ScoreContainer, { 
                      backgroundColor: isDarkMode ? 'rgba(255, 215, 0, 0.15)' : '#FFF9E6'
                    }]}>
                      <FontAwesome5 name="star" size={12} color="#FFD700" solid />
                      <Text style={[styles.top100ScoreText, { color: currentTheme.colors.text }]}>
                        {anime.averageScore.toFixed(1)}
                      </Text>
                    </View>

                    {anime.format && (
                      <View style={[styles.formatBadge, {
                        backgroundColor: isDarkMode ? 'rgba(2, 169, 255, 0.15)' : 'rgba(2, 169, 255, 0.1)'
                      }]}>
                        <Text style={[styles.formatText, { color: '#02A9FF' }]}>
                          {anime.format}
                        </Text>
                      </View>
                    )}

                    {anime.episodes && (
                      <View style={[styles.episodeBadge, {
                        backgroundColor: isDarkMode ? 'rgba(76, 175, 80, 0.15)' : 'rgba(76, 175, 80, 0.1)'
                      }]}>
                        <FontAwesome5 name="tv" size={10} color="#4CAF50" />
                        <Text style={[styles.episodeText, { color: '#4CAF50' }]}>
                          {anime.episodes} EP
                        </Text>
                      </View>
                    )}

                    {anime.season && (
                      <View style={[styles.seasonBadge, {
                        backgroundColor: isDarkMode ? 'rgba(156, 39, 176, 0.15)' : 'rgba(156, 39, 176, 0.1)'
                      }]}>
                        <FontAwesome5 name="calendar" size={10} color="#9C27B0" />
                        <Text style={[styles.seasonText, { color: '#9C27B0' }]}>
                          {anime.season.charAt(0) + anime.season.slice(1).toLowerCase()} {anime.seasonYear}
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
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 20,
    paddingBottom: 20,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoText: {
    fontSize: 24,
    fontWeight: '800',
    color: '#02A9FF',
    letterSpacing: -0.5,
  },
  searchButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
  },
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
  section: {
    paddingHorizontal: 20,
    marginBottom: 40,
  },
  lastSection: {
    paddingBottom: Platform.OS === 'ios' ? 100 : 80,
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
  birthdayCard: {
    width: 100,
    marginRight: 15,
    alignItems: 'center',
  },
  birthdayImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginBottom: 8,
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
  birthdayName: {
    fontSize: 13,
    color: '#333',
    textAlign: 'center',
    fontWeight: '500',
    lineHeight: 18,
  },
  noBirthdays: {
    width: width - 40,
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f8f8',
    borderRadius: 12,
    gap: 8,
  },
  noBirthdaysText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
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
  top100ScoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  top100ScoreText: {
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
  episodeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  episodeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  seasonBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  seasonText: {
    fontSize: 12,
    fontWeight: '600',
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
  retryButton: {
    padding: 16,
    borderRadius: 8,
    backgroundColor: '#02A9FF',
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  dayDropdown: {
    borderRadius: 12,
    paddingHorizontal: 4,
    paddingVertical: 4,
    marginLeft: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  compactDaySelector: {
    gap: 4,
  },
  compactDayButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 6,
  },
  compactDayText: {
    fontSize: 12,
    fontWeight: '600',
  },
  compactDayBadge: {
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  compactDayBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  horizontalScheduleCard: {
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
  horizontalScheduleImage: {
    width: '100%',
    height: 220,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  horizontalScheduleInfo: {
    padding: 12,
    gap: 6,
  },
  horizontalScheduleTime: {
    alignItems: 'center',
    marginBottom: 2,
  },
  horizontalTimeText: {
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 2,
  },
  horizontalOriginalTime: {
    fontSize: 10,
    fontWeight: '500',
    opacity: 0.7,
  },
  horizontalEpisodeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  horizontalScheduleTitle: {
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
    textAlign: 'center',
  },
  horizontalScheduleMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 2,
  },
  horizontalScoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
  },
  horizontalScoreText: {
    fontSize: 10,
    fontWeight: '600',
  },
  horizontalFormatBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  horizontalFormatText: {
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  horizontalNoSchedule: {
    width: width - 40,
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 16,
    gap: 8,
  },
  horizontalNoScheduleText: {
    fontSize: 14,
    fontWeight: '500',
  },
  seeMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  seeMoreText: {
    fontSize: 12,
    fontWeight: '600',
  },
  seeMoreCard: {
    width: 160,
    marginRight: 16,
    borderRadius: 16,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: 'rgba(2, 169, 255, 0.3)',
    height: 280, // Same total height as animeCard (220 image + 60 info)
  },
  seeMoreContent: {
    alignItems: 'center',
    gap: 8,
  },
  seeMoreCardText: {
    fontSize: 14,
    fontWeight: '600',
  },
});