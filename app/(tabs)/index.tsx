import { StyleSheet, View, Text, ScrollView, Image, TouchableOpacity, ActivityIndicator, ImageBackground, Dimensions, Animated, Platform, RefreshControl, DeviceEventEmitter } from 'react-native';
import { useEffect, useState, useRef, useCallback, memo, useMemo } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome5 } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useAuth } from '../../hooks/useAuth';
import { useRouter } from 'expo-router';
import { ANILIST_GRAPHQL_ENDPOINT, STORAGE_KEY } from '../../constants/auth';
import * as SecureStore from 'expo-secure-store';
import axios from 'axios';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../hooks/useTheme';
import NewsSection from '../../components/NewsSection';
import { XMLParser } from 'fast-xml-parser';
import { format } from 'date-fns';
import WelcomeSection from '../../components/WelcomeSection';
import GlobalSearch from '../../components/GlobalSearch';

// Define welcome section storage key (should be the same as in homesections.tsx)
const WELCOME_SECTION_STORAGE_KEY = "welcome_section";

// Welcome section type enum (should be the same as in homesections.tsx)
enum WelcomeSectionType {
  BASIC = 'basic',
  ACHIEVEMENT = 'achievement'
}

// Default welcome section preferences
const DEFAULT_WELCOME_PREFERENCES = {
  type: WelcomeSectionType.BASIC
};

interface MediaItem {
  id: number;
  title: {
    userPreferred: string;
    romaji?: string;
    english?: string;
    native?: string;
  };
  coverImage: {
    medium: string;
    large: string;
  };
  progress?: number;
  status?: string;
  updatedAt?: number;
  score?: number;
  scoreFormat?: string;
  episodes?: number;
  format?: string;
  nextAiringEpisode?: {
    episode: number;
    airingAt: number;
  };
  trending?: number;
  averageScore?: number;
  popularity?: number;
  type: 'ANIME' | 'MANGA';
}

interface MediaListResponse {
  watching: MediaItem[];
  reading: MediaItem[];
  completedAnime: MediaItem[];
  completedManga: MediaItem[];
  planningAnime: MediaItem[];
  planningManga: MediaItem[];
  titleLanguage: string;
}

interface Section {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  visible: boolean;
  order: number;
}

interface NewsItem {
  id: string;
  title: string;
  source: 'AniList' | 'ANN';
  timestamp: string;
  url: string;
  thumbnail?: string | null;
  category: 'Trending' | 'New' | 'News';
  isInternalLink: boolean;
  nextEpisode?: number;
  score?: number;
}

// Add these new interfaces before the MediaCard component
interface SectionProps {
  title: string;
  subtitle: string;
  icon: string;
  iconColors: string[];
  items: MediaItem[];
  onPress: (item: MediaItem, type: 'anime' | 'manga') => void;
  type: 'anime' | 'manga';
}

// Create a memoized section component
const MediaSection = memo(({ title, subtitle, icon, iconColors, items, onPress, type }: SectionProps) => {
  const { currentTheme } = useTheme();

  if (items.length === 0) return null;

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionTitleContainer}>
          <LinearGradient
            colors={iconColors as [string, string]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.iconContainer}
          >
            <FontAwesome5 name={icon} size={16} color="#fff" />
          </LinearGradient>
          <View>
            <Text style={[styles.sectionTitle, { color: currentTheme.colors.text }]}>
              {title}
            </Text>
            <Text style={[styles.sectionSubtitle, { color: currentTheme.colors.textSecondary }]}>
              {subtitle}
            </Text>
          </View>
        </View>
      </View>
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.mediaList}
        removeClippedSubviews={true}
      >
        {items.map((item) => (
          <MediaCard
            key={item.id}
            item={item}
            onPress={() => onPress(item, type)}
            type={type}
          />
        ))}
      </ScrollView>
    </View>
  );
});

