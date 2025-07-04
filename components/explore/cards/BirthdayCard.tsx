import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface BirthdayCardProps {
  data: any[];
  theme: any;
  isDarkMode: boolean;
}

export default function BirthdayCard({ data, theme, isDarkMode }: BirthdayCardProps) {
  return (
    <View style={styles.container}>
      <Text style={[styles.text, { color: theme.colors.text }]}>Birthday Card</Text>
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