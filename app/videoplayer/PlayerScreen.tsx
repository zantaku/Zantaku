import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StatusBar, ActivityIndicator, Animated, PanResponder, Dimensions, Pressable, Platform, BackHandler, ScrollView, useColorScheme, TouchableWithoutFeedback, GestureResponderEvent, StyleProp, ViewStyle } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons, MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';
import { usePlayerContext } from './PlayerContext';
import type { Subtitle, VideoError } from './types';
import * as ScreenOrientation from 'expo-screen-orientation';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import SettingsModal from './components/SettingsModal';
import EpisodeSourcesModal from '../components/EpisodeSourcesModal';
import * as SecureStore from 'expo-secure-store';
import { STORAGE_KEY } from '../../constants/auth';
import NetInfo from '@react-native-community/netinfo';
import { useIncognito } from '../../hooks/useIncognito';
import { useFocusEffect } from 'expo-router';
import SaveProgressModal from './components/SaveProgressModal';
import { memo } from 'react';
import { InteractionManager } from 'react-native';

// Types
type VideoContentFit = 'contain' | 'cover' | 'stretch';
type ScalingMode = 'contain' | 'cover' | 'stretch';

interface SubtitleCue {
  startTime: number;
  endTime: number;
  text: string;
}

interface PlaybackStats {
  recoveryAttempts: number;
  bufferingEvents: number;
  lastPosition: number;
  playbackStarted: boolean;
}

// Helper to check if a URL is an m3u8 stream
const isM3U8Stream = (url: string): boolean => {
  return url.includes('.m3u8');
};

// Debug helper for consistent logging
const logDebug = (section: string, message: string, data?: any) => {
  const timestamp = new Date().toISOString().substr(11, 12);
  console.log(`[${timestamp}] [PLAYER-${section}] ${message}`);
  if (data) {
    console.log(data);
  }
};

// Helper to validate video URL
const validateVideoUrl = async (url: string): Promise<boolean> => {
  try {
    const response = await fetch(url, {
      method: 'HEAD',
      headers: {
        'Accept': '*/*',
        'Origin': 'https://hianime.to',
        'Referer': 'https://hianime.to/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/98.0.4758.102 Safari/537.36'
      }
    });
    return response.ok;
  } catch (error) {
    logDebug('URL_VALIDATION', `Failed to validate URL: ${error}`);
    return false;
  }
};

// Helper to get proxy URL if needed
const getProxyUrl = (originalUrl: string): string => {
  if (!originalUrl.includes('m3u8-proxy')) {
    return `https://m3u8-proxy-liard.vercel.app/proxy?url=${encodeURIComponent(originalUrl)}`;
  }
  return originalUrl;
};

// Helper to parse VTT time format (00:00:00.000 or 00:00.000)
const parseVTTTime = (timeString: string): number => {
  const parts = timeString.split(':');
  let seconds = 0;
  
  if (parts.length === 3) { // HH:MM:SS.mmm
    seconds += parseInt(parts[0], 10) * 3600; // Hours
    seconds += parseInt(parts[1], 10) * 60; // Minutes
    seconds += parseFloat(parts[2]); // Seconds and milliseconds
  } else if (parts.length === 2) { // MM:SS.mmm
    seconds += parseInt(parts[0], 10) * 60; // Minutes
    seconds += parseFloat(parts[1]); // Seconds and milliseconds
  }
  
  return seconds;
};

// Simple VTT parser
const parseVTT = (vttText: string): SubtitleCue[] => {
  console.log('[SUBTITLE DEBUG] 🔧 Parsing VTT content...');
  
  // Safety check for empty input
  if (!vttText || typeof vttText !== 'string') {
    console.error('[SUBTITLE DEBUG] ❌ Invalid VTT text provided:', typeof vttText);
    return [];
  }
  
  // Make sure we have proper line endings
  const normalizedText = vttText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = normalizedText.split('\n');
  const cues: SubtitleCue[] = [];
  
  let inCue = false;
  let currentCue: Partial<SubtitleCue> = {};
  let currentText: string[] = [];
  let cueCount = 0;
  
  try {
    // Validate if this looks like a VTT file
    let hasVTTHeader = false;
    let hasTimestamps = false;
    
    // Quick validation scan
    for (let i = 0; i < Math.min(20, lines.length); i++) {
      if (lines[i].includes('WEBVTT')) hasVTTHeader = true;
      if (lines[i].includes(' --> ')) hasTimestamps = true;
      if (hasVTTHeader && hasTimestamps) break;
    }
    
    if (!hasVTTHeader && !hasTimestamps) {
      console.error('[SUBTITLE DEBUG] ❌ Content does not appear to be valid VTT format');
      console.log('[SUBTITLE DEBUG] First 50 chars:', vttText.substring(0, 50));
      return [];
    }
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Skip empty lines and headers
      if (line === '' || line === 'WEBVTT' || line.startsWith('NOTE') || line.startsWith('STYLE')) {
        continue;
      }
      
      // Look for timestamp line: 00:00:00.000 --> 00:00:00.000
      const timestampMatch = line.match(/(\d{1,2}:)?(\d{1,2}):(\d{1,2})\.(\d{1,3}) --> (\d{1,2}:)?(\d{1,2}):(\d{1,2})\.(\d{1,3})/);
      
      if (timestampMatch) {
        // If we were already in a cue, save the previous one
        if (inCue && currentCue.startTime !== undefined && currentText.length > 0) {
          currentCue.text = currentText.join(' ').trim()
            .replace(/<\/?[^>]+(>|$)/g, ''); // Simple HTML tag removal
          
          cues.push(currentCue as SubtitleCue);
          cueCount++;
        }
        
        // Extract time components from match
        const startTime = parseVTTTime(timestampMatch[0].split(' --> ')[0]);
        const endTime = parseVTTTime(timestampMatch[0].split(' --> ')[1]);
        
        // Start a new cue
        currentCue = { startTime, endTime };
        currentText = [];
        inCue = true;
        continue;
      }
      
      // If we're in a cue, collect text
      if (inCue) {
        // Skip numeric identifiers and style tags
        if (!/^\d+$/.test(line) && !line.startsWith('STYLE')) {
          // Clean up any position or alignment info
          const cleanLine = line.replace(/\{[^}]+\}/g, '').trim();
          if (cleanLine) {
            currentText.push(cleanLine);
          }
        }
      }
    }
    
    // Don't forget the last cue
    if (inCue && currentCue.startTime !== undefined && currentText.length > 0) {
      currentCue.text = currentText.join(' ').trim()
        .replace(/<\/?[^>]+(>|$)/g, ''); // Simple HTML tag removal
      
      cues.push(currentCue as SubtitleCue);
      cueCount++;
    }
    
    console.log(`[SUBTITLE DEBUG] ✅ Successfully parsed ${cueCount} cues`);
    
    return cues;
  } catch (error) {
    console.error('[SUBTITLE DEBUG] ❌ Error parsing VTT:', error);
    return [];
  }
};

// Read the style definition from its current position and move it to before the PlayerScreen component
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  landscapeContainer: {
    // Any landscape-specific container styles
  },
  portraitContainer: {
    // Any portrait-specific container styles
  },
  videoContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  landscapeVideoContainer: {
    // Any landscape-specific container styles for video
  },
  portraitVideoContainer: {
    // Any portrait-specific container styles for video
  },
  video: {
    width: '100%',
    height: '100%',
    backgroundColor: '#000',
  },
  loadingContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  loadingText: {
    color: '#FFF',
    marginTop: 10,
    fontFamily: Platform.OS === 'ios' ? 'Avenir' : 'Roboto',
  },
  errorContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    padding: 20,
  },
  errorText: {
    color: '#FF6B6B',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
    fontFamily: Platform.OS === 'ios' ? 'Avenir' : 'Roboto',
  },
  retryButton: {
    backgroundColor: '#FF6B00',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 5,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: Platform.OS === 'ios' ? 'Avenir-Medium' : 'Roboto',
  },
  bufferingContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  controlsOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  topControlBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 10,
  },
  backButton: {
    padding: 8,
  },
  titleContainer: {
    flex: 1,
    paddingHorizontal: 15,
  },
  animeTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Avenir-Heavy' : 'Roboto',
  },
  episodeTitle: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
    fontFamily: Platform.OS === 'ios' ? 'Avenir' : 'Roboto',
  },
  topRightButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconButton: {
    padding: 8,
    marginLeft: 5,
  },
  centerControlsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerPlayButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 30,
    width: 60,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
    margin: 0,
  },
  seekBackButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 20,
  },
  seekForwardButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 20,
  },
  seekButtonText: {
    color: '#FFFFFF',
    fontSize: 10,
    marginTop: 2,
    fontFamily: Platform.OS === 'ios' ? 'Avenir' : 'Roboto',
  },
  bottomControls: {
    paddingBottom: 10,
  },
  progressContainer: {
    height: 40,
    justifyContent: 'center',
    paddingHorizontal: 15,
    marginBottom: 5,
  },
  progressTapArea: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10,
  },
  progressBackground: {
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 2,
  },
  bufferBar: {
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    borderRadius: 2,
    position: 'absolute',
    top: 18,
    left: 15,
  },
  progressBar: {
    height: 4,
    backgroundColor: '#FF6B00',
    borderRadius: 2,
    position: 'absolute',
    top: 18,
    left: 15,
  },
  progressKnob: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#FF6B00',
    position: 'absolute',
    top: 13,
    marginLeft: -7,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 3,
    elevation: 3,
  },
  bottomBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 15,
  },
  timeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Avenir' : 'Roboto',
  },
  rightControls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  controlButton: {
    padding: 8,
    marginLeft: 5,
  },
  seekIndicatorsContainer: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    pointerEvents: 'none',
  },
  seekIndicatorLeft: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  seekIndicatorRight: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  speedSelector: {
    position: 'absolute',
    bottom: 70,
    right: 20,
    borderRadius: 10,
    overflow: 'hidden',
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 5,
    justifyContent: 'center',
  },
  speedOption: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    margin: 2,
    borderRadius: 5,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  speedOptionSelected: {
    backgroundColor: '#FF6B00',
  },
  speedOptionText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: Platform.OS === 'ios' ? 'Avenir' : 'Roboto',
  },
  speedOptionTextSelected: {
    fontWeight: 'bold',
  },
  captionFeedback: {
    position: 'absolute',
    top: '15%',
    alignSelf: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 10,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  captionFeedbackText: {
    color: '#FFFFFF',
    marginLeft: 10,
    fontSize: 16,
    fontFamily: Platform.OS === 'ios' ? 'Avenir' : 'Roboto',
  },
  timestampError: {
    position: 'absolute',
    top: '10%',
    alignSelf: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 10,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  timestampErrorText: {
    color: '#FFCC00',
    marginLeft: 10,
    fontSize: 14,
    fontFamily: Platform.OS === 'ios' ? 'Avenir' : 'Roboto',
  },
  debugOverlay: {
    position: 'absolute',
    top: 80, // Higher position to avoid navigation bar
    left: 10, // Position on left side instead of right
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 10,
    borderRadius: 5,
    maxWidth: '60%',
    zIndex: 1000,
  },
  debugText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontFamily: 'monospace',
  },
  subtitleOuterContainer: {
    alignSelf: 'center',
    marginHorizontal: 20,
    maxWidth: '90%',
  },
  subtitleContainer: {
    borderRadius: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 5,
    alignItems: 'center',
    overflow: 'hidden',
  },
  subtitleText: {
    color: '#FFFFFF',
    textAlign: 'center',
    fontFamily: Platform.OS === 'ios' ? 'Avenir' : 'Roboto',
    fontSize: 16,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  resetSubtitleButton: {
    marginLeft: 8,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 10,
  },
  introMarker: {
    height: 4,
    position: 'absolute',
    top: 18,
    backgroundColor: 'rgba(255, 213, 0, 0.5)',
    borderRadius: 2,
    zIndex: 2,
  },
  outroMarker: {
    height: 4,
    position: 'absolute',
    top: 18,
    backgroundColor: 'rgba(255, 107, 0, 0.5)',
    borderRadius: 2,
    zIndex: 2,
  },
  skipIntroButton: {
    position: 'absolute',
    top: 70,
    right: 10,
    borderRadius: 5,
    overflow: 'hidden',
    zIndex: 20,
  },
  skipOutroButton: {
    position: 'absolute',
    top: 70,
    right: 10,
    borderRadius: 5,
    overflow: 'hidden',
    zIndex: 20,
  },
  skipButtonInner: {
    paddingVertical: 8,
    paddingHorizontal: 15,
  },
  skipButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: Platform.OS === 'ios' ? 'Avenir-Medium' : 'Roboto',
  },
  nextEpisodeCountdown: {
    position: 'absolute',
    bottom: 100,
    left: 20,
    right: 20,
    borderRadius: 10,
    overflow: 'hidden',
    zIndex: 30,
  },
  nextEpisodeCountdownWithSkip: {
    bottom: 130, // Move up when skip outro button is showing
  },
  nextEpisodeContent: {
    padding: 15,
  },
  nextEpisodeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  nextEpisodeTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Avenir-Heavy' : 'Roboto',
  },
  countdownTimer: {
    color: '#FF6B00',
    fontSize: 18,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Avenir-Heavy' : 'Roboto',
  },
  nextEpisodeInfo: {
    color: '#FFFFFF',
    fontSize: 14,
    marginBottom: 15,
    fontFamily: Platform.OS === 'ios' ? 'Avenir' : 'Roboto',
  },
  nextEpisodeButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  cancelButton: {
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    marginRight: 10,
  },
  cancelButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: Platform.OS === 'ios' ? 'Avenir-Medium' : 'Roboto',
  },
  continueButton: {
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 5,
    backgroundColor: '#FF6B00',
  },
  continueButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Avenir-Medium' : 'Roboto',
  },
  exitModalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 50,
  },
  exitModalContainer: {
    width: '80%',
    backgroundColor: 'rgba(30, 30, 30, 0.8)',
    borderRadius: 10,
    padding: 20,
    alignItems: 'center',
  },
  exitModalTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    fontFamily: Platform.OS === 'ios' ? 'Avenir-Heavy' : 'Roboto',
  },
  exitModalMessage: {
    color: '#FFFFFF',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
    fontFamily: Platform.OS === 'ios' ? 'Avenir' : 'Roboto',
  },
  exitModalError: {
    color: '#FF6B6B',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 15,
    fontFamily: Platform.OS === 'ios' ? 'Avenir' : 'Roboto',
  },
  exitModalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  exitModalCancelButton: {
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  exitModalCancelText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: Platform.OS === 'ios' ? 'Avenir-Medium' : 'Roboto',
  },
  exitModalLocalButton: {
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 5,
    backgroundColor: '#4B7BEC',
  },
  exitModalAniListButton: {
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 5,
    backgroundColor: '#02A9FF',
  },
  exitModalButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Avenir-Medium' : 'Roboto',
  },
  exitModalButtonDisabled: {
    opacity: 0.5,
  },
  errorIcon: {
    marginBottom: 10,
  },
  goBackButton: {
    backgroundColor: '#FF6B00',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 5,
    marginTop: 10,
  },
  goBackButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: Platform.OS === 'ios' ? 'Avenir-Medium' : 'Roboto',
  },
  subtitleErrorContainer: {
    position: 'absolute',
    top: 100,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 1000,
  },
  subtitleErrorContent: {
    padding: 10,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#FFCC00',
    flexDirection: 'row',
    alignItems: 'center',
    maxWidth: '80%',
  },
  subtitleErrorText: {
    color: '#FFFFFF',
    fontSize: 12,
    marginLeft: 8,
    fontFamily: Platform.OS === 'ios' ? 'Avenir' : 'Roboto',
  },
  dontAskAgainContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    alignSelf: 'flex-start',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: '#FFFFFF',
    marginRight: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#02A9FF',
    borderColor: '#02A9FF',
  },
  dontAskAgainText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: Platform.OS === 'ios' ? 'Avenir' : 'Roboto',
  },
  debugButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  debugButton: {
    backgroundColor: '#FF6B00',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 5,
  },
  debugButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Avenir-Medium' : 'Roboto',
  },
});

