import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, StyleSheet, ActivityIndicator, BackHandler, TouchableOpacity, Text, Share, Animated, Easing, Pressable, Platform } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { WebView, WebViewNavigation } from 'react-native-webview';
import { FontAwesome5 } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as Linking from 'expo-linking';
import { Menu, MenuItem } from 'react-native-material-menu';
import { useTheme, lightTheme, darkTheme } from '../hooks/useTheme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
  const menuRef = useRef<Menu>(null);

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

  useEffect(() => {
    const onBackPress = () => {
      if (canGoBack && webViewRef.current) {
        webViewRef.current.goBack();
        return true;
      }
      router.back();
      return true;
    };

    const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => sub.remove();
  }, [canGoBack, router]);

  const onNavChange = useCallback((navState: WebViewNavigation) => {
    setCanGoBack(!!navState.canGoBack);
    // @ts-ignore RN WebView navState has canGoForward on most platforms
    setCanGoForward(!!(navState as any).canGoForward);
    if (navState.title) setPageTitle(navState.title);
    if (navState.url) setCurrentUrl(navState.url);
  }, []);

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
    try {
      await Share.share({ message: currentUrl, url: currentUrl });
    } catch {}
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
            <Text numberOfLines={1} style={[styles.domainText, { color: currentTheme.colors.text }]}>{getHostname(currentUrl)}</Text>
            {!!currentUrl && (
              <Text numberOfLines={1} style={[styles.pathText, { color: currentTheme.colors.textSecondary }]}>/{(currentUrl.split(getHostname(currentUrl))[1] || '').replace(/^\/?/, '')}</Text>
            )}
            <Text numberOfLines={1} style={[styles.pageTitle, { color: currentTheme.colors.text }]}>{headerTitle}</Text>
          </View>

          {/* Action Menu */}
          <TouchableOpacity onPress={() => (menuRef as any).current?.show()} style={styles.menuButton}>
            <FontAwesome5 name="ellipsis-h" size={18} color={currentTheme.colors.text} />
          </TouchableOpacity>
        </View>

        {/* Progress bar */}
        <Animated.View
          style={[styles.progressBar, { backgroundColor: '#02A9FF', width: progressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }]}
        />
      </Pressable>

      {/* Modern overflow menu */}
      <Menu
        ref={menuRef}
        anchor={<View />}
        style={styles.modernMenu}
      >
        <TouchableOpacity onPress={() => { (menuRef as any).current?.hide(); handleRefresh(); }} style={styles.menuItem}>
          <FontAwesome5 name="redo" size={16} color={currentTheme.colors.text} />
          <Text style={[styles.menuText, { color: currentTheme.colors.text }]}>Reload</Text>
        </TouchableOpacity>
        
        <TouchableOpacity onPress={() => { (menuRef as any).current?.hide(); handleShare(); }} style={styles.menuItem}>
          <FontAwesome5 name="share" size={16} color={currentTheme.colors.text} />
          <Text style={[styles.menuText, { color: currentTheme.colors.text }]}>Share</Text>
        </TouchableOpacity>
        
        <TouchableOpacity onPress={() => { (menuRef as any).current?.hide(); handleCopy(); }} style={styles.menuItem}>
          <FontAwesome5 name="copy" size={16} color={currentTheme.colors.text} />
          <Text style={[styles.menuText, { color: currentTheme.colors.text }]}>Copy link</Text>
        </TouchableOpacity>
        
        <TouchableOpacity onPress={() => { (menuRef as any).current?.hide(); handleOpenInBrowser(); }} style={styles.menuItem}>
          <FontAwesome5 name="external-link-alt" size={16} color={currentTheme.colors.text} />
          <Text style={[styles.menuText, { color: currentTheme.colors.text }]}>Open in browser</Text>
        </TouchableOpacity>
        
        <View style={[styles.menuDivider, { backgroundColor: currentTheme.colors.border }]} />
        
        <TouchableOpacity onPress={() => { (menuRef as any).current?.hide(); router.back(); }} style={styles.menuItem}>
          <FontAwesome5 name="times" size={16} color={currentTheme.colors.text} />
          <Text style={[styles.menuText, { color: currentTheme.colors.text }]}>Close</Text>
        </TouchableOpacity>
      </Menu>

      <WebView
        ref={webViewRef}
        source={{ uri: url }}
        onLoadStart={() => {
          setIsLoading(true);
          setIsSlowLoad(false);
          setLoadError(null);
          // Slow-load watchdog
          setTimeout(() => {
            if (isLoading) setIsSlowLoad(true);
          }, 8000);
        }}
        onLoadEnd={() => setIsLoading(false)}
        onNavigationStateChange={onNavChange}
        onLoadProgress={({ nativeEvent }) => {
          const p = nativeEvent.progress || 0;
          Animated.timing(progressAnim, {
            toValue: p,
            duration: 120,
            easing: Easing.linear,
            useNativeDriver: false,
          }).start();
          if (p >= 1) {
            Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
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
          // Allow same-target navigations; open special schemes externally
          const disallowSchemes = ['intent', 'market', 'mailto', 'tel'];
          const scheme = req.url.split(':')[0];
          if (disallowSchemes.includes(scheme)) {
            Linking.openURL(req.url);
            return false;
          }
          return true;
        }}
        startInLoadingState
        incognito={false}
        allowsBackForwardNavigationGestures
        setSupportMultipleWindows={false}
        javaScriptEnabled
        domStorageEnabled
        thirdPartyCookiesEnabled
        sharedCookiesEnabled
        cacheEnabled
        allowsInlineMediaPlayback
        androidLayerType={Platform.OS === 'android' ? 'hardware' : undefined}
        mixedContentMode="always"
        userAgent={
          'Mozilla/5.0 (Linux; Android 13; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36'
        }
        injectedJavaScript={`
          (function() {
            document.documentElement.style.backgroundColor='${isDarkMode ? '#000' : '#fff'}';
            document.body.style.backgroundColor='${isDarkMode ? '#000' : '#fff'}';
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
  modernMenu: {
    position: 'absolute',
    top: 120, // Fixed position below header
    left: 12,
    right: 12,
    backgroundColor: 'transparent', // Ensure it's transparent to show through WebView
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 10,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  menuText: {
    marginLeft: 12,
    fontSize: 14,
    fontWeight: '500',
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
});


