import { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, StatusBar, BackHandler, DeviceEventEmitter, Dimensions, Animated, TouchableOpacity, Text } from 'react-native';
import { PanGestureHandler, PinchGestureHandler, State } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import * as ScreenOrientation from 'expo-screen-orientation';
import { PlayerProvider } from './videoplayer/PlayerContext';
import VideoPlayer from './videoplayer/PlayerScreen';
import { useTheme } from '../hooks/useTheme';
import { useLocalSearchParams, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { STORAGE_KEY, ANILIST_GRAPHQL_ENDPOINT } from '../constants/auth';

// PiP types
interface PiPState {
  isActive: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  scale: number;
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// PiP constants
const PIP_CONSTANTS = {
  MIN_WIDTH: 150,
  MAX_WIDTH: 300,
  MIN_HEIGHT: 85,
  MAX_HEIGHT: 170,
  DEFAULT_WIDTH: 200,
  DEFAULT_HEIGHT: 113,
  MIN_SCALE: 0.8,
  MAX_SCALE: 1.5,
  EDGE_PADDING: 20,
};

// Player component that forces landscape orientation
export default function Player() {
  const { isDarkMode } = useTheme();
  const isLocked = useRef(false);
  const lockTimeout = useRef<NodeJS.Timeout | null>(null);
  const [isReady, setIsReady] = useState(false);
  const params = useLocalSearchParams();
  const router = useRouter();
  
  // PiP state
  const [pipState, setPipState] = useState<PiPState>({
    isActive: false,
    x: SCREEN_WIDTH - PIP_CONSTANTS.DEFAULT_WIDTH - PIP_CONSTANTS.EDGE_PADDING,
    y: 100,
    width: PIP_CONSTANTS.DEFAULT_WIDTH,
    height: PIP_CONSTANTS.DEFAULT_HEIGHT,
    scale: 1,
  });
  
  // Animation values for PiP
  const pipAnimation = useRef(new Animated.ValueXY({ x: pipState.x, y: pipState.y })).current;
  const pipScale = useRef(new Animated.Value(1)).current;
  const pipOpacity = useRef(new Animated.Value(1)).current;
  
  // Gesture refs for PiP
  const panRef = useRef<PanGestureHandler>(null);
  const pinchRef = useRef<PinchGestureHandler>(null);
  
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

  // PiP Functions
  const enterPiP = () => {
    console.log('[PLAYER] 📱 Entering Picture-in-Picture mode');
    
    // Update PiP state
    setPipState(prev => ({
      ...prev,
      isActive: true,
    }));
    
    // Animate to PiP mode
    Animated.parallel([
      Animated.timing(pipOpacity, {
        toValue: 0.9,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.spring(pipScale, {
        toValue: 1,
        useNativeDriver: true,
      }),
    ]).start();
    
    // Force portrait mode for PiP
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
    StatusBar.setHidden(false, 'fade');
  };

  const exitPiP = () => {
    console.log('[PLAYER] 📱 Exiting Picture-in-Picture mode');
    
    // Update PiP state
    setPipState(prev => ({
      ...prev,
      isActive: false,
    }));
    
    // Animate back to fullscreen
    Animated.parallel([
      Animated.timing(pipOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.spring(pipScale, {
        toValue: 1,
        useNativeDriver: true,
      }),
    ]).start();
    
    // Return to landscape mode
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
    StatusBar.setHidden(true, 'fade');
  };

  const onPanGestureEvent = Animated.event(
    [{ nativeEvent: { translationX: pipAnimation.x, translationY: pipAnimation.y } }],
    { useNativeDriver: false }
  );

  const onPanHandlerStateChange = (event: any) => {
    if (event.nativeEvent.state === State.END) {
      const { translationX, translationY } = event.nativeEvent;
      
      // Calculate new position
      let newX = pipState.x + translationX;
      let newY = pipState.y + translationY;
      
      // Keep within screen bounds
      newX = Math.max(PIP_CONSTANTS.EDGE_PADDING, Math.min(newX, SCREEN_WIDTH - pipState.width - PIP_CONSTANTS.EDGE_PADDING));
      newY = Math.max(PIP_CONSTANTS.EDGE_PADDING, Math.min(newY, SCREEN_HEIGHT - pipState.height - PIP_CONSTANTS.EDGE_PADDING));
      
      // Snap to edges for better UX
      if (newX < SCREEN_WIDTH / 2) {
        newX = PIP_CONSTANTS.EDGE_PADDING; // Snap to left
      } else {
        newX = SCREEN_WIDTH - pipState.width - PIP_CONSTANTS.EDGE_PADDING; // Snap to right
      }
      
      // Update state
      setPipState(prev => ({ ...prev, x: newX, y: newY }));
      
      // Animate to final position
      Animated.spring(pipAnimation, {
        toValue: { x: newX, y: newY },
        useNativeDriver: false,
      }).start();
    }
  };

  const onPinchGestureEvent = Animated.event(
    [{ nativeEvent: { scale: pipScale } }],
    { useNativeDriver: true }
  );

  const onPinchHandlerStateChange = (event: any) => {
    if (event.nativeEvent.state === State.END) {
      const scale = Math.max(PIP_CONSTANTS.MIN_SCALE, Math.min(event.nativeEvent.scale, PIP_CONSTANTS.MAX_SCALE));
      
      setPipState(prev => ({ ...prev, scale }));
      
      Animated.spring(pipScale, {
        toValue: scale,
        useNativeDriver: true,
      }).start();
    }
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

    // PiP Component
  const renderPiPPlayer = () => {
    if (!pipState.isActive) return null;

    return (
      <PanGestureHandler
        ref={panRef}
        onGestureEvent={onPanGestureEvent}
        onHandlerStateChange={onPanHandlerStateChange}
        simultaneousHandlers={pinchRef}
      >
        <Animated.View style={[
          styles.pipContainer,
          {
            position: 'absolute',
            left: pipAnimation.x,
            top: pipAnimation.y,
            width: pipState.width,
            height: pipState.height,
            transform: [{ scale: pipScale }],
            opacity: pipOpacity,
            zIndex: 1000,
          }
        ]}>
          {/* PiP Controls Header */}
          <View style={styles.pipHeader}>
            <TouchableOpacity
              style={styles.pipExpandButton}
              onPress={exitPiP}
              accessibilityLabel="Expand to fullscreen"
            >
              <Ionicons name="expand-outline" size={16} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.pipCloseButton}
              onPress={() => {
                console.log('[PLAYER] 📱 Closing PiP mode');
                // For now, just exit PiP. In a real app, you might pause or navigate away
                exitPiP();
              }}
              accessibilityLabel="Close PiP"
            >
              <Ionicons name="close" size={16} color="#fff" />
            </TouchableOpacity>
          </View>

          <PinchGestureHandler
            ref={pinchRef}
            onGestureEvent={onPinchGestureEvent}
            onHandlerStateChange={onPinchHandlerStateChange}
            simultaneousHandlers={panRef}
          >
            <Animated.View style={styles.pipVideoContainer}>
              <PlayerProvider 
                anilistUser={anilistUser}
                onSaveToAniList={handleSaveToAniList}
                onEnterPiP={enterPiP}
                onExitPiP={exitPiP}
              >
                <VideoPlayer />
              </PlayerProvider>
            </Animated.View>
          </PinchGestureHandler>
        </Animated.View>
      </PanGestureHandler>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: isDarkMode ? '#000' : '#fff' }]}>
      <StatusBar hidden={!pipState.isActive} />
      
             {/* Fullscreen Player */}
       {!pipState.isActive ? (
         <PlayerProvider 
           anilistUser={anilistUser}
           onSaveToAniList={handleSaveToAniList}
           onEnterPiP={enterPiP}
           onExitPiP={exitPiP}
         >
           <VideoPlayer />
         </PlayerProvider>
       ) : (
        // Background overlay when in PiP mode
        <View style={[styles.pipBackground, { backgroundColor: isDarkMode ? '#000' : '#fff' }]} />
      )}
      
      {/* PiP Player */}
      {renderPiPPlayer()}
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
  pipContainer: {
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    backgroundColor: '#000',
  },
  pipVideoContainer: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  pipBackground: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pipHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 32,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    zIndex: 1001,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  pipExpandButton: {
    padding: 6,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  pipCloseButton: {
    padding: 6,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
});