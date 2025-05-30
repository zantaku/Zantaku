import { useState, useCallback } from 'react';
import { Dimensions } from 'react-native';

const WINDOW_WIDTH = Dimensions.get('window').width;

interface ImageState {
  isLoading: boolean;
  hasError: boolean;
  height: number | null;
}

export const useImageLoader = (imageCount: number) => {
  const [imageStates, setImageStates] = useState<{ [key: number]: ImageState }>({});

  const handleImageLoadStart = useCallback((index: number) => {
    setImageStates(prev => ({
      ...prev,
      [index]: { isLoading: true, hasError: false, height: null }
    }));
  }, []);

  const handleImageLoadSuccess = useCallback((index: number, originalWidth: number, originalHeight: number) => {
    // Calculate proper height maintaining aspect ratio
    const scaledHeight = (originalHeight / originalWidth) * WINDOW_WIDTH;
    
    setImageStates(prev => ({
      ...prev,
      [index]: { isLoading: false, hasError: false, height: scaledHeight }
    }));
  }, []);

  const handleImageLoadError = useCallback((index: number) => {
    setImageStates(prev => ({
      ...prev,
      [index]: { isLoading: false, hasError: true, height: 400 } // fallback height
    }));
  }, []);

  const retryImage = useCallback((index: number) => {
    setImageStates(prev => ({
      ...prev,
      [index]: { isLoading: true, hasError: false, height: null }
    }));
  }, []);

  const getImageState = useCallback((index: number): ImageState => {
    return imageStates[index] || { isLoading: true, hasError: false, height: null };
  }, [imageStates]);

  const getItemLayout = useCallback((data: any, index: number) => {
    const state = imageStates[index];
    const height = state?.height || 400; // fallback height
    
    return {
      length: height,
      offset: Object.keys(imageStates)
        .filter(key => parseInt(key) < index)
        .reduce((total, key) => total + (imageStates[parseInt(key)]?.height || 400), 0),
      index,
    };
  }, [imageStates]);

  return {
    handleImageLoadStart,
    handleImageLoadSuccess,
    handleImageLoadError,
    retryImage,
    getImageState,
    getItemLayout,
  };
}; 