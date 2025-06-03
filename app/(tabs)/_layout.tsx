import React from 'react';
import { Tabs } from 'expo-router';
import { FontAwesome5 } from '@expo/vector-icons';
import { TouchableOpacity, Image, Platform, Dimensions, StyleSheet, View, StatusBar, Text, Animated, Pressable } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { useAuth } from '../../hooks/useAuth';
import { BlurView } from 'expo-blur';
import AppSettingsModal from '../../components/AppSettingsModal';
import { useState, useEffect, useRef } from 'react';
import { useTheme } from '../../hooks/useTheme';
import GlobalSearch from '../../components/GlobalSearch';
import AnimeSearchGlobal from '../../components/AnimeSearchGlobal';
import MangaSearchGlobal from '../../components/MangaSearchGlobal';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DeviceEventEmitter } from 'react-native';
import * as NavigationBar from 'expo-navigation-bar';
import { MotiView } from 'moti';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const TAB_BAR_WIDTH = Math.min(SCREEN_WIDTH * 0.85, 320);

interface TabIconProps {
  name: string;
  label: string;
  color: string;
  focused: boolean;
  isDarkMode: boolean;
}

interface HeaderButtonProps {
  icon: React.ReactNode;
  onPress: () => void;
  isDarkMode: boolean;
}

// Custom tab icon component with enhanced animation
const TabIcon = ({ name, label, color, focused, isDarkMode }: TabIconProps) => {
  // Single animation value for the entire container
  const animatedValue = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.spring(animatedValue, {
      toValue: focused ? 1.1 : 1,
      friction: 20,
      tension: 300,
      useNativeDriver: true
    }).start();
  }, [focused]);

  // Single container for both icon and label
  return (
    <View style={styles.tabContainer}>
      <Animated.View 
        style={[
          styles.tabContent,
          {
            transform: [{ scale: animatedValue }]
          }
        ]}
      >
        <FontAwesome5 
          name={name} 
          size={24} 
          color={focused ? '#02A9FF' : color}
        />
        <Text 
          numberOfLines={1}
          style={[
            styles.label,
            { color: focused ? '#02A9FF' : color }
          ]}
        >
          {label}
        </Text>
      </Animated.View>
      {focused && (
        <View 
          style={[
            styles.indicator,
            { backgroundColor: '#02A9FF' }
          ]} 
        />
      )}
    </View>
  );
};

// Custom header button component
const HeaderButton = ({ icon, onPress, isDarkMode }: HeaderButtonProps) => (
  <Pressable
    onPress={onPress}
    style={({ pressed }) => [
      styles.headerButton,
      {
        opacity: pressed ? 0.7 : 1,
        transform: [{ scale: pressed ? 0.95 : 1 }],
      }
    ]}
  >
    <MotiView
      style={[
        styles.headerButtonInner,
        isDarkMode ? styles.headerButtonDark : styles.headerButtonLight
      ]}
      animate={{
        backgroundColor: isDarkMode 
          ? 'rgba(2, 169, 255, 0.15)' 
          : 'rgba(2, 169, 255, 0.1)',
      }}
    >
      {icon}
    </MotiView>
  </Pressable>
);

