import { useEffect, useRef, useState, useCallback } from 'react';
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
  const [playerSettings, setPlayerSettings] = useState<{ pipEnabled: boolean; forceLandscape: boolean; saveToAniList: boolean }>({
    pipEnabled: true,
    forceLandscape: true,
    saveToAniList: true,
  });
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

  // Sync player preferences saved from settings (intro/outro markers, auto-skip, etc.)
  useEffect(() => {
    const loadPrefs = async () => {
      try {
        const stored = await AsyncStorage.getItem('playerPreferences');
        if (stored) {
          const prefs = JSON.parse(stored);
          // Forward to children via PlayerProvider context by updating default through event
          // We can't set here directly; PlayerProvider holds state. We'll emit for PlayerScreen to listen.
          DeviceEventEmitter.emit('playerPreferencesHydrated', prefs);
        }
      } catch (e) {
        console.warn('[PLAYER] Failed to hydrate preferences:', e);
      }
    };
    loadPrefs();
    const sub = DeviceEventEmitter.addListener('playerPreferencesChanged', loadPrefs);
    return () => sub.remove();
  }, []);

  // Load player settings and subscribe to changes
  useEffect(() => {
    let isMounted = true;
    const loadSettings = async () => {
      try {
        const stored = await AsyncStorage.getItem('playerSettings');
        if (stored && isMounted) {
          const parsed = JSON.parse(stored);
          setPlayerSettings((prev) => ({ ...prev, ...parsed }));
        }
      } catch (e) {
        console.warn('[PLAYER] ⚠️ Failed to load playerSettings:', e);
      }
    };
    loadSettings();

    const sub = DeviceEventEmitter.addListener('playerSettingsChanged', () => {
      loadSettings();
    });
    return () => {
      isMounted = false;
      sub.remove();
    };
  }, []);

  // Initialize PiP support detection (deferred to next frame to avoid main-thread contention)
  useEffect(() => {
    let raf: number | null = null;
    const checkPipSupport = async () => {
      try {
        setIsPipSupported(playerSettings.pipEnabled === true);
        console.log('[PLAYER] 📱 PiP support initialized');
      } catch (error) {
        console.error('[PLAYER] ❌ Error checking PiP support:', error);
        setIsPipSupported(false);
      }
    };
    // Defer with requestAnimationFrame to allow initial mount to settle
    // @ts-ignore
    raf = global.requestAnimationFrame?.(() => { checkPipSupport(); }) as any;
    return () => {
      if (raf && global.cancelAnimationFrame) {
        // @ts-ignore
        global.cancelAnimationFrame(raf);
      }
    };
  }, [playerSettings.pipEnabled]);

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
    if (!playerSettings.saveToAniList) {
      console.log('[PLAYER] ⏸️ AniList saving disabled by settings');
      return false;
    }
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

  // Log essential route parameters only (reduced logging to prevent terminal lag)
  useEffect(() => {
    const logPlayerData = async () => {
      console.log('[PLAYER] 📱 Player component mounted');
      
      // Only log essential parameters to reduce terminal spam
      if (params.episodeId) {
        console.log('[PLAYER] 📺 Episode:', params.episodeId);
      }
      if (params.animeTitle) {
        console.log('[PLAYER] 🎬 Anime:', params.animeTitle);
      }
      if (params.episodeNumber) {
        console.log('[PLAYER] 📋 Episode #:', params.episodeNumber);
      }
      
      // If there's a dataKey parameter, fetch the stored data (minimal logging)
      if (params.dataKey) {
        try {
          const storedData = await AsyncStorage.getItem(params.dataKey as string);
          if (storedData) {
            const parsedData = JSON.parse(storedData);
            console.log('[PLAYER] ✅ Loaded video data for:', parsedData.animeTitle || 'Unknown');
            console.log('[PLAYER] 🎬 Source available:', !!parsedData.source);
            console.log('[PLAYER] 🎯 Subtitles:', parsedData.subtitles?.length || 0, 'available');
            console.log('[PLAYER] ⏱️ Timings:', parsedData.timings ? 'Available' : 'None');
          } else {
            console.log('[PLAYER] ⚠️ No stored data found for dataKey');
          }
        } catch (error) {
          console.error('[PLAYER] ❌ Error fetching stored data:', error);
        }
      }
    };

    logPlayerData();
  }, [params]);

  // Handle orientation for fullscreen video player (but allow PiP to rotate freely)
  useEffect(() => {
    let isMounted = true;
    let subscription: ScreenOrientation.Subscription | null = null;

    const setupOrientation = async () => {
      if (!isMounted || isLocked.current) return;
      if (!playerSettings.forceLandscape) {
        // Do not force orientation; just mark ready
        StatusBar.setHidden(false, 'fade');
        setIsReady(true);
        console.log('[PLAYER] ℹ️ Force landscape disabled; skipping orientation lock');
        return;
      }
      
      try {
        console.log('[PLAYER] 🔒 Setting up orientation handling...');
        
        // Hide status bar for fullscreen experience
        StatusBar.setHidden(true, 'fade');
        
        // Prefer landscape, but avoid blocking UI thread during the first mount on emulators
        // Yield one frame before locking orientation to reduce jank
        await new Promise((r) => setTimeout(r, 0));
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
        if (!playerSettings.forceLandscape) return;
        
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
    if (playerSettings.forceLandscape) {
      setTimeout(addListener, 300);
    }

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
  }, [playerSettings.forceLandscape]); // Re-run if orientation policy changes

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