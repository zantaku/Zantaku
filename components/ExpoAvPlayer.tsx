import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions, StatusBar, Alert, DeviceEventEmitter, ScrollView } from 'react-native';
import { Video, AVPlaybackStatus, ResizeMode } from 'expo-av';
import { useRouter, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FontAwesome5 } from '@expo/vector-icons';
import { convertASSToVTT, parseVTTToCues } from '../utils/subtitleConverter';
import usePictureInPicture from '../hooks/usePictureInPicture';

const { width, height } = Dimensions.get('window');

interface ZencloudData {
  file_code: string;
  m3u8_url: string;
  original_filename: string;
  subtitles: {
    url: string;
    language: string;
    language_name: string;
    format: string;
    is_default: boolean;
  }[];
  chapters: {
    id: string;
    title: string;
    start_time: number;
    end_time: number;
  }[];
  fonts: {
    name: string;
    url: string;
  }[];
  token: string;
  token_expires: string;
  client_ip: string;
  token_ip_bound: boolean;
}

interface VideoData {
  source: string;
  headers: Record<string, string>;
  episodeId: string;
  episodeNumber: number;
  subtitles: {
    url: string;
    lang: string;
  }[];
  timings: {
    intro?: { start: number; end: number };
    outro?: { start: number; end: number };
  } | null;
  anilistId: string;
  animeTitle: string;
  provider: string;
  audioType: 'sub' | 'dub';
  zencloudData?: ZencloudData;
}

interface SubtitleCue {
  startTime: number;
  endTime: number;
  text: string;
}

interface ExpoAvPlayerProps {
  onError?: (error: string) => void;
  isPipSupported?: boolean;
  isInPipMode?: boolean;
}

