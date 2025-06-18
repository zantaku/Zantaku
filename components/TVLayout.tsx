import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  ScrollView,
  Animated,
  Platform,
  BackHandler,
  DeviceEventEmitter,
  PixelRatio,
} from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { useRouter, usePathname } from 'expo-router';
import { BlurView } from 'expo-blur';
import { getTVLayoutConfig, getTVScreenDimensions } from '../utils/tvDetection';
import TVScaleContainer from './TVScaleContainer';

// Conditionally import TV components
let TVFocusGuideView: any = View;

try {
  const rn = require('react-native');
  TVFocusGuideView = rn.TVFocusGuideView || View;
} catch (error) {
  console.log('react-native-tvos components not available, using fallbacks');
}

// Get ACTUAL screen dimensions - not scaled dp
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('screen');
const PIXEL_RATIO = PixelRatio.get();
const ACTUAL_WIDTH = SCREEN_WIDTH * PIXEL_RATIO;
const ACTUAL_HEIGHT = SCREEN_HEIGHT * PIXEL_RATIO;

console.log('🔥 TVLayout Raw Dimensions:', {
  screenDp: { width: SCREEN_WIDTH, height: SCREEN_HEIGHT },
  pixelRatio: PIXEL_RATIO,
  actualPixels: { width: ACTUAL_WIDTH, height: ACTUAL_HEIGHT }
});

interface TVLayoutProps {
  children: React.ReactNode;
}

interface TVNavItem {
  key: string;
  title: string;
  icon: string;
  route: string;
}

const TV_NAV_ITEMS: TVNavItem[] = [
  {
    key: 'home',
    title: 'Home',
    icon: 'home',
    route: '/',
  },
  {
    key: 'anime',
    title: 'Watch',
    icon: 'play-circle',
    route: '/@anime',
  },
  {
    key: 'manga',
    title: 'Read',
    icon: 'book',
    route: '/@manga',
  },
];

