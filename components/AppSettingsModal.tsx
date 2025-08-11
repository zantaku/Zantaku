// app setting modal using @gorhom/bottom-sheet for proper bottom sheet behavior
import React, { useCallback, useMemo, useRef, useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView, 
  Pressable, 
  Platform, 
  Image,
  ImageBackground,
  Switch,
  ActivityIndicator,
  DeviceEventEmitter
} from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { useAuth } from '../hooks/useAuth';
import { useIncognito } from '../hooks/useIncognito';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import BottomSheet, { 
  BottomSheetBackdrop, 
  BottomSheetScrollView
} from '@gorhom/bottom-sheet';
import { Portal } from '@gorhom/portal';
import axios from 'axios';
import { ANILIST_GRAPHQL_ENDPOINT } from '../constants/auth';
import * as SecureStore from 'expo-secure-store';
import { STORAGE_KEY } from '../constants/auth';
import { supabase, getAnilistUser } from '../lib/supabase';
import { LinearGradient } from 'expo-linear-gradient';

interface MediaEntry {
  id: number;
  coverImage: {
    large?: string;
    extraLarge?: string;
    medium?: string;
  };
  bannerImage?: string;
  title: {
    userPreferred: string;
  };
}

interface AppSettingsModalProps {
  visible: boolean;
  onClose: () => void;
}