export default function ExpoAvPlayer({ onError, isPipSupported: propIsPipSupported, isInPipMode: propIsInPipMode }: ExpoAvPlayerProps) {
  const router = useRouter();
  const params = useLocalSearchParams();
  const videoRef = useRef<Video>(null);
  
  // Picture-in-Picture - use props if provided, otherwise fallback to hook
  const { isSupported: hookIsPipSupported, isInPipMode: hookIsInPipMode, enterPipMode } = usePictureInPicture();
  const isPipSupported = propIsPipSupported ?? hookIsPipSupported;
  const isInPipMode = propIsInPipMode ?? hookIsInPipMode;
  
  // Video state
  const [videoData, setVideoData] = useState<VideoData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Subtitle state
  const [subtitles, setSubtitles] = useState<SubtitleCue[]>([]);
  const [currentSubtitle, setCurrentSubtitle] = useState<string>('');
  const [subtitlesEnabled, setSubtitlesEnabled] = useState(true);
  
  // Precompute start times for binary search
  const startsRef = useRef<number[]>([]);
  useEffect(() => {
    startsRef.current = subtitles.map(c => c.startTime);
  }, [subtitles]);
  
  // Chapter state
  const [showChapters, setShowChapters] = useState(false);
  
  // Settings state
  const [showSettings, setShowSettings] = useState(false);
  const [selectedSubtitle, setSelectedSubtitle] = useState(0);
  const [selectedAudioTrack, setSelectedAudioTrack] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [subtitleSize, setSubtitleSize] = useState(16);
  const [subtitleOpacity, setSubtitleOpacity] = useState(1.0);
  const [subtitlePosition, setSubtitlePosition] = useState(0.8);
  
  // Chapter menu state
  const [showChapterMenu, setShowChapterMenu] = useState(false);
  const [chapterMenuPosition, setChapterMenuPosition] = useState({ x: 0, y: 0 });
  
  // Progress bar ref for accurate width measurement
  const progressBarRef = useRef<View>(null);
  const [progressBarWidth, setProgressBarWidth] = useState(width * 0.6);
  const lastSeekTime = useRef(0);

  // Format time for display
  const formatTime = useCallback((seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  }, []);

  // Parse ASS time format (H:MM:SS.CC)
  const parseASSTime = useCallback((timeStr: string): number => {
    const parts = timeStr.split(':');
    if (parts.length !== 3) return NaN;
    
    const hours = parseInt(parts[0]) || 0;
    const minutes = parseInt(parts[1]) || 0;
    const secondsParts = parts[2].split('.');
    const seconds = parseInt(secondsParts[0]) || 0;
    const centiseconds = parseInt(secondsParts[1] || '0') || 0;
    
    return hours * 3600 + minutes * 60 + seconds + centiseconds / 100;
  }, []);

  // Parse ASS dialogue line
  const parseASSDialogue = useCallback((line: string): SubtitleCue | null => {
    // ASS dialogue format: Dialogue: Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text
    const parts = line.split(',');
    if (parts.length < 10) return null;
    
    const startTime = parseASSTime(parts[1]);
    const endTime = parseASSTime(parts[2]);
    const text = parts.slice(9).join(',').replace(/\\N/g, '\n').replace(/\{[^}]*\}/g, ''); // Remove ASS formatting codes
    
    if (isNaN(startTime) || isNaN(endTime) || startTime >= endTime) return null;
    
    return {
      startTime,
      endTime,
      text: text.trim()
    };
  }, [parseASSTime]);

  // Fallback ASS parser (original implementation)
  const parseASSSubtitlesFallback = useCallback((text: string): SubtitleCue[] => {
    const cues: SubtitleCue[] = [];
    const lines = text.split('\n');
    let inEventsSection = false;
    
    console.log('[EXPO-AV-PLAYER] 🎞️ ASS Fallback Parser - Total lines:', lines.length);
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Check if we're in the [Events] section
      if (line === '[Events]') {
        inEventsSection = true;
        console.log('[EXPO-AV-PLAYER] 🎞️ ASS Fallback Parser - Found Events section at line', i + 1);
        continue;
      }
      
      // Skip other sections
      if (line.startsWith('[') && line !== '[Events]') {
        inEventsSection = false;
        continue;
      }
      
      // Parse dialogue lines in Events section
      if (inEventsSection && line.startsWith('Dialogue:')) {
        try {
          const dialogue = parseASSDialogue(line);
          if (dialogue) {
            cues.push(dialogue);
            console.log('[EXPO-AV-PLAYER] 🎞️ ASS Fallback Cue parsed:', {
              start: dialogue.startTime.toFixed(2) + 's',
              end: dialogue.endTime.toFixed(2) + 's',
              text: dialogue.text.substring(0, 50) + (dialogue.text.length > 50 ? '...' : '')
            });
          }
        } catch (error) {
          console.warn('[EXPO-AV-PLAYER] ⚠️ Failed to parse ASS dialogue line:', line.substring(0, 100), error);
        }
      }
    }
    
    console.log('[EXPO-AV-PLAYER] ✅ ASS Fallback Parser - Parsed', cues.length, 'cues');
    return cues;
  }, [parseASSDialogue]);

  // ASS subtitle parser - now using the improved converter utility
  const parseASSSubtitles = useCallback((text: string): SubtitleCue[] => {
    console.log('[EXPO-AV-PLAYER] 🎞️ ASS Parser - Using improved converter utility');
    
    try {
      // First convert ASS to VTT format for better parsing
      const vttContent = convertASSToVTT(text);
      console.log('[EXPO-AV-PLAYER] 🔄 ASS converted to VTT successfully');
      
      // Then parse the VTT content to get cues
      const cues = parseVTTToCues(vttContent);
      console.log('[EXPO-AV-PLAYER] 🎞️ ASS Parser - Parsed', cues.length, 'cues via VTT conversion');
      
      return cues;
    } catch (error) {
      console.error('[EXPO-AV-PLAYER] ❌ ASS Parser - Failed to convert/parse ASS subtitles:', error);
      
      // Fallback to original parsing if converter fails
      return parseASSSubtitlesFallback(text);
    }
  }, [parseASSSubtitlesFallback]);

  // VTT subtitle parser
  const parseVTTSubtitles = useCallback((text: string): SubtitleCue[] => {
    const cues: SubtitleCue[] = [];
    const lines = text.split('\n');
    let i = 0;
    
    console.log('[EXPO-AV-PLAYER] 🎞️ VTT Parser - Total lines:', lines.length);
    
    while (i < lines.length) {
      const line = lines[i].trim();
      
      // Look for timestamp line
      if (line.includes(' --> ')) {
        const [startStr, endStr] = line.split(' --> ');
        const startTime = parseTimeString(startStr);
        const endTime = parseTimeString(endStr);
        
        // Get subtitle text (next non-empty lines)
        i++;
        const textLines: string[] = [];
        while (i < lines.length && lines[i].trim() !== '') {
          textLines.push(lines[i].trim());
          i++;
        }
        
        if (textLines.length > 0) {
          const cue = {
            startTime,
            endTime,
            text: textLines.join('\n')
          };
          cues.push(cue);
          console.log('[EXPO-AV-PLAYER] 🎞️ VTT Cue parsed:', {
            start: cue.startTime.toFixed(2) + 's',
            end: cue.endTime.toFixed(2) + 's',
            text: cue.text.substring(0, 50) + (cue.text.length > 50 ? '...' : '')
          });
        }
      }
      i++;
    }
    
    console.log('[EXPO-AV-PLAYER] ✅ VTT Parser - Parsed', cues.length, 'cues');
    return cues;
  }, []);

  // SRT subtitle parser
  const parseSRTSubtitles = useCallback((text: string): SubtitleCue[] => {
    const cues: SubtitleCue[] = [];
    const blocks = text.split(/\n\s*\n/);
    
    console.log('[EXPO-AV-PLAYER] 🎞️ SRT Parser - Total blocks:', blocks.length);
    
    for (const block of blocks) {
      const lines = block.trim().split('\n');
      if (lines.length < 3) continue;
      
      // Skip sequence number (first line)
      const timeLine = lines[1];
      if (!timeLine.includes(' --> ')) continue;
      
      const [startStr, endStr] = timeLine.split(' --> ');
      const startTime = parseTimeString(startStr);
      const endTime = parseTimeString(endStr);
      
      const text = lines.slice(2).join('\n').trim();
      
      if (text) {
        const cue = {
          startTime,
          endTime,
          text
        };
        cues.push(cue);
        console.log('[EXPO-AV-PLAYER] 🎞️ SRT Cue parsed:', {
          start: cue.startTime.toFixed(2) + 's',
          end: cue.endTime.toFixed(2) + 's',
          text: cue.text.substring(0, 50) + (cue.text.length > 50 ? '...' : '')
        });
      }
    }
    
    console.log('[EXPO-AV-PLAYER] ✅ SRT Parser - Parsed', cues.length, 'cues');
    return cues;
  }, []);

  // Parse time string to seconds
  const parseTimeString = (timeStr: string): number => {
    const parts = timeStr.replace(',', '.').split(':');
    if (parts.length === 3) {
      const hours = parseInt(parts[0]);
      const minutes = parseInt(parts[1]);
      const seconds = parseFloat(parts[2]);
      return hours * 3600 + minutes * 60 + seconds;
    }
    return 0;
  };

  // Enhanced subtitle parser (VTT/SRT/ASS)
  const parseSubtitles = useCallback((text: string, format?: string): SubtitleCue[] => {
    console.log('[EXPO-AV-PLAYER] 🎞️ Parsing subtitles - Format:', format || 'auto-detect', 'Length:', text.length);
    
    // ASS (Advanced SubStation Alpha) parser
    if (format === 'ass' || text.includes('[Script Info]') || text.includes('[V4+ Styles]')) {
      console.log('[EXPO-AV-PLAYER] 🎞️ Detected ASS format, parsing...');
      return parseASSSubtitles(text);
    }
    
    // VTT parser
    if (text.includes('WEBVTT')) {
      console.log('[EXPO-AV-PLAYER] 🎞️ Detected VTT format, parsing...');
      return parseVTTSubtitles(text);
    }
    
    // SRT parser (fallback)
    console.log('[EXPO-AV-PLAYER] 🎞️ Assuming SRT format, parsing...');
    return parseSRTSubtitles(text);
  }, [parseASSSubtitles, parseSRTSubtitles, parseVTTSubtitles]);

  // Load and parse subtitles (VTT/SRT/ASS support)
  const loadSubtitles = useCallback(async (subtitleUrl: string, format?: string) => {
    try {
      console.log('[EXPO-AV-PLAYER] 🎞️ Fetching subtitles from:', subtitleUrl.substring(0, 50) + '...');
      console.log('[EXPO-AV-PLAYER] 🎞️ Subtitle format:', format || 'auto-detect');
      
      const response = await fetch(subtitleUrl);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const subtitleText = await response.text();
      console.log('[EXPO-AV-PLAYER] 🎞️ Subtitle content length:', subtitleText.length);
      console.log('[EXPO-AV-PLAYER] 🎞️ Subtitle content preview:', subtitleText.substring(0, 200) + '...');
      
      // Enhanced subtitle parsing with format detection
      const cues = parseSubtitles(subtitleText, format);
      setSubtitles(cues);
      
      console.log('[EXPO-AV-PLAYER] ✅ Successfully loaded', cues.length, 'subtitle cues');
      
      // Log first few cues for verification
      if (cues.length > 0) {
        console.log('[EXPO-AV-PLAYER] 🎞️ First 3 cues preview:');
        cues.slice(0, 3).forEach((cue, index) => {
          console.log(`[EXPO-AV-PLAYER] 🎞️ Cue ${index + 1}:`, {
            start: `${Math.floor(cue.startTime / 60)}:${(cue.startTime % 60).toFixed(2).padStart(5, '0')}`,
            end: `${Math.floor(cue.endTime / 60)}:${(cue.endTime % 60).toFixed(2).padStart(5, '0')}`,
            text: cue.text.substring(0, 100) + (cue.text.length > 100 ? '...' : '')
          });
        });
      }
    } catch (err) {
      console.error('[EXPO-AV-PLAYER] ❌ Failed to load subtitles:', err);
      console.error('[EXPO-AV-PLAYER] ❌ Subtitle URL:', subtitleUrl);
      setSubtitles([]);
    }
  }, [parseSubtitles]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, []);

  // Load video data from AsyncStorage
  useEffect(() => {
    const loadVideoData = async () => {
      try {
        const dataKey = params.dataKey as string;
        if (!dataKey) {
          throw new Error('No data key provided');
        }

        console.log('[EXPO-AV-PLAYER] 📱 Loading video data with key:', dataKey);
        const storedData = await AsyncStorage.getItem(dataKey);
        
        if (!storedData) {
          throw new Error('No video data found');
        }

        const data: VideoData = JSON.parse(storedData);
        console.log('[EXPO-AV-PLAYER] ✅ Loaded video data:', {
          provider: data.provider,
          hasZencloudData: !!data.zencloudData,
          subtitlesCount: data.subtitles?.length || 0,
          hasTimings: !!data.timings,
          audioType: data.audioType
        });

        setVideoData(data);
        
        // Load subtitles if available
        if (data.subtitles && data.subtitles.length > 0) {
          console.log('[EXPO-AV-PLAYER] 🎞️ Loading subtitles...');
          await loadSubtitles(data.subtitles[0].url); // Load first subtitle for MVP
        }
        
        setLoading(false);
      } catch (err) {
        console.error('[EXPO-AV-PLAYER] ❌ Error loading video data:', err);
        const errorMessage = err instanceof Error ? err.message : 'Failed to load video data';
        setError(errorMessage);
        setLoading(false);
        
        // Call the onError callback if provided
        if (onError) {
          onError(errorMessage);
        }
      }
    };

    loadVideoData();
  }, [params.dataKey, loadSubtitles, onError]);

  // Load subtitles when language selection changes
  useEffect(() => {
    if (videoData?.zencloudData?.subtitles && videoData.zencloudData.subtitles[selectedSubtitle]) {
      const selectedSubtitleData = videoData.zencloudData.subtitles[selectedSubtitle];
      console.log('[EXPO-AV-PLAYER] 🎞️ Loading selected subtitle:', {
        language: selectedSubtitleData.language_name || selectedSubtitleData.language,
        format: selectedSubtitleData.format,
        url: selectedSubtitleData.url.substring(0, 50) + '...',
        isDefault: selectedSubtitleData.is_default
      });
      loadSubtitles(selectedSubtitleData.url, selectedSubtitleData.format);
    }
  }, [selectedSubtitle, videoData?.zencloudData?.subtitles, loadSubtitles]);

  // Apply playback speed changes
  useEffect(() => {
    if (videoRef.current && playbackSpeed !== 1.0) {
      videoRef.current.setRateAsync(playbackSpeed, true);
    }
  }, [playbackSpeed]);

  // Debounce utility for settings saves
  const debounce = <T extends any[]>(fn: (...args: T) => void, wait: number) => {
    let t: any;
    return (...args: T) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), wait);
    };
  };

  // Debounced settings save to prevent AsyncStorage thrashing
  const saveSettingsDebounced = useRef(
    debounce(async (settings: any) => {
      try {
        await AsyncStorage.setItem('playerSettings', JSON.stringify(settings));
        console.log('[EXPO-AV-PLAYER] 💾 Settings saved');
      } catch (error) {
        console.warn('[EXPO-AV-PLAYER] ⚠️ Failed to save settings:', error);
      }
    }, 400)
  ).current;

  // Load settings from AsyncStorage
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const stored = await AsyncStorage.getItem('playerSettings');
        if (stored) {
          const settings = JSON.parse(stored);
          setSelectedSubtitle(settings.selectedSubtitle || 0);
          setSelectedAudioTrack(settings.selectedAudioTrack || 0);
          setPlaybackSpeed(settings.playbackSpeed || 1.0);
          setSubtitleSize(settings.subtitleSize || 16);
          setSubtitleOpacity(settings.subtitleOpacity || 1.0);
          setSubtitlePosition(settings.subtitlePosition || 0.8);
          setSubtitlesEnabled(settings.subtitlesEnabled !== false);
          console.log('[EXPO-AV-PLAYER] ✅ Settings loaded');
        }
      } catch (error) {
        console.warn('[EXPO-AV-PLAYER] ⚠️ Failed to load settings:', error);
      }
    };
    loadSettings();
  }, []);

  // Save settings when they change (debounced)
  useEffect(() => {
    saveSettingsDebounced({
      selectedSubtitle,
      selectedAudioTrack,
      playbackSpeed,
      subtitleSize,
      subtitleOpacity,
      subtitlePosition,
      subtitlesEnabled
    });
  }, [selectedSubtitle, selectedAudioTrack, playbackSpeed, subtitleSize, subtitleOpacity, subtitlePosition, subtitlesEnabled, saveSettingsDebounced]);

  // Binary search for subtitle lookup (O(log n) instead of O(n))
  const currentCueIndexAt = useCallback((t: number) => {
    const arr = startsRef.current;
    if (arr.length === 0) return -1;
    
    let lo = 0, hi = arr.length - 1, idx = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (arr[mid] <= t) { 
        idx = mid; 
        lo = mid + 1; 
      } else { 
        hi = mid - 1; 
      }
    }
    
    if (idx >= 0 && t <= subtitles[idx].endTime) return idx;
    return -1;
  }, [subtitles]);

  // Update current subtitle based on playback position (optimized)
  useEffect(() => {
    if (!subtitlesEnabled || subtitles.length === 0) {
      setCurrentSubtitle('');
      return;
    }

    const cueIndex = currentCueIndexAt(position);
    const currentCue = cueIndex >= 0 ? subtitles[cueIndex] : null;
    const newSubtitle = currentCue?.text || '';
    
    // Only log subtitle changes in debug mode for performance
    if (__DEV__ && newSubtitle !== currentSubtitle) {
      if (newSubtitle) {
        console.log('[EXPO-AV-PLAYER] 🎞️ Subtitle displayed:', {
          time: `${Math.floor(position / 60)}:${(position % 60).toFixed(2).padStart(5, '0')}`,
          text: newSubtitle.substring(0, 100) + (newSubtitle.length > 100 ? '...' : ''),
          start: currentCue ? `${Math.floor(currentCue.startTime / 60)}:${(currentCue.startTime % 60).toFixed(2).padStart(5, '0')}` : 'N/A',
          end: currentCue ? `${Math.floor(currentCue.endTime / 60)}:${(currentCue.endTime % 60).toFixed(2).padStart(5, '0')}` : 'N/A'
        });
      } else {
        console.log('[EXPO-AV-PLAYER] 🎞️ Subtitle cleared at:', `${Math.floor(position / 60)}:${(position % 60).toFixed(2).padStart(5, '0')}`);
      }
    }
    
    setCurrentSubtitle(newSubtitle);
  }, [position, subtitles, subtitlesEnabled, currentSubtitle, currentCueIndexAt]);

  // Handle video status updates
  const handlePlaybackStatusUpdate = (status: AVPlaybackStatus) => {
    if (status.isLoaded) {
      setIsPlaying(status.isPlaying);
      const currentTime = status.positionMillis / 1000;
      const dur = status.durationMillis ? status.durationMillis / 1000 : 0;
      
      setPosition(currentTime);
      setDuration(dur);
      
      // Emit time update event for parent player component
      if (currentTime > 0 && dur > 0) {
        DeviceEventEmitter.emit('playerTimeUpdate', {
          currentTime: currentTime,
          duration: dur
        });
      }
      
      // Save progress to AniList if significant progress made
      if (status.positionMillis && status.durationMillis) {
        const progressPercent = (status.positionMillis / status.durationMillis) * 100;
        if (progressPercent > 10 && progressPercent < 90) {
          // Save progress periodically
          saveProgressToAniList();
        }
      }
    } else if (status.error) {
      console.error('[EXPO-AV-PLAYER] ❌ Video error:', status.error);
      const errorMessage = `Video playback error: ${status.error}`;
      setError(errorMessage);
      
      // Call the onError callback if provided
      if (onError) {
        onError(errorMessage);
      }
    }
  };

  // Save progress to AniList
  const saveProgressToAniList = useCallback(async () => {
    if (!videoData || !videoData.anilistId) return;
    
    try {
      DeviceEventEmitter.emit('saveAniListProgress', {
        anilistId: videoData.anilistId,
        episodeNumber: videoData.episodeNumber,
        currentTime: position,
        duration: duration
      });
    } catch (error) {
      console.warn('[EXPO-AV-PLAYER] ⚠️ Failed to save progress:', error);
    }
  }, [videoData, position, duration]);

  // Control visibility management
  const showControlsTemporarily = useCallback(() => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = setTimeout(() => {
      setShowControls(false);
    }, 3000);
  }, []);

  // Playback controls
  const togglePlayPause = async () => {
    if (!videoRef.current) return;
    
    try {
      if (isPlaying) {
        console.log('[EXPO-AV-PLAYER] ⏸️ Pausing video...');
        await videoRef.current.pauseAsync();
        setIsPlaying(false);
      } else {
        console.log('[EXPO-AV-PLAYER] ▶️ Playing video...');
        await videoRef.current.playAsync();
        setIsPlaying(true);
      }
      showControlsTemporarily();
    } catch (error) {
      console.error('[EXPO-AV-PLAYER] ❌ Error toggling play/pause:', error);
    }
  };

  const seekTo = async (seconds: number) => {
    if (!videoRef.current) return;
    
    try {
      // Don't clamp - expo-av handles bounds internally
      console.log('[EXPO-AV-PLAYER] 🎯 Seeking to:', formatTime(seconds));
      
      // Immediately update position for instant visual feedback (optimistic UI)
      setPosition(seconds);
      
      // Seek the video - expo-av will clamp internally
      await videoRef.current.setPositionAsync(seconds * 1000);
      showControlsTemporarily();
    } catch (error) {
      console.error('[EXPO-AV-PLAYER] ❌ Error seeking:', error);
    }
  };

  // Picture-in-Picture handler
  const handleEnterPip = useCallback(async () => {
    console.log('[EXPO-AV-PLAYER] 🔍 PiP button pressed - checking support:', isPipSupported);
    
    if (!isPipSupported) {
      console.warn('[EXPO-AV-PLAYER] ⚠️ PiP not supported on this device');
      return;
    }

    try {
      console.log('[EXPO-AV-PLAYER] 📱 Entering Picture-in-Picture mode...');
      const success = await enterPipMode({ width: 16, height: 9 });
      
      if (success) {
        console.log('[EXPO-AV-PLAYER] ✅ Successfully entered PiP mode');
        // Auto-play when entering PiP mode if paused
        if (!isPlaying && videoRef.current) {
          await videoRef.current.playAsync();
        }
      } else {
        console.error('[EXPO-AV-PLAYER] ❌ Failed to enter PiP mode');
      }
    } catch (error) {
      console.error('[EXPO-AV-PLAYER] ❌ Error entering PiP mode:', error);
    }
  }, [isPipSupported, enterPipMode, isPlaying]);

  // Debug PiP support
  useEffect(() => {
    console.log('[EXPO-AV-PLAYER] 🔍 PiP Debug Info:', {
      propIsPipSupported,
      hookIsPipSupported,
      finalIsPipSupported: isPipSupported,
      propIsInPipMode,
      hookIsInPipMode,
      finalIsInPipMode: isInPipMode
    });
  }, [propIsPipSupported, hookIsPipSupported, isPipSupported, propIsInPipMode, hookIsInPipMode, isInPipMode]);

  // YouTube-style seeking functions
  const percentFromX = useCallback((x: number) => {
    if (!progressBarWidth || duration <= 0) return 0;
    const p = Math.max(0, Math.min(1, x / progressBarWidth));
    return p;
  }, [progressBarWidth, duration]);

  const seekToPercent = useCallback(async (p: number) => {
    // Compute target even if duration is unknown - expo-av will clamp
    const target = p * (duration || 0);
    
    console.log('[EXPO-AV-PLAYER] 🎯 YouTube-style seeking to:', formatTime(target), 'Progress:', p.toFixed(3));
    
    // Optimistic UI - update position immediately for instant feedback
    setPosition(target);
    
    // Throttle seeks during drag to prevent overwhelming the video
    const now = Date.now();
    if (now - lastSeekTime.current > 150) { // 150ms throttle
      if (videoRef.current) {
        try {
          await videoRef.current.setPositionAsync(target * 1000);
          lastSeekTime.current = now;
        } catch (error) {
          console.error('[EXPO-AV-PLAYER] ❌ Error seeking during scrub:', error);
        }
      }
    }
    
    showControlsTemporarily();
  }, [duration, formatTime, showControlsTemporarily]);

  // Use a ref to track scrubbing state for immediate access in responder callbacks
  const isScrubbingRef = useRef(false);

  const handleResponderGrant = useCallback((event: any) => {
    if (!duration || duration <= 0) return;
    isScrubbingRef.current = true;
    const p = percentFromX(event.nativeEvent.locationX);
    seekToPercent(p);
    
    // Show chapter menu if chapters available
    if (videoData?.zencloudData?.chapters && videoData.zencloudData.chapters.length > 0) {
      setChapterMenuPosition({ x: event.nativeEvent.pageX, y: event.nativeEvent.pageY });
      setShowChapterMenu(true);
    }
  }, [duration, percentFromX, seekToPercent, videoData]);

  const handleResponderMove = useCallback((event: any) => {
    if (!isScrubbingRef.current) return;
    const p = percentFromX(event.nativeEvent.locationX);
    seekToPercent(p);
  }, [percentFromX, seekToPercent]);

  const handleResponderRelease = useCallback(async (event: any) => {
    if (!isScrubbingRef.current) return;
    
    const p = percentFromX(event.nativeEvent.locationX);
    
    // Final seek on release (no throttle, no clamp - expo-av handles it)
    const target = p * duration;
    
    console.log('[EXPO-AV-PLAYER] 🎯 Final seek on release to:', formatTime(target));
    
    setPosition(target);
    if (videoRef.current) {
      try {
        await videoRef.current.setPositionAsync(target * 1000);
      } catch (error) {
        console.error('[EXPO-AV-PLAYER] ❌ Error on final seek:', error);
      }
    }
    
    isScrubbingRef.current = false;
    setShowChapterMenu(false); // Hide chapter menu on release
    showControlsTemporarily();
  }, [percentFromX, duration, showControlsTemporarily, formatTime]);

  const skip = async (seconds: number) => {
    // Don't clamp here - let expo-av handle bounds
    const newPosition = position + seconds;
    await seekTo(newPosition);
  };

  // Chapter navigation
  const jumpToChapter = async (startTime: number) => {
    await seekTo(startTime);
    setShowChapters(false);
  };


  if (loading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <StatusBar hidden translucent backgroundColor="transparent" />
        <Text style={styles.loadingText}>Loading video...</Text>
      </View>
    );
  }

  if (error || !videoData) {
    return (
      <View style={[styles.container, styles.errorContainer]}>
        <StatusBar hidden translucent backgroundColor="transparent" />
        <Text style={styles.errorText}>{error || 'Failed to load video'}</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const videoSource = videoData.zencloudData ? 
    { uri: videoData.zencloudData.m3u8_url } : 
    { uri: videoData.source, headers: videoData.headers };

  return (
    <View style={styles.container}>
      <StatusBar hidden translucent backgroundColor="transparent" />
      
      {/* Video Player */}
      <TouchableOpacity 
        style={styles.videoContainer} 
        activeOpacity={1} 
        onPress={showControlsTemporarily}
      >
        <Video
          ref={videoRef}
          source={videoSource}
          style={styles.video}
          resizeMode={ResizeMode.CONTAIN}
          shouldPlay={true}
          isLooping={false}
          onPlaybackStatusUpdate={handlePlaybackStatusUpdate}
          useNativeControls={false}
        />
        
        {/* Subtitle Overlay */}
        {currentSubtitle && subtitlesEnabled && (
          <View style={[
            styles.subtitleContainer,
            { bottom: `${subtitlePosition * 100}%` }
          ]}>
            <Text style={[
              styles.subtitleText,
              {
                fontSize: subtitleSize,
                opacity: subtitleOpacity
              }
            ]}>
              {currentSubtitle}
            </Text>
          </View>
        )}
        
        {/* Controls Overlay - Optimized for performance */}
        <View 
          style={[
            styles.controlsOverlay,
            !showControls && { display: 'none' }
          ]}
          pointerEvents={showControls ? 'auto' : 'none'}
        >
            {/* Top Controls */}
            <View style={styles.topControls}>
              <TouchableOpacity 
                style={styles.backButton} 
                onPress={() => {
                  console.log('[EXPO-AV-PLAYER] 🚪 Back button pressed, emitting exit request');
                  DeviceEventEmitter.emit('requestPlayerExit');
                }}
              >
                <FontAwesome5 name="arrow-left" size={20} color="#fff" />
              </TouchableOpacity>
              <View style={styles.titleContainer}>
                <Text style={styles.videoTitle} numberOfLines={1}>
                  {videoData.animeTitle} - Episode {videoData.episodeNumber}
                </Text>
              </View>
              {isPipSupported && (
                <TouchableOpacity 
                  style={[styles.controlButton, isInPipMode && styles.pipActive]} 
                  onPress={handleEnterPip}
                >
                  <FontAwesome5 
                    name="compress" 
                    size={20} 
                    color={isInPipMode ? "#02A9FF" : "#fff"} 
                  />
                </TouchableOpacity>
              )}
              {/* Debug: Always show PiP button for testing */}
              {!isPipSupported && (
                <TouchableOpacity 
                  style={[styles.controlButton, { backgroundColor: 'rgba(255, 0, 0, 0.6)' }]} 
                  onPress={() => console.log('[EXPO-AV-PLAYER] 🔍 PiP button pressed but not supported')}
                >
                  <FontAwesome5 
                    name="compress" 
                    size={20} 
                    color="#ff0000" 
                  />
                </TouchableOpacity>
              )}
              <TouchableOpacity 
                style={styles.controlButton} 
                onPress={() => setSubtitlesEnabled(!subtitlesEnabled)}
              >
                <FontAwesome5 
                  name="closed-captioning" 
                  size={20} 
                  color={subtitlesEnabled ? "#FFD700" : "#fff"} 
                />
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.controlButton} 
                onPress={() => setShowSettings(true)}
              >
                <FontAwesome5 
                  name="cog" 
                  size={20} 
                  color="#fff" 
                />
              </TouchableOpacity>
            </View>

            {/* Center Controls */}
            <View style={styles.centerControls}>
              <TouchableOpacity style={styles.skipButton} onPress={() => skip(-10)}>
                <FontAwesome5 name="backward" size={24} color="#fff" />
                <Text style={styles.skipText}>10</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.playButton} onPress={togglePlayPause}>
                <FontAwesome5 
                  name={isPlaying ? "pause" : "play"} 
                  size={32} 
                  color="#fff" 
                />
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.skipButton} onPress={() => skip(10)}>
                <FontAwesome5 name="forward" size={24} color="#fff" />
                <Text style={styles.skipText}>10</Text>
              </TouchableOpacity>
            </View>

            {/* Bottom Controls */}
            <View style={styles.bottomControls}>
              <Text style={styles.timeText}>{formatTime(position)}</Text>
              
              {/* Progress Bar - YouTube-style tap and drag */}
              <View style={styles.progressContainer}>
                <View
                  ref={progressBarRef}
                  style={styles.progressBar}
                  onLayout={(event) => {
                    const { width: measuredWidth } = event.nativeEvent.layout;
                    setProgressBarWidth(measuredWidth);
                  }}
                  onStartShouldSetResponder={() => true}
                  onMoveShouldSetResponder={() => true}
                  onResponderGrant={handleResponderGrant}
                  onResponderMove={handleResponderMove}
                  onResponderRelease={handleResponderRelease}
                  onResponderTerminationRequest={() => true}
                >
                  <View style={styles.progressBarTrack}>
                    <View 
                      style={[
                        styles.progressFill, 
                        { width: `${duration ? (position / duration) * 100 : 0}%` }
                      ]} 
                    />
                    
                    {/* Chapter markers */}
                    {videoData?.zencloudData?.chapters && duration > 0 && videoData.zencloudData.chapters.map((chapter, index) => {
                      // Skip first chapter marker at 0% to avoid overlap
                      if (chapter.start_time === 0) return null;
                      const chapterPercent = (chapter.start_time / duration) * 100;
                      return (
                        <View
                          key={chapter.id}
                          style={[
                            styles.chapterMarker,
                            { left: `${chapterPercent}%` }
                          ]}
                        />
                      );
                    })}
                    
                    <View 
                      style={[
                        styles.progressThumb,
                        { left: `${duration ? (position / duration) * 100 : 0}%` }
                      ]} 
                    />
                  </View>
                </View>
              </View>
              
              <Text style={styles.timeText}>{formatTime(duration)}</Text>
              
              {/* Chapters Button */}
              {videoData.zencloudData?.chapters && videoData.zencloudData.chapters.length > 0 && (
                <TouchableOpacity 
                  style={styles.controlButton} 
                  onPress={() => setShowChapters(!showChapters)}
                >
                  <FontAwesome5 name="list" size={20} color="#fff" />
                </TouchableOpacity>
              )}
            </View>
        </View>
      </TouchableOpacity>

      {/* Chapter Menu Popup */}
      {showChapterMenu && videoData?.zencloudData?.chapters && (
        <View style={styles.chapterMenuOverlay} pointerEvents="box-none">
          <View style={[styles.chapterMenuContainer, { top: chapterMenuPosition.y - 200, left: Math.min(chapterMenuPosition.x - 100, width - 220) }]}>
            <Text style={styles.chapterMenuTitle}>Chapters</Text>
            <ScrollView style={styles.chapterMenuScroll} showsVerticalScrollIndicator={false}>
              {videoData.zencloudData.chapters.map((chapter) => (
                <TouchableOpacity
                  key={chapter.id}
                  style={styles.chapterMenuItem}
                  onPress={() => {
                    seekTo(chapter.start_time);
                    setShowChapterMenu(false);
                  }}
                >
                  <Text style={styles.chapterMenuItemTitle} numberOfLines={1}>{chapter.title}</Text>
                  <Text style={styles.chapterMenuItemTime}>
                    {formatTime(chapter.start_time)} - {formatTime(chapter.end_time)}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      )}

      {/* Chapters Modal */}
      {showChapters && videoData.zencloudData?.chapters && (
        <View style={styles.chaptersModal}>
          <View style={styles.chaptersContent}>
            <View style={styles.chaptersHeader}>
              <Text style={styles.chaptersTitle}>Chapters</Text>
              <TouchableOpacity onPress={() => setShowChapters(false)}>
                <FontAwesome5 name="times" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
            
            {videoData.zencloudData.chapters.map((chapter) => (
              <TouchableOpacity
                key={chapter.id}
                style={styles.chapterItem}
                onPress={() => jumpToChapter(chapter.start_time)}
              >
                <Text style={styles.chapterTitle}>{chapter.title}</Text>
                <Text style={styles.chapterTime}>
                  {formatTime(chapter.start_time)} - {formatTime(chapter.end_time)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* Settings Modal */}
      {showSettings && (
        <View style={styles.settingsModal}>
          <View style={styles.settingsContent}>
            <View style={styles.settingsHeader}>
              <Text style={styles.settingsTitle}>Player Settings</Text>
              <TouchableOpacity onPress={() => setShowSettings(false)}>
                <FontAwesome5 name="times" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
            
            <ScrollView 
              style={styles.settingsBody}
              showsVerticalScrollIndicator={true}
              bounces={true}
              contentContainerStyle={styles.settingsScrollContent}
            >
              {/* Subtitle Settings */}
              <View style={styles.settingsSection}>
                <Text style={styles.sectionTitle}>Subtitles</Text>
                
                {/* Subtitle Language Selection */}
                {videoData.zencloudData?.subtitles && videoData.zencloudData.subtitles.length > 0 && (
                  <View style={styles.settingItem}>
                    <Text style={styles.settingLabel}>Language</Text>
                    <View style={styles.optionsContainer}>
                      {(() => {
                        // Get unique languages to avoid duplicates
                        const uniqueLanguages = videoData.zencloudData.subtitles.reduce((acc, subtitle, index) => {
                          const language = subtitle.language_name || subtitle.language;
                          if (!acc.find(item => item.language === language)) {
                            acc.push({ language, index });
                          }
                          return acc;
                        }, [] as { language: string; index: number }[]);
                        
                        return uniqueLanguages.map(({ language, index }) => (
                          <TouchableOpacity
                            key={index}
                            style={[
                              styles.optionButton,
                              selectedSubtitle === index && styles.optionButtonSelected
                            ]}
                            onPress={() => setSelectedSubtitle(index)}
                          >
                            <Text style={[
                              styles.optionText,
                              selectedSubtitle === index && styles.optionTextSelected
                            ]}>
                              {language}
                            </Text>
                          </TouchableOpacity>
                        ));
                      })()}
                    </View>
                  </View>
                )}
                
                {/* Subtitle Size */}
                <View style={styles.settingItem}>
                  <Text style={styles.settingLabel}>Size: {subtitleSize}px</Text>
                  <View style={styles.sliderContainer}>
                    <Text style={styles.sliderLabel}>12</Text>
                    <View style={styles.slider}>
                      <View 
                        style={[
                          styles.sliderTrack,
                          { width: `${((subtitleSize - 12) / (24 - 12)) * 100}%` }
                        ]} 
                      />
                      <TouchableOpacity
                        style={[
                          styles.sliderThumb,
                          { left: `${((subtitleSize - 12) / (24 - 12)) * 100}%` }
                        ]}
                        onPress={() => {
                          // This would be handled by a proper slider component
                          // For now, we'll cycle through sizes
                          const sizes = [12, 14, 16, 18, 20, 22, 24];
                          const currentIndex = sizes.indexOf(subtitleSize);
                          const nextIndex = (currentIndex + 1) % sizes.length;
                          setSubtitleSize(sizes[nextIndex]);
                        }}
                      />
                    </View>
                    <Text style={styles.sliderLabel}>24</Text>
                  </View>
                </View>
                
                {/* Subtitle Opacity */}
                <View style={styles.settingItem}>
                  <Text style={styles.settingLabel}>Opacity: {Math.round(subtitleOpacity * 100)}%</Text>
                  <View style={styles.sliderContainer}>
                    <Text style={styles.sliderLabel}>0%</Text>
                    <View style={styles.slider}>
                      <View 
                        style={[
                          styles.sliderTrack,
                          { width: `${subtitleOpacity * 100}%` }
                        ]} 
                      />
                      <TouchableOpacity
                        style={[
                          styles.sliderThumb,
                          { left: `${subtitleOpacity * 100}%` }
                        ]}
                        onPress={() => {
                          const opacities = [0.3, 0.5, 0.7, 0.9, 1.0];
                          const currentIndex = opacities.indexOf(subtitleOpacity);
                          const nextIndex = (currentIndex + 1) % opacities.length;
                          setSubtitleOpacity(opacities[nextIndex]);
                        }}
                      />
                    </View>
                    <Text style={styles.sliderLabel}>100%</Text>
                  </View>
                </View>
              </View>

              {/* Playback Settings */}
              <View style={styles.settingsSection}>
                <Text style={styles.sectionTitle}>Playback</Text>
                
                {/* Playback Speed */}
                <View style={styles.settingItem}>
                  <Text style={styles.settingLabel}>Speed: {playbackSpeed}x</Text>
                  <View style={styles.optionsContainer}>
                    {[0.5, 0.75, 1.0, 1.25, 1.5, 2.0].map((speed) => (
                      <TouchableOpacity
                        key={speed}
                        style={[
                          styles.optionButton,
                          playbackSpeed === speed && styles.optionButtonSelected
                        ]}
                        onPress={() => setPlaybackSpeed(speed)}
                      >
                        <Text style={[
                          styles.optionText,
                          playbackSpeed === speed && styles.optionTextSelected
                        ]}>
                          {speed}x
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </View>

              {/* Audio Settings */}
              <View style={styles.settingsSection}>
                <Text style={styles.sectionTitle}>Audio</Text>
                
                {/* Audio Track Selection */}
                <View style={styles.settingItem}>
                  <Text style={styles.settingLabel}>Track (Expo Go Limitation)</Text>
                  <View style={styles.optionsContainer}>
                    <TouchableOpacity
                      style={[
                        styles.optionButton,
                        selectedAudioTrack === 0 && styles.optionButtonSelected
                      ]}
                      onPress={() => setSelectedAudioTrack(0)}
                    >
                      <Text style={[
                        styles.optionText,
                        selectedAudioTrack === 0 && styles.optionTextSelected
                      ]}>
                        {videoData.audioType === 'sub' ? 'Japanese (Original)' : 'English (Original)'}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.optionButton,
                        styles.optionButtonDisabled
                      ]}
                      onPress={() => {
                        Alert.alert(
                          'Audio Track Switching',
                          'Audio track switching is not supported in Expo Go. This feature requires a custom development build with react-native-video.',
                          [{ text: 'OK' }]
                        );
                      }}
                    >
                      <Text style={[
                        styles.optionText,
                        styles.optionTextDisabled
                      ]}>
                        {videoData.audioType === 'sub' ? 'English (Not Available)' : 'Japanese (Not Available)'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.settingNote}>
                    ⚠️ Audio track switching requires a custom dev build
                  </Text>
                </View>
              </View>

              {/* Display Settings */}
              <View style={styles.settingsSection}>
                <Text style={styles.sectionTitle}>Display</Text>
                
                {/* Subtitle Position */}
                <View style={styles.settingItem}>
                  <Text style={styles.settingLabel}>Subtitle Position: {Math.round(subtitlePosition * 100)}%</Text>
                  <View style={styles.sliderContainer}>
                    <Text style={styles.sliderLabel}>0%</Text>
                    <View style={styles.slider}>
                      <View 
                        style={[
                          styles.sliderTrack,
                          { width: `${subtitlePosition * 100}%` }
                        ]} 
                      />
                      <TouchableOpacity
                        style={[
                          styles.sliderThumb,
                          { left: `${subtitlePosition * 100}%` }
                        ]}
                        onPress={() => {
                          const positions = [0.6, 0.7, 0.8, 0.9, 1.0];
                          const currentIndex = positions.indexOf(subtitlePosition);
                          const nextIndex = (currentIndex + 1) % positions.length;
                          setSubtitlePosition(positions[nextIndex]);
                        }}
                      />
                    </View>
                    <Text style={styles.sliderLabel}>100%</Text>
                  </View>
                </View>
              </View>

              {/* Quality Settings */}
              <View style={styles.settingsSection}>
                <Text style={styles.sectionTitle}>Quality</Text>
                
                <View style={styles.settingItem}>
                  <Text style={styles.settingLabel}>Video Quality</Text>
                  <View style={styles.optionsContainer}>
                    {['Auto', '1080p', '720p', '480p', '360p'].map((quality) => (
                      <TouchableOpacity
                        key={quality}
                        style={[
                          styles.optionButton,
                          quality === 'Auto' && styles.optionButtonSelected
                        ]}
                        onPress={() => {
                          // Quality selection logic would go here
                          console.log('Selected quality:', quality);
                        }}
                      >
                        <Text style={[
                          styles.optionText,
                          quality === 'Auto' && styles.optionTextSelected
                        ]}>
                          {quality}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </View>
            </ScrollView>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  errorText: {
    color: '#ff4444',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  videoContainer: {
    flex: 1,
    position: 'relative',
  },
  video: {
    width: '100%',
    height: '100%',
  },
  subtitleContainer: {
    position: 'absolute',
    bottom: 80,
    left: 20,
    right: 20,
    alignItems: 'center',
  },
  subtitleText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  controlsOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    justifyContent: 'space-between',
  },
  topControls: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 20,
  },
  titleContainer: {
    flex: 1,
    marginHorizontal: 15,
  },
  videoTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  centerControls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 40,
  },
  bottomControls: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 40,
    gap: 10,
  },
  backButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    padding: 12,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  controlButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    padding: 12,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pipActive: {
    backgroundColor: 'rgba(2, 169, 255, 0.3)',
    borderWidth: 1,
    borderColor: '#02A9FF',
  },
  playButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    padding: 20,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    padding: 16,
    borderRadius: 35,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  skipText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
    position: 'absolute',
    bottom: 8,
  },
  timeText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
    minWidth: 50,
    textAlign: 'center',
  },
  progressContainer: {
    flex: 1,
    marginHorizontal: 10,
  },
  progressBar: {
    height: 20,
    justifyContent: 'center',
    paddingVertical: 8,
  },
  progressBarTrack: {
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 2,
    position: 'relative',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#02A9FF',
    borderRadius: 2,
    position: 'absolute',
    top: 0,
    left: 0,
  },
  progressThumb: {
    position: 'absolute',
    width: 12,
    height: 12,
    backgroundColor: '#02A9FF',
    borderRadius: 6,
    top: -4,
    marginLeft: -6,
    shadowColor: '#02A9FF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 3,
  },
  chapterMarker: {
    position: 'absolute',
    width: 2,
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    top: -2,
    marginLeft: -1,
  },
  chapterMenuOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  chapterMenuContainer: {
    position: 'absolute',
    backgroundColor: 'rgba(26, 26, 26, 0.95)',
    borderRadius: 8,
    padding: 12,
    width: 200,
    maxHeight: 180,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  chapterMenuTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  chapterMenuScroll: {
    maxHeight: 140,
  },
  chapterMenuItem: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  chapterMenuItemTitle: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 2,
  },
  chapterMenuItemTime: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 11,
  },
  chaptersModal: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  chaptersContent: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 20,
    maxWidth: width * 0.8,
    maxHeight: height * 0.6,
  },
  chaptersHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  chaptersTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  chapterItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  chapterTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  chapterTime: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
  },
  // Settings Modal Styles
  settingsModal: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingsContent: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 20,
    maxWidth: width * 0.9,
    maxHeight: height * 0.8,
    width: '90%',
  },
  settingsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  settingsTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
  },
  settingsBody: {
    maxHeight: height * 0.6,
  },
  settingsScrollContent: {
    paddingBottom: 30,
    paddingTop: 10,
  },
  settingsSection: {
    marginBottom: 25,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 15,
  },
  settingItem: {
    marginBottom: 20,
  },
  settingLabel: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  optionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  optionButtonSelected: {
    backgroundColor: '#02A9FF',
    borderColor: '#02A9FF',
  },
  optionText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
  optionTextSelected: {
    color: '#000',
    fontWeight: '600',
  },
  optionButtonDisabled: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  optionTextDisabled: {
    color: 'rgba(255, 255, 255, 0.4)',
  },
  settingNote: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 8,
  },
  sliderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sliderLabel: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
    minWidth: 30,
    textAlign: 'center',
  },
  slider: {
    flex: 1,
    height: 20,
    position: 'relative',
    justifyContent: 'center',
  },
  sliderTrack: {
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 2,
  },
  sliderThumb: {
    position: 'absolute',
    width: 16,
    height: 16,
    backgroundColor: '#02A9FF',
    borderRadius: 8,
    top: 2,
    marginLeft: -8,
  },
});
