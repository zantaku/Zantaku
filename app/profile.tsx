import React, { useEffect, useState, useRef, createContext } from 'react';
import { View, Text, Image, ScrollView, StyleSheet, Pressable, useColorScheme, useWindowDimensions, TouchableOpacity, ActivityIndicator, Animated } from 'react-native';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { MaterialCommunityIcons, Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { BlurView } from 'expo-blur';
import { useAuth } from '../hooks/useAuth';
import Markdown from 'react-native-markdown-display';
import { Linking } from 'react-native';
import axios from 'axios';
import { ANILIST_GRAPHQL_ENDPOINT } from '../constants/auth';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../lib/supabase';
import * as SecureStore from 'expo-secure-store';
import { STORAGE_KEY } from '../constants/auth';
import { WebView } from 'react-native-webview';
import StreakBadge from '../components/StreakBadge';
import { useStreaks } from '../hooks/useStreaks';
import { getAnilistUser } from '../lib/supabase';

// AniList User Types based on API documentation
interface UserAvatar {
  large?: string;
  medium?: string;
}

interface Favorite {
  id: number;
  title?: {
    userPreferred: string;
  };
  name?: {
    full: string;
  };
  coverImage?: {
    medium: string;
  };
  image?: {
    medium: string;
  };
}

interface UserFavorites {
  anime: {
    nodes: Favorite[];
  };
  manga: {
    nodes: Favorite[];
  };
  characters: {
    nodes: Favorite[];
  };
  studios: {
    nodes: {
      id: number;
      name: string;
    }[];
  };
}

interface UserStats {
  totalAnime: number;
  totalManga: number;
  daysWatched: number;
  chaptersRead: number;
  meanScore: number;
  mangaMeanScore: number;
  animeStatusDistribution: {
    CURRENT: number;
    COMPLETED: number;
    PLANNING: number;
    DROPPED: number;
    PAUSED: number;
  };
  mangaStatusDistribution: {
    CURRENT: number;
    COMPLETED: number;
    PLANNING: number;
    DROPPED: number;
    PAUSED: number;
  };
}

interface AniListUser {
  id: number;
  name: string;
  about?: string | null;
  avatar?: {
    large?: string;
    medium?: string;
  };
  bannerImage?: string | null;
  options?: {
    profileColor?: string;
  };
  favourites?: UserFavorites;
  statistics: {
    anime: {
      count: number;
      meanScore: number;
      minutesWatched: number;
      statuses: Array<{
        status: string;
        count: number;
      }>;
    };
    manga: {
      count: number;
      meanScore: number;
      chaptersRead: number;
      statuses: Array<{
        status: string;
        count: number;
      }>;
    };
  };
}

interface StatCardProps {
  label: string;
  value: number;
  max?: number;
}

interface StatusDistribution {
  CURRENT: number;
  COMPLETED: number;
  PLANNING: number;
  DROPPED: number;
  PAUSED: number;
}

// Update the Activity interface
interface Activity {
  id: number;
  type: 'TEXT' | 'ANIME_LIST' | 'MANGA_LIST' | 'MESSAGE' | 'MEDIA_LIST';
  status: 'CURRENT' | 'PLANNING' | 'COMPLETED' | 'DROPPED' | 'PAUSED' | 'REPEATING';
  progress: string;
  createdAt: number;
  user: {
    id: number;
    name: string;
    avatar?: {
      medium: string;
    };
  };
  media?: {
    id: number;
    type: 'ANIME' | 'MANGA';
    title: {
      userPreferred: string;
      romaji: string;
      english: string;
      native: string;
    };
    coverImage: {
      medium: string;
    };
    format: string;
    episodes?: number;
    chapters?: number;
    status: string;
  };
}

interface FavoriteSectionProps {
  title: string;
  items: any[];
  type: 'anime' | 'manga' | 'characters' | 'studios';
  onPress?: (item: any) => void;
  fadeAnim: Animated.Value;
}

const FavoriteSection = ({ title, items, type, onPress, fadeAnim }: FavoriteSectionProps) => {
  const { currentTheme: theme } = useTheme();
  const isDark = useColorScheme() === 'dark';
  
  if (!items || items.length === 0) return null;
  
  const renderItem = (item: any, index: number) => {
    const imageUrl = type === 'characters' 
      ? item.image?.medium 
      : type === 'studios' 
        ? null
        : item.coverImage?.medium;
    
    const displayName = type === 'characters' 
      ? item.name?.full 
      : type === 'studios' 
        ? item.name
        : item.title?.userPreferred;

    return (
      <Animated.View 
        key={index}
        style={{
          opacity: fadeAnim,
          transform: [{ 
            translateY: fadeAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [20, 0]
            })
          }]
        }}
      >
        <TouchableOpacity 
          style={[styles.favoriteItem, { backgroundColor: isDark ? 'rgba(60, 60, 60, 0.9)' : 'rgba(240, 240, 240, 0.9)' }]}
          onPress={() => onPress?.(item)}
          activeOpacity={0.7}
        >
          {imageUrl ? (
            <Image
              source={{ uri: imageUrl }}
              style={styles.favoriteImage}
              resizeMode="cover"
            />
          ) : type === 'studios' ? (
            <View style={[styles.studioPlaceholder, { backgroundColor: theme.colors.primary }]}>
              <Text style={styles.studioInitial}>{item.name?.charAt(0)}</Text>
            </View>
          ) : null}
          <Text 
            style={[styles.favoriteName, { color: isDark ? '#FFFFFF' : theme.colors.text }]} 
            numberOfLines={2}
          >
            {displayName}
          </Text>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  return (
    <Animated.View
      style={{
        opacity: fadeAnim,
        transform: [{ 
          translateY: fadeAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [20, 0]
          })
        }],
        marginBottom: 24
      }}
    >
      <View style={styles.sectionHeader}>
        <MaterialCommunityIcons 
          name={
            type === 'anime' ? 'television-classic' : 
            type === 'manga' ? 'book-open-variant' :
            type === 'characters' ? 'account-group' : 'office-building'
          } 
          size={20} 
          color={theme.colors.primary} 
        />
        <Text style={[styles.sectionTitle, { color: isDark ? '#FFFFFF' : theme.colors.text }]}>
          {title}
        </Text>
      </View>
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.favoritesContainer}
      >
        {items.map(renderItem)}
      </ScrollView>
    </Animated.View>
  );
};

