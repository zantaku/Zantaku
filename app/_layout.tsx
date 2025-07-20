import { Stack } from 'expo-router';
import React from 'react';
import { Platform, TouchableOpacity, View, Text, StyleSheet, DeviceEventEmitter, StatusBar } from 'react-native';
import { ThemeProvider, useTheme } from '../hooks/useTheme';
import { IncognitoProvider, useIncognito } from '../hooks/useIncognito';
import { OrientationProvider } from '../hooks/useOrientation';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { FontAwesome5, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState, useEffect, Component } from 'react';
import SplashScreen from '../components/SplashScreen';
import { Provider as PaperProvider } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { PlayerProvider } from '../contexts/PlayerContext';
import { PortalProvider } from '@gorhom/portal';
import { Slot } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DiscordRPCProvider } from '../contexts/DiscordRPCContext';
import * as Font from 'expo-font';

// Incognito mode indicator component
function IncognitoIndicator() {
  const { isIncognito } = useIncognito();
  const insets = useSafeAreaInsets();
  
  if (!isIncognito) return null;
  
  return (
    <View style={[
      styles.incognitoIndicator,
      { top: insets.top > 0 ? insets.top + 5 : 5 }
    ]}>
      <View style={styles.incognitoContent}>
        <FontAwesome5 name="user-secret" size={9} color="#999999" style={{marginRight: 4}} />
        <Text style={styles.incognitoText}>Incognito</Text>
      </View>
    </View>
  );
}

interface RouteParams {
  title?: string;
  [key: string]: any;
}