const AppSettingsModal: React.FC<AppSettingsModalProps> = ({ visible, onClose }: AppSettingsModalProps) => {
  const { isDarkMode, toggleTheme } = useTheme();
  const { signIn, signOut, user } = useAuth();
  const { isIncognito, toggleIncognito } = useIncognito();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  
  // State for random media backgrounds
  const [randomAnime, setRandomAnime] = useState<MediaEntry | null>(null);
  const [randomManga, setRandomManga] = useState<MediaEntry | null>(null);
  const [loadingMedia, setLoadingMedia] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  
  // Notification state
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const [loadingNotifications, setLoadingNotifications] = useState(false);
  
  // Bottom sheet ref
  const bottomSheetRef = useRef<BottomSheet>(null);
  
  // Snap points - make it shorter for guest view
  const initialSnapPoints = useMemo(() => [user?.isAnonymous ? '35%' : '55%'], [user?.isAnonymous]);
  
  // Handle component mounting
  useEffect(() => {
    if (visible) {
      bottomSheetRef.current?.expand();
      if (user && !user.isAnonymous) {
        if (!randomAnime && !randomManga) {
          fetchRandomMedia();
        }
        checkVerificationStatus();
        fetchUnreadNotificationCount();
      }
    } else {
      bottomSheetRef.current?.close();
    }
  }, [visible, user]);

  // Listen for notification events to update badge count
  useEffect(() => {
    const notificationReadListener = DeviceEventEmitter.addListener('notificationRead', () => {
      // Decrease count by 1
      setUnreadNotificationCount(prev => Math.max(0, prev - 1));
    });

    const notificationsClearedListener = DeviceEventEmitter.addListener('notificationsCleared', () => {
      // Set count to 0
      setUnreadNotificationCount(0);
    });

    return () => {
      notificationReadListener.remove();
      notificationsClearedListener.remove();
    };
  }, []);
  
  // Check user verification status
  const checkVerificationStatus = async () => {
    // Only check verification for logged-in users
    if (!user || user.isAnonymous) {
      setIsVerified(false);
      return;
    }
    
    try {
      // Use direct REST helper to avoid RLS requiring a Supabase auth session
      const anilistUser = await getAnilistUser(user.id);
      setIsVerified(Boolean(anilistUser?.is_verified));
    } catch (error) {
      console.error('Error checking verification status:', error);
      setIsVerified(false);
    }
  };
  
  // Fetch random media from user's lists
  const fetchRandomMedia = async () => {
    if (!user || loadingMedia) return;
    
    try {
      setLoadingMedia(true);
      const token = await SecureStore.getItemAsync(STORAGE_KEY.AUTH_TOKEN);
      
      if (!token) {
        console.log("No auth token available");
        setLoadingMedia(false);
        return;
      }
      
      // Query to get a sampling of the user's anime and manga lists - simplified for reliability
      const query = `
        query {
          Viewer {
            id
            name
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
                    large
                    extraLarge
                  }
                  bannerImage
                }
              }
              manga {
                nodes {
                  id
                  title {
                    userPreferred
                  }
                  coverImage {
                    large
                    extraLarge
                  }
                  bannerImage
                }
              }
            }
          }
        }
      `;
      
      console.log("Fetching user media data...");
      const { data } = await axios.post(
        ANILIST_GRAPHQL_ENDPOINT,
        {
          query
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          }
        }
      );
      
      // First try to use favorites
      let animeEntries = data?.data?.Viewer?.favourites?.anime?.nodes || [];
      let mangaEntries = data?.data?.Viewer?.favourites?.manga?.nodes || [];

      // If no favorites found, try fallback to a different query for watchlist/readlist
      if (animeEntries.length === 0 || mangaEntries.length === 0) {
        try {
          // Fallback query for media lists
          const mediaQuery = `
            query {
              animeList: MediaListCollection(userId: ${user.id}, type: ANIME, sort: UPDATED_TIME_DESC, limit: 15) {
                lists {
                  entries {
                    media {
                      id
                      title {
                        userPreferred
                      }
                      coverImage {
                        large
                        extraLarge
                      }
                      bannerImage
                    }
                  }
                }
              }
              mangaList: MediaListCollection(userId: ${user.id}, type: MANGA, sort: UPDATED_TIME_DESC, limit: 15) {
                lists {
                  entries {
                    media {
                      id
                      title {
                        userPreferred
                      }
                      coverImage {
                        large
                        extraLarge
                      }
                      bannerImage
                    }
                  }
                }
              }
            }
          `;
          
          const mediaResponse = await axios.post(
            ANILIST_GRAPHQL_ENDPOINT,
            {
              query: mediaQuery
            },
            {
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
              }
            }
          );
          
          // Extract anime entries from fallback query
          if (animeEntries.length === 0) {
            animeEntries = mediaResponse?.data?.data?.animeList?.lists?.flatMap(
              (list: any) => list.entries?.map((entry: any) => entry.media)
            ).filter(Boolean) || [];
          }
          
          // Extract manga entries from fallback query
          if (mangaEntries.length === 0) {
            mangaEntries = mediaResponse?.data?.data?.mangaList?.lists?.flatMap(
              (list: any) => list.entries?.map((entry: any) => entry.media)
            ).filter(Boolean) || [];
          }
        } catch (fallbackError) {
          console.error('Error in fallback query:', fallbackError);
        }
      }
      
      // Use fallback images if no entries found
      if (animeEntries.length === 0) {
        setRandomAnime({
          id: 0,
          title: { userPreferred: "My Anime" },
          coverImage: {},
          bannerImage: 'https://s4.anilist.co/file/anilistcdn/media/anime/banner/16498-8jpFCOcDmneX.jpg'
        });
      } else {
        // Select random entries with preference for those with bannerImage
        // Try to find entries with banner images first
        const animeWithBanners = animeEntries.filter((anime: MediaEntry) => anime.bannerImage);
        if (animeWithBanners.length > 0) {
          setRandomAnime(animeWithBanners[Math.floor(Math.random() * animeWithBanners.length)]);
        } else {
          setRandomAnime(animeEntries[Math.floor(Math.random() * animeEntries.length)]);
        }
      }
      
      if (mangaEntries.length === 0) {
        setRandomManga({
          id: 0,
          title: { userPreferred: "My Manga" },
          coverImage: {},
          bannerImage: 'https://s4.anilist.co/file/anilistcdn/media/manga/banner/30002-3TuoSMl21ZvT.jpg'
        });
      } else {
        // Try to find entries with banner images first
        const mangaWithBanners = mangaEntries.filter((manga: MediaEntry) => manga.bannerImage);
        if (mangaWithBanners.length > 0) {
          setRandomManga(mangaWithBanners[Math.floor(Math.random() * mangaWithBanners.length)]);
        } else {
          setRandomManga(mangaEntries[Math.floor(Math.random() * mangaEntries.length)]);
        }
      }
      
    } catch (error) {
      console.error('Error fetching random media:', error);
      // Set fallback images
      setRandomAnime({
        id: 0,
        title: { userPreferred: "My Anime" },
        coverImage: {},
        bannerImage: 'https://s4.anilist.co/file/anilistcdn/media/anime/banner/16498-8jpFCOcDmneX.jpg'
      });
      setRandomManga({
        id: 0,
        title: { userPreferred: "My Manga" },
        coverImage: {},
        bannerImage: 'https://s4.anilist.co/file/anilistcdn/media/manga/banner/30002-3TuoSMl21ZvT.jpg'
      });
    } finally {
      setLoadingMedia(false);
    }
  };
  
  // Fetch unread notification count
  const fetchUnreadNotificationCount = async () => {
    if (!user || loadingNotifications) return;
    
    try {
      setLoadingNotifications(true);
      const token = await SecureStore.getItemAsync(STORAGE_KEY.AUTH_TOKEN);
      
      if (!token) {
        console.log("No auth token available");
        setLoadingNotifications(false);
        return;
      }
      
      // Query to get recent notifications - we'll count them as "unread" for display
      const query = `
        query {
          Page(page: 1, perPage: 20) {
            pageInfo {
              total
            }
            notifications {
              ... on AiringNotification {
                id
                createdAt
                episode
                media {
                  title {
                    userPreferred
                  }
                }
              }
              ... on MediaDataChangeNotification {
                id
                createdAt
                media {
                  title {
                    userPreferred
                  }
                }
              }
              ... on ActivityLikeNotification {
                id
                createdAt
                user {
                  name
                }
              }
              ... on ActivityReplyNotification {
                id
                createdAt
                user {
                  name
                }
              }
              ... on FollowingNotification {
                id
                createdAt
                user {
                  name
                }
              }
              ... on ActivityMessageNotification {
                id
                createdAt
                user {
                  name
                }
              }
            }
          }
        }
      `;
      
      console.log("Fetching notification count...");
      const response = await axios.post(
        ANILIST_GRAPHQL_ENDPOINT,
        {
          query
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          }
        }
      );
      
      if (response.data?.errors) {
        console.error('GraphQL errors:', response.data.errors);
        return;
      }
      
      const notifications = response.data?.data?.Page?.notifications || [];
      
      // Filter notifications from the last 7 days to show as "new"
      const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
      const recentNotifications = notifications.filter((notif: any) => {
        const notifTime = notif.createdAt * 1000;
        return notifTime > sevenDaysAgo;
      });
      
      const unreadCount = recentNotifications.length;
      setUnreadNotificationCount(Math.min(unreadCount, 99)); // Cap at 99 for display
      
      console.log(`Found ${unreadCount} recent notifications`);
      
    } catch (error) {
      console.error('Error fetching notification count:', error);
      // Set a default count if there's an error but user is authenticated
      if (user && !user.isAnonymous) {
        setUnreadNotificationCount(0);
      }
    } finally {
      setLoadingNotifications(false);
    }
  };
  
  // Rendering backdrop component
  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={isDarkMode ? 0.7 : 0.5}
        pressBehavior="close"
      />
    ),
    [isDarkMode]
  );
  
  // Handle close
  const handleSheetChanges = useCallback((index: number) => {
    if (index === -1) {
      onClose();
    }
  }, [onClose]);

  const handleSignOut = async (): Promise<void> => {
    await signOut();
    onClose();
    router.replace('/welcome');
  };

  const navigateToWatchlist = () => {
    onClose();
    router.push('/watchlist');
  };

  const navigateToReadlist = () => {
    onClose();
    router.push('/readlist');
  };

  const navigateToSettings = () => {
    onClose();
    router.push('/settings');
  };

  // Add function to navigate to API status
  const navigateToAPIStatus = () => {
    onClose();
    router.push('/appsettings/api');
  };

  // Add function to navigate to activities
  const navigateToActivities = () => {
    onClose();
    router.push('/activitiespage');
  };

  // Add function to navigate to notifications
  const navigateToNotifications = () => {
    onClose();
    router.push('/notifications');
  };

  // Get the best available image from a media entry
  const getBestImage = (media: MediaEntry | null, fallbackUri: string): string => {
    if (!media) return fallbackUri;
    
    return media.bannerImage || 
           media.coverImage?.extraLarge || 
           media.coverImage?.large || 
           media.coverImage?.medium || 
           fallbackUri;
  };

  const handleLogin = async () => {
    router.replace('/welcome');
    onClose();
  };

  // Only render when visible to improve performance
  if (!visible) return null;

  return (
    <Portal>
      <BottomSheet
        ref={bottomSheetRef}
        index={0}
        snapPoints={initialSnapPoints}
        onChange={handleSheetChanges}
        enablePanDownToClose
        backdropComponent={renderBackdrop}
        handleIndicatorStyle={[styles.handle, { backgroundColor: isDarkMode ? '#444' : '#CCCCCC' }]}
        backgroundStyle={{ backgroundColor: isDarkMode ? '#121212' : '#FFFFFF' }}
        style={styles.bottomSheet}
        android_keyboardInputMode="adjustResize"
        keyboardBehavior="interactive"
        keyboardBlurBehavior="restore"
        enableOverDrag={true}
      >
        <BottomSheetScrollView 
          style={styles.content} 
          contentContainerStyle={[
            styles.contentContainer,
            { paddingBottom: insets.bottom > 0 ? insets.bottom + 20 : 20 }
          ]}
        >
          {/* Profile Bar - Show different version for guest */}
          <View style={styles.profileBar}>
            <View style={styles.profileInfo}>
              {/* Show the user's avatar if available, or the placeholder if not */}
              {user?.isAnonymous || !user?.avatar?.large ? (
                <TouchableOpacity 
                  style={[styles.avatar, styles.placeholderAvatar]}
                  onPress={() => {
                    if (!user?.isAnonymous) {
                      onClose();
                      router.push('/profile');
                    }
                  }}
                  disabled={user?.isAnonymous}
                >
                  <FontAwesome5 name="user" size={20} color="#02A9FF" />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  onPress={() => {
                    onClose();
                    router.push('/profile');
                  }}
                  activeOpacity={0.8}
                >
                  <Image 
                    source={{ uri: user.avatar.large }} 
                    style={styles.avatar}
                    resizeMode="cover"
                  />
                </TouchableOpacity>
              )}
              
              <View style={styles.usernameContainer}>
                <TouchableOpacity
                  onPress={() => {
                    if (!user?.isAnonymous) {
                      onClose();
                      router.push('/profile');
                    }
                  }}
                  disabled={user?.isAnonymous}
                  style={{ flexDirection: 'row', alignItems: 'center' }}
                >
                  <Text style={[
                    styles.username, 
                    { color: isDarkMode ? '#FFFFFF' : '#000000' },
                    !user?.isAnonymous && styles.clickableText
                  ]}>
                    {user?.isAnonymous ? 'Guest' : user?.name}
                  </Text>
                  
                  {/* Verification Badge */}
                  {isVerified && !user?.isAnonymous && (
                    <View style={styles.verifiedBadgeContainer}>
                      <LinearGradient
                        colors={['#1DA1F2', '#1A91DA']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.verifiedBadge}
                      >
                        <FontAwesome5 
                          name="check" 
                          size={8} 
                          color="#FFFFFF"
                        />
                      </LinearGradient>
                    </View>
                  )}
                </TouchableOpacity>
              </View>
            </View>
            
            <View style={styles.profileActions}>
              {/* Notification Bell - Only show for logged in users */}
              {!user?.isAnonymous && (
                <TouchableOpacity 
                  style={styles.notificationButton}
                  onPress={navigateToNotifications}
                >
                  <FontAwesome5 
                    name="bell" 
                    size={18} 
                    color={isDarkMode ? '#FFFFFF' : '#333333'} 
                  />
                  {unreadNotificationCount > 0 && (
                    <View style={styles.notificationBadge}>
                      <Text style={styles.notificationBadgeText}>
                        {unreadNotificationCount > 99 ? '99+' : unreadNotificationCount}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              )}
              
              {/* Logout/Login Button */}
              <TouchableOpacity 
                style={[
                  styles.logoutButton,
                  user?.isAnonymous && { backgroundColor: 'rgba(2, 169, 255, 0.1)' }
                ]}
                onPress={user?.isAnonymous ? handleLogin : handleSignOut}
              >
                <Text style={[
                  styles.logoutText,
                  user?.isAnonymous && { color: '#02A9FF' }
                ]}>
                  {user?.isAnonymous ? 'Login with AniList' : 'Logout'}
                </Text>
                <FontAwesome5 
                  name="chevron-right" 
                  size={14} 
                  color={user?.isAnonymous ? '#02A9FF' : '#FF3B30'} 
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Quick Access Buttons - Only show for logged in users */}
          {!user?.isAnonymous && (
            <View style={styles.quickAccess}>
              <TouchableOpacity 
                style={styles.quickAccessButton}
                onPress={navigateToWatchlist}
              >
                <ImageBackground
                  source={{ uri: getBestImage(randomAnime, 'https://s4.anilist.co/file/anilistcdn/media/anime/banner/16498-8jpFCOcDmneX.jpg') }}
                  style={styles.quickAccessBg}
                  imageStyle={styles.quickAccessBgImage}
                >
                  <View style={styles.quickAccessOverlay} />
                  {loadingMedia ? (
                    <ActivityIndicator size="small" color="#FFFFFF" style={styles.loadingIndicator} />
                  ) : (
                    <>
                      <View style={styles.quickAccessContent}>
                        <FontAwesome5 name="tv" size={24} color="#FFFFFF" />
                        <Text style={styles.quickAccessText}>Watchlist</Text>
                      </View>
                      {randomAnime && (
                        <View style={styles.mediaTitleContainer}>
                          <Text style={styles.mediaTitleText} numberOfLines={1}>
                            {randomAnime.title.userPreferred}
                          </Text>
                        </View>
                      )}
                    </>
                  )}
                </ImageBackground>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.quickAccessButton}
                onPress={navigateToReadlist}
              >
                <ImageBackground
                  source={{ uri: getBestImage(randomManga, 'https://s4.anilist.co/file/anilistcdn/media/manga/banner/30002-3TuoSMl21ZvT.jpg') }}
                  style={styles.quickAccessBg}
                  imageStyle={styles.quickAccessBgImage}
                >
                  <View style={styles.quickAccessOverlay} />
                  {loadingMedia ? (
                    <ActivityIndicator size="small" color="#FFFFFF" style={styles.loadingIndicator} />
                  ) : (
                    <>
                      <View style={styles.quickAccessContent}>
                        <FontAwesome5 name="book" size={24} color="#FFFFFF" />
                        <Text style={styles.quickAccessText}>Readlist</Text>
                      </View>
                      {randomManga && (
                        <View style={styles.mediaTitleContainer}>
                          <Text style={styles.mediaTitleText} numberOfLines={1}>
                            {randomManga.title.userPreferred}
                          </Text>
                        </View>
                      )}
                    </>
                  )}
                </ImageBackground>
              </TouchableOpacity>
            </View>
          )}

          {/* Guest Mode / Incognito Mode Toggle */}
          <View style={[styles.settingRow, { borderBottomColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }]}>
            <View style={styles.settingRowLeft}>
              <FontAwesome5 name="user-secret" size={20} color="#02A9FF" style={styles.settingIcon} />
              <Text style={[styles.settingText, { color: isDarkMode ? '#FFFFFF' : '#000000' }]}>
                {user?.isAnonymous ? 'Guest Mode' : 'Incognito Mode'}
              </Text>
            </View>
            <Switch
              value={user?.isAnonymous ? true : isIncognito}
              onValueChange={toggleIncognito}
              trackColor={{ false: '#767577', true: '#02A9FF' }}
              thumbColor="#FFFFFF"
              ios_backgroundColor="#3e3e3e"
              disabled={user?.isAnonymous}
            />
          </View>

          {/* Theme Toggle */}
          <TouchableOpacity
            style={[styles.settingRow, { borderBottomColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }]}
            onPress={() => {
              onClose();
              router.push('/appsettings/themesettings');
            }}
          >
            <View style={styles.settingRowLeft}>
              <FontAwesome5 name={isDarkMode ? "sun" : "moon"} size={20} color="#02A9FF" style={styles.settingIcon} />
              <Text style={[styles.settingText, { color: isDarkMode ? '#FFFFFF' : '#000000' }]}>
                Theme
              </Text>
            </View>
            <FontAwesome5 name="chevron-right" size={16} color={isDarkMode ? '#666' : '#999'} />
          </TouchableOpacity>

          {/* Activities Button - Only show for logged in users */}
          {!user?.isAnonymous && (
            <TouchableOpacity 
              style={[styles.settingRow, { borderBottomColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }]}
              onPress={navigateToActivities}
            >
              <View style={styles.settingRowLeft}>
                <FontAwesome5 name="history" size={20} color="#02A9FF" style={styles.settingIcon} />
                <Text style={[styles.settingText, { color: isDarkMode ? '#FFFFFF' : '#000000' }]}>
                  Activities
                </Text>
              </View>
              <FontAwesome5 name="chevron-right" size={16} color={isDarkMode ? '#666' : '#999'} />
            </TouchableOpacity>
          )}

        

          {/* Settings Navigation Button */}
          <TouchableOpacity 
            style={[styles.settingRow, { borderBottomColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }]}
            onPress={navigateToSettings}
          >
            <View style={styles.settingRowLeft}>
              <FontAwesome5 name="cog" size={20} color="#02A9FF" style={styles.settingIcon} />
              <Text style={[styles.settingText, { color: isDarkMode ? '#FFFFFF' : '#000000' }]}>
                Settings
              </Text>
            </View>
            <FontAwesome5 name="chevron-right" size={16} color={isDarkMode ? '#666' : '#999'} />
          </TouchableOpacity>

        </BottomSheetScrollView>
      </BottomSheet>
    </Portal>
  );
};

