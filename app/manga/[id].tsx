import React from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, Dimensions, Platform, StatusBar, ActivityIndicator, Animated, Pressable, Share, Linking, DeviceEventEmitter, BackHandler, Modal } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import axios from 'axios';
import { ANILIST_GRAPHQL_ENDPOINT, STORAGE_KEY } from '../../constants/auth';
import { FontAwesome5 } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useAuth } from '../../hooks/useAuth';
import { useTheme, lightTheme, darkTheme } from '../../hooks/useTheme';
import * as SecureStore from 'expo-secure-store';
import ImageColors from 'react-native-image-colors';
import * as Haptics from 'expo-haptics';
import ChapterList from '../../components/chapterlist';
import { Menu, MenuItem } from 'react-native-material-menu';
import ListEditorModal from '../../components/ListEditorModal';
import SuccessToast from '../../components/SuccessToast';
import ErrorToast from '../../components/ErrorToast';
import BottomSheet, { BottomSheetScrollView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import NovelVolumeList from '../../components/NovelVolumeList';
import { getRatingColor, getStatusColor, formatScore } from '../../utils/colors';
import ChapterSourcesModal from '../../components/ChapterSourcesModal';
import { useOrientation } from '../../hooks/useOrientation';
import ReadTab from '../../components/readtab';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface MangaDetails {
  id: number;
  title: {
    userPreferred: string;
    native: string;
    english: string;
  };
  coverImage: {
    extraLarge: string;
    large: string;
    color: string;
  };
  bannerImage: string;
  description: string | null;
  chapters: number;
  volumes: number;
  status: string;
  format: string;
  countryOfOrigin: string;
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
        };
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
}

interface Chapter {
  id: string;
  number: number;
  title: string;
  description: string;
  image: string;
  duration: number;
  isFiller: boolean;
}

const formatStatus = (status: string | undefined) => {
  if (!status) return 'Add to List';
  return status.charAt(0) + status.slice(1).toLowerCase();
};

