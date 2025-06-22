import React, { useCallback, useRef } from 'react';
import { View, StyleSheet, Alert, Platform } from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useEvent } from 'expo';

interface SystemPiPVideoProps {
  source: string;
  headers?: Record<string, string>;
  onPiPStart?: () => void;
  onPiPStop?: () => void;
  style?: any;
}

const SystemPiPVideo: React.FC<SystemPiPVideoProps> = ({
  source,
  headers,
  onPiPStart,
  onPiPStop,
  style
}) => {
  const videoRef = useRef<any>(null);

  // Create video player with the source
  const player = useVideoPlayer(
    {
      uri: source,
      headers: headers || {}
    },
    (player) => {
      player.loop = false;
      player.play();
    }
  );

  // Listen to player events
  const { status } = useEvent(player, 'statusChange', { status: player.status });

  // Handle PiP start
  const handlePiPStart = useCallback(() => {
    console.log('[SYSTEM PiP] 📱 Entered native Picture-in-Picture mode');
    onPiPStart?.();
  }, [onPiPStart]);

  // Handle PiP stop
  const handlePiPStop = useCallback(() => {
    console.log('[SYSTEM PiP] 📱 Exited native Picture-in-Picture mode');
    onPiPStop?.();
  }, [onPiPStop]);

  // Enter system PiP mode
  const enterSystemPiP = useCallback(async () => {
    try {
      if (videoRef.current) {
        console.log('[SYSTEM PiP] 🚀 Attempting to enter native PiP mode...');
        await videoRef.current.startPictureInPicture();
        console.log('[SYSTEM PiP] ✅ Successfully entered native PiP mode');
      }
    } catch (error) {
      console.error('[SYSTEM PiP] ❌ Failed to enter PiP mode:', error);
      
      if (Platform.OS === 'android') {
        Alert.alert(
          'PiP Not Available',
          'Picture-in-Picture is not supported on this device or is disabled in settings.',
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert(
          'PiP Not Available',
          'Picture-in-Picture is not available for this video format.',
          [{ text: 'OK' }]
        );
      }
    }
  }, []);

  // Exit system PiP mode
  const exitSystemPiP = useCallback(async () => {
    try {
      if (videoRef.current) {
        console.log('[SYSTEM PiP] 🔄 Exiting native PiP mode...');
        await videoRef.current.stopPictureInPicture();
        console.log('[SYSTEM PiP] ✅ Successfully exited native PiP mode');
      }
    } catch (error) {
      console.error('[SYSTEM PiP] ❌ Failed to exit PiP mode:', error);
    }
  }, []);

  return (
    <View style={[styles.container, style]}>
      <VideoView
        ref={videoRef}
        style={styles.video}
        player={player}
        allowsFullscreen={true}
        allowsPictureInPicture={true}
        startsPictureInPictureAutomatically={false}
        nativeControls={true}
        onPictureInPictureStart={handlePiPStart}
        onPictureInPictureStop={handlePiPStop}
      />
    </View>
  );
};

// Export the component and helper functions
export default SystemPiPVideo;

export const useSystemPiP = () => {
  const videoRef = useRef<any>(null);

  const enterPiP = useCallback(async () => {
    try {
      if (videoRef.current) {
        await videoRef.current.startPictureInPicture();
        return true;
      }
      return false;
    } catch (error) {
      console.error('[SYSTEM PiP] ❌ Error entering PiP:', error);
      return false;
    }
  }, []);

  const exitPiP = useCallback(async () => {
    try {
      if (videoRef.current) {
        await videoRef.current.stopPictureInPicture();
        return true;
      }
      return false;
    } catch (error) {
      console.error('[SYSTEM PiP] ❌ Error exiting PiP:', error);
      return false;
    }
  }, []);

  return { videoRef, enterPiP, exitPiP };
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  video: {
    flex: 1,
  },
}); 