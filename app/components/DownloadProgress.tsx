import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { DownloadProgress, subscribeToDownloadProgress } from '../../api/proxy/nativeProxy';

interface DownloadProgressBarProps {
  hideWhenComplete?: boolean;
}

/**
 * Component to display the progress of video segment downloads
 */
export const DownloadProgressBar: React.FC<DownloadProgressBarProps> = ({
  hideWhenComplete = true
}) => {
  const [progress, setProgress] = useState<DownloadProgress>({
    total: 0,
    completed: 0,
    inProgress: 0,
    percentage: 0
  });
  
  const [visible, setVisible] = useState(false);
  const progressAnim = useState(new Animated.Value(0))[0];
  
  useEffect(() => {
    // Subscribe to download progress updates
    const unsubscribe = subscribeToDownloadProgress((newProgress) => {
      setProgress(newProgress);
      
      // Animate progress
      Animated.timing(progressAnim, {
        toValue: newProgress.percentage / 100,
        duration: 300,
        useNativeDriver: false,
      }).start();
      
      // Show component when downloading starts
      if (newProgress.total > 0 && newProgress.percentage < 100) {
        setVisible(true);
      }
      
      // Hide when complete if hideWhenComplete is true
      if (hideWhenComplete && newProgress.percentage >= 100) {
        // Add a small delay before hiding to show 100%
        setTimeout(() => {
          setVisible(false);
        }, 1500);
      }
    });
    
    return unsubscribe;
  }, [hideWhenComplete, progressAnim]);
  
  // Don't render if nothing to show or should be hidden
  if (!visible || progress.total === 0) {
    return null;
  }
  
  return (
    <View style={styles.container}>
      <View style={styles.progressContainer}>
        <Animated.View 
          style={[
            styles.progressFill, 
            { width: progressAnim.interpolate({
              inputRange: [0, 1],
              outputRange: ['0%', '100%'],
            }) }
          ]} 
        />
        <Text style={styles.progressText}>
          {progress.percentage}%
        </Text>
      </View>
      
      <View style={styles.textContainer}>
        <Text style={styles.statusText}>
          Buffering video...
        </Text>
        <Text style={styles.detailText}>
          {progress.completed}/{progress.total} segments
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 80,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 12,
    padding: 10,
    width: 200,
    zIndex: 1000,
  },
  progressContainer: {
    height: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: 5,
    position: 'relative',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#00e0ff',
    position: 'absolute',
    left: 0,
    top: 0,
  },
  progressText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
    position: 'absolute',
    textAlign: 'center',
    width: '100%',
    height: '100%',
    textAlignVertical: 'center',
  },
  textContainer: {
    marginTop: 5,
  },
  statusText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  detailText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 12,
  }
});

export default DownloadProgressBar; 