const StatCard = ({ label, value, max = 0 }: StatCardProps) => {
  const { currentTheme: theme } = useTheme();
  const isDark = useColorScheme() === 'dark';
  const isMeanScore = label.toLowerCase().includes('mean score');
  
  // Generate gradient colors based on label type
  const getGradientColors = (): [string, string] => {
    switch (label.toLowerCase()) {
      case 'total anime':
      case 'watching':
        return isDark ? ['#FF5F6D44', '#FFC37144'] : ['#FF5F6D22', '#FFC37122'];
      case 'days watched':
      case 'completed':
        return isDark ? ['#4E54C844', '#8F94FB44'] : ['#4E54C822', '#8F94FB22'];
      case 'mean score':
        return isDark ? ['#11998E44', '#38EF7D44'] : ['#11998E22', '#38EF7D22'];
      case 'total manga':
      case 'reading':
        return isDark ? ['#FC466B44', '#3F5EFB44'] : ['#FC466B22', '#3F5EFB22'];
      case 'chapters read':
      case 'planning':
        return isDark ? ['#6B73FF44', '#000DFF44'] : ['#6B73FF22', '#000DFF22'];
      case 'dropped':
        return isDark ? ['#EB343444', '#FF454544'] : ['#EB343422', '#FF454522'];
      case 'paused':
        return isDark ? ['#83858744', '#9B9B9B44'] : ['#83858722', '#9B9B9B22'];
      default:
        return isDark ? ['#45B7D144', '#2EBAC644'] : ['#45B7D122', '#2EBAC622'];
    }
  };

  const gradientColors = getGradientColors();
  
  // Get color based on score value
  const getScoreColor = (score: number): string => {
    if (score >= 85) return '#38EF7D';
    if (score >= 70) return '#4E54C8';
    if (score >= 60) return '#FFC371';
    return '#FF5F6D';
  };

  return (
    <View style={[styles.statCard, { 
      borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
    }]}>
      <LinearGradient
        colors={gradientColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradientBackground}
      />
      <View style={styles.statContent}>
        {isMeanScore ? (
          <>
            <View style={styles.scoreCircle}>
              <View style={[styles.scoreInnerCircle, {
                borderColor: getScoreColor(value),
              }]}>
                <Text style={[styles.scoreValue, { 
                  color: isDark ? '#FFFFFF' : theme.colors.text,
                  fontSize: 12,
                }]}>
                  {value}
                </Text>
              </View>
            </View>
            <Text style={[styles.statLabel, { 
              color: isDark ? 'rgba(255, 255, 255, 0.8)' : theme.colors.text,
              opacity: isDark ? 1 : 0.7,
              marginTop: 8,
            }]}>
              {label}
            </Text>
          </>
        ) : (
          <>
            <Text style={[styles.statValue, { 
              color: isDark ? '#FFFFFF' : theme.colors.text,
              opacity: 0.95
            }]}>
              {max > 0 ? `${value}/${max}` : value}
            </Text>
            <Text style={[styles.statLabel, { 
              color: isDark ? 'rgba(255, 255, 255, 0.8)' : theme.colors.text,
              opacity: isDark ? 1 : 0.7
            }]}>
              {label}
            </Text>
          </>
        )}
      </View>
    </View>
  );
};

// Just above the ProfileScreen component, add this Toast state handling function
const hideErrorToasts = () => {
  // In a real implementation, you would use a proper toast/notification system
  // For React Native, we should use a state-based approach
  // This is a placeholder that doesn't rely on DOM manipulation
  
  // To properly implement error toast hiding, you would:
  // 1. Use a toast library that supports programmatic dismissal (like react-native-toast-message)
  // 2. Or manage toast visibility through component state
  
  // For now, we'll just return as the DOM approach won't work in React Native
  return;
};