export default function TabsLayout() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading } = useAuth();
  const [showSettings, setShowSettings] = useState(false);
  const { isDarkMode, currentTheme } = useTheme();
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const isAnimePage = pathname.startsWith('/anime') || pathname === '/@anime';
  const isMangaPage = pathname.startsWith('/manga') || pathname === '/@manga';
  const insets = useSafeAreaInsets();

  // Calculate bottom spacing based on platform and safe area
  const bottomSpacing = Platform.select({
    ios: Math.max(20, insets.bottom),
    android: Math.max(20, insets.bottom + 20),
    default: 20,
  });

  useEffect(() => {
    console.log('[TabsLayout] Initial Mount');
    console.log('[TabsLayout] Current State:', {
      pathname,
      showSettings,
      isSearchVisible,
      loading,
      hasUser: !!user,
      isDarkMode
    });

    const setupNavigation = async () => {
      if (Platform.OS === 'android') {
        // Set navigation bar to translucent
        await NavigationBar.setBackgroundColorAsync('transparent');
        await NavigationBar.setButtonStyleAsync(isDarkMode ? 'light' : 'dark');
        // Enable gesture navigation
        await NavigationBar.setBehaviorAsync('overlay-swipe');
        await NavigationBar.setPositionAsync('absolute');
        // Hide status bar for immersive experience
        StatusBar.setHidden(true);
      }
    };

    setupNavigation();

    const showSettingsListener = DeviceEventEmitter.addListener('showSettings', () => {
      console.log('[TabsLayout] showSettings event received');
      console.log('[TabsLayout] Current showSettings state:', showSettings);
      setShowSettings(true);
      console.log('[TabsLayout] showSettings state after update:', true);
    });

    const showSettingsModalListener = DeviceEventEmitter.addListener('showSettingsModal', () => {
      console.log('[TabsLayout] showSettingsModal event received');
      console.log('[TabsLayout] Current showSettings state:', showSettings);
      setShowSettings(true);
      console.log('[TabsLayout] showSettings state after update:', true);
    });

    const showSearchListener = DeviceEventEmitter.addListener('showSearch', () => {
      setIsSearchVisible(true);
    });

    // Listen for genre search requests
    const openGenreSearchListener = DeviceEventEmitter.addListener('openGenreSearch', (genre) => {
      console.log('[TabsLayout] Genre search requested for:', genre);
      
      // Directly show the search modal first
      setIsSearchVisible(true);
      console.log('[TabsLayout] Setting search visible to true');
      
      // Then after a short delay, emit the event to set up the search filter
      setTimeout(() => {
        console.log('[TabsLayout] Emitting openMangaGenreSearch event');
        DeviceEventEmitter.emit('openMangaGenreSearch', genre);
      }, 500);
    });

    // Listen for anime genre search requests
    const openAnimeGenreSearchListener = DeviceEventEmitter.addListener('openAnimeGenreSearch', (genre) => {
      console.log('[TabsLayout] Anime genre search requested for:', genre);
      
      // Directly show the search modal
      setIsSearchVisible(true);
      console.log('[TabsLayout] Setting anime search visible for genre:', genre);
    });

    return () => {
      showSettingsListener.remove();
      showSettingsModalListener.remove();
      showSearchListener.remove();
      openGenreSearchListener.remove();
      openAnimeGenreSearchListener.remove();
    };
  }, []);

  // Add log for showSettings state changes
  useEffect(() => {
    console.log('[TabsLayout] showSettings state changed:', showSettings);
  }, [showSettings]);

  useEffect(() => {
    console.log('TabsLayout - Initial Mount');
    console.log('TabsLayout - Initial State:', {
      pathname,
      loading,
      hasUser: !!user,
      userData: user ? { id: user.id, name: user.name } : null
    });

    // Only redirect if we're not loading and have no user
    if (!loading && !user) {
      console.log('TabsLayout - No user, redirecting to welcome');
      router.replace('/welcome');
      return;
    }
  }, [user, loading, pathname]);

  // Add an effect to reset modal state when navigating
  useEffect(() => {
    // Reset modals when path changes (ensures clean state after navigating)
    setShowSettings(false);
    setIsSearchVisible(false);
  }, [pathname]);

  // Show loading state
  if (loading) {
    console.log('TabsLayout - Still Loading, returning null');
    return null;
  }

  // Return null if no user (redirect will happen in useEffect)
  if (!user) {
    return null;
  }

  console.log('TabsLayout - Rendering Tabs, Current Path:', pathname);
  return (
    <>
      {/* Main content */}
      <View style={styles.container}>
        <Tabs
          screenOptions={{
            tabBarStyle: {
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              backgroundColor: isDarkMode 
                ? 'rgba(18, 18, 18, 0.98)'
                : 'rgba(255, 255, 255, 0.98)',
              height: Platform.select({
                ios: 95,
                android: 75 + (insets.bottom > 0 ? insets.bottom : 16),
                default: 75
              }),
              paddingBottom: Platform.select({
                ios: insets.bottom + 8,
                android: insets.bottom > 0 ? insets.bottom + 8 : 24,
                default: 8
              }),
              paddingTop: 12,
              paddingHorizontal: 8,
              borderTopWidth: 0,
              elevation: 0,
              zIndex: 999,
            },
            tabBarItemStyle: {
              height: 60,
              paddingTop: 8,
              paddingBottom: 8,
            },
            tabBarActiveTintColor: '#02A9FF',
            tabBarInactiveTintColor: isDarkMode 
              ? 'rgba(255, 255, 255, 0.7)'
              : 'rgba(0, 0, 0, 0.6)',
            headerStyle: {
              backgroundColor: isDarkMode
                ? '#000000'
                : '#FFFFFF',
              height: Platform.OS === 'ios' ? 100 : 80,
              borderBottomWidth: 1,
              borderBottomColor: isDarkMode 
                ? 'rgba(255, 255, 255, 0.1)'
                : 'rgba(0, 0, 0, 0.1)',
            },
            headerTitleStyle: {
              display: 'none',
            },
            headerShown: true,
            headerShadowVisible: false,
            headerLeft: () => null,
            headerRight: () => (
              <View style={styles.headerRight}>
                <HeaderButton
                  icon={<FontAwesome5 name="search" size={20} color="#02A9FF" />}
                  onPress={() => setIsSearchVisible(true)}
                  isDarkMode={isDarkMode}
                />
                <HeaderButton
                  icon={
                    user?.avatar?.large ? (
                      <Image
                        source={{ uri: user.avatar.large }}
                        style={styles.headerAvatar}
                      />
                    ) : (
                      <FontAwesome5 name="user-circle" size={24} color="#02A9FF" />
                    )
                  }
                  onPress={() => {
                    console.log('Profile button clicked, showing settings modal');
                    setShowSettings(true);
                  }}
                  isDarkMode={isDarkMode}
                />
              </View>
            ),
          }}
        >
          <Tabs.Screen
            name="@anime"
            options={{
              title: 'Watch',
              tabBarLabel: () => null,
              tabBarIcon: ({ color, focused }) => (
                <TabIcon 
                  name="tv" 
                  label="Watch"
                  color={color}
                  focused={focused}
                  isDarkMode={isDarkMode}
                />
              ),
            }}
          />
          <Tabs.Screen
            name="index"
            options={{
              title: 'Home',
              tabBarLabel: () => null,
              tabBarIcon: ({ color, focused }) => (
                <TabIcon 
                  name="home" 
                  label="Home"
                  color={color}
                  focused={focused}
                  isDarkMode={isDarkMode}
                />
              ),
            }}
          />
          <Tabs.Screen
            name="@manga"
            options={{
              title: 'Read',
              tabBarLabel: () => null,
              tabBarIcon: ({ color, focused }) => (
                <TabIcon 
                  name="book" 
                  label="Read"
                  color={color}
                  focused={focused}
                  isDarkMode={isDarkMode}
                />
              ),
            }}
          />
        </Tabs>
      </View>

      {/* Modals - Render outside the main View to ensure they're on top */}
      {isAnimePage && (
        <AnimeSearchGlobal visible={isSearchVisible} onClose={() => setIsSearchVisible(false)} />
      )}
      {isMangaPage && (
        <MangaSearchGlobal visible={isSearchVisible} onClose={() => setIsSearchVisible(false)} />
      )}
      {!isAnimePage && !isMangaPage && (
        <GlobalSearch visible={isSearchVisible} onClose={() => setIsSearchVisible(false)} />
      )}
      
      {/* AppSettingsModal rendered at the root level */}
      <AppSettingsModal 
        visible={showSettings} 
        onClose={() => setShowSettings(false)} 
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
  },
  headerRight: {
    marginRight: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerButton: {
    padding: 4,
  },
  headerButtonInner: {
    padding: 8,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerButtonDark: {
    backgroundColor: 'rgba(2, 169, 255, 0.15)',
  },
  headerButtonLight: {
    backgroundColor: 'rgba(2, 169, 255, 0.1)',
  },
  headerAvatar: {
    width: 32,
    height: 32,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#02A9FF',
  },
  tabContainer: {
    width: 80,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  tabContent: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    gap: 4,
  },
  label: {
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 2,
  },
  indicator: {
    position: 'absolute',
    bottom: -2,
    width: 16,
    height: 2,
    borderRadius: 1,
  },
});
