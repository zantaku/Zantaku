import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface QuoteCardProps {
  data: {
    quote: string;
    author: string;
  };
  theme: any;
  isDarkMode: boolean;
}

export default function QuoteCard({ data, theme, isDarkMode }: QuoteCardProps) {
  return (
    <View style={styles.container}>
      <Text style={[styles.text, { color: theme.colors.text }]}>Quote Card</Text>
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