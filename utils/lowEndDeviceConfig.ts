import React from 'react';
import { Platform, DeviceEventEmitter } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { detectDeviceCapabilities, PerformanceSettings, LOW_END_DEVICE_SETTINGS } from './performanceOptimization';

export interface AppPerformanceConfig {
  reduceAnimations: boolean;
  lowImageQuality: boolean;
  limitBackgroundTasks: boolean;
  aggressiveMemoryManagement: boolean;
  reducedPreloading: boolean;
  simplifiedUI: boolean;
  maxConcurrentImages: number;
  listOptimization: {
    initialRenderCount: number;
    maxRenderPerBatch: number;
    windowSize: number;
    removeClippedSubviews: boolean;
  };
  networkOptimization: {
    maxConcurrentRequests: number;
    requestTimeout: number;
  };
  imageOptimization: {
    qualityScale: number;
    cacheSize: number;
    useWebP: boolean;
  };
}

class LowEndDeviceManager {
  private static instance: LowEndDeviceManager;
  private config: AppPerformanceConfig | null = null;
  private deviceCapabilities: any;

  private constructor() {
    this.deviceCapabilities = detectDeviceCapabilities();
  }

  static getInstance(): LowEndDeviceManager {
    if (!LowEndDeviceManager.instance) {
      LowEndDeviceManager.instance = new LowEndDeviceManager();
    }
    return LowEndDeviceManager.instance;
  }

  async initializeOptimizations(): Promise<AppPerformanceConfig> {
    console.log('🚀 Initializing performance optimizations for device:', {
      isLowEndDevice: this.deviceCapabilities.isLowEndDevice,
      pixelRatio: this.deviceCapabilities.pixelRatio,
      platform: Platform.OS,
      version: Platform.Version,
    });

    // Load saved settings or detect optimal ones
    let savedSettings;
    try {
      savedSettings = await PerformanceSettings.load();
    } catch (error) {
      console.warn('Failed to load performance settings, using defaults:', error);
      savedSettings = await PerformanceSettings.detectAndApplyOptimalSettings();
    }

    // Create performance configuration
    this.config = {
      ...savedSettings,
      maxConcurrentImages: this.deviceCapabilities.isLowEndDevice ? 2 : 5,
      listOptimization: {
        initialRenderCount: this.deviceCapabilities.isLowEndDevice ? 2 : 5,
        maxRenderPerBatch: this.deviceCapabilities.isLowEndDevice ? 1 : 3,
        windowSize: this.deviceCapabilities.isLowEndDevice ? 3 : 10,
        removeClippedSubviews: true,
      },
      networkOptimization: {
        maxConcurrentRequests: this.deviceCapabilities.isLowEndDevice ? 1 : 3,
        requestTimeout: this.deviceCapabilities.isLowEndDevice ? 10000 : 8000,
      },
      imageOptimization: {
        qualityScale: this.deviceCapabilities.isLowEndDevice ? 0.7 : 0.9,
        cacheSize: this.deviceCapabilities.isLowEndDevice ? 5 : 15,
        useWebP: Platform.OS === 'android' && Platform.Version >= 14,
      },
    };

    // Apply system-level optimizations
    await this.applySystemOptimizations();

    // Emit configuration for components to listen
    DeviceEventEmitter.emit('performanceConfigUpdated', this.config);

    console.log('✅ Performance optimizations applied:', this.config);
    return this.config;
  }

  private async applySystemOptimizations() {
    if (!this.config) return;

    // Set animation scale based on device capabilities
    if (this.config.reduceAnimations) {
      try {
        // For React Native, we can't directly set system animation scale,
        // but we can store it for our components to use
        await AsyncStorage.setItem('animation_scale', '0.5');
      } catch (error) {
        console.warn('Failed to set animation scale:', error);
      }
    }

    // Configure memory management
    if (this.config.aggressiveMemoryManagement) {
      // Set up periodic memory cleanup
      this.setupMemoryCleanup();
    }

    // Configure background task limitations
    if (this.config.limitBackgroundTasks) {
      await AsyncStorage.setItem('limit_background_tasks', 'true');
    }
  }

