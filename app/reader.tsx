import React, { useState, useRef, useEffect, useCallback, useMemo, memo } from 'react';
import { View, Text, StyleSheet, Dimensions, Platform, FlatList, TouchableOpacity, StatusBar, Image, ActivityIndicator, SafeAreaView, BackHandler, ImageErrorEventData, Animated, DeviceEventEmitter, Switch, Modal, ScrollView } from 'react-native';
import { useLocalSearchParams, Stack, useRouter } from 'expo-router';
import { FontAwesome5, Ionicons, MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { LinearGradient } from 'expo-linear-gradient';
import { Image as ExpoImage } from 'expo-image';
import { BlurView } from 'expo-blur';
import { PanGestureHandler } from 'react-native-gesture-handler';
import Reanimated, { 
  useSharedValue, 
  useAnimatedStyle, 
  useAnimatedGestureHandler,
  withTiming, 
  withSpring,
  runOnJS
} from 'react-native-reanimated';
import Slider from '@react-native-community/slider';
import { useOrientation } from '../hooks/useOrientation';
import { useIncognito } from '../hooks/useIncognito';
import { useTheme } from '../hooks/useTheme';
import ChapterSourcesModal from '../components/ChapterSourcesModal';
import { ChapterManager } from '../utils/ChapterManager';
import { MangaProviderService } from '../api/proxy/providers/manga/MangaProviderService';
import { debounce, throttle } from 'lodash';

const WINDOW_HEIGHT = Dimensions.get('window').height;
const WINDOW_WIDTH = Dimensions.get('window').width;
const INITIAL_RENDER_COUNT = 2;
const ANILIST_API_URL = 'https://graphql.anilist.co';
const STORAGE_KEY = {
  AUTH_TOKEN: 'auth_token',
  USER_DATA: 'user_data'
};
const BASE_API_URL = 'https://takiapi.xyz';
const KATANA_API_URL = 'https://magaapinovel.xyz';

// Define styles at the top level
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 44 : StatusBar.currentHeight,
    paddingHorizontal: 16,
    paddingBottom: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    zIndex: 1000, // Ensure header is at top level
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  directionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(30, 30, 30, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(30, 30, 30, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  titleContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: '#02A9FF',
    fontWeight: '600',
    textAlign: 'center',
  },
  imageContainer: {
    flex: 1,
    width: WINDOW_WIDTH,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 2,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
    backgroundColor: '#000',
  },
  loadingContainer: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#fff',
    marginTop: 12,
    fontSize: 14,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  errorText: {
    color: '#fff',
    marginTop: 12,
    fontSize: 14,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 12,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#02A9FF',
    borderRadius: 8,
  },
  retryText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
    zIndex: 1000,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  pageNumberContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
    backgroundColor: 'rgba(30, 30, 30, 0.8)',
    alignSelf: 'center',
    paddingHorizontal: 15,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  pageNumberText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  progressBarContainer: {
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 2,
    overflow: 'hidden',
    marginTop: 8,
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#02A9FF',
  },
  footerNavContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  footerNavButton: {
    minWidth: 80,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(30, 30, 30, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    flexDirection: 'row',
    paddingHorizontal: 12,
  },
  chapterNavigation: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    paddingBottom: 60, // Add more padding at the bottom
  },
  chapterNavPill: {
    position: 'absolute',
    bottom: 100, // Increased from 70 to position buttons higher
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    zIndex: 1000, // Ensure high z-index
    elevation: 5, // For Android
    shadowColor: "#000", // Shadow for iOS
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    minWidth: 90,
  },
  chapterNavPillText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    borderRadius: 16,
    padding: 24,
    width: '85%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalText: {
    fontSize: 16,
    lineHeight: 22,
    marginBottom: 24,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    marginBottom: 24,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#02A9FF',
    borderColor: '#02A9FF',
  },
  checkboxLabel: {
    fontSize: 15,
    fontWeight: '500',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  modalButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    minWidth: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalButtonCancel: {
    borderWidth: 1,
    borderColor: 'transparent',
  },
  modalButtonNo: {
    borderWidth: 1,
    borderColor: 'transparent',
  },
  modalButtonYes: {
    backgroundColor: '#02A9FF',
  },
  modalButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  modalButtonTextNo: {
    color: '#666',
  },
  notification: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    paddingTop: Platform.OS === 'ios' ? 50 : 30,
    paddingBottom: 16,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 2,
    borderBottomColor: '#02A9FF',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 8,
    zIndex: 99999,
  },
  notificationText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 24,
    letterSpacing: 0.3,
  },
  flatList: {
    flex: 1,
    backgroundColor: '#111',
  },
  overScrolling: {
    opacity: 0.5, // This will create a fade effect when over-scrolling
  },
  floatingNotification: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 30,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#02A9FF',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 999999,
  },
  floatingNotificationText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 20,
    letterSpacing: 0.3,
  },
  cornerNavContainer: {
    position: 'absolute',
    bottom: 70, // Position above the footer
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    zIndex: 999999,
  },
  cornerNavButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 10,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.5,
    shadowRadius: 5,
    borderWidth: 2,
    borderColor: '#000',
  },
  overscrollIndicator: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 999,
  },
  overscrollContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 15,
    paddingHorizontal: 25,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    borderWidth: 1,
    borderColor: '#02A9FF',
    width: '85%',
    maxWidth: 500,
  },
  overscrollText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  overscrollChapterNumber: {
    color: '#02A9FF',
    fontSize: 18,
    fontWeight: '700',
    marginTop: 5,
    textAlign: 'center',
  },
  overscrollArrow: {
    marginHorizontal: 10,
  },
  overscrollDivider: {
    width: 1,
    height: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    marginHorizontal: 15,
  },
  overscrollSide: {
    alignItems: 'center',
    flex: 1,
  },
  settingsButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 16,
    zIndex: 10,
  },
  settingsModal: {
    borderRadius: 16,
    padding: 24,
    width: '85%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  settingsTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 16,
    textAlign: 'center',
  },
  settingsSection: {
    marginBottom: 16,
  },
  settingsSectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  settingsOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
    marginBottom: 8,
  },
  settingsOptionLabel: {
    fontSize: 16,
    flex: 1,
  },
  settingsSwitch: {
    marginLeft: 8,
  },
  settingsDropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
    marginBottom: 8,
  },
  settingsDropdownLabel: {
    fontSize: 16,
    flex: 1,
  },
  dropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 4,
    minWidth: 60,
  },
  dropdownButtonText: {
    fontSize: 14,
    fontWeight: '500',
    marginRight: 4,
  },
  dropdownMenu: {
    position: 'absolute',
    right: 0,
    top: 45,
    backgroundColor: '#333',
    borderRadius: 8,
    overflow: 'hidden',
    zIndex: 1000,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
    width: 100,
  },
  dropdownMenuItem: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dropdownMenuItemText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#fff',
  },
  debugOverlay: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 100 : 80,
    left: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 8,
    borderRadius: 5,
    maxWidth: '50%',
    zIndex: 900, // Lower z-index so it doesn't block interactions
    pointerEvents: 'none', // Make overlay non-interactive
  },
  debugText: {
    color: '#fff',
    fontSize: 10,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  debugGuideHorizontal: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255, 0, 0, 0.5)',
    zIndex: 900, // Lower z-index
    pointerEvents: 'none', // Make guides non-interactive
  },
  debugGuideVertical: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: 'rgba(0, 255, 0, 0.5)',
    zIndex: 900, // Lower z-index
    pointerEvents: 'none', // Make guides non-interactive
  },
  debugSwipeArea: {
    position: 'absolute',
    backgroundColor: 'rgba(0, 0, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 255, 0.5)',
    zIndex: 900, // Lower z-index
    pointerEvents: 'none', // Make areas non-interactive
  },
  debugImageBounds: {
    position: 'absolute',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 0, 0.5)',
    zIndex: 900, // Lower z-index
    pointerEvents: 'none', // Make bounds non-interactive
  },
  debugInfoBox: {
    position: 'absolute',
    right: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 8,
    borderRadius: 5,
    maxWidth: '45%',
    zIndex: 900, // Lower z-index
    pointerEvents: 'none', // Make info box non-interactive
  },
  // Add new debug guide styles
  debugSwipeGuide: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: WINDOW_WIDTH * 0.3, // 30% of screen width for activation zone
    backgroundColor: 'rgba(255, 0, 0, 0.1)',
    borderWidth: 1,
    zIndex: 900,
    pointerEvents: 'none',
  },
  debugSwipeGuideLeft: {
    left: 0,
    borderColor: 'rgba(255, 0, 0, 0.5)',
  },
  debugSwipeGuideRight: {
    right: 0,
    borderColor: 'rgba(0, 255, 0, 0.5)',
  },
  debugSwipeArrow: {
    position: 'absolute',
    top: '50%',
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 20,
    transform: [{ translateY: -20 }],
  },
  debugSwipeText: {
    position: 'absolute',
    color: '#FFFFFF',
    fontSize: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 4,
    borderRadius: 4,
    textAlign: 'center',
    width: 100,
  },
  debugSwipeTextTop: {
    top: 100,
  },
  debugSwipeTextBottom: {
    bottom: 100,
  },
  debugPageIndicator: {
    position: 'absolute',
    top: 60,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingVertical: 4,
    zIndex: 901,
  },
  debugPageText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  // New styles for gesture-based chapter preview
  previewBannerContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 999,
    pointerEvents: 'none',
  },
  previewBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 15,
    paddingHorizontal: 25,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    borderWidth: 1,
    borderColor: '#02A9FF',
    width: '85%',
    maxWidth: 500,
  },
  previewSide: {
    alignItems: 'center',
    flex: 1,
  },
  previewText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  previewChapterNumber: {
    color: '#02A9FF',
    fontSize: 18,
    fontWeight: '700',
    marginTop: 5,
    textAlign: 'center',
  },
  previewDivider: {
    width: 1,
    height: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    marginHorizontal: 15,
  },
  previewArrow: {
    marginHorizontal: 10,
  },
  chapterNavIcon: {
    marginHorizontal: 4,
  },
  controlsBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    padding: 10,
    zIndex: 1000,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  navigationControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  pageInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  pageCounter: {
    fontSize: 14,
    fontWeight: '600',
  },
  pageContainer: {
    width: WINDOW_WIDTH,
    height: '100%',
    backgroundColor: '#111',
    paddingTop: 5,
    paddingBottom: 5,
  },
  pageNumberIndicator: {
    position: 'absolute',
    bottom: 20,
    alignSelf: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  // Settings modal styles
  settingsScrollView: {
    maxHeight: 400,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 8,
  },
  settingItem: {
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  settingLabel: {
    fontSize: 16,
    marginBottom: 12,
    flexShrink: 1,
  },
  directionOptions: {
    flexDirection: 'column',
    gap: 8,
    width: '100%',
  },
  directionOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    gap: 8,
  },
  directionOptionSelected: {
    backgroundColor: '#42A5F5',
    borderColor: '#42A5F5',
  },
  directionOptionText: {
    fontSize: 15,
    fontWeight: '500',
  },
  sliderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  sliderValue: {
    width: 30,
    textAlign: 'right',
    fontSize: 14,
  },
});

const ImageItem = memo(({ 
  imageUrl, 
  index, 
  totalImages,
  imageHeaders,
  onPress,
  onLoadStart,
  onLoadSuccess,
  onLoadError,
  isLoading,
  hasError,
  onRetry,
  isNearby,
  isZoomed,
  zoomAnimatedValue,
  translateX,
  translateY
}: {
  imageUrl: string;
  index: number;
  totalImages: number;
  imageHeaders: any;
  onPress: () => void;
  onLoadStart: () => void;
  onLoadSuccess: () => void;
  onLoadError: (error: ImageErrorEventData | Error) => void;
  isLoading: boolean;
  hasError: boolean;
  onRetry: () => void;
  isNearby: boolean;
  isZoomed?: boolean;
  zoomAnimatedValue?: Animated.Value;
  translateX?: Reanimated.SharedValue<number>;
  translateY?: Reanimated.SharedValue<number>;
}) => {
  const [retryCount, setRetryCount] = useState(0);
  const MAX_RETRIES = 3;

  // Pan gesture handler for dragging when zoomed
  const panGestureHandler = useAnimatedGestureHandler({
    onStart: (_, context: any) => {
      if (translateX && translateY) {
        context.startX = translateX.value;
        context.startY = translateY.value;
      }
    },
    onActive: (event, context: any) => {
      if (isZoomed && translateX && translateY) {
        // Calculate boundaries to prevent dragging too far
        const maxTranslateX = WINDOW_WIDTH * 0.5; // Half screen width
        const maxTranslateY = WINDOW_HEIGHT * 0.5; // Half screen height
        
        const newX = context.startX + event.translationX;
        const newY = context.startY + event.translationY;
        
        // Clamp values to boundaries
        translateX.value = Math.max(-maxTranslateX, Math.min(maxTranslateX, newX));
        translateY.value = Math.max(-maxTranslateY, Math.min(maxTranslateY, newY));
      }
    },
    onEnd: () => {
      // Optional: Add spring back to center if dragged too far
    },
  });

  // Animated style for pan gestures
  const animatedStyle = useAnimatedStyle(() => {
    if (!isZoomed || !translateX || !translateY) {
      return {};
    }
    
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
      ],
    };
  });

  const LoadingComponent = useMemo(() => (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color="#02A9FF" />
      <Text style={styles.loadingText}>
        {retryCount > 0 ? `Retrying (${retryCount}/${MAX_RETRIES})...` : `Loading page ${index + 1}...`}
      </Text>
    </View>
  ), [index, retryCount]);

  const ErrorComponent = useMemo(() => (
    <View style={styles.errorContainer}>
      <FontAwesome5 name="exclamation-circle" size={40} color="#ff4444" />
      <Text style={styles.errorText}>Failed to load image</Text>
      <Text style={[styles.errorText, { fontSize: 12, marginTop: 4 }]}>
        Try checking your internet connection
      </Text>
      <TouchableOpacity 
        style={styles.retryButton}
        onPress={() => {
          setRetryCount(0);
          onRetry();
        }}
      >
        <Text style={styles.retryText}>Retry</Text>
      </TouchableOpacity>
    </View>
  ), [onRetry]);

  const handleError = useCallback((error: ImageErrorEventData | Error) => {
    console.error(`Error loading image ${index + 1}:`, error);
    if (retryCount < MAX_RETRIES) {
      setRetryCount(prev => prev + 1);
      // Retry after a delay with exponential backoff
      setTimeout(() => {
        onRetry();
      }, Math.pow(2, retryCount) * 1000);
    } else {
      onLoadError(error);
    }
  }, [index, retryCount, MAX_RETRIES, onRetry, onLoadError]);

  return (
    <View style={styles.pageContainer}>
      <TouchableOpacity 
        style={styles.imageContainer} 
        activeOpacity={1}
        onPress={onPress}
        disabled={isZoomed} // Disable touch when zoomed to allow pan gestures
      >
        {isLoading && LoadingComponent}
        {hasError ? ErrorComponent : isNearby ? (
          <PanGestureHandler
            onGestureEvent={panGestureHandler}
            enabled={isZoomed}
          >
            <Animated.View
              style={[
                styles.image,
                zoomAnimatedValue && {
                  transform: [{ scale: zoomAnimatedValue }]
                },
                animatedStyle
              ]}
            >
              <TouchableOpacity
                activeOpacity={1}
                onPress={onPress}
                style={styles.image}
                disabled={!isZoomed} // Only allow tap when zoomed (for zoom out)
              >
                <ExpoImage
                  source={{ 
                    uri: imageUrl,
                    headers: imageHeaders
                  }}
                  style={styles.image}
                  contentFit="contain"
                  onLoadStart={onLoadStart}
                  onLoad={onLoadSuccess}
                  onError={handleError}
                  cachePolicy="memory-disk"
                  contentPosition="center"
                  recyclingKey={`image-${index}-${imageUrl}`}
                  transition={200}
                  priority={isNearby ? "high" : "low"}
                />
              </TouchableOpacity>
            </Animated.View>
          </PanGestureHandler>
        ) : (
          <View style={[styles.image, { backgroundColor: '#111', justifyContent: 'center', alignItems: 'center' }]}>
            <Text style={{ color: '#666', fontSize: 14 }}>Page {index + 1}</Text>
            <Text style={{ color: '#666', fontSize: 12, marginTop: 4 }}>Tap to load</Text>
          </View>
        )}
      </TouchableOpacity>
    </View>
  );
}, (prevProps, nextProps) => {
  // Custom comparison function for memo
  return (
    prevProps.imageUrl === nextProps.imageUrl &&
    prevProps.index === nextProps.index &&
    prevProps.isLoading === nextProps.isLoading &&
    prevProps.hasError === nextProps.hasError &&
    prevProps.isNearby === nextProps.isNearby &&
    prevProps.isZoomed === nextProps.isZoomed
  );
});

