import React from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, Dimensions, Platform, StatusBar, ActivityIndicator, Animated, Pressable, Share, Linking, DeviceEventEmitter, Modal } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import axios from 'axios';
import { ANILIST_GRAPHQL_ENDPOINT, STORAGE_KEY } from '../../constants/auth';
import { JIKAN_API_ENDPOINT, YOUTUBE_API_KEY } from '../../constants/api';
import { FontAwesome5 } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useAuth } from '../../hooks/useAuth';
import { useTheme, lightTheme, darkTheme } from '../../hooks/useTheme';
import * as SecureStore from 'expo-secure-store';
import ImageColors from 'react-native-image-colors';
import * as Haptics from 'expo-haptics';
import WatchTab from '../../components/WatchTab';
import { Menu, MenuItem } from 'react-native-material-menu';
import ListEditorModal from '../../components/ListEditorModal';
import SuccessToast from '../../components/SuccessToast';
import ErrorToast from '../../components/ErrorToast';
import BottomSheet, { BottomSheetScrollView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import { getRatingColor, getStatusColor } from '../../utils/colors';
import { WebView } from 'react-native-webview';
import { useOrientation } from '../../hooks/useOrientation';
import { Innertube } from 'youtubei.js';

interface AnimeDetails {
  id: number;
  title: {
    userPreferred: string;
    native: string;
    english: string;
  };
  coverImage: {
    extraLarge: string;
    large: string;
    medium: string;
    color: string;
  };
  bannerImage: string;
  description: string | null;
  episodes: number;
  duration: number;
  status: string;
  season: string;
  seasonYear: number;
  studios: {
    nodes: {
      id: number;
      name: string;
    }[];
  };
  trailer?: {
    id: string;
    site: string;
    thumbnail: string;
  };
  startDate: {
    year: number;
    month: number;
    day: number;
  };
  endDate: {
    year: number;
    month: number;
    day: number;
  };
  averageScore: number;
  trending: number;
  rankings: {
    rank: number;
    type: string;
    context: string;
  }[];
  genres: string[];
  nextAiringEpisode: {
    airingAt: number;
    timeUntilAiring: number;
    episode: number;
  } | null;
  characters: {
    edges: {
      role: string;
      node: {
        id: number;
        name: {
          userPreferred: string;
        };
        image: {
          medium: string;
        };
      };
      voiceActors: {
        id: number;
        name: {
          userPreferred: string;
        };
        image: {
          medium: string;
        };
        languageV2: string;
      }[];
    }[];
  };
  staff: {
    edges: {
      role: string;
      node: {
        id: number;
        name: {
          userPreferred: string;
        };
        image: {
          medium: string;
        };
      };
    }[];
  };
  relations: {
    edges: {
      relationType: string;
      node: {
        id: number;
        type: string;
        title: {
          userPreferred: string;
        };
        coverImage: {
          medium: string;
        };
        status: string;
        nextAiringEpisode: {
          episode: number;
          airingAt: number;
        } | null;
        format: string;
      };
    }[];
  };
  recommendations: {
    nodes: {
      mediaRecommendation: {
        id: number;
        title: {
          userPreferred: string;
        };
        coverImage: {
          medium: string;
        };
        averageScore: number;
      };
    }[];
  };
  reviews: {
    nodes: {
      id: number;
      summary: string;
      score: number;
      user: {
        name: string;
        avatar: {
          medium: string;
        };
      };
    }[];
  };
  mediaListEntry?: {
    id: number;
    status: string;
    score: number;
    progress: number;
    private: boolean;
    notes: string;
    repeat: number;
    updatedAt: number;
    hiddenFromStatusLists: boolean;
    startedAt: {
      year: number;
      month: number;
      day: number;
    };
    completedAt: {
      year: number;
      month: number;
      day: number;
    };
    customLists: string[];
  } | null;
  isFavourite: boolean;
  idMal?: number;
  format: string;
}

interface Episode {
  id: string;
  number: number;
  title: string;
  description: string;
  image: string;
  duration: number;
  isFiller: boolean;
}

interface JikanEpisode {
  mal_id: number;
  title: string;
  title_japanese?: string;
  title_romanji?: string;
  aired?: string;
  score?: number;
  filler: boolean;
  recap?: boolean;
  forum_url?: string;
  duration?: number;
  synopsis?: string;
  url?: string;
  images?: {
    jpg?: {
      image_url?: string;
    };
  };
}

interface JikanEpisodeVideo {
  mal_id: number;
  title: string;
  episode: string;
  url: string;
  images: {
    jpg: {
      image_url: string;
    };
  };
}

interface YouTubeSearchResponse {
  items: {
    id: {
      videoId: string;
    };
  }[];
}

interface WatchOrderItem {
  anilistId: string;
  malId: string;
  title: string;
  details: {
    airDates: {
      start: string;
      end: string | null;
    };
    format: string;
    episodes: number | null;
    duration: number;
    score: number;
    viewers: number;
  };
  related: Record<string, string>;
  order: number;
  image?: string; // Add the image field from the API
  imageUrl?: string; // Image URL field from the response
  mediaListStatus?: string; // User's progress status (WATCHING, PLANNING, etc.)
}

export default function AnimeDetailsScreen() {
  const { id, fromActivities, tab } = useLocalSearchParams();
  const { user } = useAuth();
  const { isDarkMode } = useTheme();
  const { lockPortrait } = useOrientation();
  const currentTheme = isDarkMode ? darkTheme : lightTheme;
  const [details, setDetails] = useState<AnimeDetails | null>(null);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [loading, setLoading] = useState(true);
  const [episodesLoading, setEpisodesLoading] = useState(true);
  const [expandedSynopsis, setExpandedSynopsis] = useState(false);
  const scrollY = useRef(new Animated.Value(0)).current;
  const router = useRouter();
  const [isLiked, setIsLiked] = useState(false);
  const [textColor, setTextColor] = useState('#333');
  const heartScale = useRef(new Animated.Value(1)).current;
  const backButtonScale = useRef(new Animated.Value(1)).current;
  const navbarOpacity = useRef(new Animated.Value(0)).current;
  const [navbarColor, setNavbarColor] = useState('rgba(255, 255, 255, 0.85)');
  const [navbarBlur, setNavbarBlur] = useState(0);
  const [activeTab, setActiveTab] = useState(tab === 'watch' ? 'watch' : 'info');
  const [expandedReviews, setExpandedReviews] = useState<number[]>([]);
  const [showListEditor, setShowListEditor] = useState(false);
  const [selectedReview, setSelectedReview] = useState<{
    id: number;
    summary: string;
    score: number;
    user: {
      name: string;
      avatar: {
        medium: string;
      };
    };
  } | null>(null);
  const bottomSheetRef = useRef<BottomSheet>(null);
  const [youtubeVideoId, setYoutubeVideoId] = useState<string | null>(null);
  const [isVideoLoading, setIsVideoLoading] = useState(true);
  const [error, setError] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [isPlaying, setIsPlaying] = useState(true);
  const webviewRef = useRef<WebView>(null);
  const [isVideoEnded, setIsVideoEnded] = useState(false);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const [watchOrder, setWatchOrder] = useState<WatchOrderItem[]>([]);
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});
  const [showTrendingModal, setShowTrendingModal] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [showErrorToast, setShowErrorToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  // Add snapPoints for bottom sheet
  const snapPoints = useMemo(() => ['70%'], []);

  // Lock portrait orientation when component mounts
  useEffect(() => {
    lockPortrait();
  }, []);

  // Add a useEffect to ensure we fetch episodes initially
  useEffect(() => {
    // Set a flag to track initial render
    const isInitialRender = !episodes || episodes.length === 0;
    
    // If this is the initial render and we're on the watch tab, make sure episodes are loaded
    if (isInitialRender && activeTab === 'watch' && !episodesLoading && details) {
      fetchEpisodes();
    }
  }, [activeTab, details, episodes, episodesLoading]);

  // Helper functions
  const formatStatus = (status: string | undefined) => {
    if (!status) return 'Add to List';
    return status.charAt(0) + status.slice(1).toLowerCase();
  };

  // Helper function to get status color for the watch order items
  const getWatchOrderStatusColor = (status: string | undefined, isDarkMode: boolean) => {
    if (!status) return undefined;
    
    switch (status) {
      case 'CURRENT':
      case 'WATCHING':
        return isDarkMode ? 'rgba(46, 204, 113, 0.7)' : 'rgba(46, 204, 113, 0.3)';
      case 'COMPLETED':
      case 'FINISHED':
        return isDarkMode ? 'rgba(74, 144, 226, 0.7)' : 'rgba(74, 144, 226, 0.3)';
      case 'PLANNING':
      case 'PLAN_TO_WATCH':
        return isDarkMode ? 'rgba(155, 89, 182, 0.7)' : 'rgba(155, 89, 182, 0.3)';
      case 'DROPPED':
        return isDarkMode ? 'rgba(231, 76, 60, 0.7)' : 'rgba(231, 76, 60, 0.3)';
      case 'PAUSED':
      case 'ON_HOLD':
        return isDarkMode ? 'rgba(243, 156, 18, 0.7)' : 'rgba(243, 156, 18, 0.3)';
      default:
        return undefined;
    }
  };

  // Helper function to get appropriate border for status
  const getWatchOrderStatusBorder = (status: string | undefined) => {
    if (!status) return undefined;
    
    switch (status) {
      case 'CURRENT':
      case 'WATCHING':
        return '#2ECC71'; // Green
      case 'COMPLETED':
      case 'FINISHED':
        return '#4A90E2'; // Blue
      case 'PLANNING':
      case 'PLAN_TO_WATCH':
        return '#9B59B6'; // Purple
      case 'DROPPED':
        return '#E74C3C'; // Red
      case 'PAUSED':
      case 'ON_HOLD':
        return '#F39C12'; // Orange
      default:
        return undefined;
    }
  };

  // Helper function to format status label
  const formatWatchOrderStatus = (status: string | undefined) => {
    if (!status) return '';
    
    switch (status) {
      case 'CURRENT':
        return 'Watching';
      case 'COMPLETED':
        return 'Completed';
      case 'PLANNING':
      case 'PLAN_TO_WATCH':
        return 'Planning';
      case 'DROPPED':
        return 'Dropped';
      case 'PAUSED':
      case 'ON_HOLD':
        return 'On Hold';
      default:
        return status.charAt(0) + status.slice(1).toLowerCase();
    }
  };

  // AniList validation helpers
  const validateAnilistId = async (anilistId: string): Promise<boolean> => {
    try {
      // Check if the anime exists in AniList
      const query = `
        query ($id: Int) {
          Media(id: $id, type: ANIME) {
            id
            title {
              userPreferred
            }
          }
        }
      `;
      
      const response = await axios.post(
        ANILIST_GRAPHQL_ENDPOINT,
        {
          query,
          variables: {
            id: parseInt(anilistId)
          }
        }
      );

      return !!response.data?.data?.Media;
    } catch (error) {
      console.error('Error validating AniList ID:', error);
      return false;
    }
  };

  const searchAnilistTitle = async (title: string): Promise<number | null> => {
    try {
      const query = `
        query ($search: String) {
          Media(search: $search, type: ANIME) {
            id
            title {
              userPreferred
              romaji
              english
              native
            }
          }
        }
      `;
      
      const response = await axios.post(
        ANILIST_GRAPHQL_ENDPOINT,
        {
          query,
          variables: {
            search: title
          }
        }
      );

      return response.data?.data?.Media?.id || null;
    } catch (error) {
      console.error('Error searching for anime title:', error);
      return null;
    }
  };

  // Function to safely navigate to anime
  const navigateToAnime = async (item: WatchOrderItem) => {
    try {
      setIsNavigating(true);
      
      // First try using the anilistId directly
      const isValid = await validateAnilistId(item.anilistId);
      
      if (isValid) {
        router.push(`/anime/${item.anilistId}`);
        return;
      }
      
      // If direct ID doesn't work, try searching by title
      const searchId = await searchAnilistTitle(item.title);
      
      if (searchId) {
        router.push(`/anime/${searchId}`);
        return;
      }
      
      // If all else fails, show an alert
      alert(`Could not find anime "${item.title}" in AniList database`);
    } catch (error) {
      console.error('Error navigating to anime:', error);
      alert('An error occurred while trying to navigate. Please try again.');
    } finally {
      setIsNavigating(false);
    }
  };

  // Handle review click
  const handleReviewPress = useCallback(async (review: {
    id: number;
    summary: string;
    score: number;
    user: {
      name: string;
      avatar: {
        medium: string;
      };
    };
  }) => {
    try {
      const url = `https://anilist.co/review/${review.id}`;
      const supported = await Linking.canOpenURL(url);

      if (supported) {
        await Linking.openURL(url);
      }
    } catch (error) {
      console.error('Error opening review:', error);
    }
  }, []);

  // Handle bottom sheet changes
  const handleSheetChanges = useCallback((index: number) => {
    if (index === -1) {
      setSelectedReview(null);
    }
  }, []);

  useEffect(() => {
    fetchAnimeDetails();
  }, [id]);

  useEffect(() => {
    if (details) {
      fetchEpisodes();
    }
  }, [details]);

  // Add useEffect to debug watch order data
  useEffect(() => {
    if (details && watchOrder.length > 0) {
      console.log('Current watch order state (first 3 items):', JSON.stringify(watchOrder.slice(0, 3)));
      console.log('Image URLs sample:');
      watchOrder.slice(0, 3).forEach(item => {
        console.log(`Anime: ${item.title}, image: ${item.image || 'N/A'}, imageUrl: ${item.imageUrl || 'N/A'}`);
      });
    }
  }, [watchOrder, details]);

  const fetchEpisodes = async () => {
    if (!details) return;
    
    try {
      setEpisodesLoading(true);
      
      if (!details.idMal) {
        console.log('No MAL ID available');
        setEpisodes([]);
        setEpisodesLoading(false);
        return;
      }

      console.log('Fetching episodes list from Jikan API for MAL ID:', details.idMal);
      const [episodesResponse, videosResponse] = await Promise.all([
        axios.get(`${JIKAN_API_ENDPOINT}/anime/${details.idMal}/episodes`, {
          params: { page: 1 }
        }),
        axios.get(`${JIKAN_API_ENDPOINT}/anime/${details.idMal}/videos/episodes`)
      ]);
      
      const jikanEpisodes = episodesResponse.data?.data || [];
      const pagination = episodesResponse.data?.pagination;
      const episodeVideos = videosResponse.data?.data || [];
      console.log('Found episodes on page 1:', jikanEpisodes.length);
      console.log('Found episode videos:', episodeVideos.length);
      console.log('Pagination info:', pagination);

      let allEpisodes = [...jikanEpisodes];

      // Fetch remaining pages if any
      if (pagination?.has_next_page) {
        const totalPages = pagination.last_visible_page;
        console.log('Fetching remaining pages, total pages:', totalPages);

        const remainingPages = [];
        for (let page = 2; page <= totalPages; page++) {
          remainingPages.push(
            axios.get(`${JIKAN_API_ENDPOINT}/anime/${details.idMal}/episodes`, {
              params: { page }
            })
          );
        }

        const remainingResponses = await Promise.all(remainingPages);
        for (const pageResponse of remainingResponses) {
          if (pageResponse.data?.data) {
            allEpisodes = [...allEpisodes, ...pageResponse.data.data];
          }
        }
        console.log('Total episodes after fetching all pages:', allEpisodes.length);
      }

      // Create a map of episode videos by episode number
      const videoMap = new Map<number, JikanEpisodeVideo>();
      episodeVideos.forEach((video: JikanEpisodeVideo) => {
        console.log('Processing video:', video);
        // Extract just the number from "Episode X"
        const episodeNumber = parseInt(video.episode.replace('Episode ', ''));
        if (!isNaN(episodeNumber)) {
          videoMap.set(episodeNumber, video);
        }
      });

      let formattedEpisodes: any[] = [];

      if (allEpisodes.length > 0) {
        // Normal case: we have episode data
        formattedEpisodes = allEpisodes
          .filter((ep): ep is JikanEpisode => ep !== null)
          .map((ep: JikanEpisode, index: number) => {
            // Use index + 1 to match episode numbers since they start from 1
            const episodeNumber = index + 1;
            const video = videoMap.get(episodeNumber);
            console.log(`Episode ${episodeNumber} mapped to video:`, video);
            
            // Keep the original episode data but use the video thumbnail if available
            return {
              id: `${details.idMal}-${episodeNumber}`,
              number: episodeNumber,
              title: ep.title || `Episode ${episodeNumber}`,
              description: ep.synopsis || '',
              image: video?.images?.jpg?.image_url || details.coverImage.large,
              duration: ep.duration || details.duration || 24,
              isFiller: ep.filler || false,
              aired: ep.aired
            };
          });
      } else if (episodeVideos.length > 0) {
        // Movie case: no episodes but we have videos
        console.log('No episodes found but videos exist - treating as movie');
        formattedEpisodes = episodeVideos.map((video: JikanEpisodeVideo, index: number) => {
          const episodeNumber = parseInt(video.episode.replace('Episode ', '')) || (index + 1);
          console.log(`Creating movie episode ${episodeNumber} from video:`, video);
          
          return {
            id: `${details.idMal}-${episodeNumber}`,
            number: episodeNumber,
            title: video.title || details.title.userPreferred || `Episode ${episodeNumber}`,
            description: details.description || 'Movie',
            image: video.images?.jpg?.image_url || details.coverImage.large,
            duration: details.duration || 120, // Default movie duration
            isFiller: false,
            aired: details.startDate ? `${details.startDate.year}-${String(details.startDate.month).padStart(2, '0')}-${String(details.startDate.day).padStart(2, '0')}` : undefined
          };
        });
      } else if (details.format === 'MOVIE' || details.episodes === 1) {
        // Fallback for movies with no video data
        console.log('Creating fallback movie episode');
        formattedEpisodes = [{
          id: `${details.idMal}-1`,
          number: 1,
          title: details.title.userPreferred || 'Movie',
          description: details.description || 'Movie',
          image: details.coverImage.large,
          duration: details.duration || 120,
          isFiller: false,
          aired: details.startDate ? `${details.startDate.year}-${String(details.startDate.month).padStart(2, '0')}-${String(details.startDate.day).padStart(2, '0')}` : undefined
        }];
      }
      
      console.log('Final formatted episodes:', formattedEpisodes.map(ep => ({
        number: ep.number,
        title: ep.title,
        image: ep.image
      })));
      
      setEpisodes(formattedEpisodes);
    } catch (error) {
      console.error('Error fetching episodes from Jikan:', error);
      // Create a fallback episode for movies even on error
      if (details.format === 'MOVIE' || details.episodes === 1) {
        setEpisodes([{
          id: `${details.idMal}-1`,
          number: 1,
          title: details.title.userPreferred || 'Movie',
          description: details.description || 'Movie',
          image: details.coverImage.large,
          duration: details.duration || 120,
          isFiller: false
        }]);
      } else {
        setEpisodes([{
          id: 'error',
          number: 0,
          title: 'Error Loading Episodes',
          description: 'Unable to load episodes. Please try again later.',
          image: details.coverImage.large,
          duration: 0,
          isFiller: false
        }]);
      }
    } finally {
      setEpisodesLoading(false);
    }
  };
  

  useEffect(() => {
    if (details) {
      const color = details.coverImage.color || '#02A9FF';
      const isDark = isColorDark(color);
      setTextColor(isDark ? '#fff' : '#333');
    }
  }, [details]);

  const isColorDark = (color: string) => {
    const hex = color.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    return brightness < 128;
  };

  const animateHeart = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsLiked(!isLiked);
    Animated.sequence([
      Animated.spring(heartScale, {
        toValue: 1.2,
        useNativeDriver: true,
        speed: 50,
        bounciness: 12,
      }),
      Animated.spring(heartScale, {
        toValue: 1,
        useNativeDriver: true,
        speed: 50,
        bounciness: 12,
      }),
    ]).start();
  };

  const handleShare = async () => {
    if (!details) return;

    try {
      await Share.share({
        message: `Check out ${details.title.userPreferred} on AniList!\nhttps://anilist.co/anime/${details.id}`,
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  const handleLikePress = async () => {
    if (!details) return;

    try {
      const token = await SecureStore.getItemAsync(STORAGE_KEY.AUTH_TOKEN);
      if (!token) {
        // Show login prompt if not logged in
        alert('Please log in to favorite anime');
        return;
      }

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      
      // Toggle favorite status
      const mutation = `
        mutation ($animeId: Int) {
          ToggleFavourite(animeId: $animeId) {
            anime {
              nodes {
                id
                isFavourite
              }
            }
          }
        }
      `;

      await axios.post(
        ANILIST_GRAPHQL_ENDPOINT,
        {
          query: mutation,
          variables: {
            animeId: details.id
          }
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          }
        }
      );

      const newLikeStatus = !isLiked;
      setIsLiked(newLikeStatus);
      DeviceEventEmitter.emit('updateLikeStatus', newLikeStatus);
      
      // Animate heart
      Animated.sequence([
        Animated.spring(heartScale, {
          toValue: 1.2,
          useNativeDriver: true,
          speed: 50,
        }),
        Animated.spring(heartScale, {
          toValue: 1,
          useNativeDriver: true,
          speed: 50,
        }),
      ]).start();

    } catch (error) {
      console.error('Error toggling favorite:', error);
      alert('Failed to update favorite status');
    }
  };

  const handleBack = () => {
    if (fromActivities === '1') {
      // If we came from activities, show the activities modal again
      router.back();
      setTimeout(() => {
        // Show the activities modal after a short delay to allow the navigation to complete
        DeviceEventEmitter.emit('showActivities');
      }, 100);
    } else {
      router.back();
    }
  };

  const fetchWatchOrder = async (animeId: string) => {
    try {
      console.log(`Fetching watch order for anime ID: ${animeId}`);
      const response = await axios.get(`http://magaapinovel.xyz/anilist/info/${animeId}`);
      
      // Log the essential response properties
      console.log('Response data properties:', Object.keys(response.data || {}));
      console.log('Success property:', response.data?.success);
      
      if (response.data?.data) {
        console.log('Data property keys:', Object.keys(response.data.data));
      }
      
      // The field is named "WatchOrder" in the API response
      const watchOrderData = response.data?.data?.WatchOrder;
      
      if (watchOrderData && Array.isArray(watchOrderData)) {
        // Process the watch order data with date validation
        const currentDate = new Date();
        const processedWatchOrder = watchOrderData
          .filter(item => {
            // Parse the start date
            const startDate = item.details?.airDates?.start ? new Date(item.details.airDates.start) : null;
            
            // If no start date or invalid date, exclude the item
            if (!startDate || isNaN(startDate.getTime())) {
              console.log(`Excluding item with invalid start date: ${item.title}`);
              return false;
            }
            
            // If start date is more than 6 months in the future, exclude it
            // This helps prevent showing incorrect future dates while still allowing for upcoming seasons
            const sixMonthsFromNow = new Date();
            sixMonthsFromNow.setMonth(sixMonthsFromNow.getMonth() + 6);
            
            if (startDate > sixMonthsFromNow) {
              console.log(`Excluding item with far future date: ${item.title}, date: ${startDate}`);
              return false;
            }
            
            return true;
          })
          .map(item => {
            // If the API provides the full URL in the imageUrl field, use that
            if (item.imageUrl) {
              return item;
            }
            
            // If there's only the imageUrl present in the response
            if (response.data?.data?.imageUrl && typeof response.data.data.imageUrl === 'object') {
              // Check if there's an image URL for this specific anime ID
              const imageUrlMap = response.data.data.imageUrl;
              if (imageUrlMap && imageUrlMap[item.anilistId]) {
                return { 
                  ...item, 
                  imageUrl: imageUrlMap[item.anilistId] 
                };
              }
            }
            
            return item;
          });
        
        // After we have the watch order, fetch user's list statuses for these anime if logged in
        if (user) {
          try {
            const token = await SecureStore.getItemAsync(STORAGE_KEY.AUTH_TOKEN);
            if (token) {
              // Get list of IDs to query
              const animeIds = processedWatchOrder.map(item => parseInt(item.anilistId)).filter(id => !isNaN(id));
              
              // If we have valid IDs, fetch user's media list entries
              if (animeIds.length > 0) {
                console.log(`Fetching media list status for ${animeIds.length} anime IDs`);
                
                const query = `
                  query ($userId: Int, $ids: [Int]) {
                    MediaListCollection(userId: $userId, type: ANIME, mediaId_in: $ids) {
                      lists {
                        entries {
                          mediaId
                          status
                          progress
                        }
                      }
                    }
                  }
                `;
                
                const response = await axios.post(
                  ANILIST_GRAPHQL_ENDPOINT,
                  {
                    query,
                    variables: {
                      userId: user.id,
                      ids: animeIds
                    }
                  },
                  {
                    headers: {
                      'Authorization': `Bearer ${token}`,
                      'Content-Type': 'application/json',
                      'Accept': 'application/json',
                    }
                  }
                );
                
                // Create a map of mediaId -> status
                const statusMap: Record<string, string> = {};
                
                // Process response to extract status for each anime
                if (response.data?.data?.MediaListCollection?.lists) {
                  response.data.data.MediaListCollection.lists.forEach((list: any) => {
                    if (list.entries) {
                      list.entries.forEach((entry: any) => {
                        if (entry.mediaId) {
                          statusMap[entry.mediaId.toString()] = entry.status;
                        }
                      });
                    }
                  });
                  
                  console.log('Media status map:', statusMap);
                  
                  // Update watch order with status info
                  processedWatchOrder.forEach(item => {
                    if (statusMap[item.anilistId]) {
                      item.mediaListStatus = statusMap[item.anilistId];
                    }
                  });
                }
              }
            }
          } catch (error) {
            console.error('Error fetching media list statuses:', error);
            // Non-critical, so we continue without status info
          }
        }
        
        setWatchOrder(processedWatchOrder);
        console.log(`Watch order found with ${processedWatchOrder.length} items`);
        
        // Log the first item for debugging
        if (processedWatchOrder.length > 0) {
          console.log('First watch order item after processing:', JSON.stringify(processedWatchOrder[0]));
        }
      } else {
        console.log('No watch order data available or invalid format');
      }
    } catch (error) {
      console.error('Error fetching watch order:', error);
      // Not setting error state as this is a non-critical feature
    }
  };

  const fetchAnimeDetails = async () => {
    try {
      const token = await SecureStore.getItemAsync(STORAGE_KEY.AUTH_TOKEN);
      const query = `
        query ($id: Int, $isAuth: Boolean!) {
          Media(id: $id, type: ANIME) {
            id
            idMal
            title {
              userPreferred
              native
              english
            }
            coverImage {
              extraLarge
              large
              medium
              color
            }
            bannerImage
            description
            episodes
            duration
            status
            season
            seasonYear
            studios {
              nodes {
                id
                name
              }
            }
            trailer {
              id
              site
              thumbnail
            }
            startDate {
              year
              month
              day
            }
            endDate {
              year
              month
              day
            }
            averageScore
            trending
            rankings {
              rank
              type
              context
            }
            genres
            nextAiringEpisode {
              airingAt
              timeUntilAiring
              episode
            }
            characters {
              edges {
                role
                node {
                  id
                  name {
                    userPreferred
                  }
                  image {
                    medium
                  }
                }
                voiceActors {
                  id
                  name {
                    userPreferred
                  }
                  image {
                    medium
                  }
                  languageV2
                }
              }
            }
            staff {
              edges {
                role
                node {
                  id
                  name {
                    userPreferred
                  }
                  image {
                    medium
                  }
                }
              }
            }
            relations {
              edges {
                relationType
                node {
                  id
                  type
                  title {
                    userPreferred
                  }
                  coverImage {
                    medium
                  }
                  status
                  nextAiringEpisode {
                    episode
                    airingAt
                  }
                  format
                }
              }
            }
            recommendations {
              nodes {
                mediaRecommendation {
                  id
                  title {
                    userPreferred
                  }
                  coverImage {
                    medium
                  }
                  averageScore
                }
              }
            }
            reviews {
              nodes {
                id
                summary
                score
                user {
                  name
                  avatar {
                    medium
                  }
                }
              }
            }
            isFavourite @include(if: $isAuth)
            mediaListEntry @include(if: $isAuth) {
              id
              status
              score
              progress
              private
              notes
              repeat
              updatedAt
              hiddenFromStatusLists
              startedAt {
                year
                month
                day
              }
              completedAt {
                year
                month
                day
              }
              customLists
            }
            format
          }
        }
      `;

      const response = await axios.post(
        ANILIST_GRAPHQL_ENDPOINT,
        {
          query,
          variables: {
            id: parseInt(id as string),
            isAuth: !!token === null ? false : !!token // Ensure isAuth is always a boolean
          }
        },
        {
          headers: token ? {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          } : {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          }
        }
      );

      if (response.data?.errors) {
        throw new Error(response.data.errors[0]?.message || 'GraphQL Error');
      }

      const animeDetails = response.data?.data?.Media;
      if (!animeDetails) {
        throw new Error('No anime details found');
      }

      setDetails(animeDetails);
      const initialLikeStatus = animeDetails.isFavourite || false;
      setIsLiked(initialLikeStatus);
      DeviceEventEmitter.emit('updateLikeStatus', initialLikeStatus);
      
      // Fetch watch order after details are loaded
      fetchWatchOrder(id as string);
    } catch (error) {
      console.error('Error fetching anime details:', error);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  const renderTabs = () => {
    // Don't show tabs for music videos
    if (details?.format === 'MUSIC' || details?.format === 'MUSIC_VIDEO') {
      return (
        <View style={styles.tabContainer}>
          <View style={[styles.tab, styles.activeTab, { backgroundColor: '#02A9FF' }]}>
            <Text style={[styles.tabText, { color: '#fff' }]}>Info</Text>
          </View>
        </View>
      );
    }

    return (
      <View style={styles.tabContainer}>
        <Pressable 
          style={[
            styles.tab, 
            activeTab === 'info' && [
              styles.activeTab,
              { backgroundColor: '#02A9FF' }
            ]
          ]}
          onPress={() => setActiveTab('info')}
        >
          <Text style={[
            styles.tabText,
            { color: activeTab === 'info' ? '#fff' : currentTheme.colors.textSecondary }
          ]}>Info</Text>
        </Pressable>
        <Pressable 
          style={[
            styles.tab, 
            activeTab === 'watch' && [
              styles.activeTab,
              { backgroundColor: '#02A9FF' }
            ]
          ]}
          onPress={() => setActiveTab('watch')}
        >
          <Text style={[
            styles.tabText,
            { color: activeTab === 'watch' ? '#fff' : currentTheme.colors.textSecondary }
          ]}>Watch</Text>
        </Pressable>
      </View>
    );
  };

  const renderWatchTab = () => (
    <View style={styles.watchTabContent}>
      <WatchTab 
        episodes={episodes} 
        loading={episodesLoading} 
        animeTitle={details?.title || { english: '', userPreferred: '' }}
        anilistId={details?.id?.toString()}
        malId={details?.idMal?.toString()}
        coverImage={details?.coverImage?.large}
        relations={details?.relations}
      />
    </View>
  );

  const toggleReview = (reviewId: number) => {
    setExpandedReviews(prev => 
      prev.includes(reviewId) 
        ? prev.filter(id => id !== reviewId)
        : [...prev, reviewId]
    );
  };

  const handleTrendingPress = () => {
    setShowTrendingModal(true);
  };

  const handleSaveListEdit = async (data: {
    status: string;
    progress: number;
    score: number;
    private: boolean;
    hideFromStatusLists: boolean;
    customLists: {
      watched: boolean;
    };
    notes: string;
    repeat: number;
    startedAt?: {
      year?: number;
      month?: number;
      day?: number;
    };
    completedAt?: {
      year?: number;
      month?: number;
      day?: number;
    };
  }) => {
    if (!details) return;

    try {
      const token = await SecureStore.getItemAsync(STORAGE_KEY.AUTH_TOKEN);
      if (!token) return;

      const mutation = `
        mutation (
          $mediaId: Int, 
          $status: MediaListStatus, 
          $score: Float, 
          $progress: Int,
          $private: Boolean,
          $notes: String,
          $repeat: Int,
          $customLists: [String],
          $startedAt: FuzzyDateInput,
          $completedAt: FuzzyDateInput
        ) {
          SaveMediaListEntry (
            mediaId: $mediaId, 
            status: $status,
            score: $score,
            progress: $progress,
            private: $private,
            notes: $notes,
            repeat: $repeat,
            customLists: $customLists,
            startedAt: $startedAt,
            completedAt: $completedAt
          ) {
            id
            status
            score
            progress
            private
            notes
            repeat
            customLists
            startedAt {
              year
              month
              day
            }
            completedAt {
              year
              month
              day
            }
          }
        }
      `;

      const response = await axios.post(
        ANILIST_GRAPHQL_ENDPOINT,
        {
          query: mutation,
          variables: {
            mediaId: details.id,
            status: data.status,
            score: data.score,
            progress: data.progress,
            private: data.private,
            notes: data.notes,
            repeat: data.repeat,
            customLists: data.customLists.watched ? ['watched_using_moopa'] : [],
            startedAt: data.startedAt ? {
              year: data.startedAt.year || undefined,
              month: data.startedAt.month || undefined,
              day: data.startedAt.day || undefined
            } : undefined,
            completedAt: data.completedAt ? {
              year: data.completedAt.year || undefined,
              month: data.completedAt.month || undefined,
              day: data.completedAt.day || undefined
            } : undefined
          }
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (response.data?.data?.SaveMediaListEntry) {
        setDetails(prev => prev ? {
          ...prev,
          mediaListEntry: response.data.data.SaveMediaListEntry
        } : null);
        
        // Emit events to refresh other parts of the app
        DeviceEventEmitter.emit('refreshMediaLists');
        DeviceEventEmitter.emit('refreshWatchlist');
        DeviceEventEmitter.emit('refreshReadlist');
        
        // Show success toast
        setToastMessage('List entry updated successfully!');
        setShowSuccessToast(true);
      }
    } catch (error) {
      console.error('Error updating media list entry:', error);
      
      // Show error toast
      setToastMessage('Failed to update list entry. Please try again.');
      setShowErrorToast(true);
      
      // Re-throw the error so the modal can handle it
      throw error;
    }
  };

  useEffect(() => {
    const shareListener = DeviceEventEmitter.addListener('shareAnime', handleShare);
    const likeListener = DeviceEventEmitter.addListener('toggleLike', handleLikePress);

    return () => {
      shareListener.remove();
      likeListener.remove();
    };
  }, [details]);

  // Modify the getYoutubeVideoId function to handle errors better
  const getYoutubeVideoId = async (animeTitle: string) => {
    try {
      // First try to use the trailer from AniList
      if (details?.trailer?.site === 'youtube' && details.trailer.id) {
        console.log('Using AniList trailer:', details.trailer.id);
        return details.trailer.id;
      }

      // If no trailer is available, search using YouTube Data API
      console.log('No AniList trailer found, searching YouTube...');
      const searchQuery = `${animeTitle} anime official trailer`;
      console.log('Search query:', searchQuery);
      
      // Check if YouTube API key is available
      if (!YOUTUBE_API_KEY) {
        console.log('No YouTube API key available, using fallback image');
        return null;
      }
      
      const response = await axios.get(
        `https://www.googleapis.com/youtube/v3/search`, {
          params: {
            part: 'snippet',
            q: searchQuery,
            type: 'video',
            maxResults: 1,
            key: YOUTUBE_API_KEY,
            videoDuration: 'short',
            order: 'relevance',
            regionCode: 'US',
            safeSearch: 'none'
          }
        }
      );

      // Log the entire response
      console.log('Full YouTube API Response:', JSON.stringify(response.data, null, 2));

      if (response.data?.items?.length > 0) {
        const videoId = response.data.items[0].id.videoId;
        console.log('Found video ID:', videoId);
        console.log('Video title:', response.data.items[0].snippet.title);
        return videoId;
      }

      console.log('No videos found in search results, using fallback image');
      return null;
    } catch (error: any) {
      console.error('Error getting video:', error);
      if (error.response) {
        console.error('Error details:', error.response.data);
        console.error('Error status:', error.response.status);
      } else {
        console.error('Error message:', error.message);
      }
      console.log('Error occurred, using fallback image');
      return null;
    }
  };

  // Add effect to load YouTube video
  useEffect(() => {
    if (details?.title?.userPreferred) {
      getYoutubeVideoId(details.title.userPreferred).then(videoId => {
        if (videoId) {
          setYoutubeVideoId(videoId);
        }
        setIsVideoLoading(false);
      });
    }
  }, [details]);

  // Add useEffect to lock portrait orientation
  useEffect(() => {
    const lockOrientation = async () => {
      try {
        await lockPortrait();
      } catch (error) {
        console.log('Failed to lock orientation:', error);
        // Continue without locking orientation if it fails
      }
    };

    lockOrientation();

    // Cleanup function
    return () => {
      // No need to unlock here as the screen will handle orientation automatically when unmounted
    };
  }, [lockPortrait]);

  // Add custom header component
  const renderCustomHeader = () => (
    <View style={styles.customHeader}>
      <BlurView 
        tint={isDarkMode ? "dark" : "light"} 
        intensity={80} 
        style={StyleSheet.absoluteFill} 
      />
      <View style={styles.headerContent}>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => handleBack()}
        >
          <FontAwesome5 name="arrow-left" size={20} color={currentTheme.colors.text} />
        </TouchableOpacity>
        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={handleShare}
          >
            <FontAwesome5 name="share-alt" size={20} color={currentTheme.colors.text} />
          </TouchableOpacity>
          {user && !user.isAnonymous && (
            <TouchableOpacity
              style={styles.headerButton}
              onPress={handleLikePress}
            >
              <FontAwesome5 
                name="heart" 
                solid={isLiked}
                size={20} 
                color={isLiked ? '#FF2E51' : currentTheme.colors.text} 
              />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: currentTheme.colors.background }]}>
        <ActivityIndicator size="large" color="#02A9FF" />
      </View>
    );
  }

  if (!details) {
    return (
      <View style={[styles.errorContainer, { backgroundColor: currentTheme.colors.background }]}>
        <Text style={[styles.errorText, { color: currentTheme.colors.text }]}>Failed to load anime details</Text>
        <TouchableOpacity style={styles.retryButton} onPress={fetchAnimeDetails}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const headerOpacity = scrollY.interpolate({
    inputRange: [0, 200],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const navbarBackground = scrollY.interpolate({
    inputRange: [0, 100],
    outputRange: ['rgba(255, 255, 255, 0)', navbarColor],
    extrapolate: 'clamp',
  });

  const navbarBlurIntensity = scrollY.interpolate({
    inputRange: [0, 100],
    outputRange: [0, 100],
    extrapolate: 'clamp',
  });

  // Helper function to format dates in a concise way
  const formatReleaseDate = (dateString: string) => {
    if (!dateString) return '';
    
    // Try to extract year from the string
    const yearMatch = dateString.match(/(19|20)\d{2}/);
    if (yearMatch) {
      return yearMatch[0]; // Return just the year (e.g., "2025")
    }
    
    // If no year is found, return the first part (month)
    return dateString.split(' ')[0];
  };

  return (
    <View style={[styles.container, { backgroundColor: currentTheme.colors.background }]}>
      {renderCustomHeader()}
      <Animated.View 
        style={[
          styles.stickyHeader,
          { 
            backgroundColor: navbarBackground,
          }
        ]}
      >
      </Animated.View>

      <Animated.ScrollView
        style={[styles.scrollView, { backgroundColor: currentTheme.colors.background }]}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } }}],
          { useNativeDriver: true }
        )}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingBottom: Platform.OS === 'ios' ? 140 : 130 }}
      >
        {(activeTab === 'info' || details?.format === 'MUSIC' || details?.format === 'MUSIC_VIDEO') ? (
          <>
            <View style={styles.heroSection}>
              {youtubeVideoId ? (
                <View style={styles.videoContainer}>
                  <Animated.View style={[styles.videoWrapper, { opacity: fadeAnim }]}>
                    <WebView
                      ref={webviewRef}
                      style={styles.video}
                      source={{
                        html: `
                          <!DOCTYPE html>
                          <html>
                            <head>
                              <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
                              <style>
                                body { margin: 0; width: 100vw; height: 100vh; background: #000; }
                                #player { width: 100%; height: 100%; }
                              </style>
                            </head>
                            <body>
                              <div id="player"></div>
                              <script src="https://www.youtube.com/iframe_api"></script>
                              <script>
                                let player;
                                function onYouTubeIframeAPIReady() {
                                  player = new YT.Player('player', {
                                    width: '100%',
                                    height: '100%',
                                    videoId: '${youtubeVideoId}',
                                    playerVars: {
                                      autoplay: 1,
                                      controls: 0,
                                      showinfo: 0,
                                      modestbranding: 1,
                                      loop: 0,
                                      playsinline: 1,
                                      rel: 0,
                                      mute: ${isMuted ? 1 : 0}
                                    },
                                    events: {
                                      'onReady': function(event) {
                                        event.target.playVideo();
                                        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'playerReady' }));
                                      },
                                      'onStateChange': function(event) {
                                        window.ReactNativeWebView.postMessage(JSON.stringify({ 
                                          type: 'playerStateChange',
                                          state: event.data
                                        }));
                                      }
                                    }
                                  });
                                }
                              </script>
                            </body>
                          </html>
                        `
                      }}
                      javaScriptEnabled={true}
                      scrollEnabled={false}
                      allowsFullscreenVideo={false}
                      mediaPlaybackRequiresUserAction={false}
                      onLoadStart={() => setIsVideoLoading(true)}
                      onLoadEnd={() => setIsVideoLoading(false)}
                    />
                  </Animated.View>

                  <Animated.View 
                    style={[
                      styles.coverImageContainer,
                      { 
                        opacity: fadeAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [1, 0],
                        })
                      }
                    ]}
                  >
                    <ExpoImage
                      source={{ uri: details.coverImage.extraLarge }}
                      style={styles.coverImage}
                      contentFit="cover"
                    />
                  </Animated.View>

                  <BlurView intensity={30} tint="dark" style={[styles.overlay, { backgroundColor: 'rgba(0, 0, 0, 0.3)' }]} />
                  
                  <View style={styles.playerControls}>
                    <BlurView intensity={25} tint="dark" style={StyleSheet.absoluteFill} />
                    <View style={styles.controlsContent}>
                      <TouchableOpacity
                        style={styles.controlButton}
                        onPress={() => {
                          if (isVideoEnded) {
                            setIsVideoEnded(false);
                            webviewRef.current?.injectJavaScript(`
                              player.seekTo(0);
                              player.playVideo();
                              true;
                            `);
                            Animated.timing(fadeAnim, {
                              toValue: 1,
                              duration: 500,
                              useNativeDriver: true,
                            }).start();
                          } else {
                            setIsPlaying(!isPlaying);
                            webviewRef.current?.injectJavaScript(`
                              player.${isPlaying ? 'pauseVideo' : 'playVideo'}();
                              true;
                            `);
                          }
                        }}
                      >
                        <FontAwesome5 
                          name={isVideoEnded ? 'redo' : (isPlaying ? 'pause' : 'play')} 
                          size={16} 
                          color="#fff" 
                        />
                      </TouchableOpacity>
                      
                      <TouchableOpacity
                        style={styles.controlButton}
                        onPress={() => {
                          setIsMuted(!isMuted);
                          webviewRef.current?.injectJavaScript(`
                            player.${isMuted ? 'unMute' : 'mute'}();
                            true;
                          `);
                        }}
                      >
                        <FontAwesome5 
                          name={isMuted ? 'volume-mute' : 'volume-up'} 
                          size={16} 
                          color="#fff" 
                        />
                      </TouchableOpacity>
                    </View>
                  </View>
                  
                  {isVideoLoading && (
                    <View style={styles.loadingOverlay}>
                      <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
                      <ActivityIndicator size="large" color="#fff" />
                    </View>
                  )}
                </View>
              ) : (
                <View style={styles.videoContainer}>
                  <ExpoImage
                    source={{ uri: details.coverImage.extraLarge || details.bannerImage }}
                    style={styles.coverImage}
                    contentFit="cover"
                  />
                  <BlurView intensity={30} tint="dark" style={[styles.overlay, { backgroundColor: isDarkMode ? 'rgba(0, 0, 0, 0.5)' : 'rgba(0, 0, 0, 0.3)' }]} />
                </View>
              )}
            </View>

            <View style={[styles.content, { backgroundColor: currentTheme.colors.background }]}>
              <View style={styles.mainInfo}>
                <View style={styles.titleContainer}>
                  <View style={styles.titleRow}>
                    <Text style={[styles.title, { color: currentTheme.colors.text }]}>{details.title.userPreferred}</Text>
                    <View style={[styles.statusPill, {
                      backgroundColor: 
                        details.status === 'FINISHED' ? '#4CAF50' :
                        details.status === 'RELEASING' ? '#2196F3' :
                        details.status === 'NOT_YET_RELEASED' ? '#FFC107' :
                        '#9E9E9E'
                    }]}>
                      <Text style={styles.statusPillText}>{details.status.replace(/_/g, ' ')}</Text>
                    </View>
                  </View>
                  <View style={styles.studioContainer}>
                    <FontAwesome5 name="film" size={12} color={currentTheme.colors.textSecondary} style={{ marginRight: 6 }} />
                    <Text style={[styles.studioText, { color: currentTheme.colors.textSecondary }]}>
                      by {details.studios?.nodes?.[0]?.name || 'Unknown studio'}
                    </Text>
                  </View>
                  <View style={[styles.metaContainer, { marginTop: 12 }]}>
                    {details.averageScore > 0 && (
                      <View style={styles.scoreContainer}>
                        <FontAwesome5 name="star" size={14} color="#FFD700" style={styles.metaIcon} />
                        <Text style={styles.scoreText}>{details.averageScore}%</Text>
                      </View>
                    )}
                    {details.trending > 0 && (
                      <TouchableOpacity style={styles.trendingContainer} onPress={handleTrendingPress}>
                        <FontAwesome5 name="fire" size={14} color="#FF4B4B" style={styles.metaIcon} />
                        <Text style={styles.trendingText}>#{details.trending}</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>

                <View style={styles.infoContainer}>
                  <View style={styles.infoRow}>
                    <View style={styles.infoColumn}>
                      <Text style={[styles.infoLabel, { color: currentTheme.colors.textSecondary }]}>TYPE</Text>
                      <TouchableOpacity 
                        style={[styles.typeBadge, { backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : '#1f1f1f' }]}
                        onPress={() => {
                          console.log(`Anime format selected: ${details.format}`);
                          DeviceEventEmitter.emit('openAnimeFormatSearch', details.format);
                        }}
                      >
                        <FontAwesome5 name="tv" size={12} color="#fff" style={{ marginRight: 6 }} />
                        <Text style={styles.typeBadgeText}>{details.format || 'ANIME'}</Text>
                      </TouchableOpacity>
                    </View>
                    <View style={styles.infoColumn}>
                      <Text style={[styles.infoLabel, { color: currentTheme.colors.textSecondary }]}>RELEASE DATE</Text>
                      <Text style={[styles.infoText, { color: currentTheme.colors.text }]}>
                        {details.startDate.month && details.startDate.day && details.startDate.year
                          ? new Date(details.startDate.year, details.startDate.month - 1, details.startDate.day)
                              .toLocaleDateString('en-US', { 
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric'
                              })
                          : 'TBA'}
                      </Text>
                    </View>
                  </View>
                </View>

                {details.genres.length > 0 && (
                  <View style={styles.genresSection}>
                    <Text style={[styles.sectionLabel, { color: currentTheme.colors.textSecondary }]}>GENRES</Text>
                    <View style={styles.genreChips}>
                      {details.genres.map((genre) => (
                        <TouchableOpacity 
                          key={genre} 
                          style={[
                            styles.genreChip,
                            { backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : '#1f1f1f' }
                          ]}
                          onPress={() => {
                            // Log the genre selection
                            console.log(`Anime genre selected: ${genre}`);
                            
                            // Directly emit the event for AnimeSearchGlobal
                            console.log(`Emitting openAnimeGenreSearch event for: ${genre}`);
                            DeviceEventEmitter.emit('openAnimeGenreSearch', genre);
                          }}
                        >
                          <Text style={styles.genreChipText}>{genre}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}

                {user && !user.isAnonymous && (
                  <TouchableOpacity
                    style={[
                      styles.statusButton,
                      {
                        backgroundColor: details.mediaListEntry 
                          ? getStatusColor(details.mediaListEntry.status)
                          : isDarkMode ? 'rgba(255, 255, 255, 0.1)' : '#f0f0f0'
                      }
                    ]}
                    onPress={() => setShowListEditor(true)}
                  >
                    <Text style={[
                      styles.statusButtonText, 
                      { color: details.mediaListEntry ? '#FFFFFF' : currentTheme.colors.text }
                    ]}>
                      {formatStatus(details.mediaListEntry?.status)}
                    </Text>
                    {details.mediaListEntry && (
                      <Text style={styles.progressText}>
                        <FontAwesome5 name="film" size={12} color="rgba(255, 255, 255, 0.8)" style={{ marginRight: 6 }} />
                        {details.mediaListEntry.progress} of {details.episodes || '?'} episodes
                      </Text>
                    )}
                  </TouchableOpacity>
                )}

                <View style={styles.synopsisSection}>
                  <Text style={[styles.sectionLabel, { color: currentTheme.colors.textSecondary }]}>Synopsis</Text>
                  <Text 
                    style={[styles.synopsis, { color: currentTheme.colors.text }]} 
                    numberOfLines={expandedSynopsis ? undefined : 3}
                  >
                    {details?.description?.replace(/<[^>]*>/g, '') || 'No description available.'}
                  </Text>
                  <TouchableOpacity onPress={() => setExpandedSynopsis(!expandedSynopsis)}>
                    <Text style={styles.readMore}>
                      {expandedSynopsis ? 'Show Less' : 'Read More'}
                    </Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.charactersSection}>
                  <Text style={[styles.sectionLabel, { color: currentTheme.colors.textSecondary }]}>Characters</Text>
                  <ScrollView 
                    horizontal 
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.charactersContent}
                  >
                    {details.characters.edges.map(({ node, role }, index) => (
                      <TouchableOpacity
                        key={`character-${node.id}-${index}`}
                        style={styles.characterCard}
                        onPress={() => router.push({
                          pathname: '/character/[id]',
                          params: { id: node.id }
                        })}
                      >
                        <ExpoImage
                          source={{ uri: node.image.medium }}
                          style={styles.characterImage}
                        />
                        <View style={styles.characterInfo}>
                          <Text style={[styles.characterName, { color: currentTheme.colors.text }]} numberOfLines={1}>
                            {node.name.userPreferred}
                          </Text>
                          <Text style={[styles.characterRole, { color: currentTheme.colors.textSecondary }]}>
                            {role}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>

                <View style={styles.staffSection}>
                  <Text style={[styles.sectionLabel, { color: currentTheme.colors.textSecondary }]}>Staff</Text>
                  <ScrollView 
                    horizontal 
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.staffContent}
                  >
                    {details.staff.edges.map(({ node, role }, index) => (
                      <TouchableOpacity
                        key={`staff-${node.id}-${index}`}
                        style={styles.staffCard}
                        onPress={() => router.push({
                          pathname: '/staff/[id]',
                          params: { id: node.id }
                        })}
                      >
                        <ExpoImage
                          source={{ uri: node.image.medium }}
                          style={styles.staffImage}
                        />
                        <Text style={[styles.staffName, { color: currentTheme.colors.text }]} numberOfLines={1}>
                          {node.name.userPreferred}
                        </Text>
                        <Text style={[styles.staffRole, { color: currentTheme.colors.textSecondary }]} numberOfLines={1}>
                          {role}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>

                {watchOrder.length > 0 && (
                  <View style={{
                    marginBottom: 32,
                    backgroundColor: isDarkMode ? 'rgba(2, 169, 255, 0.15)' : 'rgba(2, 169, 255, 0.05)',
                    borderRadius: 16,
                    padding: 16,
                    borderWidth: 1,
                    borderColor: isDarkMode ? 'rgba(2, 169, 255, 0.3)' : 'rgba(2, 169, 255, 0.2)',
                  }}>
                    <View style={{ marginBottom: 16 }}>
                      <Text style={[{ fontSize: 18, fontWeight: '700', marginBottom: 4 }, { color: currentTheme.colors.text }]}>
                        How to Watch in Order
                      </Text>
                      <Text style={[{ fontSize: 14, marginBottom: 12 }, { color: currentTheme.colors.textSecondary }]}>
                        The recommended sequence for the best experience
                      </Text>
                    </View>
                    <ScrollView 
                      horizontal 
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={{ paddingRight: 32, paddingBottom: 8, paddingLeft: 8 }}
                    >
                      {watchOrder.map((item, index) => (
                        <TouchableOpacity 
                          key={`watch-order-${item.anilistId}-${index}`}
                          style={[{
                            width: 140,
                            marginRight: 28,
                            borderRadius: 12,
                            backgroundColor: getWatchOrderStatusColor(item.mediaListStatus, isDarkMode) || 
                              (isDarkMode ? currentTheme.colors.surface : 'white'),
                            shadowColor: '#000',
                            shadowOffset: { width: 0, height: 2 },
                            shadowOpacity: isDarkMode ? 0.3 : 0.1,
                            shadowRadius: 4,
                            elevation: 3,
                            padding: 8,
                            position: 'relative',
                            marginBottom: 5,
                            marginTop: 10,
                            borderWidth: parseInt(item.anilistId) === details.id ? 2 : (item.mediaListStatus ? 1 : 0),
                            borderColor: parseInt(item.anilistId) === details.id ? 
                              '#FF5722' : getWatchOrderStatusBorder(item.mediaListStatus),
                          }]}
                          onPress={() => navigateToAnime(item)}
                          activeOpacity={0.7}
                        >
                          <View style={{
                            position: 'absolute',
                            top: -10,
                            left: -10,
                            width: 28,
                            height: 28,
                            borderRadius: 14,
                            backgroundColor: '#02A9FF',
                            justifyContent: 'center',
                            alignItems: 'center',
                            zIndex: 10,
                            shadowColor: '#000',
                            shadowOffset: { width: 0, height: 2 },
                            shadowOpacity: 0.2,
                            shadowRadius: 3,
                            elevation: 5,
                          }}>
                            <Text style={{ color: 'white', fontSize: 14, fontWeight: 'bold' }}>
                              {index + 1}
                            </Text>
                          </View>
                          <ExpoImage
                            source={{ 
                              uri: item.imageUrl 
                                ? item.imageUrl 
                                : (item.image 
                                  ? item.image 
                                  : (parseInt(item.anilistId) === details.id 
                                    ? details.coverImage.medium 
                                    : (failedImages[item.anilistId] 
                                      ? details.coverImage.medium 
                                      : `https://s4.anilist.co/file/anilistcdn/media/anime/cover/${item.anilistId}-medium.jpg`)))
                            }}
                            style={{ width: '100%', height: 180, borderRadius: 8 }}
                            contentFit="cover"
                            transition={200}
                            cachePolicy="memory-disk"
                            recyclingKey={`watch-order-${item.anilistId}`}
                            onLoad={() => {
                              console.log(`Successfully loaded image for item: ${item.title}`);
                            }}
                            onError={() => {
                              console.log(`Failed to load image for ${item.anilistId}`, 
                                item.imageUrl 
                                  ? `URL: ${item.imageUrl}` 
                                  : (item.image ? `URL: ${item.image}` : 'No image URL'));
                              setFailedImages(prev => ({
                                ...prev,
                                [item.anilistId]: true
                              }));
                            }}
                          />
                          {/* Format badge */}
                          <View style={{
                            position: 'absolute',
                            top: 16,
                            left: 16,
                            paddingHorizontal: 8,
                            paddingVertical: 4,
                            borderRadius: 4,
                            backgroundColor: item.details.format === "TV" ? '#3498db' : currentTheme.colors.primary,
                            shadowColor: '#000',
                            shadowOffset: { width: 1, height: 1 },
                            shadowOpacity: 0.3,
                            shadowRadius: 2,
                            elevation: 3,
                          }}>
                            <Text style={{ color: '#FFFFFF', fontSize: 10, fontWeight: '600' }}>
                              {item.details.format || "Anime"}
                            </Text>
                          </View>
                          {/* Status badge (only show if there's a status and it's not the current anime) */}
                          {item.mediaListStatus && parseInt(item.anilistId) !== details.id && (
                            <View style={{
                              position: 'absolute',
                              top: 16,
                              right: 16,
                              paddingHorizontal: 8,
                              paddingVertical: 4,
                              borderRadius: 4,
                              backgroundColor: getWatchOrderStatusBorder(item.mediaListStatus),
                              shadowColor: '#000',
                              shadowOffset: { width: 1, height: 1 },
                              shadowOpacity: 0.3,
                              shadowRadius: 2,
                              elevation: 3,
                            }}>
                              <Text style={{ color: '#FFFFFF', fontSize: 10, fontWeight: '600' }}>
                                {formatWatchOrderStatus(item.mediaListStatus)}
                              </Text>
                            </View>
                          )}
                          {/* "Current" badge for the current anime */}
                          {parseInt(item.anilistId) === details.id && (
                            <View style={{
                              position: 'absolute',
                              top: 16,
                              right: 16,
                              paddingHorizontal: 8,
                              paddingVertical: 4,
                              borderRadius: 4,
                              backgroundColor: '#FF5722',
                              shadowColor: '#000',
                              shadowOffset: { width: 1, height: 1 },
                              shadowOpacity: 0.3,
                              shadowRadius: 2,
                              elevation: 3,
                            }}>
                              <Text style={{ color: '#FFFFFF', fontSize: 10, fontWeight: '600' }}>
                                CURRENT
                              </Text>
                            </View>
                          )}
                          <Text style={[{ fontSize: 14, fontWeight: '700', marginTop: 8 }, { color: currentTheme.colors.text }]} numberOfLines={2}>
                            {item.title}
                          </Text>
                          
                          <View style={{ 
                            flexDirection: 'row', 
                            justifyContent: 'space-between', 
                            alignItems: 'center', 
                            marginTop: 6,
                            marginBottom: 2
                          }}>
                            {item.details.airDates.start && (
                              <Text style={{ 
                                fontSize: 11, 
                                fontWeight: '500',
                                opacity: isDarkMode ? 0.8 : 0.7,
                                color: currentTheme.colors.textSecondary,
                                flex: 1,
                                marginRight: 6
                              }} numberOfLines={1}>
                                {formatReleaseDate(item.details.airDates.start)}
                              </Text>
                            )}
                            {item.details.episodes && (
                              <View style={{
                                backgroundColor: isDarkMode ? 'rgba(0,0,0,0.25)' : 'rgba(0,0,0,0.05)',
                                paddingHorizontal: 6,
                                paddingVertical: 2,
                                borderRadius: 4,
                                minWidth: 36,
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}>
                                <Text style={{ 
                                  fontSize: 11, 
                                  fontWeight: '600',
                                  color: currentTheme.colors.textSecondary
                                }}>
                                  {item.details.episodes}ep
                                </Text>
                              </View>
                            )}
                          </View>
                          {index < watchOrder.length - 1 && (
                            <View style={{
                              position: 'absolute',
                              right: -22,
                              top: '50%',
                              marginTop: -8,
                              width: 16, 
                              height: 16,
                              alignItems: 'center',
                              justifyContent: 'center',
                              backgroundColor: isDarkMode ? 'rgba(2, 169, 255, 0.2)' : 'rgba(2, 169, 255, 0.1)',
                              borderRadius: 8,
                            }}>
                              <FontAwesome5 name="arrow-right" size={10} color="#02A9FF" />
                            </View>
                          )}
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}

                <View style={styles.relatedSection}>
                  <Text style={[styles.sectionLabel, { color: currentTheme.colors.textSecondary }]}>Extra Content & Spin-offs</Text>
                  <ScrollView 
                    horizontal 
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.relatedContent}
                  >
                    {details?.relations.edges.map(({ node, relationType }, index) => (
                      <TouchableOpacity 
                        key={`related-${node.id}-${index}`}
                        style={styles.relatedCard}
                        onPress={() => router.push(`/${node.type.toLowerCase()}/${node.id}`)}
                      >
                        <ExpoImage
                          source={{ uri: node.coverImage.medium }}
                          style={styles.relatedCover}
                        />
                        <View style={[styles.relationTypeBadge, { backgroundColor: currentTheme.colors.primary }]}>
                          <Text style={styles.relationTypeText}>{relationType.replace(/_/g, ' ')}</Text>
                        </View>
                        {node.nextAiringEpisode && (
                          <View style={[styles.airingBadge, { backgroundColor: '#4CAF50' }]}>
                            <Text style={styles.airingText}>EP {node.nextAiringEpisode.episode} in {Math.ceil((node.nextAiringEpisode.airingAt - Date.now() / 1000) / (60 * 60 * 24))}d</Text>
                          </View>
                        )}
                        <Text style={[styles.relatedTitle, { color: currentTheme.colors.text }]} numberOfLines={2}>
                          {node.title.userPreferred}
                        </Text>
                        <View style={styles.mediaInfoRow}>
                          <Text style={[styles.mediaFormat, { color: currentTheme.colors.textSecondary }]}>
                            {node.format || node.type}
                          </Text>
                          <Text style={[styles.mediaStatus, { 
                            color: node.status === 'RELEASING' ? '#4CAF50' : 
                                   node.status === 'NOT_YET_RELEASED' ? '#FFC107' : 
                                   node.status === 'FINISHED' ? '#2196F3' : 
                                   currentTheme.colors.textSecondary 
                          }]}>
                            {node.status.replace(/_/g, ' ')}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>

                <View style={[styles.recommendationsSection, { marginBottom: Platform.OS === 'ios' ? 140 : 130 }]}>
                  <Text style={[styles.sectionLabel, { color: currentTheme.colors.textSecondary }]}>Recommendations</Text>
                  <ScrollView 
                    horizontal 
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.relatedContent}
                  >
                    {details.recommendations.nodes
                      .slice(0, 10)
                      .map(({ mediaRecommendation }, index) => (
                        <TouchableOpacity 
                          key={`recommendation-${mediaRecommendation.id}-${index}`}
                          style={styles.relatedCard}
                          onPress={() => router.push(`/anime/${mediaRecommendation.id}`)}
                        >
                          <ExpoImage
                            source={{ uri: mediaRecommendation.coverImage.medium }}
                            style={styles.relatedCover}
                          />
                          {mediaRecommendation.averageScore && (
                            <View style={styles.recommendationScore}>
                              <Text style={[styles.recommendationScoreText, { color: currentTheme.colors.text }]}>
                                {mediaRecommendation.averageScore}%
                              </Text>
                            </View>
                          )}
                          <Text style={[styles.relatedTitle, { color: currentTheme.colors.text }]} numberOfLines={2}>
                            {mediaRecommendation.title.userPreferred}
                          </Text>
                        </TouchableOpacity>
                      ))}
                  </ScrollView>
                </View>
              </View>
            </View>
          </>
        ) : (
          renderWatchTab()
        )}
      </Animated.ScrollView>

      {/* Only show sticky tabs if not a music video */}
      {details?.format !== 'MUSIC' && details?.format !== 'MUSIC_VIDEO' && (
        <View style={styles.stickyTabs}>
          <BlurView intensity={80} tint={isDarkMode ? "dark" : "light"} style={StyleSheet.absoluteFill} />
          {renderTabs()}
        </View>
      )}

      {user && !user.isAnonymous && (
        <ListEditorModal
          visible={showListEditor}
          onClose={() => setShowListEditor(false)}
          onSave={handleSaveListEdit}
          initialData={{
            status: details?.mediaListEntry?.status || 'PLANNING',
            progress: details?.mediaListEntry?.progress || 0,
            score: details?.mediaListEntry?.score || 0,
            private: details?.mediaListEntry?.private || false,
            hideFromStatusLists: details?.mediaListEntry?.hiddenFromStatusLists || false,
            notes: details?.mediaListEntry?.notes || '',
            repeat: details?.mediaListEntry?.repeat || 0,
            startedAt: details?.mediaListEntry?.startedAt && {
              year: details?.mediaListEntry.startedAt.year || undefined,
              month: details?.mediaListEntry.startedAt.month || undefined,
              day: details?.mediaListEntry.startedAt.day || undefined
            },
            completedAt: details?.mediaListEntry?.completedAt && {
              year: details?.mediaListEntry.completedAt.year || undefined,
              month: details?.mediaListEntry.completedAt.month || undefined,
              day: details?.mediaListEntry.completedAt.day || undefined
            },
            customLists: {
              watched: Array.isArray(details?.mediaListEntry?.customLists) && 
                details?.mediaListEntry?.customLists.includes('watched_using_moopa')
            }
          }}
          totalEpisodes={details?.episodes}
        />
      )}

      {/* Toast Notifications */}
      {showSuccessToast && (
        <SuccessToast 
          message={toastMessage}
          onDismiss={() => setShowSuccessToast(false)}
        />
      )}

      {showErrorToast && (
        <ErrorToast 
          message={toastMessage}
          onDismiss={() => setShowErrorToast(false)}
        />
      )}

      {/* Trending Modal */}
      <Modal
        visible={showTrendingModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowTrendingModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowTrendingModal(false)}
        >
          <View style={[styles.trendingModal, { backgroundColor: currentTheme.colors.surface }]}>
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setShowTrendingModal(false)}
            >
              <FontAwesome5 name="times" size={20} color={currentTheme.colors.textSecondary} />
            </TouchableOpacity>
            
            <View style={styles.modalHeader}>
              <FontAwesome5 name="fire" size={24} color="#FF4B4B" />
              <Text style={[styles.modalTitle, { color: currentTheme.colors.text }]}>
                Trending #{details?.trending}
              </Text>
            </View>

            <Text style={[styles.modalSubtitle, { color: currentTheme.colors.textSecondary }]}>
              {details?.title.userPreferred} is currently trending
            </Text>

            {details?.rankings && details.rankings.length > 0 && (
              <View style={styles.rankingsContainer}>
                <Text style={[styles.rankingsTitle, { color: currentTheme.colors.text }]}>
                  Rankings
                </Text>
                {details.rankings.map((ranking, index) => (
                  <View key={index} style={[styles.rankingItem, { backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)' }]}>
                    <View style={styles.rankingLeft}>
                      <Text style={[styles.rankingRank, { color: currentTheme.colors.primary }]}>
                        #{ranking.rank}
                      </Text>
                      <View>
                        <Text style={[styles.rankingType, { color: currentTheme.colors.text }]}>
                          {ranking.type.replace(/_/g, ' ')}
                        </Text>
                        <Text style={[styles.rankingContext, { color: currentTheme.colors.textSecondary }]}>
                          {ranking.context}
                        </Text>
                      </View>
                    </View>
                    <FontAwesome5 
                      name={ranking.type.includes('POPULAR') ? 'heart' : ranking.type.includes('RATED') ? 'star' : 'fire'} 
                      size={16} 
                      color={ranking.type.includes('POPULAR') ? '#FF6B6B' : ranking.type.includes('RATED') ? '#FFD700' : '#FF4B4B'} 
                    />
                  </View>
                ))}
              </View>
            )}

            <View style={styles.trendingInfo}>
              <Text style={[styles.trendingInfoText, { color: currentTheme.colors.textSecondary }]}>
                Trending rankings are updated in real-time based on user activity and engagement.
              </Text>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
      
      {isNavigating && (
        <View style={styles.navigatingOverlay}>
          <BlurView intensity={50} tint={isDarkMode ? "dark" : "light"} style={StyleSheet.absoluteFill} />
          <ActivityIndicator size="large" color="#02A9FF" />
          <Text style={[styles.navigatingText, { color: currentTheme.colors.text }]}>
            Finding anime...
          </Text>
        </View>
      )}
    </View>
  );
}

const { width, height } = Dimensions.get('window');
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 10,
  },
  retryButton: {
    backgroundColor: '#02A9FF',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  stickyHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    overflow: 'hidden',
  },
  headerBlur: {
    overflow: 'hidden',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 44 : 24,
    paddingHorizontal: 16,
    paddingBottom: 10,
    height: '100%',
  },
  headerLeft: {
    width: 40,
    alignItems: 'flex-start',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 16,
    textShadowColor: 'rgba(0,0,0,0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  iconButtonPressed: {
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    transform: [{ scale: 0.95 }],
  },
  iconShadow: {
    textShadowColor: 'rgba(0,0,0,0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  heartButton: {
    position: 'absolute',
    right: 16,
  },
  heroSection: {
    height: 300,
    width: '100%',
    position: 'relative',
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  content: {
    flex: 1,
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    marginTop: -20,
    paddingBottom: Platform.OS === 'ios' ? 140 : 130,
  },
  mainInfo: {
    padding: 16,
    paddingTop: 20,
  },
  titleContainer: {
    marginBottom: 20,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginBottom: 4,
    flex: 1,
  },
  studioContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  studioText: {
    fontSize: 13,
    fontWeight: '400',
    opacity: 0.6,
    marginBottom: 8,
  },
  metaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  scoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 215, 0, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  scoreText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFD700',
  },
  trendingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 75, 75, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  trendingText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FF4B4B',
  },
  metaIcon: {
    marginRight: 6,
  },
  infoContainer: {
    marginBottom: 20,
  },
  infoRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 20,
    marginTop: 4,
  },
  infoColumn: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  infoText: {
    fontSize: 15,
    fontWeight: '500',
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  typeBadgeText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  genresSection: {
    marginHorizontal: 16, 
    marginBottom: 20,
  },
  genreChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  genreChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  genreChipText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  statusButton: {
    marginHorizontal: 16,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statusButtonText: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 4,
  },
  progressText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
  },
  synopsisSection: {
    marginBottom: 24,
    backgroundColor: 'rgba(0, 0, 0, 0.03)',
    padding: 16,
    borderRadius: 12,
    marginHorizontal: 16,
  },
  sectionLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
    fontWeight: '600',
  },
  synopsis: {
    fontSize: 16,
    color: '#333',
    lineHeight: 24,
  },
  readMore: {
    color: '#02A9FF',
    marginTop: 8,
    fontSize: 14,
    fontWeight: '500',
  },
  charactersSection: {
    marginBottom: 24,
    marginHorizontal: 16,
  },
  charactersContent: {
    paddingRight: 20,
  },
  characterCard: {
    width: 120,
    marginRight: 16,
  },
  characterImage: {
    width: 120,
    height: 160,
    borderRadius: 8,
    marginBottom: 8,
  },
  characterInfo: {
    flex: 1,
  },
  characterName: {
    fontSize: 14,
    color: '#000',
    fontWeight: '500',
  },
  characterRole: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  staffSection: {
    marginBottom: 24,
    marginHorizontal: 16,
  },
  staffContent: {
    paddingRight: 20,
  },
  staffCard: {
    width: 120,
    marginRight: 16,
  },
  staffImage: {
    width: 120,
    height: 160,
    borderRadius: 8,
    marginBottom: 8,
  },
  staffName: {
    fontSize: 14,
    color: '#000',
    fontWeight: '500',
  },
  staffRole: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  relatedSection: {
    marginBottom: 24,
    marginHorizontal: 16,
  },
  relatedContent: {
    paddingRight: 20,
  },
  relatedCard: {
    width: 140,
    marginRight: 16,
  },
  relatedCover: {
    width: 140,
    height: 200,
    borderRadius: 8,
  },
  relatedTitle: {
    fontSize: 14,
    color: '#000',
    marginTop: 8,
    fontWeight: '500',
  },
  recommendationsSection: {
    marginBottom: 24,
    marginHorizontal: 16,
  },
  recommendationScore: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  recommendationScoreText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  statusPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginLeft: 12,
  },
  statusPillText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  stickyTabs: {
    position: 'absolute',
    bottom: Platform.select({
      ios: 34,
      android: 48,
      default: 20,
    }),
    left: 20,
    right: 20,
    overflow: 'hidden',
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 24,
    zIndex: 1000,
  },
  tabContainer: {
    flexDirection: 'row',
    borderRadius: 20,
    padding: 6,
    backgroundColor: 'transparent',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 16,
  },
  activeTab: {
    shadowColor: '#02A9FF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  tabText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  watchTabContent: {
    flex: 1,
    paddingTop: 16,
  },
  customHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    overflow: 'hidden',
    height: Platform.OS === 'ios' ? 100 : 80,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  videoContainer: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  videoWrapper: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 2,
  },
  video: {
    width: '100%',
    height: '100%',
  },
  coverImageContainer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
  },
  playerControls: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    borderRadius: 20,
    overflow: 'hidden',
    zIndex: 3,
  },
  controlsContent: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 16,
    width: '100%',
    justifyContent: 'center',
    gap: 32,
  },
  controlButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  relationTypeBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: '#02A9FF',
  },
  relationTypeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
  },
  mediaInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  mediaFormat: {
    fontSize: 12,
    marginTop: 4,
    opacity: 0.7,
  },
  mediaStatus: {
    fontSize: 12,
    fontWeight: '500',
  },
  airingBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: '#4CAF50',
  },
  airingText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
  },
  navigatingOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 2000,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  navigatingText: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: '500',
    color: '#fff',
  },
  // Trending Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  trendingModal: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 20,
  },
  modalCloseButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 12,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '700',
  },
  modalSubtitle: {
    fontSize: 16,
    marginBottom: 24,
    lineHeight: 22,
  },
  rankingsContainer: {
    marginBottom: 20,
  },
  rankingsTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  rankingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  rankingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  rankingRank: {
    fontSize: 20,
    fontWeight: '700',
    minWidth: 40,
  },
  rankingType: {
    fontSize: 16,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  rankingContext: {
    fontSize: 14,
    marginTop: 2,
  },
  trendingInfo: {
    backgroundColor: 'rgba(2, 169, 255, 0.1)',
    borderRadius: 12,
    padding: 16,
  },
  trendingInfoText: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
}); 