import React, { createContext, useContext, useState, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const lightTheme = {
  colors: {
    background: '#FFFFFF',
    surface: '#F8F8F8',
    text: '#1A1A1A',
    textSecondary: '#666666',
    border: '#E0E0E0',
    primary: '#02A9FF',
    error: '#FF3B30',
  },
};

export const darkTheme = {
  colors: {
    background: '#000000',
    surface: '#1A1A1A',
    text: '#FFFFFF',
    textSecondary: '#A0A0A0',
    border: '#333333',
    primary: '#02A9FF',
    error: '#FF453A',
  },
};

export type Theme = typeof lightTheme;

interface ThemeContextType {
  isDarkMode: boolean;
  currentTheme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemColorScheme = useColorScheme();
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    const loadTheme = async () => {
      try {
        const savedTheme = await AsyncStorage.getItem('theme_mode');
        if (savedTheme) {
          setIsDarkMode(savedTheme === 'dark');
        } else {
          setIsDarkMode(systemColorScheme === 'dark');
        }
      } catch (error) {
        console.error('Error loading theme:', error);
        setIsDarkMode(systemColorScheme === 'dark');
      }
    };
    loadTheme();
  }, [systemColorScheme]);

  const toggleTheme = async () => {
    try {
      const newMode = !isDarkMode;
      await AsyncStorage.setItem('theme_mode', newMode ? 'dark' : 'light');
      setIsDarkMode(newMode);
    } catch (error) {
      console.error('Error saving theme:', error);
    }
  };

  const value = React.useMemo(() => ({
    isDarkMode,
    currentTheme: isDarkMode ? darkTheme : lightTheme,
    toggleTheme,
  }), [isDarkMode]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
} 