import React from 'react';
import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

interface SkeletonCardProps {
  theme: any;
  isDarkMode: boolean;
  type?: 'hero' | 'anime' | 'schedule' | 'birthday' | 'top100';
  height?: number;
}

export default function SkeletonCard({ theme, isDarkMode, type = 'anime', height }: SkeletonCardProps) {
  return (
    <View style={[styles.container, { height: height || 200 }]}>
      <View style={[
        styles.skeleton, 
        { 
          backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
          height: height || 200
        }
      ]} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  skeleton: {
    height: '100%',
    borderRadius: 16,
  },
}); 