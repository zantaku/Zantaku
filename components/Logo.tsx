import React from 'react';
import { View, StyleSheet, useColorScheme } from 'react-native';
import Svg, { Rect, Polygon } from 'react-native-svg';
import { useTheme } from '../hooks/useTheme';

interface LogoProps {
  width?: number;
  height?: number;
  variant?: 'auto' | 'light' | 'dark';
}

export default function Logo({ width = 120, height = 24, variant = 'auto' }: LogoProps) {
  const { isDarkMode, currentTheme } = useTheme();
  const systemColorScheme = useColorScheme();
  
  // Determine the fill color based on variant or system color scheme
  let fillColor = '#FFFFFF'; // Default white
  
  if (variant === 'auto') {
    // Use the app's theme system
    fillColor = isDarkMode ? '#FFFFFF' : '#000000';
  } else if (variant === 'dark') {
    fillColor = '#000000';
  } else if (variant === 'light') {
    fillColor = '#FFFFFF';
  }
  
  // Calculate scaling factor based on the original SVG viewBox
  const originalWidth = 500;
  const originalHeight = 500;
  const scale = Math.min(width / originalWidth, height / originalHeight);
  
  // Calculate dimensions to maintain aspect ratio
  const scaledWidth = originalWidth * scale;
  const scaledHeight = originalHeight * scale;
  
  return (
    <View style={[styles.container, { width, height }]}>
      <Svg
        width={scaledWidth}
        height={scaledHeight}
        viewBox="0 0 500 500"
        preserveAspectRatio="xMidYMid meet"
      >
        <Rect x="131.12" y="146.01" width="103.83" height="23.21" fill={fillColor} />
        <Rect x="131.12" y="185.1" width="103.83" height="23.21" fill={fillColor} />
        <Polygon points="267.93 146.01 268.23 169.22 343.15 169.22 366.97 146.01 267.93 146.01" fill={fillColor} />
        <Polygon points="267.93 185.1 329 185.1 328.37 381.31 305.79 356.01 305.79 208.31 267.93 208.31 267.93 185.1" fill={fillColor} />
        <Polygon points="241.06 90.97 241.06 387.05 263.04 409.03 263.04 114.19 241.06 90.97" fill={fillColor} />
        <Rect x="269.15" y="238.85" width="30.54" height="21.99" fill={fillColor} />
        <Polygon points="404.24 238.85 333.89 238.85 333.89 260.83 382.25 260.83 404.24 238.85" fill={fillColor} />
        <Polygon points="269.45 314.51 291.5 336.56 299.69 336.56 299.69 314.58 269.45 314.51" fill={fillColor} />
        <Polygon points="386.65 314.58 333.89 314.46 333.89 336.56 364.66 336.56 386.65 314.58" fill={fillColor} />
        <Polygon points="233.69 240.07 221.85 240.07 129.9 332.26 129.9 360.84 233.73 256.73 233.69 240.07" fill={fillColor} />
        <Polygon points="215.9 238.85 95.76 238.85 116.85 260.83 193.91 260.83 215.9 238.85" fill={fillColor} />
        <Polygon points="199.53 299.12 199.53 353.45 223.96 377.68 223.96 274.69 199.53 299.12" fill={fillColor} />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
}); 