// Memoized media card component
const MediaCard = memo(({ item, onPress, type }: { 
  item: MediaItem; 
  onPress: () => void; 
  type: 'anime' | 'manga';
}) => {
  const { isDarkMode, currentTheme } = useTheme();

  const formatScore = (score: number | undefined, format: string | undefined) => {
    if (score === undefined || score === null) return '';
    
    switch (format) {
      case 'POINT_100':
        return `${score * 10}/100`;
      case 'POINT_10_DECIMAL':
        return `${score.toFixed(1)}/10`;
      case 'POINT_10':
        return `${Math.round(score)}/10`;
      case 'POINT_5':
        return `${Math.round(score / 2)}/5`;
      case 'POINT_3':
        return `${Math.round(score / 3.33)}/3`;
      default:
        return `${score.toFixed(1)}/10`;
    }
  };

  return (
    <TouchableOpacity 
      style={[styles.mediaCard, { backgroundColor: currentTheme.colors.surface }]} 
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.mediaCoverContainer}>
        <Image
          source={{ uri: item.coverImage.large }}
          style={styles.mediaCover}
        />
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.9)']}
          style={styles.mediaCoverOverlay}
        >
          <View style={styles.progressContainer}>
            <Text style={styles.progressText}>
              {type === 'manga' ? `CH ${item.progress}` : `EP ${item.progress}/${item.episodes || '?'}`}
            </Text>
          </View>
        </LinearGradient>
      </View>
      <View style={styles.mediaInfo}>
        <Text style={[styles.mediaTitle, { color: currentTheme.colors.text }]} numberOfLines={2}>
          {item.title.userPreferred}
        </Text>
        {item.score !== undefined && item.score > 0 && (
          <View style={styles.scoreContainer}>
            <FontAwesome5 name="star" size={10} color="#FFD700" solid />
            <Text style={[styles.scoreText, { color: currentTheme.colors.textSecondary }]}>
              {formatScore(item.score, item.scoreFormat)}
            </Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
});

const EmptyLibraryPrompt = memo(() => {
  const { currentTheme } = useTheme();
  const router = useRouter();

  return (
    <View style={[styles.emptyLibraryContainer, { backgroundColor: currentTheme.colors.background }]}>
      <LinearGradient 
        colors={['#02A9FF', '#0066FF']} 
        start={{ x: 0, y: 0 }} 
        end={{ x: 1, y: 1 }} 
        style={styles.emptyLibraryIconContainer}
      >
        <FontAwesome5 name="compass" size={36} color="#fff" />
      </LinearGradient>
      
      <Text style={[styles.emptyLibraryTitle, { color: currentTheme.colors.text }]}>
        Start Building Your Library
      </Text>
      
      <Text style={[styles.emptyLibraryDescription, { color: currentTheme.colors.textSecondary }]}>
        Discover new anime and manga to add to your collection
      </Text>
      
      
      
      <View style={styles.tipContainer}>
        <FontAwesome5 name="lightbulb" size={14} color={currentTheme.colors.primary} />
        <Text style={[styles.tipText, { color: currentTheme.colors.textSecondary }]}>
          Tip: Add anime or manga to your lists to track your progress
        </Text>
      </View>
    </View>
  );
});

const GuestView = () => {
  const { currentTheme } = useTheme();
  const { signIn, user } = useAuth();
  const [showSearch, setShowSearch] = useState(false);
  const router = useRouter();

  const handleLogin = async () => {
    router.replace('/welcome');
  };

  if (user?.isAnonymous) {
    return (
      <View style={[styles.guestContainer, { backgroundColor: currentTheme.colors.background }]}>
        <View style={styles.guestContent}>
          <FontAwesome5 name="lock" size={48} color={currentTheme.colors.primary} style={styles.guestIcon} />
          <Text style={[styles.guestTitle, { color: currentTheme.colors.text }]}>
            Access Restricted
          </Text>
          <Text style={[styles.guestSubtitle, { color: currentTheme.colors.textSecondary }]}>
            Sign in with AniList to unlock Zantaku's features:
          </Text>
          <View style={styles.featureList}>
            <View style={styles.featureItem}>
              <FontAwesome5 name="list-alt" size={16} color={currentTheme.colors.primary} />
              <Text style={[styles.featureText, { color: currentTheme.colors.text }]}>
                Track your anime & manga progress
              </Text>
            </View>
            <View style={styles.featureItem}>
              <FontAwesome5 name="history" size={16} color={currentTheme.colors.primary} />
              <Text style={[styles.featureText, { color: currentTheme.colors.text }]}>
                Access your watch history
              </Text>
            </View>
            <View style={styles.featureItem}>
              <FontAwesome5 name="star" size={16} color={currentTheme.colors.primary} />
              <Text style={[styles.featureText, { color: currentTheme.colors.text }]}>
                Rate and review titles
              </Text>
            </View>
            <View style={styles.featureItem}>
              <FontAwesome5 name="sync" size={16} color={currentTheme.colors.primary} />
              <Text style={[styles.featureText, { color: currentTheme.colors.text }]}>
                Sync with AniList
              </Text>
            </View>
          </View>
          <View style={styles.guestActions}>
            <TouchableOpacity 
              style={[styles.signInButton, { backgroundColor: currentTheme.colors.primary }]}
              onPress={handleLogin}
            >
              <Text style={styles.signInButtonText}>Sign in with AniList</Text>
            </TouchableOpacity>
      
          </View>
        </View>
        <GlobalSearch visible={showSearch} onClose={() => setShowSearch(false)} />
      </View>
    );
  }

  return (
    <View style={[styles.guestContainer, { backgroundColor: currentTheme.colors.background }]}>
      <View style={styles.guestContent}>
        <FontAwesome5 name="user-lock" size={48} color={currentTheme.colors.primary} style={styles.guestIcon} />
        <Text style={[styles.guestTitle, { color: currentTheme.colors.text }]}>
          Welcome to Zantaku
        </Text>
        <Text style={[styles.guestSubtitle, { color: currentTheme.colors.textSecondary }]}>
          Sign in with AniList to start tracking your anime and manga journey
        </Text>
        <View style={styles.featureList}>
          <View style={styles.featureItem}>
            <FontAwesome5 name="list-alt" size={16} color={currentTheme.colors.primary} />
            <Text style={[styles.featureText, { color: currentTheme.colors.text }]}>
              Track your anime & manga progress
            </Text>
          </View>
          <View style={styles.featureItem}>
            <FontAwesome5 name="history" size={16} color={currentTheme.colors.primary} />
            <Text style={[styles.featureText, { color: currentTheme.colors.text }]}>
              Access your watch history
            </Text>
          </View>
          <View style={styles.featureItem}>
            <FontAwesome5 name="star" size={16} color={currentTheme.colors.primary} />
            <Text style={[styles.featureText, { color: currentTheme.colors.text }]}>
              Rate and review titles
            </Text>
          </View>
          <View style={styles.featureItem}>
            <FontAwesome5 name="sync" size={16} color={currentTheme.colors.primary} />
            <Text style={[styles.featureText, { color: currentTheme.colors.text }]}>
              Sync with AniList
            </Text>
          </View>
        </View>
        <View style={styles.guestActions}>
          <TouchableOpacity 
            style={[styles.signInButton, { backgroundColor: currentTheme.colors.primary }]}
            onPress={handleLogin}
          >
            <Text style={styles.signInButtonText}>Sign in with AniList</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.discoverButton, { backgroundColor: currentTheme.colors.surface }]}
            onPress={() => setShowSearch(true)}
          >
            <FontAwesome5 name="search" size={16} color={currentTheme.colors.primary} style={styles.buttonIcon} />
            <Text style={[styles.discoverButtonText, { color: currentTheme.colors.text }]}>Discover</Text>
          </TouchableOpacity>
        </View>
      </View>
      <GlobalSearch visible={showSearch} onClose={() => setShowSearch(false)} />
    </View>
  );
};

