import React from 'react';
import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

interface SkeletonCardProps {
  theme: any;
  isDarkMode: boolean;
}

export default function SkeletonCard({ theme, isDarkMode }: SkeletonCardProps) {
  return (
    <View style={styles.container}>
      <LinearGradient
        colors={isDarkMode 
          ? ['rgba(255, 255, 255, 0.1)', 'rgba(255, 255, 255, 0.05)'] 
          : ['rgba(0, 0, 0, 0.1)', 'rgba(0, 0, 0, 0.05)']
        }
        style={styles.skeleton}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  skeleton: {
    height: 200,
    borderRadius: 16,
  },
}); 