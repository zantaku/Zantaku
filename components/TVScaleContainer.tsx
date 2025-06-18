import React from 'react';
import { View, Dimensions, PixelRatio, Platform } from 'react-native';

const { width, height } = Dimensions.get('screen');
const pixelRatio = PixelRatio.get();
const ACTUAL_WIDTH = width * pixelRatio;
const ACTUAL_HEIGHT = height * pixelRatio;

interface TVScaleContainerProps {
  children: React.ReactNode;
}

export default function TVScaleContainer({ children }: TVScaleContainerProps) {
  const isTV = Platform.isTV;
  
  if (!isTV) {
    // Not TV, return children as-is
    return <>{children}</>;
  }

  return (
    <View style={{
      width: ACTUAL_WIDTH,
      height: ACTUAL_HEIGHT,
      paddingHorizontal: ACTUAL_WIDTH * 0.05, // 5% padding
      paddingVertical: 40,
      // Debug border to show container bounds
      backgroundColor: __DEV__ ? 'rgba(0, 255, 0, 0.05)' : 'transparent',
      borderWidth: __DEV__ ? 3 : 0,
      borderColor: __DEV__ ? 'green' : 'transparent',
    }}>
      {children}
    </View>
  );
} 