import React, { useCallback, useMemo, useRef, useEffect, useState } from 'react';
import { InteractionManager, Platform, PixelRatio } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Performance Constants for Low-End Devices
export const PERFORMANCE_CONFIG = {
  // Memory constraints for 2GB devices
  MAX_MEMORY_USAGE_MB: 150, // Conservative limit
  IMAGE_CACHE_SIZE: 10, // Reduced from default
  MAX_CONCURRENT_IMAGES: 3, // Limit simultaneous image loads
  
  // List rendering optimization
  INITIAL_RENDER_COUNT: 3, // Reduced initial render
  MAX_RENDER_PER_BATCH: 2, // Small batches
  WINDOW_SIZE: 5, // Minimal window size
  
  // Animation settings
  REDUCED_ANIMATIONS: true,
  ANIMATION_DURATION_SCALE: 0.7, // Faster animations
  
  // Network optimization
  MAX_CONCURRENT_REQUESTS: 2,
  REQUEST_TIMEOUT: 8000, // Shorter timeout for slow networks
  
  // Image optimization
  IMAGE_QUALITY_SCALE: 0.8, // Slightly reduced quality
  WEBP_SUPPORT: Platform.OS === 'android' && Platform.Version >= 14,
  BLUR_HASH_PLACEHOLDER: 'L6PZfSi_.AyE_3t7t7R**0o#DgR4',
};

// Device capability detection
export const detectDeviceCapabilities = () => {
  let totalMemory = 0;
  try {
    if (Platform.OS === 'android') {
      totalMemory = require('react-native').NativeModules?.DeviceInfo?.getTotalMemory?.() || 0;
    }
  } catch (error) {
    // Silently handle if DeviceInfo is not available
  }
  
  return {
    isLowEndDevice: totalMemory > 0 && totalMemory < 3 * 1024 * 1024 * 1024, // < 3GB
    pixelRatio: PixelRatio.get(),
    fontScale: PixelRatio.getFontScale(),
    isSlowCPU: Platform.OS === 'android' && Platform.Version < 23,
  };
};

// Memory management utilities
export class MemoryManager {
  private static imageCache = new Map<string, any>();
  private static maxCacheSize = PERFORMANCE_CONFIG.IMAGE_CACHE_SIZE;

  static addToCache(key: string, data: any) {
    if (this.imageCache.size >= this.maxCacheSize) {
      // Remove oldest entry
      const firstKey = this.imageCache.keys().next().value;
      this.imageCache.delete(firstKey);
    }
    this.imageCache.set(key, data);
  }

  static getFromCache(key: string) {
    return this.imageCache.get(key);
  }

  static clearCache() {
    this.imageCache.clear();
  }

  static getCacheSize() {
    return this.imageCache.size;
  }
}

// Performance monitoring hook
export const usePerformanceMonitor = () => {
  const frameCount = useRef(0);
  const lastFrameTime = useRef(Date.now());
  const [fps, setFps] = useState(60);
  const [memoryUsage, setMemoryUsage] = useState<string>('N/A');

  useEffect(() => {
    const updatePerformanceMetrics = () => {
      const now = Date.now();
      frameCount.current++;
      
      if (now - lastFrameTime.current >= 1000) {
        setFps(frameCount.current);
        frameCount.current = 0;
        lastFrameTime.current = now;
        
        // Update memory usage if available
        try {
          if (global.performance && (global.performance as any).memory) {
            const memory = (global.performance as any).memory;
            const usedMB = Math.round(memory.usedJSHeapSize / 1048576);
            const limitMB = Math.round(memory.jsHeapSizeLimit / 1048576);
            setMemoryUsage(`${usedMB}MB / ${limitMB}MB`);
          }
        } catch (e) {
          // Silently handle memory API unavailability
        }
      }
      
      requestAnimationFrame(updatePerformanceMetrics);
    };

    requestAnimationFrame(updatePerformanceMetrics);
  }, []);

  return { fps, memoryUsage };
};

// Optimized image loading hook for low-end devices
export const useOptimizedImageLoading = (imageUrls: string[], initialCount = PERFORMANCE_CONFIG.INITIAL_RENDER_COUNT) => {
  const [loadedIndices, setLoadedIndices] = useState<Set<number>>(new Set());
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: initialCount - 1 });
  const loadingQueue = useRef<number[]>([]);
  const isLoading = useRef(false);

  const loadImageBatch = useCallback(async (indices: number[]) => {
    if (isLoading.current) return;
    isLoading.current = true;

    // Process images in small batches to avoid memory spikes
    const batchSize = PERFORMANCE_CONFIG.MAX_CONCURRENT_IMAGES;
    for (let i = 0; i < indices.length; i += batchSize) {
      const batch = indices.slice(i, i + batchSize);
      
      await Promise.allSettled(
        batch.map(async (index) => {
          if (loadedIndices.has(index) || index >= imageUrls.length) return;
          
          try {
            // Preload image
            const image = new Image();
            image.src = imageUrls[index];
            await new Promise<void>((resolve, reject) => {
              image.onload = () => resolve();
              image.onerror = () => reject(new Error('Image load failed'));
              setTimeout(() => reject(new Error('Timeout')), PERFORMANCE_CONFIG.REQUEST_TIMEOUT);
            });
            
            setLoadedIndices(prev => new Set([...prev, index]));
          } catch (error) {
            console.warn(`Failed to preload image ${index}:`, error);
          }
        })
      );
      
      // Small delay between batches to prevent blocking
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    isLoading.current = false;
  }, [imageUrls, loadedIndices]);

  const updateVisibleRange = useCallback((start: number, end: number) => {
    setVisibleRange({ start, end });
    
    // Queue loading for visible range + buffer
    const buffer = 2;
    const loadStart = Math.max(0, start - buffer);
    const loadEnd = Math.min(imageUrls.length - 1, end + buffer);
    
    const toLoad: number[] = [];
    for (let i = loadStart; i <= loadEnd; i++) {
      if (!loadedIndices.has(i)) {
        toLoad.push(i);
      }
    }
    
    if (toLoad.length > 0) {
      loadingQueue.current = toLoad;
      InteractionManager.runAfterInteractions(() => {
        loadImageBatch(toLoad);
      });
    }
  }, [imageUrls.length, loadedIndices, loadImageBatch]);

  // Load initial batch
  useEffect(() => {
    const initialIndices = Array.from({ length: Math.min(initialCount, imageUrls.length) }, (_, i) => i);
    loadImageBatch(initialIndices);
  }, [imageUrls, initialCount, loadImageBatch]);

  return {
    loadedIndices,
    updateVisibleRange,
    isImageLoaded: useCallback((index: number) => loadedIndices.has(index), [loadedIndices]),
  };
};

