import { useEffect, useState, useCallback } from 'react';
import { NativeModules, NativeEventEmitter, Platform } from 'react-native';

const { PictureInPictureModule } = NativeModules;

interface PictureInPictureHook {
  /**
   * Whether PiP is supported on the device
   */
  isSupported: boolean;
  
  /**
   * Whether the app is currently in PiP mode
   */
  isInPipMode: boolean;
  
  /**
   * Enter Picture-in-Picture mode
   * @param aspectRatio Optional aspect ratio object with width and height
   * @returns Promise that resolves to true if successful
   */
  enterPipMode: (aspectRatio?: { width: number; height: number }) => Promise<boolean>;
  
  /**
   * Check if PiP mode is currently active
   * @returns Promise that resolves to true if in PiP mode
   */
  checkPipStatus: () => Promise<boolean>;
}

/**
 * Hook for managing Picture-in-Picture mode
 * 
 * @example
 * ```tsx
 * const { isSupported, isInPipMode, enterPipMode } = usePictureInPicture();
 * 
 * // Enter PiP with 16:9 aspect ratio
 * await enterPipMode({ width: 16, height: 9 });
 * ```
 */
export function usePictureInPicture(): PictureInPictureHook {
  const [isSupported, setIsSupported] = useState(false);
  const [isInPipMode, setIsInPipMode] = useState(false);

  // Check if PiP is supported on device mount
  useEffect(() => {
    const checkSupport = async () => {
      try {
        if (Platform.OS === 'android') {
          // Only use custom native module (dev builds with PictureInPictureModule)
          if (PictureInPictureModule) {
            console.log('[PiP] ✅ Using custom PictureInPictureModule (dev build)');
            const supported = await PictureInPictureModule.isPipSupported();
            setIsSupported(supported);
            
            // Also check initial PiP status
            const pipActive = await PictureInPictureModule.isPipActive();
            setIsInPipMode(pipActive);
          } else {
            // In Expo Go: PiP is NOT supported for WebView players
            // expo-av's Video component has automatic PiP, but WebView doesn't
            console.log('[PiP] ⚠️ PiP not available in Expo Go for WebView players');
            console.log('[PiP] 💡 To use PiP: Build a dev build or use ExpoAvPlayer');
            setIsSupported(false);
          }
        } else {
          setIsSupported(false);
        }
      } catch (error) {
        console.error('[PiP] Failed to check PiP support:', error);
        setIsSupported(false);
      }
    };

    checkSupport();
  }, []);

  // Listen for PiP mode changes
  useEffect(() => {
    if (!PictureInPictureModule) return;

    const eventEmitter = new NativeEventEmitter(PictureInPictureModule);
    const subscription = eventEmitter.addListener(
      'onPictureInPictureModeChanged',
      (event: { isInPictureInPictureMode: boolean }) => {
        console.log('[PiP] Mode changed:', event.isInPictureInPictureMode);
        setIsInPipMode(event.isInPictureInPictureMode);
      }
    );

    return () => {
      subscription.remove();
    };
  }, []);

  /**
   * Enter Picture-in-Picture mode
   */
  const enterPipMode = useCallback(
    async (aspectRatio: { width: number; height: number } = { width: 16, height: 9 }) => {
      try {
        if (!isSupported) {
          console.warn('[PiP] ⚠️ Picture-in-Picture is not supported');
          console.log('[PiP] 💡 Options to enable PiP:');
          console.log('[PiP]   1. Build a dev build with: npx expo run:android');
          console.log('[PiP]   2. Or use ExpoAvPlayer (but lose audio track switching)');
          return false;
        }

        if (!PictureInPictureModule) {
          console.error('[PiP] ❌ PictureInPictureModule is not available (Expo Go)');
          return false;
        }

        console.log('[PiP] Entering PiP mode with aspect ratio:', aspectRatio);
        const result = await PictureInPictureModule.enterPictureInPicture(
          aspectRatio.width,
          aspectRatio.height
        );
        
        if (result) {
          console.log('[PiP] ✅ Successfully entered PiP mode');
        }
        
        return result;
      } catch (error) {
        console.error('[PiP] ❌ Failed to enter PiP mode:', error);
        return false;
      }
    },
    [isSupported]
  );

  /**
   * Check current PiP status
   */
  const checkPipStatus = useCallback(async () => {
    try {
      if (!PictureInPictureModule) {
        return false;
      }

      const pipActive = await PictureInPictureModule.isPipActive();
      setIsInPipMode(pipActive);
      return pipActive;
    } catch (error) {
      console.error('[PiP] Failed to check PiP status:', error);
      return false;
    }
  }, []);

  return {
    isSupported,
    isInPipMode,
    enterPipMode,
    checkPipStatus,
  };
}

export default usePictureInPicture;