const styles = StyleSheet.create({
  bottomSheet: {
    zIndex: 9999,
    elevation: 25,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.5,
    shadowRadius: 15,
  },
  handle: {
    width: 40,
    height: 5,
    borderRadius: 3,
    alignSelf: 'center',
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingTop: 12,
    paddingBottom: 20,
  },

  // Profile Bar Styles
  profileBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
    minHeight: 60,
  },
  profileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    marginRight: 12,
    borderWidth: 2,
    borderColor: '#02A9FF',
  },
  placeholderAvatar: {
    backgroundColor: 'rgba(2, 169, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  usernameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  username: {
    fontSize: 16,
    fontWeight: '600',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  logoutText: {
    color: '#FF3B30',
    marginRight: 4,
    fontWeight: '600',
  },
  verifiedBadgeContainer: {
    marginLeft: 6,
  },
  verifiedBadge: {
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Quick Access Buttons
  quickAccess: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 12,
  },
  quickAccessButton: {
    flex: 1,
    height: 100,
    borderRadius: 12,
    overflow: 'hidden',
  },
  quickAccessBg: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickAccessBgImage: {
    borderRadius: 12,
  },
  quickAccessOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 12,
  },
  quickAccessContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickAccessText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 16,
    marginTop: 8,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  mediaTitleContainer: {
    position: 'absolute',
    bottom: 4,
    left: 6,
    right: 6,
    alignItems: 'flex-start',
  },
  mediaTitleText: {
    color: '#FFFFFF',
    fontSize: 8,
    opacity: 0.45,
    maxWidth: '90%',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
    fontWeight: '400',
  },
  loadingIndicator: {
    marginVertical: 8,
  },

  // Setting Row
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    minHeight: 48,
  },
  settingRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingIcon: {
    marginRight: 12,
    width: 24,
    textAlign: 'center',
  },
  settingText: {
    fontSize: 16,
  },
  clickableText: {
    textDecorationLine: 'none',
    opacity: 0.95,
  },

  // Profile Actions Styles
  profileActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  notificationButton: {
    padding: 8,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  notificationBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: '#FF3B30',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  notificationBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
});

export default AppSettingsModal;