// Debounced scroll handler for performance
export const useOptimizedScrollHandler = (callback: (data: any) => void, delay = 100) => {
  const timeoutRef = useRef<NodeJS.Timeout | undefined>();
  const lastCallRef = useRef(0);

  return useCallback((event: any) => {
    const now = Date.now();
    
    // Throttle rapid scroll events
    if (now - lastCallRef.current < 16) { // ~60fps
      return;
    }
    
    lastCallRef.current = now;
    
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    timeoutRef.current = setTimeout(() => {
      callback(event);
    }, delay);
  }, [callback, delay]);
};

// Component optimization helpers
export const createMemoizedComponent = <T extends Record<string, any>>(
  Component: React.ComponentType<T>,
  compareProps?: (prevProps: T, nextProps: T) => boolean
) => {
  return React.memo(Component, compareProps || ((prevProps, nextProps) => {
    // Shallow comparison for common props
    const keys = Object.keys(nextProps);
    return keys.every(key => prevProps[key] === nextProps[key]);
  }));
};

// Optimized list rendering configuration
export const getOptimizedListProps = (itemCount: number) => {
  const deviceCapabilities = detectDeviceCapabilities();
  
  return {
    initialNumToRender: deviceCapabilities.isLowEndDevice ? 2 : PERFORMANCE_CONFIG.INITIAL_RENDER_COUNT,
    maxToRenderPerBatch: PERFORMANCE_CONFIG.MAX_RENDER_PER_BATCH,
    windowSize: PERFORMANCE_CONFIG.WINDOW_SIZE,
    removeClippedSubviews: true,
    updateCellsBatchingPeriod: deviceCapabilities.isLowEndDevice ? 200 : 100,
    legacyImplementation: false,
    disableVirtualization: false,
    maintainVisibleContentPosition: itemCount > 50 ? undefined : {
      minIndexForVisible: 0,
      autoscrollToTopThreshold: 10
    },
  };
};

// Network request optimization hook
export const useOptimizedFetcher = () => {
  const activeRequests = useRef(new Map<string, AbortController>());
  const requestCount = useRef(0);

  const optimizedFetch = useCallback(async (url: string, options: RequestInit = {}): Promise<Response> => {
    // Limit concurrent requests
    if (requestCount.current >= PERFORMANCE_CONFIG.MAX_CONCURRENT_REQUESTS) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    const controller = new AbortController();
    const requestId = `${url}-${Date.now()}`;
    activeRequests.current.set(requestId, controller);
    requestCount.current++;

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      
      return response;
    } finally {
      activeRequests.current.delete(requestId);
      requestCount.current--;
    }
  }, []);

  const cancelAll = useCallback(() => {
    activeRequests.current.forEach(controller => controller.abort());
    activeRequests.current.clear();
    requestCount.current = 0;
  }, []);

  return { optimizedFetch, cancelAll };
};

// Settings for low-end device optimizations
export const LOW_END_DEVICE_SETTINGS = {
  reduceAnimations: true,
  lowImageQuality: true,
  limitBackgroundTasks: true,
  aggressiveMemoryManagement: true,
  reducedPreloading: true,
  simplifiedUI: true,
};

// Utility to save/load performance settings
export const PerformanceSettings = {
  async save(settings: typeof LOW_END_DEVICE_SETTINGS) {
    try {
      await AsyncStorage.setItem('performance_settings', JSON.stringify(settings));
    } catch (error) {
      console.warn('Failed to save performance settings:', error);
    }
  },
  
  async load(): Promise<typeof LOW_END_DEVICE_SETTINGS> {
    try {
      const stored = await AsyncStorage.getItem('performance_settings');
      return stored ? { ...LOW_END_DEVICE_SETTINGS, ...JSON.parse(stored) } : LOW_END_DEVICE_SETTINGS;
    } catch (error) {
      console.warn('Failed to load performance settings:', error);
      return LOW_END_DEVICE_SETTINGS;
    }
  },
  
  async detectAndApplyOptimalSettings() {
    const capabilities = detectDeviceCapabilities();
    const settings = capabilities.isLowEndDevice ? 
      LOW_END_DEVICE_SETTINGS : 
      { ...LOW_END_DEVICE_SETTINGS, 
        reduceAnimations: false, 
        lowImageQuality: false,
        simplifiedUI: false 
      };
    
    await this.save(settings);
    return settings;
  }
}; 