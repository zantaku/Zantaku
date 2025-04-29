// This file has been moved to the videoplayer folder
// Import from the new location to maintain compatibility
import { useEffect } from 'react';
import { View, StyleSheet, StatusBar } from 'react-native';
import * as ScreenOrientation from 'expo-screen-orientation';
import { PlayerProvider } from './videoplayer/PlayerContext';
// Using dynamic import to avoid TypeScript issues
const VideoPlayer = require('./videoplayer/PlayerScreen').default;

// Player component that forces landscape orientation
export default function Player() {
  // Force landscape mode immediately and maintain it
  useEffect(() => {
    const lockToLandscape = async () => {
      try {
        console.log('[PLAYER] 🔒 Preparing to switch to landscape mode...');
        
        // Hide status bar immediately before orientation change to reduce visual artifacts
        StatusBar.setHidden(true, 'fade');
        
        // Use a smoother transition by directly going to LANDSCAPE instead of LANDSCAPE_RIGHT first
        await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
        
        console.log('[PLAYER] ✅ Locked to landscape mode');
      } catch (error) {
        console.error('[PLAYER] ❌ Failed to lock orientation:', error);
      }
    };

    // Execute immediately
    lockToLandscape();

    // Prevent auto-rotation by adding an orientation change listener that forces landscape
    const subscription = ScreenOrientation.addOrientationChangeListener(async (event) => {
      const currentOrientation = event.orientationInfo.orientation;
      
      // If device somehow rotates to portrait, force it back to landscape
      if (currentOrientation === ScreenOrientation.Orientation.PORTRAIT_UP || 
          currentOrientation === ScreenOrientation.Orientation.PORTRAIT_DOWN) {
        console.log('[PLAYER] 🔄 Detected portrait orientation, forcing back to landscape');
        await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
      }
    });

    // Cleanup: unlock and return to portrait when unmounting
    return () => {
      // Remove the orientation change listener
      ScreenOrientation.removeOrientationChangeListener(subscription);
      
      const unlockAndRotate = async () => {
        try {
          console.log('[PLAYER] 🔄 Preparing to restore orientation...');
          
          // Force back to portrait with a cleaner transition
          await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
          
          // Show status bar after orientation change is complete
          setTimeout(() => {
            StatusBar.setHidden(false, 'fade');
            // Then unlock completely if the app needs to allow rotation elsewhere
            setTimeout(() => {
              ScreenOrientation.unlockAsync()
                .then(() => console.log('[PLAYER] 🔄 Restored orientation'))
                .catch(err => console.error('[PLAYER] ❌ Error unlocking orientation:', err));
            }, 100); // Small delay to ensure the portrait lock has taken effect
          }, 400); // Slightly longer delay for smoother transition
        } catch (error) {
          console.error('[PLAYER] ❌ Failed to restore orientation:', error);
          // Fallback attempt if the first try fails
          setTimeout(() => {
            ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP)
              .then(() => StatusBar.setHidden(false, 'fade'))
              .then(() => ScreenOrientation.unlockAsync())
              .then(() => console.log('[PLAYER] ✅ Fallback orientation restore successful'))
              .catch(err => console.error('[PLAYER] ❌ Critical orientation error:', err));
          }, 500);
        }
      };
      unlockAndRotate();
    };
  }, []);

  return (
    <View style={styles.container}>
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
    backgroundColor: '#000',
  },
});

