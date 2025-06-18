import { Platform, Dimensions, PixelRatio } from 'react-native';

export interface TVScreenDimensions {
  dp: { width: number; height: number };
  pixels: { width: number; height: number };
  pixelRatio: number;
}

export interface TVDetectionResult {
  isTV: boolean;
  screenType: 'phone' | 'tablet' | 'tv';
  isLandscape: boolean;
  screenSize: {
    width: number;
    height: number;
  };
}

export const isTV = (): boolean => {
  // react-native-tvos provides proper Platform.isTV support
  if (Platform.isTV !== undefined) {
    return Platform.isTV;
  }
  
  // Fallback for older versions or edge cases
  const { width, height } = Dimensions.get('screen');
  const minDimension = Math.min(width, height);
  const maxDimension = Math.max(width, height);
  
  // TV screens are typically much larger and in landscape
  return maxDimension >= 960 && minDimension >= 540 && maxDimension / minDimension >= 1.5;
};

export const getTVScreenDimensions = (): TVScreenDimensions => {
  const screen = Dimensions.get('screen');
  const pixelRatio = PixelRatio.get();
  
  return {
    dp: {
      width: screen.width,
      height: screen.height
    },
    pixels: {
      width: Math.round(screen.width * pixelRatio),
      height: Math.round(screen.height * pixelRatio)
    },
    pixelRatio
  };
};

export const isTVLandscape = (): boolean => {
  if (!isTV()) return false;
  
  const { width, height } = Dimensions.get('screen');
  return width > height;
};

export const detectTVEnvironment = (): TVDetectionResult => {
  const { width, height } = Dimensions.get('screen');
  const pixelRatio = PixelRatio.get();
  
  // Get actual physical pixels for TV
  const actualWidth = Math.round(width * pixelRatio);
  const actualHeight = Math.round(height * pixelRatio);
  
  console.log('🔥 TV DETECTION DIMENSIONS:', {
    screenDp: { width, height },
    pixelRatio,
    actualPixels: { width: actualWidth, height: actualHeight }
  });
  
  const isLandscape = width > height;
  const tvDetected = isTV();
  
  let screenType: 'phone' | 'tablet' | 'tv' = 'phone';
  
  if (tvDetected) {
    screenType = 'tv';
  } else if (width >= 600 || height >= 600) {
    screenType = 'tablet';
  }
  
  return {
    isTV: tvDetected,
    screenType,
    isLandscape,
    screenSize: { 
      width: actualWidth,
      height: actualHeight 
    }
  };
};

export const getTVLayoutConfig = () => {
  const tvInfo = detectTVEnvironment();
  
  if (!tvInfo.isTV) {
    return null;
  }

  const { width: screenWidth } = Dimensions.get('screen');
  
  return {
    // Netflix-style layout configurations based on actual screen width
    cardWidth: Math.min(220, screenWidth * 0.15),
    cardHeight: 300,
    rowSpacing: 40,
    sectionSpacing: 60,
    horizontalPadding: Math.max(60, screenWidth * 0.05),
    verticalPadding: 40,
    focusScale: 1.1,
    animationDuration: 200,
    
    // Full screen dimensions
    screenWidth,
    screenHeight: tvInfo.screenSize.height,
    
    // Navigation
    showBottomTabs: false,
    showSideNavigation: true,
    
    // Content
    showOnlyHomeAndExplore: true,
    enableKeyboardNavigation: true,
  };
};

// Legacy alias for backward compatibility
export const isTVEnvironment = (): boolean => {
  return isTV();
}; 