const ProfileScreen = () => {
  const colorScheme = useColorScheme();
  const { currentTheme: theme } = useTheme();
  const { user, signIn } = useAuth();
  const { width } = useWindowDimensions();
  const [userProfile, setUserProfile] = useState<AniListUser | null>(null);
  const [stats, setStats] = useState<UserStats>({
    totalAnime: 0,
    totalManga: 0,
    daysWatched: 0,
    chaptersRead: 0,
    meanScore: 0,
    mangaMeanScore: 0,
    animeStatusDistribution: {
      CURRENT: 0,
      COMPLETED: 0,
      PLANNING: 0,
      DROPPED: 0,
      PAUSED: 0,
    },
    mangaStatusDistribution: {
      CURRENT: 0,
      COMPLETED: 0,
      PLANNING: 0,
      DROPPED: 0,
      PAUSED: 0,
    },
  });
  const isDark = colorScheme === 'dark';
  const router = useRouter();
  const params = useLocalSearchParams();
  const targetUserId = params.userId ? parseInt(params.userId as string) : user?.id;
  const [isVerified, setIsVerified] = useState(false);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bioExpanded, setBioExpanded] = useState(false);
  const [processedBio, setProcessedBio] = useState('');
  const [webViewHeight, setWebViewHeight] = useState(200); // Initial height, will be adjusted dynamically
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const [joinDate, setJoinDate] = useState<string>("Joined Zantaku"); // Default value until we load real data
  
  // Get user's streak information
  const { currentStreak, longestStreak, activityType, isLoading: isLoadingStreaks } = useStreaks(targetUserId);

  // At the beginning of the component, add extra animation values
  const verifiedBadgeAnim = useRef(new Animated.Value(0)).current;
  
  const fetchUserProfile = async () => {
    if (!targetUserId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      // Try to get token but don't require it
      const token = await SecureStore.getItemAsync(STORAGE_KEY.AUTH_TOKEN);
      console.log('Token available:', !!token);

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      };

      // Only add authorization if token exists
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const { data } = await axios.post(
        ANILIST_GRAPHQL_ENDPOINT,
        {
          query: `
            query ($userId: Int) {
              User(id: $userId) {
                id
                name
                about(asHtml: true)
                avatar {
                  large
                  medium
                }
                bannerImage
                options {
                  profileColor
                  titleLanguage
                  displayAdultContent
                }
                mediaListOptions {
                  scoreFormat
                }
                favourites {
                  anime {
                    nodes {
                      id
                      title {
                        userPreferred
                      }
                      coverImage {
                        medium
                      }
                    }
                  }
                  manga {
                    nodes {
                      id
                      title {
                        userPreferred
                      }
                      coverImage {
                        medium
                      }
                    }
                  }
                  characters {
                    nodes {
                      id
                      name {
                        full
                      }
                      image {
                        medium
                      }
                    }
                  }
                  studios {
                    nodes {
                      id
                      name
                    }
                  }
                }
                statistics {
                  anime {
                    count
                    meanScore
                    minutesWatched
                    statuses {
                      status
                      count
                    }
                  }
                  manga {
                    count
                    meanScore
                    chaptersRead
                    statuses {
                      status
                      count
                    }
                  }
                }
              }
              ${token ? `
                Page(page: 1, perPage: 25) {
                  activities(userId: $userId, sort: ID_DESC, type: MEDIA_LIST) {
                    ... on ListActivity {
                      id
                      type
                      status
                      progress
                      createdAt
                      user {
                        id
                        name
                        avatar {
                          medium
                        }
                      }
                      media {
                        id
                        type
                        title {
                          userPreferred
                          romaji
                          english
                          native
                        }
                        coverImage {
                          medium
                        }
                        format
                        episodes
                        chapters
                        status
                      }
                    }
                  }
                }
              ` : ''}
            }
          `,
          variables: {
            userId: targetUserId
          }
        },
        { headers }
      );

      if (data.data.User) {
        console.log('Fetched user profile:', data.data.User);
        setUserProfile(data.data.User);
        
        // Process the HTML bio and convert to markdown if it exists
        if (data.data.User.about) {
          // Simple HTML to markdown-like conversion
          // This is a basic implementation - you may want to use a proper HTML-to-markdown converter
          const htmlBio = data.data.User.about;
          const markdownBio = htmlBio
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/<p>(.*?)<\/p>/gi, '$1\n\n')
            .replace(/<h[1-6]>(.*?)<\/h[1-6]>/gi, '## $1\n\n')
            .replace(/<strong>(.*?)<\/strong>/gi, '**$1**')
            .replace(/<em>(.*?)<\/em>/gi, '*$1*')
            .replace(/<a href="(.*?)">(.*?)<\/a>/gi, '[$2]($1)')
            .replace(/<ul>(.*?)<\/ul>/gis, function(match: string) {
              return match
                .replace(/<li>(.*?)<\/li>/gi, '• $1\n')
                .replace(/<\/?ul>/gi, '');
            })
            .replace(/<blockquote>(.*?)<\/blockquote>/gis, '> $1\n')
            .replace(/<[^>]*>/g, ''); // Remove remaining HTML tags
            
          setProcessedBio(markdownBio);
        }
        
        // Process statistics
        const animeStats = data.data.User.statistics.anime;
        const mangaStats = data.data.User.statistics.manga;
        
        const animeStatusDist: Partial<StatusDistribution> = {};
        const mangaStatusDist: Partial<StatusDistribution> = {};
        
        animeStats.statuses.forEach(({ status, count }: { status: keyof StatusDistribution; count: number }) => {
          animeStatusDist[status] = count;
        });
        
        mangaStats.statuses.forEach(({ status, count }: { status: keyof StatusDistribution; count: number }) => {
          mangaStatusDist[status] = count;
        });

        setStats({
          totalAnime: animeStats.count,
          totalManga: mangaStats.count,
          daysWatched: Math.round(animeStats.minutesWatched / 1440), // Convert minutes to days
          chaptersRead: mangaStats.chaptersRead,
          meanScore: animeStats.meanScore,
          mangaMeanScore: mangaStats.meanScore,
          animeStatusDistribution: {
            CURRENT: animeStatusDist.CURRENT || 0,
            COMPLETED: animeStatusDist.COMPLETED || 0,
            PLANNING: animeStatusDist.PLANNING || 0,
            DROPPED: animeStatusDist.DROPPED || 0,
            PAUSED: animeStatusDist.PAUSED || 0,
          },
          mangaStatusDistribution: {
            CURRENT: mangaStatusDist.CURRENT || 0,
            COMPLETED: mangaStatusDist.COMPLETED || 0,
            PLANNING: mangaStatusDist.PLANNING || 0,
            DROPPED: mangaStatusDist.DROPPED || 0,
            PAUSED: mangaStatusDist.PAUSED || 0,
          },
        });
      }

      // Set activities only if we have a token and activities data
      if (token && data.data.Page?.activities) {
        setActivities(data.data.Page.activities);
      }
    } catch (error: any) {
      console.error('Error fetching user profile:', error);
      setError(
        error.response?.status === 404
          ? 'User not found'
          : error.response?.status === 429
          ? 'Too many requests. Please try again later.'
          : 'Failed to load profile'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUserProfile();
    
    // Start fade-in animation when component mounts
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();
    
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 8,
      tension: 40,
      useNativeDriver: true,
    }).start();
  }, [targetUserId]);

  useEffect(() => {
    const checkVerificationStatus = async () => {
      // Only check verification status for the current logged-in user
      if (!user?.id || targetUserId !== user.id) {
        setIsVerified(false);
        return;
      }
      
      try {
        // First try to get user data from Supabase
        const { data, error } = await supabase
          .from('anilist_users')
          .select('is_verified, created_at')  // Also select created_at
          .eq('anilist_id', user.id)
          .single();
        
        if (error) {
          console.error('Error fetching verification status from Supabase:', error);
          
          // Fallback approach 1: Check if user verification status is in SecureStore
          try {
            const storedUserData = await SecureStore.getItemAsync(STORAGE_KEY.USER_DATA);
            if (storedUserData) {
              const userData = JSON.parse(storedUserData);
              // Check if userData has isVerified field
              if (userData && userData.isVerified !== undefined) {
                setIsVerified(userData.isVerified);
                
                // Animate the badge
                Animated.spring(verifiedBadgeAnim, {
                  toValue: 1,
                  friction: 8,
                  tension: 40,
                  useNativeDriver: true,
                }).start();
                
                return;
              }
            }
          } catch (secureStoreError) {
            console.error('Error checking verification in SecureStore:', secureStoreError);
          }
          
          // Fallback approach 2: Try direct API call
          try {
            const userData = await getAnilistUser(user.id);
            if (userData) {
              setIsVerified(userData.is_verified || false);
              
              // Set join date if available
              if (userData.created_at) {
                const joinDateObj = new Date(userData.created_at);
                const formattedDate = `Joined ${joinDateObj.toLocaleString('default', { month: 'long', year: 'numeric' })}`;
                setJoinDate(formattedDate);
              }
              
              // Animate the badge if verified
              if (userData.is_verified) {
                Animated.spring(verifiedBadgeAnim, {
                  toValue: 1,
                  friction: 8,
                  tension: 40,
                  useNativeDriver: true,
                }).start();
              }
              
              return;
            }
          } catch (apiError) {
            console.error('Error getting verification status via API:', apiError);
          }
          
          setIsVerified(false);
          return;
        }
        
        setIsVerified(data?.is_verified || false);
        
        // Format and set join date if available
        if (data?.created_at) {
          const joinDateObj = new Date(data.created_at);
          const formattedDate = `Joined ${joinDateObj.toLocaleString('default', { month: 'long', year: 'numeric' })}`;
          setJoinDate(formattedDate);
        }
        
        // Animate the badge if verified
        if (data?.is_verified) {
          Animated.spring(verifiedBadgeAnim, {
            toValue: 1,
            friction: 8,
            tension: 40,
            useNativeDriver: true,
          }).start();
        }
        
        // Try to hide any error toasts
        hideErrorToasts();
        
      } catch (error) {
        console.error('Error checking verification status:', error);
        setIsVerified(false);
      }
    };

    checkVerificationStatus();
  }, [targetUserId, user?.id, verifiedBadgeAnim]);

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
  };

  const renderActivity = (activity: Activity) => {
    const isAnime = activity.media?.type === 'ANIME';
    const totalCount = isAnime ? activity.media?.episodes : activity.media?.chapters;

    return (
      <TouchableOpacity
        key={activity.id}
        style={[
          styles.activityItem,
          {
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.border,
          }
        ]}
        onPress={() => {
          if (activity.media) {
            router.push({
              pathname: isAnime ? '/anime/[id]' : '/manga/[id]',
              params: { id: activity.media.id }
            });
          }
        }}
      >
        {activity.media?.coverImage && (
          <Image
            source={{ uri: activity.media.coverImage.medium }}
            style={styles.activityImage}
          />
        )}
        <View style={styles.activityContent}>
          <View style={styles.activityHeader}>
            <Text style={[styles.activityTitle, { color: isDark ? '#FFFFFF' : theme.colors.text }]} numberOfLines={2}>
              {activity.media?.title.userPreferred}
            </Text>
            <Text style={[styles.activityTime, { color: isDark ? 'rgba(255, 255, 255, 0.7)' : theme.colors.textSecondary }]}>
              {formatTimestamp(activity.createdAt)}
            </Text>
          </View>
          <View style={styles.activityDetails}>
            <View style={[styles.activityBadge, { backgroundColor: isDark ? 'rgba(80, 80, 80, 0.9)' : '#F0F0F0' }]}>
              <Text style={[styles.activityBadgeText, { color: isDark ? 'rgba(255, 255, 255, 0.8)' : theme.colors.textSecondary }]}>
                {activity.media?.format}
              </Text>
            </View>
            {totalCount && (
              <Text style={[styles.activityProgress, { color: '#02A9FF' }]}>
                {activity.progress} of {totalCount}
              </Text>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (!targetUserId) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <Stack.Screen options={{ headerShown: true }} />
        <View style={styles.loginPrompt}>
          <FontAwesome5 
            name="user-circle" 
            size={64} 
            color={theme.colors.primary}
            style={{ marginBottom: 16 }}
          />
          <Text style={[styles.loginTitle, { color: theme.colors.text }]}>
            Sign in to AniList
          </Text>
          <Text style={[styles.loginSubtitle, { color: theme.colors.textSecondary }]}>
            Track your anime and manga progress, join the community, and discover new titles
          </Text>
          <TouchableOpacity
            style={[styles.loginButton, { backgroundColor: theme.colors.primary }]}
            onPress={signIn}
          >
            <Text style={styles.loginButtonText}>Sign In</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <Stack.Screen options={{ headerShown: true }} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>
            Loading profile...
          </Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <Stack.Screen options={{ headerShown: true }} />
        <View style={styles.errorContainer}>
          <FontAwesome5 
            name="exclamation-circle" 
            size={64} 
            color={theme.colors.error}
            style={{ marginBottom: 16 }}
          />
          <Text style={[styles.errorText, { color: theme.colors.error }]}>
            {error}
          </Text>
          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: theme.colors.primary }]}
            onPress={fetchUserProfile}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Replace the WebView bio container with Markdown
  const renderBio = () => {
    if (!userProfile?.about) return null;
    
    // Use the profile color if available, otherwise use default colors
    const bgColor = userProfile?.options?.profileColor 
      ? (isDark ? `${userProfile.options.profileColor}20` : `${userProfile.options.profileColor}10`)
      : (isDark ? 'rgba(30, 30, 30, 0.8)' : 'rgba(245, 245, 245, 0.8)');
      
    const borderColor = userProfile?.options?.profileColor 
      ? (isDark ? `${userProfile.options.profileColor}30` : `${userProfile.options.profileColor}20`)
      : (isDark ? 'rgba(60, 60, 60, 0.5)' : 'rgba(230, 230, 230, 0.5)');
      
    return (
      <Animated.View 
        style={[
          styles.bioContainer,
          {
            backgroundColor: isDark ? 'rgba(45, 45, 45, 0.95)' : 'rgba(255, 255, 255, 0.95)',
            borderColor: borderColor,
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }],
          }
        ]}
      >
        <LinearGradient
          colors={[bgColor, 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradientBackground}
        />
        <WebView
          style={[
            styles.webView,
            { height: webViewHeight }
          ]}
          scrollEnabled={false}
          showsVerticalScrollIndicator={false}
          showsHorizontalScrollIndicator={false}
          originWhitelist={['*']}
          containerStyle={{ borderRadius: 16 }}
          onNavigationStateChange={(event) => {
            if (event.url !== 'about:blank') {
              Linking.openURL(event.url);
              return false;
            }
          }}
          injectedJavaScript={`
            (function() {
              // Calculate and set the WebView height based on content
              function updateHeight() {
                const height = document.body.scrollHeight;
                window.ReactNativeWebView.postMessage(JSON.stringify({type: 'height', height: height}));
              }
              
              // Run once when content is loaded
              updateHeight();
              
              // Run again after images load
              window.addEventListener('load', updateHeight);
              
              // Handle link clicks
              function wrap(fn) {
                return function wrapper() {
                  var res = fn.apply(this, arguments);
                  window.ReactNativeWebView.postMessage('navigationStateChange');
                  return res;
                }
              }
              history.pushState = wrap(history.pushState);
              history.replaceState = wrap(history.replaceState);
              window.addEventListener('popstate', function() {
                window.ReactNativeWebView.postMessage('navigationStateChange');
              });
              document.addEventListener('click', function(e) {
                if (e.target.tagName === 'A' && e.target.href) {
                  e.preventDefault();
                  window.ReactNativeWebView.postMessage(e.target.href);
                  return false;
                }
              });
              
              // Add resize observer to detect content changes
              const resizeObserver = new ResizeObserver(entries => {
                updateHeight();
              });
              resizeObserver.observe(document.body);
            })();
          `}
          onMessage={(event) => {
            const data = event.nativeEvent.data;
            try {
              const parsedData = JSON.parse(data);
              if (parsedData.type === 'height') {
                // Update WebView height dynamically based on content
                setWebViewHeight(parsedData.height);
              }
            } catch (e) {
              // Handle link clicks
              if (data !== 'navigationStateChange' && data.startsWith('http')) {
                Linking.openURL(data);
              }
            }
          }}
          source={{
            html: `
              <html>
                <head>
                  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
                  <style>
                    html, body {
                      margin: 0;
                      padding: 0;
                      height: auto;
                      overflow: visible;
                    }
                    body {
                      padding: 16px;
                      font-family: -apple-system, system-ui;
                      font-size: 14px;
                      line-height: 1.6;
                      color: ${isDark ? '#FFFFFF' : '#000000'};
                      text-align: left;
                      background-color: transparent;
                    }
                    a {
                      color: ${userProfile?.options?.profileColor || theme.colors.primary};
                      text-decoration: none;
                      opacity: 0.9;
                    }
                    p {
                      margin: 12px 0;
                      opacity: 1;
                    }
                    img {
                      max-width: 100%;
                      border-radius: 8px;
                      margin: 8px 0;
                    }
                    h1, h2, h3, h4, h5, h6 {
                      margin: 20px 0 12px 0;
                      line-height: 1.3;
                      opacity: 1;
                    }
                    ul, ol {
                      padding-left: 24px;
                      margin: 12px 0;
                      text-align: left;
                      opacity: 1;
                    }
                    li {
                      margin: 6px 0;
                    }
                    blockquote {
                      margin: 16px 0;
                      padding: 12px 20px;
                      border-left: 4px solid ${userProfile?.options?.profileColor || theme.colors.primary};
                      background-color: ${isDark ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.6)'};
                      border-radius: 8px;
                    }
                    code {
                      background-color: ${isDark ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.6)'};
                      padding: 3px 6px;
                      border-radius: 6px;
                      font-family: monospace;
                    }
                    pre {
                      background-color: ${isDark ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.6)'};
                      padding: 12px;
                      border-radius: 8px;
                      overflow-x: auto;
                      margin: 16px 0;
                    }
                    pre code {
                      background-color: transparent;
                      padding: 0;
                    }
                  </style>
                </head>
                <body>
                  ${userProfile.about || ''}
                </body>
              </html>
            `
          }}
          onError={(syntheticEvent) => {
            const { nativeEvent } = syntheticEvent;
            console.warn('WebView error:', nativeEvent);
          }}
        />
      </Animated.View>
    );
  };

  return (
    <ScrollView 
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      showsVerticalScrollIndicator={false}
    >
      <Stack.Screen 
        options={{
          headerShown: true,
        }} 
      />
      
      {/* Profile Header - Full width banner */}
      <Animated.View 
        style={[
          styles.header,
          { 
            opacity: fadeAnim,
            marginHorizontal: -16, // Extend beyond padding
            borderRadius: 0, // Remove border radius for full width
          }
        ]}
      >
        {/* Banner with gradient overlay */}
        <View style={styles.bannerContainer}>
          {userProfile?.bannerImage ? (
            <Image
              source={{ uri: userProfile.bannerImage }}
              style={styles.bannerImage}
              resizeMode="cover"
            />
          ) : (
            <View style={[styles.defaultBanner, { 
              backgroundColor: userProfile?.options?.profileColor || theme.colors.primary 
            }]} />
          )}
          
          {/* Gradient overlay on banner */}
          <LinearGradient
            colors={['transparent', isDark ? 'rgba(0,0,0,0.9)' : 'rgba(0,0,0,0.7)']}
            style={styles.bannerGradient}
          />
        </View>
        
        <View style={[styles.profileContent, { paddingHorizontal: 32 }]}>
          {/* Avatar with animation and shadow */}
          <Animated.View 
            style={[
              styles.avatarContainer,
              { 
                transform: [{ scale: scaleAnim }],
                shadowColor: userProfile?.options?.profileColor || theme.colors.primary,
              }
            ]}
          >
            <Image
              source={{ uri: userProfile?.avatar?.large || 'https://placekitten.com/200/200' }}
              style={styles.avatar}
            />
            
            {/* Pulsing glow effect for avatar (subtle animation) */}
            {userProfile?.options?.profileColor && (
              <Animated.View 
                style={[
                  styles.avatarGlow,
                  { 
                    backgroundColor: userProfile.options.profileColor + '20',
                    borderColor: userProfile.options.profileColor + '40',
                  }
                ]} 
              />
            )}
          </Animated.View>
          
          {/* Username and badges container - properly aligned */}
          <View style={styles.userInfoContainer}>
            {/* Username and verified badge on same row */}
            <View style={styles.usernameRow}>
              <Text style={[styles.username, { 
                color: isDark ? '#FFFFFF' : '#000000',
                textShadowColor: 'rgba(0,0,0,0.6)',
                textShadowOffset: { width: 0, height: 2 },
                textShadowRadius: 5
              }]} numberOfLines={1} ellipsizeMode="tail">
                {userProfile?.name || 'Username'}
              </Text>
              
              {isVerified && (
                <Animated.View 
                  style={{
                    transform: [
                      { scale: verifiedBadgeAnim }
                    ],
                    marginLeft: 10,
                    opacity: verifiedBadgeAnim,
                    alignSelf: 'flex-start',
                    marginTop: 2
                  }}
                >
                  <LinearGradient
                    colors={['#1DA1F2', '#1A91DA']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.verifiedGradient}
                  >
                    <FontAwesome5 
                      name="check" 
                      size={10} 
                      color="#FFFFFF"
                      style={styles.verifiedIcon}
                    />
                  </LinearGradient>
                </Animated.View>
              )}
              
              {/* Add streak badge */}
              {currentStreak > 0 && (
                <Animated.View 
                  style={{
                    transform: [{ scale: scaleAnim }],
                    marginLeft: 8,
                  }}
                >
                  <StreakBadge 
                    streak={currentStreak}
                    type={activityType}
                    size="small"
                    style={{
                      borderRadius: 12,
                      shadowColor: "#000",
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.1,
                      shadowRadius: 3,
                      elevation: 2,
                    }}
                  />
                </Animated.View>
              )}
            </View>
            
            {/* User flair with proper alignment and spacing */}
            <Animated.View style={{ opacity: fadeAnim, marginTop: 4 }}>
              <Text style={[styles.userFlair, { 
                color: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.7)',
              }]}>
                {joinDate}
              </Text>
            </Animated.View>
          </View>
        </View>
      </Animated.View>

      {/* Content Container */}
      <View style={styles.contentContainer}>
        {/* Add Streak Stats Section near the top */}
        {(currentStreak > 0 || longestStreak > 0) && (
          <Animated.View
            style={{
              opacity: fadeAnim,
              transform: [{ 
                translateY: fadeAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [20, 0]
                })
              }],
              marginBottom: 24
            }}
          >
            <View style={styles.sectionHeader}>
              <FontAwesome5 name="fire" size={20} color="#FF5722" />
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                Activity Streak
              </Text>
            </View>
            
                    <View style={[
          styles.streakContainer, 
          { 
            backgroundColor: isDark ? 'rgba(70, 70, 70, 0.95)' : 'rgba(240, 240, 240, 0.95)',
            borderRadius: 12, 
            padding: 16,
            flexDirection: 'row',
            justifyContent: 'space-around',
            alignItems: 'center',
          }
        ]}>
          <View style={styles.streakItem}>
            <Text style={[styles.streakValue, { color: isDark ? '#FFFFFF' : theme.colors.text }]}>
              {currentStreak}
            </Text>
            <Text style={[styles.streakLabel, { color: isDark ? 'rgba(255, 255, 255, 0.8)' : theme.colors.textSecondary }]}>
              Current Streak
            </Text>
          </View>
          
          <View style={styles.streakDivider} />
          
          <View style={styles.streakItem}>
            <Text style={[styles.streakValue, { color: isDark ? '#FFFFFF' : theme.colors.text }]}>
              {longestStreak}
            </Text>
            <Text style={[styles.streakLabel, { color: isDark ? 'rgba(255, 255, 255, 0.8)' : theme.colors.textSecondary }]}>
              Longest Streak
            </Text>
          </View>
              
              {activityType !== 'none' && (
                <>
                  <View style={styles.streakDivider} />
                  
                  <View style={styles.streakItem}>
                    <Text style={[
                      styles.streakTypeValue, 
                      { 
                        color: isDark ? '#FFFFFF' : theme.colors.text,
                        textTransform: 'capitalize' 
                      }
                    ]}>
                      {activityType}
                    </Text>
                    <Text style={[styles.streakLabel, { color: isDark ? 'rgba(255, 255, 255, 0.8)' : theme.colors.textSecondary }]}>
                      Activity Type
                    </Text>
                  </View>
                </>
              )}
            </View>
          </Animated.View>
        )}

        {/* Bio Section */}
        {renderBio()}

        {/* Favorite Sections (Moved to top) */}
        {/* Favorite Anime */}
        {userProfile?.favourites?.anime?.nodes && userProfile.favourites.anime.nodes.length > 0 && (
          <Animated.View
            style={{
              opacity: fadeAnim,
              transform: [{ 
                translateY: fadeAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [20, 0]
                })
              }],
              marginBottom: 24
            }}
          >
            <View style={styles.sectionHeader}>
              <MaterialCommunityIcons name="television-classic" size={20} color={theme.colors.primary} />
              <Text style={[styles.sectionTitle, { color: isDark ? '#FFFFFF' : theme.colors.text }]}>
                Favorite Anime
              </Text>
            </View>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.favoritesContainer}
            >
              {userProfile.favourites.anime.nodes.map((item, index) => (
                <TouchableOpacity 
                  key={index}
                  style={[styles.favoriteItem, { backgroundColor: isDark ? 'rgba(60, 60, 60, 0.9)' : 'rgba(240, 240, 240, 0.9)' }]}
                  onPress={() => router.push({
                    pathname: '/anime/[id]',
                    params: { id: item.id }
                  })}
                  activeOpacity={0.7}
                >
                  {item.coverImage?.medium && (
                    <Image
                      source={{ uri: item.coverImage.medium }}
                      style={styles.favoriteImage}
                      resizeMode="cover"
                    />
                  )}
                  <Text 
                    style={[styles.favoriteName, { color: isDark ? '#FFFFFF' : theme.colors.text }]} 
                    numberOfLines={2}
                  >
                    {item.title?.userPreferred}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </Animated.View>
        )}

        {/* Favorite Manga */}
        {userProfile?.favourites?.manga?.nodes && userProfile.favourites.manga.nodes.length > 0 && (
          <Animated.View
            style={{
              opacity: fadeAnim,
              transform: [{ 
                translateY: fadeAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [20, 0]
                })
              }],
              marginBottom: 24
            }}
          >
            <View style={styles.sectionHeader}>
              <MaterialCommunityIcons name="book-open-variant" size={20} color={theme.colors.primary} />
              <Text style={[styles.sectionTitle, { color: isDark ? '#FFFFFF' : theme.colors.text }]}>
                Favorite Manga
              </Text>
            </View>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.favoritesContainer}
            >
              {userProfile.favourites.manga.nodes.map((item, index) => (
                <TouchableOpacity 
                  key={index}
                  style={[styles.favoriteItem, { backgroundColor: isDark ? 'rgba(60, 60, 60, 0.9)' : 'rgba(240, 240, 240, 0.9)' }]}
                  onPress={() => router.push({
                    pathname: '/manga/[id]',
                    params: { id: item.id }
                  })}
                  activeOpacity={0.7}
                >
                  {item.coverImage?.medium && (
                    <Image
                      source={{ uri: item.coverImage.medium }}
                      style={styles.favoriteImage}
                      resizeMode="cover"
                    />
                  )}
                  <Text 
                    style={[styles.favoriteName, { color: isDark ? '#FFFFFF' : theme.colors.text }]} 
                    numberOfLines={2}
                  >
                    {item.title?.userPreferred}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </Animated.View>
        )}

        {/* Favorite Characters */}
        {userProfile?.favourites?.characters?.nodes && userProfile.favourites.characters.nodes.length > 0 && (
          <FavoriteSection 
            title="Favorite Characters" 
            items={userProfile?.favourites?.characters?.nodes || []}
            type="characters"
            fadeAnim={fadeAnim}
            onPress={(item) => {
              // Handle character press if needed
            }}
          />
        )}

        {/* Favorite Studios */}
        {userProfile?.favourites?.studios?.nodes && userProfile.favourites.studios.nodes.length > 0 && (
          <FavoriteSection 
            title="Favorite Studios" 
            items={userProfile?.favourites?.studios?.nodes || []}
            type="studios"
            fadeAnim={fadeAnim}
            onPress={(item) => {
              // Handle studio press if needed
            }}
          />
        )}

        {/* Lists Navigation - Only show if not viewing own profile */}
        {(!user || targetUserId !== user.id) && (
          <Animated.View 
            style={[
              styles.listsNavigation,
              {
                opacity: fadeAnim,
                transform: [{ translateY: fadeAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [20, 0]
                })}]
              }
            ]}
          >
            <TouchableOpacity
              style={[styles.listButton, { backgroundColor: theme.colors.surface, borderColor: theme.colors.primary }]}
              onPress={() => router.push({
                pathname: '/watchlist',
                params: { userId: targetUserId }
              })}
            >
              <FontAwesome5 name="tv" size={16} color={theme.colors.primary} />
              <View style={styles.listButtonContent}>
                <Text style={[styles.listButtonTitle, { color: isDark ? '#FFFFFF' : theme.colors.text }]}>Anime List</Text>
                <Text style={[styles.listButtonSubtitle, { color: isDark ? 'rgba(255, 255, 255, 0.7)' : theme.colors.textSecondary }]}>
                  {stats.animeStatusDistribution.CURRENT} watching now
                </Text>
              </View>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.listButton, { backgroundColor: theme.colors.surface, borderColor: theme.colors.primary }]}
              onPress={() => router.push({
                pathname: '/readlist',
                params: { userId: targetUserId }
              })}
            >
              <FontAwesome5 name="book" size={16} color={theme.colors.primary} />
              <View style={styles.listButtonContent}>
                <Text style={[styles.listButtonTitle, { color: isDark ? '#FFFFFF' : theme.colors.text }]}>Manga List</Text>
                <Text style={[styles.listButtonSubtitle, { color: isDark ? 'rgba(255, 255, 255, 0.7)' : theme.colors.textSecondary }]}>
                  {stats.mangaStatusDistribution.CURRENT} reading now
                </Text>
              </View>
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* Section Headers and Stats */}
        <Animated.View 
          style={{
            opacity: fadeAnim,
            transform: [{ translateY: fadeAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [20, 0]
            })}]
          }}
        >
          <View style={styles.sectionHeader}>
            <MaterialCommunityIcons name="chart-box-outline" size={20} color={theme.colors.primary} />
            <Text style={[styles.sectionTitle, { color: isDark ? '#FFFFFF' : theme.colors.text }]}>Overview</Text>
          </View>
          <View style={styles.statsGrid}>
            <View style={styles.statsRow}>
              <StatCard label="Total Anime" value={stats.totalAnime} />
              <StatCard label="Days Watched" value={stats.daysWatched} />
              <StatCard label="Mean Score" value={stats.meanScore} max={100} />
            </View>
            <View style={[styles.statsRow, { marginBottom: 40 }]}>
              <StatCard label="Total Manga" value={stats.totalManga} />
              <StatCard label="Chapters Read" value={stats.chaptersRead} />
              <StatCard label="Mean Score" value={stats.mangaMeanScore} max={100} />
            </View>
          </View>
        </Animated.View>

        {/* Anime Status Distribution */}
        <Animated.View 
          style={{
            opacity: fadeAnim,
            transform: [{ translateY: fadeAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [20, 0]
            })}]
          }}
        >
          <View style={styles.sectionHeader}>
            <MaterialCommunityIcons name="television-classic" size={20} color={theme.colors.primary} />
            <Text style={[styles.sectionTitle, { color: isDark ? '#FFFFFF' : theme.colors.text }]}>
              Anime Status Distribution
            </Text>
          </View>
          <View style={styles.statusGrid}>
            <View style={styles.statusRow}>
              <StatCard label="Watching" value={stats.animeStatusDistribution.CURRENT} />
              <StatCard label="Completed" value={stats.animeStatusDistribution.COMPLETED} />
            </View>
            <View style={styles.statusRow}>
              <StatCard label="Planning" value={stats.animeStatusDistribution.PLANNING} />
              <StatCard label="Dropped" value={stats.animeStatusDistribution.DROPPED} />
            </View>
            <View style={[styles.statusRow, { justifyContent: 'flex-start', marginBottom: 40 }]}>
              <View style={{ flex: 0.485 }}>
                <StatCard label="Paused" value={stats.animeStatusDistribution.PAUSED} />
              </View>
            </View>
          </View>
        </Animated.View>

        {/* Manga Status Distribution */}
        <Animated.View 
          style={{
            opacity: fadeAnim,
            transform: [{ translateY: fadeAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [20, 0]
            })}]
          }}
        >
          <View style={styles.sectionHeader}>
            <MaterialCommunityIcons name="book-open-variant" size={20} color={theme.colors.primary} />
            <Text style={[styles.sectionTitle, { color: isDark ? '#FFFFFF' : theme.colors.text }]}>
              Manga Status Distribution
            </Text>
          </View>
          <View style={styles.statusGrid}>
            <View style={styles.statusRow}>
              <StatCard label="Reading" value={stats.mangaStatusDistribution.CURRENT} />
              <StatCard label="Completed" value={stats.mangaStatusDistribution.COMPLETED} />
            </View>
            <View style={styles.statusRow}>
              <StatCard label="Planning" value={stats.mangaStatusDistribution.PLANNING} />
              <StatCard label="Dropped" value={stats.mangaStatusDistribution.DROPPED} />
            </View>
            <View style={[styles.statusRow, { justifyContent: 'flex-start', marginBottom: 24 }]}>
              <View style={{ flex: 0.485 }}>
                <StatCard label="Paused" value={stats.mangaStatusDistribution.PAUSED} />
              </View>
            </View>
          </View>
        </Animated.View>

        {/* Activity Feed Section - Only show if not viewing own profile */}
        {(!user || targetUserId !== user.id) && (
          <Animated.View 
            style={{
              opacity: fadeAnim,
              transform: [{ translateY: fadeAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [20, 0]
              })}]
            }}
          >
            <View style={styles.sectionHeader}>
              <FontAwesome5 name="history" size={18} color={theme.colors.primary} />
              <Text style={[styles.sectionTitle, { color: isDark ? '#FFFFFF' : theme.colors.text, marginTop: 0 }]}>Recent Activity</Text>
            </View>
            <View style={styles.activityFeed}>
              {activities.map((activity, index) => (
                <Animated.View 
                  key={activity.id} 
                  style={{
                    opacity: fadeAnim,
                    transform: [{ 
                      translateY: fadeAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [20, 0]
                      })
                    }]
                  }}
                >
                  {renderActivity(activity)}
                </Animated.View>
              ))}
            </View>
          </Animated.View>
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 24,
    paddingHorizontal: 16,
  },
  header: {
    marginBottom: 24,
    overflow: 'hidden',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  bannerContainer: {
    position: 'relative',
    height: 180,
    width: '100%',
  },
  bannerImage: {
    width: '100%',
    height: '100%',
  },
  defaultBanner: {
    width: '100%',
    height: '100%',
    opacity: 0.8,
  },
  bannerGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '70%',
  },
  profileContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 24,
    paddingTop: 0,
    position: 'relative',
    marginTop: -40,
  },
  avatarContainer: {
    marginRight: 16,
    borderRadius: 50,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  avatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  avatarGlow: {
    position: 'absolute',
    top: -5,
    left: -5,
    right: -5,
    bottom: -5,
    borderRadius: 50,
    borderWidth: 2,
    opacity: 0.7,
  },
  userInfoContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  usernameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  username: {
    fontSize: 22,
    fontWeight: 'bold',
    flex: 1,
  },
  verifiedGradient: {
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifiedIcon: {
    marginLeft: 0.5,
  },
  userFlair: {
    fontSize: 14,
    fontWeight: '500',
  },
  loginPrompt: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loginTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  loginSubtitle: {
    fontSize: 16,
    marginBottom: 24,
    textAlign: 'center',
  },
  loginButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  loginButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingText: {
    fontSize: 16,
    marginTop: 16,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  errorText: {
    fontSize: 16,
    marginBottom: 24,
    textAlign: 'center',
  },
  retryButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
  contentContainer: {
    marginTop: 24,
  },
  bioContainer: {
    marginBottom: 40,
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
  },
  gradientBackground: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  webView: {
    width: '100%',
    backgroundColor: 'transparent',
  },
  listsNavigation: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
    gap: 16,
  },
  listButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    gap: 12,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  listButtonContent: {
    flex: 1,
  },
  listButtonTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  listButtonSubtitle: {
    fontSize: 12,
    opacity: 0.7,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  statsGrid: {
    marginBottom: 32,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  statusGrid: {
    marginBottom: 32,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  activityFeed: {
    marginBottom: 24,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  activityImage: {
    width: 60,
    height: 80,
    borderRadius: 8,
    marginRight: 16,
  },
  activityContent: {
    flex: 1,
  },
  activityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  activityTitle: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  activityTime: {
    fontSize: 12,
    opacity: 0.7,
  },
  activityDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  activityBadge: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  activityBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  activityProgress: {
    fontSize: 12,
    fontWeight: '600',
  },
  statCard: {
    flex: 0.485,
    height: 100,
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  statContent: {
    flex: 1,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  scoreCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(0,0,0,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scoreInnerCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  scoreValue: {
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  favoriteItem: {
    width: 120,
    marginRight: 12,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  favoriteImage: {
    width: 120,
    height: 160,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
  },
  favoriteName: {
    padding: 8,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  favoritesContainer: {
    paddingLeft: 2,
    paddingTop: 8,
    paddingBottom: 8,
  },
  studioPlaceholder: {
    width: 120,
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
  },
  studioInitial: {
    color: '#fff',
    fontSize: 28,
    fontWeight: 'bold',
  },
  streakContainer: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  streakItem: {
    alignItems: 'center',
  },
  streakValue: {
    fontSize: 24,
    fontWeight: '700',
  },
  streakTypeValue: {
    fontSize: 20,
    fontWeight: '700',
  },
  streakLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginTop: 4,
  },
  streakDivider: {
    width: 1,
    height: 40,
    backgroundColor: 'rgba(150, 150, 150, 0.3)',
  },
});

export default ProfileScreen; 