  private setupMemoryCleanup() {
    // Clear memory every 30 seconds on low-end devices
    const interval = this.deviceCapabilities.isLowEndDevice ? 30000 : 60000;
    
    setInterval(() => {
      // Clear image cache if it gets too large
      const { MemoryManager } = require('./performanceOptimization');
      if (MemoryManager.getCacheSize() > (this.config?.imageOptimization.cacheSize || 10)) {
        MemoryManager.clearCache();
        console.log('🧹 Cleared image cache for memory optimization');
      }

      // Force garbage collection if available
      if (global.gc && this.deviceCapabilities.isLowEndDevice) {
        try {
          global.gc();
        } catch (error) {
          // Silently handle if gc is not available
        }
      }
    }, interval);
  }

  getConfig(): AppPerformanceConfig | null {
    return this.config;
  }

  isLowEndDevice(): boolean {
    return this.deviceCapabilities.isLowEndDevice;
  }

  async updateSettings(newSettings: Partial<AppPerformanceConfig>) {
    if (!this.config) return;

    this.config = { ...this.config, ...newSettings };
    
    // Save updated settings
    try {
      await PerformanceSettings.save({
        reduceAnimations: this.config.reduceAnimations,
        lowImageQuality: this.config.lowImageQuality,
        limitBackgroundTasks: this.config.limitBackgroundTasks,
        aggressiveMemoryManagement: this.config.aggressiveMemoryManagement,
        reducedPreloading: this.config.reducedPreloading,
        simplifiedUI: this.config.simplifiedUI,
      });
    } catch (error) {
      console.warn('Failed to save updated performance settings:', error);
    }

    // Emit update
    DeviceEventEmitter.emit('performanceConfigUpdated', this.config);
  }

  // Performance monitoring methods
  startPerformanceMonitoring() {
    if (__DEV__) {
      console.log('🔍 Starting performance monitoring...');
      
      // Monitor memory usage
      const memoryCheck = () => {
        try {
          if (global.performance && (global.performance as any).memory) {
            const memory = (global.performance as any).memory;
            const usedMB = Math.round(memory.usedJSHeapSize / 1048576);
            const limitMB = Math.round(memory.jsHeapSizeLimit / 1048576);
            
            if (usedMB > 150 && this.deviceCapabilities.isLowEndDevice) {
              console.warn(`⚠️ High memory usage: ${usedMB}MB / ${limitMB}MB`);
              DeviceEventEmitter.emit('highMemoryUsage', { used: usedMB, limit: limitMB });
            }
          }
        } catch (error) {
          // Silently handle memory API unavailability
        }
      };

      // Check memory every 10 seconds in development
      setInterval(memoryCheck, 10000);
    }
  }

  // Helper methods for components
  getListOptimizationProps() {
    return this.config?.listOptimization || {
      initialRenderCount: 5,
      maxRenderPerBatch: 3,
      windowSize: 10,
      removeClippedSubviews: true,
    };
  }

  getImageOptimizationProps() {
    return this.config?.imageOptimization || {
      qualityScale: 0.9,
      cacheSize: 15,
      useWebP: false,
    };
  }

  shouldReduceAnimations(): boolean {
    return this.config?.reduceAnimations || false;
  }

  shouldSimplifyUI(): boolean {
    return this.config?.simplifiedUI || false;
  }
}

export default LowEndDeviceManager;

// Export singleton instance
export const lowEndDeviceManager = LowEndDeviceManager.getInstance();

// Helper hook for React components
export const usePerformanceConfig = () => {
  const [config, setConfig] = React.useState<AppPerformanceConfig | null>(
    lowEndDeviceManager.getConfig()
  );

  React.useEffect(() => {
    const listener = DeviceEventEmitter.addListener('performanceConfigUpdated', setConfig);
    return () => listener.remove();
  }, []);

  return {
    config,
    isLowEndDevice: lowEndDeviceManager.isLowEndDevice(),
    updateSettings: lowEndDeviceManager.updateSettings.bind(lowEndDeviceManager),
    getListProps: lowEndDeviceManager.getListOptimizationProps.bind(lowEndDeviceManager),
    getImageProps: lowEndDeviceManager.getImageOptimizationProps.bind(lowEndDeviceManager),
    shouldReduceAnimations: lowEndDeviceManager.shouldReduceAnimations.bind(lowEndDeviceManager),
    shouldSimplifyUI: lowEndDeviceManager.shouldSimplifyUI.bind(lowEndDeviceManager),
  };
}; 