export default function MangaDetailsScreen() {
  const { id, fromActivities } = useLocalSearchParams();
  const { user } = useAuth();
  const { isDarkMode } = useTheme();
  const { lockPortrait } = useOrientation();
  const currentTheme = isDarkMode ? darkTheme : lightTheme;
  const [details, setDetails] = useState<MangaDetails | null>(null);
  const [loading, setLoading] = useState(true);
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
  const [activeTab, setActiveTab] = useState('info');
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
  const [showChapterModal, setShowChapterModal] = useState(false);
  const [navigationType, setNavigationType] = useState<'next' | 'prev' | null>(null);
  const [currentChapterIndex, setCurrentChapterIndex] = useState(0);
  const [hasUpdatedProgress, setHasUpdatedProgress] = useState(false);
  const [pendingNextChapter, setPendingNextChapter] = useState(false);
  const [error, setError] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>('Failed to load manga details');
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [showErrorToast, setShowErrorToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [showTrendingModal, setShowTrendingModal] = useState(false);

  useEffect(() => {
    // Initial fetch
    fetchMangaDetails();

    // Set up event listener for refreshes
    const subscription = DeviceEventEmitter.addListener('refreshMangaDetails', () => {
      console.log('Refreshing manga details from event');
      fetchMangaDetails();
    });

    return () => {
      subscription.remove();
    };
  }, [id]);

  useEffect(() => {
    lockPortrait();
  }, [lockPortrait]);

  // Add hardware back button handler for Android
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (fromActivities === '1') {
        router.back();
        setTimeout(() => {
          DeviceEventEmitter.emit('showActivities');
        }, 100);
      } else {
        router.back();
      }
      return true; // Prevent default behavior
    });

    return () => backHandler.remove();
  }, [router, fromActivities]);

  const fetchMangaDetails = async () => {
    try {
      setLoading(true);
      setError(false);
      
      const token = await SecureStore.getItemAsync(STORAGE_KEY.AUTH_TOKEN);
      const isAuthenticated = !!token;

      // Enhanced debugging
      console.log('Auth Debug - User info:', JSON.stringify({
        userId: user?.id,
        isAnonymous: user?.isAnonymous,
        hasToken: !!token,
        simplifiedAuthCheck: isAuthenticated
      }));

      // Extract the AniList ID from the route parameter
      let anilistId: number;
      
      // If it's already a number, use it directly
      if (!isNaN(parseInt(id as string))) {
        anilistId = parseInt(id as string);
      }
      // If it has a dot, extract the number after the dot (e.g., manga-name.12345)
      else if (typeof id === 'string' && id.includes('.')) {
        const parts = id.toString().split('.');
        const potentialId = parseInt(parts[parts.length - 1]);
        
        if (!isNaN(potentialId)) {
          anilistId = potentialId;
        } else {
          throw new Error('Invalid manga ID format - no numeric ID found');
        }
      } 
      // Not a valid format
      else {
        throw new Error('Invalid manga ID format');
      }
      
      console.log('Using AniList ID for query:', anilistId);
      
      const query = `
        query ($id: Int!, $isAuth: Boolean!) {
          Media(id: $id, type: MANGA) {
            id
            title {
              userPreferred
              native
              english
            }
            coverImage {
              extraLarge
              large
              color
            }
            bannerImage
            description
            chapters
            volumes
            status
            format
            countryOfOrigin
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
          }
        }
      `;

      console.log('Token available:', !!token);
      console.log('Is authenticated:', isAuthenticated);
      console.log('AniList ID for API query:', anilistId);
      console.log('Is auth param value:', isAuthenticated === null ? false : isAuthenticated);

      const response = await axios.post(
        ANILIST_GRAPHQL_ENDPOINT,
        {
          query,
          variables: { 
            id: anilistId,
            isAuth: true  // Always request authenticated data when we have a token
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
        console.error('GraphQL Errors:', response.data.errors);
        throw new Error(response.data.errors[0]?.message || 'Failed to load manga details');
      }

      const mangaDetails = response.data?.data?.Media;
      if (!mangaDetails) {
        throw new Error('No manga details found');
      }

      // Debug the response
      console.log('Manga details response - Auth fields:', JSON.stringify({
        isFavourite: mangaDetails.isFavourite,
        hasMediaListEntry: !!mangaDetails.mediaListEntry,
        listStatus: mangaDetails.mediaListEntry?.status,
        progress: mangaDetails.mediaListEntry?.progress
      }));

      // If we have a token but isFavourite is null or undefined, it means the auth might not have been applied properly
      if (token && (mangaDetails.isFavourite === null || mangaDetails.isFavourite === undefined)) {
        console.log('Warning: Auth token exists but isFavourite is not in response. This suggests an authentication issue.');
      }

      setDetails(mangaDetails);
      const initialLikeStatus = mangaDetails.isFavourite || false;
      setIsLiked(initialLikeStatus);
      DeviceEventEmitter.emit('updateLikeStatus', initialLikeStatus);

    } catch (error: any) {
      console.error('Error fetching manga details:', error);
      if (error.response?.data?.errors) {
        console.error('GraphQL Errors:', error.response.data.errors);
      }
      const errorMessage = error.response?.data?.errors?.[0]?.message || error.message || 'Failed to load manga details';
      setError(true);
      if (error.response?.status === 404) {
        setErrorMessage('Manga not found. It may have been removed or is temporarily unavailable.');
      } else {
        setErrorMessage(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    if (fromActivities === '1') {
      router.back();
      setTimeout(() => {
        DeviceEventEmitter.emit('showActivities');
      }, 100);
    } else {
      router.back();
    }
  };

  const handleShare = async () => {
    if (!details) return;

    try {
      await Share.share({
        message: `Check out ${details.title.userPreferred} on AniList!\nhttps://anilist.co/manga/${details.id}`,
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
        alert('Please log in to favorite manga');
        return;
      }

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      
      const mutation = `
        mutation ($mangaId: Int) {
          ToggleFavourite(mangaId: $mangaId) {
            manga {
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
            mangaId: details.id
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

  useEffect(() => {
    const shareListener = DeviceEventEmitter.addListener('shareManga', handleShare);
    const likeListener = DeviceEventEmitter.addListener('toggleLike', handleLikePress);

    return () => {
      shareListener.remove();
      likeListener.remove();
    };
  }, [details]);

  const renderTabs = () => (
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
          activeTab === 'read' && [
            styles.activeTab,
            { backgroundColor: '#02A9FF' }
          ]
        ]}
        onPress={() => setActiveTab('read')}
      >
        <Text style={[
          styles.tabText,
          { color: activeTab === 'read' ? '#fff' : currentTheme.colors.textSecondary }
        ]}>Read</Text>
      </Pressable>
    </View>
  );

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
            customLists: data.customLists.watched ? ['read_using_moopa'] : [],
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

  const renderReadTab = () => {
    if (!details) return null;
    
    return (
      <View style={styles.readTabContent}>
        <ReadTab 
          mangaTitle={details.title}
          anilistId={details.id?.toString()}
          countryOfOrigin={details.countryOfOrigin}
          coverImage={details.coverImage?.extraLarge}
          format={details.format}
          chapters={details.chapters}
          volumes={details.volumes}
        />
      </View>
    );
  };

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
          onPress={handleBack}
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

  if (error || !details) {
    return (
      <View style={[styles.errorContainer, { backgroundColor: currentTheme.colors.background }]}>
        <Text style={[styles.errorText, { color: currentTheme.colors.text }]}>{errorMessage}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={fetchMangaDetails}>
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

  return (
    <View style={[styles.container, { backgroundColor: currentTheme.colors.background }]}>
      {renderCustomHeader()}
      <Animated.View 
        style={[
          styles.stickyHeader,
          { backgroundColor: navbarBackground }
        ]}
      />

      <Animated.ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollViewContent,
          { paddingBottom: Platform.OS === 'ios' ? 140 : 130 }
        ]}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true }
        )}
        scrollEventThrottle={16}
      >
        {activeTab === 'info' && (
          <View style={styles.heroSection}>
            <ExpoImage
              source={{ uri: details?.coverImage.extraLarge }}
              style={styles.coverImage}
              contentFit="cover"
            />
            <View style={[
              styles.overlay, 
              { backgroundColor: isDarkMode ? 'rgba(0, 0, 0, 0.5)' : 'rgba(0, 0, 0, 0.3)' }
            ]} />
          </View>
        )}

        <View style={[
          styles.content,
          activeTab === 'read' && styles.readContent
        ]}>
          {activeTab === 'info' ? (
            <View style={styles.mainInfo}>
              <View style={styles.titleContainer}>
                <View style={styles.titleRow}>
                  <Text style={[styles.title, { color: currentTheme.colors.text }]}>
                    {details?.title.userPreferred}
                  </Text>
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
                <View style={styles.authorContainer}>
                  <FontAwesome5 name="pen-nib" size={12} color={currentTheme.colors.textSecondary} style={{ marginRight: 6 }} />
                  <Text style={[styles.authorText, { color: currentTheme.colors.textSecondary }]}>
                    by {details.staff.edges.find(edge => 
                      edge.role.toLowerCase().includes('story') || 
                      edge.role.toLowerCase().includes('author'))?.node.name.userPreferred || 'Unknown'}
                  </Text>
                </View>

                <View style={[styles.metaContainer, { marginTop: 12 }]}>
                  {details?.averageScore > 0 && (
                    <View style={styles.scoreContainer}>
                      <FontAwesome5 name="star" size={14} color="#FFD700" style={styles.metaIcon} />
                      <Text style={styles.scoreText}>{details?.averageScore}%</Text>
                    </View>
                  )}
                  {details?.trending > 0 && (
                    <TouchableOpacity style={styles.trendingContainer} onPress={handleTrendingPress}>
                      <FontAwesome5 name="fire" size={14} color="#FF4B4B" style={styles.metaIcon} />
                      <Text style={styles.trendingText}>#{details?.trending}</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              <View style={styles.infoRow}>
                                    <View style={styles.infoColumn}>
                      <Text style={[styles.infoLabel, { color: currentTheme.colors.textSecondary }]}>TYPE</Text>
                      <TouchableOpacity 
                        style={[styles.typeBadge, { backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : '#1f1f1f' }]}
                        onPress={() => {
                          console.log(`Manga format selected: ${details.format}`);
                          DeviceEventEmitter.emit('openMangaFormatSearch', details.format);
                        }}
                      >
                        <FontAwesome5 name="book" size={12} color="#fff" style={{ marginRight: 6 }} />
                        <Text style={styles.typeBadgeText}>{details.format || 'MANGA'}</Text>
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

              {user && !user.isAnonymous && (
                <TouchableOpacity
                  style={[
                    styles.progressButton,
                    { backgroundColor: currentTheme.colors.primary }
                  ]}
                  onPress={() => setShowListEditor(true)}
                >
                  <Text style={[styles.progressButtonText, { color: '#fff' }]}>
                    {formatStatus(details?.mediaListEntry?.status)}
                  </Text>
                  {details?.mediaListEntry?.progress !== undefined && details.mediaListEntry?.progress > 0 && (
                    <View style={styles.progressIndicator}>
                      <Text style={styles.progressIndicatorText}>
                        {details.mediaListEntry?.progress} of {details.chapters || '?'} chapters
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              )}

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
                          console.log(`Genre selected: ${genre}`);
                          
                          // Directly emit the event - no navigation first
                          console.log(`Emitting openGenreSearch event for: ${genre}`);
                          DeviceEventEmitter.emit('openGenreSearch', genre);
                        }}
                      >
                        <Text style={styles.genreChipText}>{genre}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
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
                  {details?.characters.edges.map(({ node, role }, index) => (
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
                  {details?.staff.edges.map(({ node, role }, index) => (
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

              <View style={styles.relatedSection}>
                <Text style={[styles.sectionLabel, { color: currentTheme.colors.textSecondary }]}>Related Media</Text>
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
                <Text style={[styles.sectionLabel, { color: currentTheme.colors.textSecondary }]}>More from {details?.title.userPreferred}</Text>
                <ScrollView 
                  horizontal 
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.relatedContent}
                >
                  {details?.recommendations.nodes
                    .slice(0, 10)
                    .map(({ mediaRecommendation }, index) => (
                      <TouchableOpacity 
                        key={`recommendation-${mediaRecommendation.id}-${index}`}
                        style={styles.relatedCard}
                        onPress={() => router.push(`/manga/${mediaRecommendation.id}`)}
                      >
                        <ExpoImage
                          source={{ uri: mediaRecommendation.coverImage.medium }}
                          style={styles.relatedCover}
                        />
                        {mediaRecommendation.averageScore && (
                          <View style={styles.recommendationScore}>
                            <Text style={[styles.recommendationScoreText, { color: currentTheme.colors.text }]}>
                              {formatScore(mediaRecommendation.averageScore)}
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
          ) : (
            renderReadTab()
          )}
        </View>
      </Animated.ScrollView>

      <View style={styles.stickyTabs}>
        <BlurView intensity={80} tint={isDarkMode ? "dark" : "light"} style={StyleSheet.absoluteFill} />
        {renderTabs()}
      </View>

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
                details?.mediaListEntry?.customLists.includes('read_using_moopa')
            }
          }}
          totalEpisodes={details?.chapters}
        />
      )}

      <ChapterSourcesModal
        visible={showChapterModal}
        onClose={() => setShowChapterModal(false)}
        chapter={null}
        mangaTitle={details?.title || { english: '', userPreferred: '' }}
        mangaId={id as string}
        countryOfOrigin={details?.countryOfOrigin}
        format={details?.format}
      />
      {/* Debug logging */}
      {(() => {
        console.log('Manga Details Debug:', {
          format: details?.format,
          countryOfOrigin: details?.countryOfOrigin,
          title: details?.title
        });
        return null;
      })()}

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
    </View>
  );
}

const { width, height } = Dimensions.get('window');
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    marginTop: -20,
  },
  readContent: {
    marginTop: 0,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
  },
  readTabContent: {
    flex: 1,
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
  customHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    overflow: 'hidden',
    height: Platform.OS === 'ios' ? 100 : 80,
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
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
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
    flex: 1,
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
  authorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  authorText: {
    fontSize: 15,
    fontWeight: '400',
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
  progressButton: {
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
  progressButtonText: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 4,
  },
  progressIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressIndicatorText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  synopsisSection: {
    marginBottom: 24,
    backgroundColor: 'rgba(0, 0, 0, 0.03)',
    padding: 16,
    borderRadius: 12,
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
  relatedSection: {
    marginBottom: 24,
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
  staffSection: {
    marginBottom: 24,
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
  charactersSection: {
    marginBottom: 24,
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
  reviewsSection: {
    marginBottom: 24,
  },
  reviewCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#eee',
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  reviewerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  reviewerInfo: {
    flex: 1,
  },
  reviewerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  ratingContainer: {
    flexDirection: 'row',
    gap: 4,
  },
  reviewSummary: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  reviewReadMore: {
    color: '#02A9FF',
    fontSize: 14,
    fontWeight: '500',
    marginTop: 8,
  },
  emptySection: {
    backgroundColor: '#f8f8f8',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#666',
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
  mediaFormat: {
    fontSize: 12,
    marginTop: 4,
    opacity: 0.7,
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
  mediaInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  mediaStatus: {
    fontSize: 12,
    fontWeight: '500',
  },
  genresSection: {
    marginHorizontal: 16,
    marginBottom: 20,
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