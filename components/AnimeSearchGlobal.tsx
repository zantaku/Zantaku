import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Platform,
  Modal,
  Dimensions,
  LogBox,
  FlatList,
  DeviceEventEmitter,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { FontAwesome5 } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { Image as ExpoImage } from 'expo-image';
import { useRouter } from 'expo-router';
import axios from 'axios';
import { debounce } from 'lodash';
import Slider from '@react-native-community/slider';
import * as SecureStore from 'expo-secure-store';
import { STORAGE_KEY } from '../constants/auth';
import { useSettings } from '../hooks/useSettings';

// Ignore the text warning since it's a false positive
LogBox.ignoreLogs(['Text strings must be rendered within a <Text> component']);

interface AnimeResult {
  id: number;
  title: {
    userPreferred: string;
    romaji: string;
    english: string;
    native?: string;
  };
  coverImage: {
    medium: string;
  };
  format: string;
  status: string;
  episodes?: number;
  duration?: number;
  genres?: string[];
  averageScore?: number;
  popularity?: number;
  trending?: number;
  rank?: number;
  season?: string;
  seasonYear?: number;
  description?: string;
  staff?: {
    edges: Array<{
      role: string;
      node: {
        name: {
          full: string;
        };
      };
    }>;
  };
}

interface AnimeFilters {
  format: string[];
  status: string[];
  year: number | null;
  sort: Record<string, 'ASC' | 'DESC' | null>;
  genres: string[];
  season: string;
}

interface FilterOption {
  id: string;
  label: string;
  icon: string;
}

interface FilterOptions {
  format: string[];
  status: string[];
  sort: FilterOption[];
  season: FilterOption[];
  genres: string[];
}

interface Props {
  visible: boolean;
  onClose: () => void;
}