function ThemedLayout() {
  const { isDarkMode, currentTheme } = useTheme();
  const [isLiked, setIsLiked] = useState(false);
  const router = useRouter();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    StatusBar.setHidden(true);
    const updateLikeStatus = DeviceEventEmitter.addListener('updateLikeStatus', (status: boolean) => {
      setIsLiked(status);
    });

    return () => {
      updateLikeStatus.remove();
    };
  }, []);

  return (
    <>
      <StatusBar hidden={true} />
      <IncognitoIndicator />
      <Stack
        screenOptions={{
          headerStyle: {
            backgroundColor: currentTheme.colors.background,
          },
          headerTintColor: currentTheme.colors.text,
          headerShadowVisible: false,
          headerBackTitle: '',
          headerTitleStyle: {
            color: currentTheme.colors.text,
            fontSize: 16,
            fontWeight: '600',
          },
          contentStyle: {
            paddingTop: useIncognito().isIncognito ? 5 : 0,
          }
        }}
      >
        <Stack.Screen
          name="(tabs)"
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="index"
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="watchlist"
          options={{
            headerTransparent: true,
            headerBlurEffect: isDarkMode ? 'dark' : 'light',
            headerBackground: () => (
              <BlurView 
                tint={isDarkMode ? 'dark' : 'light'} 
                intensity={100} 
                style={StyleSheet.absoluteFill} 
              />
            ),
            headerTitle: () => (
              <View style={styles.headerTitle}>
                <Text 
                  style={[styles.headerTitleText, { color: currentTheme.colors.text }]}
                  numberOfLines={1}
                >
                  Watchlist
                </Text>
              </View>
            ),
          }}
        />
        <Stack.Screen
          name="readlist"
          options={{
            headerTransparent: true,
            headerBlurEffect: isDarkMode ? 'dark' : 'light',
            headerBackground: () => (
              <BlurView 
                tint={isDarkMode ? 'dark' : 'light'} 
                intensity={100} 
                style={StyleSheet.absoluteFill} 
              />
            ),
            headerTitle: () => (
              <View style={styles.headerTitle}>
                <Text 
                  style={[styles.headerTitleText, { color: currentTheme.colors.text }]}
                  numberOfLines={1}
                >
                  Reading List
                </Text>
              </View>
            ),
          }}
        />
        <Stack.Screen
          name="activitiespage"
          options={{
            headerTransparent: true,
            headerBlurEffect: isDarkMode ? 'dark' : 'light',
            headerBackground: () => (
              <BlurView 
                tint={isDarkMode ? 'dark' : 'light'} 
                intensity={100} 
                style={StyleSheet.absoluteFill} 
              />
            ),
            headerTitle: () => (
              <View style={styles.headerTitle}>
                <Text 
                  style={[styles.headerTitleText, { color: currentTheme.colors.text }]}
                  numberOfLines={1}
                >
                  Activities
                </Text>
              </View>
            ),
          }}
        />
        <Stack.Screen
          name="player"
          options={{
            headerShown: false,
            presentation: 'fullScreenModal',
            animation: 'fade',
          }}
        />
        <Stack.Screen
          name="reader"
          options={{
            headerShown: false,
            presentation: 'fullScreenModal',
            animation: 'fade',
            orientation: 'default',
            navigationBarHidden: true,
            statusBarHidden: true,
            contentStyle: {
              backgroundColor: '#000',
            },
          }}
        />
        <Stack.Screen 
          name="novelreader"
          options={{
            headerShown: false,
            presentation: 'fullScreenModal',
            animation: 'fade',
            orientation: 'default',
            navigationBarHidden: true,
            statusBarHidden: true,
            contentStyle: {
              backgroundColor: '#000',
            },
          }}
        />
        <Stack.Screen
          name="webnovelreader"
          options={{
            headerShown: false,
            presentation: 'fullScreenModal',
            animation: 'fade',
            orientation: 'default',
            navigationBarHidden: true,
            statusBarHidden: true,
            contentStyle: {
              backgroundColor: '#000',
            },
          }}
        />
        <Stack.Screen
          name="notificationhistory"
          options={{
            headerShown: false,
            presentation: 'card',
            animation: 'slide_from_right',
          }}
        />
        <Stack.Screen
          name="notifications"
          options={{
            headerTransparent: true,
            headerBlurEffect: isDarkMode ? 'dark' : 'light',
            headerBackground: () => (
              <BlurView 
                tint={isDarkMode ? 'dark' : 'light'} 
                intensity={100} 
                style={StyleSheet.absoluteFill} 
              />
            ),
            headerTitle: () => (
              <View style={styles.headerTitle}>
                <Text 
                  style={[styles.headerTitleText, { color: currentTheme.colors.text }]}
                  numberOfLines={1}
                >
                  Notifications
                </Text>
              </View>
            ),
            headerRight: () => (
              <TouchableOpacity 
                style={styles.headerButton}
                onPress={() => DeviceEventEmitter.emit('clearNotifications')}
              >
                <Text style={[{ color: currentTheme.colors.text, fontSize: 16, fontWeight: '600' }]}>
                  Clear
                </Text>
              </TouchableOpacity>
            ),
          }}
        />
        <Stack.Screen
          name="theme"
          options={{
            headerShown: false,
            presentation: 'card',
            animation: 'slide_from_right',
          }}
        />
        <Stack.Screen
          name="appsettings"
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="appsettings/themesettings"
          options={{
            headerShown: false,
            presentation: 'modal',
            animation: 'slide_from_right',
          }}
        />
        <Stack.Screen
          name="appsettings/commonsetting"
          options={{
            headerShown: false,
            presentation: 'modal',
            animation: 'slide_from_right',
          }}
        />
        <Stack.Screen
          name="appsettings/accountsetting"
          options={{
            headerShown: false,
            presentation: 'modal',
            animation: 'slide_from_right',
          }}
        />
        <Stack.Screen
          name="appsettings/homesections"
          options={{
            headerShown: false,
            presentation: 'modal',
            animation: 'slide_from_right',
          }}
        />
        <Stack.Screen
          name="appsettings/animesettings"
          options={{
            headerShown: false,
            presentation: 'modal',
            animation: 'slide_from_right',
          }}
        />
        <Stack.Screen
          name="appsettings/mangasettings"
          options={{
            headerShown: false,
            presentation: 'modal',
            animation: 'slide_from_right',
          }}
        />
        <Stack.Screen
          name="appsettings/novelsettings"
          options={{
            headerShown: false,
            presentation: 'modal',
            animation: 'slide_from_right',
          }}
        />
        <Stack.Screen
          name="appsettings/newssettings"
          options={{
            headerShown: false,
            presentation: 'modal',
            animation: 'slide_from_right',
          }}
        />
        <Stack.Screen
          name="appsettings/api"
          options={{
            headerShown: false,
            presentation: 'modal',
            animation: 'slide_from_right',
          }}
        />
        <Stack.Screen
          name="settings"
          options={{
            headerShown: false,
            presentation: 'modal',
            animation: 'slide_from_right',
          }}
        />
        <Stack.Screen
          name="welcome"
          options={{
            headerShown: false,
            presentation: 'card',
            animation: 'fade',
          }}
        />
        <Stack.Screen
          name="profile"
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="anime/[id]"
          options={{
            headerShown: false,
            presentation: 'card',
            animation: 'slide_from_right',
          }}
        />
        <Stack.Screen
          name="manga/[id]"
          options={{
            headerShown: false,
            presentation: 'card',
            animation: 'slide_from_right',
          }}
        />
        <Stack.Screen
          name="character/[id]"
          options={({ route }) => ({
            headerShown: true,
            headerTransparent: true,
            headerBlurEffect: isDarkMode ? 'dark' : 'light',
            headerBackground: () => (
              <BlurView 
                tint={isDarkMode ? 'dark' : 'light'} 
                intensity={100} 
                style={StyleSheet.absoluteFill} 
              />
            ),
            headerTitle: () => (
              <View style={styles.headerTitle}>
                <Text 
                  style={[styles.headerTitleText, { color: currentTheme.colors.text }]}
                  numberOfLines={1}
                >
                </Text>
              </View>
            ),
            headerRight: () => (
              <View style={styles.headerButtons}>
                <TouchableOpacity 
                  style={styles.headerButton}
                  onPress={() => DeviceEventEmitter.emit('shareCharacter')}
                >
                  <FontAwesome5 
                    name="share-alt" 
                    size={20} 
                    color={currentTheme.colors.text} 
                  />
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.headerButton}
                  onPress={() => DeviceEventEmitter.emit('toggleFavorite')}
                >
                  <FontAwesome5 
                    name="star" 
                    size={20} 
                    color={currentTheme.colors.text}
                  />
                </TouchableOpacity>
              </View>
            ),
          })}
        />
        <Stack.Screen 
          name="staff/[id]"
          options={({ route }) => ({
            headerShown: true,
            headerTransparent: true,
            headerBlurEffect: isDarkMode ? 'dark' : 'light',
            headerBackground: () => (
              <BlurView 
                tint={isDarkMode ? 'dark' : 'light'} 
                intensity={100} 
                style={StyleSheet.absoluteFill} 
              />
            ),
            headerTitle: () => (
              <View style={styles.headerTitle}>
                <Text 
                  style={[styles.headerTitleText, { color: currentTheme.colors.text }]}
                  numberOfLines={1}
                >
                </Text>
              </View>
            ),
            headerRight: () => (
              <View style={styles.headerButtons}>
                <TouchableOpacity 
                  style={styles.headerButton}
                  onPress={() => DeviceEventEmitter.emit('shareStaff')}
                >
                  <FontAwesome5 
                    name="share-alt" 
                    size={20} 
                    color={currentTheme.colors.text} 
                  />
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.headerButton}
                  onPress={() => DeviceEventEmitter.emit('toggleFavorite')}
                >
                  <FontAwesome5 
                    name="star" 
                    size={20} 
                    color={currentTheme.colors.text}
                  />
                </TouchableOpacity>
              </View>
            ),
          })}
        />
        <Stack.Screen
          name="anime-list"
          options={{
            headerShown: false,
            presentation: 'card',
            animation: 'slide_from_right',
          }}
        />
        <Stack.Screen
          name="manga-list"
          options={{
            headerShown: false,
            presentation: 'card',
            animation: 'slide_from_right',
          }}
        />
      </Stack>
    </>
  );
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <Text style={{ fontSize: 18, marginBottom: 10 }}>Something went wrong!</Text>
          <Text style={{ color: 'red', marginBottom: 10 }}>{this.state.error?.message}</Text>
          <TouchableOpacity
            onPress={() => {
              this.setState({ hasError: false, error: null });
              DeviceEventEmitter.emit('resetApp');
            }}
            style={{ padding: 10, backgroundColor: '#007AFF', borderRadius: 5 }}
          >
            <Text style={{ color: 'white' }}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return this.props.children;
  }
}

