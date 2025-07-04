import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface FomoCardProps {
  data: {
    message: string;
    count: number;
  };
  theme: any;
  isDarkMode: boolean;
}

export default function FomoCard({ data, theme, isDarkMode }: FomoCardProps) {
  return (
    <View style={styles.container}>
      <Text style={[styles.text, { color: theme.colors.text }]}>FOMO Card</Text>
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