import React from 'react';
import { View, Image, Text, StyleSheet, Dimensions } from 'react-native';
import { PLAYER_COLORS, TIMELINE_PREVIEW } from '../constants';

interface TimelinePreviewProps {
  currentTime: number;
  duration: number;
  sliderWidth: number;
  previewImages?: string[];
  previewInterval?: number;
  visible: boolean;
  position: number; // Position of the thumb on the slider (0-1)
}

const DEFAULT_PREVIEW_INTERVAL = 10; // Default interval between preview images in seconds

const TimelinePreview = ({
  currentTime,
  duration,
  sliderWidth,
  previewImages = [],
  previewInterval = DEFAULT_PREVIEW_INTERVAL,
  visible,
  position
}: TimelinePreviewProps) => {
  if (!visible || previewImages.length === 0) return null;
  
  // Calculate the preview position horizontally
  const screenWidth = Dimensions.get('window').width;
  const previewWidth = TIMELINE_PREVIEW.WIDTH; // Width of the preview container
  
  // Calculate the horizontal position to keep preview within screen bounds
  let previewLeft = (position * sliderWidth) - (previewWidth / 2);
  
  // Prevent the preview from going off-screen
  const minLeft = 20;
  const maxLeft = screenWidth - previewWidth - 20;
  previewLeft = Math.max(minLeft, Math.min(previewLeft, maxLeft));
  
  // Find the appropriate preview image based on currentTime
  const imageIndex = Math.min(
    Math.floor(currentTime / previewInterval),
    previewImages.length - 1
  );
  
  // Format time for display
  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hrs > 0) {
      return `${hrs}:${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
    }
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };
  
  return (
    <View style={[styles.container, { left: previewLeft }]}>
      <View style={styles.previewCard}>
        <Image 
          source={{ uri: previewImages[imageIndex] || previewImages[0] }}
          style={styles.previewImage}
          resizeMode="cover"
        />
        <View style={styles.timeContainer}>
          <Text style={styles.timeText}>{formatTime(currentTime)}</Text>
        </View>
      </View>
      <View style={styles.triangleDown} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 70,
    alignItems: 'center',
    zIndex: 1000,
  },
  previewCard: {
    width: TIMELINE_PREVIEW.WIDTH,
    height: TIMELINE_PREVIEW.HEIGHT,
    backgroundColor: '#000',
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: TIMELINE_PREVIEW.BORDER_WIDTH,
    borderColor: PLAYER_COLORS.PRIMARY,
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  timeContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingVertical: 2,
    alignItems: 'center',
  },
  timeText: {
    color: PLAYER_COLORS.TEXT_LIGHT,
    fontSize: 12,
    fontWeight: 'bold',
  },
  triangleDown: {
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderTopWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: PLAYER_COLORS.PRIMARY,
    transform: [{ translateY: -1 }],
  },
});

export default TimelinePreview; 