interface Chapter {
  id: string;
  number: string;
  title: string;
  url: string;
}

interface ApiChapter {
  id: string;
  title: string;
}

interface ChapterSourcesModalProps {
  visible: boolean;
  onClose: () => void;
  chapter: {
    id: string;
    number: string;
    title: string;
    url: string;
  } | null;
  mangaTitle: {
    english: string;
    userPreferred: string;
  };
  mangaId: string;
  autoLoad?: boolean;
  existingParams?: any;
}

// Add this component at the top level, before the ReaderScreen component
const FloatingNotification = memo(({ 
  message, 
  visible, 
  notificationOpacity, 
  notificationOffset 
}: { 
  message: string;
  visible: boolean;
  notificationOpacity: Animated.Value;
  notificationOffset: Animated.Value;
}) => {
  if (!visible) return null;

  return (
    <Animated.View
      style={[
        styles.floatingNotification,
        {
          opacity: notificationOpacity,
          transform: [{ translateY: notificationOffset }],
        },
      ]}
    >
      <Text style={styles.floatingNotificationText}>{message}</Text>
    </Animated.View>
  );
});

interface ImageLoadTiming {
  start: number;
  end: number | null;
}

interface DebugState {
  frameTime: number;
  lastFrameTime: number;
  imageLoads: { [key: number]: ImageLoadTiming };
  animationFrame: number | null;
}

// Interface for manga reader preferences
interface MangaReaderPreferences {
  readingDirection: 'ltr' | 'rtl' | 'vertical';
  rememberPosition: boolean;
  autoNavigateNextChapter: boolean;
  keepScreenOn: boolean;
  showPageNumber: boolean;
  fullscreenByDefault: boolean;
  tapToNavigate: boolean;
  zoomEnabled: boolean;
  doubleTapToZoom: boolean;
  preloadPages: number;
  debugMode: boolean;
  appearance: {
    backgroundColor: string;
    pageGap: number;
    pageBorderRadius: number;
    pageTransitionAnimation: boolean;
  };
}

