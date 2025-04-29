import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Platform, Dimensions, StatusBar, Image, NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome5 } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import Logo from '../components/Logo';
import Animated, { 
  FadeInDown, 
  FadeInUp,
  useAnimatedStyle, 
  withTiming, 
  useSharedValue,
  withSequence,
  withDelay,
  withSpring,
  interpolate,
  Extrapolate
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { rateLimitedAxios } from '../utils/api';
import { MotiView } from 'moti';
import { useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { useDevAuth } from '../hooks/useDevAuth';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width, height } = Dimensions.get('window');

interface TrendingAnime {
  id: number;
  coverImage: {
    extraLarge: string;
    large: string;
    color: string;
  };
  bannerImage: string | null;
  title: {
    userPreferred: string;
    native: string;
  };
  studios: {
    nodes: {
      id: number;
      name: string;
    }[];
  };
  genres: string[];
  season: string;
  seasonYear: number;
  status: string;
}

const TRANSITION_INTERVAL = 10000; // 10 seconds
const FADE_DURATION = 1000; // 1 second

// Cache for trending data to prevent unnecessary API calls
const CACHE_KEY = 'trending_anime_cache';
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes in milliseconds

export default function WelcomeScreen() {
  const { signIn, handleToken, enableAnonymousMode } = useAuth();
  const { signInWithPin, authWithClipboardToken, isLoading: isDevAuthLoading } = useDevAuth();
  const { isDarkMode, currentTheme } = useTheme();
  const insets = useSafeAreaInsets();
  const [trendingAnime, setTrendingAnime] = useState<TrendingAnime[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [nextIndex, setNextIndex] = useState(1);
  const scale = useSharedValue(1.1);
  const opacity = useSharedValue(1);
  const imageOpacity = useSharedValue(1);

  const scrollY = useSharedValue(0);
  const buttonScale = useSharedValue(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isAnimeDetailsExpanded, setIsAnimeDetailsExpanded] = useState(false);
  const router = useRouter();

  const headerStyle = useAnimatedStyle(() => {
    return {
      transform: [
        {
          translateY: interpolate(
            scrollY.value,
            [0, 100],
            [0, -50],
            Extrapolate.CLAMP
          ),
        },
      ],
      opacity: interpolate(
        scrollY.value,
        [0, 100],
        [1, 0.3],
        Extrapolate.CLAMP
      ),
    };
  });

  const handlePressIn = () => {
    buttonScale.value = withSpring(0.95);
  };

  const handlePressOut = () => {
    buttonScale.value = withSpring(1);
  };

  const buttonStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: buttonScale.value }],
    };
  });

  useEffect(() => {
    fetchTrendingAnime();
  }, []);

  useEffect(() => {
    if (trendingAnime.length > 1) {
      const interval = setInterval(() => {
        // Fade out current image
        imageOpacity.value = withSequence(
          withTiming(0, { duration: FADE_DURATION }),
          withDelay(
            FADE_DURATION,
            withTiming(1, { duration: FADE_DURATION })
          )
        );

        // Update indices after fade out
        setTimeout(() => {
          setCurrentIndex((prev) => (prev + 1) % trendingAnime.length);
          setNextIndex((prev) => (prev + 1) % trendingAnime.length);
        }, FADE_DURATION);
      }, TRANSITION_INTERVAL);

      return () => clearInterval(interval);
    }
  }, [trendingAnime]);

  const fetchTrendingAnime = async () => {
    try {
      // Try to get cached data from AsyncStorage first
      try {
        const cachedData = await AsyncStorage.getItem(CACHE_KEY);
        if (cachedData) {
          const parsed = JSON.parse(cachedData);
          const now = Date.now();
          
          // Check if cache is still valid
          if (parsed && parsed.timestamp && (now - parsed.timestamp < CACHE_DURATION)) {
            console.log('Using cached trending anime data from storage');
            setTrendingAnime(parsed.data);
            setIsLoading(false);
            return;
          } else {
            console.log('Cached trending data expired, fetching fresh data');
          }
        }
      } catch (cacheError) {
        console.error('Error reading cache:', cacheError);
      }
      
      setIsLoading(true);
      
      const query = `query {
        Page(page: 1, perPage: 15) {
          media(type: ANIME, sort: [TRENDING_DESC, POPULARITY_DESC], status: RELEASING) {
            id
            coverImage {
              extraLarge
              large
              color
            }
            bannerImage
            title {
              userPreferred
              native
            }
            studios(isMain: true) {
              nodes {
                id
                name
              }
            }
            genres
            season
            seasonYear
            status
          }
        }
      }`;
      
      const response = await rateLimitedAxios(query, {}, undefined, 0, true);

      // Access the media array from the correct path in the response
      const mediaData = response?.data?.Page?.media;
      
      if (!Array.isArray(mediaData)) {
        console.error('Invalid media data structure:', mediaData);
        throw new Error('Invalid API response structure');
      }

      // Filter out entries without proper images and ensure all required fields exist
      const validAnime = mediaData.filter((a: any) => {
        const isValid = a?.coverImage && 
          (a.coverImage.extraLarge || a.coverImage.large) && 
          a.title?.userPreferred &&
          Array.isArray(a.genres) &&
          a.genres.length > 0;
        
        if (!isValid) {
          console.log('Invalid anime entry:', a);
        }
        
        return isValid;
      });

      if (validAnime.length > 0) {
        console.log('Successfully fetched trending anime:', validAnime.length, 'entries');
        
        // Cache the data in AsyncStorage
        try {
          const cacheData = {
            data: validAnime,
            timestamp: Date.now()
          };
          await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
          console.log('Cached trending anime data to storage');
        } catch (storageError) {
          console.error('Error saving to cache:', storageError);
        }
        
        setTrendingAnime(validAnime);
      } else {
        console.warn('No valid anime entries found in response');
        setTrendingAnime([]); // Set empty array to prevent undefined issues
      }
    } catch (error) {
      console.error('Error fetching trending anime:', error);
      // Reset state to prevent showing stale data
      setTrendingAnime([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async () => {
    await signIn();
  };

  const handleDevLogin = async () => {
    const result = await signInWithPin();
    if (result?.accessToken) {
      await handleToken(result.accessToken);
    }
  };

  const handleDevTokenLogin = async () => {
    const success = await authWithClipboardToken();
    if (!success) {
      console.error('Dev clipboard token login failed');
    }
  };

  const backgroundStyle = useAnimatedStyle(() => ({
    opacity: imageOpacity.value,
    transform: [{ scale: scale.value }],
  }));

  const nextBackgroundStyle = useAnimatedStyle(() => ({
    opacity: 1 - imageOpacity.value,
    transform: [{ scale: scale.value }],
  }));

  const formatSeason = (season: string) => {
    return season.charAt(0).toUpperCase() + season.slice(1).toLowerCase();
  };

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollY.value = event.nativeEvent.contentOffset.y;
  };

  const handleContinueWithoutAccount = async () => {
    try {
      const success = await enableAnonymousMode();
      if (success) {
        router.replace('/(tabs)');
      } else {
        console.error('Failed to enable anonymous mode');
      }
    } catch (error) {
      console.error('Error enabling anonymous mode:', error);
    }
  };

  const handlePasteToken = async () => {
    try {
      const clipboardContent = await Clipboard.getStringAsync();
      if (clipboardContent) {
        // Remove any whitespace and quotes
        const cleanToken = clipboardContent.trim().replace(/['"]/g, '');
        
        // Try to handle the token directly
        const success = await handleToken(cleanToken);
        if (!success) {
          console.log('Failed to authenticate with token');
        }
      } else {
        console.log('No content in clipboard');
      }
    } catch (error) {
      console.error('Error handling token paste:', error);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: isDarkMode ? '#000' : '#fff' }]}>
      <StatusBar barStyle="light-content" />
      
      {/* Background Images with transition */}
      {!isLoading && trendingAnime.length > 0 && trendingAnime[currentIndex]?.coverImage && (
        <>
          <Animated.Image
            source={{ 
              uri: trendingAnime[currentIndex].coverImage.extraLarge || 
                   trendingAnime[currentIndex].coverImage.large 
            }}
            style={[styles.backgroundImage, backgroundStyle]}
          />
          {trendingAnime[nextIndex]?.coverImage && (
            <Animated.Image
              source={{ 
                uri: trendingAnime[nextIndex].coverImage.extraLarge || 
                     trendingAnime[nextIndex].coverImage.large 
              }}
              style={[styles.backgroundImage, nextBackgroundStyle]}
            />
          )}
          <LinearGradient
            colors={[
              'rgba(0,0,0,0.3)',
              'rgba(0,0,0,0.5)',
              'rgba(0,0,0,0.7)',
              'rgba(0,0,0,0.9)',
            ]}
            locations={[0, 0.3, 0.6, 1]}
            style={StyleSheet.absoluteFill}
          />
        </>
      )}

      <Animated.ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top, paddingBottom: insets.bottom }
        ]}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
      >
        {/* Header Section */}
        <Animated.View style={[styles.header, headerStyle]}>
          <MotiView
            from={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'timing', duration: 1000, delay: 600 }}
            style={styles.logoContainer}
          >
            <Logo width={240} height={48} />
          </MotiView>
        </Animated.View>

        {/* Welcome Text Section */}
        <Animated.View style={[styles.welcomeTextContainer, headerStyle]}>
          <MotiView
            from={{ opacity: 0, translateY: 20 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 1000, delay: 800 }}
            style={styles.textContainer}
          >
            <Text style={[styles.title, { color: '#fff' }]}>
              ZanTaku
            </Text>
            <Text style={[styles.subtitle, { color: 'rgba(255,255,255,0.8)' }]}>
              Read, Watch, Discover, and Sync better.
            </Text>
          </MotiView>
        </Animated.View>

        {/* Anime Info Card */}
        {!isLoading && trendingAnime.length > 0 && trendingAnime[currentIndex] && (
          <Animated.View style={styles.bottomContainer}>
            <TouchableOpacity 
              style={styles.animePreview}
              onPress={() => setIsAnimeDetailsExpanded(!isAnimeDetailsExpanded)}
              activeOpacity={0.9}
            >
              <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
              <View style={styles.animePreviewContent}>
                <View style={styles.animePreviewLeft}>
                  <Text style={styles.animeTitle} numberOfLines={1}>
                    {trendingAnime[currentIndex]?.title?.userPreferred || 'Loading...'}
                  </Text>
                </View>
                <FontAwesome5 
                  name={isAnimeDetailsExpanded ? "chevron-down" : "chevron-up"} 
                  size={24} 
                  color="#fff" 
                  style={styles.expandIcon}
                />
              </View>
            </TouchableOpacity>

            {isAnimeDetailsExpanded && (
              <MotiView
                from={{ height: 0, opacity: 0 }}
                animate={{ height: 160, opacity: 1 }}
                transition={{ type: 'spring', damping: 15 }}
                style={styles.expandedDetails}
              >
                <BlurView intensity={40} tint="dark" style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.3)' }]} />
                <View style={styles.expandedDetailsContent}>
                  {trendingAnime[currentIndex]?.title?.native && (
                    <Text style={styles.animeSubtitle} numberOfLines={1}>
                      {trendingAnime[currentIndex].title.native}
                    </Text>
                  )}
                  {trendingAnime[currentIndex]?.genres && (
                    <View style={styles.genreContainer}>
                      {trendingAnime[currentIndex].genres.slice(0, 3).map((genre, index) => (
                        <View key={index} style={styles.genreTag}>
                          <Text style={styles.genreText}>{genre}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                  {trendingAnime[currentIndex]?.studios?.nodes?.[0]?.name && (
                    <View style={styles.studioContainer}>
                      <FontAwesome5 name="film" size={12} color="rgba(255,255,255,0.9)" />
                      <Text style={styles.studioText}>
                        {trendingAnime[currentIndex].studios.nodes[0].name}
                      </Text>
                    </View>
                  )}
                  {trendingAnime[currentIndex]?.season && trendingAnime[currentIndex]?.seasonYear && (
                    <View style={styles.seasonContainer}>
                      <FontAwesome5 name="calendar-alt" size={12} color="rgba(255,255,255,0.9)" />
                      <Text style={styles.seasonText}>
                        {formatSeason(trendingAnime[currentIndex].season)} {trendingAnime[currentIndex].seasonYear}
                      </Text>
                    </View>
                  )}
                </View>
              </MotiView>
            )}
          </Animated.View>
        )}
      </Animated.ScrollView>

      {/* Login Button Section */}
      <View style={styles.buttonContainer}>
        {/* Main Login Button */}
        <Animated.View style={[buttonStyle]}>
          <TouchableOpacity
            onPress={handleLogin}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            style={[
              styles.loginButton,
              { backgroundColor: currentTheme.colors.primary }
            ]}
          >
            <Text style={styles.loginButtonText}>Login with AniList</Text>
          </TouchableOpacity>
        </Animated.View>

        {/* Secondary Options Container */}
        <View style={styles.secondaryOptionsContainer}>
          <View style={styles.optionRow}>
            <TouchableOpacity onPress={handleContinueWithoutAccount}>
              <Text style={styles.secondaryOptionText}>Continue without account</Text>
            </TouchableOpacity>
          </View>
          
          {__DEV__ && (
            <View style={styles.optionRow}>
              <TouchableOpacity onPress={handleDevLogin}>
                <Text style={styles.secondaryOptionText}>Dev Login (Pin)</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backgroundImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  scrollView: {
    flex: 1,
    width: '100%',
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    flex: 1,
    minHeight: height - (Platform.OS === 'ios' ? 100 : 140), // Increased bottom spacing for Android
  },
  header: {
    alignItems: 'center',
    width: '100%',
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
  },
  welcomeTextContainer: {
    alignItems: 'center',
    width: '100%',
    position: 'absolute',
    top: '35%',
    transform: [{ translateY: -60 }],
  },
  logoContainer: {
    alignItems: 'center',
    width: '100%',
  },
  textContainer: {
    alignItems: 'center',
    width: '100%',
    marginTop: height * 0.02,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 12,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  subtitle: {
    fontSize: 18,
    textAlign: 'center',
    opacity: 0.8,
    maxWidth: '80%',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  bottomContainer: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 180 : 200,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    zIndex: 10,
  },
  animePreview: {
    borderRadius: 28,
    overflow: 'hidden',
    marginBottom: 4,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
      },
      android: {
        elevation: 12,
      },
    }),
  },
  animePreviewContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    minHeight: 56,
  },
  animePreviewLeft: {
    flex: 1,
    marginRight: 16,
  },
  expandIcon: {
    width: 24,
    height: 24,
    textAlign: 'center',
    opacity: 0.8,
    marginLeft: 8,
  },
  expandedDetails: {
    borderRadius: 24,
    overflow: 'hidden',
    marginBottom: 4,
    maxHeight: 160,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
      },
      android: {
        elevation: 12,
      },
    }),
  },
  expandedDetailsContent: {
    padding: 16,
    height: 160,
    overflow: 'hidden',
  },
  buttonContainer: {
    width: '100%',
    paddingHorizontal: 24,
    paddingBottom: Platform.OS === 'ios' ? 34 : 50,
    paddingTop: 10,
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'transparent',
  },
  loginButton: {
    width: '100%',
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
      },
      android: {
        elevation: 12,
      },
    }),
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  secondaryOptionsContainer: {
    width: '100%',
    marginTop: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  optionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    opacity: 0.9,
    gap: 4,
  },
  secondaryOptionText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
    padding: 2,
  },
  optionDivider: {
    color: '#fff',
    fontSize: 14,
    marginHorizontal: 4,
    opacity: 0.7,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  animeTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
    letterSpacing: 0.3,
    marginRight: 8,
  },
  animeSubtitle: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 15,
    marginTop: 4,
    marginBottom: 8,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  genreContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
    marginBottom: 4,
  },
  genreTag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    overflow: 'hidden',
  },
  genreText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  studioContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  studioText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 13,
    fontWeight: '500',
    marginLeft: 8,
    letterSpacing: 0.2,
  },
  seasonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  seasonText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 13,
    fontWeight: '500',
    marginLeft: 8,
    letterSpacing: 0.2,
  },
}); 