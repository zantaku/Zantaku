import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface TrendingAdCardProps {
  data: any;
  theme: any;
  isDarkMode: boolean;
}

export default function TrendingAdCard({ data, theme, isDarkMode }: TrendingAdCardProps) {
  return (
    <View style={styles.container}>
      <Text style={[styles.text, { color: theme.colors.text }]}>Trending Ad Card</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    alignItems: 'center',
  },
  text: {
    fontSize: 16,
  },
}); 