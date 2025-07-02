import { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, StatusBar, BackHandler, DeviceEventEmitter } from 'react-native';
import * as ScreenOrientation from 'expo-screen-orientation';
import { PlayerProvider } from './videoplayer/PlayerContext';
import VideoPlayer from './videoplayer/PlayerScreen';
import { useTheme } from '../hooks/useTheme';
import { useLocalSearchParams, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { STORAGE_KEY, ANILIST_GRAPHQL_ENDPOINT } from '../constants/auth';

// Player component that forces landscape orientation and supports native PiP
export default function Player() {
  const { isDarkMode } = useTheme();
  const isLocked = useRef(false);
  const lockTimeout = useRef<NodeJS.Timeout | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isPipSupported, setIsPipSupported] = useState(false);
  const [isInPipMode, setIsInPipMode] = useState(false);
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

  // Initialize PiP support detection
  useEffect(() => {
    const checkPipSupport = async () => {
      try {
        // For now, assume PiP is supported on modern devices
        // The actual PiP functionality will be handled by expo-video in the PlayerScreen
        setIsPipSupported(true);
        console.log('[PLAYER] 📱 PiP support initialized');
      } catch (error) {
        console.error('[PLAYER] ❌ Error checking PiP support:', error);
        setIsPipSupported(false);
      }
    };

    checkPipSupport();
  }, []);

  // PiP Functions - These will be passed to PlayerScreen to handle via expo-video
  const enterPiP = async () => {
    console.log('[PLAYER] 📱 PiP enter request - will be handled by video player');
    // The actual PiP functionality is handled in PlayerScreen.tsx using expo-video
  };

  const exitPiP = async () => {
    console.log('[PLAYER] 📱 PiP exit request - will be handled by video player');
    // The actual PiP functionality is handled in PlayerScreen.tsx using expo-video
  };

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

      // Emit events to refresh other parts of the app
      DeviceEventEmitter.emit('refreshMediaLists');
      DeviceEventEmitter.emit('refreshWatchlist');

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
      if (params.source) {
        console.log('🎬 Direct video source from params:', typeof params.source === 'string' ? params.source.substring(0, 50) + '...' : params.source);
      }
      
      if (params.headers) {
        console.log('📋 Headers from params (raw):', params.headers);
        try {
          if (typeof params.headers === 'string' && params.headers.trim()) {
            const parsedHeaders = JSON.parse(params.headers);
            console.log('📋 Headers from params (parsed):', JSON.stringify(parsedHeaders, null, 2));
          }
        } catch (error) {
          console.log('⚠️ Failed to parse headers from params:', error);
        }
      }
      
      if (params.subtitles) {
        console.log('🎯 Subtitles from params (raw):', typeof params.subtitles);
        try {
          if (typeof params.subtitles === 'string' && params.subtitles.trim()) {
            const parsedSubtitles = JSON.parse(params.subtitles);
            console.log('🎯 Subtitles from params (parsed):', `${parsedSubtitles.length} subtitles`);
            if (parsedSubtitles.length > 0) {
              console.log('🎯 Subtitle languages from params:', parsedSubtitles.map((s: any) => s.lang).join(', '));
            }
          }
        } catch (error) {
          console.log('⚠️ Failed to parse subtitles from params:', error);
        }
      }
      
      if (params.timings) {
        console.log('⏱️ Timings from params (raw):', typeof params.timings);
        try {
          if (typeof params.timings === 'string' && params.timings.trim()) {
            const parsedTimings = JSON.parse(params.timings);
            console.log('⏱️ Timings from params (parsed):', JSON.stringify(parsedTimings, null, 2));
          }
        } catch (error) {
          console.log('⚠️ Failed to parse timings from params:', error);
        }
      }
      
      console.log('=== END PLAYER COMPONENT DEBUG ===\n');
    };

    logPlayerData();
  }, [params]);

  // Handle orientation for fullscreen video player (but allow PiP to rotate freely)
  useEffect(() => {
    let isMounted = true;
    let subscription: ScreenOrientation.Subscription | null = null;

    const setupOrientation = async () => {
      if (!isMounted || isLocked.current) return;
      
      try {
        console.log('[PLAYER] 🔒 Setting up orientation handling...');
        
        // Hide status bar for fullscreen experience
        StatusBar.setHidden(true, 'fade');
        
        // For fullscreen video player, prefer landscape but don't force it aggressively
        // This allows the system to handle PiP orientation changes naturally
        await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
        
        if (isMounted) {
          isLocked.current = true;
          setIsReady(true);
          console.log('[PLAYER] ✅ Initial orientation set to landscape');
        }
      } catch (error) {
        console.error('[PLAYER] ❌ Failed to set orientation:', error);
        if (isMounted) {
          setIsReady(true); // Still show the player even if orientation lock fails
        }
      }
    };

    // Execute immediately
    setupOrientation();

    // More relaxed orientation change handler that doesn't interfere with PiP
    const handleOrientationChange = async (event: ScreenOrientation.OrientationChangeEvent) => {
      if (!isMounted || !isLocked.current || isInPipMode) return;
      
      // Clear any existing timeout
      if (lockTimeout.current) {
        clearTimeout(lockTimeout.current);
      }

      // Only handle orientation changes when NOT in PiP mode
      lockTimeout.current = setTimeout(async () => {
        if (!isMounted || isInPipMode) return;
        
        const currentOrientation = event.orientationInfo.orientation;
        console.log('[PLAYER] 📱 Orientation changed to:', currentOrientation);
        
        // Less aggressive approach - only force landscape in specific cases
        if (!isInPipMode && (currentOrientation === ScreenOrientation.Orientation.PORTRAIT_UP || 
            currentOrientation === ScreenOrientation.Orientation.PORTRAIT_DOWN)) {
          console.log('[PLAYER] 🔄 Detected portrait orientation while fullscreen, suggesting landscape');
          
          try {
            await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
            console.log('[PLAYER] ✅ Successfully suggested landscape orientation');
          } catch (error) {
            console.error('[PLAYER] ❌ Failed to suggest orientation:', error);
          }
        }
      }, 150); // Slightly longer debounce for smoother experience
    };

    // Add orientation change listener
    const addListener = () => {
      if (isMounted) {
        subscription = ScreenOrientation.addOrientationChangeListener(handleOrientationChange);
        console.log('[PLAYER] 👂 Added orientation change listener with PiP awareness');
      }
    };

    // Add listener after a short delay to ensure initial setup is complete
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
      
      const restoreOrientation = async () => {
        try {
          console.log('[PLAYER] 🔄 Restoring normal orientation behavior...');
          
          // Restore status bar first
          StatusBar.setHidden(false, 'fade');
          console.log('[PLAYER] 📱 Status bar restored');
          
          // Unlock orientation to allow natural rotation
          await ScreenOrientation.unlockAsync();
          console.log('[PLAYER] 🔄 Orientation unlocked - restored to normal');
          
        } catch (error) {
          console.error('[PLAYER] ❌ Failed to restore orientation:', error);
          // Fallback: try to at least restore the status bar
          try {
            StatusBar.setHidden(false, 'fade');
            await ScreenOrientation.unlockAsync();
            console.log('[PLAYER] ✅ Fallback orientation restore successful');
          } catch (err) {
            console.error('[PLAYER] ❌ Critical orientation error:', err);
          }
        }
      };
      restoreOrientation();
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
  console.log('[PLAYER] 📱 PiP Status - Supported:', isPipSupported, 'In PiP Mode:', isInPipMode);

  return (
    <View style={[styles.container, { backgroundColor: isDarkMode ? '#000' : '#fff' }]}>
      <StatusBar hidden={true} />
      
      <PlayerProvider 
        anilistUser={anilistUser}
        onSaveToAniList={handleSaveToAniList}
        onEnterPiP={enterPiP}
        onExitPiP={exitPiP}
        isPipSupported={isPipSupported}
        isInPipMode={isInPipMode}
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