export default function TVLayout({ children }: TVLayoutProps) {
  const { currentTheme, isDarkMode } = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  const [selectedNavIndex, setSelectedNavIndex] = useState(0);
  const [isNavFocused, setIsNavFocused] = useState(true);
  const [showInstructions, setShowInstructions] = useState(true);
  const tvConfig = getTVLayoutConfig();
  
  // Get TV dimensions dynamically for inline styles
  const tvDims = getTVScreenDimensions();

  // Debug TV dimensions
  useEffect(() => {
    console.log('🔥 TV Layout Dimensions:', { 
      dp: tvDims.dp,
      pixels: tvDims.pixels,
      pixelRatio: tvDims.pixelRatio,
      isTV: Platform.isTV,
      usingWidth: SCREEN_WIDTH,
      usingHeight: SCREEN_HEIGHT,
      hasTVFocusGuideView: TVFocusGuideView !== View,
    });
  }, []);
  
  // Animation values
  const navOpacity = useRef(new Animated.Value(1)).current;
  const focusScale = useRef(new Animated.Value(1.05)).current;
  const instructionsOpacity = useRef(new Animated.Value(1)).current;
  
  // Refs for focus management
  const navItemRefs = useRef<Array<any>>([]);

  useEffect(() => {
    // Update selected nav based on current route
    const currentIndex = TV_NAV_ITEMS.findIndex(item => 
      pathname === item.route || 
      (item.route === '/' && pathname === '/index') ||
      (item.route === '/@anime' && pathname.startsWith('/anime')) ||
      (item.route === '/@manga' && pathname.startsWith('/manga'))
    );
    if (currentIndex !== -1) {
      setSelectedNavIndex(currentIndex);
    }
  }, [pathname]);

  useEffect(() => {
    // Hide instructions after 5 seconds
    const timer = setTimeout(() => {
      Animated.timing(instructionsOpacity, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }).start(() => setShowInstructions(false));
    }, 5000);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    // Fallback Android back button handling
    if (Platform.OS === 'android') {
      const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
        if (isNavFocused) {
          return false;
        } else {
          setIsNavFocused(true);
          animateNavFocus(true);
          return true;
        }
      });

      return () => {
        backHandler.remove();
      };
    }
  }, [selectedNavIndex, isNavFocused]);

  const handleNavigation = (direction: 'left' | 'right' | 'up' | 'down') => {
    console.log('🔥 TV Navigation:', direction, { isNavFocused, selectedNavIndex });
    
    if (isNavFocused) {
      // Navigate within top nav
      if (direction === 'left' && selectedNavIndex > 0) {
        setSelectedNavIndex(selectedNavIndex - 1);
      } else if (direction === 'right' && selectedNavIndex < TV_NAV_ITEMS.length - 1) {
        setSelectedNavIndex(selectedNavIndex + 1);
      } else if (direction === 'down') {
        // Move focus to content
        setIsNavFocused(false);
        animateNavFocus(false);
        // Emit event to focus first content item
        DeviceEventEmitter.emit('tvFocusContent');
      }
    } else {
      // Handle content navigation
      if (direction === 'up') {
        // Move focus back to nav
        setIsNavFocused(true);
        animateNavFocus(true);
      } else {
        // Pass navigation to content
        DeviceEventEmitter.emit('tvNavigate', { direction });
      }
    }
  };

  const handleSelect = () => {
    console.log('🔥 TV Select:', { isNavFocused, selectedNavIndex });
    
    if (isNavFocused) {
      // Select nav item
      const selectedItem = TV_NAV_ITEMS[selectedNavIndex];
      handleNavItemPress(selectedItem);
    } else {
      // Pass select to content
      DeviceEventEmitter.emit('tvSelect');
    }
  };

  const handleMenu = () => {
    console.log('🔥 TV Menu pressed');
    // Show settings or search
    if (selectedNavIndex === TV_NAV_ITEMS.length - 1) {
      DeviceEventEmitter.emit('showSearch');
    } else {
      DeviceEventEmitter.emit('showSettings');
    }
  };

  const handleBack = () => {
    if (!isNavFocused) {
      // Focus back to nav
      setIsNavFocused(true);
      animateNavFocus(true);
    }
  };

  const animateNavFocus = (focused: boolean) => {
    Animated.parallel([
      Animated.timing(navOpacity, {
        toValue: focused ? 1 : 0.8,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(focusScale, {
        toValue: focused ? 1.05 : 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handleNavItemPress = (item: TVNavItem) => {
    console.log('TV Nav: Navigating to', item.route);
    router.push(item.route as any);
    setIsNavFocused(false);
    animateNavFocus(false);
    // Focus content after navigation
    setTimeout(() => {
      DeviceEventEmitter.emit('tvFocusContent');
    }, 300);
  };

  const renderNavItem = (item: TVNavItem, index: number) => {
    const isSelected = index === selectedNavIndex;
    const isFocused = isNavFocused && isSelected;
    
    return (
      <TouchableOpacity
        key={item.key}
        ref={(ref) => navItemRefs.current[index] = ref}
        style={[
          styles.navItem,
          isSelected && styles.navItemSelected,
          isFocused && styles.navItemFocused,
        ]}
        onPress={() => handleNavItemPress(item)}
        onFocus={() => {
          console.log('🔥 Nav item focused:', item.key);
          setSelectedNavIndex(index);
          setIsNavFocused(true);
        }}
        onBlur={() => {
          console.log('🔥 Nav item blurred:', item.key);
        }}
        activeOpacity={0.8}
        hasTVPreferredFocus={index === 0} // First item gets initial focus
      >
        <Animated.View
          style={[
            styles.navItemContent,
            {
              transform: [
                { scale: isFocused ? 1.1 : 1 }
              ]
            }
          ]}
        >
          <FontAwesome5
            name={item.icon}
            size={24}
            color={isSelected ? '#02A9FF' : currentTheme.colors.text}
            style={styles.navIcon}
          />
          <Text
            style={[
              styles.navText,
              {
                color: isSelected ? '#02A9FF' : currentTheme.colors.text,
                fontWeight: isFocused ? 'bold' : '600',
              }
            ]}
          >
            {item.title}
          </Text>
        </Animated.View>
        {isSelected && (
          <Animated.View 
            style={[
              styles.navIndicator, 
              { 
                backgroundColor: '#02A9FF',
                transform: [{ scaleX: isFocused ? 1.2 : 1 }]
              }
            ]} 
          />
        )}
      </TouchableOpacity>
    );
  };

  if (!tvConfig) {
    // Not a TV environment, return children as-is
    return <>{children}</>;
  }

  return (
    <View style={[
      styles.tvContainer,
      {
        width: ACTUAL_WIDTH,
        height: ACTUAL_HEIGHT,
        backgroundColor: currentTheme.colors.background
      }
    ]}>
      {/* Top Navigation Bar */}
      <Animated.View
        style={[
          styles.tvNavBar,
          {
            width: ACTUAL_WIDTH,
            opacity: navOpacity,
            backgroundColor: isDarkMode 
              ? 'rgba(0, 0, 0, 0.95)' 
              : 'rgba(255, 255, 255, 0.95)',
            transform: [{ scale: isNavFocused ? focusScale : new Animated.Value(1) }]
          }
        ]}
      >
        <BlurView
          tint={isDarkMode ? 'dark' : 'light'}
          intensity={90}
          style={StyleSheet.absoluteFill}
        />
        
        <View style={[styles.tvNavContainer, { 
          width: ACTUAL_WIDTH,
          paddingHorizontal: ACTUAL_WIDTH * 0.05, // 5% of actual screen width
        }]}>
          <View style={styles.logoContainer}>
            <Text style={[styles.logoText, { color: '#02A9FF' }]}>
              ZanTaku
            </Text>
            <Text style={[styles.logoSubtext, { color: currentTheme.colors.text }]}>
              TV
            </Text>
          </View>
          
          <View style={styles.navItems}>
            {TV_NAV_ITEMS.map((item, index) => renderNavItem(item, index))}
          </View>
          
          <View style={styles.navActions}>
            <TouchableOpacity 
              style={[
                styles.actionButton,
                { 
                  backgroundColor: isNavFocused ? 'rgba(2, 169, 255, 0.2)' : 'rgba(255, 255, 255, 0.1)',
                }
              ]}
              onPress={() => DeviceEventEmitter.emit('showSearch')}
            >
              <FontAwesome5
                name="search"
                size={28}
                color={currentTheme.colors.text}
              />
            </TouchableOpacity>
            <TouchableOpacity 
              style={[
                styles.actionButton,
                { 
                  backgroundColor: isNavFocused ? 'rgba(2, 169, 255, 0.2)' : 'rgba(255, 255, 255, 0.1)',
                }
              ]}
              onPress={() => DeviceEventEmitter.emit('showSettings')}
            >
              <FontAwesome5
                name="cog"
                size={28}
                color={currentTheme.colors.text}
              />
            </TouchableOpacity>
          </View>
        </View>
      </Animated.View>

      {/* Main Content - PIXEL-PERFECT SCALING */}
      <View style={[
        styles.tvContentArea,
        { 
          width: ACTUAL_WIDTH,
          height: ACTUAL_HEIGHT - 120, // Subtract nav height
        }
      ]}>
        <TVScaleContainer>
          {children}
        </TVScaleContainer>
      </View>

      {/* TV Remote Instructions */}
      {showInstructions && (
        <Animated.View 
          style={[
            styles.instructionsOverlay,
            { 
              opacity: instructionsOpacity,
              bottom: ACTUAL_HEIGHT * 0.1, // 10% from bottom
              left: ACTUAL_WIDTH * 0.1, // 10% from left
              right: ACTUAL_WIDTH * 0.1, // 10% from right
            }
          ]}
        >
          <View style={[
            styles.instructionsContainer,
            { backgroundColor: isDarkMode ? 'rgba(0, 0, 0, 0.9)' : 'rgba(255, 255, 255, 0.9)' }
          ]}>
            <Text style={[styles.instructionsTitle, { color: '#02A9FF', fontSize: 24 }]}>
              TV Remote Controls
            </Text>
            <Text style={[styles.instructionsText, { color: currentTheme.colors.text, fontSize: 18 }]}>
              ← → Navigate menu • ↑ ↓ Switch focus • Select to choose • Menu for options
            </Text>
          </View>
        </Animated.View>
      )}

      {/* Focus indicator for debugging */}
      {__DEV__ && (
        <View style={[styles.debugInfo, {
          top: 130,
          right: 30,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          padding: 12,
          borderRadius: 8,
        }]}>
          <Text style={{ color: '#02A9FF', fontSize: 16, fontWeight: 'bold' }}>
            🚀 PIXEL-PERFECT TV DEBUG
          </Text>
          <Text style={{ color: '#02A9FF', fontSize: 14 }}>
            Nav Focus: {isNavFocused ? 'YES' : 'NO'} | Selected: {selectedNavIndex}
          </Text>
          <Text style={{ color: 'lime', fontSize: 12, fontWeight: 'bold' }}>
            FORCED: {ACTUAL_WIDTH}x{ACTUAL_HEIGHT} pixels
          </Text>
          <Text style={{ color: '#02A9FF', fontSize: 12 }}>
            React Native DP: {SCREEN_WIDTH}x{SCREEN_HEIGHT}
          </Text>
          <Text style={{ color: '#02A9FF', fontSize: 12 }}>
            Pixel Ratio: {PIXEL_RATIO}x
          </Text>
          <Text style={{ color: 'yellow', fontSize: 11 }}>
            Logo: {Math.round(ACTUAL_WIDTH * 0.15)}px | Nav: {Math.round(ACTUAL_WIDTH * 0.6)}px
          </Text>
          <Text style={{ color: 'yellow', fontSize: 11 }}>
            Actions: {Math.round(ACTUAL_WIDTH * 0.15)}px | Item: {Math.round(ACTUAL_WIDTH * 0.12)}px
          </Text>
          <Text style={{ color: '#02A9FF', fontSize: 12 }}>
            Platform.isTV: {Platform.isTV ? 'YES' : 'NO'}
          </Text>
        </View>
      )}
      
      {/* PIXEL-PERFECT SCREEN BORDER DEBUG */}
      {__DEV__ && (
        <>
          <View style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: ACTUAL_WIDTH,
            height: 8,
            backgroundColor: 'lime',
            zIndex: 9999
          }} />
          <View style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            width: ACTUAL_WIDTH,
            height: 8,
            backgroundColor: 'lime',
            zIndex: 9999
          }} />
          <View style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: 8,
            height: ACTUAL_HEIGHT,
            backgroundColor: 'lime',
            zIndex: 9999
          }} />
          <View style={{
            position: 'absolute',
            top: 0,
            right: 0,
            width: 8,
            height: ACTUAL_HEIGHT,
            backgroundColor: 'lime',
            zIndex: 9999
          }} />
          {/* CENTER CROSSHAIR */}
          <View style={{
            position: 'absolute',
            top: ACTUAL_HEIGHT / 2 - 2,
            left: 0,
            width: ACTUAL_WIDTH,
            height: 4,
            backgroundColor: 'red',
            zIndex: 9999
          }} />
          <View style={{
            position: 'absolute',
            top: 0,
            left: ACTUAL_WIDTH / 2 - 2,
            width: 4,
            height: ACTUAL_HEIGHT,
            backgroundColor: 'red',
            zIndex: 9999
          }} />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // TV-specific container styles that override React Native constraints
  tvContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
  },
  tvNavBar: {
    height: 120,
    position: 'absolute',
    top: 0,
    left: 0,
    zIndex: 1000,
    borderBottomWidth: 3,
    borderBottomColor: 'rgba(2, 169, 255, 0.3)',
  },
  tvNavContainer: {
    height: 120,
    flexDirection: 'row',
    alignItems: 'center',
  },
  tvContentArea: {
    position: 'absolute',
    top: 120, // Below nav bar
    left: 0,
    paddingVertical: 40,
  },
  // Legacy mobile styles
  navContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoContainer: {
    marginRight: ACTUAL_WIDTH * 0.05, // Pixel-based margin
    alignItems: 'flex-start', // No centering
    width: ACTUAL_WIDTH * 0.15, // Fixed width for logo area
  },
  logoText: {
    fontSize: 42,
    fontWeight: 'bold',
  },
  logoSubtext: {
    fontSize: 18,
    fontWeight: '600',
    opacity: 0.7,
    marginTop: -6,
  },
  navItems: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around', // Spread based on screen size
    width: ACTUAL_WIDTH * 0.6, // Fixed width for nav area
    paddingHorizontal: ACTUAL_WIDTH * 0.02, // Pixel-based padding
  },
  navItem: {
    paddingVertical: 20,
    paddingHorizontal: 32,
    borderRadius: 16,
    position: 'relative',
    width: ACTUAL_WIDTH * 0.12, // Fixed pixel-based width
    alignItems: 'center',
    // Debug border to see actual touchable area
    backgroundColor: __DEV__ ? 'rgba(255, 0, 0, 0.1)' : 'transparent',
    borderWidth: __DEV__ ? 2 : 0,
    borderColor: __DEV__ ? 'yellow' : 'transparent',
  },
  navItemSelected: {
    backgroundColor: 'rgba(2, 169, 255, 0.15)',
  },
  navItemFocused: {
    backgroundColor: 'rgba(2, 169, 255, 0.25)',
    borderWidth: 3,
    borderColor: '#02A9FF',
    shadowColor: '#02A9FF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 10,
  },
  navItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  navIcon: {
    marginRight: 16,
  },
  navText: {
    fontSize: 22,
    fontWeight: '600',
  },
  navIndicator: {
    position: 'absolute',
    bottom: -4,
    left: 32,
    right: 32,
    height: 6,
    borderRadius: 3,
  },
  navActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    width: ACTUAL_WIDTH * 0.15, // Fixed width for actions area
    paddingHorizontal: ACTUAL_WIDTH * 0.01,
  },
  actionButton: {
    padding: 20,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    width: ACTUAL_WIDTH * 0.06, // Fixed pixel-based width
    height: ACTUAL_WIDTH * 0.06, // Square buttons
    alignItems: 'center',
    justifyContent: 'center',
    // Debug border
    borderWidth: __DEV__ ? 2 : 0,
    borderColor: __DEV__ ? 'cyan' : 'transparent',
  },
  instructionsOverlay: {
    position: 'absolute',
    bottom: 60,
    left: 60,
    right: 60,
    alignItems: 'center',
  },
  instructionsContainer: {
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(2, 169, 255, 0.3)',
  },
  instructionsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  instructionsText: {
    fontSize: 14,
    opacity: 0.9,
    textAlign: 'center',
  },
  debugInfo: {
    position: 'absolute',
    top: 100,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 8,
    borderRadius: 4,
  },
});