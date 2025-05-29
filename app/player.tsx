import { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, StatusBar } from 'react-native';
import * as ScreenOrientation from 'expo-screen-orientation';
import { PlayerProvider } from './videoplayer/PlayerContext';
import VideoPlayer from './videoplayer/PlayerScreen';
import { useTheme } from '../hooks/useTheme';

// Player component that forces landscape orientation
export default function Player() {
  const { isDarkMode } = useTheme();
  const isLocked = useRef(false);
  const lockTimeout = useRef<NodeJS.Timeout | null>(null);
  const [isReady, setIsReady] = useState(false);

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
        
        // Only force landscape if currently in portrait and we're still mounted
        if (currentOrientation === ScreenOrientation.Orientation.PORTRAIT_UP || 
            currentOrientation === ScreenOrientation.Orientation.PORTRAIT_DOWN) {
          console.log('[PLAYER] 🔄 Detected portrait orientation, forcing back to landscape');
          
          try {
            await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
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
      }
    };

    // Add listener after a short delay to ensure initial lock is complete
    setTimeout(addListener, 200);

    // Cleanup: unlock and return to portrait when unmounting
    return () => {
      isMounted = false;
      isLocked.current = false;
      
      // Clear any pending timeout
      if (lockTimeout.current) {
        clearTimeout(lockTimeout.current);
        lockTimeout.current = null;
      }

      // Remove the orientation change listener
      if (subscription) {
        ScreenOrientation.removeOrientationChangeListener(subscription);
      }
      
      const unlockAndRotate = async () => {
        try {
          console.log('[PLAYER] 🔄 Preparing to restore orientation...');
          
          // Force back to portrait with a cleaner transition
          await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
          
          // Show status bar after orientation change is complete
          setTimeout(() => {
            StatusBar.setHidden(false, 'fade');
            // Then unlock completely if the app needs to allow rotation elsewhere
            setTimeout(async () => {
              try {
                await ScreenOrientation.unlockAsync();
                console.log('[PLAYER] 🔄 Restored orientation');
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
    return (
      <View style={[styles.container, styles.loading, { backgroundColor: isDarkMode ? '#000' : '#fff' }]}>
        <StatusBar hidden={true} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: isDarkMode ? '#000' : '#fff' }]}>
      <StatusBar hidden={true} />
      <PlayerProvider>
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