// Define interface for control button props
interface ControlButtonProps {
  onPress: (e?: any) => void;
  icon?: any; // Using any for Ionicons name type
  size?: number;
  style?: StyleProp<ViewStyle>;
  iconColor?: string;
  disabled?: boolean;
  children?: React.ReactNode;
}

// Define a memoized control button component
const ControlButton = memo(({ onPress, icon, size = 24, style = {}, iconColor = '#FFFFFF', disabled = false, children }: ControlButtonProps) => (
  <TouchableOpacity 
    onPress={onPress} 
    style={[styles.iconButton, style]} 
    disabled={disabled}
    activeOpacity={0.7}
  >
    {icon && <Ionicons name={icon} size={size} color={disabled ? 'rgba(255,255,255,0.5)' : iconColor} />}
    {children}
  </TouchableOpacity>
));

const PlayerScreen = () => {
  const router = useRouter();
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const { isIncognito } = useIncognito();
  const { preferences, setPreferences } = usePlayerContext();
  
  // Add this line to detect device color mode
  const colorScheme = useColorScheme();
  
  // Progress tracking
  const lastProgressLogTime = useRef(0);
  const progressLogInterval = 1000; // Log every 1 second
  
  // State for player data
  const [isDataLoading, setIsDataLoading] = useState(true);
  const [episodeTitle, setEpisodeTitle] = useState<string>('');
  const [episodeNumber, setEpisodeNumber] = useState<string>('');
  const [animeTitle, setAnimeTitle] = useState<string>('');
  
  // Player state
  const [showSettings, setShowSettings] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [bufferedPosition, setBufferedPosition] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [contentFit, setContentFit] = useState<VideoContentFit>('contain');
  const [savedStartPosition, setSavedStartPosition] = useState(0); // For resuming playback
  
  const [showControls, setShowControls] = useState(false);
  const [subtitles, setSubtitles] = useState<Subtitle[]>([]);
  const [loadAttempts, setLoadAttempts] = useState(0);
  const [isHLSStream, setIsHLSStream] = useState(false);
  const [playbackStats, setPlaybackStats] = useState<PlaybackStats>({ 
    recoveryAttempts: 0,
    bufferingEvents: 0,
    lastPosition: 0,
    playbackStarted: false
  });
  
  // Video source state
  const [videoSourceState, setVideoSourceState] = useState({
    uri: '',
    headers: {}
  });

  // Auto-hide controls timer
  const controlsTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Animation for controls fade
  const fadeAnim = useRef(new Animated.Value(1)).current;
  
  // Video reference for expo-av
  const videoRef = useRef<Video>(null);
  
  // New state variables for enhanced features
  const [scalingMode, setScalingMode] = useState<ScalingMode>('contain');
  const [brightness, setBrightness] = useState(1);
  const [volume, setVolume] = useState(1);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [showSpeedSelector, setShowSpeedSelector] = useState(false);
  const [lastTapTime, setLastTapTime] = useState(0);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [scrubbingPosition, setScrubbingPosition] = useState(0);
  const [subtitleStyle, setSubtitleStyle] = useState({
    size: 16,
    color: '#FFFFFF',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  });
  
  // Animation values
  const progressAnimValue = useRef(new Animated.Value(0)).current;
  const controlsScale = useRef(new Animated.Value(1)).current;
  
  // Screen dimensions
  const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
  
  // Add a state to track double tap
  const [doubleTapActive, setDoubleTapActive] = useState(false);
  const doubleTapTimer = useRef<NodeJS.Timeout | null>(null);
  
  // State to track when captions are toggled
  const [showCaptionFeedback, setShowCaptionFeedback] = useState(false);
  const [captionFeedbackText, setCaptionFeedbackText] = useState('');
  
  // Add this new state
  const [showTimestampError, setShowTimestampError] = useState(false);

  // Add these new states for intro/outro markers
  const [introOutroTimestamps, setIntroOutroTimestamps] = useState({
    introStart: 0,
    introEnd: 0,
    outroStart: 0,
    outroEnd: 0
  });

  // Add this state variable with the other state variables (around line 200-250)
  const [isKnobPressed, setIsKnobPressed] = useState(false);

  // Add this state variable with the other state variables
  const [progressContainerWidth, setProgressContainerWidth] = useState(1);

  // Add these state variables with other player state variables
  const [showSkipIntroButton, setShowSkipIntroButton] = useState(false);
  const [showSkipOutroButton, setShowSkipOutroButton] = useState(false);
  const [showNextEpisodeModal, setShowNextEpisodeModal] = useState(false);
  const [nextEpisodeData, setNextEpisodeData] = useState<{
    episodeId: string;
    animeTitle: string;
    malId?: string;
  } | null>(null);
  
  // Add these state variables in the PlayerScreen component
  const [subtitlePosition, setSubtitlePosition] = useState({ x: 0, y: 0 });
  const [isDraggingSubtitle, setIsDraggingSubtitle] = useState(false);

  // Add state to track screen dimensions
  const [screenDimensions, setScreenDimensions] = useState({
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height
  });

  // Define an interface for the subtitle position with update scheduling
  interface SubtitlePosition {
    x: number;
    y: number;
    updateScheduled?: boolean;
  }

  // Update the useRef declaration with proper typing
  const subtitlePositionRef = useRef<SubtitlePosition>({ x: 0, y: 0 });
  const lastGestureRef = useRef({ dx: 0, dy: 0 });

  // Function to show temporary caption feedback
  const showCaptionToggleFeedback = (enabled: boolean) => {
    setCaptionFeedbackText(enabled ? 'Captions Enabled' : 'Captions Disabled');
    setShowCaptionFeedback(true);
    
    // Hide after 1.5 seconds
    setTimeout(() => {
      setShowCaptionFeedback(false);
    }, 1500);
  };
  
  // Update the preferences handler to show feedback
  const toggleSubtitles = () => {
    const newState = !preferences.subtitlesEnabled;
    console.log(`[SUBTITLE DEBUG] ${newState ? '✅ Enabling' : '❌ Disabling'} subtitles`);
    
    // Update the preferences
    setPreferences(prev => ({
      ...prev,
      subtitlesEnabled: newState
    }));
    
    // Show feedback to the user
    showCaptionToggleFeedback(newState);
    
    // If enabling and we have subtitles but no cues loaded, try loading them
    if (newState && subtitles.length > 0 && subtitleCues.length === 0) {
      console.log('[SUBTITLE DEBUG] 🔄 Subtitles enabled but no cues loaded, loading now');
      
      // Try to find the preferred language, or use the first subtitle
      const preferredSub = subtitles.find(sub => 
        sub.lang.toLowerCase().includes(preferences.preferredLanguage.toLowerCase()) ||
        sub.lang.toLowerCase().includes('english')
      ) || subtitles[0];
      
      if (preferredSub) {
        loadSubtitles(preferredSub);
      }
    }
  };

  // Improve the handleVideoTap function to detect double taps and respect subtitle dragging
  const handleVideoTap = useCallback((evt: any) => {
    // Skip all tap handling if we're dragging subtitles
    if (isDraggingSubtitle) {
      return;
    }
    
    const { locationX } = evt.nativeEvent;
    const now = Date.now();
    const DOUBLE_TAP_DELAY = 250; // Reduced from 300ms for faster response
    
    if (now - lastTapTime < DOUBLE_TAP_DELAY) {
      // This is a double tap - handle immediately
      setDoubleTapActive(true);
      
      // Cancel any single tap actions
      if (doubleTapTimer.current) {
        clearTimeout(doubleTapTimer.current);
        doubleTapTimer.current = null;
      }
      
      // Handle seek based on which side was tapped
      if (locationX < screenWidth / 2) {
        handleSeekRelative(-10);
        showSeekFeedback('rewind');
      } else {
        handleSeekRelative(10);
        showSeekFeedback('forward');
      }
      
      // Reset double tap state after a shorter delay
      setTimeout(() => {
        setDoubleTapActive(false);
      }, 400); // Reduced from 500ms
    } else {
      // For single taps, toggle controls with immediate effect
      if (!showControls) {
        // Immediately show controls (especially important when video is paused)
        showControlsWithTimeout();
        console.log('[VIDEO_TAP] 👆 Video tapped, showing controls');
      } else {
        // If controls are already visible and the video is playing, hide them
        if (isPlaying) {
          hideControls();
          console.log('[VIDEO_TAP] 👆 Video tapped with controls visible and playing, hiding controls');
        } else {
          // If paused, keep controls visible but toggle play/pause
          if (videoRef.current) {
            console.log('[VIDEO_TAP] 👆 Video tapped while paused, toggling playback');
            isPlaying ? videoRef.current.pauseAsync() : videoRef.current.playAsync();
          }
        }
      }
      
      // Set a timer to detect potential double tap
      if (doubleTapTimer.current) {
        clearTimeout(doubleTapTimer.current);
      }
      
      doubleTapTimer.current = setTimeout(() => {
        doubleTapTimer.current = null;
      }, DOUBLE_TAP_DELAY);
    }
    
    setLastTapTime(now);
  }, [isDraggingSubtitle, lastTapTime, screenWidth, doubleTapActive, showControls]);

  // Update the Pan Responder to work with the new double tap handling
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Only take over for gestures that are significant movements
        return Math.abs(gestureState.dx) > 10 || Math.abs(gestureState.dy) > 10;
      },
      onPanResponderGrant: () => {
        // No need to handle taps here anymore - all done in handleVideoTap
      },
      onPanResponderMove: (evt, gestureState) => {
        // Ensure we have a significant movement before handling
        if (Math.abs(gestureState.dx) < 3 && Math.abs(gestureState.dy) < 3) {
          return;
        }
        
        const { locationX } = evt.nativeEvent;
        
        if (Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 2) {
          if (!isScrubbing) {
            setIsScrubbing(true);
            setShowControls(true);
          }
          
          const seekDelta = gestureState.dx / screenWidth * duration;
          const newPosition = Math.max(0, Math.min(duration, currentTime + seekDelta));
          setScrubbingPosition(newPosition);
          
        } else {
          if (locationX < screenWidth / 3) {
            const brightnessChange = -gestureState.dy / 200;
            setBrightness(prev => Math.max(0, Math.min(1, prev + brightnessChange)));
          }
          else if (locationX > (screenWidth * 2/3)) {
            const volumeChange = -gestureState.dy / 200;
            setVolume(prev => Math.max(0, Math.min(1, prev + volumeChange)));
            if (videoRef.current) {
              videoRef.current.setVolumeAsync(Math.max(0, Math.min(1, volume + volumeChange)));
            }
          }
        }
      },
      onPanResponderRelease: () => {
        if (isScrubbing) {
          if (videoRef.current && scrubbingPosition !== currentTime) {
            videoRef.current.setPositionAsync(scrubbingPosition * 1000);
          }
          setIsScrubbing(false);
        }
      },
    })
  ).current;

  // Helper functions
  const handleSeekRelative = (seconds: number) => {
    if (!videoRef.current) return;
    
    const newTime = Math.max(0, Math.min(duration, currentTime + seconds));
    setIsBuffering(true);
    
    // Check if we're dealing with an HLS stream
    const isHLS = videoSourceState.uri.includes('.m3u8');
    
    if (isHLS) {
      logDebug('SEEK', `🔍 HLS relative seek ${seconds > 0 ? '+' : ''}${seconds}s to ${formatTime(newTime)}`);
      
      // Use the same improved approach for HLS
      videoRef.current.pauseAsync().then(() => {
        if (!videoRef.current) return;
        
        videoRef.current.setPositionAsync(newTime * 1000).then(() => {
          // Use multiple attempts to resume playback with increasing delays
          const attemptResume = (attempt = 1, maxAttempts = 3) => {
            if (attempt <= maxAttempts && videoRef.current) {
              const delay = attempt * 300;
              logDebug('SEEK', `▶️ Attempting to resume playback after relative seek (attempt ${attempt}/${maxAttempts}) after ${delay}ms`);
              
              setTimeout(() => {
                if (!videoRef.current) return;
                
                videoRef.current.playAsync()
                  .then(() => {
                    logDebug('SEEK', `✅ Successfully resumed playback after relative seek on attempt ${attempt}`);
                  })
                  .catch(error => {
                    logDebug('SEEK', `❌ Failed to resume after relative seek on attempt ${attempt}: ${error}`);
                    if (attempt < maxAttempts) {
                      attemptResume(attempt + 1, maxAttempts);
                    }
                  });
              }, delay);
            }
          };
          
          // Start the resume attempts
          attemptResume();
        });
      });
    } else {
      // For non-HLS, use the simpler approach
      videoRef.current.setPositionAsync(newTime * 1000).then(() => {
        if (isPlaying) {
          setTimeout(() => {
            if (!videoRef.current) return;
            
            videoRef.current.playAsync().catch(e => 
              console.error('[SEEK] Error resuming playback after relative seek:', e)
            );
          }, 300);
        }
      });
    }
  };

  const showSeekFeedback = (direction: 'forward' | 'rewind') => {
    // Could implement a visual feedback animation here
  };

  const toggleControls = () => {
    if (showControls) {
      hideControls();
    } else {
      showControlsWithTimeout();
    }
  };

  const showControlsWithTimeout = useCallback(() => {
    // First clear any existing timer to avoid conflicts
    if (controlsTimerRef.current) {
      clearTimeout(controlsTimerRef.current);
      controlsTimerRef.current = null;
    }
    
    // Only update state if controls are not already visible
    if (!showControls) {
      console.log('[CONTROLS] 🎮 Showing controls');
      
      // Show the controls immediately
      setShowControls(true);
      
      // Fade in animation - optimized for performance
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 150, // Reduced from 200ms for faster response
          useNativeDriver: true,
        }),
        Animated.spring(controlsScale, {
          toValue: 1,
          friction: 6, // Lower friction for faster spring animation
          tension: 50, // Higher tension for more responsive animation
          useNativeDriver: true,
        })
      ]).start();
    }
    
    // Only set a hide timer if the video is playing
    if (isPlaying) {
      console.log('[CONTROLS] 🎮 Setting hide timer for 10s');
      controlsTimerRef.current = setTimeout(() => {
        hideControls();
      }, 10000); // 10 seconds for auto-hide timeout
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fadeAnim, controlsScale, isPlaying, showControls]);

  // Re-add the hideControls function
  const hideControls = useCallback(() => {
    // Only hide controls if they are actually visible and video is playing
    if (!showControls || !isPlaying) return;
    
    console.log("[CONTROLS] 🎮 Hiding controls");
    
    // Fade out animation - optimized for performance
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 150, // Reduced from 200ms for faster response
        useNativeDriver: true,
      }),
      Animated.spring(controlsScale, {
        toValue: 0.98, // Less extreme scale change for smoother animation
        friction: 6,
        tension: 50,
        useNativeDriver: true,
      })
    ]).start(() => {
      // Only update state if we need to
      if (showControls) {
        setShowControls(false);
      }
    });
    
    // Clear the timer immediately
    if (controlsTimerRef.current) {
      clearTimeout(controlsTimerRef.current);
      controlsTimerRef.current = null;
    }
  }, [showControls, fadeAnim, controlsScale, isPlaying]);

  // Add error state
  const [error, setError] = useState<VideoError | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const progressIntervalCountRef = useRef(0);

  // Enhanced error handling
  const handleError = (errorMessage: string) => {
    console.error('[PLAYER ERROR] ❌', errorMessage);
    
    // Check for specific error messages and provide more helpful information
    let displayMessage = errorMessage;
    if (errorMessage.includes('No video sources') || errorMessage === 'Error: Error: No video sources available') {
      displayMessage = 'No video sources available. The server may be experiencing issues or the content is unavailable.';
    }
    
    setError({ message: displayMessage });
    setIsDataLoading(false);
  };

  // Add this at the beginning of the component body
  useEffect(() => {
    console.log("\n====================================");
    console.log("🎬 PLAYER SCREEN MOUNTED SUCCESSFULLY");
    console.log("====================================\n");
    
    // Get the data key from params
    const dataKey = params.dataKey as string;
    if (dataKey) {
      console.log(`📦 Data key received: ${dataKey}`);
    } else {
      console.log("❌ No data key received in params");
    }
    
    // Initialize the wasPlayingRef
    wasPlayingRef.current = false;
    
    // Show controls initially
    setShowControls(true);
    
    // The rest of your existing code...
    loadPlayerData();

    return () => {
      // Your existing cleanup code...
      if (controlsTimerRef.current) {
        clearTimeout(controlsTimerRef.current);
      }
      
      // Clear any active countdown timer
      if (typeof countdownTimerRef === 'number' || countdownTimerRef) {
        clearInterval(countdownTimerRef);
      }
      
      console.log("\n====================================");
      console.log("👋 PLAYER SCREEN UNMOUNTED");
      console.log("====================================\n");
    };
  }, []);
  
  // Load player data with URL validation
  const loadPlayerData = async () => {
    console.log("\n====================================");
    console.log("🔄 PLAYER DATA LOADING STARTED");
    console.log("====================================\n");
    
    // Show loading UI immediately
    setIsDataLoading(true);
    setError(null);
    
    try {
      // Get data key and log all parameters for debugging
      console.log("📦 PARAMS RECEIVED:", JSON.stringify(params, null, 2));
      const dataKey = params.dataKey as string;
      
      // Add more detailed logging about the key being used
      console.log(`📦 Data key extracted: "${dataKey}"`);
      console.log(`📦 Type of dataKey: ${typeof dataKey}`);
      
      if (!dataKey) {
        console.log("❌ No dataKey found in params - this is required!");
        throw new Error('No dataKey provided in params');
      }

      // Check if the dataKey is the episodeId instead of the source key
      if (dataKey.includes('?ep=')) {
        console.log("⚠️ WARNING: The dataKey appears to be an episodeId, not a source key!");
        console.log("⚠️ This indicates the EpisodeList component might not be passing the correct key");
      }
      
      // Pre-emptively prepare the video component while loading data
      // This helps reduce perceived loading time
      setIsBuffering(true);
      
      // First try with exact key
      console.log(`📦 Attempting to load with exact key: "${dataKey}"`);
      let storedData = await AsyncStorage.getItem(dataKey);
      
      // If not found, try with source_ prefix
      if (!storedData && !dataKey.startsWith('source_')) {
        console.log(`📦 Data not found with exact key, trying with source_ prefix...`);
        const sourceKey = `source_${dataKey}`;
        console.log(`📦 Trying alternate key: "${sourceKey}"`);
        storedData = await AsyncStorage.getItem(sourceKey);
      }

      // If still not found, look for any keys that might contain this episode info
      if (!storedData) {
        console.log(`📦 Data still not found, checking all keys in AsyncStorage...`);
        // Get all keys from storage to help with debugging
        const allKeys = await AsyncStorage.getAllKeys();
        console.log(`📦 All AsyncStorage keys:`, allKeys);
        
        // Look for source keys that might be relevant
        const sourceKeys = allKeys.filter(k => k.startsWith('source_'));
        console.log(`📦 Found ${sourceKeys.length} source keys:`, sourceKeys);
        
        // Look for the most recent source key
        if (sourceKeys.length > 0) {
          // Sort by timestamp (assuming format source_TIMESTAMP)
          sourceKeys.sort((a, b) => {
            const timeA = parseInt(a.split('_')[1] || '0');
            const timeB = parseInt(b.split('_')[1] || '0');
            return timeB - timeA; // Most recent first
          });
          
          const mostRecentKey = sourceKeys[0];
          console.log(`📦 Trying most recent source key: "${mostRecentKey}"`);
          storedData = await AsyncStorage.getItem(mostRecentKey);
          
          if (storedData) {
            console.log(`✅ Found data with key: "${mostRecentKey}"`);
          }
        }
      }
      
      if (!storedData) {
        console.log(`❌ No data found after trying all possible keys`);
        throw new Error(`No data found for key: ${dataKey}`);
      }
      
      // Log some info about the data we found
      console.log(`✅ Data found! Size: ${storedData.length} bytes`);
      console.log(`📦 Data preview: ${storedData.substring(0, 100)}...`);
      
      // Parse data as quickly as possible - this is a critical step
      let playerData: any;
      try {
        playerData = JSON.parse(storedData);
        console.log(`✅ Successfully parsed JSON data`);
        console.log(`📦 Data fields:`, Object.keys(playerData));
      } catch (parseError) {
        console.error(`❌ Failed to parse JSON:`, parseError);
        throw new Error(`Failed to parse player data: ${parseError}`);
      }
      
      // Basic validation before proceeding with setup
      if (!playerData.source && !playerData.sourceUrl) {
        console.log(`❌ Missing video source URL in parsed data`);
        throw new Error('Missing video source URL in player data');
      }
      
      // Handle different data structures - support both source and sourceUrl properties
      const sourceUrl = playerData.sourceUrl || playerData.source;
      const headers = playerData.headers || {};
      
      console.log(`✅ Video source found: ${sourceUrl.substring(0, 30)}...`);
      console.log(`✅ Headers found: ${Object.keys(headers).join(', ')}`);
      
      // These are the essential data items we need to set up immediately
      // Setting them early helps improve perceived performance
      setAnimeTitle(playerData.animeTitle || 'Unknown Anime');
      setEpisodeTitle(playerData.episodeTitle || '');
      setEpisodeNumber(playerData.episodeNumber || '0');
      
      // If there's an anilistId in the player data, use it as a param
      // This ensures it's available for the save check even if not passed in URL params
      if (playerData.anilistId && !params.anilistId) {
        params.anilistId = playerData.anilistId;
        console.log(`🔄 Updated anilistId param from player data: ${playerData.anilistId}`);
      }
      
      // Check if it's an HLS stream - important for the player setup
      const isHLS = isM3U8Stream(sourceUrl);
      setIsHLSStream(isHLS);
      console.log(`✅ Stream type: ${isHLS ? 'HLS (m3u8)' : 'Direct video'}`);
      
      // Set up video source as quickly as possible
      setVideoSourceState({
        uri: sourceUrl,
        headers: headers
      });
      
      // Handle subtitles - can be loaded in parallel
      if (playerData.subtitles && Array.isArray(playerData.subtitles) && playerData.subtitles.length > 0) {
        console.log(`✅ Found ${playerData.subtitles.length} subtitles`);
        setSubtitles(playerData.subtitles);
        
        // Try to find the preferred language subtitle
        const preferredSub = playerData.subtitles.find(
          (sub: Subtitle) => sub.lang.toLowerCase() === preferences.selectedSubtitleLanguage.toLowerCase()
        );
        
        // Default to English or first available if preferred not found
        const defaultSub = playerData.subtitles.find(
          (sub: Subtitle) => sub.lang.toLowerCase() === 'english'
        ) || playerData.subtitles[0];
        
        const subtitleToLoad = preferredSub || defaultSub;
        
        if (subtitleToLoad && preferences.subtitlesEnabled) {
          console.log(`✅ Loading ${subtitleToLoad.lang} subtitles`);
          // Load subtitles in the background
          loadSubtitles(subtitleToLoad).catch(err => {
            console.warn('Failed to load initial subtitles:', err);
          });
        }
      } else {
        console.log(`ℹ️ No subtitles found in data`);
      }
      
      // Handle video timing markers
      const introOutroTimestamps = {
        introStart: 0,
        introEnd: 0,
        outroStart: 0,
        outroEnd: 0
      };
      
      // Process timing information if available
      if (playerData.timings || playerData.videoTimings) {
        const timingsData = playerData.videoTimings || playerData.timings;
        console.log(`✅ Found video timings data:`, timingsData);
        const { intro, outro } = timingsData || {};
        
        if (intro && typeof intro.start === 'number' && typeof intro.end === 'number') {
          introOutroTimestamps.introStart = intro.start;
          introOutroTimestamps.introEnd = intro.end;
          console.log(`✅ Intro markers: ${intro.start}s-${intro.end}s`);
        }
        
        if (outro && typeof outro.start === 'number' && typeof outro.end === 'number') {
          introOutroTimestamps.outroStart = outro.start;
          introOutroTimestamps.outroEnd = outro.end;
          console.log(`✅ Outro markers: ${outro.start}s-${outro.end}s`);
        }
      } else {
        console.log(`ℹ️ No video timing markers found`);
      }
      
      setIntroOutroTimestamps(introOutroTimestamps);
      
      // Check if there's a saved timestamp to start from
      if (playerData.startTime && typeof playerData.startTime === 'number' && playerData.startTime > 0) {
        setSavedStartPosition(playerData.startTime);
        console.log(`✅ Starting from saved position: ${playerData.startTime}s`);
      }
      
      // We've now loaded the essential data, update the UI
      setIsDataLoading(false);
      console.log(`✅ Player data loaded successfully!`);
      
      // Logging can happen after the main setup is complete
      logDebug('PLAYER_READY', '✅ Player data loaded successfully');
    } catch (error: any) {
      console.error('Error loading player data:', error);
      handleError(`Failed to load video data: ${error?.message || 'Unknown error'}`);
      setIsDataLoading(false);
    }
  };
  
  // Format time display
  const formatTime = (seconds: number) => {
    if (isNaN(seconds) || seconds === Infinity) return '00:00';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };
  
  // State for subtitle control
  const [currentSubtitle, setCurrentSubtitle] = useState<string>('');
  const [selectedLanguage, setSelectedLanguage] = useState<string>('English');
  const [subtitleCues, setSubtitleCues] = useState<SubtitleCue[]>([]);
  const [isLoadingSubtitles, setIsLoadingSubtitles] = useState(false);
  // Remove offset - set to 0
  const [subtitleOffset, setSubtitleOffset] = useState(0); 

  // Update subtitle display based on current time
  useEffect(() => {
    // Don't process if no cues available
    if (subtitleCues.length === 0) {
      if (currentSubtitle) {
        setCurrentSubtitle('');
      }
      console.log('[SUBTITLE DEBUG] ℹ️ Subtitles not shown: no cues available');
      return;
    }

    // Find the subtitle that should be displayed at the current time
    // Use binary search for better performance with large subtitle files
    const findSubtitleCue = (time: number, cues: SubtitleCue[]): SubtitleCue | null => {
      // First check if we're before the first subtitle or after the last one
      if (time < cues[0].startTime || time > cues[cues.length - 1].endTime) {
        return null;
      }
      
      // Simple linear search for small number of cues (more reliable)
      return cues.find(cue => time >= cue.startTime && time <= cue.endTime) || null;
    };
    
    const currentCue = findSubtitleCue(currentTime, subtitleCues);
    
    // Only update the subtitle text if it has changed
    if (currentCue?.text !== currentSubtitle) {
      setCurrentSubtitle(currentCue?.text || '');
      
      // Log only when subtitle changes
      if (currentCue) {
        console.log('[SUBTITLE DEBUG] 📝 Showing subtitle at', formatTime(currentTime), ':', currentCue.text);
      } else if (currentSubtitle) {
        console.log('[SUBTITLE DEBUG] ⏹️ Cleared subtitle at', formatTime(currentTime));
      }
    }
  }, [currentTime, subtitleCues, currentSubtitle]);

  // Add the improved useEffect for language selection
  useEffect(() => {
    if (!subtitles.length) {
      console.log('[SUBTITLE DEBUG] No subtitles available');
      return;
    }
    
    if (!preferences.subtitlesEnabled) {
      console.log('[SUBTITLE DEBUG] Subtitles are disabled in preferences');
      return;
    }
    
    console.log('[SUBTITLE DEBUG] 🔍 Available languages:', subtitles.map((s: Subtitle) => s.lang).join(', '));
    console.log('[SUBTITLE DEBUG] 🎯 Preferred language:', selectedLanguage);
    
    // Try to find exact match first
    let subtitle = subtitles.find((s: Subtitle) => 
      s.lang.toLowerCase() === selectedLanguage.toLowerCase()
    );
    
    // If no exact match, try to find a partial match
    if (!subtitle) {
      subtitle = subtitles.find((s: Subtitle) => 
        s.lang.toLowerCase().includes(selectedLanguage.toLowerCase())
      );
    }
    
    // If still no match and language is English, try other English variants
    if (!subtitle && selectedLanguage.toLowerCase() === 'english') {
      subtitle = subtitles.find((s: Subtitle) =>
        s.lang.toLowerCase().includes('eng') ||
        s.lang.toLowerCase().includes('en')
      );
    }
    
    // If we found a subtitle, load it
    if (subtitle) {
      console.log('[SUBTITLE DEBUG] ✅ Found matching subtitle:', subtitle.lang);
      logDebug('SUBTITLES', `🔄 Loading subtitles for language: ${subtitle.lang}`);
      loadSubtitles(subtitle);
    } else {
      console.log('[SUBTITLE DEBUG] ❌ No matching subtitle found for:', selectedLanguage);
      // If no matching subtitle found but we have subtitles, load the first one
      if (subtitles.length > 0) {
        console.log('[SUBTITLE DEBUG] ⚠️ Falling back to first available subtitle:', subtitles[0].lang);
        loadSubtitles(subtitles[0]);
      }
    }
  }, [selectedLanguage, subtitles, preferences.subtitlesEnabled]);

  // Function to fetch and parse VTT subtitles
  const loadSubtitles = async (subtitle: Subtitle, retryCount = 0) => {
    if (!subtitle || !subtitle.url) {
      console.log('[SUBTITLE DEBUG] ❌ Invalid subtitle data:', subtitle);
      return;
    }

    console.log('\n=== SUBTITLE LOADING DEBUG ===');
    console.log('[SUBTITLE DEBUG] 🔄 Starting subtitle load for:', subtitle.lang);
    console.log('[SUBTITLE DEBUG] 🔍 Subtitle URL:', subtitle.url);
    console.log('[SUBTITLE DEBUG] 📊 Retry count:', retryCount);
    setIsLoadingSubtitles(true);
    setSubtitleCues([]); // Clear existing cues while loading new ones
    
    try {
      logDebug('SUBTITLES', `🔍 Loading subtitles from: ${subtitle.url}${retryCount > 0 ? ` (Attempt ${retryCount + 1})` : ''}`);
      
      // Log the network request details
      console.log('[SUBTITLE DEBUG] 🌐 Making network request with headers:');
      const headers = {
        'Accept': '*/*',
        'Origin': 'https://hianime.to',
        'Referer': 'https://hianime.to/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/98.0.4758.102 Safari/537.36'
      };
      console.log(JSON.stringify(headers, null, 2));
      
      // Create AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        console.log('[SUBTITLE DEBUG] ⏱️ Request timed out after 15s, aborting');
        controller.abort();
      }, 15000);
      
      console.log('[SUBTITLE DEBUG] 🕒 Request started at:', new Date().toISOString());
      const startTime = Date.now();
      
      const response = await fetch(subtitle.url, {
        headers,
        signal: controller.signal
      });
      
      const duration = Date.now() - startTime;
      console.log(`[SUBTITLE DEBUG] ⏱️ Request completed in ${duration}ms`);
      
      // Clear the timeout
      clearTimeout(timeoutId);
      
      // Log the response details
      console.log('[SUBTITLE DEBUG] 📡 Response status:', response.status);
      console.log('[SUBTITLE DEBUG] 📡 Response status text:', response.statusText);
      console.log('[SUBTITLE DEBUG] 📡 Response headers:', JSON.stringify(Object.fromEntries([...response.headers.entries()]), null, 2));
      
      if (!response.ok) {
        console.error(`[SUBTITLE DEBUG] ❌ HTTP error! status: ${response.status}`);
        
        // Retry logic for server errors (5xx) or rate limiting (429)
        if ((response.status >= 500 || response.status === 429) && retryCount < 2) {
          const retryDelay = retryCount === 0 ? 1000 : 3000;
          console.log(`[SUBTITLE DEBUG] 🔄 Will retry in ${retryDelay}ms (attempt ${retryCount + 1} of 2)`);
          showSubtitleError(`Network error (${response.status}). Retrying in ${retryDelay/1000}s...`);
          
          setTimeout(() => {
            loadSubtitles(subtitle, retryCount + 1);
          }, retryDelay);
          return;
        }
        
        showSubtitleError(`Failed to load subtitles: HTTP ${response.status}`);
        console.log('[SUBTITLE DEBUG] ❌ Failed with HTTP error, no more retries');
        throw new Error(`HTTP error status: ${response.status}`);
      }
      
      console.log('[SUBTITLE DEBUG] ✅ Response successful, reading text content');
      const vttText = await response.text();
      
      // Log the content length and check if it's empty
      console.log(`[SUBTITLE DEBUG] 📊 Content length: ${vttText.length} characters`);
      
      if (!vttText || vttText.trim().length === 0) {
        console.error('[SUBTITLE DEBUG] ❌ Empty subtitle content received');
        showSubtitleError('Subtitle file is empty');
        throw new Error('Empty subtitle content received');
      }
      
      // Check if the content looks like VTT
      const hasWebVTT = vttText.includes('WEBVTT');
      const hasTimeCodes = vttText.includes('-->');
      console.log(`[SUBTITLE DEBUG] 🔍 Content validation: WEBVTT header: ${hasWebVTT ? 'Yes' : 'No'}, Time codes: ${hasTimeCodes ? 'Yes' : 'No'}`);
      
      if (!hasWebVTT && !hasTimeCodes) {
        console.error('[SUBTITLE DEBUG] ❌ Content does not appear to be VTT format');
        console.log('[SUBTITLE DEBUG] 📄 Content preview:', vttText.substring(0, 500).replace(/\n/g, '\\n')); // Log the first 500 characters
        showSubtitleError('Invalid subtitle format');
        throw new Error('Content does not appear to be valid VTT format');
      }
      
      console.log('[SUBTITLE DEBUG] 📄 Subtitle content sample:', vttText.substring(0, 300).replace(/\n/g, '\\n') + '...');
      
      // Process the VTT content
      console.log('[SUBTITLE DEBUG] 🔄 Starting VTT parsing');
      const parseStartTime = Date.now();
      const cues = parseVTT(vttText);
      const parseDuration = Date.now() - parseStartTime;
      console.log(`[SUBTITLE DEBUG] ⏱️ Parsing completed in ${parseDuration}ms`);
      
      if (cues.length === 0) {
        console.warn('[SUBTITLE DEBUG] ⚠️ No cues parsed from subtitle file');
        console.log('[SUBTITLE DEBUG] 🔍 Detailed content analysis:');
        
        // Try to identify common issues
        const lines = vttText.split('\n');
        console.log(`[SUBTITLE DEBUG] 📊 Total lines: ${lines.length}`);
        
        // Look for time codes in the format "00:00:00.000 --> 00:00:00.000"
        const timeCodeLines = lines.filter(line => line.includes('-->'));
        console.log(`[SUBTITLE DEBUG] 📊 Lines with time codes: ${timeCodeLines.length}`);
        
        if (timeCodeLines.length > 0) {
          console.log(`[SUBTITLE DEBUG] 📋 Sample time code lines:`);
          timeCodeLines.slice(0, 3).forEach((line, i) => {
            console.log(`[SUBTITLE DEBUG] Line ${i + 1}: "${line}"`);
          });
          
          // Check if there's content after the time codes
          const potentialIssue = timeCodeLines.length > 0 && cues.length === 0 
            ? "Time codes found but no cues parsed - possible format issue or empty subtitle text" 
            : "Unknown parsing issue";
          console.log(`[SUBTITLE DEBUG] 🔍 Potential issue: ${potentialIssue}`);
        }
        
        showSubtitleError('No subtitles found in file');
      } else {
        console.log(`[SUBTITLE DEBUG] ✅ Successfully parsed ${cues.length} subtitle cues`);
        
        // Log some sample cues for debugging
        const sampleCues = cues.slice(0, 5).map(cue => ({
          start: formatTime(cue.startTime),
          end: formatTime(cue.endTime),
          text: cue.text.length > 50 ? cue.text.substring(0, 50) + '...' : cue.text
        }));
        
        console.log('[SUBTITLE DEBUG] 📋 Sample cues:', sampleCues);
        
        // Log time range of subtitles
        if (cues.length > 0) {
          const firstCue = cues[0];
          const lastCue = cues[cues.length - 1];
          console.log(`[SUBTITLE DEBUG] 📊 Subtitle time range: ${formatTime(firstCue.startTime)} - ${formatTime(lastCue.endTime)}`);
        }
        
        // Force enable subtitles when cues are available
        if (!preferences.subtitlesEnabled) {
          console.log('[SUBTITLE DEBUG] 🔄 Auto-enabling subtitles because cues are available');
          setPreferences(prev => ({
            ...prev,
            subtitlesEnabled: true
          }));
        }
        // Hide any previous error message
        setSubtitleError(null);
      }
      
      console.log(`[SUBTITLE DEBUG] 🔄 Setting ${cues.length} subtitle cues in state`);
      setSubtitleCues(cues);
      
      logDebug('SUBTITLES', `✅ Loaded ${cues.length} cues for language: ${subtitle.lang}`);
      console.log('=== END SUBTITLE LOADING DEBUG ===\n');
    } catch (error: any) {
      console.error(`[SUBTITLE DEBUG] ❌ Failed to load subtitles:`, error);
      console.log(`[SUBTITLE DEBUG] ❌ Error name: ${error.name}`);
      console.log(`[SUBTITLE DEBUG] ❌ Error message: ${error.message}`);
      console.log(`[SUBTITLE DEBUG] ❌ Error stack: ${error.stack}`);
      
      logDebug('SUBTITLES', `❌ Failed to load subtitles: ${error instanceof Error ? error.message : String(error)}`);
      
      // Retry on network errors or timeouts
      if (error instanceof TypeError || error.name === 'AbortError') {
        console.log(`[SUBTITLE DEBUG] 🔄 Network error detected: ${error.name}`);
        if (retryCount < 2) {
          const retryDelay = retryCount === 0 ? 1000 : 3000;
          console.log(`[SUBTITLE DEBUG] 🔄 Will retry in ${retryDelay}ms (attempt ${retryCount + 1} of 2)`);
          showSubtitleError(`Network error. Retrying in ${retryDelay/1000}s...`);
          
          setTimeout(() => {
            loadSubtitles(subtitle, retryCount + 1);
          }, retryDelay);
          return;
        } else {
          console.log(`[SUBTITLE DEBUG] ❌ Max retries reached (${retryCount}), giving up`);
        }
      }
      
      setSubtitleCues([]);
      showSubtitleError(`Failed to load subtitles: ${error instanceof Error ? error.message : 'Unknown error'}`);
      console.log('=== END SUBTITLE LOADING DEBUG (WITH ERROR) ===\n');
    } finally {
      if (retryCount === 0 || retryCount >= 2) {
        setIsLoadingSubtitles(false);
      }
    }
  };

  // Add this to show subtitle errors
  const [subtitleError, setSubtitleError] = useState<string | null>(null);

  const showSubtitleError = (message: string) => {
    setSubtitleError(message);
    // Clear the error message after 5 seconds
    setTimeout(() => {
      setSubtitleError(null);
    }, 5000);
  };

  // Add debug logging for subtitle display in the UI
  useEffect(() => {
    if (preferences.subtitlesEnabled && currentSubtitle) {
      console.log('[SUBTITLE DEBUG] 🎨 Rendering subtitle:', currentSubtitle);
    }
  }, [currentSubtitle, preferences.subtitlesEnabled]);

  // Handle device orientation changes
  const [orientation, setOrientation] = useState(ScreenOrientation.Orientation.LANDSCAPE_RIGHT);
  // Add isLandscape state variable
  const [isLandscape, setIsLandscape] = useState(true);
  // Force landscape by setting autoRotateEnabled to false
  const [autoRotateEnabled, setAutoRotateEnabled] = useState(false);
  const [isExitingPlayer, setIsExitingPlayer] = useState(false);
  const [orientationSubscription, setOrientationSubscription] = useState<ScreenOrientation.Subscription | null>(null);

  // Ensure autoRotateEnabled is always false to force landscape
  useEffect(() => {
    if (autoRotateEnabled) {
      setAutoRotateEnabled(false);
    }
  }, [autoRotateEnabled]);

  // Enhanced orientation detection and handling
  useEffect(() => {
    let subscription: ScreenOrientation.Subscription;
    
    const setupOrientationListener = async () => {
      // Get initial orientation
      const initialOrientation = await ScreenOrientation.getOrientationAsync();
      setOrientation(initialOrientation);
      
      // Set initial landscape state
      const initialIsLandscape = 
        initialOrientation === ScreenOrientation.Orientation.LANDSCAPE_LEFT || 
        initialOrientation === ScreenOrientation.Orientation.LANDSCAPE_RIGHT;
      setIsLandscape(initialIsLandscape);
      
      // Always lock to landscape, no auto-rotation
      await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
      
      // Subscribe to orientation changes just for tracking
      subscription = ScreenOrientation.addOrientationChangeListener(event => {
        const newOrientation = event.orientationInfo.orientation;
        setOrientation(newOrientation);
        
        // Update isLandscape state
        const newIsLandscape = 
          newOrientation === ScreenOrientation.Orientation.LANDSCAPE_LEFT ||
          newOrientation === ScreenOrientation.Orientation.LANDSCAPE_RIGHT;
        setIsLandscape(newIsLandscape);
        
        // Force back to landscape if somehow changed to portrait
        if (newOrientation === ScreenOrientation.Orientation.PORTRAIT_UP || 
            newOrientation === ScreenOrientation.Orientation.PORTRAIT_DOWN) {
          console.log('[PLAYER_SCREEN] 🔒 Detected portrait, forcing back to landscape');
          ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE)
            .catch(err => console.error("Error locking orientation:", err));
        }
      });
      
      setOrientationSubscription(subscription);
    };
    
    setupOrientationListener();
    
    return () => {
      if (subscription) {
        ScreenOrientation.removeOrientationChangeListener(subscription);
      }
    };
  }, []);

  // Update screen orientation lock when fullscreen state changes
  useEffect(() => {
    const updateOrientationLock = async () => {
      try {
        // Always stay in landscape mode regardless of settings
        await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
        
        // Set fullscreen UI state based on orientation
        const currentIsLandscape = 
          orientation === ScreenOrientation.Orientation.LANDSCAPE_LEFT ||
          orientation === ScreenOrientation.Orientation.LANDSCAPE_RIGHT;
        
        // Update the isLandscape state
        setIsLandscape(currentIsLandscape);
        
        if (currentIsLandscape !== isFullscreen) {
          setIsFullscreen(currentIsLandscape);
        }
        
        // Always hide status bar in video player
        StatusBar.setHidden(true);
      } catch (error) {
        console.log("Error updating orientation lock:", error);
      }
    };
    
    updateOrientationLock();
  }, [isFullscreen, orientation]);

  // Handle component cleanup for orientation when unmounting
  useEffect(() => {
    // Return cleanup function
    return () => {
      // First clean up any timers to prevent memory leaks and race conditions
      if (controlsTimerRef.current) {
        clearTimeout(controlsTimerRef.current);
        controlsTimerRef.current = null;
      }
      
      // Clean up countdown timer if it exists
      if (countdownTimerRef) {
        clearInterval(countdownTimerRef);
      }
      
      // If we're not being forced back by a hardware back button
      if (!isExitingPlayer) {
        logDebug('CLEANUP', '🔄 Component unmounting, properly resetting view and orientation');
        
        // Reset the video state before orientation change
        if (videoRef.current) {
          try {
            videoRef.current.stopAsync().catch(() => {});
          } catch (e) {
            // Ignore errors during cleanup
          }
        }
        
        // Wrap in a Promise to ensure sequencing
        const resetOrientation = async () => {
          try {
            // First set UI state back to portrait-compatible layout
            setIsFullscreen(false);
            
            // Reset all animations 
            Animated.timing(fadeAnim, {
              toValue: 0,
              duration: 100,
              useNativeDriver: true
            }).start();
            
            // Delay orientation change slightly to allow UI to adjust
            await new Promise(resolve => setTimeout(resolve, 50));
            
            // Force portrait orientation
            await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
            
            // Wait a bit to ensure all animations are complete before final cleanup
            setTimeout(() => {
              StatusBar.setHidden(false, 'fade');
            }, 300);
          } catch (error) {
            console.error('Error during orientation reset:', error);
          }
        };
        
        // Start the reset process immediately
        resetOrientation();
      } else {
        logDebug('CLEANUP', '✅ Maintaining current orientation when returning via back button');
      }
    };
  }, [isExitingPlayer, fadeAnim]);

  // Load subtitle position from storage
  useEffect(() => {
    const loadSubtitlePosition = async () => {
      try {
        const savedPosition = await AsyncStorage.getItem('subtitlePosition');
        if (savedPosition) {
          const position = JSON.parse(savedPosition);
          subtitlePositionRef.current = position;
          setSubtitlePosition(position);
          console.log('[SUBTITLE DEBUG] ✅ Loaded saved subtitle position:', position);
        }
      } catch (error) {
        console.error('[SUBTITLE DEBUG] ❌ Error loading subtitle position:', error);
      }
    };
    
    loadSubtitlePosition();
  }, [screenDimensions]);

  // Update resetSubtitlePosition to log the reset
  const resetSubtitlePosition = () => {
    const resetPosition = { x: 0, y: 0 };
    subtitlePositionRef.current = resetPosition;
    setSubtitlePosition(resetPosition);
    
    // Reset animated values
    subtitleAnimX.setValue(0);
    subtitleAnimY.setValue(0);
    
    console.log('[SUBTITLE RESET] Position reset to center (0,0)');
    
    AsyncStorage.removeItem('subtitlePosition');
    console.log('[SUBTITLE DEBUG] 🔄 Reset subtitle position');
  };

  // Add animated values for performant subtitle movement
  const subtitleAnimX = useRef(new Animated.Value(0)).current;
  const subtitleAnimY = useRef(new Animated.Value(0)).current;

  // Add these state variables with other player state variables
  const [showNextEpisodeCountdown, setShowNextEpisodeCountdown] = useState(false);
  const [nextEpisodeCountdown, setNextEpisodeCountdown] = useState(60); // 60 second countdown
  const [countdownTimerRef, setCountdownTimerRef] = useState<NodeJS.Timeout | null>(null);

  // Add these state variables with other player state variables
  const [showExitConfirmModal, setShowExitConfirmModal] = useState(false);
  const [isSavingProgress, setIsSavingProgress] = useState(false);
  const [progressSaveError, setProgressSaveError] = useState<string | null>(null);

  // Add function to save progress to AsyncStorage
  const saveLocalProgress = async () => {
    try {
      console.log('[PROGRESS SAVE] 🔄 Starting local progress save operation...');
      
      // Extract episode number from the episodeId if not directly available
      let episodeNumberToUse = episodeNumber;
      if (!episodeNumberToUse && params.episodeId) {
        console.log('[PROGRESS SAVE] 🔍 Trying to extract episode number from episodeId:', params.episodeId);
        // Try to extract episode number from formats like "177709?ep=8"
        const epMatch = String(params.episodeId).match(/ep=(\d+)/);
        if (epMatch && epMatch[1]) {
          episodeNumberToUse = epMatch[1];
          console.log('[PROGRESS SAVE] ✅ Extracted episode number:', episodeNumberToUse);
        }
      }
      
      // Get AniList ID either from params or extract from episodeId
      let anilistId = params.anilistId;
      if (!anilistId && params.episodeId) {
        console.log('[PROGRESS SAVE] 🔍 Trying to extract AniList ID from episodeId:', params.episodeId);
        // Try to extract AniList ID from formats like "177709?ep=8"
        const idMatch = String(params.episodeId).match(/^(\d+)/);
        if (idMatch && idMatch[1]) {
          anilistId = idMatch[1];
          console.log('[PROGRESS SAVE] ✅ Extracted AniList ID:', anilistId);
        }
      }
      
      if (!animeTitle || !episodeNumberToUse) {
        console.log('[PROGRESS SAVE] ❌ Missing anime title or episode number - cannot save progress');
        return false;
      }
      
      const normalizedTitle = animeTitle.toLowerCase().trim();
      
      // Create a unique key for this anime's progress
      // Updated to use video_progress_ prefix to match the format used when retrieving
      const storageKey = `video_progress_${anilistId || normalizedTitle}_${episodeNumberToUse}`;
      
      console.log('[PROGRESS SAVE] 🔑 Using storage key:', storageKey);
      console.log('[PROGRESS SAVE] 📊 Progress data:', {
        animeTitle,
        episode: episodeNumberToUse,
        anilistId,
        position: currentTime,
        duration,
        percentage: `${((currentTime/duration)*100).toFixed(2)}%`
      });
      
      // Save the current position in AsyncStorage for this episode
      await AsyncStorage.setItem(storageKey, JSON.stringify({
        animeTitle,
        episodeNumber: episodeNumberToUse,
        position: currentTime,
        duration,
        timestamp: new Date().toISOString(),
        anilistId, // Include the AniList ID in saved data
      }));
      
      console.log('[PROGRESS SAVE] ✅ Progress saved locally');
      return true;
    } catch (error) {
      console.error('[PROGRESS SAVE] ❌ Error saving local progress:', error);
      return false;
    }
  };

  // Add this helper function after parseVTT or another suitable location
  const searchAnimeOnAniList = async (title: string, token: string | null): Promise<number | null> => {
    try {
      console.log('[ANILIST SEARCH] 🔍 Searching for anime:', title);
      const query = `
        query ($search: String) {
          Media (search: $search, type: ANIME) {
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

      const response = await fetch('https://graphql.anilist.co', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          // Only include Authorization header if token exists
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          query,
          variables: {
            search: title
          }
        })
      });

      const data = await response.json();
      console.log('[ANILIST SEARCH] 📡 AniList search response:', data);
      
      if (data?.data?.Media?.id) {
        const id = data.data.Media.id;
        console.log('[ANILIST SEARCH] ✅ Found AniList ID:', id);
        return id;
      }
      
      console.log('[ANILIST SEARCH] ❌ No results found for:', title);
      return null;
    } catch (error) {
      console.error('[ANILIST SEARCH] ❌ Error searching anime on AniList:', error);
      return null;
    }
  };

  // Add function to save progress to AniList
  const saveAniListProgress = async () => {
    try {
      console.log('[ANILIST SAVE] 🔄 Starting AniList progress save operation...');
      setIsSavingProgress(true);
      
      // Extract episode number from the episodeId if not directly available
      let episodeNumberToUse = episodeNumber;
      if (!episodeNumberToUse && params.episodeId) {
        console.log('[ANILIST SAVE] 🔍 Trying to extract episode number from episodeId:', params.episodeId);
        // Try to extract episode number from formats like "177709?ep=8"
        const epMatch = String(params.episodeId).match(/ep=(\d+)/);
        if (epMatch && epMatch[1]) {
          episodeNumberToUse = epMatch[1];
          console.log('[ANILIST SAVE] ✅ Extracted episode number:', episodeNumberToUse);
        }
      }
      
      // Check if we have the necessary data
      if (!episodeNumberToUse) {
        console.log('[ANILIST SAVE] ❌ Missing episode number - cannot save to AniList');
        setProgressSaveError('Missing episode info - cannot save to AniList');
        return false;
      }
      
      // Try to get the AniList token from SecureStore using the official storage key
      console.log('[ANILIST SAVE] 🔑 Looking for token with key:', STORAGE_KEY.AUTH_TOKEN);
      const token = await SecureStore.getItemAsync(STORAGE_KEY.AUTH_TOKEN);
      
      let authToken = token;
      
      if (!token) {
        console.log('[ANILIST SAVE] ❌ No AniList token found in SecureStore');
        
        // Fallback to AsyncStorage
        console.log('[ANILIST SAVE] 🔍 Trying fallback to AsyncStorage...');
        const fallbackToken = await AsyncStorage.getItem('anilist_token');
        
        if (fallbackToken) {
          console.log('[ANILIST SAVE] ✅ Found AniList token in AsyncStorage');
          authToken = fallbackToken;
        } else {
          console.log('[ANILIST SAVE] ❌ No AniList token found in AsyncStorage either');
          setProgressSaveError('You need to log in to AniList first');
          return false;
        }
      } else {
        console.log('[ANILIST SAVE] ✅ Found AniList token in SecureStore');
      }
      
      // Get the AniList ID for this anime
      let anilistId = params.anilistId;
      
      // If no AnilistId provided, try to extract it from episodeId
      if (!anilistId && params.episodeId) {
        console.log('[ANILIST SAVE] 🔍 Trying to extract AniList ID from episodeId:', params.episodeId);
        // Try to extract AniList ID from formats like "177709?ep=8"
        const idMatch = String(params.episodeId).match(/^(\d+)/);
        if (idMatch && idMatch[1]) {
          anilistId = idMatch[1];
          console.log('[ANILIST SAVE] ✅ Extracted AniList ID:', anilistId);
        }
      }
      
      // If still no AnilistId, search for it using the anime title
      if (!anilistId && animeTitle) {
        console.log('[ANILIST SAVE] 🔍 No AniList ID provided, searching by title:', animeTitle);
        const foundId = await searchAnimeOnAniList(animeTitle, authToken);
        
        if (foundId) {
          anilistId = foundId.toString();
          console.log('[ANILIST SAVE] ✅ Found AniList ID through search:', anilistId);
          
          // Cache the ID for future use
          if (params.malId) {
            const mappingKey = `anilist_mapping_${params.malId}`;
            await AsyncStorage.setItem(mappingKey, anilistId);
            console.log('[ANILIST SAVE] 💾 Cached AniList ID mapping for future use');
          }
        } else {
          console.log('[ANILIST SAVE] ❌ Could not find anime on AniList by title');
          setProgressSaveError('Could not find anime on AniList');
          setIsSavingProgress(false);
          return false;
        }
      }
      
      if (!anilistId) {
        console.log('[ANILIST SAVE] ❌ No AniList ID found for this anime');
        setProgressSaveError('Missing AniList ID for this anime');
        setIsSavingProgress(false);
        return false;
      }
      
      // Parse the episode number to an integer for AniList
      const episodeInt = parseInt(episodeNumberToUse, 10);
      if (isNaN(episodeInt)) {
        console.log('[ANILIST SAVE] ❌ Invalid episode number:', episodeNumberToUse);
        setProgressSaveError('Invalid episode number');
        setIsSavingProgress(false);
        return false;
      }
      
      console.log('[ANILIST SAVE] ✅ Using AniList ID:', anilistId);
      console.log('[ANILIST SAVE] 📊 Save data:', {
        anilistId: anilistId,
        episode: episodeInt,
        progress: `${((currentTime / duration) * 100).toFixed(2)}%`,
        animeTitle: animeTitle || 'Unknown'
      });
      
      // Perform the actual mutation to save progress to AniList
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
      
      console.log('[ANILIST SAVE] 📡 Sending mutation to AniList API...');
      const response = await fetch('https://graphql.anilist.co', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          query: mutation,
          variables: {
            mediaId: typeof anilistId === 'string' ? parseInt(anilistId, 10) : anilistId,
            progress: episodeInt
          }
        })
      });
      
      const result = await response.json();
      console.log('[ANILIST SAVE] 📥 AniList API response:', result);
      
      // Check for errors in the response
      if (result.errors) {
        console.error('[ANILIST SAVE] ❌ AniList API returned errors:', result.errors);
        setProgressSaveError(result.errors[0]?.message || 'Error saving to AniList');
        setIsSavingProgress(false);
        return false;
      }
      
      // Success! Progress saved to AniList
      console.log('[ANILIST SAVE] ✅ Successfully saved progress to AniList!');
      console.log('[ANILIST SAVE] 📝 Updated entry:', result.data?.SaveMediaListEntry);
      setIsSavingProgress(false);
      return true;
      
    } catch (error) {
      console.error('[ANILIST SAVE] ❌ Error saving progress:', error);
      setProgressSaveError('Error saving progress to AniList');
      setIsSavingProgress(false);
      return false;
    }
  };

  // Add function to cancel exiting
  const cancelExit = () => {
    logDebug('NAVIGATION', '✋ Exit cancelled by user, resuming playback');
    setShowExitConfirmModal(false);
    
    // Resume playback if it was playing before
    if (videoRef.current && isPlaying) {
      videoRef.current.playAsync().catch(err => 
        console.error("Error resuming video:", err)
      );
    }
  };

  // Add this after other function definitions
  // Create a simple playback status handler that won't cause errors
  const handlePlaybackStatusUpdate = (status: AVPlaybackStatus) => {
    // Basic functionality to keep the player working
    if (status.isLoaded) {
      // Log comprehensive playback status
      const now = Date.now();
      // Only log every second to avoid console spam
      if (now - lastProgressLogTime.current > progressLogInterval) {
        console.log(`[PLAYER_STATE] ⏱️ ${formatTime(status.positionMillis / 1000)}/${formatTime(status.durationMillis ? status.durationMillis / 1000 : 0)} | ` + 
          `Playing: ${status.isPlaying ? '▶️' : '⏸️'} | ` +
          `Buffering: ${status.isBuffering ? '⏳' : '✅'} | ` +
          `Buffer: ${status.playableDurationMillis ? formatTime(status.playableDurationMillis / 1000) : 'N/A'} | ` +
          `Rate: ${status.rate}x | ` +
          `URL: ${videoSourceState.uri.substring(0, 30)}...`);
        
        // If we're buffering, log more detailed information
        if (status.isBuffering) {
          console.log(`[BUFFER_DETAIL] 🔍 Position: ${formatTime(status.positionMillis / 1000)} | ` +
            `Buffered ahead: ${status.playableDurationMillis ? formatTime((status.playableDurationMillis - status.positionMillis) / 1000) : 'N/A'} | ` +
            `Buffering events: ${playbackStats.bufferingEvents} | ` +
            `HLS stream: ${isHLSStream ? 'Yes' : 'No'}`);
        }

        lastProgressLogTime.current = now;
      }

      // Update playback state
      const wasPlaying = wasPlayingRef.current;
      const isPlayingNow = status.isPlaying || false;
      wasPlayingRef.current = isPlayingNow;
      
      // Important: Only update state if it changed
      if (isPlaying !== isPlayingNow) {
        setIsPlaying(isPlayingNow);
      }
      
      // Handle play/pause state changes - this needs to be very simple to avoid loops
      if (wasPlaying !== isPlayingNow) {
        console.log(`[CONTROLS] 🎮 Playback state changed from ${wasPlaying ? 'playing' : 'paused'} to ${isPlayingNow ? 'playing' : 'paused'}`);
        
        // Simplified control logic that won't cause render loops
        if (!isPlayingNow && !showControls) {
          // When paused and controls are hidden, show them
          setShowControls(true);
        }
      }
      
      // Update position/duration
      if (status.positionMillis !== undefined) {
        setCurrentTime(status.positionMillis / 1000);
        progressAnimValue.setValue(status.positionMillis / 1000);
      }
      
      if (status.durationMillis !== undefined && status.durationMillis > 0) {
        // Set duration only if it hasn't been set yet
        if (duration === 0) {
          setDuration(status.durationMillis / 1000);
          console.log(`[PLAYER_LOADED] 📊 Duration detected: ${formatTime(status.durationMillis / 1000)} | HLS: ${isHLSStream ? 'Yes' : 'No'}`);
          
          // If we have a saved position and video just loaded, seek to that position
          if (savedStartPosition > 0 && currentTime < 1) {
            // Make sure saved position is not beyond the video duration
            const validPosition = Math.min(savedStartPosition, (status.durationMillis / 1000) - 5);
            
            logDebug('RESUME', `⏱️ Seeking to saved position: ${validPosition}s`);
            console.log(`[PLAYER DEBUG] 🔄 Attempting to seek to saved position: ${formatTime(validPosition)} / ${formatTime(status.durationMillis / 1000)}`);
            console.log(`[PLAYER DEBUG] 🔄 Stream type: ${isHLSStream ? 'HLS/m3u8' : 'Direct'}`);
            
            // Add additional delay for HLS streams which need more time to initialize
            const seekDelay = isHLSStream ? 1500 : 500; 
            console.log(`[PLAYER DEBUG] 🔄 Using seek delay: ${seekDelay}ms for ${isHLSStream ? 'HLS' : 'direct'} stream`);
            
            setTimeout(() => {
              if (videoRef.current) {
                if (isHLSStream) {
                  // Try the seek with better error handling for HLS streams
                  logDebug('RESUME', `⏱️ Performing HLS optimized seek to ${validPosition}s`);
                  
                  // For HLS streams, first ensure we're at a stable playback state
                  videoRef.current.pauseAsync().then(() => {
                    if (!videoRef.current) return;
                    
                    // Then attempt the seek
                    videoRef.current.setPositionAsync(validPosition * 1000).then(() => {
                      logDebug('RESUME', `✅ Successfully sought to position: ${validPosition}s`);
                      
                      // For HLS streams, we may need multiple attempts to resume playback
                      const resumePlayback = (attempt = 1, maxAttempts = 3) => {
                        if (!videoRef.current || attempt > maxAttempts) return;
                        
                        videoRef.current.playAsync().then(() => {
                          logDebug('RESUME', `✅ Successfully resumed from position after seek (attempt ${attempt})`);
                          setSavedStartPosition(0); // Clear saved position
                        }).catch(error => {
                          logDebug('RESUME', `❌ Resume attempt ${attempt} failed: ${error}`);
                          
                          // Try again with increasing delay
                          if (attempt < maxAttempts) {
                            setTimeout(() => resumePlayback(attempt + 1, maxAttempts), 300 * attempt);
                          }
                        });
                      };
                      
                      // Start resume attempts after a short delay to let the buffer fill
                      setTimeout(() => resumePlayback(), 100);
                    }).catch(e => {
                      logDebug('RESUME', `❌ Failed to seek: ${e.message}`);
                      console.log(`[PLAYER DEBUG] ❌ Failed to seek to position: ${e.message}`);
                    });
                  }).catch(e => {
                    logDebug('RESUME', `❌ Failed to pause before seek: ${e.message}`);
                  });
                } 
                else {
                  // Direct seeking for non-HLS streams
                  videoRef.current.setPositionAsync(validPosition * 1000).then(() => {
                    logDebug('RESUME', `✅ Successfully resumed from ${validPosition}s`);
                    console.log(`[PLAYER DEBUG] ✅ Successfully resumed from timestamp: ${formatTime(validPosition)}`);
                    // Clear saved position to avoid seeking again
                    setSavedStartPosition(0);
                  }).catch(e => {
                    logDebug('RESUME', `❌ Failed to seek to position: ${e.message}`);
                    console.log(`[PLAYER DEBUG] ❌ Failed to seek to position: ${e.message}`);
                  });
                }
              } else {
                console.log(`[PLAYER DEBUG] ❌ Cannot seek - videoRef is not available`);
              }
            }, seekDelay);
          }
        } else {
          setDuration(status.durationMillis / 1000);
        }
      }
      
      // Track buffering and update stats
      if ('playableDurationMillis' in status && status.playableDurationMillis) {
        const bufferedPos = status.playableDurationMillis / 1000;
        const previousBufferedPos = bufferedPosition;
        setBufferedPosition(bufferedPos);
        
        // Log when buffer increases significantly
        if (bufferedPos > previousBufferedPos + 2) {
          console.log(`[BUFFER_PROGRESS] 📈 Buffer increased: ${formatTime(previousBufferedPos)} → ${formatTime(bufferedPos)} (+${formatTime(bufferedPos - previousBufferedPos)})`);
          
          // Critical fix: Resume playback if we were previously playing but got paused by buffering
          // This handles the case where we have sufficient buffer but playback doesn't resume
          const bufferAhead = bufferedPos - (status.positionMillis / 1000);
          if (!status.isPlaying && !status.isBuffering && bufferAhead > 3 && playbackStats.playbackStarted) {
            console.log(`[PLAYBACK_RECOVERY] 🔄 Detected stalled playback with sufficient buffer (${formatTime(bufferAhead)} ahead). Forcing resume.`);
            if (videoRef.current) {
              videoRef.current.playAsync().catch(error => 
                console.error('[PLAYBACK_RECOVERY] ❌ Error resuming playback:', error)
              );
            }
          }
        }
        
        // If we're not playing yet, try to start playback as soon as enough buffer is available
        if (!playbackStats.playbackStarted && !status.isPlaying && bufferedPos > 3) {
          console.log(`[AUTO_START] 🚀 Sufficient buffer available (${formatTime(bufferedPos)}), attempting to start playback`);
          if (videoRef.current) {
            videoRef.current.playAsync().catch(error => 
              console.error('[BUFFER] Error starting playback:', error)
            );
            setPlaybackStats(prev => ({...prev, playbackStarted: true}));
          }
        }
      }
      
      // Track buffering events
      if (status.isBuffering !== isBuffering) {
        if (status.isBuffering) {
          // Started buffering
          setPlaybackStats(prev => ({...prev, bufferingEvents: prev.bufferingEvents + 1}));
          const bufferAhead = status.playableDurationMillis ? (status.playableDurationMillis - status.positionMillis) / 1000 : 'unknown';
          console.log(`[BUFFER_EVENT] ⏳ Buffering STARTED at position ${formatTime(status.positionMillis / 1000)}, buffer ahead: ${typeof bufferAhead === 'number' ? formatTime(bufferAhead) : bufferAhead}`);
        } else if (isBuffering) {
          // Stopped buffering - make sure we resume playback
          console.log(`[BUFFER_EVENT] ✅ Buffering ENDED at position ${formatTime(status.positionMillis / 1000)}, resuming playback`);
          
          // Critical fix: Force playback to resume when buffering ends
          // This should happen automatically but sometimes the player gets stuck
          if (!status.isPlaying && playbackStats.playbackStarted) {
            console.log(`[BUFFER_RECOVERY] 🔄 Forcing playback to resume after buffering ended`);
            if (videoRef.current) {
              // Small delay to ensure the player is ready
              setTimeout(() => {
                if (videoRef.current) {
                  videoRef.current.playAsync().catch(error => 
                    console.error('[BUFFER_RECOVERY] ❌ Error resuming playback:', error)
                  );
                }
              }, 100);
            }
          }
        }
      }
      
      // Update buffering state
      setIsBuffering(status.isBuffering || false);
      
      // Check for playback speed/rate changes
      if (status.rate !== undefined && Math.abs(status.rate - playbackSpeed) > 0.01) {
        console.log(`[PLAYBACK_RATE] 🔄 Rate changed: ${status.rate}x (requested: ${playbackSpeed}x)`);
      }
    } else if ('error' in status) {
      // Handle errors
      console.error(`[PLAYBACK_ERROR] ❌ ${status.error?.toString() || 'Unknown playback error'}`);
      handleError(status.error?.toString() || 'Unknown playback error');
    }
  };

  // Add a function to start the next episode countdown
  const startNextEpisodeCountdown = () => {
    // Stop any existing countdown
    if (countdownTimerRef) {
      clearInterval(countdownTimerRef);
    }
    
    // Check if next episode data exists
    getNextEpisodeData().then(nextEpData => {
      if (nextEpData) {
        setNextEpisodeData(nextEpData);
        setShowNextEpisodeCountdown(true);
        setNextEpisodeCountdown(60); // Reset to 60 seconds
        
        // Start the countdown timer
        const timer = setInterval(() => {
          setNextEpisodeCountdown(prev => {
            if (prev <= 1) {
              // When countdown reaches zero, clear the interval and proceed to next episode
              clearInterval(timer);
              if (preferences.markerSettings.autoPlayNextEpisode) {
                handleContinueToNextEpisode();
              }
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
        
        setCountdownTimerRef(timer);
      }
    });
  };

  // Add function to handle continue to next episode
  const handleContinueToNextEpisode = () => {
    if (nextEpisodeData) {
      logDebug('NEXT_EPISODE', '▶️ User continued to next episode');
      setShowNextEpisodeCountdown(false);
      
      // Show EpisodeSourcesModal with auto-select enabled
      setShowNextEpisodeModal(true);
    }
  };

  // Add function to cancel next episode countdown
  const cancelNextEpisodeCountdown = () => {
    logDebug('NEXT_EPISODE', '❌ User canceled next episode countdown');
    if (countdownTimerRef) {
      clearInterval(countdownTimerRef);
      setCountdownTimerRef(null);
    }
    setShowNextEpisodeCountdown(false);
  };

  // Update the handleExitPlayer function to show more detailed logs
  const handleExitPlayer = async (saveToAniList: boolean) => {
    console.log("\n====================================");
    console.log("🚪 EXITING PLAYER - SAVING PROGRESS");
    console.log("====================================");
    console.log(`Current Time: ${currentTime.toFixed(2)}s / ${duration.toFixed(2)}s (${((currentTime/duration)*100).toFixed(2)}%)`);
    console.log(`Anime: ${animeTitle} - ${episodeTitle || `Episode ${episodeNumber}`}`);
    console.log(`Episode ID: ${params.episodeId}`);
    console.log(`AniList ID: ${params.anilistId || 'Not provided directly'}`);
    
    // First save locally in all cases
    const localSaveResult = await saveLocalProgress();
    console.log(`📱 LOCAL SAVE: ${localSaveResult ? '✅ SUCCESS' : '❌ FAILED'}`);
    
    // Save to AniList if requested AND not in incognito mode
    if (saveToAniList && !isIncognito) {
      console.log(`🌐 Attempting to save progress to AniList...`);
      const anilistSaveResult = await saveAniListProgress();
      console.log(`🌐 ANILIST SAVE: ${anilistSaveResult ? '✅ SUCCESS' : '❌ FAILED'}`);
      
      if (anilistSaveResult) {
        // Show a brief success toast or notification
        // This UI element would need to be implemented
        console.log(`✅ Progress saved to AniList: ${animeTitle} - Episode ${episodeNumber}`);
      } else {
        console.log(`🌐 ANILIST SAVE ERROR: ${progressSaveError || 'Unknown error'}`);
      }
    } else if (isIncognito && saveToAniList) {
      console.log(`🕵️ Incognito mode active - skipping AniList save`);
    }
    
    // Hide exit confirmation modal
    setShowExitConfirmModal(false);
    
    console.log("✅ Save operations completed, exiting player now");
    // Navigate back using the router that is defined in the component
    router.back();
  };

  // Add toggle debug function
  const toggleDebugOverlay = () => {
    setShowDebug(prev => !prev);
  };

  // Add missing progress bar handler functions
  const handleProgressBarTap = (event: GestureResponderEvent) => {
    const { locationX } = event.nativeEvent;
    const progressWidth = event.currentTarget?.measure 
      ? event.currentTarget.measure((x, y, width) => {
          if (width && duration) {
            const newPosition = (locationX / width) * duration;
            videoRef.current?.setPositionAsync(newPosition * 1000);
          }
        })
      : null;
  };

  const handleProgressDragStart = (event: GestureResponderEvent) => {
    // Start progress dragging state
    setIsSeeking(true);
    // Show controls and prevent auto-hide during seeking
    showControlsWithTimeout();
  };

  const handleProgressDrag = (event: GestureResponderEvent) => {
    const { locationX } = event.nativeEvent;
    const progressWidth = event.currentTarget?.measure 
      ? event.currentTarget.measure((x, y, width) => {
          if (width && duration) {
            const newPosition = (locationX / width) * duration;
            setCurrentTime(newPosition);
          }
        })
      : null;
  };

  const handleProgressDragEnd = (event: GestureResponderEvent) => {
    const { locationX } = event.nativeEvent;
    const progressWidth = event.currentTarget?.measure 
      ? event.currentTarget.measure((x, y, width) => {
          if (width && duration) {
            const newPosition = (locationX / width) * duration;
            videoRef.current?.setPositionAsync(newPosition * 1000);
            // Resume auto-hide controls
            showControlsWithTimeout();
          }
        })
      : null;
    
    // End progress dragging state
    setIsSeeking(false);
  };

  // Add video end handler function
  const handleVideoEnd = () => {
    // Simply start the next episode countdown if we have next episode data
    if (nextEpisodeData) {
      startNextEpisodeCountdown();
    }
  };

  // Add missing DebugOverlay component
  const DebugOverlay = () => (
    <View style={styles.debugOverlay}>
      <Text style={styles.debugText}>Debug Info:</Text>
      <Text style={styles.debugText}>Video URL: {videoSourceState.uri.substring(0, 30)}...</Text>
      <Text style={styles.debugText}>Duration: {formatTime(duration)}</Text>
      <Text style={styles.debugText}>Current position: {formatTime(currentTime)}</Text>
      <Text style={styles.debugText}>Buffer position: {formatTime(bufferedPosition)}</Text>
      <Text style={styles.debugText}>Playing: {isPlaying ? 'Yes' : 'No'}</Text>
      <Text style={styles.debugText}>Buffering: {isBuffering ? 'Yes' : 'No'}</Text>
      <Text style={styles.debugText}>HLS Stream: {isHLSStream ? 'Yes' : 'No'}</Text>
      <Text style={styles.debugText}>Recovery attempts: {playbackStats.recoveryAttempts}</Text>
      <Text style={styles.debugText}>Buffer events: {playbackStats.bufferingEvents}</Text>
      <Text style={styles.debugText}>Scaling mode: {scalingMode}</Text>
      <Text style={styles.debugText}>Fullscreen: {isFullscreen ? 'Yes' : 'No'}</Text>
      <Text style={styles.debugText}>Orientation: {orientation}</Text>
      <Text style={styles.debugText}>AniList ID: {params.anilistId || 'Not available'}</Text>
      <Text style={styles.debugText}>Incognito: {isIncognito ? 'Yes' : 'No'}</Text>
      <Text style={styles.debugText}>Should ask before exit: {shouldAskBeforeExit ? 'Yes' : 'No'}</Text>
      <Text style={styles.debugText}>Exit modal visible: {showExitConfirmModal ? 'Yes' : 'No'}</Text>
      
      {/* Debug buttons row */}
      <View style={styles.debugButtonsRow}>
        <TouchableOpacity 
          style={styles.debugButton} 
          onPress={testExitModal}
        >
          <Text style={styles.debugButtonText}>Test Exit Modal</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.debugButton} 
          onPress={toggleDebugOverlay}
        >
          <Text style={styles.debugButtonText}>Close Debug</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // Add subtitlePanResponder definition
  const subtitlePanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        setIsDraggingSubtitle(true);
      },
      onPanResponderMove: (_, gestureState) => {
        const { dx, dy } = gestureState;
        
        // Update subtitle position based on drag
        subtitleAnimX.setValue(dx);
        subtitleAnimY.setValue(dy);
        
        // Schedule position update
        if (!subtitlePositionRef.current.updateScheduled) {
          requestAnimationFrame(() => {
            const newPosition = {
              x: subtitlePositionRef.current.x + dx,
              y: subtitlePositionRef.current.y + dy,
              updateScheduled: false
            };
            
            subtitlePositionRef.current = newPosition;
            setSubtitlePosition(newPosition);
            
            // Reset animated values
            subtitleAnimX.setValue(0);
            subtitleAnimY.setValue(0);
          });
          
          subtitlePositionRef.current.updateScheduled = true;
        }
      },
      onPanResponderRelease: () => {
        setIsDraggingSubtitle(false);
        
        // Save subtitle position to AsyncStorage
        AsyncStorage.setItem('subtitlePosition', JSON.stringify({
          x: subtitlePositionRef.current.x,
          y: subtitlePositionRef.current.y
        }));
      }
    })
  ).current;

  // Add getNextEpisodeData function
  const getNextEpisodeData = async (): Promise<any> => {
    try {
      // Check if we have next episode data already
      if (nextEpisodeData) {
        return nextEpisodeData;
      }
      
      // If we have episode ID but no next episode data yet
      if (params.episodeId) {
        // You might fetch next episode info from your API here
        // For now just returning null
        return null;
      }
      
      return null;
    } catch (error) {
      console.error('Error getting next episode data:', error);
      return null;
    }
  };

  // Declare missing state variables
  const [isSeeking, setIsSeeking] = useState(false);
  const [bufferedDuration, setBufferedDuration] = useState(0);

  // Implement auto-save for watch progress
  useEffect(() => {
    // Only set up auto-save if playback has started and we have enough data
    if (isPlaying && duration > 0 && currentTime > 0 && animeTitle && episodeNumber) {
      // Create a timer that saves progress every 30 seconds
      const autoSaveInterval = setInterval(async () => {
        // Only auto-save if we've watched at least 5% of the video
        if (currentTime > duration * 0.05) {
          logDebug('AUTO_SAVE', `⏱️ Auto-saving progress at ${formatTime(currentTime)} (${((currentTime/duration)*100).toFixed(1)}%)`);
          await saveLocalProgress();
        }
      }, 30000); // Save every 30 seconds
      
      // Clean up on unmount or if playback state changes
      return () => {
        clearInterval(autoSaveInterval);
      };
    }
  }, [isPlaying, currentTime, duration, animeTitle, episodeNumber]);

  // Add progress saving when pausing
  useEffect(() => {
    // Save progress immediately when user pauses after watching for a while
    if (!isPlaying && currentTime > 0 && duration > 0 && currentTime > duration * 0.05) {
      // Small delay to ensure the currentTime is accurate
      const saveTimeout = setTimeout(async () => {
        logDebug('PAUSE_SAVE', `💾 Saving progress after pause at ${formatTime(currentTime)} (${((currentTime/duration)*100).toFixed(1)}%)`);
        await saveLocalProgress();
      }, 500);
      
      return () => {
        clearTimeout(saveTimeout);
      };
    }
  }, [isPlaying]);

  // Add new state variables
  const [shouldAskBeforeExit, setShouldAskBeforeExit] = useState(true);
  const [dontAskAgain, setDontAskAgain] = useState(false);

  // Better back button handling with higher priority
  useEffect(() => {
    // Higher priority back button handler - more reliable than useFocusEffect
    console.log("[BACK_HANDLER] 📱 Setting up primary hardware back button handler");
    
    const handleBackButton = () => {
      console.log("[BACK_HANDLER] 🔄 Hardware back button pressed");
      
      // Check all conditions for showing the modal
      const isLoggedIn = Boolean(params.anilistId);
      const hasWatched = currentTime > 0;
      // Modified condition: Always show the modal if the user has watched something,
      // regardless of login status or shouldAskBeforeExit preference
      const shouldShowModal = !isIncognito && hasWatched;
      
      console.log("[BACK_HANDLER] 📊 Should show modal?", {
        isLoggedIn,
        isIncognito,
        shouldAskBeforeExit,
        hasWatched,
        shouldShowModal
      });
      
      if (shouldShowModal) {
        // Important: Force immediate state update to show modal
        console.log("[BACK_HANDLER] 🎯 Showing exit confirmation modal");
        setShowExitConfirmModal(true);
        return true; // Prevent default back behavior
      } else {
        // Just set exit flag and allow back navigation
        console.log("[BACK_HANDLER] 🚪 No modal needed, exiting");
        setIsExitingPlayer(true);
        return false; // Allow default back behavior
      }
    };
    
    // Register the back handler with high priority
    BackHandler.addEventListener('hardwareBackPress', handleBackButton);
    
    // Cleanup on unmount
    return () => {
      console.log("[BACK_HANDLER] 🧹 Cleaning up back button handler");
      BackHandler.removeEventListener('hardwareBackPress', handleBackButton);
    };
  }, [currentTime, params.anilistId, isIncognito, shouldAskBeforeExit]);

  // Load the "don't ask again" preference on mount - keep this for backward compatibility
  useEffect(() => {
    const loadExitPreference = async () => {
      try {
        const savedPreference = await AsyncStorage.getItem('player_exit_dont_ask_again');
        if (savedPreference === 'true') {
          setShouldAskBeforeExit(false);
        }
      } catch (error) {
        console.error('Error loading exit preference:', error);
      }
    };
    
    loadExitPreference();
  }, []);

  // Add an effect to log state changes for the exit modal
  useEffect(() => {
    console.log("[EXIT_MODAL] 🔍 Exit modal state changed:", { 
      showExitConfirmModal, 
      isIncognito,
      isSavingProgress,
      time: new Date().toISOString()
    });
  }, [showExitConfirmModal, isIncognito]);

  // Add a function to directly test the modal
  const testExitModal = () => {
    console.log("[TEST] 🧪 Manually testing exit confirmation modal");
    setShowExitConfirmModal(true);
  };

  // Add state for AniList user
  const [anilistUser, setAnilistUser] = useState<{
    userId: number;
    username: string;
    token: string;
    avatar?: string;
  } | null>(null);
  
  // Add loading state for AniList user
  const [isLoadingAnilistUser, setIsLoadingAnilistUser] = useState(true);
  
  // Add a function to fetch the AniList user data
  const fetchAnilistUserData = async () => {
    try {
      // Get the token from SecureStore
      const token = await SecureStore.getItemAsync(STORAGE_KEY.AUTH_TOKEN);
      
      // Also try to get the user data
      const userDataStr = await SecureStore.getItemAsync(STORAGE_KEY.USER_DATA);
      
      // If we have both token and user data, we can use AniList
      if (token && userDataStr) {
        const userData = JSON.parse(userDataStr);
        
        setAnilistUser({
          userId: userData.id,
          username: userData.name,
          token: token,
          avatar: userData.avatar?.large
        });
        
        console.log('[ANILIST USER] ✅ Found AniList user:', userData.name);
      } else {
        // Fallback to AsyncStorage for older versions
        const fallbackToken = await AsyncStorage.getItem('anilist_token');
        if (fallbackToken) {
          // We have a token but no user data, just set the token
          setAnilistUser({
            userId: 0, // placeholder
            username: 'AniList User',
            token: fallbackToken
          });
          console.log('[ANILIST USER] ✅ Found AniList token in AsyncStorage');
        } else {
          console.log('[ANILIST USER] ❌ No AniList user found');
          setAnilistUser(null);
        }
      }
    } catch (error) {
      console.error('[ANILIST USER] ❌ Error fetching AniList user:', error);
      setAnilistUser(null);
    } finally {
      setIsLoadingAnilistUser(false);
    }
  };

  // Add useEffect to fetch AniList user on component mount
  useEffect(() => {
    fetchAnilistUserData();
  }, []);

  // Add effect to handle control visibility when playback state changes
  useEffect(() => {
    if (isPlaying) {
      // When transitioning to playing state, start the hide timer
      if (showControls) {
        // Clear any existing timer and set new one
        if (controlsTimerRef.current) {
          clearTimeout(controlsTimerRef.current);
        }
        controlsTimerRef.current = setTimeout(() => {
          hideControls();
        }, 10000);
      }
    } else {
      // When paused, always show controls
      if (!showControls) {
        showControlsWithTimeout();
      }
      // Clear any hide timer when paused
      if (controlsTimerRef.current) {
        clearTimeout(controlsTimerRef.current);
        controlsTimerRef.current = null;
      }
    }
    
    // Return cleanup function
    return () => {
      if (controlsTimerRef.current) {
        clearTimeout(controlsTimerRef.current);
        controlsTimerRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, showControls]);

  // Add effect to ensure controls are always visible when video is paused
  useEffect(() => {
    if (!isPlaying && !showControls) {
      console.log('[CONTROLS] 🎮 Video paused but controls not visible - showing controls');
      showControlsWithTimeout();
      
      // Clear any hide timer when paused to prevent controls from disappearing
      if (controlsTimerRef.current) {
        clearTimeout(controlsTimerRef.current);
        controlsTimerRef.current = null;
      }
    }
  }, [isPlaying, showControls, showControlsWithTimeout]);

  // Add a ref to track previous play state to avoid render loops
  const wasPlayingRef = useRef(false);

  // Enhanced video component with modern UI
  return (
    <View style={[
      styles.container, 
      isLandscape ? styles.landscapeContainer : styles.portraitContainer
    ]}>
      <StatusBar hidden={isFullscreen || isLandscape} />
      
      {/* Video Player with Gesture Support */}
      <Pressable 
        style={[
          styles.videoContainer,
          isLandscape ? styles.landscapeVideoContainer : styles.portraitVideoContainer
        ]}
        onPress={handleVideoTap}
        // Only apply pan handlers when not dragging subtitles
        {...(isDraggingSubtitle ? {} : panResponder.panHandlers)}
        // Prevent interactions when dragging subtitles
        pointerEvents={isDraggingSubtitle ? 'none' : 'auto'}
      >
        {videoSourceState.uri ? (
          <Video
            ref={videoRef}
            source={{ 
              uri: videoSourceState.uri,
              headers: videoSourceState.headers 
            }}
            style={[styles.video, { opacity: brightness }]}
            resizeMode={
              scalingMode === 'contain' ? ResizeMode.CONTAIN :
              scalingMode === 'cover' ? ResizeMode.COVER :
              ResizeMode.STRETCH
            }
            shouldPlay={isPlaying}
            isLooping={false}
            useNativeControls={false}
            onError={(error) => {
              console.error(`[VIDEO_ERROR] ❌ ${error}`);
              handleError(`Video error: ${error}`);
            }}
            onLoadStart={() => console.log(`[VIDEO_LIFECYCLE] 🔄 Load started`)}
            onLoad={(status) => console.log(`[VIDEO_LIFECYCLE] ✅ Load complete: ${JSON.stringify(status)}`)}
            onReadyForDisplay={() => console.log(`[VIDEO_LIFECYCLE] 🎬 Ready for display`)}
            rate={playbackSpeed}
            volume={volume}
            progressUpdateIntervalMillis={100} // Faster updates for more responsive buffering detection
            onPlaybackStatusUpdate={(status) => {
              handlePlaybackStatusUpdate(status);
              
              // Check if video has reached the end
              if (status.isLoaded && 
                status.positionMillis > 0 && 
                status.durationMillis && 
                status.positionMillis >= status.durationMillis - 500) {
                handleVideoEnd();
              }
            }}
          />
        ) : (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#FF6B00" />
            <Text style={styles.loadingText}>Loading video...</Text>
          </View>
        )}

        {/* Error Display */}
        {error && (
          <View style={styles.errorContainer}>
            <FontAwesome5 name="exclamation-circle" size={24} color="#FF6B00" style={styles.errorIcon} />
            <Text style={styles.errorText}>{error.message}</Text>
            <TouchableOpacity 
              style={styles.retryButton}
              onPress={() => {
                setError(null);
                loadPlayerData();
              }}
            >
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.goBackButton}
              onPress={() => router.back()}
            >
              <Text style={styles.goBackButtonText}>Go Back</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Buffering Indicator */}
        {isBuffering && isPlaying && (
          <View style={styles.bufferingContainer}>
            <ActivityIndicator size="large" color="#FFFFFF" />
          </View>
        )}

        {/* Seek Indicators (Double Tap) */}
        <View style={styles.seekIndicatorsContainer}>
          <View style={styles.seekIndicatorLeft}>
            {/* Will be shown when activated */}
          </View>
          <View style={styles.seekIndicatorRight}>
            {/* Will be shown when activated */}
          </View>
        </View>

        {/* Modern Controls Overlay */}
        {showControls && (
          <Animated.View 
            style={[
              styles.controlsOverlay,
              { 
                opacity: fadeAnim,
                transform: [
                  { scale: controlsScale }
                ],
                paddingTop: insets.top,
                paddingBottom: insets.bottom,
                paddingLeft: insets.left,
                paddingRight: insets.right,
                backfaceVisibility: 'hidden', // Add hardware acceleration
                willChange: 'transform' // Add hardware acceleration hint
              }
            ]}
          >
            {/* Top Control Bar */}
            <BlurView intensity={50} tint="dark" style={styles.topControlBar}>
              <ControlButton
                onPress={() => {
                  console.log("[UI_BACK_BUTTON] 🔍 Back button tapped");
                  
                  // Check same conditions as the hardware back button
                  const isLoggedIn = Boolean(params.anilistId);
                  const hasWatched = currentTime > 0;
                  // Modified condition: Always show the modal if the user has watched something,
                  // regardless of login status or shouldAskBeforeExit preference
                  const shouldShowModal = !isIncognito && hasWatched;
                  
                  console.log("[UI_BACK_BUTTON] 📊 Conditions:", {
                    isLoggedIn,
                    isIncognito,
                    shouldAskBeforeExit,
                    hasWatched,
                    shouldShowModal
                  });
                  
                  if (shouldShowModal) {
                    console.log("[UI_BACK_BUTTON] ✅ Showing exit confirmation modal");
                    setShowExitConfirmModal(true);
                  } else {
                    console.log("[UI_BACK_BUTTON] ➡️ Not showing modal, exiting directly");
                    setIsExitingPlayer(true);
                    router.back();
                  }
                }}
                icon="arrow-back"
                style={styles.backButton}
              />
              
              <View style={styles.titleContainer}>
                {animeTitle && (
                  <Text style={styles.animeTitle} numberOfLines={1}>
                    {animeTitle}
                  </Text>
                )}
                <Text style={styles.episodeTitle} numberOfLines={1}>
                  {episodeTitle ? episodeTitle : (episodeNumber ? `Episode ${episodeNumber}` : '')}
                </Text>
              </View>
              
              <View style={styles.topRightButtons}>
                <ControlButton
                  onPress={toggleSubtitles}
                  icon={preferences.subtitlesEnabled ? "text" : "text-outline"}
                  style={styles.iconButton}
                />
              </View>
            </BlurView>

            {/* Center Play/Pause Button */}
            <View style={styles.centerControlsContainer}>
              <ControlButton
                onPress={() => handleSeekRelative(-10)}
                icon="arrow-back-circle"
                style={styles.seekBackButton}
              >
                <Text style={styles.seekButtonText}>10</Text>
              </ControlButton>
              
              <ControlButton
                onPress={() => {
                  if (videoRef.current) {
                    if (isPlaying) {
                      // Simply pause and let the status update handle showing controls
                      videoRef.current.pauseAsync();
                    } else {
                      // Simply play and let the status update handle controls visibility
                      videoRef.current.playAsync();
                    }
                  }
                }}
                icon={isPlaying ? "pause" : "play"}
                style={styles.centerPlayButton}
              />
              
              <ControlButton
                onPress={() => handleSeekRelative(10)}
                icon="arrow-forward-circle"
                style={styles.seekForwardButton}
              >
                <Text style={styles.seekButtonText}>10</Text>
              </ControlButton>
            </View>

            {/* Bottom Controls */}
            <BlurView intensity={50} tint="dark" style={styles.bottomControls}>
              {/* Progress Bar */}
              <View 
                style={styles.progressContainer}
                onLayout={(event) => {
                  const { width } = event.nativeEvent.layout;
                  setProgressContainerWidth(width);
                }}
              >
                {/* Background */}
                <View style={styles.progressBackground} />
                
                {/* Buffered Progress */}
                <View 
                  style={[
                    styles.bufferBar,
                    { width: `${(bufferedPosition / duration) * 100}%` }
                  ]}
                />
                
                {/* Intro Marker */}
                {introOutroTimestamps.introStart > 0 && 
                  introOutroTimestamps.introEnd > 0 && 
                  preferences.markerSettings?.showMarkers && (
                  <View 
                    style={[
                      styles.introMarker,
                      { 
                        width: ((progressContainerWidth - 30) * ((introOutroTimestamps.introEnd - introOutroTimestamps.introStart) / duration)),
                        left: 15 + ((progressContainerWidth - 30) * (introOutroTimestamps.introStart / duration)),
                        backgroundColor: colorScheme === 'dark' 
                          ? 'rgba(255, 213, 0, 0.35)' 
                          : 'rgba(255, 213, 0, 0.5)'
                      }
                    ]}
                  />
                )}
                
                {/* Outro Marker */}
                {introOutroTimestamps.outroStart > 0 && 
                  introOutroTimestamps.outroEnd > 0 && 
                  preferences.markerSettings?.showMarkers && (
                  <View 
                    style={[
                      styles.outroMarker,
                      { 
                        width: ((progressContainerWidth - 30) * ((introOutroTimestamps.outroEnd - introOutroTimestamps.outroStart) / duration)),
                        left: 15 + ((progressContainerWidth - 30) * (introOutroTimestamps.outroStart / duration)),
                        backgroundColor: colorScheme === 'dark' 
                          ? 'rgba(255, 107, 0, 0.35)' 
                          : 'rgba(255, 107, 0, 0.5)'
                      }
                    ]}
                  />
                )}
                
                {/* Playback Progress */}
                <View 
                  style={[
                    styles.progressBar,
                    { 
                      width: isScrubbing 
                        ? `${(scrubbingPosition / duration) * 100}%`
                        : `${(currentTime / duration) * 100}%` 
                    }
                  ]}
                />
                
                {/* Progress Knob */}
                <View 
                  style={[
                    styles.progressKnob,
                    { 
                      left: 15 + ((progressContainerWidth - 30) * (isScrubbing ? scrubbingPosition : currentTime) / duration),
                      transform: [{ scale: isKnobPressed || isScrubbing ? 1.2 : 1 }],
                      shadowOpacity: isKnobPressed || isScrubbing ? 0.8 : 0.5
                    }
                  ]}
                />
                
                {/* Interactive tap/drag area - covers the entire progress bar */}
                <Pressable
                  style={styles.progressTapArea}
                  onPress={handleProgressBarTap}
                  onTouchStart={handleProgressDragStart}
                  onTouchMove={handleProgressDrag}
                  onTouchEnd={handleProgressDragEnd}
                />
              </View>

              {/* Bottom Bar */}
              <View style={styles.bottomBar}>
                {/* Time Display */}
                <Text style={styles.timeText}>
                  {isScrubbing 
                    ? `${formatTime(scrubbingPosition)} / ${formatTime(duration)}`
                    : `${formatTime(currentTime)} / ${formatTime(duration)}`
                  }
                </Text>
                
                {/* Right Controls */}
                <View style={styles.rightControls}>
                  <ControlButton
                    onPress={() => setShowSettings(true)}
                    icon="settings-outline"
                    style={styles.controlButton}
                  />
                  
                  <ControlButton
                    onPress={() => {
                      const nextMode = 
                        scalingMode === 'contain' ? 'cover' :
                        scalingMode === 'cover' ? 'stretch' : 'contain';
                      setScalingMode(nextMode);
                    }}
                    icon={
                      scalingMode === 'contain' ? 'resize' :
                      scalingMode === 'cover' ? 'contract' : 'expand'
                    }
                    style={styles.controlButton}
                  />
                  
                  <ControlButton
                    onPress={() => setShowDebug(prev => !prev)}
                    icon="bug-outline"
                    style={styles.controlButton}
                  />
                </View>
              </View>
            </BlurView>
          </Animated.View>
        )}
        
        {/* Playback Speed Selector */}
        {showSpeedSelector && (
          <BlurView intensity={60} tint="dark" style={styles.speedSelector}>
            {[0.5, 0.75, 1, 1.25, 1.5, 2].map(speed => (
              <ControlButton
                key={speed}
                onPress={() => {
                  setPlaybackSpeed(speed);
                  if (videoRef.current) {
                    videoRef.current.setRateAsync(speed, true);
                  }
                  setShowSpeedSelector(false);
                }}
                style={[
                  styles.speedOption,
                  playbackSpeed === speed && styles.speedOptionSelected
                ]}
              >
                <Text style={[
                  styles.speedOptionText,
                  playbackSpeed === speed && styles.speedOptionTextSelected
                ]}>
                  {speed}x
                </Text>
              </ControlButton>
            ))}
          </BlurView>
        )}
      </Pressable>
      
      {/* Caption toggle feedback */}
      {showCaptionFeedback && (
        <View style={styles.captionFeedback}>
          <ControlButton
            onPress={toggleSubtitles}
            icon={preferences.subtitlesEnabled ? "text" : "text-outline"}
            style={styles.iconButton}
          />
          <Text style={styles.captionFeedbackText}>{captionFeedbackText}</Text>
        </View>
      )}
      
      {/* Timestamp error message */}
      {showTimestampError && (
        <TouchableOpacity 
          style={styles.timestampError}
          onPress={() => setShowDebug(true)}
        >
          <ControlButton
            onPress={() => setShowDebug(true)}
            icon="error-outline"
            style={styles.iconButton}
          />
          <Text style={styles.timestampErrorText}>Tap to show debug info</Text>
        </TouchableOpacity>
      )}
      
      {/* Subtitle Display - Improved positioning and styling */}
      {currentSubtitle && (
        <Animated.View 
          style={[
            styles.subtitleOuterContainer,
            { 
              bottom: isDraggingSubtitle ? undefined : (isFullscreen ? 150 : (Platform.OS === 'ios' ? 120 : 100)),
              position: 'absolute',
              left: 0,
              right: 0,
              transform: [
                { translateX: subtitleAnimX }, // Use animated value instead of state
                { translateY: subtitleAnimY }  // Use animated value instead of state
              ],
              zIndex: 9999,
              // Add hardware acceleration hints
              backfaceVisibility: 'hidden',
            }
          ]}
          {...subtitlePanResponder.panHandlers}
          onStartShouldSetResponder={() => true}
          onResponderGrant={(evt) => evt.stopPropagation()}
        >
          <BlurView 
            intensity={40 * preferences.subtitleStyle.backgroundOpacity} 
            tint="dark" 
            style={[
              styles.subtitleContainer,
              isDraggingSubtitle && { borderWidth: 1, borderColor: '#02A9FF' }
            ]}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', pointerEvents: 'box-none' }}>
              <Text style={[
                styles.subtitleText, 
                { 
                  fontSize: preferences.subtitleStyle.fontSize,
                  color: preferences.subtitleStyle.textColor,
                  fontWeight: preferences.subtitleStyle.boldText ? 'bold' : 'normal'
                }
              ]}>
              {currentSubtitle}
              </Text>
              {(subtitlePosition.x !== 0 || subtitlePosition.y !== 0) && (
                <ControlButton
                  onPress={(e) => {
                    // Prevent event from bubbling up
                    e.stopPropagation();
                    resetSubtitlePosition();
                  }}
                  icon="refresh"
                  style={styles.resetSubtitleButton}
                />
              )}
            </View>
          </BlurView>
        </Animated.View>
      )}

      {/* Subtitle Error Message */}
      {subtitleError && preferences.subtitlesEnabled && (
        <Animated.View 
          style={[
            styles.subtitleErrorContainer,
            {
              opacity: subtitleError ? 1 : 0,
              transform: [{
                translateY: subtitleError ? 0 : 20
              }]
            }
          ]}
        >
          <BlurView intensity={80} tint="dark" style={styles.subtitleErrorContent}>
            <FontAwesome5 name="exclamation-triangle" size={14} color="#FFCC00" />
            <Text style={styles.subtitleErrorText}>{subtitleError}</Text>
          </BlurView>
        </Animated.View>
      )}

      {/* Modals */}
      {showSettings && (
        <SettingsModal
          onClose={() => setShowSettings(false)}
          subtitles={subtitles}
          selectedLanguage={selectedLanguage}
          setSelectedLanguage={setSelectedLanguage}
          preferences={preferences}
          setPreferences={setPreferences}
          playbackSpeed={playbackSpeed}
          setPlaybackSpeed={setPlaybackSpeed}
          scalingMode={scalingMode}
          setScalingMode={(mode: string) => setScalingMode(mode as ScalingMode)}
          autoRotateEnabled={autoRotateEnabled}
          setAutoRotateEnabled={setAutoRotateEnabled}
          videoRef={videoRef}
        />
      )}
      {showDebug && <DebugOverlay />}

      {/* Skip Intro Button */}
      {showSkipIntroButton && preferences.markerSettings?.showMarkers && (
        <ControlButton
          onPress={() => {
            if (videoRef.current && introOutroTimestamps.introEnd > 0) {
              logDebug('INTRO', `⏩ Skipping intro to ${formatTime(introOutroTimestamps.introEnd)}`);
              setIsBuffering(true);
              
              // Check if we're dealing with an HLS stream
              const isHLS = videoSourceState.uri.includes('.m3u8');
              
              videoRef.current.setPositionAsync(introOutroTimestamps.introEnd * 1000)
                .then(() => {
                  // Force playback to resume after seeking completes for HLS streams
                  if (isPlaying || isHLS) {
                    setTimeout(() => {
                      if (videoRef.current) {
                        videoRef.current.playAsync().catch(e => 
                          console.error('[INTRO SKIP] Error resuming playback:', e)
                        );
                      }
                    }, 300);
                  }
                });
              
              setShowSkipIntroButton(false);
            }
          }}
          style={styles.skipIntroButton}
        >
          <BlurView intensity={50} tint="dark" style={styles.skipButtonInner}>
            <Text style={styles.skipButtonText}>Skip Intro</Text>
          </BlurView>
        </ControlButton>
      )}

      {/* Skip Outro Button */}
      {showSkipOutroButton && preferences.markerSettings?.showMarkers && (
        <ControlButton
          onPress={() => {
            logDebug('OUTRO', '⏩ Skipping outro');
            handleVideoEnd();
            setShowSkipOutroButton(false);
          }}
          style={styles.skipOutroButton}
        >
          <BlurView intensity={50} tint="dark" style={styles.skipButtonInner}>
            <Text style={styles.skipButtonText}>Skip to Next Episode</Text>
          </BlurView>
        </ControlButton>
      )}

      {/* Add Next Episode Modal */}
      <EpisodeSourcesModal
        visible={showNextEpisodeModal}
        episodeId={nextEpisodeData?.episodeId || ''}
        onClose={() => {
          setShowNextEpisodeModal(false);
          router.back();
        }}
        onSelectSource={(url, headers, episodeId, episodeNumber, subtitles, timings) => {
          setShowNextEpisodeModal(false);
          
          // Store the new episode data and navigate to it
          if (episodeId && url) {
            const newDataKey = `${nextEpisodeData?.episodeId.split('?')[0]}-${episodeNumber}`;
            
            // Store the player data for the next episode
            AsyncStorage.setItem(`player_data_${newDataKey}`, JSON.stringify({
              sourceUrl: url,
              headers: headers,
              episodeTitle: `Episode ${episodeNumber}`,
              episodeNumber: episodeNumber,
              animeTitle: nextEpisodeData?.animeTitle || animeTitle,
              anilistId: params.anilistId ? String(params.anilistId) : undefined, // Add the anilistId from params
              subtitles: subtitles || [],
              introStart: timings?.intro?.start,
              introEnd: timings?.intro?.end,
              outroStart: timings?.outro?.start,
              outroEnd: timings?.outro?.end
            })).then(() => {
              // Navigate to the player with the new data key
              router.push({
                pathname: '/videoplayer/PlayerScreen',
                params: { 
                  dataKey: newDataKey,
                  malId: nextEpisodeData?.malId,
                  anilistId: params.anilistId ? String(params.anilistId) : undefined // Add the anilistId to navigation params
                }
              });
            });
          }
        }}
        preferredType="auto"
        animeTitle={nextEpisodeData?.animeTitle || animeTitle}
        malId={nextEpisodeData?.malId}
        autoSelectSource={true}
      />

      {/* Next Episode Countdown Popup */}
      {showNextEpisodeCountdown && nextEpisodeData && (
        <BlurView intensity={70} tint="dark" style={[
          styles.nextEpisodeCountdown,
          showSkipOutroButton && styles.nextEpisodeCountdownWithSkip
        ]}>
          <View style={styles.nextEpisodeContent}>
            <View style={styles.nextEpisodeHeader}>
              <Text style={styles.nextEpisodeTitle}>Up Next:</Text>
              <Text style={styles.countdownTimer}>{nextEpisodeCountdown}s</Text>
            </View>
            <Text style={styles.nextEpisodeInfo}>
              {nextEpisodeData.animeTitle || animeTitle} - Episode {parseInt(episodeNumber || '0') + 1}
            </Text>
            <View style={styles.nextEpisodeButtons}>
              <ControlButton
                onPress={cancelNextEpisodeCountdown}
                style={styles.cancelButton}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </ControlButton>
              <ControlButton
                onPress={handleContinueToNextEpisode}
                style={styles.continueButton}
              >
                <Text style={styles.continueButtonText}>Continue</Text>
              </ControlButton>
            </View>
          </View>
        </BlurView>
      )}

      {/* Save Progress Modal */}
      <SaveProgressModal
        isVisible={showExitConfirmModal}
        onCancel={() => {
          console.log("[EXIT_MODAL] ❌ User clicked 'No' - exiting without saving");
          setShowExitConfirmModal(false);
          // Navigate back to exit the player
          router.back();
        }}
        onSave={(dontAskAgain) => {
          // Save "don't ask again" preference
          if (dontAskAgain) {
            AsyncStorage.setItem('progress_save_dont_ask_again', 'true');
          }
          
          // Save progress locally and exit
          handleExitPlayer(false);
        }}
        onSaveToAniList={(dontAskAgain) => {
          // Save "don't ask again" preference
          if (dontAskAgain) {
            AsyncStorage.setItem('progress_save_dont_ask_again', 'true');
          }
          
          // Save to AniList and exit
          handleExitPlayer(true);
        }}
        anilistId={params.anilistId ? String(params.anilistId) : undefined}
        animeName={animeTitle}
        episodeNumber={episodeNumber}
        currentTime={currentTime}
        duration={duration}
        isSavingProgress={isSavingProgress}
        anilistUser={anilistUser || undefined}
      />
    </View>
  );
};

export default PlayerScreen; 