import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Slider from '@react-native-community/slider';
import type { VideoPlayer } from 'expo-video';

interface VolumeSliderProps {
  volume: number;
  onVolumeChange: (volume: number) => void;
  videoPlayer: VideoPlayer | null;
}

const VolumeSlider: React.FC<VolumeSliderProps> = ({
  volume,
  onVolumeChange,
  videoPlayer
}) => {
  return (
    <View style={styles.volumeContainer}>
      <Slider
        style={styles.volumeSlider}
        minimumValue={0}
        maximumValue={1}
        value={volume}
        onValueChange={(value) => {
          onVolumeChange(value);
          if (videoPlayer) {
            videoPlayer.volume = value;
          }
        }}
        minimumTrackTintColor="#FF6B00"
        maximumTrackTintColor="#fff"
        thumbTintColor="#FF6B00"
      />
      <Text style={styles.volumeText}>{Math.round(volume * 100)}%</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  volumeContainer: {
    position: 'absolute',
    bottom: 70,
    right: 16,
    width: 36,
    height: 130,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 18,
    padding: 8,
    alignItems: 'center',
    zIndex: 10,
  },
  volumeSlider: {
    height: 90,
    width: 130,
    transform: [{ rotate: '-90deg' }],
  },
  volumeText: {
    color: '#fff',
    fontSize: 10,
    marginTop: 8,
  },
});

export default VolumeSlider; 