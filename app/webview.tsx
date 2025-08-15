import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, StyleSheet, ActivityIndicator, BackHandler, TouchableOpacity, Text, Share, Animated, Easing, Pressable, Platform, InteractionManager, Dimensions } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { WebView, WebViewNavigation } from 'react-native-webview';
import { FontAwesome5 } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as Linking from 'expo-linking';
import { useTheme, lightTheme, darkTheme } from '../hooks/useTheme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { height: screenHeight } = Dimensions.get('window');

const getHostname = (url: string): string => {
  try {
    // Basic hostname extraction without relying on URL in older RN envs
    const match = url.match(/^https?:\/\/([^\/:?#]+)(?:[\/:?#]|$)/i);
    return match?.[1] || url;
  } catch {
    return url;
  }
};

export default function WebViewScreen() {
  const { url: rawUrl, title: initialTitle } = useLocalSearchParams<{ url?: string; title?: string }>();
  const url = Array.isArray(rawUrl) ? rawUrl[0] : rawUrl;
  const router = useRouter();
  const { isDarkMode } = useTheme();
  const currentTheme = isDarkMode ? darkTheme : lightTheme;

  const webViewRef = useRef<WebView>(null);
  
  // Performance optimization refs
  const slowLoadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastProgressRef = useRef(0);

  const [pageTitle, setPageTitle] = useState<string>(initialTitle || '');
  const [currentUrl, setCurrentUrl] = useState<string>(url || '');
  const [canGoBack, setCanGoBack] = useState<boolean>(false);
  const [canGoForward, setCanGoForward] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const lastTapRef = useRef<number>(0);
  const insets = useSafeAreaInsets();
  const [isSlowLoad, setIsSlowLoad] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);
  
  // Bottom sheet animation
  const bottomSheetAnim = useRef(new Animated.Value(screenHeight)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;

  // Performance utility functions
  const safeSetSlowLoad = (v: boolean) => {
    // avoid re-render spam
    setIsSlowLoad(prev => (prev === v ? prev : v));
  };

  // Memoized values to prevent unnecessary recalculations
  const hostname = useMemo(() => getHostname(currentUrl), [currentUrl]);
  const path = useMemo(() => {
    if (!currentUrl) return '';
    const split = currentUrl.split(hostname);
    return split.length > 1 ? split[1].replace(/^\/?/, '') : '';
  }, [currentUrl, hostname]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (slowLoadTimerRef.current) clearTimeout(slowLoadTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const onBackPress = () => {
      if (isMenuOpen) {
        closeMenu();
        return true;
      }
      if (canGoBack && webViewRef.current) {
        webViewRef.current.goBack();
        return true;
      }
      router.back();
      return true;
    };

    const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => sub.remove();
  }, [canGoBack, router, isMenuOpen]);

  const onNavChange = useCallback((navState: WebViewNavigation) => {
    if (canGoBack !== !!navState.canGoBack) setCanGoBack(!!navState.canGoBack);
    // @ts-ignore RN WebView navState has canGoForward on most platforms
    const forward = !!(navState as any).canGoForward;
    if (canGoForward !== forward) setCanGoForward(forward);

    if (navState.title && navState.title !== pageTitle) setPageTitle(navState.title);
    if (navState.url && navState.url !== currentUrl) setCurrentUrl(navState.url);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canGoBack, canGoForward, pageTitle, currentUrl]);

  const headerTitle = useMemo(() => {
    if (pageTitle && pageTitle.trim().length > 0) return pageTitle;
    if (currentUrl) return getHostname(currentUrl);
    return 'Browser';
  }, [pageTitle, currentUrl]);

  const handleRefresh = () => webViewRef.current?.reload();
  const handleOpenInBrowser = () => {
    if (currentUrl) Linking.openURL(currentUrl);
  };
  const handleShare = async () => {
    if (!currentUrl) return;
    // Defer heavy work to prevent blocking paint
    InteractionManager.runAfterInteractions(async () => {
      try {
        await Share.share({ message: currentUrl, url: currentUrl });
      } catch {}
    });
  };
  const handleCopy = async () => {
    if (!currentUrl) return;
    await Clipboard.setStringAsync(currentUrl);
  };

  const handleHeaderDoubleTap = () => {
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      handleRefresh();
    }
    lastTapRef.current = now;
  };

  const openMenu = useCallback(() => {
    setIsMenuOpen(true);
    // Animate backdrop fade in
    Animated.timing(backdropAnim, {
      toValue: 1,
      duration: 200,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
    // Animate bottom sheet slide up from bottom
    Animated.spring(bottomSheetAnim, {
      toValue: 0,
      useNativeDriver: true,
      tension: 80,
      friction: 9,
      velocity: 0.3,
    }).start();
  }, [backdropAnim, bottomSheetAnim]);

  const closeMenu = useCallback(() => {
    // Animate backdrop fade out
    Animated.timing(backdropAnim, {
      toValue: 0,
      duration: 200,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
    // Animate bottom sheet slide down to bottom
    Animated.spring(bottomSheetAnim, {
      toValue: screenHeight,
      useNativeDriver: true,
      tension: 80,
      friction: 9,
      velocity: 0.3,
    }).start(() => {
      setIsMenuOpen(false);
    });
  }, [backdropAnim, bottomSheetAnim]);

  const handleMenuAction = useCallback((action: () => void) => {
    closeMenu();
    // Small delay to ensure menu closes smoothly
    setTimeout(action, 300);
  }, [closeMenu]);

  if (!url) {
    return (
      <View style={[styles.center, { backgroundColor: currentTheme.colors.background }]}>
        <Text style={{ color: currentTheme.colors.text }}>No URL provided</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: currentTheme.colors.background }]}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Compact custom header (56dp) */}
      <Pressable onPress={handleHeaderDoubleTap} style={[styles.topBar, { paddingTop: insets.top, backgroundColor: currentTheme.colors.background, borderBottomColor: currentTheme.colors.border }]}> 
        <View style={styles.topBarContent}>
          {/* Navigation Controls */}
          <View style={styles.navControls}>
            <TouchableOpacity 
              onPress={() => (canGoBack ? webViewRef.current?.goBack() : router.back())} 
              style={[styles.navButton, !canGoBack && styles.disabledNavButton]}
              disabled={!canGoBack}
            >
              <FontAwesome5 name="chevron-left" size={18} color={canGoBack ? currentTheme.colors.text : currentTheme.colors.textSecondary} solid />
            </TouchableOpacity>
            
            <TouchableOpacity 
              onPress={() => webViewRef.current?.goForward()} 
              style={[styles.navButton, !canGoForward && styles.disabledNavButton]}
              disabled={!canGoForward}
            >
              <FontAwesome5 name="chevron-right" size={18} color={canGoForward ? currentTheme.colors.text : currentTheme.colors.textSecondary} solid />
            </TouchableOpacity>
          </View>

          {/* Title Block */}
          <View style={styles.titleBlock}>
            <Text numberOfLines={1} style={[styles.domainText, { color: currentTheme.colors.text }]}>{hostname}</Text>
            {!!path && (
              <Text numberOfLines={1} style={[styles.pathText, { color: currentTheme.colors.textSecondary }]}>/{path}</Text>
            )}
            <Text numberOfLines={1} style={[styles.pageTitle, { color: currentTheme.colors.text }]}>{headerTitle}</Text>
          </View>

          {/* Action Menu */}
          <TouchableOpacity onPress={openMenu} style={styles.menuButton}>
            <FontAwesome5 name="ellipsis-h" size={18} color={currentTheme.colors.text} />
          </TouchableOpacity>
        </View>

        {/* Progress bar */}
        <Animated.View
          style={[styles.progressBar, { backgroundColor: '#02A9FF', width: progressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }]}
        />
      </Pressable>

             {/* Modern bottom sheet */}
       {isMenuOpen && (
         <View style={styles.menuOverlay}>
           <TouchableOpacity 
             style={[styles.menuBackdrop, { opacity: backdropAnim }]} 
             onPress={closeMenu} 
             activeOpacity={1} 
           />
           <Animated.View
             style={[
               styles.bottomSheet,
               {
                 backgroundColor: currentTheme.colors.surface,
                 borderColor: currentTheme.colors.border,
                 transform: [{ translateY: bottomSheetAnim }],
               },
             ]}
           >
             {/* Bottom sheet handle */}
             <View style={[styles.bottomSheetHandle, { backgroundColor: currentTheme.colors.border }]} />
             
             {/* Menu items */}
             <View style={styles.bottomSheetContent}>
               <TouchableOpacity onPress={() => handleMenuAction(handleRefresh)} style={styles.menuItem}>
                 <FontAwesome5 name="redo" size={18} color={currentTheme.colors.text} />
                 <Text style={[styles.menuText, { color: currentTheme.colors.text }]}>Reload</Text>
               </TouchableOpacity>
               
               <TouchableOpacity onPress={() => handleMenuAction(handleShare)} style={styles.menuItem}>
                 <FontAwesome5 name="share" size={18} color={currentTheme.colors.text} />
                 <Text style={[styles.menuText, { color: currentTheme.colors.text }]}>Share</Text>
               </TouchableOpacity>
               
               <TouchableOpacity onPress={() => handleMenuAction(handleCopy)} style={styles.menuItem}>
                 <FontAwesome5 name="copy" size={18} color={currentTheme.colors.text} />
                 <Text style={[styles.menuText, { color: currentTheme.colors.text }]}>Copy link</Text>
               </TouchableOpacity>
               
               <TouchableOpacity onPress={() => handleMenuAction(handleOpenInBrowser)} style={styles.menuItem}>
                 <FontAwesome5 name="external-link-alt" size={18} color={currentTheme.colors.text} />
                 <Text style={[styles.menuText, { color: currentTheme.colors.text }]}>Open in browser</Text>
               </TouchableOpacity>
               
               <View style={[styles.menuDivider, { backgroundColor: currentTheme.colors.border }]} />
               
               <TouchableOpacity onPress={() => handleMenuAction(() => router.back())} style={styles.menuItem}>
                 <FontAwesome5 name="times" size={18} color={currentTheme.colors.text} />
                 <Text style={[styles.menuText, { color: currentTheme.colors.text }]}>Close</Text>
               </TouchableOpacity>
             </View>
           </Animated.View>
         </View>
       )}

      <WebView
        key={url} // hard reset on new urls
        ref={webViewRef}
        source={{ uri: url }}
        onLoadStart={() => {
          setIsLoading(true);
          safeSetSlowLoad(false);
          setLoadError(null);
          // Slow-load watchdog
          if (slowLoadTimerRef.current) clearTimeout(slowLoadTimerRef.current);
          slowLoadTimerRef.current = setTimeout(() => {
            if (isLoading) safeSetSlowLoad(true);
          }, 6000); // tighten to 6s
        }}
        onLoadEnd={() => {
          setIsLoading(false);
          if (slowLoadTimerRef.current) {
            clearTimeout(slowLoadTimerRef.current);
            slowLoadTimerRef.current = null;
          }
        }}
        onNavigationStateChange={onNavChange}
        onLoadProgress={({ nativeEvent }) => {
          const p = nativeEvent.progress || 0;
          // update only if >= +5% or completed
          if (p === 1 || p - lastProgressRef.current >= 0.05) {
            lastProgressRef.current = p;
            Animated.timing(progressAnim, {
              toValue: p,
              duration: p === 1 ? 160 : 120,
              easing: Easing.linear,
              useNativeDriver: false,
            }).start(() => {
              if (p === 1) {
                Animated.timing(fadeAnim, { toValue: 1, duration: 150, useNativeDriver: true }).start();
              }
            });
          }
        }}
        onError={({ nativeEvent }) => {
          setLoadError(nativeEvent?.description || 'Failed to load page');
          setIsLoading(false);
        }}
        onHttpError={({ nativeEvent }) => {
          setLoadError(`HTTP ${nativeEvent.statusCode}`);
          setIsLoading(false);
        }}
        onShouldStartLoadWithRequest={(req) => {
          const u = req.url;
          // Cheap scheme test without split/regex cost
          if (u.startsWith('intent:') || u.startsWith('mailto:') || u.startsWith('tel:') || u.startsWith('market:')) {
            Linking.openURL(u);
            return false;
          }
          return true;
        }}
        startInLoadingState
        incognito={false}
        javaScriptEnabled
        domStorageEnabled
        cacheEnabled
        // If you do NOT need cross-app cookies, turn these off:
        thirdPartyCookiesEnabled={false}
        sharedCookiesEnabled={false}
        allowsInlineMediaPlayback
        androidLayerType={Platform.OS === 'android' ? 'hardware' : undefined}
        mixedContentMode="always"
        // Android tuning
        cacheMode="LOAD_DEFAULT"
        setBuiltInZoomControls={false}
        setDisplayZoomControls={false}
        overScrollMode="content"
        allowsFullscreenVideo
        // iOS niceties (safe defaults)
        allowsBackForwardNavigationGestures
        contentInsetAdjustmentBehavior="never"
        setSupportMultipleWindows={false}
        userAgent={
          'Mozilla/5.0 (Linux; Android 13; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36'
        }
        injectedJavaScriptBeforeContentLoaded={`
          (function() {
            var bg='${isDarkMode ? '#000' : '#fff'}';
            document.documentElement.style.backgroundColor=bg;
            document.body.style.backgroundColor=bg;
          })();
          true;
        `}
        style={{ 
          backgroundColor: currentTheme.colors.background, 
          marginTop: insets.top + 56, 
        }}
      />

      {/* Clean loading indicator */}
      {isLoading && (
        <View style={styles.loadingOverlay} pointerEvents="none">
          <View style={[styles.loadingContainer, { backgroundColor: currentTheme.colors.surface }]}>
            <ActivityIndicator size="small" color="#02A9FF" />
            <Text style={[styles.loadingText, { color: currentTheme.colors.textSecondary }]}>
              Loading...
            </Text>
          </View>
        </View>
      )}

      {/* Clean error/loading banner */}
      {(isSlowLoad || loadError) && (
        <View style={[
          styles.banner, 
          { 
            backgroundColor: currentTheme.colors.surface,
            borderColor: currentTheme.colors.border,
            top: insets.top + 56 + 8,
          }
        ]}> 
          <Text style={[styles.bannerText, { color: currentTheme.colors.text }]} numberOfLines={1}>
            {loadError ? `Failed to load: ${loadError}` : 'Still loading...'}
          </Text>
          <View style={styles.bannerActions}>
            <TouchableOpacity onPress={handleRefresh} style={styles.bannerBtn}>
              <Text style={[styles.bannerBtnText, { color: '#02A9FF' }]}>Retry</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleOpenInBrowser} style={styles.bannerBtn}>
              <Text style={[styles.bannerBtnText, { color: '#02A9FF' }]}>Browser</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.06)',
  },
  headerIcon: {
    padding: 8,
    borderRadius: 20,
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    borderBottomWidth: StyleSheet.hairlineWidth,
    zIndex: 10,
  },
  topBarContent: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    gap: 6,
  },
  titleBlock: {
    flex: 1,
    paddingHorizontal: 6,
  },
  domainText: {
    fontSize: 13,
    fontWeight: '700',
  },
  pathText: {
    fontSize: 11,
    opacity: 0.6,
  },
  pageTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressBar: {
    height: 2,
  },
  bottomBar: {
    position: 'absolute',
    left: 12,
    right: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 80,
    paddingHorizontal: 16,
    paddingTop: 12,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 12,
  },
  bottomIcon: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 48,
    minHeight: 48,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 12,
  },
  disabledIcon: {
    opacity: 0.4,
  },
  iconLabel: {
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 4,
    letterSpacing: 0.2,
  },
  actionGroup: {
    alignItems: 'center',
    gap: 8,
  },
  navControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  navButton: {
    padding: 8,
    borderRadius: 20,
  },
  disabledNavButton: {
    opacity: 0.4,
  },
  menuButton: {
    padding: 8,
    borderRadius: 20,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginVertical: 2,
  },
  menuText: {
    marginLeft: 16,
    fontSize: 16,
    fontWeight: '600',
  },
  menuDivider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 12,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    gap: 8,
  },
  loadingText: {
    fontSize: 14,
  },
  banner: {
    position: 'absolute',
    left: 12,
    right: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  bannerText: {
    fontSize: 14,
    flex: 1,
  },
  bannerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  bannerBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  bannerBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  menuOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 100,
  },
  menuBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  bottomSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 20,
    paddingBottom: 34, // Safe area for home indicator
  },
  bottomSheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  bottomSheetContent: {
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
});


