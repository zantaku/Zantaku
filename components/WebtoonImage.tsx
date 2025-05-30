import React, { memo } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { FontAwesome5 } from '@expo/vector-icons';

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
}: WebtoonImageProps) => {
  const containerHeight = height || 400; // fallback height

  return (
    <View style={[styles.container, { height: containerHeight }]}>
      <TouchableOpacity 
        activeOpacity={1} 
        onPress={onPress}
        style={[styles.touchable, { height: containerHeight }]}
      >
        {!hasError && (
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
            priority={index < 3 ? "high" : "normal"}
            recyclingKey={`webtoon-${index}-${imageUrl}`}
          />
        )}
        
        {isLoading && (
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
    prevProps.height === nextProps.height
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
});

export default WebtoonImage; 