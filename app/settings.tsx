import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../hooks/useTheme';
import AppSettingPage from '../components/AppSettingPage';

export default function Settings() {
  const router = useRouter();
  const { currentTheme } = useTheme();

  // Handle close action from AppSettingPage
  const handleClose = () => {
    router.replace('/');
  };

  return (
    <View style={[styles.container, { backgroundColor: currentTheme.colors.background }]}>
      <AppSettingPage onClose={handleClose} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
}); 