const ANILIST_GRAPHQL_ENDPOINT = 'https://graphql.anilist.co';

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
  },
  content: {
    flex: 1,
    paddingTop: Platform.OS === 'ios' ? 50 : 30,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 15,
    marginLeft: 8,
    marginRight: 8,
  },
  clearButton: {
    padding: 4,
  },
  closeButton: {
    padding: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  results: {
    flex: 1,
    paddingHorizontal: 12,
  },
  resultItem: {
    flexDirection: 'row',
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
  },
  resultImage: {
    width: 85,
    height: 120,
    borderRadius: 8,
  },
  resultInfo: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'flex-start',
  },
  resultName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
    lineHeight: 22,
  },
  statsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 12,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    fontSize: 13,
    fontWeight: '500',
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  tagText: {
    fontSize: 12,
    fontWeight: '500',
  },
  description: {
    fontSize: 13,
    lineHeight: 18,
    opacity: 0.8,
  },
  filterButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 8,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
  },
  filterModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  filterModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFF',
  },
  headerCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#333',
  },
  filterScroll: {
    flex: 1,
    paddingHorizontal: 20,
  },
  filterSection: {
    marginVertical: 16,
  },
  filterTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
    marginBottom: 12,
  },
  filterOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#333',
    backgroundColor: 'transparent',
    flexDirection: 'row',
    alignItems: 'center',
  },
  activeFilterChip: {
    backgroundColor: '#02A9FF',
    borderColor: '#02A9FF',
  },
  filterChipText: {
    fontSize: 14,
    color: '#CCC',
  },
  activeFilterChipText: {
    color: '#FFF',
  },
  filterHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  yearValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
  sliderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  slider: {
    flex: 1,
    height: 40,
    marginHorizontal: 8,
  },
  sliderLabel: {
    fontSize: 12,
    width: 40,
    textAlign: 'center',
    color: '#CCC',
  },
  clearFiltersButton: {
    backgroundColor: '#FF3B30',
    margin: 16,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  clearFiltersText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  errorText: {
    fontSize: 14,
    textAlign: 'center',
    marginHorizontal: 20,
  },
  noResults: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 60,
  },
  noResultsText: {
    fontSize: 14,
    textAlign: 'center',
  },
  yearDropdownButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#333',
    backgroundColor: '#2A2A2A',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: 120,
  },
  yearList: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  yearOption: {
    paddingVertical: 12,
    marginVertical: 2,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeYearOption: {
    backgroundColor: '#02A9FF',
  },
  yearOptionText: {
    color: '#CCC',
    fontSize: 16,
    fontWeight: '500',
  },
  activeYearOptionText: {
    color: '#FFF',
  },
  mangakaText: {
    fontSize: 13,
    color: '#CCC',
    marginBottom: 6,
  },
  activeFilterContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginHorizontal: 12,
    marginVertical: 8,
    borderRadius: 8,
  },
  activeFilterLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginRight: 8,
  },
  activeFilterChips: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  activeGenreChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    marginBottom: 4,
  },
  activeGenreChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    marginRight: 6,
  },
  clearGenreButton: {
    padding: 2,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderRadius: 10,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default function AnimeSearchGlobal({ visible, onClose }: Props) {
  const router = useRouter();
  const { isDarkMode, currentTheme } = useTheme();
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<AnimeResult[]>([]);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [filters, setFilters] = useState<AnimeFilters>({
    format: [],
    status: [],
    year: null,
    sort: {},
    genres: [],
    season: ''
  });
  const currentYear = new Date().getFullYear();
  const [sliderValue, setSliderValue] = useState<number>(currentYear);
  const { settings } = useSettings();
  const [userPreferences, setUserPreferences] = useState<{
    titleLanguage: string;
    scoreFormat: string;
  } | null>(null);
  const [showYearDropdown, setShowYearDropdown] = useState(false);
  const [page, setPage] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const FILTER_OPTIONS: FilterOptions = {
    format: ['TV', 'MOVIE', 'OVA', 'ONA', 'SPECIAL', 'MUSIC'],
    status: ['FINISHED', 'RELEASING', 'NOT_YET_RELEASED', 'CANCELLED', 'HIATUS'],
    sort: [
      { id: 'TRENDING_DESC', label: 'Trending', icon: 'fire' },
      { id: 'POPULARITY_DESC', label: 'Popular', icon: 'heart' },
      { id: 'SCORE_DESC', label: 'Highest Rated', icon: 'star' },
      { id: 'EPISODES_DESC', label: 'Most Episodes', icon: 'tv' },
      { id: 'START_DATE_DESC', label: 'Newest', icon: 'calendar' }
    ],
    season: [
      { id: 'WINTER', label: 'Winter', icon: 'snowflake' },
      { id: 'SPRING', label: 'Spring', icon: 'seedling' },
      { id: 'SUMMER', label: 'Summer', icon: 'sun' },
      { id: 'FALL', label: 'Fall', icon: 'leaf' }
    ],
    genres: [
      'Action', 'Adventure', 'Comedy', 'Drama', 'Fantasy', 'Horror', 'Mystery',
      'Psychological', 'Romance', 'Sci-Fi', 'Slice of Life', 'Sports', 'Supernatural',
      'Thriller'
    ]
  };

  const generateYearOptions = () => {
    const years = [];
    for (let year = currentYear + 1; year >= 1970; year--) {
      years.push(year);
    }
    return years;
  };

  const debouncedSearch = useCallback(
    debounce((text: string) => {
      // Don't search if query is empty and no filters are active
      if (!text.trim() && !Object.values(filters).some(value => 
        Array.isArray(value) ? value.length > 0 : value !== null
      )) {
      return;
    }
      searchAnime(text);
    }, 750), // Increased debounce time to 750ms
    [filters]
  );

  const handleSearch = (text: string) => {
    setQuery(text);
    setError(null); // Clear any existing errors
    
    // If the text is empty and no filters are active, show trending
    if (!text.trim() && !Object.values(filters).some(value => 
      Array.isArray(value) ? value.length > 0 : value !== null
    )) {
      searchAnime('');
      return;
    }
    
    debouncedSearch(text);
  };

  const searchAnime = async (searchQuery: string, pageNum: number = 1, isLoadingMore: boolean = false) => {
    try {
      if (pageNum === 1) {
        setLoading(true);
      }
      setError(null);

      // Add request timestamp check
      const lastRequestTime = await SecureStore.getItemAsync('lastAnimeSearchRequest');
      const currentTime = Date.now();
      
      if (lastRequestTime) {
        const timeSinceLastRequest = currentTime - parseInt(lastRequestTime);
        if (timeSinceLastRequest < 500) { // 500ms minimum delay between requests
          throw new Error('Please wait a moment before searching again');
        }
      }
      
      await SecureStore.setItemAsync('lastAnimeSearchRequest', currentTime.toString());

      const hasActiveFilters = Object.entries(filters).some(([key, value]) => {
        if (Array.isArray(value)) return value.length > 0;
        if (key === 'sort') return Object.keys(value).length > 0;
        if (key === 'year') return value !== null && value <= currentYear;
        return false;
      });

      // Try to get token but don't require it
      const token = await SecureStore.getItemAsync(STORAGE_KEY.AUTH_TOKEN);
      console.log('Token available:', !!token);

      let sortOptions = Object.keys(filters.sort);

      if (sortOptions.length === 0) {
        if (!searchQuery.trim() && !hasActiveFilters) {
          sortOptions = ['TRENDING_DESC'];
        } else if (searchQuery.trim()) {
          sortOptions = ['SEARCH_MATCH', 'POPULARITY_DESC'];
        } else {
          sortOptions = ['POPULARITY_DESC'];
        }
      }

      // Add retry logic
      let retryCount = 0;
      const maxRetries = 2;
      
      while (retryCount <= maxRetries) {
        try {
          const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          };

          // Only add authorization if token exists
          if (token) {
            headers['Authorization'] = `Bearer ${token}`;
          }

          const response = await axios.post(
            ANILIST_GRAPHQL_ENDPOINT,
            {
              query: `
                query ($page: Int, $search: String, $format: [MediaFormat], $status: [MediaStatus], 
                      $genre: String, $seasonYear: Int, $isAdult: Boolean, $sort: [MediaSort], $season: MediaSeason) {
                  Page(page: $page, perPage: 25) {
                    pageInfo {
                      hasNextPage
                      total
                    }
                    media(
                      type: ANIME, 
                      search: $search,
                      format_in: $format,
                      status_in: $status,
                      genre: $genre,
                      seasonYear: $seasonYear,
                      season: $season,
                      sort: $sort,
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
                        medium
                      }
                      format
                      status
                      episodes
                      duration
                      genres
                      averageScore
                      popularity
                      trending
                      season
                      seasonYear
                      description(asHtml: false)
                      staff {
                        edges {
                          role
                          node {
                            name {
                              full
                            }
                          }
                        }
                      }
                    }
                  }
                }
              `,
              variables: {
                page: pageNum,
                search: searchQuery.trim() || undefined,
                format: filters.format.length > 0 ? filters.format : undefined,
                status: filters.status.length > 0 ? filters.status : undefined,
                genre: filters.genres.length > 0 ? filters.genres[0] : undefined,
                season: filters.season ? filters.season.toUpperCase() : undefined,
                seasonYear: filters.year && filters.year <= currentYear ? filters.year : undefined,
                sort: sortOptions,
                isAdult: settings?.displayAdultContent || false
              }
            },
            { headers }
          );

          if (response.data.errors) {
            throw new Error(response.data.errors[0]?.message || 'Error fetching anime');
          }

          // Process successful response
          const sanitizedResults = response.data.data.Page.media.map((item: any) => ({
            ...item,
            title: {
              ...item.title,
              userPreferred: item.title.userPreferred || '',
              romaji: item.title.romaji || '',
              english: item.title.english || '',
              native: item.title.native || ''
            },
            description: item.description ? item.description.replace(/<[^>]*>/g, '') : '',
            format: item.format || '',
            status: item.status || '',
            trending: item.trending || false
          }));

          setHasNextPage(response.data.data.Page.pageInfo.hasNextPage);
          setResults(prev => pageNum === 1 ? sanitizedResults : [...prev, ...sanitizedResults]);
          setPage(pageNum);
          break; // Exit the retry loop on success

        } catch (error: any) {
          if (error.response?.status === 429 && retryCount < maxRetries) {
            // Wait before retrying (exponential backoff)
            await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 1000));
            retryCount++;
            continue;
          }
          throw error; // Re-throw if we're out of retries or it's not a 429 error
        }
      }

    } catch (error: any) {
      console.error('Search error:', error);
      setError(
        error.response?.status === 429
          ? 'Too many requests. Please wait a moment before trying again.'
          : error.message || 'Failed to fetch results. Please try again.'
      );
      if (pageNum === 1) {
        setResults([]);
      }
    } finally {
      setLoading(false);
      setIsLoadingMore(false);
    }
  };

  // Modify the useEffect to ensure it shows trending content on initial load
  useEffect(() => {
    const fetchUserPreferences = async () => {
      try {
        const token = await SecureStore.getItemAsync(STORAGE_KEY.AUTH_TOKEN);
        if (!token) return;

        const { data } = await axios.post(
          ANILIST_GRAPHQL_ENDPOINT,
          {
            query: `
              query {
                Viewer {
                  options {
                    titleLanguage
                    displayAdultContent
                  }
                  mediaListOptions {
                    scoreFormat
                  }
                }
              }
            `
          },
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            }
          }
        );

        if (data?.data?.Viewer) {
          setUserPreferences({
            titleLanguage: data.data.Viewer.options.titleLanguage.toLowerCase(),
            scoreFormat: data.data.Viewer.mediaListOptions.scoreFormat,
          });
        }
      } catch (error) {
        console.error('Error fetching user preferences:', error);
      }
    };

    fetchUserPreferences();
    // Fetch initial trending content with empty query
    searchAnime('');
  }, []);

  // Add useEffect to listen for genre search events
  useEffect(() => {
    // Listen for anime genre search events
    const genreSearchSubscription = DeviceEventEmitter.addListener(
      'openAnimeGenreSearch',
      (genre: string) => {
        console.log('AnimeSearchGlobal: Genre search triggered for:', genre);
        
        // Ensure the genre is properly formatted
        const formattedGenre = genre.trim();
        console.log('Using formatted genre for anime search:', formattedGenre);
        
        // Set the genre filter and clear other filters
        setFilters({
          format: [],
          status: [],
          year: null,
          sort: { 'TRENDING_DESC': 'DESC' }, // Default to trending
          genres: [formattedGenre], // Store the genre
          season: ''
        });
        
        setQuery(''); // Clear any existing query
        
        // Add a delay before making the API call to avoid rate limiting
        setTimeout(() => {
          console.log('Making API call for anime genre search...');
          searchAnime('');
        }, 1000);
      }
    );

    return () => {
      genreSearchSubscription.remove();
    };
  }, []);

  const formatScore = (score: number | undefined) => {
    if (!score) return 'N/A';
    
    switch (userPreferences?.scoreFormat) {
      case 'POINT_100':
        return score.toString();
      case 'POINT_10_DECIMAL':
        return (score / 10).toFixed(1);
      case 'POINT_10':
        return Math.round(score / 10).toString();
      case 'POINT_5':
        return Math.round(score / 20).toString();
      case 'POINT_3':
        return Math.round(score / 33.33).toString();
      default:
        return (score / 10).toFixed(1);
    }
  };

  const getPreferredTitle = (titles: { userPreferred: string; romaji: string; english: string; native?: string }) => {
    // If no user preferences set, use AniList's smart default
    if (!userPreferences) return titles.userPreferred;
    
    switch (userPreferences.titleLanguage) {
      case 'english':
        // Only fallback if English title doesn't exist
        return titles.english || titles.userPreferred;
      case 'romaji':
        return titles.romaji || titles.userPreferred;
      case 'native':
        return titles.native || titles.userPreferred;
      default:
        // Use AniList's smart default for unknown preferences
        return titles.userPreferred;
    }
  };

  const navigateToAnime = (animeId: number) => {
    router.push({
      pathname: '/anime/[id]',
      params: { id: animeId }
    });
    onClose();
  };

  const getAnimeInfo = (result: AnimeResult) => {
    const parts = [];
    if (result.format) parts.push(result.format);
    if (result.episodes) parts.push(`${result.episodes} eps`);
    if (result.duration) parts.push(`${result.duration} min`);
    if (result.status) parts.push(result.status);
    return parts.join(' • ');
  };

  const handleFilterChange = (filterType: keyof AnimeFilters, value: string | number) => {
    setFilters(prev => {
      const newFilters = { ...prev };
      
      if (filterType === 'season') {
        // Handle season as a single value
        newFilters.season = value as string;
      } else if (filterType === 'year') {
        newFilters.year = value as number;
      } else if (filterType === 'sort') {
        // Handle sort separately
        const [field, direction] = (value as string).split('_');
        newFilters.sort = {
          [field]: direction as 'ASC' | 'DESC'
        };
      } else if (Array.isArray(newFilters[filterType])) {
        // Handle array types (format, status, genres)
        const filterArray = newFilters[filterType] as string[];
        const valueStr = value.toString();
        
        if (filterArray.includes(valueStr)) {
          newFilters[filterType] = filterArray.filter(v => v !== valueStr);
        } else {
          newFilters[filterType] = [...filterArray, valueStr];
        }
      }
      
      return newFilters;
    });

    // Trigger search with the new filters
    searchAnime(query);
  };

  const clearFilters = () => {
    setFilters({
      format: [],
      status: [],
      year: null,
      sort: {},
      genres: [],
      season: ''
    });
    // Search with cleared filters
    searchAnime(query);
  };

  const closeFilterModal = () => {
    setShowFilterModal(false);
    // Search when closing the modal with the current filters
    searchAnime(query);
  };

  const loadMore = () => {
    if (!hasNextPage || loading || isLoadingMore) return;
    
    setIsLoadingMore(true);
    searchAnime(query, page + 1, true);
  };

  const renderItem = ({ item: result }: { item: AnimeResult }) => (
      <TouchableOpacity 
      key={result.id}
                    style={[
        styles.resultItem,
        {
          backgroundColor: isDarkMode ? '#2A2A2A' : '#FFFFFF',
          marginBottom: 12,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 4,
          elevation: 3
        }
      ]}
      onPress={() => navigateToAnime(result.id)}
      activeOpacity={0.7}
    >
      <ExpoImage
        source={{ uri: result.coverImage.medium }}
        style={styles.resultImage}
        contentFit="cover"
        transition={200}
      />
      <View style={styles.resultInfo}>
        <Text style={[styles.resultName, { color: currentTheme.colors.text }]} numberOfLines={2}>
          {getPreferredTitle(result.title)}
                    </Text>
        {result.staff?.edges.some((edge: { role: string; node: { name: { full: string } } }) => 
          edge.role.toLowerCase().includes('story') || 
          edge.role.toLowerCase().includes('art') ||
          edge.role.toLowerCase().includes('author') ||
          edge.role.toLowerCase().includes('mangaka')
        ) && (
          <Text style={[styles.mangakaText, { color: currentTheme.colors.textSecondary }]} numberOfLines={1}>
            by {result.staff.edges
              .find((edge: { role: string; node: { name: { full: string } } }) => 
                edge.role.toLowerCase().includes('story') || 
                edge.role.toLowerCase().includes('art') ||
                edge.role.toLowerCase().includes('author') ||
                edge.role.toLowerCase().includes('mangaka')
              )?.node.name.full}
          </Text>
        )}
        
        <View style={styles.statsContainer}>
          {result.averageScore && (
            <View style={styles.statItem}>
              <FontAwesome5 name="star" size={12} color="#FFD700" solid />
              <Text style={[styles.statText, { color: currentTheme.colors.textSecondary }]}>
                {formatScore(result.averageScore)}
                    </Text>
              </View>
          )}
          {result.popularity && (
            <View style={styles.statItem}>
              <FontAwesome5 name="heart" size={12} color="#FF6B6B" solid />
              <Text style={[styles.statText, { color: currentTheme.colors.textSecondary }]}>
                {result.popularity.toLocaleString()}
                </Text>
              </View>
          )}
          {result.trending && (
            <View style={styles.statItem}>
              <FontAwesome5 name="fire" size={12} color="#02A9FF" solid />
              </View>
          )}
            </View>

        <View style={styles.tagsContainer}>
          {result.format && (
            <View style={[styles.tag, { backgroundColor: isDarkMode ? '#333' : '#F0F0F0' }]}>
              <Text style={[styles.tagText, { color: currentTheme.colors.textSecondary }]}>
                {result.format.replace(/_/g, ' ')}
                    </Text>
              </View>
          )}
          {result.status && (
            <View style={[styles.tag, { backgroundColor: isDarkMode ? '#333' : '#F0F0F0' }]}>
              <Text style={[styles.tagText, { color: currentTheme.colors.textSecondary }]}>
                {result.status.replace(/_/g, ' ')}
              </Text>
            </View>
          )}
          {result.episodes && (
            <View style={[styles.tag, { backgroundColor: isDarkMode ? '#333' : '#F0F0F0' }]}>
              <Text style={[styles.tagText, { color: currentTheme.colors.textSecondary }]}>
                {result.episodes} EP
                    </Text>
              </View>
          )}
            </View>

        {result.description && (
          <Text 
            style={[styles.description, { color: currentTheme.colors.textSecondary }]} 
            numberOfLines={2}
          >
            {result.description.replace(/<[^>]*>/g, '')}
                    </Text>
        )}
              </View>
            </TouchableOpacity>
  );

  if (!visible) return null;

  return (
    <View style={styles.container}>
      <Modal
        visible={visible}
        transparent={true}
        onRequestClose={onClose}
        animationType="fade"
        >
          <View style={[
            StyleSheet.absoluteFill,
          { backgroundColor: 'rgba(0, 0, 0, 0.8)' }
        ]}>
        <View style={styles.content}>
          <View style={styles.header}>
            <View style={[
              styles.searchBar,
              {
                backgroundColor: isDarkMode ? '#2A2A2A' : '#FFFFFF',
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.1,
                shadowRadius: 4,
                elevation: 3
              }
            ]}>
              <FontAwesome5 name="search" size={16} color={currentTheme.colors.primary} />
              <TextInput
                style={[styles.input, { color: currentTheme.colors.text }]}
                  placeholder="Search anime, movies, OVAs..."
                placeholderTextColor={currentTheme.colors.textSecondary}
                value={query}
                onChangeText={handleSearch}
                autoFocus
              />
              {query.length > 0 && (
                <TouchableOpacity 
                  onPress={() => handleSearch('')}
                  style={styles.clearButton}
                >
                  <FontAwesome5 name="times" size={14} color={currentTheme.colors.textSecondary} />
                </TouchableOpacity>
              )}
            </View>
            <TouchableOpacity
              style={[styles.filterButton, { backgroundColor: isDarkMode ? '#2A2A2A' : '#FFFFFF' }]}
              onPress={() => setShowFilterModal(true)}
            >
              <FontAwesome5
                name="filter"
                size={16}
                color={Object.values(filters).some(f => 
                  Array.isArray(f) ? f.length > 0 : f !== null
                ) ? '#02A9FF' : currentTheme.colors.primary}
              />
            </TouchableOpacity>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <FontAwesome5 name="times" size={18} color={isDarkMode ? '#FFFFFF' : '#000000'} />
            </TouchableOpacity>
          </View>

          {/* Show active genre filter if any */}
          {filters.genres.length > 0 && (
            <View style={styles.activeFilterContainer}>
              <Text style={[styles.activeFilterLabel, { color: currentTheme.colors.textSecondary }]}>
                Active Filter:
              </Text>
              <View style={styles.activeFilterChips}>
                <View style={[styles.activeGenreChip, { backgroundColor: '#02A9FF' }]}>
                  <Text style={styles.activeGenreChipText}>
                    {filters.genres[0]}
                  </Text>
                  <TouchableOpacity
                    onPress={() => {
                      setFilters(prev => ({
                        ...prev,
                        genres: []
                      }));
                      setTimeout(() => searchAnime(query), 100);
                    }}
                    style={styles.clearGenreButton}
                  >
                    <FontAwesome5 name="times" size={12} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color={currentTheme.colors.primary} />
            </View>
          ) : (
            <FlatList
              data={results}
              keyboardShouldPersistTaps="handled"
              style={styles.results}
              renderItem={renderItem}
              keyExtractor={(item) => item.id.toString()}
              ListEmptyComponent={() => (
                error ? (
                  <View style={styles.noResults}>
                    <FontAwesome5 
                      name="exclamation-circle" 
                      size={24} 
                      color={currentTheme.colors.error}
                      style={{ marginBottom: 8 }}
                    />
                    <Text style={[styles.errorText, { color: currentTheme.colors.error }]}>
                      {error}
                      </Text>
                    </View>
              ) : query.length > 0 && !loading ? (
                <View style={styles.noResults}>
                  <FontAwesome5 
                    name="search" 
                    size={24} 
                    color={currentTheme.colors.textSecondary}
                    style={{ marginBottom: 8, opacity: 0.5 }}
                  />
                  <Text style={[styles.noResultsText, { color: currentTheme.colors.textSecondary }]}>
                    No results found
                  </Text>
                </View>
                ) : null
              )}
              onEndReached={loadMore}
              onEndReachedThreshold={0.5}
              ListFooterComponent={() => (
                isLoadingMore ? (
                  <View style={{ padding: 20 }}>
                    <ActivityIndicator size="small" color={currentTheme.colors.primary} />
                  </View>
                ) : null
              )}
            />
          )}
          </View>

          {showFilterModal && (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: '#1A1A1A' }]}>
              <View style={styles.filterModalHeader}>
                <Text style={styles.filterModalTitle}>Filters</Text>
                <TouchableOpacity 
                  style={styles.headerCloseButton}
                  onPress={closeFilterModal}
                >
                  <FontAwesome5 name="times" size={16} color="#FFF" />
                </TouchableOpacity>
              </View>
              <ScrollView 
                style={styles.filterScroll}
                showsVerticalScrollIndicator={false}
                bounces={true}
              >
                {Object.entries(FILTER_OPTIONS).filter(([key]) => key !== 'year').map(([filterType, options]) => (
                  <View key={filterType} style={styles.filterSection}>
                    <Text style={styles.filterTitle}>
                      {filterType.charAt(0).toUpperCase() + filterType.slice(1)}
                    </Text>
                    <View style={styles.filterOptions}>
                      {['format', 'status', 'genres'].includes(filterType) ? (
                        // For array-based filters (format, status, genres)
                        (options as string[]).map((option) => {
                          const currentFilters = filters[filterType as keyof Omit<AnimeFilters, 'year'>] as string[];
                          const isActive = Array.isArray(currentFilters) && currentFilters.includes(option);
                          return (
                            <TouchableOpacity
                              key={option}
                              style={[
                                styles.filterChip,
                                isActive && styles.activeFilterChip
                              ]}
                              onPress={() => handleFilterChange(filterType as keyof AnimeFilters, option)}
                            >
                              <Text style={[
                                styles.filterChipText,
                                isActive && styles.activeFilterChipText
                              ]}>
                                {option.replace(/_/g, ' ')}
                              </Text>
                            </TouchableOpacity>
                          );
                        })
                      ) : filterType === 'season' ? (
                        // Special handling for season filter
                        (options as FilterOption[]).map((option) => {
                          const isActive = filters.season === option.id;
                          return (
                            <TouchableOpacity
                              key={option.id}
                              style={[
                                styles.filterChip,
                                isActive && styles.activeFilterChip
                              ]}
                              onPress={() => handleFilterChange('season', option.id)}
                            >
                              <FontAwesome5 
                                name={option.icon}
                                size={12} 
                                color={isActive ? '#FFF' : '#CCC'} 
                                style={{ marginRight: 6 }}
                              />
                              <Text style={[
                                styles.filterChipText,
                                isActive && styles.activeFilterChipText
                              ]}>
                                {option.label}
                              </Text>
                            </TouchableOpacity>
                          );
                        })
                      ) : (
                        // For sort options
                        (options as FilterOption[]).map((option) => {
                          const sortFilters = filters.sort;
                          const isActive = !!sortFilters[option.id.split('_')[0]];
                          
                          return (
                            <TouchableOpacity
                              key={option.id}
                              style={[
                                styles.filterChip,
                                isActive && styles.activeFilterChip
                              ]}
                              onPress={() => handleFilterChange('sort', option.id)}
                            >
                              <FontAwesome5 
                                name={option.icon}
                                size={12} 
                                color={isActive ? '#FFF' : '#CCC'} 
                                style={{ marginRight: 6 }}
                              />
                              <Text style={[
                                styles.filterChipText,
                                isActive && styles.activeFilterChipText
                              ]}>
                                {option.label}
                              </Text>
                            </TouchableOpacity>
                          );
                        })
                      )}
                    </View>
                  </View>
                ))}

                <View style={styles.filterSection}>
                  <View style={styles.filterHeaderRow}>
                    <Text style={styles.filterTitle}>Year</Text>
                    <TouchableOpacity
                      style={[
                        styles.yearDropdownButton,
                        filters.year ? styles.activeFilterChip : undefined
                      ]}
                      onPress={() => setShowYearDropdown(true)}
                    >
                      <Text style={[
                        styles.filterChipText,
                        filters.year ? styles.activeFilterChipText : undefined
                      ]}>
                        {filters.year || 'All Years'}
                      </Text>
                      <FontAwesome5 
                        name="chevron-down"
                        size={12} 
                        color={filters.year ? '#FFF' : '#CCC'} 
                        style={{ marginLeft: 6 }}
                      />
                    </TouchableOpacity>
                  </View>
                  {showYearDropdown && (
                    <View style={styles.yearList}>
                      <TouchableOpacity
                        style={[
                          styles.yearOption,
                          !filters.year ? styles.activeYearOption : undefined
                        ]}
                        onPress={() => {
                          setFilters(prev => ({ ...prev, year: null }));
                          setShowYearDropdown(false);
                          searchAnime(query);
                        }}
                      >
                        <Text style={[
                          styles.yearOptionText,
                          !filters.year ? styles.activeYearOptionText : undefined
                        ]}>
                          All Years
                        </Text>
                      </TouchableOpacity>
                      {generateYearOptions().map((year) => (
                        <TouchableOpacity
                          key={year}
                          style={[
                            styles.yearOption,
                            filters.year === year ? styles.activeYearOption : undefined
                          ]}
                          onPress={() => {
                            handleFilterChange('year', year);
                            setShowYearDropdown(false);
                          }}
                        >
                          <Text style={[
                            styles.yearOptionText,
                            filters.year === year ? styles.activeYearOptionText : undefined
                          ]}>
                            {year}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>
            </ScrollView>
              <TouchableOpacity
                style={styles.clearFiltersButton}
                onPress={clearFilters}
              >
                <Text style={styles.clearFiltersText}>Clear All Filters</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
}