export default function TabsIndex() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { isDarkMode, currentTheme } = useTheme();
  const searchModalRef = useRef(null);
  const welcomeModalRef = useRef(null);
  const [refreshing, setRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [mediaList, setMediaList] = useState<MediaListResponse>({
    watching: [],
    reading: [],
    completedAnime: [],
    completedManga: [],
    planningAnime: [],
    planningManga: [],
    titleLanguage: 'ROMAJI'
  });
  const [newsItems, setNewsItems] = useState<NewsItem[]>([]);
  const [sectionPreferences, setSectionPreferences] = useState<Section[]>([]);
  const [trendingMedia, setTrendingMedia] = useState<MediaItem[]>([]);
  const [welcomeSectionType, setWelcomeSectionType] = useState<WelcomeSectionType>(WelcomeSectionType.BASIC);

  // New effect to load welcome section preference
  useEffect(() => {
    const loadWelcomeSectionPreference = async () => {
      try {
        const storedPreference = await SecureStore.getItemAsync(WELCOME_SECTION_STORAGE_KEY);
        if (storedPreference) {
          const preference = JSON.parse(storedPreference);
          if (preference && preference.type) {
            setWelcomeSectionType(preference.type);
          }
        }
      } catch (error) {
        console.error("Error loading welcome section preference:", error);
      }
    };
    
    loadWelcomeSectionPreference();
  }, []);

  useEffect(() => {
    const handleAuthState = async () => {
      console.log('Auth state changed:', { authLoading, user: user?.name });
      
      if (!authLoading) {
        if (!user) {
          console.log('No user found, redirecting to welcome screen...');
          router.replace('/welcome');
        } else if (!user.isAnonymous) {
          console.log('User authenticated, fetching data...', user);
          try {
            setIsLoading(true);
            await Promise.all([
              fetchMediaLists(),
              fetchNews(),
              loadSectionPreferences(),
              fetchTrendingMedia()
            ]);
          } catch (error) {
            console.error('Error loading initial data:', error);
          } finally {
            setIsLoading(false);
          }
        }
      }
    };

    handleAuthState();
  }, [user, authLoading]);

  const loadSectionPreferences = async () => {
    try {
      console.log('[Sections] Loading section preferences...');
      const savedPreferences = await SecureStore.getItemAsync(STORAGE_KEY.HOME_SECTIONS);
      
      // Default preferences
      const defaultPreferences = [
        {
          id: 'watching',
          title: 'Continue Watching',
          subtitle: 'Currently watching anime',
          icon: 'play-circle',
          visible: true,
          order: 0,
        },
        {
          id: 'reading',
          title: 'Continue Reading',
          subtitle: 'Currently reading manga',
          icon: 'book-reader',
          visible: true,
          order: 1,
        },
        {
          id: 'completedAnime',
          title: 'Completed Anime',
          subtitle: 'Finished watching',
          icon: 'check-circle',
          visible: true,
          order: 2,
        },
        {
          id: 'completedManga',
          title: 'Completed Manga',
          subtitle: 'Finished reading',
          icon: 'book',
          visible: true,
          order: 3,
        },
        {
          id: 'planningAnime',
          title: 'Planned Anime',
          subtitle: 'Plan to watch',
          icon: 'clock',
          visible: true,
          order: 4,
        },
        {
          id: 'planningManga',
          title: 'Planned Manga',
          subtitle: 'Plan to read',
          icon: 'bookmark',
          visible: true,
          order: 5,
        },
        {
          id: 'news',
          title: 'News & Updates',
          subtitle: 'Latest anime & manga news',
          icon: 'newspaper',
          visible: true,
          order: 6,
        }
      ];

      if (savedPreferences) {
        try {
          console.log('[Sections] Found saved preferences, parsing...');
          const parsed = JSON.parse(savedPreferences);
          if (Array.isArray(parsed) && parsed.length > 0) {
            console.log('[Sections] Using saved preferences');
            setSectionPreferences(parsed);
          } else {
            console.log('[Sections] Saved preferences invalid, using defaults');
            setSectionPreferences(defaultPreferences);
            // Save the defaults for next time
            await SecureStore.setItemAsync(STORAGE_KEY.HOME_SECTIONS, JSON.stringify(defaultPreferences));
          }
        } catch (error) {
          console.log('[Sections] Error parsing preferences, using defaults');
          setSectionPreferences(defaultPreferences);
          // Save the defaults for next time
          await SecureStore.setItemAsync(STORAGE_KEY.HOME_SECTIONS, JSON.stringify(defaultPreferences));
        }
      } else {
        console.log('[Sections] No saved preferences found, using defaults');
        setSectionPreferences(defaultPreferences);
        // Save the defaults for next time
        await SecureStore.setItemAsync(STORAGE_KEY.HOME_SECTIONS, JSON.stringify(defaultPreferences));
      }
    } catch (error) {
      console.error('[Sections] Error loading preferences:', error);
      // Even if there's an error, still set the defaults in state
      setSectionPreferences([
        {
          id: 'watching',
          title: 'Continue Watching',
          subtitle: 'Currently watching anime',
          icon: 'play-circle',
          visible: true,
          order: 0,
        },
        {
          id: 'reading',
          title: 'Continue Reading',
          subtitle: 'Currently reading manga',
          icon: 'book-reader',
          visible: true,
          order: 1,
        }
      ]);
    }
  };

  // Fetch user's media lists
  const fetchMediaLists = async () => {
    try {
      setIsLoading(true);
      const token = await SecureStore.getItemAsync(STORAGE_KEY.AUTH_TOKEN);
      
      if (!token || !user) {
        console.log('No auth token or user found');
        setIsLoading(false);
        return;
      }

      console.log('Fetching media lists for user:', user.id);
      
      try {
        const response = await axios.post(
          ANILIST_GRAPHQL_ENDPOINT,
          {
            query: `
              query ($userId: Int) {
                MediaListCollection(userId: $userId, type: ANIME, status_in: [CURRENT]) {
                  lists {
                    status
                    entries {
                      id
                      progress
                      score(format: POINT_10_DECIMAL)
                      updatedAt
                      status
                      media {
                        id
                        title {
                          userPreferred
                          romaji
                          english
                          native
                        }
                        coverImage {
                          medium
                          large
                        }
                        status
                        episodes
                        nextAiringEpisode {
                          episode
                          airingAt
                        }
                      }
                    }
                  }
                }
                CompletedAnime: MediaListCollection(userId: $userId, type: ANIME, status: COMPLETED) {
                  lists {
                    entries {
                      id
                      progress
                      score(format: POINT_10_DECIMAL)
                      updatedAt
                      status
                      media {
                        id
                        title {
                          userPreferred
                          romaji
                          english
                          native
                        }
                        coverImage {
                          medium
                          large
                        }
                        status
                        episodes
                      }
                    }
                  }
                }
                PlannedAnime: MediaListCollection(userId: $userId, type: ANIME, status: PLANNING) {
                  lists {
                    entries {
                      id
                      progress
                      score(format: POINT_10_DECIMAL)
                      updatedAt
                      status
                      media {
                        id
                        title {
                          userPreferred
                          romaji
                          english
                          native
                        }
                        coverImage {
                          medium
                          large
                        }
                        status
                        episodes
                      }
                    }
                  }
                }
                MediaListCollection2: MediaListCollection(userId: $userId, type: MANGA, status: CURRENT) {
                  lists {
                    entries {
                      id
                      progress
                      score(format: POINT_10_DECIMAL)
                      updatedAt
                      status
                      media {
                        id
                        title {
                          userPreferred
                          romaji
                          english
                          native
                        }
                        coverImage {
                          medium
                          large
                        }
                        status
                        format
                      }
                    }
                  }
                }
                CompletedManga: MediaListCollection(userId: $userId, type: MANGA, status: COMPLETED) {
                  lists {
                    entries {
                      id
                      progress
                      score(format: POINT_10_DECIMAL)
                      updatedAt
                      status
                      media {
                        id
                        title {
                          userPreferred
                          romaji
                          english
                          native
                        }
                        coverImage {
                          medium
                          large
                        }
                        status
                        format
                      }
                    }
                  }
                }
                PlannedManga: MediaListCollection(userId: $userId, type: MANGA, status: PLANNING) {
                  lists {
                    entries {
                      id
                      progress
                      score(format: POINT_10_DECIMAL)
                      updatedAt
                      status
                      media {
                        id
                        title {
                          userPreferred
                          romaji
                          english
                          native
                        }
                        coverImage {
                          medium
                          large
                        }
                        status
                        format
                      }
                    }
                  }
                }
                Viewer {
                  options {
                    titleLanguage
                  }
                  mediaListOptions {
                    scoreFormat
                  }
                }
              }
            `,
            variables: {
              userId: user.id
            }
          },
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
              'Accept': 'application/json',
            },
            timeout: 20000, // 20 second timeout
          }
        );

        console.log('Response received from AniList API');
        
        const data = response.data;
        
        const processEntries = (entries: any[], titleLanguage: string, scoreFormat: string) => {
          return entries?.map((entry: any) => {
            const title = {
              userPreferred: entry.media.title[titleLanguage.toLowerCase()] || entry.media.title.romaji
            };
            
            return {
              id: entry.media.id,
              title,
              coverImage: entry.media.coverImage,
              progress: entry.progress,
              status: entry.status,
              updatedAt: entry.updatedAt || 0,
              score: entry.score,
              scoreFormat: scoreFormat,
              episodes: entry.media.episodes,
              format: entry.media.format,
              nextAiringEpisode: entry.media.nextAiringEpisode,
              type: entry.media.type || 'ANIME'
            };
          }) || [];
        };

        // Process each list separately with null-safe sorting
        const watching = processEntries(
          data.data.MediaListCollection.lists?.[0]?.entries || [],
          data.data.Viewer.options.titleLanguage,
          data.data.Viewer.mediaListOptions.scoreFormat
        ).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

        const reading = processEntries(
          data.data.MediaListCollection2.lists?.[0]?.entries || [],
          data.data.Viewer.options.titleLanguage,
          data.data.Viewer.mediaListOptions.scoreFormat
        ).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

        const completedAnime = processEntries(
          data.data.CompletedAnime.lists?.[0]?.entries || [],
          data.data.Viewer.options.titleLanguage,
          data.data.Viewer.mediaListOptions.scoreFormat
        ).sort((a: MediaItem, b: MediaItem) => (b.updatedAt || 0) - (a.updatedAt || 0));

        const completedManga = processEntries(
          data.data.CompletedManga.lists?.[0]?.entries || [],
          data.data.Viewer.options.titleLanguage,
          data.data.Viewer.mediaListOptions.scoreFormat
        ).sort((a: MediaItem, b: MediaItem) => (b.updatedAt || 0) - (a.updatedAt || 0));

        const planningAnime = processEntries(
          data.data.PlannedAnime.lists?.[0]?.entries || [],
          data.data.Viewer.options.titleLanguage,
          data.data.Viewer.mediaListOptions.scoreFormat
        ).sort((a: MediaItem, b: MediaItem) => (b.updatedAt || 0) - (a.updatedAt || 0));

        const planningManga = processEntries(
          data.data.PlannedManga.lists?.[0]?.entries || [],
          data.data.Viewer.options.titleLanguage,
          data.data.Viewer.mediaListOptions.scoreFormat
        ).sort((a: MediaItem, b: MediaItem) => (b.updatedAt || 0) - (a.updatedAt || 0));

        console.log('Lists processed successfully:', {
          watching: watching.length,
          reading: reading.length,
          completedAnime: completedAnime.length,
          completedManga: completedManga.length,
          planningAnime: planningAnime.length,
          planningManga: planningManga.length
        });

        setMediaList({
          watching,
          reading,
          completedAnime,
          completedManga,
          planningAnime,
          planningManga,
          titleLanguage: data.data.Viewer.options.titleLanguage
        });
        
        // Clear any previous errors
        setError(null);
        
      } catch (apiError) {
        console.error('API Error fetching media lists:', apiError);
        
        // Handle network errors gracefully
        setMediaList({
          watching: [],
          reading: [],
          completedAnime: [],
          completedManga: [],
          planningAnime: [],
          planningManga: [],
          titleLanguage: 'ROMAJI'
        });
        
        setError('Failed to connect to AniList. Please check your internet connection and try again.');
      }
      
    } catch (error) {
      console.error('General error in fetchMediaLists:', error);
      setError('Failed to load content. Please try again later.');
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch news
  const fetchNews = async () => {
    try {
      const [anilistNews, annNews] = await Promise.all([
        fetchAniListNews(),
        fetchANNNews()
      ]);

      const combinedNews = [...anilistNews, ...annNews];
      setNewsItems(combinedNews.sort(() => Math.random() - 0.5).slice(0, 10));
    } catch (error) {
      console.error('Error fetching news:', error);
    }
  };

  const fetchAniListNews = async () => {
    try {
      const token = await SecureStore.getItemAsync(STORAGE_KEY.AUTH_TOKEN);
      
      const { data } = await axios.post(
        ANILIST_GRAPHQL_ENDPOINT,
        {
          query: `
            query {
              Page(page: 1, perPage: 10) {
                media(type: ANIME, sort: TRENDING_DESC, status: RELEASING) {
                  id
                  title {
                    userPreferred
                    romaji
                    english
                    native
                  }
                  coverImage {
                    medium
                  }
                  meanScore
                  nextAiringEpisode {
                    episode
                    timeUntilAiring
                  }
                }
              }
              Viewer {
                options {
                  titleLanguage
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
            'Authorization': token ? `Bearer ${token}` : '',
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          }
        }
      );

      return data.data.Page.media.map((anime: any) => ({
        id: `trending-${anime.id}`,
        title: anime.title[data.data.Viewer?.options?.titleLanguage?.toLowerCase()] || anime.title.romaji,
        timestamp: formatAiringTime(anime.nextAiringEpisode?.timeUntilAiring),
        url: `/anime/${anime.id}`,
        thumbnail: anime.coverImage.medium,
        category: 'Trending',
        isInternalLink: true,
        nextEpisode: anime.nextAiringEpisode?.episode,
        score: anime.meanScore,
        scoreFormat: data.data.Viewer?.mediaListOptions?.scoreFormat
      }));
    } catch (error) {
      console.error('Error fetching AniList news:', error);
      return [];
    }
  };

  const fetchANNNews = async () => {
    try {
      const response = await axios.get('https://www.animenewsnetwork.com/all/rss.xml?ann-edition=w');
      const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: "@_"
      });
      
      const feed = parser.parse(response.data);
      const items = feed.rss.channel.item;

      return items.slice(0, 5).map((item: any, index: number) => ({
        id: `ann-${Date.now()}-${index}`,
        title: item.title,
        source: 'ANN',
        timestamp: new Date(item.pubDate).toISOString(),
        url: item.link,
        thumbnail: item.description?.match(/src="([^"]+)"/)?.pop() || null,
        category: 'News',
        isInternalLink: false
      }));
    } catch (error) {
      console.error('Error fetching ANN news:', error);
      return [];
    }
  };

  const formatAiringTime = (seconds?: number) => {
    if (!seconds) return 'TBA';
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    return days > 0 ? `${days}d` : `${hours}h`;
  };

  const fetchTrendingMedia = async () => {
    try {
      console.log('🔍 Fetching trending media...');
      const { data } = await axios.post(
        ANILIST_GRAPHQL_ENDPOINT,
        {
          query: `
            query {
              anime: Page(page: 1, perPage: 5) {
                media(sort: TRENDING_DESC, type: ANIME) {
                  id
                  title {
                    userPreferred
                    romaji
                    english
                    native
                  }
                  coverImage {
                    medium
                    large
                  }
                  trending
                  averageScore
                  popularity
                  type
                  episodes
                }
              }
              manga: Page(page: 1, perPage: 5) {
                media(sort: TRENDING_DESC, type: MANGA) {
                  id
                  title {
                    userPreferred
                    romaji
                    english
                    native
                  }
                  coverImage {
                    medium
                    large
                  }
                  trending
                  averageScore
                  popularity
                  type
                  episodes
                }
              }
            }
          `
        }
      );

      if (data?.data) {
        const animeMedia = data.data.anime?.media || [];
        const mangaMedia = data.data.manga?.media || [];
        
        // Combine and sort all media by trending value
        const combinedMedia = [...animeMedia, ...mangaMedia].sort((a, b) => (b.trending || 0) - (a.trending || 0));
        
        console.log('✅ Trending media fetched successfully:', combinedMedia.length, 'items');
        console.log('📊 Media types:', {
          anime: animeMedia.length,
          manga: mangaMedia.length,
          total: combinedMedia.length
        });
        
        setTrendingMedia(combinedMedia);
      } else {
        console.log('❌ No trending media data found in response');
      }
    } catch (error) {
      console.error('❌ Error fetching trending media:', error);
    }
  };

  const navigateToMedia = useCallback((item: MediaItem, type: 'anime' | 'manga') => {
    router.push(`/${type}/${item.id}`);
  }, [router]);

  // Memoize sections data
  const sections = useMemo(() => [
    {
      id: 'watching',
      title: 'Continue Watching',
      subtitle: 'Continue your journey',
      icon: 'play-circle',
      iconColors: ['#FF6B6B', '#ee5253'],
      items: mediaList.watching,
      type: 'anime'
    },
    {
      id: 'reading',
      title: 'Continue Reading',
      subtitle: 'Pick up where you left off',
      icon: 'book-reader',
      iconColors: ['#4ECDC4', '#45B7AF'],
      items: mediaList.reading,
      type: 'manga'
    },
    {
      id: 'completedAnime',
      title: 'Completed Anime',
      subtitle: 'Your finished adventures',
      icon: 'check-circle',
      iconColors: ['#20bf6b', '#26de81'],
      items: mediaList.completedAnime,
      type: 'anime'
    },
    {
      id: 'completedManga',
      title: 'Completed Manga',
      subtitle: 'Your finished reads',
      icon: 'book',
      iconColors: ['#20bf6b', '#26de81'],
      items: mediaList.completedManga,
      type: 'manga'
    },
    {
      id: 'planningAnime',
      title: 'Planned Anime',
      subtitle: 'Your watchlist',
      icon: 'clock',
      iconColors: ['#a55eea', '#8854d0'],
      items: mediaList.planningAnime,
      type: 'anime'
    },
    {
      id: 'planningManga',
      title: 'Planned Manga',
      subtitle: 'Your reading list',
      icon: 'bookmark',
      iconColors: ['#a55eea', '#8854d0'],
      items: mediaList.planningManga,
      type: 'manga'
    }
  ], [mediaList]);

  const renderSection = useCallback((sectionId: string) => {
    const preference = sectionPreferences.find(p => p.id === sectionId);
    console.log(`[Section Status] ${sectionId}:`, {
      hasPreference: !!preference,
      isVisible: preference?.visible,
      itemCount: sectionId === 'news' ? newsItems.length : sections.find(s => s.id === sectionId)?.items.length || 0
    });

    if (!preference?.visible) {
      console.log(`[Section Hidden] ${sectionId} is not visible`);
      return null;
    }

    if (sectionId === 'news') {
      if (newsItems.length > 0) {
        console.log(`[Section Loaded] News section loaded with ${newsItems.length} items`);
        return (
          <View key={`section-${sectionId}`} style={[styles.newsSection, { borderTopColor: currentTheme.colors.border }]}>
            <NewsSection news={newsItems} />
          </View>
        );
      }
      console.log('[Section Empty] News section has no items');
      return null;
    }

    const section = sections.find(s => s.id === sectionId);
    if (!section) {
      console.log(`[Section Error] ${sectionId} configuration not found`);
      return null;
    }

    console.log(`[Section Loaded] ${sectionId} loaded with ${section.items.length} items`);
    return (
      <MediaSection
        key={`section-${sectionId}`}
        title={section.title}
        subtitle={section.subtitle}
        icon={section.icon}
        iconColors={section.iconColors}
        items={section.items}
        onPress={navigateToMedia}
        type={section.type as 'anime' | 'manga'}
      />
    );
  }, [sections, sectionPreferences, newsItems, currentTheme.colors.border, navigateToMedia]);

  // Add logging effect
  useEffect(() => {
    console.log('[Sections] Current section preferences:', sectionPreferences);
    console.log('[Sections] Available sections:', sections.map(s => ({ id: s.id, itemCount: s.items.length })));
  }, [sectionPreferences, sections]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        fetchMediaLists(),
        fetchNews(),
        fetchTrendingMedia()
      ]);
    } catch (error) {
      console.error('Error refreshing data:', error);
    } finally {
      setRefreshing(false);
    }
  }, []);

  const isLibraryEmpty = useMemo(() => {
    return (
      mediaList.watching.length === 0 &&
      mediaList.reading.length === 0 &&
      mediaList.completedAnime.length === 0 &&
      mediaList.completedManga.length === 0 &&
      mediaList.planningAnime.length === 0 &&
      mediaList.planningManga.length === 0
    );
  }, [mediaList]);

  // Show guest view for anonymous users or when no user is present
  if (!user || user.isAnonymous) {
    return <GuestView />;
  }

  // Show loading state only for authenticated users
  if (authLoading || isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: currentTheme.colors.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={currentTheme.colors.primary} />
          <Text style={[styles.loadingText, { color: currentTheme.colors.text }]}>
            {authLoading ? 'Checking authentication...' : 'Loading your content...'}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: currentTheme.colors.background }}>
      <ScrollView 
        style={styles.container}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#02A9FF']} // For Android
            tintColor={currentTheme.colors.primary} // For iOS
          />
        }
      >
        <WelcomeSection 
          user={{ 
            name: user.name,
            titleLanguage: mediaList.titleLanguage || 'ROMAJI',
            id: user.id
          }} 
          trendingMedia={trendingMedia}
          currentlyWatching={mediaList.watching}
          currentlyReading={mediaList.reading}
          onViewAll={() => router.push('/trending')} 
          welcomeSectionType={welcomeSectionType}
        />
        
        {isLibraryEmpty && <EmptyLibraryPrompt />}
        
        {sectionPreferences
          .sort((a, b) => a.order - b.order)
          .filter(section => {
            const isVisible = section.visible;
            console.log(`[Section Visibility] ${section.id}: ${isVisible}`);
            return isVisible;
          })
          .map((section, index) => {
            console.log(`[Section Rendering] Attempting to render ${section.id} at index ${index}`);
            const renderedSection = renderSection(section.id);
            console.log(`[Section Rendered] ${section.id}: ${renderedSection ? 'Success' : 'Null'}`);
            return (
              <View key={`section-wrapper-${section.id}-${index}`}>
                {renderedSection}
              </View>
            );
          })}

        <View style={styles.bottomPadding} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 0,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  welcomeHeaderContainer: {
    marginHorizontal: -16,
    marginTop: 0,
    marginBottom: 16,
  },
  welcomeGradient: {
    padding: 16,
    paddingTop: 24,
  },
  greetingContainer: {
    marginBottom: 16,
  },
  greetingText: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 4,
  },
  nameText: {
    fontSize: 32,
    fontWeight: '800',
    marginBottom: 8,
  },
  messageText: {
    fontSize: 16,
  },
  trendingContainer: {
    marginTop: 16,
  },
  trendingTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 12,
  },
  trendingScroll: {
    paddingBottom: 8,
    gap: 12,
  },
  trendingItem: {
    width: 120,
  },
  trendingImage: {
    width: 120,
    height: 180,
    borderRadius: 8,
    marginBottom: 8,
  },
  trendingItemTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  sectionSubtitle: {
    fontSize: 14,
    opacity: 0.7,
  },
  mediaList: {
    paddingVertical: 4,
    gap: 12,
  },
  mediaCard: {
    width: 160,
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  mediaCoverContainer: {
    position: 'relative',
    width: '100%',
    height: 220,
  },
  mediaCover: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  mediaCoverOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 60,
    justifyContent: 'flex-end',
    padding: 8,
  },
  progressContainer: {
    alignItems: 'flex-start',
  },
  progressText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  mediaInfo: {
    padding: 12,
    gap: 4,
  },
  mediaTitle: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 18,
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
  newsSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
  },
  bottomPadding: {
    height: Platform.OS === 'ios' ? 90 : 80,
  },
  guestContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  guestContent: {
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },
  guestIcon: {
    marginBottom: 24,
  },
  guestTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 12,
  },
  guestSubtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
  },
  featureList: {
    width: '100%',
    gap: 16,
    marginBottom: 32,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  featureText: {
    fontSize: 16,
  },
  signInButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
    width: '100%',
  },
  signInButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyLibraryContainer: {
    margin: 16,
    marginBottom: 32,
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  emptyLibraryIconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    elevation: 3,
    shadowColor: '#02A9FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  emptyLibraryTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyLibraryDescription: {
    fontSize: 16,
    marginBottom: 24,
    textAlign: 'center',
    maxWidth: '85%',
  },
  emptyLibraryActions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  emptyLibraryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    minWidth: 130,
    justifyContent: 'center',
  },
  emptyLibraryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonIcon: {
    marginRight: 4,
  },
  tipContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: 'rgba(2, 169, 255, 0.1)',
    borderRadius: 12,
  },
  tipText: {
    fontSize: 14,
  },
  guestActions: {
    width: '100%',
    gap: 12,
  },
  discoverButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
    width: '100%',
  },
  discoverButtonText: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});
