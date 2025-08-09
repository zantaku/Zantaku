import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions, Platform, ActivityIndicator, FlatList, useWindowDimensions, Animated, DeviceEventEmitter, RefreshControl } from 'react-native';
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
  const [refreshing, setRefreshing] = useState(false);
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
  
  // Loading states
  const [sectionsLoaded, setSectionsLoaded] = useState({
    hero: false,
    schedule: false,
    birthdays: false,
    sections: false,
    top100: false
  });

  useEffect(() => {
    // Fetch critical data immediately
    fetchCriticalData();
    
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

  // Load all data after hero is loaded
  useEffect(() => {
    if (sectionsLoaded.hero && !sectionsLoaded.schedule) {
      setSectionsLoaded(prev => ({ ...prev, schedule: true }));
      fetchAiringSchedule();
    }
    
    if (sectionsLoaded.hero && !sectionsLoaded.birthdays) {
      setSectionsLoaded(prev => ({ ...prev, birthdays: true }));
      fetchBirthdays();
    }
    
    if (sectionsLoaded.hero && !sectionsLoaded.sections) {
      setSectionsLoaded(prev => ({ ...prev, sections: true }));
      fetchSectionData();
    }
    
    if (sectionsLoaded.hero && !sectionsLoaded.top100) {
      setSectionsLoaded(prev => ({ ...prev, top100: true }));
      fetchTop100Data();
    }
  }, [sectionsLoaded.hero]);

  // Fetch critical data (hero + basic info)
  const fetchCriticalData = async () => {
    try {
      setLoading(true);
      const showAdultContent = settings?.displayAdultContent || false;
      
      const token = await SecureStore.getItemAsync(STORAGE_KEY.AUTH_TOKEN);
      
      // Only fetch trending anime initially for hero section
      const criticalQuery = `
        query ($isAdult: Boolean) {
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
        }
      `;

      const response = await axios.post(
        ANILIST_API,
        {
          query: criticalQuery,
          variables: { isAdult: showAdultContent }
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
          },
          timeout: 15000
        }
      );

      if (response.data?.data?.trending?.media) {
        const processedTrending = response.data.data.trending.media.map((anime: any) => ({
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

        setTrendingAnime(processedTrending);
        setHeroAnime(processedTrending[0]);
        setSectionsLoaded(prev => ({ ...prev, hero: true }));
      }
    } catch (error) {
      console.error('Error fetching critical data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch airing schedule separately
  const fetchAiringSchedule = async () => {
    console.log('[AiringSchedule] Starting fetch...');
    try {
      const showAdultContent = settings?.displayAdultContent || false;
      const token = await SecureStore.getItemAsync(STORAGE_KEY.AUTH_TOKEN);
      
      console.log('[AiringSchedule] Settings:', { showAdultContent, hasToken: !!token });
      
      const airingStart = Math.floor(Date.now() / 1000) - 24 * 60 * 60; // yesterday
      const airingEnd = Math.floor(Date.now() / 1000) + 14 * 24 * 60 * 60; // next 14 days
      
      console.log('[AiringSchedule] Time range:', { 
        airingStart, 
        airingEnd, 
        airingStartDate: new Date(airingStart * 1000).toISOString(),
        airingEndDate: new Date(airingEnd * 1000).toISOString()
      });
      
      const scheduleQuery = `
        query ($airingStart: Int, $airingEnd: Int) {
          Page(page: 1, perPage: 100) {
            airingSchedules(airingAt_greater: $airingStart, airingAt_lesser: $airingEnd) {
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
        }
      `;
      
      console.log('[AiringSchedule] Query:', scheduleQuery);
      console.log('[AiringSchedule] Variables:', { airingStart, airingEnd });

      console.log('[AiringSchedule] Making API request to:', ANILIST_API);
      
      const requestBody = {
        query: scheduleQuery,
        variables: { 
          airingStart,
          airingEnd
        }
      };
      
      console.log('[AiringSchedule] Request body:', JSON.stringify(requestBody, null, 2));
      
      const response = await axios.post(
        ANILIST_API,
        requestBody,
        {
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
          },
          timeout: 15000
        }
      );
      
      console.log('[AiringSchedule] Response status:', response.status);
      console.log('[AiringSchedule] Response data keys:', Object.keys(response.data || {}));

      console.log('[AiringSchedule] Full response data:', JSON.stringify(response.data, null, 2));
      
      const airingSchedules = response.data?.data?.Page?.airingSchedules || [];
      console.log(`[AiringSchedule] Fetched ${airingSchedules.length} schedules`);
      console.log('[AiringSchedule] First schedule sample:', airingSchedules[0]);
      
      let filteredCount = 0;
      const validSchedules = airingSchedules.filter((schedule: any, index: number) => {
        console.log(`[AiringSchedule] Processing schedule ${index + 1}/${airingSchedules.length}:`, {
          id: schedule.id,
          mediaId: schedule.media?.id,
          mediaType: schedule.media?.type,
          mediaStatus: schedule.media?.status,
          isAdult: schedule.media?.isAdult,
          genres: schedule.media?.genres
        });
        
        // Must have media data
        if (!schedule.media) {
          console.log(`[AiringSchedule] Schedule ${index + 1} filtered: No media data`);
          return false;
        }
        
        // Must be anime type
        if (schedule.media.type !== 'ANIME') {
          console.log(`[AiringSchedule] Schedule ${index + 1} filtered: Not anime type (${schedule.media.type})`);
          return false;
        }
        
        // Allow both releasing and not yet released (upcoming)
        if (schedule.media.status !== 'RELEASING' && schedule.media.status !== 'NOT_YET_RELEASED') {
          console.log(`[AiringSchedule] Schedule ${index + 1} filtered: Not releasing or upcoming (${schedule.media.status})`);
          return false;
        }
        
        // Filter out adult content unless explicitly allowed
        if (schedule.media.isAdult && !showAdultContent) {
          console.log(`[AiringSchedule] Schedule ${index + 1} filtered: Adult content not allowed`);
          return false;
        }
        
        // Filter out certain genres
        if (schedule.media.genres && schedule.media.genres.some((genre: string) => 
          ['Hentai', 'Ecchi'].includes(genre))) {
          console.log(`[AiringSchedule] Schedule ${index + 1} filtered: Filtered genre`);
          return false;
        }
        
        filteredCount++;
        console.log(`[AiringSchedule] Schedule ${index + 1} passed all filters`);
        return true;
      });
      
      console.log(`[AiringSchedule] Filtering complete: ${filteredCount}/${airingSchedules.length} schedules passed filters`);
      
      const scheduleDays = organizeSchedulesByDate(validSchedules);
      console.log(`[AiringSchedule] Organized into ${scheduleDays.length} days with ${validSchedules.length} valid schedules`);
      console.log('[AiringSchedule] Schedule days structure:', scheduleDays.map(day => ({
        date: day.date,
        dayName: day.dayName,
        scheduleCount: day.schedules.length
      })));
      setAiringSchedule(scheduleDays);
    } catch (error: any) {
      console.error('[AiringSchedule] Error details:', {
        message: error?.message,
        status: error?.response?.status,
        statusText: error?.response?.statusText,
        data: error?.response?.data,
        errors: error?.response?.data?.errors,
        config: {
          url: error?.config?.url,
          method: error?.config?.method,
          headers: error?.config?.headers
        }
      });
      
      // Log the specific GraphQL errors
      if (error?.response?.data?.errors) {
        console.error('[AiringSchedule] GraphQL Errors:', JSON.stringify(error.response.data.errors, null, 2));
      }
      
      // Set empty schedule days as fallback
      const fallbackDays = [];
      const today = new Date();
      for (let i = 0; i < 7; i++) {
        const dateKey = new Date(today.getTime() + i * 86400000).toISOString().split('T')[0];
        const displayDate = new Date(today.getTime() + i * 86400000);
        fallbackDays.push({
          date: dateKey,
          dayName: displayDate.toLocaleDateString('en-US', { weekday: 'short' }),
          isToday: i === 0,
          schedules: []
        });
      }
      console.log('[AiringSchedule] Setting fallback schedule days');
      setAiringSchedule(fallbackDays);
    }
  };

  // Fetch birthdays separately
  const fetchBirthdays = async () => {
    try {
      const token = await SecureStore.getItemAsync(STORAGE_KEY.AUTH_TOKEN);
      
      const birthdayQuery = `
        query {
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
        }
      `;

      const response = await axios.post(
        ANILIST_API,
        { query: birthdayQuery },
        {
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
          },
          timeout: 15000
        }
      );

      const characters = response.data?.data?.birthdayCharacters?.characters || [];
      const staffMembers = response.data?.data?.birthdayStaff?.staff || [];
      
      const processedCharacters = characters.map((character: Character) => ({
        ...character,
        type: 'CHARACTER' as const
      }));
      
      const processedStaff = staffMembers.map((staff: Staff) => ({
        ...staff,
        type: 'STAFF' as const
      }));

      const todayBirthdays = [
        ...processedCharacters,
        ...processedStaff
      ].sort((a, b) => (b.favourites || 0) - (a.favourites || 0));

      setBirthdays(todayBirthdays);
    } catch (error) {
      console.error('Error fetching birthdays:', error);
      setBirthdays([]); // Set empty array as fallback
    }
  };

  // Fetch section data separately
  const fetchSectionData = async () => {
    try {
      const showAdultContent = settings?.displayAdultContent || false;
      const token = await SecureStore.getItemAsync(STORAGE_KEY.AUTH_TOKEN);
      
      const sectionsQuery = `
        query ($season: MediaSeason, $seasonYear: Int, $lastYear: Int, $isAdult: Boolean) {
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

      const date = new Date();
      const month = date.getMonth() + 1;
      let season = 'WINTER';
      if (month >= 4 && month <= 6) season = 'SPRING';
      else if (month >= 7 && month <= 9) season = 'SUMMER';
      else if (month >= 10 && month <= 12) season = 'FALL';
      const year = date.getFullYear();

      const response = await axios.post(
        ANILIST_API,
        {
          query: sectionsQuery,
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
          timeout: 20000
        }
      );

      const data = response.data.data;
      
      // Process all section data
      const processedAnticipated = (data.anticipated?.media || []).map((anime: any) => ({
        ...anime,
        averageScore: anime.averageScore ? anime.averageScore / 10 : 0
      }));
      
      const processedPopular = (data.popular?.media || []).map((anime: any) => ({
        ...anime,
        averageScore: anime.averageScore ? anime.averageScore / 10 : 0
      }));
      
      const processedLastYear = (data.lastYear?.media || []).map((anime: any) => ({
        ...anime,
        averageScore: anime.averageScore ? anime.averageScore / 10 : 0
      }));
      
      const processedMovies = (data.movies?.media || []).map((anime: any) => ({
        ...anime,
        averageScore: anime.averageScore ? anime.averageScore / 10 : 0
      }));
      
      const processedMusicVideos = (data.musicVideos?.media || []).map((anime: any) => ({
        ...anime,
        averageScore: anime.averageScore ? anime.averageScore / 10 : 0
      }));
      
      const processedAnticipatedUpcoming = (data.anticipatedUpcoming?.media || []).map((anime: any) => ({
        ...anime,
        averageScore: anime.averageScore ? anime.averageScore / 10 : 0
      }));

      setAnticipatedAnime(processedAnticipated);
      setPopularAnime(processedPopular);
      setLastYearAnime(processedLastYear);
      setAnimeMovies(processedMovies);
      setMusicVideos(processedMusicVideos);
      setAnticipatedUpcoming(processedAnticipatedUpcoming);
    } catch (error) {
      console.error('Error fetching section data:', error);
      // Set empty arrays as fallback
      setAnticipatedAnime([]);
      setPopularAnime([]);
      setLastYearAnime([]);
      setAnimeMovies([]);
      setMusicVideos([]);
      setAnticipatedUpcoming([]);
    }
  };

  // Fetch top 100 separately
  const fetchTop100Data = async () => {
    try {
      const showAdultContent = settings?.displayAdultContent || false;
      const token = await SecureStore.getItemAsync(STORAGE_KEY.AUTH_TOKEN);
      
      const top100Query = `
        query ($isAdult: Boolean) {
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
        }
      `;

      const response = await axios.post(
        ANILIST_API,
        {
          query: top100Query,
          variables: { isAdult: showAdultContent }
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
          },
          timeout: 15000
        }
      );

      const top100 = response.data?.data?.top100?.media || [];
      const processedTop100 = top100.map((anime: any) => ({
        ...anime,
        averageScore: anime.averageScore ? anime.averageScore / 10 : 0
      }));

      setTop100Anime(processedTop100);
    } catch (error) {
      console.error('Error fetching top 100:', error);
      setTop100Anime([]); // Set empty array as fallback
    }
  };

  // Handle pull-to-refresh
  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        fetchCriticalData(),
        fetchAiringSchedule(),
        fetchBirthdays(),
        fetchSectionData(),
        fetchTop100Data()
      ]);
    } catch (error) {
      console.error('Error refreshing data:', error);
    } finally {
      setRefreshing(false);
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
    const daysDiff = Math.abs(timeDiff) / (1000 * 60 * 60 * 24);
    
    // Currently airing (±15 minutes window)
    if (minutesDiff <= 15) {
      return 'AIRING NOW';
    }
    
    // Just aired (15-60 minutes ago)
    if (timeDiff < 0 && minutesDiff <= 60) {
      return 'JUST AIRED';
    }
    
    // Aired recently (1-24 hours ago)
    if (timeDiff < 0 && hoursDiff <= 24) {
      const hours = Math.floor(hoursDiff);
      return `AIRED ${hours}H AGO`;
    }
    
    // Aired more than 24 hours ago
    if (timeDiff < -24 * 60 * 60 * 1000) {
      const days = Math.floor(daysDiff);
      return `AIRED ${days}D AGO`;
    }
    
    // Upcoming within 24 hours
    if (timeDiff > 0 && daysDiff < 1) {
      const hours = Math.floor(hoursDiff);
      return `IN ${hours}H`;
    }
    
    // Upcoming within a week
    if (timeDiff > 0 && daysDiff < 7) {
      const days = Math.floor(daysDiff);
      return `IN ${days}D`;
    }
    
    // Upcoming (more than a week) - show the actual time
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
    const hoursDiff = Math.abs(timeDiff) / (1000 * 60 * 60);
    const daysDiff = Math.abs(timeDiff) / (1000 * 60 * 60 * 24);
    
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
    // Upcoming within 24 hours
    else if (timeDiff > 0 && daysDiff < 1) {
      return 'upcoming-soon';
    }
    // Upcoming within a week
    else if (timeDiff > 0 && daysDiff < 7) {
      return 'upcoming-week';
    }
    // Upcoming (more than a week)
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
          onPress={fetchCriticalData}
        >
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <>
      <ScrollView 
        style={[styles.container, { backgroundColor: currentTheme.colors.background }]} 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[currentTheme.colors.primary]}
            tintColor={currentTheme.colors.primary}
          />
        }
      >
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
            {airingSchedule.length > 0 && airingSchedule[selectedDay]?.schedules.length > 0 ? (
              airingSchedule[selectedDay].schedules.map((schedule) => (
                <TouchableOpacity 
                  key={schedule.id}
                                      style={[
                      styles.horizontalScheduleCard, 
                      { 
                        backgroundColor: currentTheme.colors.surface,
                        shadowColor: isDarkMode ? '#000' : '#666',
                        opacity: getAiringStatus(schedule.airingAt) === 'aired' ? 0.7 : 
                                 getAiringStatus(schedule.airingAt) === 'just-aired' ? 0.9 : 
                                 getAiringStatus(schedule.airingAt) === 'upcoming' ? 0.95 : 1.0
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
                                 getAiringStatus(schedule.airingAt) === 'upcoming-soon' ? '#FF5722' : 
                                 getAiringStatus(schedule.airingAt) === 'upcoming-week' ? '#2196F3' : 
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
                  No episodes scheduled
                </Text>
                <Text style={[styles.horizontalNoScheduleSubtext, { color: currentTheme.colors.textSecondary }]}>
                  Check back later for updates
                </Text>
              </View>
            )}
          </ScrollView>
        </View>

        {/* Birthdays Section */}
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

        {/* Dynamic Sections */}
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

        {/* Top 100 Section */}
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
  horizontalNoScheduleSubtext: {
    fontSize: 12,
    fontWeight: '400',
    opacity: 0.7,
    marginTop: 4,
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