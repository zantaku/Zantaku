import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import type { VideoPlayer } from 'expo-video';
import { formatTime } from '../utils';

interface DebugOverlayProps {
  videoPlayer: VideoPlayer | null;
  sourceUri: string;
  preferences: {
    preferredQuality: string;
    playbackRate: number;
    volume: number;
    subtitlesEnabled: boolean;
    debugOverlayEnabled: boolean;
  };
  playbackStats: {
    stallCount: number;
    recoveryAttempts: number;
  };
}

const DebugOverlay: React.FC<DebugOverlayProps> = ({
  videoPlayer,
  sourceUri,
  preferences,
  playbackStats,
}) => {
  // Don't render if debug overlay is disabled
  if (!preferences.debugOverlayEnabled) {
    return null;
  }

  // Get player status safely
  const currentTime = videoPlayer?.currentTime || 0;
  
  // Safely access status properties with type checking
  const duration = typeof videoPlayer?.status === 'object' && 
    videoPlayer?.status && 'duration' in videoPlayer.status ? 
    (videoPlayer.status as any).duration : 0;
    
  const buffered = typeof videoPlayer?.status === 'object' && 
    videoPlayer?.status && 'playableDuration' in videoPlayer.status ? 
    (videoPlayer.status as any).playableDuration : 0;

  return (
    <View style={styles.debugOverlay}>
      <Text style={styles.debugText}>
        {`Source: ${sourceUri.substring(0, 50)}...
Position: ${formatTime(currentTime)} / ${formatTime(duration)}
Buffer: ${formatTime(buffered)}
Quality: ${preferences.preferredQuality}
Speed: ${preferences.playbackRate}x
Volume: ${Math.round(preferences.volume * 100)}%
Subtitles: ${preferences.subtitlesEnabled ? 'On' : 'Off'}
Network: ${playbackStats.recoveryAttempts > 0 ? 'Unstable' : 'Stable'}
Stalls: ${playbackStats.stallCount}
Recoveries: ${playbackStats.recoveryAttempts}
Last Update: ${new Date().toISOString().substr(11, 8)}`}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  debugOverlay: {
    position: 'absolute',
    top: 80,
    left: 10,
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 8,
    borderRadius: 5,
    maxWidth: '60%',
    zIndex: 100,
  },
  debugText: {
    color: '#FFF',
    fontSize: 10,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
});

export default DebugOverlay; 