import { useEffect, useRef, useState, useCallback } from 'react';
import { View, StyleSheet, StatusBar, DeviceEventEmitter, Platform, Modal, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import * as ScreenOrientation from 'expo-screen-orientation';
import ExpoAvPlayer from '@components/ExpoAvPlayer';
import WebViewVideoPlayer from '@components/WebViewVideoPlayer';
import SubtitleOverlay from '@components/SubtitleOverlay';
import { useTheme } from '../../hooks/useTheme';
import { useLocalSearchParams, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { STORAGE_KEY, ANILIST_GRAPHQL_ENDPOINT } from '../../constants/auth';
import usePictureInPicture from '../../hooks/usePictureInPicture';

// Types for better type safety
type Engine = "webview" | "expoav";

interface ZencloudData {
  m3u8_url: string;
  subtitles?: { format?: string }[];
  chapters?: unknown[];
}

interface VideoData {
  source: string;
  headers?: Record<string, string>;
  audioType?: "sub" | "dub";
  zencloudData?: ZencloudData;
}

// Auto-select best player engine based on video data and platform
function decideEngine(data: VideoData | null): Engine {
  // Prefer WebView when we need features expo-av (in Expo Go) can't do:
  // - Multiple audio tracks via HLS (zencloudData present)
  // - Want hls.js behaviors (ABR, audioTrack switching)
  // Otherwise prefer expo-av for lower overhead / true native.
  const hasZen = !!data?.zencloudData;
  if (Platform.OS === "android" && hasZen) return "webview";
  // iOS: native HLS is solid; still switch to WebView if you want HLS.js features.
  if (Platform.OS === "ios" && hasZen) return "expoav";
  // Fallback
  return Platform.OS === "ios" ? "expoav" : "webview";
}

// Player component that forces landscape orientation and supports native PiP
export default function Player() {
  const { isDarkMode } = useTheme();
  const router = useRouter();
  const isLocked = useRef(false);
  const lockTimeout = useRef<NodeJS.Timeout | null>(null);
  const [isReady, setIsReady] = useState(false);
  const { isSupported: isPipSupported, isInPipMode } = usePictureInPicture();
  const [useExpoAv, setUseExpoAv] = useState<Engine>("webview"); // Auto-detect based on video data
  const [playerSettings, setPlayerSettings] = useState<{ pipEnabled: boolean; forceLandscape: boolean; saveToAniList: boolean }>({
    pipEnabled: true,
    forceLandscape: true,
    saveToAniList: true,
  });
  const params = useLocalSearchParams();
  
  // Add AniList user state
  const [anilistUser, setAnilistUser] = useState<{
    userId: number;
    username: string;
    token: string;
    avatar?: string;
  } | null>(null);

  // Exit modal state
  const [showExitModal, setShowExitModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const currentPlaybackPosition = useRef<number>(0);
  const videoDuration = useRef<number>(0);
  const pendingExit = useRef<boolean>(false);

  // Subtitle state
  const [videoData, setVideoData] = useState<any>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [selectedSubtitle, setSelectedSubtitle] = useState(0);
  const [subtitleSize, setSubtitleSize] = useState(16);
  const [subtitleOpacity, setSubtitleOpacity] = useState(1.0);
  const [subtitlePosition, setSubtitlePosition] = useState(0.8);
  const [subtitlesEnabled, setSubtitlesEnabled] = useState(true);

  // Auto-detect best player engine based on video data
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const key = params.dataKey as string;
        if (!key) return;
        const raw = await AsyncStorage.getItem(key);
        const parsed: VideoData | null = raw ? JSON.parse(raw) : null;
        if (!mounted) return;
        const engine = decideEngine(parsed);
        setUseExpoAv(engine);
        console.log('[PLAYER] 🎯 Auto-selected engine:', engine, 'for video data:', {
          hasZencloud: !!parsed?.zencloudData,
          platform: Platform.OS
        });
      } catch {
        // Keep default engine on error
        console.warn('[PLAYER] ⚠️ Failed to auto-detect engine, using default');
      }
    })();
    return () => { mounted = false; };
  }, [params.dataKey]);

  // Load video data and subtitle settings
  useEffect(() => {
    const loadVideoData = async () => {
      try {
        const dataKey = params.dataKey as string;
        if (dataKey) {
          const storedData = await AsyncStorage.getItem(`videoData_${dataKey}`);
          if (storedData) {
            const data = JSON.parse(storedData);
            setVideoData(data);
            console.log('[PLAYER] 🎬 Loaded video data for subtitles');
          }
        }
      } catch (error) {
        console.error('[PLAYER] ❌ Error loading video data:', error);
      }
    };

    const loadSubtitleSettings = async () => {
      try {
        const stored = await AsyncStorage.getItem('playerSettings');
        if (stored) {
          const settings = JSON.parse(stored);
          setSelectedSubtitle(settings.selectedSubtitle || 0);
          setSubtitleSize(settings.subtitleSize || 16);
          setSubtitleOpacity(settings.subtitleOpacity || 1.0);
          setSubtitlePosition(settings.subtitlePosition || 0.8);
          setSubtitlesEnabled(settings.subtitlesEnabled !== false);
        }
      } catch (error) {
        console.warn('[PLAYER] ⚠️ Failed to load subtitle settings:', error);
      }
    };

    loadVideoData();
    loadSubtitleSettings();
  }, [params.dataKey]);

  // Handle time updates from WebView player
  const handleTimeUpdate = (time: number) => {
    setCurrentTime(time);
    currentPlaybackPosition.current = time;
  };

  // Listen for playback time updates from players
  useEffect(() => {
    const timeListener = DeviceEventEmitter.addListener('playerTimeUpdate', ({ currentTime, duration }: { currentTime: number; duration: number }) => {
      currentPlaybackPosition.current = currentTime;
      videoDuration.current = duration;
    });

    const durationListener = DeviceEventEmitter.addListener('playerDuration', (duration: number) => {
      videoDuration.current = duration;
    });

    return () => {
      timeListener.remove();
      durationListener.remove();
    };
  }, []);

  // Handle player errors and fallback
  const handlePlayerError = (error: string) => {
    console.error('[PLAYER] ❌ Player error:', error);
    
    // Fallback to WebViewVideoPlayer if ExpoAvPlayer fails
    if (useExpoAv === 'expoav') {
      console.log('[PLAYER] 🔄 Falling back to WebViewVideoPlayer');
      setUseExpoAv('webview');
    }
  };

  // Handle AniList progress save (wrapped in useCallback to avoid re-renders)
  const handleSaveToAniList = useCallback(async (episodeData: {
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
  }, [playerSettings.saveToAniList, anilistUser]);

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
    
    // Listen for AniList progress save requests from the player
    const progressListener = DeviceEventEmitter.addListener('saveAniListProgress', handleSaveToAniList);
    
    return () => {
      progressListener.remove();
    };
  }, [handleSaveToAniList]);

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

  // Navigate back with optional refresh
  const navigateBack = useCallback((shouldRefresh: boolean = false) => {
    console.log('[PLAYER] 🔙 Navigating back', { shouldRefresh, animeId: params.anilistId });
    
    if (params.anilistId) {
      router.replace({
        pathname: `/anime/[id]`,
        params: { 
          id: params.anilistId as string,
          tab: 'watch',
          refresh: shouldRefresh ? '1' : '0'
        }
      });
    } else {
      router.back();
    }
  }, [params.anilistId, router]);

  // Handle exit with save prompt
  const handleExitRequest = useCallback(() => {
    console.log('[PLAYER] 🚪 Exit requested', { hasAnilistUser: !!anilistUser, saveToAniList: playerSettings.saveToAniList });
    
    // If guest user or saving disabled, exit immediately
    if (!anilistUser || !playerSettings.saveToAniList) {
      console.log('[PLAYER] 🚪 Guest user or save disabled, exiting immediately');
      navigateBack(false);
      return;
    }

    // Show save prompt for AniList users
    console.log('[PLAYER] 💾 Showing save prompt');
    pendingExit.current = true;
    setShowExitModal(true);
  }, [anilistUser, playerSettings.saveToAniList, navigateBack]);

  // Handle save and exit
  const handleSaveAndExit = useCallback(async () => {
    if (!anilistUser || !params.anilistId || !params.episodeNumber) {
      console.warn('[PLAYER] ⚠️ Cannot save: missing required data');
      navigateBack(false);
      return;
    }

    setIsSaving(true);
    try {
      const episodeData = {
        anilistId: params.anilistId as string,
        episodeNumber: parseInt(params.episodeNumber as string),
        currentTime: currentPlaybackPosition.current,
        duration: videoDuration.current
      };

      console.log('[PLAYER] 💾 Saving progress before exit...', episodeData);
      const success = await handleSaveToAniList(episodeData);
      
      if (success) {
        console.log('[PLAYER] ✅ Progress saved successfully');
      }

      setShowExitModal(false);
      navigateBack(true);
    } catch (error) {
      console.error('[PLAYER] ❌ Error saving progress:', error);
      // Still navigate back even if save fails
      setShowExitModal(false);
      navigateBack(false);
    } finally {
      setIsSaving(false);
    }
  }, [anilistUser, params, handleSaveToAniList, navigateBack]);

  // Handle exit without saving
  const handleExitWithoutSaving = useCallback(() => {
    console.log('[PLAYER] 🚪 Exiting without saving');
    setShowExitModal(false);
    navigateBack(true); // Still refresh to show any cached progress
  }, [navigateBack]);

  // Handle cancel exit
  const handleCancelExit = useCallback(() => {
    console.log('[PLAYER] ❌ Exit cancelled');
    setShowExitModal(false);
    pendingExit.current = false;
  }, []);

  // Listen for back button / exit requests
  useEffect(() => {
    const exitListener = DeviceEventEmitter.addListener('requestPlayerExit', handleExitRequest);
    
    return () => {
      exitListener.remove();
    };
  }, [handleExitRequest]);

  // Log PiP support status
  useEffect(() => {
    console.log('[PLAYER] 📱 PiP support status:', {
      supported: isPipSupported,
      enabled: playerSettings.pipEnabled,
      inPipMode: isInPipMode
    });
  }, [isPipSupported, playerSettings.pipEnabled, isInPipMode]);

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
  }, [playerSettings.forceLandscape, isInPipMode]); // Re-run if orientation policy changes

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
  console.log('[PLAYER] 🎬 Using player:', useExpoAv === 'expoav' ? 'ExpoAvPlayer' : 'WebViewVideoPlayer');

  // Format time helper
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <View style={[styles.container, { backgroundColor: isDarkMode ? '#000' : '#fff' }]}>
      <StatusBar hidden={true} />
      {useExpoAv === 'expoav' ? (
        <ExpoAvPlayer 
          onError={handlePlayerError}
          isPipSupported={isPipSupported}
          isInPipMode={isInPipMode}
        />
      ) : (
        <WebViewVideoPlayer 
          onTimeUpdate={handleTimeUpdate}
          isPipSupported={isPipSupported}
          isInPipMode={isInPipMode}
        />
      )}
      
      {/* Subtitle Overlay */}
      <SubtitleOverlay
        isVisible={useExpoAv !== 'expoav'} // Only show for WebView player
        currentTime={currentTime}
        videoData={videoData}
        selectedSubtitle={selectedSubtitle}
        subtitleSize={subtitleSize}
        subtitleOpacity={subtitleOpacity}
        subtitlePosition={subtitlePosition}
        subtitlesEnabled={subtitlesEnabled}
      />

      {/* Exit Save Modal */}
      <Modal
        visible={showExitModal}
        transparent
        animationType="fade"
        onRequestClose={handleCancelExit}
      >
        <View style={exitModalStyles.overlay}>
          <View style={[exitModalStyles.modalBox, { backgroundColor: isDarkMode ? '#1C1C1E' : '#FFFFFF' }]}>
            <Text style={[exitModalStyles.title, { color: isDarkMode ? '#FFFFFF' : '#000000' }]}>
              Save Progress?
            </Text>
            <Text style={[exitModalStyles.message, { color: isDarkMode ? '#EBEBF5' : '#3C3C43' }]}>
              Save Episode {params.episodeNumber || '?'} at {formatTime(currentPlaybackPosition.current)}?
            </Text>
            
            {isSaving ? (
              <View style={exitModalStyles.savingContainer}>
                <ActivityIndicator size="small" color="#02A9FF" />
                <Text style={[exitModalStyles.savingText, { color: isDarkMode ? '#EBEBF5' : '#3C3C43' }]}>
                  Saving to AniList...
                </Text>
              </View>
            ) : (
              <View style={exitModalStyles.buttons}>
                <TouchableOpacity
                  style={[exitModalStyles.button, exitModalStyles.saveButton]}
                  onPress={handleSaveAndExit}
                >
                  <Text style={exitModalStyles.saveButtonText}>Yes, Save</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[exitModalStyles.button, exitModalStyles.leaveButton]}
                  onPress={handleExitWithoutSaving}
                >
                  <Text style={exitModalStyles.leaveButtonText}>No, Leave</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[exitModalStyles.button, exitModalStyles.cancelButton]}
                  onPress={handleCancelExit}
                >
                  <Text style={[exitModalStyles.cancelButtonText, { color: isDarkMode ? '#FFFFFF' : '#000000' }]}>
                    Cancel
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>
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

const exitModalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalBox: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  buttons: {
    gap: 12,
  },
  button: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveButton: {
    backgroundColor: '#02A9FF',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  leaveButton: {
    backgroundColor: '#FF3B30',
  },
  leaveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    backgroundColor: 'rgba(120, 120, 128, 0.16)',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  savingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 20,
  },
  savingText: {
    fontSize: 16,
  },
});