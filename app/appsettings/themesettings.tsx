import React, { useRef, useEffect, useState } from 'react';
import { View, Animated, BackHandler, Text, Switch } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useTheme, lightTheme, darkTheme } from '../../hooks/useTheme';
import { SettingsLayout, SettingsSection, SettingsToggle } from '../../components/SettingsComponents';
import { StyleSheet } from 'react-native';

export default function ThemeScreen() {
  const { toggleTheme, isDarkMode, currentTheme } = useTheme();
  const [isAnimating, setIsAnimating] = useState(false);
  
  // Animation values for native driver
  const scaleAnim = useRef(new Animated.Value(1)).current;
  
  // Animation values for JS driver
  const themeAnim = useRef(new Animated.Value(isDarkMode ? 1 : 0)).current;
  const lastToggleTime = useRef(0);

  // Interpolate colors
  const interpolatedBackgroundColor = themeAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [lightTheme.colors.background, darkTheme.colors.background]
  });

  const interpolatedSurfaceColor = themeAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [lightTheme.colors.surface, darkTheme.colors.surface]
  });

  const interpolatedTextColor = themeAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [lightTheme.colors.text, darkTheme.colors.text]
  });

  // Handle hardware back button
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      return true;
    });

    return () => backHandler.remove();
  }, []);

  const handleThemeToggle = () => {
    // Prevent rapid toggling
    const now = Date.now();
    if (isAnimating || now - lastToggleTime.current < 300) {
      return;
    }
    lastToggleTime.current = now;
    setIsAnimating(true);

    // Toggle theme immediately
    toggleTheme();
    
    // Run animations
    Animated.parallel([
      // Scale animation
      Animated.sequence([
        Animated.spring(scaleAnim, {
          toValue: 0.95,
          useNativeDriver: true,
          tension: 50,
          friction: 7,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          useNativeDriver: true,
          tension: 50,
          friction: 7,
        })
      ]),
      // Theme color animation
      Animated.timing(themeAnim, {
        toValue: !isDarkMode ? 1 : 0,
        duration: 300,
        useNativeDriver: false,
      })
    ]).start(() => {
      setIsAnimating(false);
    });
  };

  // Update theme animation when theme changes externally
  useEffect(() => {
    Animated.timing(themeAnim, {
      toValue: isDarkMode ? 1 : 0,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [isDarkMode]);

  // Custom theme preview component
  const ThemePreview = () => (
    <Animated.View style={[styles.previewSection, { backgroundColor: interpolatedSurfaceColor }]}>
      <Animated.Text style={[styles.previewTitle, { color: interpolatedTextColor }]}>
        Preview
      </Animated.Text>
      <View style={styles.previewContent}>
        <Animated.View style={[
          styles.previewCard,
          { backgroundColor: interpolatedBackgroundColor }
        ]}>
          <View style={styles.previewHeader}>
            <Animated.View style={[
              styles.previewIcon,
              {
                backgroundColor: currentTheme.colors.primary,
                transform: [{ scale: scaleAnim }]
              }
            ]}>
              <FontAwesome5 name="palette" size={20} color="#fff" />
            </Animated.View>
            <Animated.Text style={[styles.previewText, { color: interpolatedTextColor }]}>
              {isDarkMode ? 'Dark Theme' : 'Light Theme'}
            </Animated.Text>
          </View>
          <Animated.Text style={[
            styles.previewDescription,
            { color: interpolatedTextColor, opacity: 0.7 }
          ]}>
            This is how your app will look with the {isDarkMode ? 'dark' : 'light'} theme
          </Animated.Text>
        </Animated.View>
      </View>
    </Animated.View>
  );

  // Use our new SettingsComponents but wrap them in Animated container for smooth transitions
  return (
    <Animated.View style={[
      styles.container,
      { backgroundColor: interpolatedBackgroundColor }
    ]}>
      <Animated.View style={[
        styles.innerContainer,
        { transform: [{ scale: scaleAnim }] }
      ]}>
        <SettingsLayout title="Theme">
          <SettingsSection>
            <SettingsToggle
              title="Dark Mode"
              description="Switch between light and dark themes"
              value={isDarkMode}
              onValueChange={handleThemeToggle}
            />
          </SettingsSection>
          
          <ThemePreview />
        </SettingsLayout>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  innerContainer: {
    flex: 1,
  },
  previewSection: {
    borderRadius: 16,
    padding: 20,
    marginTop: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  previewTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
    letterSpacing: -0.3,
  },
  previewContent: {
    alignItems: 'center',
  },
  previewCard: {
    width: '100%',
    padding: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  previewIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  previewText: {
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: -0.3,
  },
  previewDescription: {
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: -0.2,
  },
}); 