import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface AiringScheduleCardProps {
  data: any[];
  theme: any;
  isDarkMode: boolean;
}

export default function AiringScheduleCard({ data, theme, isDarkMode }: AiringScheduleCardProps) {
  return (
    <View style={styles.container}>
      <Text style={[styles.text, { color: theme.colors.text }]}>Airing Schedule Card</Text>
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