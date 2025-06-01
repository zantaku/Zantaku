import React, { memo } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet, Dimensions, Animated } from 'react-native';
import { Image } from 'expo-image';
import { FontAwesome5 } from '@expo/vector-icons';
import Reanimated, { 
  useAnimatedStyle, 
  useAnimatedGestureHandler,
  withSpring
} from 'react-native-reanimated';
import { PanGestureHandler } from 'react-native-gesture-handler';

const WINDOW_WIDTH = Dimensions.get('window').width;

interface WebtoonImageProps {
  imageUrl: string;
  index: number;
  imageHeaders: { [key: string]: string };
  onPress: () => void;
  onLoadStart: () => void;
  onLoadSuccess: (width: number, height: number) => void;
  onLoadError: (error: any) => void;
  isLoading: boolean;
  hasError: boolean;
  onRetry: () => void;
  height: number | null;
  shouldLoad?: boolean; // New prop for progressive loading
  isZoomed?: boolean; // New prop for zoom state
  zoomAnimatedValue?: Animated.Value; // New prop for zoom animation
  translateX?: Reanimated.SharedValue<number>; // New prop for pan gesture
  translateY?: Reanimated.SharedValue<number>; // New prop for pan gesture
}

const WebtoonImage = memo(({
  imageUrl,
  index,
  imageHeaders,
  onPress,
  onLoadStart,
  onLoadSuccess,
  onLoadError,
  isLoading,
  hasError,
  onRetry,
  height,
  shouldLoad = true,
  isZoomed = false,
  zoomAnimatedValue,
  translateX,
  translateY,
}: WebtoonImageProps) => {
  const containerHeight = height || 400; // fallback height

  // Pan gesture handler for dragging when zoomed
  const panGestureHandler = useAnimatedGestureHandler({
    onStart: (_, context: any) => {
      if (translateX && translateY) {
        context.startX = translateX.value;
        context.startY = translateY.value;
      }
    },
    onActive: (event, context: any) => {
      if (isZoomed && translateX && translateY) {
        // Calculate boundaries to prevent dragging too far
        const maxTranslateX = WINDOW_WIDTH * 0.5; // Half screen width
        const maxTranslateY = containerHeight * 0.5; // Half image height
        
        const newX = context.startX + event.translationX;
        const newY = context.startY + event.translationY;
        
        // Clamp values to boundaries
        translateX.value = Math.max(-maxTranslateX, Math.min(maxTranslateX, newX));
        translateY.value = Math.max(-maxTranslateY, Math.min(maxTranslateY, newY));
      }
    },
    onEnd: () => {
      // Optional: Add spring back to center if dragged too far
    },
  });

  // Animated style for pan gestures
  const animatedStyle = useAnimatedStyle(() => {
    if (!isZoomed || !translateX || !translateY) {
      return {};
    }
    
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
      ],
    };
  });

  return (
    <View style={[styles.container, { height: containerHeight }]}>
      <TouchableOpacity 
        activeOpacity={1} 
        onPress={onPress}
        style={[styles.touchable, { height: containerHeight }]}
        disabled={isZoomed} // Disable touch when zoomed to allow pan gestures
      >
        {!hasError && shouldLoad && (
          <PanGestureHandler
            onGestureEvent={panGestureHandler}
            enabled={isZoomed}
          >
            <Animated.View
              style={[
                styles.image,
                { height: containerHeight },
                zoomAnimatedValue && {
                  transform: [{ scale: zoomAnimatedValue }]
                },
              ]}
            >
              <Reanimated.View style={animatedStyle}>
              <TouchableOpacity
                activeOpacity={1}
                onPress={onPress}
                style={[styles.image, { height: containerHeight }]}
                disabled={!isZoomed} // Only allow tap when zoomed (for zoom out)
              >
                <Image
                  source={{ uri: imageUrl, headers: imageHeaders }}
                  style={[styles.image, { height: containerHeight }]}
                  contentFit="contain"
                  onLoadStart={onLoadStart}
                  onLoad={(e) => {
                    const { width, height } = e.source;
                    onLoadSuccess(width, height);
                  }}
                  onError={onLoadError}
                  cachePolicy="memory-disk"
                  priority={index < 5 ? "high" : "normal"}
                  recyclingKey={`webtoon-${index}-${imageUrl}`}
                />
              </TouchableOpacity>
              </Reanimated.View>
            </Animated.View>
          </PanGestureHandler>
        )}
        
        {!shouldLoad && !hasError && (
          <View style={styles.placeholderContainer}>
            <Text style={styles.placeholderText}>Page {index + 1}</Text>
            <Text style={styles.placeholderSubtext}>Scroll to load</Text>
          </View>
        )}
        
        {isLoading && shouldLoad && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#02A9FF" />
            <Text style={styles.loadingText}>Loading page {index + 1}...</Text>
          </View>
        )}
        
        {hasError && (
          <View style={styles.errorContainer}>
            <FontAwesome5 name="exclamation-circle" size={40} color="#ff4444" />
            <Text style={styles.errorText}>Failed to load page {index + 1}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={onRetry}>
              <FontAwesome5 name="redo" size={16} color="#fff" />
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}
      </TouchableOpacity>
    </View>
  );
}, (prevProps, nextProps) => {
  // Custom comparison function to prevent unnecessary re-renders
  return (
    prevProps.imageUrl === nextProps.imageUrl &&
    prevProps.index === nextProps.index &&
    prevProps.isLoading === nextProps.isLoading &&
    prevProps.hasError === nextProps.hasError &&
    prevProps.height === nextProps.height &&
    prevProps.isZoomed === nextProps.isZoomed &&
    prevProps.shouldLoad === nextProps.shouldLoad
  );
});

const styles = StyleSheet.create({
  container: {
    width: WINDOW_WIDTH,
    backgroundColor: '#000',
  },
  touchable: {
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: WINDOW_WIDTH,
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  loadingText: {
    color: '#fff',
    fontSize: 16,
    marginTop: 12,
    opacity: 0.8,
  },
  errorContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
    padding: 20,
  },
  errorText: {
    color: '#fff',
    fontSize: 16,
    marginTop: 16,
    marginBottom: 20,
    textAlign: 'center',
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#02A9FF',
    borderRadius: 8,
    gap: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  placeholderContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#111',
  },
  placeholderText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '500',
  },
  placeholderSubtext: {
    color: '#666',
    fontSize: 12,
    marginTop: 4,
    opacity: 0.8,
  },
});

export default WebtoonImage; 