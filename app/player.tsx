import { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, StatusBar, BackHandler } from 'react-native';
import * as ScreenOrientation from 'expo-screen-orientation';
import { PlayerProvider } from './videoplayer/PlayerContext';
import VideoPlayer from './videoplayer/PlayerScreen';
import { useTheme } from '../hooks/useTheme';
import { useLocalSearchParams, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { STORAGE_KEY, ANILIST_GRAPHQL_ENDPOINT } from '../constants/auth';

// Player component that forces landscape orientation
export default function Player() {
  const { isDarkMode } = useTheme();
  const isLocked = useRef(false);
  const lockTimeout = useRef<NodeJS.Timeout | null>(null);
  const [isReady, setIsReady] = useState(false);
  const params = useLocalSearchParams();
  const router = useRouter();
  
  // Add AniList user state
  const [anilistUser, setAnilistUser] = useState<{
    userId: number;
    username: string;
    token: string;
    avatar?: string;
  } | null>(null);

  // Load AniList user data
  useEffect(() => {
    const loadAnilistUser = async () => {
      try {
        const token = await SecureStore.getItemAsync(STORAGE_KEY.AUTH_TOKEN);
        const userData = await SecureStore.getItemAsync(STORAGE_KEY.USER_DATA);
        
        if (token && userData) {
          const user = JSON.parse(userData);
          setAnilistUser({
            userId: user.id,
            username: user.name,
            token: token,
            avatar: user.avatar?.large
          });
          console.log('[PLAYER] 👤 AniList user loaded:', user.name);
        } else {
          console.log('[PLAYER] 👤 No AniList user found');
        }
      } catch (error) {
        console.error('[PLAYER] ❌ Error loading AniList user:', error);
      }
    };

    loadAnilistUser();
  }, []);

  // Handle AniList progress save
  const handleSaveToAniList = async (episodeData: {
    anilistId: string;
    episodeNumber: number;
    currentTime: number;
    duration: number;
  }) => {
    if (!anilistUser || !episodeData.anilistId) {
      console.log('[PLAYER] ⚠️ Cannot save to AniList: missing user or anime ID');
      return false;
    }

    try {
      console.log('[PLAYER] 💾 Saving progress to AniList...', {
        anilistId: episodeData.anilistId,
        episode: episodeData.episodeNumber,
        progress: Math.round((episodeData.currentTime / episodeData.duration) * 100)
      });

      const mutation = `
        mutation ($mediaId: Int, $progress: Int, $status: MediaListStatus) {
          SaveMediaListEntry (mediaId: $mediaId, progress: $progress, status: $status) {
            id
            progress
            status
            media {
              title {
                userPreferred
              }
            }
          }
        }
      `;

      const response = await fetch(ANILIST_GRAPHQL_ENDPOINT, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${anilistUser.token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          query: mutation,
          variables: {
            mediaId: parseInt(episodeData.anilistId),
            progress: episodeData.episodeNumber,
            status: 'CURRENT'
          }
        })
      });

      const data = await response.json();
      
      if (data.errors) {
        console.error('[PLAYER] ❌ AniList API errors:', data.errors);
        throw new Error(data.errors[0]?.message || 'Failed to save to AniList');
      }

      if (data.data?.SaveMediaListEntry) {
        console.log('[PLAYER] ✅ Successfully saved to AniList:', {
          progress: data.data.SaveMediaListEntry.progress,
          status: data.data.SaveMediaListEntry.status,
          title: data.data.SaveMediaListEntry.media?.title?.userPreferred
        });
        return true;
      }

      return false;
    } catch (error) {
      console.error('[PLAYER] ❌ Error saving to AniList:', error);
      throw error;
    }
  };

  // Log all route parameters and data when component mounts
  useEffect(() => {
    const logPlayerData = async () => {
      console.log('\n=== PLAYER COMPONENT DEBUG ===');
      console.log('📱 Player component mounted');
      console.log('🔗 Route parameters:', JSON.stringify(params, null, 2));
      
      // Log individual parameters for clarity
      Object.keys(params).forEach(key => {
        console.log(`📋 Param "${key}":`, params[key]);
      });
      
      // If there's a dataKey parameter, fetch the stored data
      if (params.dataKey) {
        try {
          console.log('🔑 DataKey found, fetching stored data:', params.dataKey);
          const storedData = await AsyncStorage.getItem(params.dataKey as string);
          if (storedData) {
            const parsedData = JSON.parse(storedData);
            console.log('📊 STORED VIDEO DATA JSON:', JSON.stringify(parsedData, null, 2));
            console.log('🎬 Video source URL:', parsedData.source ? parsedData.source.substring(0, 50) + '...' : 'none');
            console.log('📝 Episode info:', {
              episodeId: parsedData.episodeId,
              episodeNumber: parsedData.episodeNumber,
              animeTitle: parsedData.animeTitle,
              anilistId: parsedData.anilistId
            });
            console.log('📋 Headers:', JSON.stringify(parsedData.headers, null, 2));
            console.log('🎯 Subtitles count:', parsedData.subtitles?.length || 0);
            if (parsedData.subtitles?.length > 0) {
              console.log('🎯 Subtitle languages:', parsedData.subtitles.map((s: any) => s.lang).join(', '));
            }
            console.log('⏱️ Video timings:', parsedData.timings ? JSON.stringify(parsedData.timings, null, 2) : 'none');
          } else {
            console.log('⚠️ No stored data found for dataKey:', params.dataKey);
          }
        } catch (error) {
          console.error('❌ Error fetching stored data:', error);
        }
      }
      
      // Log any direct URL parameters that might contain video data
      if (params.url) {
        console.log('🎬 Direct video URL from params:', typeof params.url === 'string' ? params.url.substring(0, 50) + '...' : params.url);
      }
      
      if (params.headers) {
        console.log('📋 Headers from params:', params.headers);
      }
      
      if (params.subtitles) {
        console.log('🎯 Subtitles from params:', params.subtitles);
      }
      
      if (params.timings) {
        console.log('⏱️ Timings from params:', params.timings);
      }
      
      console.log('=== END PLAYER COMPONENT DEBUG ===\n');
    };

    logPlayerData();
  }, [params]);

  // Force landscape mode immediately and maintain it
  useEffect(() => {
    let isMounted = true;
    let subscription: ScreenOrientation.Subscription | null = null;

    const lockToLandscape = async () => {
      if (!isMounted || isLocked.current) return;
      
      try {
        console.log('[PLAYER] 🔒 Preparing to switch to landscape mode...');
        
        // Hide status bar immediately before orientation change to reduce visual artifacts
        StatusBar.setHidden(true, 'fade');
        
        // Use a smoother transition by directly going to LANDSCAPE instead of LANDSCAPE_RIGHT first
        await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
        
        if (isMounted) {
          isLocked.current = true;
          setIsReady(true);
          console.log('[PLAYER] ✅ Locked to landscape mode');
        }
      } catch (error) {
        console.error('[PLAYER] ❌ Failed to lock orientation:', error);
        if (isMounted) {
          setIsReady(true); // Still show the player even if orientation lock fails
        }
      }
    };

    // Execute immediately
    lockToLandscape();

    // Debounced orientation change handler to prevent infinite loops
    const handleOrientationChange = async (event: ScreenOrientation.OrientationChangeEvent) => {
      if (!isMounted || !isLocked.current) return;
      
      // Clear any existing timeout
      if (lockTimeout.current) {
        clearTimeout(lockTimeout.current);
      }

      // Debounce the orientation change to prevent rapid successive calls
      lockTimeout.current = setTimeout(async () => {
        if (!isMounted) return;
        
        const currentOrientation = event.orientationInfo.orientation;
        console.log('[PLAYER] 📱 Orientation changed to:', currentOrientation);
        
        // Only force landscape if currently in portrait and we're still mounted
        if (currentOrientation === ScreenOrientation.Orientation.PORTRAIT_UP || 
            currentOrientation === ScreenOrientation.Orientation.PORTRAIT_DOWN) {
          console.log('[PLAYER] 🔄 Detected portrait orientation, forcing back to landscape');
          
          try {
            await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
            console.log('[PLAYER] ✅ Successfully re-locked to landscape');
          } catch (error) {
            console.error('[PLAYER] ❌ Failed to re-lock orientation:', error);
          }
        }
      }, 100); // 100ms debounce
    };

    // Add orientation change listener only after initial lock
    const addListener = () => {
      if (isMounted) {
        subscription = ScreenOrientation.addOrientationChangeListener(handleOrientationChange);
        console.log('[PLAYER] 👂 Added orientation change listener');
      }
    };

    // Add listener after a short delay to ensure initial lock is complete
    setTimeout(addListener, 200);

    // Cleanup: unlock and return to portrait when unmounting
    return () => {
      isMounted = false;
      isLocked.current = false;
      
      console.log('[PLAYER] 🧹 Cleaning up player component...');
      
      // Clear any pending timeout
      if (lockTimeout.current) {
        clearTimeout(lockTimeout.current);
        lockTimeout.current = null;
      }

      // Remove the orientation change listener
      if (subscription) {
        ScreenOrientation.removeOrientationChangeListener(subscription);
        console.log('[PLAYER] 👂 Removed orientation change listener');
      }
      
      const unlockAndRotate = async () => {
        try {
          console.log('[PLAYER] 🔄 Preparing to restore orientation...');
          
          // Force back to portrait with a cleaner transition
          await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
          console.log('[PLAYER] 📱 Locked to portrait');
          
          // Show status bar after orientation change is complete
          setTimeout(() => {
            StatusBar.setHidden(false, 'fade');
            console.log('[PLAYER] 📱 Status bar restored');
            // Then unlock completely if the app needs to allow rotation elsewhere
            setTimeout(async () => {
              try {
                await ScreenOrientation.unlockAsync();
                console.log('[PLAYER] 🔄 Orientation unlocked - restored to normal');
              } catch (err) {
                console.error('[PLAYER] ❌ Error unlocking orientation:', err);
              }
            }, 100); // Small delay to ensure the portrait lock has taken effect
          }, 400); // Slightly longer delay for smoother transition
        } catch (error) {
          console.error('[PLAYER] ❌ Failed to restore orientation:', error);
          // Fallback attempt if the first try fails
          setTimeout(async () => {
            try {
              await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
              StatusBar.setHidden(false, 'fade');
              await ScreenOrientation.unlockAsync();
              console.log('[PLAYER] ✅ Fallback orientation restore successful');
            } catch (err) {
              console.error('[PLAYER] ❌ Critical orientation error:', err);
            }
          }, 500);
        }
      };
      unlockAndRotate();
    };
  }, []); // Empty dependency array to prevent re-running

  // Don't render the player until orientation is ready
  if (!isReady) {
    console.log('[PLAYER] ⏳ Waiting for orientation to be ready...');
    return (
      <View style={[styles.container, styles.loading, { backgroundColor: isDarkMode ? '#000' : '#fff' }]}>
        <StatusBar hidden={true} />
      </View>
    );
  }

  console.log('[PLAYER] ✅ Player ready, rendering VideoPlayer component');

  return (
    <View style={[styles.container, { backgroundColor: isDarkMode ? '#000' : '#fff' }]}>
      <StatusBar hidden={true} />
      <PlayerProvider 
        anilistUser={anilistUser}
        onSaveToAniList={handleSaveToAniList}
      >
        <VideoPlayer />
      </PlayerProvider>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loading: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});