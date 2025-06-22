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
import * as ImagePicker from 'expo-image-picker';
import SuccessToast from './SuccessToast';
import ErrorToast from './ErrorToast';

// The LogBox suppression has been removed as we are fixing the root cause.

// Add interface for Trace Moe API response
interface TraceMoeResult {
  anilist: number; // Just the ID number, not an object
  filename: string;
  episode: number | null;
  similarity: number;
  from: number;
  to: number;
  video: string;
  image: string;
}

interface TraceMoeResponse {
  frameCount: number;
  error: string;
  result: TraceMoeResult[];
}

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
const TRACE_MOE_API_ENDPOINT = 'https://api.trace.moe/search';

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
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
  imageSearchButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 8,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
  },
  imagePickerModal: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#1A1A1A',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
  },
  imagePickerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
  },
  imagePickerOptionText: {
    fontSize: 16,
    marginLeft: 16,
    color: '#FFFFFF',
  },
  imagePickerDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginVertical: 8,
  },
  imagePickerCancel: {
    marginTop: 8,
    paddingVertical: 16,
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
  },
  imagePickerCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  imageSearchingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageSearchingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  urlInputContainer: {
    backgroundColor: '#2A2A2A',
    borderRadius: 12,
    margin: 16,
    padding: 16,
  },
  urlInputTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 12,
    textAlign: 'center',
  },
  urlTextInput: {
    backgroundColor: '#3A3A3A',
    borderRadius: 8,
    padding: 12,
    color: '#FFFFFF',
    fontSize: 16,
    marginBottom: 16,
    minHeight: 48,
  },
  urlInputButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  urlInputButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  urlSearchButton: {
    backgroundColor: '#02A9FF',
  },
  urlCancelButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  urlButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
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
  
  // New state variables for image search
  const [showImagePickerModal, setShowImagePickerModal] = useState(false);
  const [imageSearching, setImageSearching] = useState(false);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [showErrorToast, setShowErrorToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [foundAnimeTitle, setFoundAnimeTitle] = useState('');
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [imageUrl, setImageUrl] = useState('');

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
          console.log(`AnimeSearchGlobal: Rate limiting - Last request was ${timeSinceLastRequest}ms ago, waiting...`);
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
      console.log('AnimeSearchGlobal: Token available:', !!token);

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

      console.log('AnimeSearchGlobal: Search parameters:', {
        query: searchQuery.trim() || 'None',
        genreFilter: filters.genres.length > 0 ? filters.genres[0] : 'None',
        sortOptions,
        hasActiveFilters,
        page: pageNum
      });

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

          console.log('AnimeSearchGlobal: Making API request, retry count:', retryCount);

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
            console.error('AnimeSearchGlobal: GraphQL errors:', response.data.errors);
            throw new Error(response.data.errors[0]?.message || 'Error fetching anime');
          }

          console.log('AnimeSearchGlobal: API response received successfully, results count:', response.data.data.Page.media.length);

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

          console.log('AnimeSearchGlobal: Processed results count:', sanitizedResults.length);

          setHasNextPage(response.data.data.Page.pageInfo.hasNextPage);
          setResults(prev => pageNum === 1 ? sanitizedResults : [...prev, ...sanitizedResults]);
          setPage(pageNum);
          break; // Exit the retry loop on success

        } catch (error: any) {
          console.error('AnimeSearchGlobal: API request error on retry', retryCount);
          console.error('AnimeSearchGlobal: Error type:', typeof error);
          console.error('AnimeSearchGlobal: Error message:', error.message);
          console.error('AnimeSearchGlobal: Error response status:', error.response?.status);
          console.error('AnimeSearchGlobal: Error response data:', error.response?.data);
          
          if (error.response?.status === 429 && retryCount < maxRetries) {
            console.log('AnimeSearchGlobal: Rate limited, waiting before retry...');
            // Wait before retrying (exponential backoff)
            await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 1000));
            retryCount++;
            continue;
          }
          throw error; // Re-throw if we're out of retries or it's not a 429 error
        }
      }

    } catch (error: any) {
      console.error('AnimeSearchGlobal: Search error occurred');
      console.error('AnimeSearchGlobal: Error type:', typeof error);
      console.error('AnimeSearchGlobal: Error message:', error.message);
      console.error('AnimeSearchGlobal: Error response status:', error.response?.status);
      console.error('AnimeSearchGlobal: Error response data:', error.response?.data);
      console.error('AnimeSearchGlobal: Full error object:', error);
      
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

  // Add useEffect to listen for genre and format search events
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

    // Listen for anime format search events
    const formatSearchSubscription = DeviceEventEmitter.addListener(
      'openAnimeFormatSearch',
      (format: string) => {
        console.log('AnimeSearchGlobal: Format search triggered for:', format);
        
        // Ensure the format is properly formatted
        const formattedFormat = format.trim();
        console.log('Using formatted format for anime search:', formattedFormat);
        
        // Set the format filter and clear other filters
        setFilters({
          format: [formattedFormat],
          status: [],
          year: null,
          sort: { 'TRENDING_DESC': 'DESC' }, // Default to trending
          genres: [],
          season: ''
        });
        
        setQuery(''); // Clear any existing query
        
        // Add a delay before making the API call to avoid rate limiting
        setTimeout(() => {
          console.log('Making API call for anime format search...');
          searchAnime('');
        }, 1000);
      }
    );

    return () => {
      genreSearchSubscription.remove();
      formatSearchSubscription.remove();
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
  
  // FIXED: Refactored renderItem to remove illegal whitespace and improve readability.
  const renderItem = ({ item: result }: { item: AnimeResult }) => {
    const mangaka = result.staff?.edges.find(edge =>
      ['story', 'art', 'author', 'mangaka'].some(role => edge.role.toLowerCase().includes(role))
    )?.node.name.full;

    return (
      <TouchableOpacity
        key={result.id}
        style={[
          styles.resultItem,
          {
            backgroundColor: isDarkMode ? '#2A2A2A' : '#FFFFFF',
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
          {mangaka && (
            <Text style={[styles.mangakaText, { color: currentTheme.colors.textSecondary }]} numberOfLines={1}>
              {`by ${mangaka}`}
            </Text>
          )}
          <View style={styles.statsContainer}>
            {result.averageScore && (
              <View style={styles.statItem}>
                <FontAwesome5 name="star" size={12} color="#FFD700" solid />
                <Text style={[styles.statText, { color: currentTheme.colors.textSecondary }]}>{formatScore(result.averageScore)}</Text>
              </View>
            )}
            {result.popularity && (
              <View style={styles.statItem}>
                <FontAwesome5 name="heart" size={12} color="#FF6B6B" solid />
                <Text style={[styles.statText, { color: currentTheme.colors.textSecondary }]}>{result.popularity.toLocaleString()}</Text>
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
                <Text style={[styles.tagText, { color: currentTheme.colors.textSecondary }]}>{result.format.replace(/_/g, ' ')}</Text>
              </View>
            )}
            {result.status && (
              <View style={[styles.tag, { backgroundColor: isDarkMode ? '#333' : '#F0F0F0' }]}>
                <Text style={[styles.tagText, { color: currentTheme.colors.textSecondary }]}>{result.status.replace(/_/g, ' ')}</Text>
              </View>
            )}
            {result.episodes && (
              <View style={[styles.tag, { backgroundColor: isDarkMode ? '#333' : '#F0F0F0' }]}>
                <Text style={[styles.tagText, { color: currentTheme.colors.textSecondary }]}>{`${result.episodes} EP`}</Text>
              </View>
            )}
          </View>
          {result.description && (
            <Text style={[styles.description, { color: currentTheme.colors.textSecondary }]} numberOfLines={2}>
              {result.description?.replace(/<[^>]*>/g, '') || ''}
            </Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  // Image search functions
  const handleImageSearchPress = () => {
    setShowImagePickerModal(true);
  };
  
  const handleImagePickerClose = () => {
    setShowImagePickerModal(false);
    setShowUrlInput(false);
    setImageUrl('');
  };
  
  const handleUrlInputPress = () => {
    setShowUrlInput(true);
  };
  
  const handleUrlSearch = async () => {
    if (!imageUrl.trim()) {
      showToast('Please enter a valid image URL', true);
      return;
    }
    
    // Validate URL format
    try {
      new URL(imageUrl);
    } catch (error) {
      showToast('Please enter a valid URL', true);
      return;
    }
    
    handleImagePickerClose();
    searchAnimeByImageUrl(imageUrl.trim());
  };
  
  const searchAnimeByImageUrl = async (url: string) => {
    setImageSearching(true);
    setError(null);
    
    try {
      console.log('Starting image search with URL:', url);
      
      // Make request to Trace Moe API with URL
      const response = await axios({
        method: 'get',
        url: TRACE_MOE_API_ENDPOINT,
        params: {
          url: url,
          cutBorders: true,
        },
        timeout: 30000, // 30 second timeout
      });
      
      console.log('Trace Moe API response received:', response.status);
      
      if (response.data && response.data.result && response.data.result.length > 0) {
        const bestMatch = response.data.result[0];
        const similarity = Math.round(bestMatch.similarity * 100);
        
        console.log('Best match found:', {
          animeId: bestMatch.anilist,
          similarity: similarity
        });
        
        // If similarity is too low, show warning
        if (similarity < 70) {
          showToast(`Low confidence match (${similarity}%). Try with a clearer image.`, true);
          setImageSearching(false);
          return;
        }
        
        const animeId = bestMatch.anilist;
        
        // Fetch anime title from AniList
        try {
          const anilistResponse = await axios.post(
            ANILIST_GRAPHQL_ENDPOINT,
            {
              query: `
                query ($id: Int) {
                  Media(id: $id, type: ANIME) {
                    id
                    title {
                      userPreferred
                      english
                      romaji
                      native
                    }
                  }
                }
              `,
              variables: {
                id: animeId
              }
            },
            {
              headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
              }
            }
          );
          
          const animeData = anilistResponse.data?.data?.Media;
          const title = animeData?.title?.userPreferred || 
                       animeData?.title?.english || 
                       animeData?.title?.romaji || 
                       animeData?.title?.native || 
                       bestMatch.filename;
          
          setFoundAnimeTitle(title);
          
          // Show success toast and navigate to anime page
          showToast(`Found "${title}" (${similarity}% match)`);
          
          // Add a small delay before navigating to ensure toast is visible
          setTimeout(() => {
            // Navigate to anime details page
            console.log('Navigating to anime details page with ID:', animeId);
            router.push({
              pathname: '/anime/[id]',
              params: { id: animeId }
            });
            onClose();
          }, 1000);
        } catch (anilistError) {
          console.error('Error fetching anime title from AniList:', anilistError);
          // Fallback to filename if AniList fails
          showToast(`Found "${bestMatch.filename}" (${similarity}% match)`);
          
          setTimeout(() => {
            router.push({
              pathname: '/anime/[id]',
              params: { id: animeId }
            });
            onClose();
          }, 1000);
        }
      } else {
        console.log('No matches found in Trace Moe response');
        showToast('No matches found. Try with a different image.', true);
      }
    } catch (error: any) {
      console.error('Error searching anime by image URL:', error);
      
      // More detailed error handling
      if (error.response) {
        console.error('Error response data:', error.response.data);
        console.error('Error response status:', error.response.status);
        
        if (error.response.status === 429) {
          showToast('Rate limit exceeded. Please try again later.', true);
        } else if (error.response.status === 400) {
          showToast('Invalid image URL or format. Please try a different image.', true);
        } else {
          showToast(`Server error: ${error.response.status}. Please try again.`, true);
        }
      } else if (error.request) {
        console.error('No response received:', error.request);
        showToast('No response from server. Check your internet connection.', true);
      } else {
        console.error('Error message:', error.message);
        showToast('Error searching by image. Please try again.', true);
      }
    } finally {
      setImageSearching(false);
    }
  };

  // Add a helper function for showing toast notifications
  const showToast = (message: string, isError: boolean = false) => {
    setToastMessage(message);
    if (isError) {
      setShowErrorToast(true);
      setShowSuccessToast(false);
    } else {
      setShowSuccessToast(true);
      setShowErrorToast(false);
    }
  };

  const pickImageFromCamera = async () => {
    handleImagePickerClose();
    
    // Request camera permissions
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    
    if (status !== 'granted') {
      showToast('Camera permission is required to take a photo', true);
      return;
    }
    
    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.8,
        base64: true,
      });
      
      if (!result.canceled && result.assets && result.assets[0]) {
        const imageBase64 = result.assets[0].base64;
        if (imageBase64) {
          console.log('Image captured from camera, size:', imageBase64.length);
          searchAnimeByImage(imageBase64);
        } else {
          showToast('Failed to process image. Please try again.', true);
        }
      }
    } catch (error) {
      console.error('Error picking image from camera:', error);
      showToast('Error taking photo. Please try again.', true);
    }
  };
  
  const pickImageFromGallery = async () => {
    handleImagePickerClose();
    
    // Request media library permissions
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (status !== 'granted') {
      showToast('Gallery permission is required to select an image', true);
      return;
    }
    
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.8,
        base64: true,
      });
      
      if (!result.canceled && result.assets && result.assets[0]) {
        const imageBase64 = result.assets[0].base64;
        if (imageBase64) {
          console.log('Image selected from gallery, size:', imageBase64.length);
          searchAnimeByImage(imageBase64);
        } else {
          showToast('Failed to process image. Please try again.', true);
        }
      }
    } catch (error) {
      console.error('Error picking image from gallery:', error);
      showToast('Error selecting image. Please try again.', true);
    }
  };
  
  const searchAnimeByImage = async (base64Image: string) => {
    setImageSearching(true);
    setError(null);
    
    try {
      console.log('Starting image search with Trace Moe API');
      
      // Make request to Trace Moe API
      const response = await axios({
        method: 'post',
        url: TRACE_MOE_API_ENDPOINT,
        data: base64Image,
        headers: {
          'Content-Type': 'image/jpeg;base64',
        },
        params: {
          cutBorders: true,
        },
        timeout: 30000, // 30 second timeout
      });
      
      console.log('Trace Moe API response received:', response.status);
      
      if (response.data && response.data.result && response.data.result.length > 0) {
        const bestMatch = response.data.result[0];
        const similarity = Math.round(bestMatch.similarity * 100);
        
        console.log('Best match found:', {
          animeId: bestMatch.anilist,
          similarity: similarity
        });
        
        // If similarity is too low, show warning
        if (similarity < 70) {
          showToast(`Low confidence match (${similarity}%). Try with a clearer screenshot.`, true);
          setImageSearching(false);
          return;
        }
        
        const animeId = bestMatch.anilist;
        
        setFoundAnimeTitle(bestMatch.filename);
        
        // Show success toast and navigate to anime page
        showToast(`Found "${bestMatch.filename}" (${similarity}% match)`);
        
        // Add a small delay before navigating to ensure toast is visible
        setTimeout(() => {
          // Navigate to anime details page
          console.log('Navigating to anime details page with ID:', animeId);
          router.push({
            pathname: '/anime/[id]',
            params: { id: animeId }
          });
          onClose();
        }, 1000);
      } else {
        console.log('No matches found in Trace Moe response');
        showToast('No matches found. Try with a different image.', true);
      }
    } catch (error: any) {
      console.error('Error searching anime by image:', error);
      
      // More detailed error handling
      if (error.response) {
        console.error('Error response data:', error.response.data);
        console.error('Error response status:', error.response.status);
        
        if (error.response.status === 429) {
          showToast('Rate limit exceeded. Please try again later.', true);
        } else {
          showToast(`Server error: ${error.response.status}. Please try again.`, true);
        }
      } else if (error.request) {
        console.error('No response received:', error.request);
        showToast('No response from server. Check your internet connection.', true);
      } else {
        console.error('Error message:', error.message);
        showToast('Error searching by image. Please try again.', true);
      }
    } finally {
      setImageSearching(false);
    }
  };

  if (!visible) return null;

  return (
    <View style={styles.container}>
      <Modal
        visible={visible}
        transparent={true}
        onRequestClose={onClose}
        animationType="fade"
        statusBarTranslucent={true}
        presentationStyle="overFullScreen"
      >
        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0, 0, 0, 0.8)' }]}>
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
                style={[styles.imageSearchButton, { backgroundColor: isDarkMode ? '#2A2A2A' : '#FFFFFF' }]}
                onPress={handleImageSearchPress}
              >
                <FontAwesome5
                  name="camera"
                  size={16}
                  color={currentTheme.colors.primary}
                />
              </TouchableOpacity>
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

            {/* Show active filters if any */}
            {(filters.genres.length > 0 || filters.format.length > 0) && (
              <View style={styles.activeFilterContainer}>
                <Text style={[styles.activeFilterLabel, { color: currentTheme.colors.textSecondary }]}>
                  Active Filters:
                </Text>
                <View style={styles.activeFilterChips}>
                  {filters.genres.length > 0 && (
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
                  )}
                  {filters.format.length > 0 && (
                    <View style={[styles.activeGenreChip, { backgroundColor: '#FF6B35' }]}>
                      <Text style={styles.activeGenreChipText}>
                        {filters.format[0]}
                      </Text>
                      <TouchableOpacity
                        onPress={() => {
                          setFilters(prev => ({
                            ...prev,
                            format: []
                          }));
                          setTimeout(() => searchAnime(query), 100);
                        }}
                        style={styles.clearGenreButton}
                      >
                        <FontAwesome5 name="times" size={12} color="#FFFFFF" />
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </View>
            )}

            {loading || imageSearching ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color={currentTheme.colors.primary} />
                {imageSearching && (
                  <Text style={[styles.imageSearchingText, { color: currentTheme.colors.text }]}>
                    Searching for anime by image...
                  </Text>
                )}
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
                        color={currentTheme.colors.error || 'red'}
                        style={{ marginBottom: 8 }}
                      />
                      <Text style={[styles.errorText, { color: currentTheme.colors.error || 'red' }]}>{error}</Text>
                    </View>
                  ) : query.length > 0 && !loading ? (
                    <View style={styles.noResults}>
                      <FontAwesome5 
                        name="search" 
                        size={24} 
                        color={currentTheme.colors.textSecondary}
                        style={{ marginBottom: 8, opacity: 0.5 }}
                      />
                      <Text style={[styles.noResultsText, { color: currentTheme.colors.textSecondary }]}>No results found</Text>
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
          
          {/* Image Picker Modal */}
          {showImagePickerModal && (
            <TouchableOpacity 
              style={StyleSheet.absoluteFill}
              activeOpacity={1}
              onPress={handleImagePickerClose}
            >
              <View style={styles.imagePickerModal}>
                {!showUrlInput ? (
                  <>
                    <TouchableOpacity style={styles.imagePickerOption} onPress={handleUrlInputPress}>
                      <FontAwesome5 name="link" size={24} color="#FFFFFF" />
                      <Text style={styles.imagePickerOptionText}>Enter Image URL</Text>
                    </TouchableOpacity>
                    
                    <View style={styles.imagePickerDivider} />
                    
                    <TouchableOpacity style={styles.imagePickerOption} onPress={pickImageFromCamera}>
                      <FontAwesome5 name="camera" size={24} color="#FFFFFF" />
                      <Text style={styles.imagePickerOptionText}>Take a Photo</Text>
                    </TouchableOpacity>
                    
                    <View style={styles.imagePickerDivider} />
                    
                    <TouchableOpacity style={styles.imagePickerOption} onPress={pickImageFromGallery}>
                      <FontAwesome5 name="image" size={24} color="#FFFFFF" />
                      <Text style={styles.imagePickerOptionText}>Choose from Gallery</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity style={styles.imagePickerCancel} onPress={handleImagePickerClose}>
                      <Text style={styles.imagePickerCancelText}>Cancel</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <View style={styles.urlInputContainer}>
                    <Text style={styles.urlInputTitle}>Enter Image URL</Text>
                    <TextInput
                      style={styles.urlTextInput}
                      placeholder="https://example.com/image.jpg"
                      placeholderTextColor="#999"
                      value={imageUrl}
                      onChangeText={setImageUrl}
                      autoFocus
                      autoCapitalize="none"
                      autoCorrect={false}
                      keyboardType="url"
                    />
                    <View style={styles.urlInputButtons}>
                      <TouchableOpacity 
                        style={[styles.urlInputButton, styles.urlCancelButton]} 
                        onPress={() => setShowUrlInput(false)}
                      >
                        <Text style={styles.urlButtonText}>Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={[styles.urlInputButton, styles.urlSearchButton]} 
                        onPress={handleUrlSearch}
                      >
                        <Text style={styles.urlButtonText}>Search</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          )}
          
          {/* Toast Notifications */}
          {showSuccessToast && (
            <SuccessToast
              message={toastMessage}
              duration={5000}
              onDismiss={() => setShowSuccessToast(false)}
            />
          )}
          
          {showErrorToast && (
            <ErrorToast
              message={toastMessage}
              duration={5000}
              onDismiss={() => setShowErrorToast(false)}
            />
          )}
        </View>
      </Modal>
    </View>
  );
}