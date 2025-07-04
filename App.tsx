import React from 'react';
import { Slot } from 'expo-router';
import { ThemeProvider } from './hooks/useTheme';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/react-query';

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <SafeAreaProvider>
          <Slot />
        </SafeAreaProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
} 