// Create a client
const queryClient = new QueryClient();

export default function RootLayout() {
  const [showSplash, setShowSplash] = useState(true);
  const [fontsLoaded, setFontsLoaded] = useState(false);

  useEffect(() => {
    if (__DEV__) {
      console.log('App started in development mode');
    }

    // Load fonts
    const loadFonts = async () => {
      try {
        // Load basic fonts first
        await Font.loadAsync({
          ...Ionicons.font,
          ...FontAwesome5.font,
        });
        console.log('✅ Basic vector icon fonts loaded successfully');
        
        // Try to load MaterialCommunityIcons separately with error handling
        try {
          await Font.loadAsync({
            ...MaterialCommunityIcons.font,
          });
          console.log('✅ MaterialCommunityIcons loaded successfully');
        } catch (mciError) {
          console.warn('⚠️ MaterialCommunityIcons failed to load, using fallback:', mciError);
          // Continue without MaterialCommunityIcons - the app will still work
        }
        
        setFontsLoaded(true);
      } catch (error) {
        console.error('❌ Error loading fonts:', error);
        console.log('🔄 Continuing without custom fonts...');
        setFontsLoaded(true); // Continue anyway
      }
    };

    loadFonts();

    const errorHandler = (error: Error) => {
      console.error('Global error:', error);
    };

    // Set up global error handler
    const errorSubscription = DeviceEventEmitter.addListener('error', errorHandler);

    return () => {
      errorSubscription.remove();
    };
  }, []);

  // Don't render until fonts are loaded
  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' }}>
        <Text style={{ color: '#fff', fontSize: 16 }}>Loading fonts...</Text>
      </View>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <PlayerProvider>
        <ErrorBoundary>
          <SafeAreaProvider>
            <GestureHandlerRootView style={{ flex: 1 }}>
              <PaperProvider>
                <ThemeProvider>
                  <IncognitoProvider>
                    <OrientationProvider>
                      <DiscordRPCProvider>
                        <PortalProvider>
                          {showSplash ? (
                            <SplashScreen onAnimationComplete={() => setShowSplash(false)} />
                          ) : null}
                          <ThemedLayout />
                        </PortalProvider>
                      </DiscordRPCProvider>
                    </OrientationProvider>
                  </IncognitoProvider>
                </ThemeProvider>
              </PaperProvider>
            </GestureHandlerRootView>
          </SafeAreaProvider>
        </ErrorBoundary>
      </PlayerProvider>
    </QueryClientProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginRight: 16,
  },
  headerButton: {
    padding: 8,
  },
  headerTitle: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleText: {
    fontSize: 17,
    fontWeight: '600',
  },
  incognitoIndicator: {
    position: 'absolute',
    alignSelf: 'center',
    zIndex: 1000,
    backgroundColor: 'rgba(20, 20, 20, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    height: 'auto',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.5,
    shadowRadius: 2,
    elevation: 3,
  },
  incognitoContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  incognitoText: {
    color: '#999999',
    fontSize: 9,
    fontWeight: '600',
  },
});