export default function ReaderScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const { unlockOrientation, lockPortrait } = useOrientation();
  const { isIncognito } = useIncognito();
  const { currentTheme: theme, isDarkMode } = useTheme();
  
  // Store mangaId in a ref when component mounts to ensure it's available for navigation
  const mangaIdRef = useRef<string | null>(null);
  
  // Utility function to get current mangaId from all possible sources
  const getCurrentMangaId = useCallback(() => {
    // Always prioritize the AniList ID for navigation back to manga details
    if (params.anilistId && typeof params.anilistId === 'string') {
      console.log('Using anilistId for navigation:', params.anilistId);
      return params.anilistId;
    }
    
    // Fall back to other IDs only if AniList ID isn't available
    if (params.mangaId && typeof params.mangaId === 'string') {
      return params.mangaId;
    }
    
    // Then check our ref
    if (mangaIdRef.current) {
      return mangaIdRef.current;
    }
    
    // Fall back to potentially stored ID
    return null;
  }, [params.mangaId, params.anilistId]);
  
  // Extract mangaId from previous route or params when component mounts
  useEffect(() => {
    const extractMangaId = async () => {
      try {
        // First try to get mangaId from params
        if (params.mangaId && typeof params.mangaId === 'string') {
          console.log('Storing mangaId from params:', params.mangaId);
          mangaIdRef.current = params.mangaId;
          await AsyncStorage.setItem('current_manga_id', params.mangaId);
          
          // Store the AniList ID mapping if available
          if (params.anilistId && typeof params.anilistId === 'string') {
            console.log('Storing AniList ID mapping:', params.anilistId, 'for manga:', params.mangaId);
            await AsyncStorage.setItem(`anilist_id_for_${params.mangaId}`, params.anilistId);
          }
          return;
        }
        
        // Check if we have an existingParams object with mangaId
        if (params.existingParams && typeof params.existingParams === 'string') {
          try {
            const existingParams = JSON.parse(params.existingParams);
            if (existingParams.mangaId) {
              console.log('Storing mangaId from existingParams:', existingParams.mangaId);
              mangaIdRef.current = existingParams.mangaId;
              await AsyncStorage.setItem('current_manga_id', existingParams.mangaId);
              return;
            }
          } catch (e) {
            console.warn('Failed to parse existingParams:', e);
          }
        }
        
        // If not in params, check if we stored it in AsyncStorage previously
        const storedMangaId = await AsyncStorage.getItem('current_manga_id');
        if (storedMangaId) {
          console.log('Retrieved mangaId from storage:', storedMangaId);
          mangaIdRef.current = storedMangaId;
          return;
        }
        
        // Use anilistId as a fallback
        if (params.anilistId && typeof params.anilistId === 'string') {
          console.log('Storing anilistId as fallback for mangaId:', params.anilistId);
          mangaIdRef.current = params.anilistId;
          await AsyncStorage.setItem('current_manga_id', params.anilistId);
          return;
        }
        
        console.warn('Could not find mangaId from any source');
      } catch (error) {
        console.error('Error extracting mangaId:', error);
      }
    };
    
    extractMangaId();
  }, [params]);

  // Extract provider information from navigation parameters and persist it
  useEffect(() => {
    if (params.readerCurrentProvider && typeof params.readerCurrentProvider === 'string') {
      console.log('Setting currentProvider from navigation params:', params.readerCurrentProvider);
      setCurrentProvider(params.readerCurrentProvider as 'mangadex' | 'katana' | 'mangafire' | 'unknown');
      // Store provider info persistently for this reading session
      AsyncStorage.setItem('reader_current_provider', params.readerCurrentProvider);
    }
    
    if (params.readerMangaSlugId && typeof params.readerMangaSlugId === 'string') {
      console.log('Setting mangaSlugId from navigation params:', params.readerMangaSlugId);
      setMangaSlugId(params.readerMangaSlugId);
      // Store manga slug ID persistently for this reading session
      AsyncStorage.setItem('reader_manga_slug_id', params.readerMangaSlugId);
    }
  }, [params.readerCurrentProvider, params.readerMangaSlugId]);
  
  // Load provider information from storage if not provided in params
  useEffect(() => {
    const loadPersistedProviderInfo = async () => {
      if (!params.readerCurrentProvider) {
        const storedProvider = await AsyncStorage.getItem('reader_current_provider');
        if (storedProvider && storedProvider !== 'unknown') {
          console.log('Loading persisted currentProvider:', storedProvider);
          setCurrentProvider(storedProvider as 'mangadex' | 'katana' | 'mangafire' | 'unknown');
        }
      }
      
      if (!params.readerMangaSlugId) {
        const storedSlugId = await AsyncStorage.getItem('reader_manga_slug_id');
        if (storedSlugId) {
          console.log('Loading persisted mangaSlugId:', storedSlugId);
          setMangaSlugId(storedSlugId);
        }
      }
    };
    
    loadPersistedProviderInfo();
  }, [params.readerCurrentProvider, params.readerMangaSlugId]);
  
  const [images, setImages] = useState<string[]>([]);
  const [dynamicImageHeaders, setDynamicImageHeaders] = useState<{ [key: number]: any }>({});
  const [currentPage, setCurrentPage] = useState(1);
  const [currentChapterIndex, setCurrentChapterIndex] = useState(-1);
  const [loadingStates, setLoadingStates] = useState<{ [key: number]: boolean }>({});
  const [errorStates, setErrorStates] = useState<{ [key: number]: boolean }>({});
  const [showUI, setShowUI] = useState(true);
  const [hasUpdatedProgress, setHasUpdatedProgress] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showExitModal, setShowExitModal] = useState(false);
  const [readingDirection, setReadingDirection] = useState<'ltr' | 'rtl'>('ltr');
  const [shouldSaveProgress, setShouldSaveProgress] = useState(false);
  const [shouldAutoSaveOnExit, setShouldAutoSaveOnExit] = useState(false);
  const [showNotification, setShowNotification] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState('');
  const [showChapterModal, setShowChapterModal] = useState(false);
  const [pendingNextChapter, setPendingNextChapter] = useState(false);
  const [navigationType, setNavigationType] = useState<'next' | 'previous' | null>(null);
  const [selectedChapter, setSelectedChapter] = useState<Chapter | null>(null);
  const [autoLoadChapter, setAutoLoadChapter] = useState(false);
  const [hasNextChapter, setHasNextChapter] = useState(false);
  const [hasPreviousChapter, setHasPreviousChapter] = useState(false);
  const [allChapters, setAllChapters] = useState<Chapter[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [shouldAutoSave, setShouldAutoSave] = useState(false);
  const [isScrollingFast, setIsScrollingFast] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showDebugDropdown, setShowDebugDropdown] = useState(false);
  const [debugMode, setDebugMode] = useState(false);
  const [debugLevel, setDebugLevel] = useState(1);
  const [debugGestures, setDebugGestures] = useState(false);
  const [debugImages, setDebugImages] = useState(false);
  const [debugTouch, setDebugTouch] = useState({ x: 0, y: 0, active: false });
  const [debugVelocity, setDebugVelocity] = useState({ x: 0, y: 0 });
  const [debugImageDimensions, setDebugImageDimensions] = useState({ width: 0, height: 0 });
  const [debugFrameTime, setDebugFrameTime] = useState(0);
  const [debugMemory, setDebugMemory] = useState("");
  const [isOverScrolling, setIsOverScrolling] = useState(false);
  const [showOverscrollIndicator, setShowOverscrollIndicator] = useState(false);
  const [overscrollDirection, setOverscrollDirection] = useState<'next' | 'previous' | null>(null);
  const [swipeDebounce, setSwipeDebounce] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [previousChapterId, setPreviousChapterId] = useState<string | null>(null);
  const [nextChapterId, setNextChapterId] = useState<string | null>(null);
  const [mangaSlugId, setMangaSlugId] = useState<string | null>(null);
  const [mangaTitle, setMangaTitle] = useState<string | null>(null);
  const [currentProvider, setCurrentProvider] = useState<'mangadex' | 'katana' | 'mangafire' | 'unknown'>('unknown');
  const [chapterManager, setChapterManager] = useState<ChapterManager | undefined>(undefined);
  
  // Progressive loading state
  const [loadedImageIndices, setLoadedImageIndices] = useState<Set<number>>(new Set());
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);
  
  // Zoom state
  const [isZoomed, setIsZoomed] = useState(false);
  const [zoomScale, setZoomScale] = useState(1);
  const zoomAnimatedValue = useRef(new Animated.Value(1)).current;
  
  // Pan gesture state for dragging when zoomed
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  
  // Manga reader preferences state
  const [mangaReaderPreferences, setMangaReaderPreferences] = useState<MangaReaderPreferences>({
    readingDirection: 'rtl',
    rememberPosition: true,
    autoNavigateNextChapter: true,
    keepScreenOn: true,
    showPageNumber: true,
    fullscreenByDefault: false,
    tapToNavigate: true,
    zoomEnabled: true,
    doubleTapToZoom: true,
    preloadPages: 5,
    debugMode: false,
    appearance: {
      backgroundColor: '#000000',
      pageGap: 8,
      pageBorderRadius: 0,
      pageTransitionAnimation: true
    }
  });
  
  const SWIPE_DEBOUNCE_TIME = 500; // ms
  const lastSwipeTime = useRef(Date.now());
  const INITIAL_LOAD_COUNT = 3; // Load first 3 images immediately
  const PRELOAD_BUFFER = 2; // Preload 2 images ahead and behind current page

  const flatListRef = useRef<FlatList>(null);
  const abortControllerRef = useRef<{ [key: number]: AbortController }>({});
  const scrollVelocityRef = useRef(0);
  const lastOffsetRef = useRef(0);
  const lastTimeRef = useRef(Date.now());
  const notificationOpacity = useRef(new Animated.Value(0)).current;
  const notificationOffset = useRef(new Animated.Value(-100)).current;
  const isMounted = useRef(true);
  
  // Debug refs with proper typing
  const debugState = useRef<DebugState>({
    frameTime: 0,
    lastFrameTime: Date.now(),
    imageLoads: {},
    animationFrame: null
  });

  const imageHeaders = {
    'Referer': 'https://readmanganato.com/',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Origin': 'https://readmanganato.com',
    'Accept': 'image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
    'Accept-Encoding': 'gzip, deflate, br',
    'Accept-Language': 'en-US,en;q=0.9',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache',
    'Sec-Fetch-Dest': 'image',
    'Sec-Fetch-Mode': 'no-cors',
    'Sec-Fetch-Site': 'cross-site'
  };



  // Load ALL images aggressively - no progressive loading
  const loadAllImages = useCallback(async () => {
    if (images.length === 0) return;
    
    const indicesToLoad: number[] = [];
    
    // Load ALL images, not just around current page
    for (let i = 0; i < images.length; i++) {
      if (!loadedImageIndices.has(i)) {
        indicesToLoad.push(i);
      }
    }
    
    if (indicesToLoad.length > 0) {
      console.log(`[Reader] Loading ALL ${indicesToLoad.length} remaining images aggressively`);
      
      // Load all images in parallel - no batching
      const loadPromises = indicesToLoad.map(async (index) => {
        if (loadedImageIndices.has(index) || index >= images.length) {
          return;
        }
        
        try {
          // Preload the image using ExpoImage prefetch
          const imageUrl = images[index];
          const headers = dynamicImageHeaders[index] || imageHeaders;
          
          await ExpoImage.prefetch(imageUrl, {
            headers,
            cachePolicy: 'memory-disk'
          });
          
          setLoadedImageIndices(prev => new Set([...prev, index]));
          console.log(`[Reader] Successfully preloaded image ${index + 1}`);
        } catch (error) {
          if (error instanceof Error) {
            console.warn(`[Reader] Failed to preload image ${index + 1}:`, error.message);
          }
        }
      });
      
      await Promise.allSettled(loadPromises);
      
      // Update loading progress
      setLoadingProgress(100);
      console.log(`[Reader] Finished loading all ${images.length} images`);
    }
  }, [images, dynamicImageHeaders, imageHeaders, loadedImageIndices]);

  // Trigger aggressive loading on any scroll
  const triggerImageLoading = useCallback(() => {
    loadAllImages();
  }, [loadAllImages]);

  // Direct scroll handler for immediate response
  const directScrollHandler = useCallback((event: any) => {
      const currentTime = Date.now();
      const currentOffset = event.nativeEvent.contentOffset.x;
      const timeDiff = currentTime - lastTimeRef.current;
      const offsetDiff = Math.abs(currentOffset - lastOffsetRef.current);
      
      // Calculate velocity for both normal use and debug info
      scrollVelocityRef.current = offsetDiff / (timeDiff || 1);
      const isFast = Math.abs(scrollVelocityRef.current) > (WINDOW_WIDTH * 2) / 1000;
      setIsScrollingFast(isFast);
      
      // Update debug velocity info
      if (debugMode && debugGestures) {
        setDebugVelocity({
          x: scrollVelocityRef.current,
          y: 0
        });
      }
      
      lastTimeRef.current = currentTime;
      lastOffsetRef.current = currentOffset;

      const offset = event.nativeEvent.contentOffset.x;
      
      // Calculate the current page based on scroll position
      let currentIndex = Math.round(offset / WINDOW_WIDTH);
      
      // Convert FlatList index to real page number
      let newPage;
      if (readingDirection === 'rtl') {
        // In RTL mode, convert the visual index back to the real index
        newPage = images.length - currentIndex;
      } else {
        // In LTR mode, page 1 is at the beginning
        newPage = currentIndex + 1;
      }
      
      // Add debug info for page calculation (only in debug mode)
      if (debugMode && debugLevel >= 2) {
        console.log(`[Scroll] Offset: ${offset}, Index: ${currentIndex}, Page: ${newPage}, Direction: ${readingDirection}, Velocity: ${scrollVelocityRef.current}`);
      }

      // Update current page if changed
      if (newPage !== currentPage && newPage > 0 && newPage <= images.length) {
        setCurrentPage(newPage);
        if (Platform.OS === 'ios') {
          Haptics.selectionAsync();
        }
        
                // Aggressive loading: Load ALL images immediately
        triggerImageLoading();
      }
    }, [
      currentPage,
      images.length,
      readingDirection,
      debugMode,
      debugGestures,
      debugLevel,
      triggerImageLoading
    ]);

  // Update the handleScroll function to use direct handler
  const handleScroll = useCallback((event: any) => {
    // Remove the excessive console.log that was causing log spam
    // Only log in debug mode level 3+
    if (debugMode && debugLevel >= 3) {
      console.log("📜 Scroll event triggered");
    }
    
    directScrollHandler(event);
  }, [directScrollHandler, debugMode, debugLevel]);

  useEffect(() => {
    // Ensure this runs only once when the component mounts
    const loadImages = async () => {
      try {
        console.log('Loading images from params:', params);
        const imageUrls: string[] = [];
        const imageHeadersMap: { [key: number]: any } = {};
        let index = 1;
  
        while (params[`image${index}`]) {
          const imageUrl = params[`image${index}`] as string;
          console.log(`Found image ${index}:`, imageUrl);
          imageUrls.push(imageUrl);
          
          // Check if there are custom headers for this image
          const headerParam = params[`header${index}`];
          if (headerParam && typeof headerParam === 'string') {
            try {
              const headers = JSON.parse(headerParam);
              imageHeadersMap[index - 1] = headers; // Store with 0-based index
              console.log(`Found headers for image ${index}:`, headers);
            } catch (e) {
              console.warn(`Failed to parse headers for image ${index}:`, e);
            }
          }
          
          index++;
        }
  
        if (imageUrls.length === 0) {
          console.error('No images found in params');
          throw new Error('No images found for this chapter. Please try another source.');
        }
  
        console.log(`Loaded ${imageUrls.length} images`);
        setImages(imageUrls);
        setDynamicImageHeaders(imageHeadersMap);
        
        // Detect provider from image URLs or headers
        if (imageUrls.length > 0) {
          const firstImageUrl = imageUrls[0];
          const firstImageHeaders = imageHeadersMap[0];
          
          if (firstImageUrl.includes('mfcdn') || (firstImageHeaders && 'Referer' in firstImageHeaders && firstImageHeaders.Referer?.includes('mangafire'))) {
            console.log('=== DETECTED MANGAFIRE PROVIDER ===');
            console.log('Setting currentProvider to: mangafire');
            setCurrentProvider('mangafire');
          }
        }
  
        // Initialize loading states for ALL images as NOT loaded initially
        const initialLoadingStates = Object.fromEntries(
          imageUrls.map((_, i) => [i, false])
        );
        setLoadingStates(initialLoadingStates);
        
        // Initialize error states
        const initialErrorStates = Object.fromEntries(
          imageUrls.map((_, i) => [i, false])
        );
        setErrorStates(initialErrorStates);
        
        // Start progressive loading with first few images
        console.log(`[Reader] Starting progressive loading with first ${INITIAL_LOAD_COUNT} images`);
        const initialIndices = Array.from({ length: Math.min(INITIAL_LOAD_COUNT, imageUrls.length) }, (_, i) => i);
        
        // Load initial batch - create a local function to avoid dependency issues
        const loadInitialBatch = async (indices: number[]) => {
          console.log(`[Reader] Loading batch of ${indices.length} images:`, indices);
          
          const loadPromises = indices.map(async (index) => {
            if (index >= imageUrls.length) {
              return;
            }
            
            try {
              // Preload the image using ExpoImage prefetch
              const imageUrl = imageUrls[index];
              const headers = imageHeadersMap[index] || {
                'Referer': 'https://mangakatana.com/',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Origin': 'https://mangakatana.com'
              };
              
              await ExpoImage.prefetch(imageUrl, {
                headers,
                cachePolicy: 'memory-disk'
              });
              
              setLoadedImageIndices(prev => new Set([...prev, index]));
              console.log(`[Reader] Successfully preloaded image ${index + 1}`);
            } catch (error) {
              if (error instanceof Error) {
                console.warn(`[Reader] Failed to preload image ${index + 1}:`, error.message);
              }
            }
          });
          
          await Promise.allSettled(loadPromises);
          
          // Update loading progress
          setLoadingProgress((indices.length / imageUrls.length) * 100);
        };
        
        // Load ALL images immediately, not just initial batch
        setTimeout(async () => {
          await loadInitialBatch(initialIndices);
          setIsInitialLoading(false);
          console.log(`[Reader] Initial loading complete`);
          
          // Trigger loading of ALL remaining images
          setTimeout(() => {
            loadAllImages();
          }, 500);
        }, 100);
        
      } catch (err) {
        console.error('Error loading images:', err);
        setError(err instanceof Error ? err.message : 'Failed to load chapter images');
        setIsInitialLoading(false);
      }
    };
  
    loadImages();
  }, []); // Remove loadImageBatch dependency to prevent infinite loop
  
  useEffect(() => {
    const loadProgress = async () => {
      try {
        if (params.mangaId && params.chapter && images.length > 0) {
          const key = `reading_progress_${params.mangaId}_${params.chapter}`;
          const savedProgress = await AsyncStorage.getItem(key);
          if (savedProgress) {
            const { page } = JSON.parse(savedProgress);
            const validPage = Math.min(page, images.length);
            setCurrentPage(validPage);
            flatListRef.current?.scrollToIndex({
              index: validPage - 1,
              animated: false,
            });
          }
        }
      } catch (err) {
        console.error('Error loading reading progress:', err);
      }
    };
  
    loadProgress();
  }, [params.mangaId, params.chapter, images.length]);

  // Save progress when page changes
  useEffect(() => {
    const saveProgress = async () => {
      try {
        if (params.mangaId && params.chapter && currentPage > 0) {
          const key = `reading_progress_${params.mangaId}_${params.chapter}`;
          const progress = {
            page: currentPage,
            totalPages: images.length,
            lastRead: new Date().toISOString(),
            chapterTitle: params.title,
            isCompleted: currentPage === images.length
          };
          await AsyncStorage.setItem(key, JSON.stringify(progress));

          // If this is the last page, mark chapter as completed
          if (currentPage === images.length) {
            const completedKey = `completed_${params.mangaId}_${params.chapter}`;
            await AsyncStorage.setItem(completedKey, 'true');
          }
        }
      } catch (err) {
        console.error('Error saving reading progress:', err);
      }
    };
    saveProgress();
  }, [currentPage, images.length, params.mangaId, params.chapter, params.title]);

  // Add this useEffect after the other useEffects
  useEffect(() => {
    const checkAutoSavePreference = async () => {
      try {
        const autoSave = await AsyncStorage.getItem('autoSaveProgress');
        setShouldAutoSave(autoSave === 'true');
      } catch (err) {
        console.error('Error checking auto-save preference:', err);
      }
    };
    checkAutoSavePreference();
  }, []);

  // Load manga reader preferences
  useEffect(() => {
    const loadMangaReaderPreferences = async () => {
      try {
        const savedPreferences = await AsyncStorage.getItem('mangaReaderPreferences');
        if (savedPreferences) {
          const preferences = JSON.parse(savedPreferences);
          setMangaReaderPreferences(preferences);
          
          // Apply reading direction from preferences
          setReadingDirection(preferences.readingDirection === 'vertical' ? 'ltr' : preferences.readingDirection);
          
          // Apply debug mode from preferences
          setDebugMode(preferences.debugMode);
        }
      } catch (err) {
        console.error('Error loading manga reader preferences:', err);
      }
    };
    loadMangaReaderPreferences();
  }, []);

  // Save manga reader preferences
  const saveMangaReaderPreferences = useCallback(async (newPreferences: MangaReaderPreferences) => {
    try {
      await AsyncStorage.setItem('mangaReaderPreferences', JSON.stringify(newPreferences));
      setMangaReaderPreferences(newPreferences);
      
      // Apply reading direction immediately
      setReadingDirection(newPreferences.readingDirection === 'vertical' ? 'ltr' : newPreferences.readingDirection);
      
      // Apply debug mode immediately
      setDebugMode(newPreferences.debugMode);
    } catch (error) {
      console.error('Failed to save manga reader preferences:', error);
    }
  }, []);

  // Add searchMangaOnAniList before handleNextChapterConfirmed
  const searchMangaOnAniList = useCallback(async (title: string) => {
    try {
      const query = `
        query ($search: String) {
          Media (search: $search, type: MANGA) {
            id
            title {
              romaji
              english
              native
              userPreferred
            }
          }
        }
      `;

      const response = await fetch(ANILIST_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          query,
          variables: {
            search: title
          }
        })
      });

      const data = await response.json();
      console.log('AniList search response:', data);
      
      if (data?.data?.Media?.id) {
        // Return both the ID and all title variations
        return {
          id: data.data.Media.id,
          titles: data.data.Media.title
        };
      }
      return { id: null, titles: null };
    } catch (err) {
      console.error('Error searching manga on AniList:', err);
      return { id: null, titles: null };
    }
  }, []);

  const showNotificationWithAnimation = useCallback(() => {
    // Reset animation values
    notificationOffset.setValue(-100);
    notificationOpacity.setValue(0);

    // Show notification
    setShowNotification(true);

    // Animate in
    Animated.parallel([
      Animated.timing(notificationOpacity, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.spring(notificationOffset, {
        toValue: 0,
        speed: 20,
        bounciness: 5,
        useNativeDriver: true,
      })
    ]).start();

    // Set timer for fade out
    const timer = setTimeout(() => {
      // Animate out
      Animated.parallel([
        Animated.timing(notificationOpacity, {
          toValue: 0,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(notificationOffset, {
          toValue: -100,
          duration: 800,
          useNativeDriver: true,
        })
      ]).start(() => {
        setShowNotification(false);
      });
    }, 3000); // Show for 3 seconds

    return () => clearTimeout(timer);
  }, [notificationOpacity, notificationOffset]);

  // Replace setShowNotification(true) calls with showNotificationWithAnimation()
  const handleNextChapterConfirmed = useCallback(async () => {
    try {
      // Save progress locally regardless of incognito mode
      const key = `reading_progress_${params.mangaId}_${params.chapter}`;
      const progress = {
        page: currentPage,
        totalPages: images.length,
        lastRead: new Date().toISOString(),
        chapterTitle: params.title,
        isCompleted: currentPage === images.length
      };
      await AsyncStorage.setItem(key, JSON.stringify(progress));

      // Mark as completed if on last page
      if (currentPage === images.length) {
        const completedKey = `completed_${params.mangaId}_${params.chapter}`;
        await AsyncStorage.setItem(completedKey, 'true');
      }

      // Only sync with AniList if not in incognito mode
      if (!isIncognito) {
        const token = await SecureStore.getItemAsync(STORAGE_KEY.AUTH_TOKEN);
        if (token) {
          // If anilistId is missing, search for the manga
          let anilistId = params.anilistId;
          if (!anilistId) {
            // Get manga details to get the correct title
            const response = await fetch(`${BASE_API_URL}/manganato/details/${params.mangaId}`);
            const data = await response.json();
            console.log('Manga details:', data);

            if (!data?.title) {
              throw new Error('Could not get manga title');
            }

            console.log('Searching for manga on AniList:', data.title);
            const searchResult = await searchMangaOnAniList(data.title);
            if (!searchResult.id) {
              console.log('Could not find manga on AniList');
              throw new Error('Could not find manga on AniList');
            }
            
            anilistId = searchResult.id;
            console.log('Found manga on AniList:', anilistId);
          }

          const chapterNumber = Array.isArray(params.chapter) 
            ? params.chapter[0].replace(/[^0-9.]/g, '')
            : params.chapter.replace(/[^0-9.]/g, '');

          console.log('Saving progress to AniList:', {
            mediaId: anilistId,
            progress: Math.floor(parseFloat(chapterNumber))
          });

          const mutation = `
            mutation ($mediaId: Int, $progress: Int) {
              SaveMediaListEntry (mediaId: $mediaId, progress: $progress) {
                id
                progress
                media {
                  title {
                    userPreferred
                  }
                }
              }
            }
          `;

          const response = await fetch(ANILIST_API_URL, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
              'Accept': 'application/json',
            },
            body: JSON.stringify({
              query: mutation,
              variables: {
                mediaId: parseInt(String(anilistId)),
                progress: Math.floor(parseFloat(chapterNumber))
              }
            })
          });

          const data = await response.json();
          console.log('AniList response:', data);
          
          if (data.errors) {
            console.error('Error saving to AniList:', data.errors);
            throw new Error(data.errors[0].message);
          }
          
          // Show success notification with manga title if available
          const mangaTitle = data?.data?.SaveMediaListEntry?.media?.title?.userPreferred || params.title;
          setNotificationMessage(`✓ Updated ${mangaTitle} to Chapter ${chapterNumber} on AniList`);
          showNotificationWithAnimation();
        }
      }
      
      // Mark progress as updated
      setHasUpdatedProgress(true);

      // Update the "do not show again" preference if selected
      if (shouldSaveProgress) {
        await AsyncStorage.setItem('autoSaveProgress', 'true');
      }
      
      setShowSaveModal(false);
      setPendingNextChapter(false);
      
      // Show chapter sources modal after saving
      if (navigationType) {
        setShowChapterModal(true);
      }
    } catch (err) {
      console.error('Error saving progress:', err);
      setNotificationMessage('❌ Failed to save progress' + (isIncognito ? '' : ' to AniList'));
      showNotificationWithAnimation();
      
      setShowSaveModal(false);
      setPendingNextChapter(false);
      
      // Only show chapter sources modal if there was an error saving
      if (navigationType) {
        setShowChapterModal(true);
      }
    }
  }, [
    isIncognito,
    currentPage,
    images.length,
    params.mangaId,
    params.chapter,
    params.title,
    params.anilistId,
    shouldSaveProgress,
    navigationType,
    searchMangaOnAniList,
    showNotificationWithAnimation
  ]);

  // Add a new helper function to ensure proper navigation
  const navigateToMangaDetails = useCallback((mangaId: string | null) => {
    if (!mangaId) {
      console.warn('No mangaId found for navigation, going to manga tab instead');
      router.replace('/(tabs)/@manga');
      return;
    }
    
    // Always prioritize navigation using AniList ID
    // If mangaId is already an AniList ID (numeric), use it directly
    if (!isNaN(parseInt(mangaId))) {
      console.log('Navigating to manga page with AniList ID:', mangaId);
      router.replace({
        pathname: '/manga/[id]',
        params: { id: mangaId }
      });
      return;
    }
    
    // Otherwise check if we have stored the AniList ID for this manga ID
    AsyncStorage.getItem(`anilist_id_for_${mangaId}`).then(anilistId => {
      if (anilistId) {
        console.log('Found stored AniList ID:', anilistId, 'for manga:', mangaId);
        router.replace({
          pathname: '/manga/[id]',
          params: { id: anilistId }
        });
      } else {
        // Fallback to using the original ID if no AniList ID is found
        console.log('No AniList ID found, using original ID:', mangaId);
        router.replace({
          pathname: '/manga/[id]',
          params: { id: mangaId }
        });
      }
    }).catch(error => {
      console.error('Error retrieving AniList ID:', error);
      // Fallback on error
      router.replace({
        pathname: '/manga/[id]',
        params: { id: mangaId }
      });
    });
  }, [router]);

  const handleExitWithoutSave = () => {
    setShowExitModal(false);
    // Emit refresh event and navigate to manga details
    DeviceEventEmitter.emit('refreshMangaDetails');
    
    // Navigate back to the manga details page with the ID
    const mangaId = getCurrentMangaId();
    navigateToMangaDetails(mangaId);
  };

  const handleBack = useCallback(() => {
    const handleExit = async () => {
      try {
        // Use our utility function for consistent mangaId access
        const mangaId = getCurrentMangaId();
        
        // Check if user is logged in to AniList
        const token = await SecureStore.getItemAsync(STORAGE_KEY.AUTH_TOKEN);
        
        console.log('Exit flow started', {
          hasUpdatedProgress,
          isIncognito,
          hasAnilistId: !!params.anilistId,
          mangaId,
          hasToken: !!token
        });

        // If progress is already saved or no AniList token, just exit
        if (hasUpdatedProgress || !token) {
          console.log('Progress already saved or no AniList token, exiting directly');
          DeviceEventEmitter.emit('refreshMangaDetails');
          navigateToMangaDetails(mangaId);
          return;
        }

        // If in incognito mode, just exit without showing save prompt
        if (isIncognito) {
          console.log('Incognito mode active, exiting without save prompt');
          DeviceEventEmitter.emit('refreshMangaDetails');
          navigateToMangaDetails(mangaId);
          return;
        }

        // Check auto-save preference
        const shouldAutoSave = await AsyncStorage.getItem('autoSaveOnExit');
        console.log('Preferences loaded:', {
          shouldAutoSave,
          isIncognito,
          hasAnilistId: !!params.anilistId,
          hasToken: !!token
        });
        
        // If auto-save is enabled and we can save
        if (shouldAutoSave === 'true' && !isIncognito && params.anilistId && token) {
          console.log('Auto-save is enabled, saving progress before exit');
          // Wait for save to complete
          await handleNextChapterConfirmed();
          
          // Short delay to ensure the save notification is visible
          setTimeout(() => {
            DeviceEventEmitter.emit('refreshMangaDetails');
            navigateToMangaDetails(getCurrentMangaId());
          }, 1000);
          return;
        }

        // If we can't auto-save or it's disabled, show the exit modal only if logged in
        if (!isIncognito && !hasUpdatedProgress && token) {
          setShowExitModal(true);
        } else {
          // Just exit if we're in incognito, have no progress to save, or not logged in
          DeviceEventEmitter.emit('refreshMangaDetails');
          navigateToMangaDetails(mangaId);
        }
      } catch (error) {
        console.error('Error in exit flow:', error);
        // Fallback to direct exit on error
        DeviceEventEmitter.emit('refreshMangaDetails');
        router.replace('/(tabs)/@manga');
      }
    };

    console.log('Back button pressed, starting exit flow');
    handleExit();
  }, [hasUpdatedProgress, isIncognito, params.anilistId, handleNextChapterConfirmed, router, getCurrentMangaId, navigateToMangaDetails]);

  const handleExitWithSave = async () => {
    try {
      // Save the auto-save preference if checked
      if (shouldAutoSaveOnExit) {
        await AsyncStorage.setItem('autoSaveOnExit', 'true');
      }
      
      // Wait for the save operation to complete
      await handleNextChapterConfirmed();
      
      // Only proceed with cleanup and navigation after save is complete
      setNavigationType(null);
      setPendingNextChapter(false);
      setShowChapterModal(false);
      setShowExitModal(false);
      
      // Short delay to ensure the save notification is visible
      setTimeout(() => {
        // Emit refresh event and navigate
        DeviceEventEmitter.emit('refreshMangaDetails');
        navigateToMangaDetails(getCurrentMangaId());
      }, 1000); // 1 second delay
    } catch (error) {
      console.error('Error saving progress before exit:', error);
      setNotificationMessage('❌ Failed to save progress to AniList');
      showNotificationWithAnimation();
      // Give user a chance to see the error before exiting
      setTimeout(() => {
        navigateToMangaDetails(getCurrentMangaId());
      }, 2000);
    }
  };

  // Add useEffect to handle hardware back button
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      handleBack();
      return true;
    });

    return () => backHandler.remove();
  }, [handleBack]);

  // Load auto-save preference on mount
  useEffect(() => {
    const loadAutoSavePreferences = async () => {
      try {
        // Load both preferences separately to avoid type issues
        const autoSaveOnExit = await AsyncStorage.getItem('autoSaveOnExit');
        const autoSave = await AsyncStorage.getItem('autoSaveProgress');
        
        setShouldAutoSaveOnExit(autoSaveOnExit === 'true');
        setShouldAutoSave(autoSave === 'true');
      } catch (err) {
        console.error('Error loading auto-save preferences:', err);
      }
    };

    loadAutoSavePreferences();
  }, []);

  // Handle zoom functionality
  const handleZoomToggle = useCallback(() => {
    if (!mangaReaderPreferences.zoomEnabled) {
      // If zoom is disabled, just toggle UI
      setShowUI(prev => !prev);
      return;
    }

    if (isZoomed) {
      // Zoom out: restore UI and navigation, reset pan position
      setIsZoomed(false);
      setZoomScale(1);
      setShowUI(true);
      
      // Reset pan position
      translateX.value = withSpring(0);
      translateY.value = withSpring(0);
      
      Animated.timing(zoomAnimatedValue, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      // Zoom in: hide UI and disable navigation
      setIsZoomed(true);
      setZoomScale(2);
      setShowUI(false);
      
      Animated.timing(zoomAnimatedValue, {
        toValue: 2,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [isZoomed, mangaReaderPreferences.zoomEnabled, zoomAnimatedValue, translateX, translateY]);

  const toggleUI = useCallback(() => {
    if (isZoomed) {
      // If zoomed, clicking should zoom out instead of toggling UI
      handleZoomToggle();
    } else {
      // Normal UI toggle when not zoomed
      setShowUI(prev => !prev);
    }
  }, [isZoomed, handleZoomToggle]);

  // Add function to fetch and set all chapters
  const fetchChapters = useCallback(async () => {
    try {
      console.log('Fetching chapters for mangaId:', params.mangaId);
      
      // First, try using MangaProviderService if we have provider info from params
      const readerProvider = Array.isArray(params.readerCurrentProvider) 
        ? params.readerCurrentProvider[0] 
        : params.readerCurrentProvider;
      const readerMangaSlugId = Array.isArray(params.readerMangaSlugId) 
        ? params.readerMangaSlugId[0] 
        : params.readerMangaSlugId;
      
      if (readerProvider && readerMangaSlugId && readerProvider !== 'unknown') {
        try {
          console.log('=== USING MANGA PROVIDER SERVICE ===');
          console.log('Provider:', readerProvider);
          console.log('Manga ID:', readerMangaSlugId);
          
          // Use MangaProviderService to get chapters (same as ChapterList)
          const chapters = await MangaProviderService.getChapters(readerMangaSlugId, readerProvider as 'mangadex' | 'katana' | 'mangafire');
          
          if (chapters && chapters.length > 0) {
            console.log('=== MANGA PROVIDER SERVICE SUCCESS ===');
            console.log(`Successfully loaded ${chapters.length} chapters from ${readerProvider}`);
            
            // Convert to the Chapter format expected by reader
            const formattedChapters = chapters.map((ch: any) => ({
              id: ch.id,
              number: ch.number,
              title: ch.title || `Chapter ${ch.number}`,
              url: ch.url || ch.id
            }));
            
            setAllChapters(formattedChapters);
            
            // Create ChapterManager for proper navigation
            const manager = new ChapterManager(chapters, readerProvider as string, readerMangaSlugId);
            setChapterManager(manager);
            console.log(`Created ChapterManager in reader with ${chapters.length} chapters`);
            
            // Find current chapter index
            const currentChapterStr = String(params.chapter);
            const index = formattedChapters.findIndex((ch: Chapter) => {
              // Try exact match first
              if (ch.number === currentChapterStr) return true;
              // Try partial match (e.g., "5: Good Evening" matches "5")
              if (ch.number.startsWith(currentChapterStr + ':')) return true;
              // Try number extraction
              const chNum = ch.number.match(/^(\d+(\.\d+)?)/);
              if (chNum && chNum[1] === currentChapterStr) return true;
              return false;
            });
            
            console.log('Current chapter index:', index, 'for chapter:', currentChapterStr);
            setCurrentChapterIndex(index);
            
            // Set navigation availability
            const hasNext = index < formattedChapters.length - 1;
            const hasPrev = index > 0;
            console.log('Navigation availability - Next:', hasNext, 'Previous:', hasPrev);
            setHasNextChapter(hasNext);
            setHasPreviousChapter(hasPrev);
            
            return; // Success! Exit early
          }
        } catch (providerError) {
          console.error('MangaProviderService failed:', providerError);
          // Continue to fallback APIs
        }
      }
      
      // Fallback: Try the old API endpoints if MangaProviderService failed
      if (params.mangaId) {
        // First try to load from takiapi mangareader endpoint
        const apiUrl = `${BASE_API_URL}/manga/mangareader/info/${params.mangaId}`;
        console.log('Fetching chapters from takiapi (mangareader):', apiUrl);
        
        let response;
        let data;
        let apiSuccess = false;
        
        try {
          response = await fetch(apiUrl);
          
          // Check if response is ok
          if (response.ok) {
            data = await response.json();
            
            // Validate that the data is in the expected format
            if ((data?.chapters && Array.isArray(data.chapters)) || 
                (data?.data?.chapters && Array.isArray(data.data.chapters))) {
              apiSuccess = true;
            } else {
              console.log('Invalid data format from mangareader API, trying alternative source');
            }
          } else {
            console.error(`MangaReader API returned status ${response.status}: ${response.statusText}`);
          }
        } catch (err) {
          console.error('Error fetching from primary API:', err);
        }
        
        // If the first API call failed, try the Katana API as fallback
        if (!apiSuccess) {
          try {
            console.log('Trying Katana API as fallback');
            
            // Use mangaId directly for Katana API if it looks like a numeric ID
            let katanaId = params.mangaId;
            
            // If using an AniList ID from params, prioritize it
            if (params.anilistId) {
              katanaId = params.anilistId;
              console.log('Using AniList ID for Katana API:', katanaId);
            }
            
            const katanaUrl = `${KATANA_API_URL}/katana/series/${katanaId}`;
            console.log('Fetching from Katana API:', katanaUrl);
            
            const katanaResponse = await fetch(katanaUrl);
            
            if (katanaResponse.ok) {
              const katanaData = await katanaResponse.json();
              
              if (katanaData?.success && katanaData?.data?.chapters && Array.isArray(katanaData.data.chapters)) {
                console.log('=== KATANA API SUCCESS ===');
                console.log('Successfully fetched chapters from Katana API');
                console.log('Setting currentProvider to: katana');
                console.log('Setting mangaSlugId to:', katanaId);
                setCurrentProvider('katana');
                
                // Format chapters from Katana API response
                const chaptersArray = katanaData.data.chapters;
                
                const formattedChapters = chaptersArray.map((ch: any) => {
                  // For Katana API, each chapter has a slightly different format
                  const chId = ch.id || ch.chapterId || ch.chapter || '';
                  let chapterNumber = chId;
                  
                  // If the chapter ID starts with 'c', remove it
                  if (chapterNumber.startsWith('c')) {
                    chapterNumber = chapterNumber.substring(1);
                  }
                  
                  return {
                    id: chId,
                    number: chapterNumber,
                    title: ch.title || ch.name || `Chapter ${chapterNumber}`,
                    url: chId
                  };
                });
                
                console.log('Formatted Katana chapters:', formattedChapters);
                setAllChapters(formattedChapters);
                
                // Find current chapter index
                const index = formattedChapters.findIndex(
                  (ch: Chapter) => ch.number === params.chapter
                );
                console.log('Current chapter index in Katana:', index, 'for chapter:', params.chapter);
                setCurrentChapterIndex(index);
                
                // Set navigation availability
                const hasNext = index > 0;
                const hasPrev = index < formattedChapters.length - 1;
                console.log('Katana navigation availability - Next:', hasNext, 'Previous:', hasPrev);
                setHasNextChapter(hasNext);
                setHasPreviousChapter(hasPrev);
                
                // Set the manga slug ID for future requests
                setMangaSlugId(katanaId as string);
                
                return; // Exit early since we successfully processed chapters
              }
            }
          } catch (katanaErr) {
            console.error('Error fetching from Katana API:', katanaErr);
          }
        }
        
        // If we reach here with apiSuccess true, process the original API data
        if (apiSuccess) {
          console.log('=== MANGAREADER API SUCCESS ===');
          console.log('Successfully fetched chapters from mangareader API');
          console.log('Setting currentProvider to: mangareader');
          setCurrentProvider('mangadex');
          
          const chaptersArray = data?.chapters || data?.data?.chapters || [];
          console.log(`Found ${chaptersArray.length} chapters in response`);
          
          const formattedChapters = chaptersArray.map((ch: ApiChapter | any) => {
            // Handle different possible formats
            const id = ch.id || ch.chapterId || '';
            const title = ch.title || ch.name || `Chapter ${id}`;
            
            // Extract chapter number from ID or use default format
            const numberMatch = id.match(/chapter-(.+)/) || id.match(/(\d+(\.\d+)?)/);
            const chapterNumber = numberMatch ? numberMatch[1] : '';
            
            return {
              id: id,
              number: chapterNumber,
              title: title,
              url: id
            };
          });
          
          console.log('Formatted chapters:', formattedChapters);
          setAllChapters(formattedChapters);
          
          // Find current chapter index
          const index = formattedChapters.findIndex(
            (ch: Chapter) => ch.number === params.chapter
          );
          console.log('Current chapter index:', index, 'for chapter:', params.chapter);
          setCurrentChapterIndex(index);
          
          // Set navigation availability
          const hasNext = index > 0;
          const hasPrev = index < formattedChapters.length - 1;
          console.log('Navigation availability - Next:', hasNext, 'Previous:', hasPrev);
          setHasNextChapter(hasNext);
          setHasPreviousChapter(hasPrev);
        } else {
          // If both APIs failed, create fallback with simple chapter navigation
          console.log('All APIs failed, using fallback navigation based on chapter number');
          
          // Create fallback navigation based on chapter number only
          const currentChapterNum = parseFloat(String(params.chapter));
          if (!isNaN(currentChapterNum)) {
            // Use simple next/previous chapter logic
            setHasNextChapter(params.isLatestChapter !== 'true');
            setHasPreviousChapter(currentChapterNum > 1);
            
            // Generate synthetic chapters list
            const syntheticChapters = [];
            
            // Add previous chapter if it exists
            if (currentChapterNum > 1) {
              syntheticChapters.push({
                id: `chapter-${currentChapterNum - 1}`,
                number: String(currentChapterNum - 1),
                title: `Chapter ${currentChapterNum - 1}`,
                url: `chapter-${currentChapterNum - 1}`
              });
            }
            
            // Add current chapter
            syntheticChapters.push({
              id: `chapter-${currentChapterNum}`,
              number: String(currentChapterNum),
              title: `Chapter ${currentChapterNum}`,
              url: `chapter-${currentChapterNum}`
            });
            
            // Add next chapter if not latest
            if (params.isLatestChapter !== 'true') {
              syntheticChapters.push({
                id: `chapter-${currentChapterNum + 1}`,
                number: String(currentChapterNum + 1),
                title: `Chapter ${currentChapterNum + 1}`,
                url: `chapter-${currentChapterNum + 1}`
              });
            }
            
            setAllChapters(syntheticChapters);
            setCurrentChapterIndex(1); // Current chapter is in the middle
          }
        }
      }
    } catch (err) {
      console.error('Error in fetchChapters:', err);
      // Create a minimal fallback
      const currentChapterNum = parseFloat(String(params.chapter));
      if (!isNaN(currentChapterNum)) {
        setHasNextChapter(params.isLatestChapter !== 'true');
        setHasPreviousChapter(currentChapterNum > 1);
      }
    }
  }, [params.mangaId, params.chapter, params.isLatestChapter, params.anilistId]);

  // Call fetchChapters when component mounts
  useEffect(() => {
    fetchChapters();
  }, [fetchChapters]);
  
  // Move getChapterByType to the top
  const getChapterByType = useCallback((type: 'next' | 'previous') => {
    console.log('Getting chapter by type:', type);
    console.log('Current chapter index:', currentChapterIndex);
    console.log('Current chapter number:', params.chapter);
    console.log('Total chapters:', allChapters.length);
    
    // IMPROVED CHAPTER NAVIGATION:
    // 1. First try to use the indexed approach if we have the correct current chapter index
    if (allChapters && allChapters.length > 0 && currentChapterIndex !== -1) {
      const targetIndex = type === 'next' 
        ? currentChapterIndex + 1  // Next chapter is index + 1
        : currentChapterIndex - 1; // Previous chapter is index - 1
      
      console.log('Target chapter index (using index):', targetIndex);
      
      if (targetIndex >= 0 && targetIndex < allChapters.length) {
        const chapter = allChapters[targetIndex];
        console.log('Found target chapter using index approach:', chapter);
        return {
          ...chapter,
          url: chapter.id
        };
      }
    }
    
    // 2. If index approach failed, try to find the chapter by comparing number values
    if (allChapters && allChapters.length > 0 && params.chapter) {
      // Parse current chapter number
      const currentChapterNum = parseFloat(String(params.chapter));
      
      if (!isNaN(currentChapterNum)) {
        // Calculate the target chapter number
        const targetChapterNum = type === 'next' 
          ? currentChapterNum + 1 
          : currentChapterNum - 1;
        
        console.log('Looking for chapter with number close to:', targetChapterNum);
        
        // Find the chapter with the closest matching number 
        // In case of exact decimal matches like 10.5, we want to find that exact one
        // Otherwise, for integers like 10, we want either 10 or 10.1, 10.2, etc.
        const exactMatch = allChapters.find(ch => parseFloat(ch.number) === targetChapterNum);
        
        if (exactMatch) {
          console.log('Found exact chapter match:', exactMatch);
          return {
            ...exactMatch,
            url: exactMatch.id
          };
        }
        
        // If no exact match, use a different approach for next vs previous
        if (type === 'next') {
          // For next, find the first chapter with number > current
          const nextChapters = allChapters.filter(ch => {
            const num = parseFloat(ch.number);
            return !isNaN(num) && num > currentChapterNum;
          });
          
          // Sort in ascending order to get the closest next chapter
          nextChapters.sort((a, b) => parseFloat(a.number) - parseFloat(b.number));
          
          if (nextChapters.length > 0) {
            const closest = nextChapters[0];
            console.log('Found closest next chapter:', closest);
            return {
              ...closest,
              url: closest.id
            };
          }
        } else { // For previous chapters
          // For previous, find chapters with number < current
          const prevChapters = allChapters.filter(ch => {
            const num = parseFloat(ch.number);
            return !isNaN(num) && num < currentChapterNum;
          });
          
          // Sort in descending order to get the closest previous chapter
          prevChapters.sort((a, b) => parseFloat(b.number) - parseFloat(a.number));
          
          if (prevChapters.length > 0) {
            const closest = prevChapters[0];
            console.log('Found closest previous chapter:', closest);
            return {
              ...closest,
              url: closest.id
            };
          }
        }
      }
    }
    
    // 3. If all else fails, create a synthetic chapter object
    if (params.chapter) {
      const currentChapterNum = parseFloat(String(params.chapter));
      
      if (!isNaN(currentChapterNum)) {
        const targetChapterNum = type === 'next' 
          ? currentChapterNum + 1 
          : currentChapterNum - 1;
        
        console.log('Creating synthetic chapter with number:', targetChapterNum);
        
        // For next chapters, always create a synthetic chapter if the number is valid
        // This is more user-friendly than blocking navigation
        if (targetChapterNum > 0) {
          return {
            id: `chapter-${targetChapterNum}`,
            number: String(targetChapterNum),
            title: `Chapter ${targetChapterNum}`,
            url: `chapter-${targetChapterNum}`
          };
        }
      }
    }
    
    console.log('No chapter found for', type);
    return null;
  }, [allChapters, currentChapterIndex, params.chapter, params.isLatestChapter]);

  // Add fetchPagesAndNavigate after getChapterByType
  const fetchPagesAndNavigate = useCallback(async (chapter: Chapter) => {
    try {
      console.log('Fetching pages for chapter:', chapter);
      const pagesUrl = `${BASE_API_URL}/manga/mangareader/read/${chapter.id}`;
      console.log('Fetching chapter pages from takiapi (mangareader):', pagesUrl);
      
      const response = await fetch(pagesUrl);
      const data = await response.json();

      console.log('Takiapi pages response:', data);

      // Check for API error response
      if (data?.error) {
        console.error(`API error: ${data.error}. ${data.message || ''}`);
        setNotificationMessage(`Could not load chapter: ${data.error}`);
        showNotificationWithAnimation();
        return;
      }

      // Check for both result.images (old API) and images (new API) formats
      const images = data?.result?.images || data?.images;
      
      if (images && Array.isArray(images)) {
        const imageUrls = images
          .filter((img: { url: string } | string) => {
            // Handle both object format {url: string} and direct string format
            const imgUrl = typeof img === 'object' ? img.url : img;
            return imgUrl && 
              typeof imgUrl === 'string' && 
              !imgUrl.includes('logo-chap.png') && 
              !imgUrl.includes('gohome.png') &&
              !imgUrl.includes('chapmanganato.to');
          })
          .map((img: { url: string } | string) => typeof img === 'object' ? img.url : img);

        console.log(`Processed ${imageUrls.length} images for navigation`);

        if (imageUrls.length > 0) {
          console.log('Navigating with params:', {
            ...params,
            chapter: chapter.number,
            title: chapter.title,
            anilistId: params.anilistId,
            mangaId: params.mangaId
          });

          router.push({
            pathname: '/reader',
            params: {
              ...params,
              chapter: chapter.number,
              title: chapter.title,
              anilistId: params.anilistId,
              mangaId: params.mangaId,
              ...Object.fromEntries(imageUrls.map((url: string, i: number) => [`image${i + 1}`, url]))
            }
          });
        } else {
          console.error('No valid images found in response');
          setNotificationMessage('No images found for this chapter');
          showNotificationWithAnimation();
        }
      } else {
        console.error('Invalid response format - no images array found:', data);
        setNotificationMessage('Invalid response format from server');
        showNotificationWithAnimation();
      }
    } catch (err) {
      console.error('Error fetching chapter pages:', err);
      setNotificationMessage('Error loading chapter');
      showNotificationWithAnimation();
    }
  }, [params, router, showNotificationWithAnimation]);

  // Update navigation functions to use fetchPagesAndNavigate
  const goToNextChapter = useCallback(() => {
    // Check API flag first
    if (params.isLatestChapter === 'true') {
      setNotificationMessage("📖 You're on the latest chapter!");
      showNotificationWithAnimation();
      return;
    }
    
    const nextChapter = getChapterByType('next');
    
    if (nextChapter) {
      console.log('Going to next chapter:', nextChapter.number);
      // IMPORTANT: Directly navigate without saving progress
      fetchPagesAndNavigate(nextChapter);
    } else {
      setNotificationMessage("📖 You're on the latest chapter!");
      showNotificationWithAnimation();
    }
  }, [params.isLatestChapter, getChapterByType, fetchPagesAndNavigate, showNotificationWithAnimation, setNotificationMessage]);

  const goToPreviousChapter = useCallback(() => {
    // Check API flag first
    if (params.isFirstChapter === 'true') {
      setNotificationMessage("📖 You're on the first chapter!");
      showNotificationWithAnimation();
      return;
    }
    
    const prevChapter = getChapterByType('previous');
    
    if (prevChapter) {
      console.log('Going to previous chapter:', prevChapter.number);
      fetchPagesAndNavigate(prevChapter);
    } else {
      setNotificationMessage("📖 You're on the first chapter!");
      showNotificationWithAnimation();
    }
  }, [params.isFirstChapter, getChapterByType, fetchPagesAndNavigate, showNotificationWithAnimation, setNotificationMessage]);

  // Add fetchKatanaChapterAndNavigate before handleChapterNavigation
  const fetchKatanaChapterAndNavigate = useCallback(async (chapterId: string) => {
    try {
      if (!mangaSlugId) {
        console.error('[Katana] Cannot navigate: missing manga slug ID');
        return;
      }

      console.log('[Katana] Fetching chapter content:', { mangaSlugId, chapterId });
      const chapterUrl = `${KATANA_API_URL}/katana/series/${mangaSlugId}/${chapterId}`;
      console.log('[Katana] Fetching from URL:', chapterUrl);
      
      const response = await fetch(chapterUrl);
      const data = await response.json();
      
      if (data?.success && data?.data?.imageUrls) {
        console.log('[Katana] Successfully fetched chapter data:', {
          title: data.data.title,
          chapter: data.data.chapter,
          totalImages: data.data.imageUrls.length
        });
        
        // Process images from the response
        const imageUrls = data.data.imageUrls.map((img: any) => {
          // Use proxyUrl if available, otherwise fallback to direct url
          const imageUrl = `${KATANA_API_URL}${img.proxyUrl}`;
          return imageUrl;
        });
        
        if (imageUrls.length > 0) {
          console.log('[Katana] Navigating with', imageUrls.length, 'images');
          
          // Extract chapter number from the response
          let chapterNumber = data.data.chapter;
          if (chapterNumber.startsWith('c')) {
            chapterNumber = chapterNumber.substring(1);
          }
          
          router.push({
            pathname: '/reader',
            params: {
              ...params,
              chapter: chapterNumber,
              title: data.data.title,
              anilistId: params.anilistId,
              mangaId: params.mangaId,
              ...Object.fromEntries(imageUrls.map((url: string, i: number) => [`image${i + 1}`, url]))
            }
          });
        } else {
          console.error('[Katana] No images found in response');
        }
      } else {
        console.error('[Katana] Invalid response:', data);
      }
    } catch (error) {
      console.error('[Katana] Error fetching chapter:', error);
    }
  }, [mangaSlugId, params, router]);

  // Update handleChapterNavigation to use params.mangaId
  const handleChapterNavigation = useCallback((type: 'next' | 'previous') => {
    // Use API flags to determine if navigation should be blocked
    if (type === 'next' && params.isLatestChapter === 'true') {
      setNotificationMessage("📖 You're on the latest chapter!");
      showNotificationWithAnimation();
      return;
    }

    if (type === 'previous' && params.isFirstChapter === 'true') {
      setNotificationMessage("📖 You're on the first chapter!");
      showNotificationWithAnimation();
      return;
    }

    setNavigationType(type);
    
    // Get the target chapter using getChapterByType which has fallback mechanisms
    const targetChapter = getChapterByType(type);
    
    if (!targetChapter) {
      console.log('No target chapter found for navigation type:', type);
      setNotificationMessage(`📖 No ${type} chapter available!`);
      showNotificationWithAnimation();
      return;
    }
    
    console.log(`[Navigation] Navigating to ${type} chapter:`, {
      currentChapter: params.chapter,
      targetChapter: targetChapter.number,
      mangaName: params.title,
      isLatestChapter: params.isLatestChapter,
      isFirstChapter: params.isFirstChapter
    });
    
    setSelectedChapter(targetChapter);
    
    // Check if user is logged in to AniList
    SecureStore.getItemAsync(STORAGE_KEY.AUTH_TOKEN).then(token => {
      // Skip save modal if no token (not logged in), in incognito mode, or auto-save enabled
      if (!token || isIncognito || shouldAutoSave) {
        setAutoLoadChapter(true);
        setShowChapterModal(true);
        return;
      }

      if (!hasUpdatedProgress && type === 'next') {
        setShowSaveModal(true);
        setPendingNextChapter(true);
        setAutoLoadChapter(true);
      } else {
        setAutoLoadChapter(true);
        setShowChapterModal(true);
      }
    }).catch(err => {
      console.error('Error checking auth token:', err);
      // On error, just show the chapter modal directly
      setAutoLoadChapter(true);
      setShowChapterModal(true);
    });
  }, [
    isIncognito, 
    shouldAutoSave, 
    hasUpdatedProgress, 
    params.chapter,
    params.title,
    params.mangaId,
    params.isLatestChapter,
    params.isFirstChapter,
    showNotificationWithAnimation,
    getChapterByType
  ]);

  const goToPage = useCallback((pageNumber: number) => {
    if (pageNumber < 1) return;
    
    if (pageNumber > images.length) {
      // Show save progress modal before navigating only in LTR mode
      // In RTL mode, we'll handle this in handleScroll
      if (readingDirection === 'ltr') {
        setPendingNextChapter(true);
        setShowSaveModal(true);
      }
      return;
    }
    
    setCurrentPage(pageNumber);
    
    // Calculate the correct index to scroll to
    let indexToScrollTo;
    if (readingDirection === 'rtl') {
      // In RTL mode, we need to scroll to the reversed index
      indexToScrollTo = images.length - pageNumber;
    } else {
      // In LTR mode, scroll to the page number minus 1 (0-based index)
      indexToScrollTo = pageNumber - 1;
    }
    
    flatListRef.current?.scrollToIndex({
      index: indexToScrollTo,
      animated: true,
      viewPosition: 0
    });
  }, [images.length, readingDirection]);

  // Add this new function before handleScroll
  const handleChapterTransition = useCallback(async (direction: 'next' | 'previous') => {
    // Use API flags to determine if navigation should be blocked
    if (direction === 'next' && params.isLatestChapter === 'true') {
      setNotificationMessage("📖 You're on the latest chapter!");
      showNotificationWithAnimation();
      return;
    }
    
    if (direction === 'previous' && params.isFirstChapter === 'true') {
      setNotificationMessage("📖 You're on the first chapter!");
      showNotificationWithAnimation();
      return;
    }

    // Prevent multiple rapid swipes
    const now = Date.now();
    if (now - lastSwipeTime.current < SWIPE_DEBOUNCE_TIME || swipeDebounce || isTransitioning) {
      console.log('[Swipe] Debouncing swipe:', {
        timeSinceLastSwipe: now - lastSwipeTime.current,
        isDebounced: swipeDebounce,
        isTransitioning
      });
      return;
    }

    lastSwipeTime.current = now;
    setSwipeDebounce(true);
    setIsTransitioning(true);

    try {
      console.log('[Swipe] Initiating chapter transition:', {
        direction,
        currentChapterIndex,
        totalChapters: allChapters.length,
        readingDirection
      });

      // Use improved getChapterByType that handles chapter number matching
      const targetChapter = getChapterByType(direction);
      console.log('[Swipe] Target chapter:', targetChapter);

      if (targetChapter) {
        // Show the overscroll indicator
        setShowOverscrollIndicator(true);
        setOverscrollDirection(direction);

        // Check if user is logged in
        const token = await SecureStore.getItemAsync(STORAGE_KEY.AUTH_TOKEN);
        const isLoggedIn = !!token;

        // If we haven't saved progress and going to next chapter, show save modal
        if (direction === 'next' && !hasUpdatedProgress && isLoggedIn && !isIncognito) {
          console.log('[Swipe] Showing save modal before next chapter');
          setShowSaveModal(true);
          setPendingNextChapter(true);
          setSelectedChapter(targetChapter); // Store chapter for navigation after saving
        } else {
          // Otherwise show chapter modal directly
          console.log('[Swipe] Showing chapter modal directly');
          setNavigationType(direction);
          setSelectedChapter(targetChapter);
          setShowChapterModal(true);
        }
      } else {
        console.log('[Swipe] No more chapters in this direction:', direction);
        setNotificationMessage(`📖 You're on the ${direction === 'next' ? 'latest' : 'first'} chapter!`);
        showNotificationWithAnimation();
      }
    } catch (error) {
      console.error('[Swipe] Error during chapter transition:', error);
    } finally {
      // Reset states after a delay
      setTimeout(() => {
        setSwipeDebounce(false);
        setIsTransitioning(false);
        setShowOverscrollIndicator(false);
        setOverscrollDirection(null);
      }, SWIPE_DEBOUNCE_TIME);
    }
  }, [
    swipeDebounce,
    isTransitioning,
    currentChapterIndex,
    allChapters.length,
    readingDirection,
    hasUpdatedProgress,
    isIncognito,
    getChapterByType,
    showNotificationWithAnimation,
    setNotificationMessage,
    setShowSaveModal,
    setPendingNextChapter,
    setSelectedChapter,
    setNavigationType,
    setShowChapterModal,
    params.isLatestChapter,
    params.isFirstChapter
  ]);

  // Add edge swipe action handler
  const handleEdgeSwipeAction = useCallback((direction: 'start' | 'end') => {
    console.log(`[EdgeSwipe] No more chapters. Exiting from ${direction} edge`);

    // Optionally show a floating notification
    setNotificationMessage(`📖 You've reached the end`);
    showNotificationWithAnimation();

    // Exit the reader screen
    DeviceEventEmitter.emit('refreshMangaDetails'); // Let parent screen refresh if needed
    router.back();
  }, [router, showNotificationWithAnimation]);

  const handleImageLoadSuccess = useCallback((index: number) => {
    setLoadingStates(prev => ({ ...prev, [index]: false }));
    
    // Record image load completion time for debug
    if (debugMode && debugState.current.imageLoads[index]) {
      debugState.current.imageLoads[index].end = Date.now();
    }
  }, [debugMode]);

  const handleImageLoadError = useCallback((index: number, error: any) => {
    console.error(`Error loading image ${index + 1}:`, {
      error,
      url: images[index]
    });
    setLoadingStates(prev => ({ ...prev, [index]: false }));
    setErrorStates(prev => ({ ...prev, [index]: true }));
  }, [images]);

  const retryImage = useCallback((index: number) => {
    setLoadingStates(prev => ({ ...prev, [index]: true }));
    setErrorStates(prev => ({ ...prev, [index]: false }));
  }, []);

  const handleImageLoadStart = useCallback((index: number) => {
    setLoadingStates(prev => ({ ...prev, [index]: true }));
    setErrorStates(prev => ({ ...prev, [index]: false }));
    
    // Add debug timing for image loads
    if (debugMode) {
      debugState.current.imageLoads[index] = {
        start: Date.now(),
        end: null
      };
    }
  }, [debugMode]);

  const progressPercentage = useMemo(() => {
    // Always calculate progress as current page / total pages
    // regardless of reading direction
    return (currentPage / images.length) * 100;
  }, [currentPage, images.length]);

  const handleTouchMove = useCallback((event: any) => {
    if (debugMode && debugGestures) {
      const touch = event.nativeEvent.touches[0];
      setDebugTouch({
        x: touch.pageX,
        y: touch.pageY,
        active: true
      });
    }
  }, [debugMode, debugGestures]);

  const handleTouchEnd = useCallback(() => {
    if (debugMode && debugGestures) {
      setDebugTouch(prev => ({
        ...prev,
        active: false
      }));
    }
  }, [debugMode, debugGestures]);

  const handleImageLayout = useCallback((event: any) => {
    if (debugMode && debugImages) {
      const { width, height } = event.nativeEvent.layout;
      setDebugImageDimensions({ width, height });
    }
  }, [debugMode, debugImages]);

  const renderDebugOverlay = () => {
    if (!debugMode || !showUI) return null;
    
    // Calculate the raw index for debugging
    const rawIndex = readingDirection === 'rtl' 
      ? images.length - currentPage 
      : currentPage - 1;
    
    // Basic debug info always shown in debug mode
    const basicInfo = `Reading: ${readingDirection.toUpperCase()}
Page: ${currentPage}/${images.length}
Index: ${rawIndex} (${readingDirection === 'rtl' ? 'inverted' : 'normal'})
Chapter: ${params.chapter}
Direction: ${readingDirection}
RTL: ${readingDirection === 'rtl' ? 'YES' : 'NO'}`;

    // Level 2 adds performance metrics
    const level2Info = debugLevel >= 2 ? `
Frame: ${debugFrameTime}ms (${Math.round(1000 / Math.max(1, debugFrameTime))}fps)
Velocity: ${scrollVelocityRef.current.toFixed(2)}px/ms
FastScroll: ${isScrollingFast ? 'YES' : 'NO'}
OverScroll: ${isOverScrolling ? 'YES' : 'NO'}
Memory: ${debugMemory}` : '';

    // Level 3 adds detailed load timing but NOT the URI for security
    const level3Info = debugLevel >= 3 ? `
LoadTimes: ${Object.entries(debugState.current.imageLoads)
  .filter(([idx, timing]) => Math.abs(parseInt(idx) - (currentPage - 1)) < 3 && timing.end)
  .map(([idx, timing]) => `\n  Page ${parseInt(idx) + 1}: ${timing.end! - timing.start}ms`)
  .join('')}` : '';

    return (
      <>
        {/* Main debug info overlay - moved to avoid header buttons */}
        <View style={[
          styles.debugOverlay, 
          { 
            top: Platform.OS === 'ios' ? 150 : 130,
            maxHeight: WINDOW_HEIGHT * 0.3 // Limit height so it doesn't take too much space
          }
        ]}>
          <Text style={styles.debugText}>
            {basicInfo + level2Info + level3Info}
          </Text>
        </View>
        
        {/* Secondary info box - moved to avoid footer */}
        {debugLevel >= 2 && (
          <View style={[
            styles.debugInfoBox, 
            { 
              top: Platform.OS === 'ios' ? 150 : 130,
              maxHeight: WINDOW_HEIGHT * 0.3 // Limit height
            }
          ]}>
            <Text style={styles.debugText}>
              {`Window: ${WINDOW_WIDTH}x${WINDOW_HEIGHT}
Image: ${debugImageDimensions.width}x${debugImageDimensions.height}
Aspect: ${(debugImageDimensions.height / debugImageDimensions.width || 0).toFixed(2)}
Touch: ${debugTouch.active ? `${Math.round(debugTouch.x)},${Math.round(debugTouch.y)}` : 'inactive'}
Threshold: ${readingDirection === 'rtl' ? '1px (RTL)' : '10px (LTR)'}`}
            </Text>
          </View>
        )}
        
        {/* Guide lines */}
        {debugGestures && (
          <>
            {/* Center guides */}
            <View style={[styles.debugGuideHorizontal, { top: WINDOW_HEIGHT / 2 }]} />
            <View style={[styles.debugGuideVertical, { left: WINDOW_WIDTH / 2 }]} />
            
            {/* Touch position indicator */}
            {debugTouch.active && (
              <>
                <View style={[styles.debugGuideHorizontal, { top: debugTouch.y }]} />
                <View style={[styles.debugGuideVertical, { left: debugTouch.x }]} />
              </>
            )}
            
            {/* Swipe threshold visualization */}
            <View style={[
              styles.debugSwipeArea,
              {
                top: 0,
                left: 0,
                width: WINDOW_WIDTH * 0.3,
                height: WINDOW_HEIGHT,
              }
            ]} />
            <View style={[
              styles.debugSwipeArea,
              {
                top: 0,
                right: 0,
                width: WINDOW_WIDTH * 0.3,
                height: WINDOW_HEIGHT,
              }
            ]} />
          </>
        )}
        
        {/* Image bounds visualization */}
        {debugImages && (
          <View style={[
            styles.debugImageBounds,
            {
              top: (WINDOW_HEIGHT - debugImageDimensions.height) / 2,
              left: (WINDOW_WIDTH - debugImageDimensions.width) / 2,
              width: debugImageDimensions.width,
              height: debugImageDimensions.height,
            }
          ]} />
        )}
      </>
    );
  };

  const renderItem = useCallback(({ item: imageUrl, index }: { item: string, index: number }) => {
    // Get the specific headers for this image, or use default headers
    const specificHeaders = dynamicImageHeaders[index] || imageHeaders;
    
    // Always load all images - no progressive loading restrictions
    const shouldLoad = true;
    
    return (
      <View style={styles.pageContainer}>
        <TouchableOpacity 
          style={styles.imageContainer} 
          activeOpacity={1}
          onPress={handleZoomToggle}
        >
          <ImageItem
            imageUrl={imageUrl}
            index={index}
            totalImages={images.length}
            imageHeaders={specificHeaders}
            onPress={handleZoomToggle}
            onLoadStart={() => handleImageLoadStart(index)}
            onLoadSuccess={() => handleImageLoadSuccess(index)}
            onLoadError={(error) => handleImageLoadError(index, error)}
            isLoading={loadingStates[index] ?? !shouldLoad}
            hasError={errorStates[index] ?? false}
            onRetry={() => retryImage(index)}
            isNearby={shouldLoad}
            isZoomed={isZoomed}
            zoomAnimatedValue={zoomAnimatedValue}
            translateX={translateX}
            translateY={translateY}
          />
        </TouchableOpacity>
      </View>
    );
  }, [
    images.length,
    dynamicImageHeaders,
    imageHeaders,
    handleZoomToggle,
    handleImageLoadStart,
    handleImageLoadSuccess,
    handleImageLoadError,
    loadingStates,
    errorStates,
    retryImage,
    loadedImageIndices,
    currentPage,
    isZoomed,
    zoomAnimatedValue,
    translateX,
    translateY
  ]);

  const getItemLayout = useCallback((data: any, index: number) => ({
    length: WINDOW_WIDTH,
    offset: WINDOW_WIDTH * index,
    index,
  }), []);

  // Remove the old chapter availability check since we're using the API data now
  const checkAvailableChapters = useCallback(async () => {
    // Get the current chapter number for comparison
    const currentChapterNum = parseFloat(String(params.chapter));
    const hasValidChapterNum = !isNaN(currentChapterNum);
    
    // Only consider a chapter the latest if we have strong evidence
    // A chapter is latest if it's at the end of the array (highest index)
    const isConfirmedLatest = params.isLatestChapter === 'true' && 
                            allChapters.length > 10 && 
                            currentChapterIndex === allChapters.length - 1;
    
    // First try the index-based approach
    if (currentChapterIndex !== -1 && allChapters.length > 0) {
      // For next chapters: Check if there's an index after the current one
      setHasNextChapter(currentChapterIndex < allChapters.length - 1 || !isConfirmedLatest);
      
      // For previous chapters: Check if there's an index before the current one
      setHasPreviousChapter(currentChapterIndex > 0);
    } 
    // Otherwise use a number-based approach
    else if (hasValidChapterNum && allChapters.length > 0) {
      // Check if there's any chapter with a higher number 
      const hasNextByNumber = allChapters.some(ch => 
        !isNaN(parseFloat(ch.number)) && parseFloat(ch.number) > currentChapterNum
      );
      
      // Check if there's any chapter with a lower number
      const hasPrevByNumber = allChapters.some(ch => 
        !isNaN(parseFloat(ch.number)) && parseFloat(ch.number) < currentChapterNum
      );
      
      // For next chapters: Only disable if confirmed latest AND no higher number found
      setHasNextChapter(hasNextByNumber || !isConfirmedLatest);
      
      setHasPreviousChapter(hasPrevByNumber);
    }
    // Fallback to simple check for chapter number
    else if (hasValidChapterNum) {
      // Assume there's always a next chapter unless explicitly confirmed latest
      setHasNextChapter(true);
      
      // Can go back if not chapter 1
      setHasPreviousChapter(currentChapterNum > 1);
    }
    
    console.log('[Reader] Chapter availability:', {
      isConfirmedLatest: isConfirmedLatest,
      currentIndex: currentChapterIndex,
      chapterNumber: params.chapter,
      totalChapters: allChapters.length,
      hasNext: hasNextChapter,
      hasPrevious: hasPreviousChapter
    });
  }, [
    currentChapterIndex, 
    allChapters, 
    params.isLatestChapter, 
    params.chapter, 
    hasNextChapter, 
    hasPreviousChapter
  ]);

  useEffect(() => {
    checkAvailableChapters();
  }, [checkAvailableChapters]);

  // Add function to cancel pending loads
  const cancelPendingLoads = useCallback((exceptIndex?: number) => {
    Object.entries(abortControllerRef.current).forEach(([index, controller]) => {
      if (exceptIndex === undefined || parseInt(index) !== exceptIndex) {
        controller.abort();
        delete abortControllerRef.current[parseInt(index)];
      }
    });
  }, []);

  // Add toggle function
  const toggleReadingDirection = useCallback(() => {
    // Store current page before switching
    const currentPageBeforeSwitch = currentPage;
    
    setReadingDirection(prev => {
      // Explicitly type the return value to ensure it's always 'ltr' or 'rtl'
      const newDirection: 'ltr' | 'rtl' = prev === 'ltr' ? 'rtl' : 'ltr';
      
      // For debugging
      console.log(`[Reader] Switching reading direction from ${prev} to ${newDirection}`);
      console.log(`[Reader] Current page before switch: ${currentPageBeforeSwitch}/${images.length}`);
      
      // Calculate the FlatList index to maintain the same visual page
      // In RTL mode, index 0 shows the last page (images.length)
      // In LTR mode, index 0 shows the first page (1)
      let indexToScrollTo = currentPageBeforeSwitch - 1; // Default to LTR index
      
      if (prev === 'ltr' && newDirection === 'rtl') {
        // LTR to RTL: FlatList index needs to be inverted
        // To keep showing page N, calculate images.length - N
        indexToScrollTo = images.length - currentPageBeforeSwitch;
      } else if (prev === 'rtl' && newDirection === 'ltr') {
        // RTL to LTR: FlatList index needs to be un-inverted
        // To keep showing page N, calculate N - 1
        indexToScrollTo = currentPageBeforeSwitch - 1;
      }
      
      console.log(`[Reader] New direction: ${newDirection}, Index to scroll to: ${indexToScrollTo}`);
      
      // Force re-load all images for the new direction
      console.log(`[Reader] Force reloading all images for ${newDirection} direction`);
      // Reset loaded image indices to force re-rendering
      setLoadedImageIndices(new Set());
      // Trigger aggressive loading
      setTimeout(() => {
        loadAllImages();
      }, 50);
      
      // Scroll to the correct index after a longer delay to allow FlatList re-render
      setTimeout(() => {
        try {
          flatListRef.current?.scrollToIndex({
            index: Math.max(0, Math.min(indexToScrollTo, images.length - 1)),
            animated: false,
            viewPosition: 0
          });
          console.log(`[Reader] Scrolled to index ${indexToScrollTo} for ${newDirection} direction`);
        } catch (error) {
          console.warn(`[Reader] Failed to scroll to index ${indexToScrollTo}:`, error);
          // Fallback: scroll to offset
          const screenWidth = Dimensions.get('window').width;
          const targetOffset = indexToScrollTo * screenWidth;
          flatListRef.current?.scrollToOffset({
            offset: targetOffset,
            animated: false
          });
        }
      }, 100); // Increased delay to allow FlatList key change to take effect
      
      return newDirection;
    });
  }, [currentPage, images.length, loadAllImages]);

  useEffect(() => {
    // Unlock orientation when component mounts
    unlockOrientation();
    
    // Lock back to portrait when component unmounts
    return () => {
      lockPortrait();
    };
  }, [unlockOrientation, lockPortrait]);

  // Add cleanup on unmount
  useEffect(() => {
    return () => {
      isMounted.current = false;
      // Clear any pending navigation
      setNavigationType(null);
      setPendingNextChapter(false);
      // Clear any modals
      setShowChapterModal(false);
      setShowSaveModal(false);
      setShowExitModal(false);
    };
  }, []);

  const toggleDebugMode = useCallback(() => {
    setDebugMode(prev => !prev);
    // Store the debug mode preference in AsyncStorage
    AsyncStorage.setItem('reader_debug_mode', (!debugMode).toString());
  }, [debugMode]);

  // Load debug mode preference
  useEffect(() => {
    const loadDebugModePreference = async () => {
      try {
        const savedDebugMode = await AsyncStorage.getItem('reader_debug_mode');
        if (savedDebugMode !== null) {
          setDebugMode(savedDebugMode === 'true');
        }
      } catch (err) {
        console.error('Error loading debug mode preference:', err);
      }
    };

    loadDebugModePreference();
  }, []);

  // Save reading direction preference
  useEffect(() => {
    const saveReadingDirectionPreference = async () => {
      try {
        await AsyncStorage.setItem('reading_direction', readingDirection);
      } catch (err) {
        console.error('Error saving reading direction preference:', err);
      }
    };

    saveReadingDirectionPreference();
  }, [readingDirection]);

  // Load reading direction preference
  useEffect(() => {
    const loadReadingDirectionPreference = async () => {
      try {
        const savedDirection = await AsyncStorage.getItem('reading_direction');
        if (savedDirection !== null && (savedDirection === 'ltr' || savedDirection === 'rtl')) {
          setReadingDirection(savedDirection);
        }
      } catch (err) {
        console.error('Error loading reading direction preference:', err);
      }
    };

    loadReadingDirectionPreference();
  }, []);

  // Toggle additional debug features
  const toggleDebugFeature = useCallback((feature: 'level' | 'gestures' | 'images') => {
    switch (feature) {
      case 'level':
        setDebugLevel(prev => prev < 3 ? prev + 1 : 1);
        break;
      case 'gestures':
        setDebugGestures(prev => !prev);
        break;
      case 'images':
        setDebugImages(prev => !prev);
        break;
    }
  }, []);

  // Load all debug mode preferences
  useEffect(() => {
    const loadDebugPreferences = async () => {
      try {
        const savedDebugMode = await AsyncStorage.getItem('reader_debug_mode');
        const savedDebugLevel = await AsyncStorage.getItem('reader_debug_level');
        const savedDebugGestures = await AsyncStorage.getItem('reader_debug_gestures');
        const savedDebugImages = await AsyncStorage.getItem('reader_debug_images');
        
        if (savedDebugMode !== null) setDebugMode(savedDebugMode === 'true');
        if (savedDebugLevel !== null) setDebugLevel(parseInt(savedDebugLevel));
        if (savedDebugGestures !== null) setDebugGestures(savedDebugGestures === 'true');
        if (savedDebugImages !== null) setDebugImages(savedDebugImages === 'true');
      } catch (err) {
        console.error('Error loading debug preferences:', err);
      }
    };

    loadDebugPreferences();
  }, []);

  // Save debug preferences when they change
  useEffect(() => {
    const saveDebugPreferences = async () => {
      try {
        await AsyncStorage.setItem('reader_debug_mode', debugMode.toString());
        await AsyncStorage.setItem('reader_debug_level', debugLevel.toString());
        await AsyncStorage.setItem('reader_debug_gestures', debugGestures.toString());
        await AsyncStorage.setItem('reader_debug_images', debugImages.toString());
      } catch (err) {
        console.error('Error saving debug preferences:', err);
      }
    };

    saveDebugPreferences();
  }, [debugMode, debugLevel, debugGestures, debugImages]);

  // Debug animation frame for performance monitoring
  useEffect(() => {
    if (debugMode && debugLevel >= 2) {
      const updateDebugInfo = () => {
        const now = Date.now();
        const frameTime = now - debugState.current.lastFrameTime;
        debugState.current.frameTime = frameTime;
        debugState.current.lastFrameTime = now;
        setDebugFrameTime(frameTime);
        
        // Periodically update memory usage if supported
        if (now % 1000 < 50) {
          try {
            // Check for performance.memory in a safer way
            if (
              typeof global !== 'undefined' && 
              global.performance && 
              // @ts-ignore - Memory API is non-standard
              typeof global.performance.memory !== 'undefined'
            ) {
              // Define an interface for the non-standard memory API
              interface MemoryInfo {
                usedJSHeapSize: number;
                jsHeapSizeLimit: number;
                totalJSHeapSize: number;
              }
              
              // @ts-ignore - Access the non-standard memory property
              const memory = global.performance.memory as MemoryInfo;
              setDebugMemory(`${Math.round(memory.usedJSHeapSize / 1048576)}MB / ${Math.round(memory.jsHeapSizeLimit / 1048576)}MB`);
            } else {
              setDebugMemory("API not available");
            }
          } catch (e) {
            // Silently fail if memory API is not available
            setDebugMemory("Error accessing memory");
          }
        }
        
        debugState.current.animationFrame = requestAnimationFrame(updateDebugInfo);
      };
      
      debugState.current.animationFrame = requestAnimationFrame(updateDebugInfo);
      
      return () => {
        if (debugState.current.animationFrame !== null) {
          cancelAnimationFrame(debugState.current.animationFrame);
        }
      };
    }
  }, [debugMode, debugLevel]);

  // Define renderSettingsModal function here
  const renderSettingsModal = () => {
    const renderDropdownMenu = () => {
      if (!showDebugDropdown) return null;
      
      return (
        <View style={styles.dropdownMenu}>
          {[1, 2, 3].map((level) => (
            <TouchableOpacity
              key={level}
              style={styles.dropdownMenuItem}
              onPress={() => {
                setDebugLevel(level);
                setShowDebugDropdown(false);
              }}
            >
              <Text style={styles.dropdownMenuItemText}>Level {level}</Text>
              {debugLevel === level && (
                <FontAwesome5 name="check" size={12} color="#02A9FF" />
              )}
            </TouchableOpacity>
          ))}
        </View>
      );
    };

    return (
      <Modal
        visible={showSettingsModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowSettingsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[
            styles.settingsModal,
            { backgroundColor: isDarkMode ? '#1A1A1A' : '#FFFFFF' }
          ]}>
            <Text style={[
              styles.settingsTitle,
              { color: isDarkMode ? '#FFFFFF' : '#333333' }
            ]}>
              Reader Settings
            </Text>
            
            <ScrollView style={styles.settingsScrollView} showsVerticalScrollIndicator={false}>
              {/* Reading Direction Section */}
              <View style={styles.settingsSection}>
                <View style={styles.sectionHeader}>
                  <FontAwesome5 name="book-open" size={20} color="#42A5F5" />
                  <Text style={[styles.settingsSectionTitle, { color: isDarkMode ? '#FFFFFF' : '#333333' }]}>
                    Reading Settings
                  </Text>
                </View>

                {/* Reading Direction Setting */}
                <View style={[styles.settingItem, { borderBottomColor: isDarkMode ? '#333' : '#E0E0E0' }]}>
                  <View style={{ marginBottom: 12 }}>
                    <Text style={[styles.settingLabel, { color: isDarkMode ? '#FFFFFF' : '#333333' }]}>Reading Direction</Text>
                  </View>
                  <View style={styles.directionOptions}>
                    {[
                      { id: 'rtl', name: 'Right to Left', icon: 'arrow-left' },
                      { id: 'ltr', name: 'Left to Right', icon: 'arrow-right' }
                    ].map(direction => (
                      <TouchableOpacity
                        key={`direction-${direction.id}`}
                        style={[
                          styles.directionOption,
                          mangaReaderPreferences.readingDirection === direction.id && styles.directionOptionSelected
                        ]}
                        onPress={() => {
                          saveMangaReaderPreferences({
                            ...mangaReaderPreferences,
                            readingDirection: direction.id as 'ltr' | 'rtl' | 'vertical'
                          });
                        }}
                      >
                        <FontAwesome5 
                          name={direction.icon} 
                          size={14} 
                          color={mangaReaderPreferences.readingDirection === direction.id ? '#fff' : (isDarkMode ? '#FFFFFF' : '#333333')} 
                        />
                        <Text style={[
                          styles.directionOptionText,
                          { color: mangaReaderPreferences.readingDirection === direction.id ? '#fff' : (isDarkMode ? '#FFFFFF' : '#333333') }
                        ]}>
                          {direction.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Toggle Settings */}
                <View style={[styles.settingItem, { borderBottomColor: isDarkMode ? '#333' : '#E0E0E0' }]}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={[styles.settingLabel, { color: isDarkMode ? '#FFFFFF' : '#333333', marginBottom: 0 }]}>Remember Reading Position</Text>
                    <Switch
                      value={mangaReaderPreferences.rememberPosition}
                      onValueChange={(value) => {
                        saveMangaReaderPreferences({
                          ...mangaReaderPreferences,
                          rememberPosition: value
                        });
                      }}
                      trackColor={{ false: '#767577', true: '#42A5F5' }}
                      thumbColor={mangaReaderPreferences.rememberPosition ? '#fff' : '#f4f3f4'}
                    />
                  </View>
                </View>

                <View style={[styles.settingItem, { borderBottomColor: isDarkMode ? '#333' : '#E0E0E0' }]}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={[styles.settingLabel, { color: isDarkMode ? '#FFFFFF' : '#333333', marginBottom: 0 }]}>Auto-Navigate to Next Chapter</Text>
                    <Switch
                      value={mangaReaderPreferences.autoNavigateNextChapter}
                      onValueChange={(value) => {
                        saveMangaReaderPreferences({
                          ...mangaReaderPreferences,
                          autoNavigateNextChapter: value
                        });
                      }}
                      trackColor={{ false: '#767577', true: '#42A5F5' }}
                      thumbColor={mangaReaderPreferences.autoNavigateNextChapter ? '#fff' : '#f4f3f4'}
                    />
                  </View>
                </View>

                <View style={[styles.settingItem, { borderBottomColor: isDarkMode ? '#333' : '#E0E0E0' }]}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={[styles.settingLabel, { color: isDarkMode ? '#FFFFFF' : '#333333', marginBottom: 0 }]}>Keep Screen On While Reading</Text>
                    <Switch
                      value={mangaReaderPreferences.keepScreenOn}
                      onValueChange={(value) => {
                        saveMangaReaderPreferences({
                          ...mangaReaderPreferences,
                          keepScreenOn: value
                        });
                      }}
                      trackColor={{ false: '#767577', true: '#42A5F5' }}
                      thumbColor={mangaReaderPreferences.keepScreenOn ? '#fff' : '#f4f3f4'}
                    />
                  </View>
                </View>

                <View style={[styles.settingItem, { borderBottomColor: isDarkMode ? '#333' : '#E0E0E0' }]}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={[styles.settingLabel, { color: isDarkMode ? '#FFFFFF' : '#333333', marginBottom: 0 }]}>Show Page Number</Text>
                    <Switch
                      value={mangaReaderPreferences.showPageNumber}
                      onValueChange={(value) => {
                        saveMangaReaderPreferences({
                          ...mangaReaderPreferences,
                          showPageNumber: value
                        });
                      }}
                      trackColor={{ false: '#767577', true: '#42A5F5' }}
                      thumbColor={mangaReaderPreferences.showPageNumber ? '#fff' : '#f4f3f4'}
                    />
                  </View>
                </View>

                {/* Preload Pages */}
                <View style={[styles.settingItem, { borderBottomColor: isDarkMode ? '#333' : '#E0E0E0' }]}>
                  <Text style={[styles.settingLabel, { color: isDarkMode ? '#FFFFFF' : '#333333' }]}>Preload Pages</Text>
                  <View style={styles.sliderContainer}>
                    <Slider
                      style={{ width: '90%', height: 40 }}
                      minimumValue={1}
                      maximumValue={10}
                      step={1}
                      value={mangaReaderPreferences.preloadPages}
                      onValueChange={(value) => {
                        saveMangaReaderPreferences({
                          ...mangaReaderPreferences,
                          preloadPages: value
                        });
                      }}
                      minimumTrackTintColor="#42A5F5"
                      maximumTrackTintColor="#777777"
                      thumbTintColor="#42A5F5"
                    />
                    <Text style={[styles.sliderValue, { color: isDarkMode ? '#FFFFFF' : '#333333' }]}>
                      {mangaReaderPreferences.preloadPages}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Advanced Options Section */}
              <View style={styles.settingsSection}>
                <View style={styles.sectionHeader}>
                  <FontAwesome5 name="cogs" size={20} color="#9C27B0" />
                  <Text style={[styles.settingsSectionTitle, { color: isDarkMode ? '#FFFFFF' : '#333333' }]}>
                    Advanced Options
                  </Text>
                </View>
                
                <View style={[styles.settingItem, { borderBottomColor: isDarkMode ? '#333' : '#E0E0E0' }]}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={[styles.settingLabel, { color: isDarkMode ? '#FFFFFF' : '#333333', marginBottom: 0 }]}>Auto-save Progress</Text>
                    <Switch
                      value={shouldAutoSave}
                      onValueChange={setShouldAutoSave}
                      trackColor={{ false: '#767577', true: theme.colors.primary }}
                      thumbColor={shouldAutoSave ? '#fff' : '#f4f3f4'}
                    />
                  </View>
                </View>

                <View style={[styles.settingItem, { borderBottomColor: isDarkMode ? '#333' : '#E0E0E0' }]}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={[styles.settingLabel, { color: isDarkMode ? '#FFFFFF' : '#333333', marginBottom: 0 }]}>Tap to Navigate</Text>
                    <Switch
                      value={mangaReaderPreferences.tapToNavigate}
                      onValueChange={(value) => {
                        saveMangaReaderPreferences({
                          ...mangaReaderPreferences,
                          tapToNavigate: value
                        });
                      }}
                      trackColor={{ false: '#767577', true: '#9C27B0' }}
                      thumbColor={mangaReaderPreferences.tapToNavigate ? '#fff' : '#f4f3f4'}
                    />
                  </View>
                </View>

                <View style={[styles.settingItem, { borderBottomColor: isDarkMode ? '#333' : '#E0E0E0' }]}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={[styles.settingLabel, { color: isDarkMode ? '#FFFFFF' : '#333333', marginBottom: 0 }]}>Zoom Enabled</Text>
                    <Switch
                      value={mangaReaderPreferences.zoomEnabled}
                      onValueChange={(value) => {
                        saveMangaReaderPreferences({
                          ...mangaReaderPreferences,
                          zoomEnabled: value
                        });
                      }}
                      trackColor={{ false: '#767577', true: '#9C27B0' }}
                      thumbColor={mangaReaderPreferences.zoomEnabled ? '#fff' : '#f4f3f4'}
                    />
                  </View>
                </View>
              </View>
              
              {/* Debug Options Section */}
              <View style={styles.settingsSection}>
                <View style={styles.sectionHeader}>
                  <FontAwesome5 name="bug" size={20} color="#f44336" />
                  <Text style={[styles.settingsSectionTitle, { color: isDarkMode ? '#FFFFFF' : '#333333' }]}>
                    Debug Options
                  </Text>
                </View>
                
                <View style={[styles.settingItem, { borderBottomColor: isDarkMode ? '#333' : '#E0E0E0' }]}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={[styles.settingLabel, { color: isDarkMode ? '#FFFFFF' : '#333333', marginBottom: 0 }]}>Debug Mode</Text>
                    <Switch
                      value={debugMode}
                      onValueChange={(value) => {
                        saveMangaReaderPreferences({
                          ...mangaReaderPreferences,
                          debugMode: value
                        });
                      }}
                      trackColor={{ false: '#767577', true: '#f44336' }}
                      thumbColor={debugMode ? '#fff' : '#f4f3f4'}
                    />
                  </View>
                </View>
                
                {debugMode && (
                  <>
                    <View style={[
                      styles.settingsDropdown,
                      { backgroundColor: isDarkMode ? '#333333' : '#F5F5F5', position: 'relative' }
                    ]}>
                      <Text style={[
                        styles.settingsDropdownLabel,
                        { color: isDarkMode ? '#FFFFFF' : '#333333' }
                      ]}>
                        Debug Level
                      </Text>
                      <TouchableOpacity 
                        style={[
                          styles.dropdownButton,
                          { backgroundColor: isDarkMode ? '#444' : '#E0E0E0' }
                        ]}
                        onPress={() => setShowDebugDropdown(!showDebugDropdown)}
                      >
                        <Text 
                          style={[
                            styles.dropdownButtonText, 
                            { color: isDarkMode ? '#FFF' : '#333' }
                          ]}
                        >
                          {debugLevel}
                        </Text>
                        <FontAwesome5 
                          name={showDebugDropdown ? "chevron-up" : "chevron-down"} 
                          size={10} 
                          color={isDarkMode ? '#FFF' : '#333'} 
                        />
                      </TouchableOpacity>
                      {renderDropdownMenu()}
                    </View>
                    
                    <View style={[styles.settingItem, { borderBottomColor: isDarkMode ? '#333' : '#E0E0E0' }]}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text style={[styles.settingLabel, { color: isDarkMode ? '#FFFFFF' : '#333333', marginBottom: 0 }]}>Show Gesture Guides</Text>
                        <Switch
                          value={debugGestures}
                          onValueChange={() => toggleDebugFeature('gestures')}
                          trackColor={{ false: '#767577', true: '#f44336' }}
                          thumbColor={debugGestures ? '#fff' : '#f4f3f4'}
                        />
                      </View>
                    </View>
                    
                    <View style={[styles.settingItem, { borderBottomColor: isDarkMode ? '#333' : '#E0E0E0' }]}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text style={[styles.settingLabel, { color: isDarkMode ? '#FFFFFF' : '#333333', marginBottom: 0 }]}>Show Image Bounds</Text>
                        <Switch
                          value={debugImages}
                          onValueChange={() => toggleDebugFeature('images')}
                          trackColor={{ false: '#767577', true: '#f44336' }}
                          thumbColor={debugImages ? '#fff' : '#f4f3f4'}
                        />
                      </View>
                    </View>
                  </>
                )}
              </View>

              {/* Reset Section */}
              <View style={styles.settingsSection}>
                <TouchableOpacity 
                  style={[styles.settingItem, { borderBottomColor: isDarkMode ? '#333' : '#E0E0E0' }]}
                  onPress={() => {
                    // Reset all manga reader settings to default
                    const defaultSettings: MangaReaderPreferences = {
                      readingDirection: 'rtl',
                      rememberPosition: true,
                      autoNavigateNextChapter: true,
                      keepScreenOn: true,
                      showPageNumber: true,
                      fullscreenByDefault: false,
                      tapToNavigate: true,
                      zoomEnabled: true,
                      doubleTapToZoom: true,
                      preloadPages: 5,
                      debugMode: false,
                      appearance: {
                        backgroundColor: '#000000',
                        pageGap: 8,
                        pageBorderRadius: 0,
                        pageTransitionAnimation: true
                      }
                    };
                    saveMangaReaderPreferences(defaultSettings);
                  }}
                >
                  <Text style={[styles.settingLabel, { color: isDarkMode ? '#FFFFFF' : '#333333' }]}>Reset to Default Settings</Text>
                  <FontAwesome5 name="undo" size={20} color="#f44336" />
                </TouchableOpacity>
              </View>
            </ScrollView>
            
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[
                  styles.modalButton,
                  styles.modalButtonYes,
                  { backgroundColor: theme.colors.primary }
                ]}
                onPress={() => setShowSettingsModal(false)}
              >
                <Text style={styles.modalButtonText}>
                  Close
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  };

  // Add this before the FlatList component
  const displayImages = useMemo(() => {
    return readingDirection === 'rtl' ? [...images].reverse() : images;
  }, [images, readingDirection]);

  // Create a unique key for FlatList that includes reading direction to force re-render
  const flatListKey = useMemo(() => {
    return `${readingDirection}-${images.length}`;
  }, [readingDirection, images.length]);

  // Add a new function to check for next/previous chapters using Katana API
  const checkKatanaChapterNavigation = useCallback(async () => {
    if (!params.mangaId || !params.chapter) return;
    
    try {
      // IMPORTANT FIX: Always use the mangaId from params directly
      // instead of trying to search or using hardcoded IDs
      console.log('[Katana] Using manga ID from params:', params.mangaId);
      setMangaSlugId(params.mangaId as string);
      
      // For special cases, use more reliable number-based navigation
      // instead of making potentially incorrect API calls
      if (params.isLatestChapter === 'true') {
        console.log('[Katana] Using direct navigation for latest chapter');
        setHasNextChapter(false);
        setHasPreviousChapter(Number(params.chapter) > 1);
        
        console.log('[Katana] Set navigation to:', {
          hasPrevious: Number(params.chapter) > 1,
          hasNext: false
        });
        return;
      }
      
      // Always use direct numerical comparison for availability
      const currentChapterNum = parseFloat(String(params.chapter));
      if (!isNaN(currentChapterNum)) {
        setHasNextChapter(params.isLatestChapter !== 'true');
        setHasPreviousChapter(currentChapterNum > 1);
        
        
        console.log('[Katana] Set navigation by chapter number:', {
          hasPrevious: currentChapterNum > 1,
          hasNext: params.isLatestChapter !== 'true'
        });
      }
    } catch (error) {
      console.error('[Katana] Error checking chapter navigation:', error);
      // Fallback to basic navigation in case of errors
      setHasPreviousChapter(Number(params.chapter) > 1);
      setHasNextChapter(params.isLatestChapter !== 'true');
      console.log('[Katana] Using fallback navigation (after error)');
    }
  }, [params.mangaId, params.chapter, params.isLatestChapter]);
  
  // Call the function when component mounts
  useEffect(() => {
    // Add special handling for Chainsaw Man chapters
    if (params.mangaId && params.mangaId.includes('chainsaw-man')) {
      console.log('[Reader] Setting direct navigation for Chainsaw Man');
      // Set navigation availability directly for Chainsaw Man
      setHasPreviousChapter(Number(params.chapter) > 1);
      setHasNextChapter(params.isLatestChapter !== 'true');
      
      // Also set the manga slug ID for potential future operations
      setMangaSlugId('chainsaw-man.21890');
    } else {
      // For other manga, use the original API-based approach
      checkKatanaChapterNavigation();
    }
  }, [checkKatanaChapterNavigation, params.mangaId, params.chapter, params.isLatestChapter]);

  // Add this function after the existing useCallback functions
  const fetchAniListTitle = useCallback(async () => {
    if (!params.anilistId) return;

    try {
      const query = `
        query ($id: Int) {
          Media(id: $id, type: MANGA) {
            title {
              userPreferred
              english
              romaji
            }
          }
        }
      `;

      const response = await fetch(ANILIST_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          query,
          variables: {
            id: parseInt(params.anilistId as string)
          }
        })
      });

      const data = await response.json();
      if (data?.data?.Media?.title) {
        const title = data.data.Media.title;
        // Prefer userPreferred, fallback to english, then romaji
        setMangaTitle(title.userPreferred || title.english || title.romaji);
      }
    } catch (err) {
      console.error('Error fetching AniList title:', err);
    }
  }, [params.anilistId]);

  // Add useEffect to fetch title when component mounts
  useEffect(() => {
    fetchAniListTitle();
  }, [fetchAniListTitle]);

  // Add this function to ensure previous chapter button is always available
  const isValidChapterNumber = useCallback((chapterNum: string | number): boolean => {
    const num = parseFloat(String(chapterNum));
    return !isNaN(num) && num > 0;
  }, []);

  // Update the renderChapterNavigationButtons to use proper navigation state
  const renderChapterNavigationButtons = useCallback(() => {
    if (!showUI) return null;
    
    // Use the already calculated navigation state variables
    const shouldShowNextButton = hasNextChapter;
    const shouldShowPreviousButton = hasPreviousChapter;
    
    // DEBUG: Log the navigation button logic
    console.log('[Reader] Navigation button logic:', {
      'hasNextChapter': hasNextChapter,
      'hasPreviousChapter': hasPreviousChapter,
      'shouldShowNextButton': shouldShowNextButton,
      'shouldShowPreviousButton': shouldShowPreviousButton,
      'chapter': params.chapter,
      'currentChapterIndex': currentChapterIndex,
      'totalChapters': allChapters.length,
      'isLatestChapter': params.isLatestChapter,
      'isFirstChapter': params.isFirstChapter
    });
    
    return (
      <View style={styles.cornerNavContainer}>
        {/* Previous Chapter Button - position changes based on reading direction */}
        {shouldShowPreviousButton && (
          <TouchableOpacity
            style={[styles.chapterNavPill, 
              readingDirection === 'rtl' 
                ? { right: 16 }  // In RTL, Prev goes on the right
                : { left: 16 }   // In LTR, Prev goes on the left
            ]}
            onPress={() => handleChapterNavigation('previous')}
            activeOpacity={0.7}
          >
            <FontAwesome5 
              name={readingDirection === 'rtl' ? "chevron-right" : "chevron-left"} 
              size={14} 
              color="#FFFFFF" 
              style={styles.chapterNavIcon} 
            />
            <Text style={styles.chapterNavPillText}>Prev</Text>
          </TouchableOpacity>
        )}
        
        {/* Next Chapter Button - position changes based on reading direction */}
        {shouldShowNextButton && (
          <TouchableOpacity
            style={[styles.chapterNavPill, 
              readingDirection === 'rtl' 
                ? { left: 16 }   // In RTL, Next goes on the left
                : { right: 16 }  // In LTR, Next goes on the right
            ]}
            onPress={() => handleChapterNavigation('next')}
            activeOpacity={0.7}
          >
            <Text style={styles.chapterNavPillText}>Next</Text>
            <FontAwesome5 
              name={readingDirection === 'rtl' ? "chevron-left" : "chevron-right"} 
              size={14} 
              color="#FFFFFF" 
              style={styles.chapterNavIcon} 
            />
          </TouchableOpacity>
        )}
      </View>
    );
  }, [
    showUI, 
    hasNextChapter,
    hasPreviousChapter,
    params.chapter,
    currentChapterIndex,
    allChapters.length,
    params.isLatestChapter,
    params.isFirstChapter,
    handleChapterNavigation,
    readingDirection
  ]);

  if (error) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: 'red', fontSize: 16 }}>{error}</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />
      
      <Reanimated.View style={{ flex: 1, zIndex: 1 }}>
        <FlatList
          key={flatListKey}
          ref={flatListRef}
          data={displayImages}
          renderItem={renderItem}
          keyExtractor={(item, index) => `${readingDirection}-${item}-${index}`}
          horizontal
          pagingEnabled={!isZoomed}
          scrollEnabled={!isZoomed}
          showsHorizontalScrollIndicator={false}
          getItemLayout={getItemLayout}
          initialNumToRender={10}
          maxToRenderPerBatch={5}
          windowSize={10}
          removeClippedSubviews={false}
          updateCellsBatchingPeriod={50}
          onScroll={isZoomed ? undefined : handleScroll}
          scrollEventThrottle={16}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          style={[
            styles.flatList,
            isOverScrolling && styles.overScrolling
          ]}
          onLayout={handleImageLayout}
          disableIntervalMomentum={true}
          decelerationRate="fast"
        />
      </Reanimated.View>

      {/* Header */}
      {showUI && (
        <Reanimated.View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={handleBack}
          >
            <FontAwesome5 name="arrow-left" size={16} color="#fff" />
          </TouchableOpacity>
          <View style={styles.titleContainer}>
            <Text 
              style={styles.title}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {mangaTitle || params.title}
            </Text>
            <Text style={styles.subtitle}>
              Chapter {params.chapter}
            </Text>
          </View>
          <View style={styles.headerButtons}>
            <TouchableOpacity 
              style={styles.directionButton}
              onPress={toggleReadingDirection}
            >
              <FontAwesome5 
                name={readingDirection === 'ltr' ? 'align-left' : 'align-right'} 
                size={16} 
                color="#fff" 
              />
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.directionButton}
              onPress={() => setShowSettingsModal(true)}
            >
              <FontAwesome5 name="cog" size={16} color="#fff" />
            </TouchableOpacity>
          </View>
        </Reanimated.View>
      )}

      {/* Footer */}
      {showUI && (
        <Reanimated.View style={styles.footer}>
          <View style={styles.pageNumberContainer}>
            <Text style={styles.pageNumberText}>
              {currentPage} / {images.length}
            </Text>
            {isInitialLoading && (
              <Text style={[styles.pageNumberText, { fontSize: 12, marginTop: 4, color: '#02A9FF' }]}>
                Loading {Math.round(loadingProgress)}%
              </Text>
            )}
          </View>
          <View style={styles.progressBarContainer}>
            <View 
              style={[
                styles.progressBar,
                { width: `${progressPercentage}%` }
              ]} 
            />
          </View>
          {isInitialLoading && (
            <View style={[styles.progressBarContainer, { marginTop: 4, backgroundColor: 'rgba(2, 169, 255, 0.2)' }]}>
              <View 
                style={[
                  styles.progressBar,
                  { width: `${loadingProgress}%`, backgroundColor: '#02A9FF' }
                ]} 
              />
            </View>
          )}
        </Reanimated.View>
      )}

      {/* Modals */}
      {showChapterModal && (() => {
        console.log('=== RENDERING CHAPTER MODAL ===');
        console.log('Modal props:', {
          visible: showChapterModal,
          chapter: selectedChapter,
          currentProvider: currentProvider,
          mangaSlugId: mangaSlugId,
          mangaId: mangaIdRef.current || String(params.mangaId)
        });
        return null;
      })()}
      <ChapterSourcesModal
        visible={showChapterModal}
        onClose={() => {
          setShowChapterModal(false);
          setNavigationType(null);
          setPendingNextChapter(false);
        }}
        chapter={selectedChapter ? { ...selectedChapter, source: currentProvider } : null}
        mangaTitle={{
          english: typeof params.title === 'string' ? params.title : "",
          userPreferred: typeof params.title === 'string' ? params.title : ""
        }}
        mangaId={mangaIdRef.current || String(params.mangaId)}
        anilistId={params.anilistId as string}
        currentProvider={currentProvider}
        mangaSlugId={mangaSlugId || undefined}
        chapterManager={chapterManager}
      />

      {/* Save progress modal */}
      <Modal
        visible={showSaveModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowSaveModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[
            styles.modalContent,
            { backgroundColor: isDarkMode ? '#1A1A1A' : '#FFFFFF' }
          ]}>
            <Text style={[
              styles.modalTitle,
              { color: isDarkMode ? '#FFFFFF' : '#333333' }
            ]}>
              Save Progress?
            </Text>
            <Text style={[
              styles.modalText,
              { color: isDarkMode ? '#CCCCCC' : '#666666' }
            ]}>
              Would you like to update your progress on AniList?
            </Text>
            <TouchableOpacity 
              style={[
                styles.checkboxContainer,
                { backgroundColor: isDarkMode ? '#333333' : '#F5F5F5' }
              ]}
              onPress={() => setShouldSaveProgress(!shouldSaveProgress)}
            >
              <View style={[
                styles.checkbox,
                shouldSaveProgress && styles.checkboxChecked,
                { borderColor: shouldSaveProgress ? theme.colors.primary : isDarkMode ? '#FFFFFF' : '#333333' }
              ]}>
                {shouldSaveProgress && (
                  <FontAwesome5 name="check" size={14} color="#FFFFFF" />
                )}
              </View>
              <Text style={[
                styles.checkboxLabel,
                { color: isDarkMode ? '#FFFFFF' : '#333333' }
              ]}>
                Don't ask again
              </Text>
            </TouchableOpacity>
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[
                  styles.modalButton,
                  styles.modalButtonNo
                ]}
                onPress={() => {
                  setShowSaveModal(false);
                  if (pendingNextChapter) {
                    // If user declined to save progress but was trying to go to next chapter,
                    // show chapter modal anyway
                    setShowChapterModal(true);
                  }
                }}
              >
                <Text style={[
                  styles.modalButtonText,
                  styles.modalButtonTextNo,
                  { color: isDarkMode ? '#BBBBBB' : '#666666' }
                ]}>
                  No
                </Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[
                  styles.modalButton,
                  styles.modalButtonYes,
                  { backgroundColor: theme.colors.primary }
                ]}
                onPress={handleNextChapterConfirmed}
              >
                <Text style={styles.modalButtonText}>
                  Yes
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Exit confirmation modal */}
      <Modal
        visible={showExitModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowExitModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[
            styles.modalContent,
            { backgroundColor: isDarkMode ? '#1A1A1A' : '#FFFFFF' }
          ]}>
            <Text style={[
              styles.modalTitle,
              { color: isDarkMode ? '#FFFFFF' : '#333333' }
            ]}>
              Save before exiting?
            </Text>
            <Text style={[
              styles.modalText,
              { color: isDarkMode ? '#CCCCCC' : '#666666' }
            ]}>
              Would you like to update your progress on AniList before exiting?
            </Text>
            <TouchableOpacity 
              style={[
                styles.checkboxContainer,
                { backgroundColor: isDarkMode ? '#333333' : '#F5F5F5' }
              ]}
              onPress={() => setShouldAutoSaveOnExit(!shouldAutoSaveOnExit)}
            >
              <View style={[
                styles.checkbox,
                shouldAutoSaveOnExit && styles.checkboxChecked,
                { borderColor: shouldAutoSaveOnExit ? theme.colors.primary : isDarkMode ? '#FFFFFF' : '#333333' }
              ]}>
                {shouldAutoSaveOnExit && (
                  <FontAwesome5 name="check" size={14} color="#FFFFFF" />
                )}
              </View>
              <Text style={[
                styles.checkboxLabel,
                { color: isDarkMode ? '#FFFFFF' : '#333333' }
              ]}>
                Always save on exit
              </Text>
            </TouchableOpacity>
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[
                  styles.modalButton,
                  styles.modalButtonCancel
                ]}
                onPress={() => setShowExitModal(false)}
              >
                <Text style={[
                  styles.modalButtonText,
                  { color: isDarkMode ? '#BBBBBB' : '#666666' }
                ]}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[
                  styles.modalButton,
                  styles.modalButtonNo
                ]}
                onPress={handleExitWithoutSave}
              >
                <Text style={[
                  styles.modalButtonText,
                  styles.modalButtonTextNo,
                  { color: isDarkMode ? '#BBBBBB' : '#666666' }
                ]}>
                  No
                </Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[
                  styles.modalButton,
                  styles.modalButtonYes,
                  { backgroundColor: theme.colors.primary }
                ]}
                onPress={handleExitWithSave}
              >
                <Text style={styles.modalButtonText}>
                  Yes
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Render debug overlay */}
      {renderDebugOverlay()}

      {/* Settings modal */}
      {renderSettingsModal()}

      {/* Chapter navigation buttons */}
      {images.length > 0 && renderChapterNavigationButtons()}

      {/* Chapter transition overlay */}
      {showOverscrollIndicator && (
        <View style={styles.overscrollIndicator}>
          <View style={styles.overscrollContent}>
            <View style={styles.overscrollSide}>
              <Text style={styles.overscrollText}>
                {overscrollDirection === 'previous' ? 'Previous' : 'Current'}
              </Text>
              <Text style={styles.overscrollChapterNumber}>
                {overscrollDirection === 'previous' 
                  ? `Chapter ${Number(params.chapter) - 1}` 
                  : `Chapter ${params.chapter}`}
              </Text>
            </View>
            <View style={styles.overscrollDivider} />
            <FontAwesome5 
              name={overscrollDirection === 'previous' ? 'arrow-left' : 'arrow-right'} 
              size={24} 
              color="#02A9FF" 
              style={styles.overscrollArrow} 
            />
            <View style={styles.overscrollDivider} />
            <View style={styles.overscrollSide}>
              <Text style={styles.overscrollText}>
                {overscrollDirection === 'next' ? 'Next' : 'Current'}
              </Text>
              <Text style={styles.overscrollChapterNumber}>
                {overscrollDirection === 'next' 
                  ? `Chapter ${Number(params.chapter) + 1}` 
                  : `Chapter ${params.chapter}`}
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* Notification */}
      <FloatingNotification
        message={notificationMessage}
        visible={showNotification}
        notificationOpacity={notificationOpacity}
        notificationOffset={notificationOffset}
      />
    </SafeAreaView>
  );
}
