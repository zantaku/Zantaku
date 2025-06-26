import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet, Dimensions } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { FontAwesome5 } from '@expo/vector-icons';
import { InteractionManager } from 'react-native';
import { 
  PERFORMANCE_CONFIG, 
  MemoryManager, 
  detectDeviceCapabilities 
} from '../utils/performanceOptimization';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const deviceCapabilities = detectDeviceCapabilities();

interface OptimizedImageProps {
  uri: string;
  width?: number;
  height?: number;
  style?: any;
  placeholder?: string;
  fallbackUri?: string;
  index?: number;
  isVisible?: boolean; // For lazy loading
  onLoad?: () => void;
  onError?: () => void;
  resizeMode?: 'cover' | 'contain' | 'fill' | 'scale-down' | 'none';
  cachePolicy?: 'memory' | 'disk' | 'memory-disk' | 'none';
  priority?: 'low' | 'normal' | 'high';
  reduceMemoryUsage?: boolean;
}

const OptimizedImage: React.FC<OptimizedImageProps> = React.memo(({
  uri,
  width = SCREEN_WIDTH,
  height = 200,
  style,
  placeholder = PERFORMANCE_CONFIG.BLUR_HASH_PLACEHOLDER,
  fallbackUri,
  index = 0,
  isVisible = true,
  onLoad,
  onError,
  resizeMode = 'cover',
  cachePolicy = 'memory-disk',
  priority = 'normal',
  reduceMemoryUsage = deviceCapabilities.isLowEndDevice,
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [shouldLoad, setShouldLoad] = useState(isVisible);
  const [retryCount, setRetryCount] = useState(0);
  const mountedRef = useRef(true);
  const loadTimeoutRef = useRef<NodeJS.Timeout>();

  // Optimize image dimensions for low-end devices
  const optimizedDimensions = useMemo(() => {
    if (!reduceMemoryUsage) return { width, height };
    
    const maxWidth = SCREEN_WIDTH;
    const maxHeight = SCREEN_WIDTH * 1.5; // Reasonable aspect ratio limit
    
    let optimizedWidth = Math.min(width, maxWidth);
    let optimizedHeight = Math.min(height, maxHeight);
    
    // Scale down further for very low-end devices
    if (deviceCapabilities.isLowEndDevice) {
      optimizedWidth *= PERFORMANCE_CONFIG.IMAGE_QUALITY_SCALE;
      optimizedHeight *= PERFORMANCE_CONFIG.IMAGE_QUALITY_SCALE;
    }
    
    return {
      width: Math.round(optimizedWidth),
      height: Math.round(optimizedHeight),
    };
  }, [width, height, reduceMemoryUsage]);

  // Determine image source with fallback logic
  const imageSource = useMemo(() => {
    const cacheKey = `${uri}-${optimizedDimensions.width}x${optimizedDimensions.height}`;
    const cachedUri = MemoryManager.getFromCache(cacheKey);
    
    return {
      uri: cachedUri || uri,
      width: optimizedDimensions.width,
      height: optimizedDimensions.height,
      headers: reduceMemoryUsage ? { 'Cache-Control': 'max-age=3600' } : undefined,
    };
  }, [uri, optimizedDimensions, reduceMemoryUsage]);

  // Optimized cache policy for low-end devices
  const effectiveCachePolicy = useMemo(() => {
    if (reduceMemoryUsage) {
      return priority === 'high' ? 'memory-disk' : 'disk';
    }
    return cachePolicy;
  }, [cachePolicy, priority, reduceMemoryUsage]);

  // Handle image load success
  const handleLoad = useCallback(() => {
    if (!mountedRef.current) return;
    
    setIsLoading(false);
    setHasError(false);
    
    // Cache successful load
    const cacheKey = `${uri}-${optimizedDimensions.width}x${optimizedDimensions.height}`;
    MemoryManager.addToCache(cacheKey, uri);
    
    onLoad?.();
    
    // Clear timeout
    if (loadTimeoutRef.current) {
      clearTimeout(loadTimeoutRef.current);
    }
  }, [uri, optimizedDimensions, onLoad]);

  // Handle image load error
  const handleError = useCallback(() => {
    if (!mountedRef.current) return;
    
    setIsLoading(false);
    setHasError(true);
    onError?.();
    
    // Clear timeout
    if (loadTimeoutRef.current) {
      clearTimeout(loadTimeoutRef.current);
    }
  }, [onError]);

  // Handle retry logic
  const handleRetry = useCallback(() => {
    if (retryCount >= 3) return; // Max 3 retries
    
    setRetryCount(prev => prev + 1);
    setIsLoading(true);
    setHasError(false);
    
    // Use fallback URI on retry if available
    if (retryCount > 0 && fallbackUri) {
      // Force re-render with fallback
      setTimeout(() => {
        if (mountedRef.current) {
          setIsLoading(false);
        }
      }, 100);
    }
  }, [retryCount, fallbackUri]);

  // Lazy loading logic
  useEffect(() => {
    if (!isVisible && priority !== 'high') {
      return;
    }
    
    // Delay loading for low priority images to improve performance
    const delay = priority === 'low' ? 200 : priority === 'normal' ? 50 : 0;
    
    const timer = setTimeout(() => {
      if (mountedRef.current) {
        setShouldLoad(true);
      }
    }, delay);
    
    return () => clearTimeout(timer);
  }, [isVisible, priority]);

  // Timeout handling for slow networks
  useEffect(() => {
    if (!shouldLoad || !isLoading) return;
    
    loadTimeoutRef.current = setTimeout(() => {
      if (mountedRef.current && isLoading) {
        handleError();
      }
    }, PERFORMANCE_CONFIG.REQUEST_TIMEOUT);
    
    return () => {
      if (loadTimeoutRef.current) {
        clearTimeout(loadTimeoutRef.current);
      }
    };
  }, [shouldLoad, isLoading, handleError]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (loadTimeoutRef.current) {
        clearTimeout(loadTimeoutRef.current);
      }
    };
  }, []);

  // Memoized styles
  const containerStyle = useMemo(() => [
    styles.container,
    {
      width: optimizedDimensions.width,
      height: optimizedDimensions.height,
    },
    style,
  ], [optimizedDimensions, style]);

  const imageStyle = useMemo(() => ({
    width: optimizedDimensions.width,
    height: optimizedDimensions.height,
  }), [optimizedDimensions]);

  // Don't render if not visible and low priority
  if (!shouldLoad && priority === 'low') {
    return (
      <View style={containerStyle}>
        <View style={styles.placeholderContainer}>
          <Text style={styles.placeholderText}>
            {index > 0 ? `Image ${index}` : 'Image'}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={containerStyle}>
      {shouldLoad && (
        <ExpoImage
          source={hasError && fallbackUri ? { uri: fallbackUri } : imageSource}
          style={imageStyle}
          contentFit={resizeMode}
          onLoad={handleLoad}
          onError={handleError}
          cachePolicy={effectiveCachePolicy}
          placeholder={placeholder}
          transition={deviceCapabilities.isLowEndDevice ? 100 : 200}
          priority={priority}
        />
      )}
      
      {isLoading && shouldLoad && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator 
            size="small" 
            color="#02A9FF" 
          />
          {index > 0 && (
            <Text style={styles.loadingText}>
              Loading {index}...
            </Text>
          )}
        </View>
      )}
      
      {hasError && (
        <View style={styles.errorOverlay}>
          <FontAwesome5 name="exclamation-triangle" size={20} color="#ff4444" />
          <Text style={styles.errorText}>Failed to load</Text>
          {retryCount < 3 && (
            <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
              <FontAwesome5 name="redo" size={12} color="#fff" />
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}, (prevProps, nextProps) => {
  // Optimized comparison to prevent unnecessary re-renders
  return (
    prevProps.uri === nextProps.uri &&
    prevProps.width === nextProps.width &&
    prevProps.height === nextProps.height &&
    prevProps.isVisible === nextProps.isVisible &&
    prevProps.priority === nextProps.priority &&
    prevProps.index === nextProps.index
  );
});

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  placeholderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#e0e0e0',
  },
  placeholderText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
  },
  loadingText: {
    fontSize: 10,
    color: '#666',
    marginTop: 4,
    textAlign: 'center',
  },
  errorOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
  },
  errorText: {
    fontSize: 10,
    color: '#ff4444',
    marginTop: 4,
    textAlign: 'center',
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#02A9FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginTop: 8,
  },
  retryText: {
    fontSize: 10,
    color: '#fff',
    marginLeft: 4,
  },
});

export default OptimizedImage; 