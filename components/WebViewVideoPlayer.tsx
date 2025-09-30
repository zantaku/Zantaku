import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions, StatusBar, ScrollView, DeviceEventEmitter } from 'react-native';
import { WebView } from 'react-native-webview';
import { useRouter, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FontAwesome5 } from '@expo/vector-icons';
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

interface WebViewVideoPlayerProps {
  onTimeUpdate?: (time: number) => void;
  isPipSupported?: boolean;
  isInPipMode?: boolean;
}

export default function WebViewVideoPlayer({ onTimeUpdate, isPipSupported: propIsPipSupported, isInPipMode: propIsInPipMode }: WebViewVideoPlayerProps) {
  const router = useRouter();
  const params = useLocalSearchParams();
  const webViewRef = useRef<WebView>(null);
  
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
  
  // Settings state
  const [showSettings, setShowSettings] = useState(false);
  const [selectedSubtitle, setSelectedSubtitle] = useState(0);
  const [selectedAudioTrack, setSelectedAudioTrack] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [subtitleSize, setSubtitleSize] = useState(16);
  const [subtitleOpacity, setSubtitleOpacity] = useState(1.0);
  const [subtitlePosition, setSubtitlePosition] = useState(0.8);
  const [subtitlesEnabled, setSubtitlesEnabled] = useState(true);
  
  // Chapter menu state
  const [showChapterMenu, setShowChapterMenu] = useState(false);
  const [chapterMenuPosition, setChapterMenuPosition] = useState({ x: 0, y: 0 });

  // Load video data from AsyncStorage
  useEffect(() => {
    const loadVideoData = async () => {
      try {
        const dataKey = params.dataKey as string;
        if (!dataKey) {
          throw new Error('No data key provided');
        }

        console.log('[WEBVIEW-PLAYER] 📱 Loading video data with key:', dataKey);
        const storedData = await AsyncStorage.getItem(dataKey);
        
        if (!storedData) {
          throw new Error('No video data found');
        }

        const data: VideoData = JSON.parse(storedData);
        console.log('[WEBVIEW-PLAYER] ✅ Loaded video data:', {
          provider: data.provider,
          hasZencloudData: !!data.zencloudData,
          subtitlesCount: data.subtitles?.length || 0,
          hasTimings: !!data.timings,
          audioType: data.audioType
        });

        setVideoData(data);
        setLoading(false);
      } catch (err) {
        console.error('[WEBVIEW-PLAYER] ❌ Error loading video data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load video data');
        setLoading(false);
      }
    };

    loadVideoData();
  }, [params.dataKey]);

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
        console.log('[WEBVIEW-PLAYER] 💾 Settings saved');
      } catch (error) {
        console.warn('[WEBVIEW-PLAYER] ⚠️ Failed to save settings:', error);
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
          console.log('[WEBVIEW-PLAYER] ✅ Settings loaded');
        }
      } catch (error) {
        console.warn('[WEBVIEW-PLAYER] ⚠️ Failed to load settings:', error);
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

  // Send audio track command to WebView when selectedAudioTrack changes
  useEffect(() => {
    if (webViewRef.current && videoData) {
      console.log('[WEBVIEW-PLAYER] 🎵 Sending audio track command:', selectedAudioTrack);
      // Add a small delay to ensure HLS manifest is loaded
      setTimeout(() => {
        webViewRef.current?.postMessage(JSON.stringify({
          type: 'setAudioTrack',
          trackIndex: selectedAudioTrack
        }));
      }, 500);
    }
  }, [selectedAudioTrack, videoData]);

  // Send subtitle track command to WebView when selectedSubtitle changes
  useEffect(() => {
    if (webViewRef.current && videoData) {
      console.log('[WEBVIEW-PLAYER] 🎞️ Sending subtitle track command:', selectedSubtitle);
      webViewRef.current.postMessage(JSON.stringify({
        type: 'setSubtitleTrack',
        trackIndex: selectedSubtitle
      }));
    }
  }, [selectedSubtitle, videoData]);

   // Cleanup on unmount
   useEffect(() => {
     return () => {
       if (controlsTimeoutRef.current) {
         clearTimeout(controlsTimeoutRef.current);
       }
     };
   }, []);

   // Control visibility management (optimized)
   const showControlsTemporarily = useCallback(() => {
     setShowControls(true);
     if (controlsTimeoutRef.current) {
       clearTimeout(controlsTimeoutRef.current);
     }
     controlsTimeoutRef.current = setTimeout(() => {
       setShowControls(false);
     }, 3000);
   }, []);

   // Throttle utility for performance optimization
   const throttle = (func: Function, limit: number) => {
     let inThrottle: boolean;
     return function(this: any, ...args: any[]) {
       if (!inThrottle) {
         func.apply(this, args);
         inThrottle = true;
         setTimeout(() => inThrottle = false, limit);
       }
     }
   };

   // Throttled position update (reduces re-renders)
   const throttledSetPosition = useRef(
     throttle((pos: number) => {
       setPosition(pos);
     }, 100) // Update position max 10 times per second
   ).current;

   // WebView message handler (optimized with throttling)
   const handleWebViewMessage = useCallback((event: any) => {
     try {
       const data = JSON.parse(event.nativeEvent.data);
       
       switch (data.type) {
        case 'playbackStatus':
          // Throttle position updates to reduce re-renders
          if (data.position !== undefined) {
            throttledSetPosition(data.position);
            // Call the onTimeUpdate callback for subtitle overlay
            onTimeUpdate?.(data.position);
            
            // Emit time update event for parent player component
            if (data.duration !== undefined && data.duration > 0) {
              DeviceEventEmitter.emit('playerTimeUpdate', {
                currentTime: data.position,
                duration: data.duration
              });
            }
          }
          if (data.isPlaying !== undefined) {
            setIsPlaying(data.isPlaying);
          }
          // Always update duration if provided (remove stale closure issue)
          if (data.duration !== undefined && data.duration !== null && !isNaN(data.duration) && data.duration > 0) {
            console.log('[WEBVIEW-PLAYER] 📊 Received duration from WebView:', data.duration);
            setDuration(prevDuration => {
              // Only update if duration actually changed to prevent unnecessary re-renders
              if (data.duration !== prevDuration) {
                console.log('[WEBVIEW-PLAYER] 📊 Duration updated:', prevDuration, '->', data.duration);
                // Emit duration update event
                DeviceEventEmitter.emit('playerDuration', data.duration);
                return data.duration;
              }
              return prevDuration;
            });
          }
          break;
         case 'error':
           console.error('[WEBVIEW-PLAYER] ❌ Video error:', data.message);
           setError(data.message);
           break;
         case 'ready':
           console.log('[WEBVIEW-PLAYER] ✅ Video player ready');
           break;
       }
     } catch {
       // Silent fail for performance
     }
   }, [onTimeUpdate, throttledSetPosition]);

  // Send commands to WebView (optimized)
  const sendCommand = useCallback((command: any) => {
    if (webViewRef.current && webViewRef.current.postMessage) {
      try {
        webViewRef.current.postMessage(JSON.stringify(command));
      } catch {
        // Silent fail for performance
      }
    }
  }, []);

  // Playback controls
  const togglePlayPause = useCallback(() => {
    console.log('[WEBVIEW-PLAYER]', isPlaying ? '⏸️ Pausing video...' : '▶️ Playing video...');
    sendCommand({ type: 'togglePlayPause' });
    showControlsTemporarily();
  }, [sendCommand, showControlsTemporarily, isPlaying]);

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

  const seekTo = useCallback((seconds: number) => {
    // Don't clamp - let WebView handle it with video.duration
    console.log('[WEBVIEW-PLAYER] 🎯 React Native seekTo:', formatTime(seconds));
    
    // Immediately update position for instant visual feedback (optimistic UI)
    setPosition(seconds);
    
    // Send seek command to WebView - HTML will clamp to video.duration
    sendCommand({ type: 'seekTo', position: seconds });
    
    showControlsTemporarily();
  }, [sendCommand, showControlsTemporarily, formatTime]);

  const skip = (seconds: number) => {
    // Don't clamp here - let WebView handle bounds
    const newPosition = position + seconds;
    seekTo(newPosition);
  };

  // Picture-in-Picture handler
  const handleEnterPip = useCallback(async () => {
    console.log('[WEBVIEW-PLAYER] 🔍 PiP button pressed - checking support:', isPipSupported);
    
    if (!isPipSupported) {
      console.warn('[WEBVIEW-PLAYER] ⚠️ PiP not supported on this device');
      return;
    }

    try {
      console.log('[WEBVIEW-PLAYER] 📱 Entering Picture-in-Picture mode...');
      const success = await enterPipMode({ width: 16, height: 9 });
      
      if (success) {
        console.log('[WEBVIEW-PLAYER] ✅ Successfully entered PiP mode');
        // Auto-play when entering PiP mode if paused
        if (!isPlaying) {
          sendCommand({ type: 'togglePlayPause' });
        }
      } else {
        console.error('[WEBVIEW-PLAYER] ❌ Failed to enter PiP mode');
      }
    } catch (error) {
      console.error('[WEBVIEW-PLAYER] ❌ Error entering PiP mode:', error);
    }
  }, [isPipSupported, enterPipMode, isPlaying, sendCommand]);

  // Debug PiP support
  useEffect(() => {
    console.log('[WEBVIEW-PLAYER] 🔍 PiP Debug Info:', {
      propIsPipSupported,
      hookIsPipSupported,
      finalIsPipSupported: isPipSupported,
      propIsInPipMode,
      hookIsInPipMode,
      finalIsInPipMode: isInPipMode
    });
  }, [propIsPipSupported, hookIsPipSupported, isPipSupported, propIsInPipMode, hookIsInPipMode, isInPipMode]);

  const setPlaybackRate = useCallback((rate: number) => {
    sendCommand({ type: 'setPlaybackRate', rate });
  }, [sendCommand]);


   // YouTube-style seeking with tap and drag support
   const progressRef = useRef<View>(null);
   const [progressBarWidth, setProgressBarWidth] = useState(width - 120);
   const lastSeekTime = useRef(0);
   const isScrubbingRef = useRef(false);

   const percentFromX = useCallback((x: number) => {
     if (!progressBarWidth || duration <= 0) return 0;
     const p = Math.max(0, Math.min(1, x / progressBarWidth));
     return p;
   }, [progressBarWidth, duration]);

   const seekToPercent = useCallback((p: number) => {
     // Compute target even if duration is unknown - let WebView clamp
     const target = p * (duration || 0);
     
     console.log('[WEBVIEW-PLAYER] 🎯 YouTube-style seeking to:', formatTime(target), 'Progress:', p.toFixed(3));
     
     // Optimistic UI - update position immediately for instant feedback
     setPosition(target);
     
     // Throttle seeks during drag to prevent overwhelming the video
     const now = Date.now();
     if (now - lastSeekTime.current > 150) { // 150ms throttle
       sendCommand({ type: 'seekTo', position: target });
       lastSeekTime.current = now;
     }
     
     showControlsTemporarily();
   }, [duration, sendCommand, showControlsTemporarily, formatTime]);

   const handleResponderGrant = useCallback((event: any) => {
     if (!duration || duration <= 0) return;
     isScrubbingRef.current = true;
     sendCommand({ type: 'beginScrub' });
     const p = percentFromX(event.nativeEvent.locationX);
     seekToPercent(p);
     
     // Show chapter menu if chapters available
     if (videoData?.zencloudData?.chapters && videoData.zencloudData.chapters.length > 0) {
       setChapterMenuPosition({ x: event.nativeEvent.pageX, y: event.nativeEvent.pageY });
       setShowChapterMenu(true);
     }
   }, [duration, percentFromX, seekToPercent, sendCommand, videoData]);

   const handleResponderMove = useCallback((event: any) => {
     if (!isScrubbingRef.current) return;
     const p = percentFromX(event.nativeEvent.locationX);
     seekToPercent(p);
   }, [percentFromX, seekToPercent]);

   const handleResponderRelease = useCallback((event: any) => {
     if (!isScrubbingRef.current) return;
     
     const p = percentFromX(event.nativeEvent.locationX);
     
     // Final seek on release (no throttle)
     const target = p * duration;
     
     console.log('[WEBVIEW-PLAYER] 🎯 Final seek on release to:', formatTime(target));
     
     setPosition(target);
     sendCommand({ type: 'seekTo', position: target });
     sendCommand({ type: 'endScrub' });
     
     isScrubbingRef.current = false;
     setShowChapterMenu(false); // Hide chapter menu on release
     showControlsTemporarily();
   }, [percentFromX, duration, sendCommand, showControlsTemporarily, formatTime]);

  // Apply settings changes
  useEffect(() => {
    if (videoData) {
      setPlaybackRate(playbackSpeed);
    }
  }, [playbackSpeed, videoData, setPlaybackRate]);

   // Generate HTML for video player (memoized for performance)
   const generateHTML = useCallback(() => {
     if (!videoData) return '';

     const videoUrl = videoData.zencloudData?.m3u8_url || videoData.source;
     const subtitles = videoData.zencloudData?.subtitles || [];

     console.log('[WEBVIEW-PLAYER] 🎬 Generating HTML with video URL:', videoUrl.substring(0, 50) + '...');
     console.log('[WEBVIEW-PLAYER] 🎞️ Subtitles available:', subtitles.length);
     
     // Log subtitle details for debugging
     subtitles.forEach((subtitle, index) => {
       console.log(`[WEBVIEW-PLAYER] 🎞️ Subtitle ${index + 1}:`, {
         language: subtitle.language_name || subtitle.language,
         format: subtitle.format,
         url: subtitle.url.substring(0, 50) + '...',
         isDefault: subtitle.is_default
       });
     });
     
    // Check if we have ASS subtitles that need conversion
    const assSubtitles = subtitles.filter(sub => sub.format === 'ass');
    if (assSubtitles.length > 0) {
      console.log('[WEBVIEW-PLAYER] 🔄 ASS subtitles detected - will convert to VTT format for better compatibility');
    }

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
        <script src="https://cdn.jsdelivr.net/npm/hls.js@latest"></script>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          
          body {
            background: #000;
            overflow: hidden;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          }
          
          #videoContainer {
            position: relative;
            width: 100vw;
            height: 100vh;
            background: #000;
          }
          
           #video {
             width: 100%;
             height: 100%;
             object-fit: contain;
             outline: none;
             border: none;
           }
           
           #video::-webkit-media-controls {
             display: none !important;
           }
           
           #video::-webkit-media-controls-panel {
             display: none !important;
           }
           
           #video::-webkit-media-controls-play-button {
             display: none !important;
           }
           
           #video::-webkit-media-controls-timeline {
             display: none !important;
           }
           
           #video::-webkit-media-controls-current-time-display {
             display: none !important;
           }
           
           #video::-webkit-media-controls-time-remaining-display {
             display: none !important;
           }
           
           #video::-webkit-media-controls-mute-button {
             display: none !important;
           }
           
           #video::-webkit-media-controls-volume-slider {
             display: none !important;
           }
           
           #video::-webkit-media-controls-fullscreen-button {
             display: none !important;
           }
           
           /* Hide controls on all browsers */
           video::-webkit-media-controls-overlay-play-button {
             display: none !important;
           }
           
           video::-webkit-media-controls-enclosure {
             display: none !important;
           }
           
           /* Firefox */
           video::-moz-media-controls {
             display: none !important;
           }
           
           /* Edge/IE */
           video::-ms-media-controls {
             display: none !important;
           }
          
          #controls {
            position: absolute;
            bottom: 0;
            left: 0;
            right: 0;
            background: linear-gradient(transparent, rgba(0,0,0,0.8));
            padding: 20px;
            color: white;
            display: none !important;
          }
          
          #progressBar {
            width: 100%;
            height: 4px;
            background: rgba(255,255,255,0.3);
            border-radius: 2px;
            margin: 10px 0;
            cursor: pointer;
          }
          
          #progressFill {
            height: 100%;
            background: #02A9FF;
            border-radius: 2px;
            width: 0%;
          }
          
          #timeDisplay {
            display: flex;
            justify-content: space-between;
            font-size: 14px;
            margin-top: 10px;
          }
          
          #playButton {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(0,0,0,0.6);
            border: none;
            color: white;
            font-size: 48px;
            padding: 20px;
            border-radius: 50%;
            cursor: pointer;
            display: none !important;
          }
          
          .subtitle {
            position: absolute;
            bottom: 80px;
            left: 20px;
            right: 20px;
            text-align: center;
            color: white;
            font-size: 16px;
            font-weight: 600;
            background: rgba(0,0,0,0.7);
            padding: 8px 12px;
            border-radius: 6px;
            display: none;
          }
          
          #subtitleToggle {
            position: absolute;
            right: 10px;
            top: 10px;
            z-index: 1000;
            background: rgba(0,0,0,0.7);
            border: none;
            color: white;
            padding: 8px 12px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 16px;
            display: none !important;
          }
        </style>
      </head>
      <body>
         <div id="videoContainer">
             <video id="video" preload="metadata" playsinline unmuted>
               <!-- Subtitle tracks will be added dynamically after ASS conversion -->
             </video>
          
          <!-- All WebView controls hidden - using React Native overlay instead -->
          <button id="playButton" style="display: none !important;">▶</button>
          <div class="subtitle" id="subtitle"></div>
          
          <div id="controls" style="display: none !important;">
            <div id="progressBar" onclick="seek(event)">
              <div id="progressFill"></div>
            </div>
            <div id="timeDisplay">
              <span id="currentTime">0:00</span>
              <span id="duration">0:00</span>
            </div>
            <button id="subtitleToggle" class="control-btn" title="Toggle Subtitles">📝</button>
          </div>
        </div>

         <script>
           console.log('[WEBVIEW-PLAYER] 🚀 JavaScript execution started');
           
           const video = document.getElementById('video');
           const playButton = document.getElementById('playButton');
           const subtitleToggle = document.getElementById('subtitleToggle');
           const controls = document.getElementById('controls');
           const progressBar = document.getElementById('progressBar');
           const progressFill = document.getElementById('progressFill');
           const currentTimeSpan = document.getElementById('currentTime');
           const durationSpan = document.getElementById('duration');
           const subtitle = document.getElementById('subtitle');
           
           console.log('[WEBVIEW-PLAYER] 📊 DOM elements found:', {
             video: !!video,
             playButton: !!playButton,
             subtitleToggle: !!subtitleToggle,
             controls: !!controls
           });
           
           // Completely disable native video controls
           video.controls = false;
           video.controlsList = 'nodownload nofullscreen noremoteplayback';
           video.disablePictureInPicture = true;
           video.setAttribute('controlsList', 'nodownload nofullscreen noremoteplayback');
           video.setAttribute('disablePictureInPicture', 'true');
          
          let controlsTimeout;
          
          // Send message to React Native
          function sendMessage(message) {
            window.ReactNativeWebView.postMessage(JSON.stringify(message));
          }
          
          // Format time
          function formatTime(seconds) {
            const hours = Math.floor(seconds / 3600);
            const minutes = Math.floor((seconds % 3600) / 60);
            const secs = Math.floor(seconds % 60);
            
            if (hours > 0) {
              return hours + ':' + minutes.toString().padStart(2, '0') + ':' + secs.toString().padStart(2, '0');
            }
            return minutes + ':' + secs.toString().padStart(2, '0');
          }
          
          // Show controls temporarily (disabled - using React Native overlay)
          function showControls() {
            // WebView controls are disabled - React Native overlay handles this
            return;
          }
          
          // Hide controls (disabled - using React Native overlay)
          function hideControls() {
            // WebView controls are disabled - React Native overlay handles this
            return;
          }
          
           // Immediate seek function for responsive seeking
           function seek(event) {
             const rect = progressBar.getBoundingClientRect();
             const pos = (event.clientX - rect.left) / rect.width;
             const newTime = pos * video.duration;
             
             console.log('[WEBVIEW-PLAYER] 🎯 WebView seek - Position:', pos.toFixed(3), 'Time:', newTime.toFixed(2), 'Duration:', video.duration.toFixed(2));
             
             // Pause video during seek to prevent stuttering
             const wasPlaying = !video.paused;
             if (wasPlaying) {
               video.pause();
             }
             
             // Seek immediately
             video.currentTime = newTime;
             
             // Resume playback if it was playing
             if (wasPlaying) {
               // Use requestAnimationFrame for smoother resume
               requestAnimationFrame(() => {
                 video.play().catch(() => {});
               });
             }
             
             // Send position update to React Native
             sendMessage({ type: 'playbackStatus', isPlaying: wasPlaying, position: newTime, duration: video.duration });
           }
          
           // Video event listeners (optimized)
           video.addEventListener('loadstart', () => {
             sendMessage({ type: 'ready' });
           });
           
           video.addEventListener('loadedmetadata', () => {
             durationSpan.textContent = formatTime(video.duration);
             sendMessage({ type: 'playbackStatus', isPlaying: false, position: 0, duration: video.duration });
           });
           
           // Optimized timeupdate with throttling and meaningful delta detection
           let lastSentPos = -1;
           let lastIsPlaying = null;
           const SEND_INTERVAL_MS = 500; // 2 fps max
           let lastSend = 0;
           let sentInitialDuration = false;
           
           video.addEventListener('timeupdate', () => {
             const now = Date.now();
             if (now - lastSend < SEND_INTERVAL_MS) return;
             lastSend = now;

             const pos = video.currentTime;
             if (Math.abs(pos - lastSentPos) < 0.25 && lastIsPlaying === !video.paused) return;

             lastSentPos = pos;
             lastIsPlaying = !video.paused;

             const dur = video.duration || 0;
             const progress = (pos / dur) * 100;
             progressFill.style.width = progress + '%';
             currentTimeSpan.textContent = formatTime(pos);
             
             // Send duration at least once even if other events failed
             if (!sentInitialDuration && dur > 0) {
               sentInitialDuration = true;
             }
             
             sendMessage({ type: 'playbackStatus', isPlaying: lastIsPlaying, position: pos, duration: dur });
           });
          
          video.addEventListener('play', () => {
            playButton.style.display = 'none';
            sendMessage({ type: 'playbackStatus', isPlaying: true, position: video.currentTime, duration: video.duration });
          });
          
          video.addEventListener('pause', () => {
            playButton.style.display = 'block';
            sendMessage({ type: 'playbackStatus', isPlaying: false, position: video.currentTime, duration: video.duration });
          });
          
          video.addEventListener('error', (e) => {
            console.error('Video error:', e);
            console.error('Video error details:', video.error);
            sendMessage({ type: 'error', message: 'Video playback error: ' + (video.error?.message || 'Unknown error') });
          });
          
          video.addEventListener('loadstart', () => {
            console.log('Video load started');
          });
          
          video.addEventListener('canplay', () => {
            console.log('Video can play');
          });
          
          video.addEventListener('seeked', () => {
            console.log('[WEBVIEW-PLAYER] 🎯 Video seeked to:', video.currentTime.toFixed(2));
            // Send updated position after seek completes
            sendMessage({ type: 'playbackStatus', isPlaying: !video.paused, position: video.currentTime, duration: video.duration });
          });
          
          video.addEventListener('loadeddata', () => {
            console.log('Video data loaded');
          });
          
          // Click to show/hide controls (disabled - using React Native overlay)
          video.addEventListener('click', () => {
            // WebView controls are disabled - React Native overlay handles this
            return;
          });
          
          // Play button (disabled - using React Native overlay)
          playButton.addEventListener('click', () => {
            // WebView controls are disabled - React Native overlay handles this
            return;
          });
          
          // Subtitle toggle functionality (disabled - using React Native overlay)
          subtitleToggle.addEventListener('click', () => {
            // WebView controls are disabled - React Native overlay handles this
            return;
          });
          
          // Listen for messages from React Native on both window and document
          function __bridgeHandler(evt) {
            try {
              const command = JSON.parse(evt.data);
              handleCommand(command);
            } catch (e) {
              console.warn('[WEBVIEW-PLAYER] Failed to parse command:', e);
            }
          }
          window.addEventListener('message', __bridgeHandler);
          document.addEventListener('message', __bridgeHandler); // ✅ catches Android RN posts
          
          // Handle commands from React Native
          let wasPlayingBeforeScrub = false;
          
          function handleCommand(command) {
            switch (command.type) {
              case 'togglePlayPause':
                if (video.paused) {
                  video.play().catch(() => {
                    // Fallback: nudge with micro-seek to reattach decoder
                    try {
                      const t = video.currentTime;
                      video.currentTime = Math.max(0, t - 0.001);
                      video.play().catch(() => {});
                    } catch {}
                  });
                } else {
                  video.pause();
                }
                break;
              case 'beginScrub':
                wasPlayingBeforeScrub = !video.paused;
                if (wasPlayingBeforeScrub) video.pause();
                break;
              case 'endScrub':
                if (wasPlayingBeforeScrub) video.play().catch(() => {});
                wasPlayingBeforeScrub = false;
                break;
              case 'seekTo': {
                // Clamp with video.duration (not RN's duration)
                const t = Math.max(0, Math.min(video.duration || 0, command.position || 0));
                console.log('[WEBVIEW-PLAYER] 🎯 YouTube-style seek to:', t.toFixed(2), 'Duration:', (video.duration || 0).toFixed(2));
                
                // MP4-like seek - hls.js picks correct fragments
                video.currentTime = t;
                
                // Confirm back to RN after seek completes
                video.addEventListener('seeked', function onSeeked() {
                  video.removeEventListener('seeked', onSeeked);
                  sendMessage({ type: 'playbackStatus', isPlaying: !video.paused, position: video.currentTime, duration: video.duration });
                }, { once: true });
                break;
              }
              case 'setPlaybackRate':
                video.playbackRate = command.rate;
                break;
              case 'setAudioTrack':
                // Audio track switching for HLS
                console.log('[WEBVIEW-PLAYER] 🎵 Setting audio track to:', command.trackIndex);
                console.log('[WEBVIEW-PLAYER] 🎵 HLS available:', !!hls, 'Audio tracks:', hls?.audioTracks?.length || 0);
                
                // Store the current selection globally
                window.selectedAudioTrack = command.trackIndex;
                
                if (hls && hls.audioTracks && hls.audioTracks.length > command.trackIndex) {
                  // Use hls.js audio track switching
                  console.log('[WEBVIEW-PLAYER] 🎵 Switching to HLS audio track:', command.trackIndex, 'of', hls.audioTracks.length);
                  console.log('[WEBVIEW-PLAYER] 🎵 Track details:', hls.audioTracks[command.trackIndex]);
                  
                  // Set the audio track
                  hls.audioTrack = command.trackIndex;
                  
                  // Verify the switch
                  setTimeout(() => {
                    console.log('[WEBVIEW-PLAYER] 🎵 Current audio track after switch:', hls.audioTrack);
                    console.log('[WEBVIEW-PLAYER] 🎵 Current track details:', hls.audioTracks[hls.audioTrack]);
                  }, 100);
                  
                } else {
                  console.log('[WEBVIEW-PLAYER] 🎵 Audio tracks not ready yet, queuing selection:', command.trackIndex);
                  pendingAudioTrack = command.trackIndex;
                }
                
                if (video.audioTracks && video.audioTracks.length > command.trackIndex) {
                  // Fallback to native audio tracks
                  console.log('[WEBVIEW-PLAYER] 🎵 Using native audio tracks:', video.audioTracks.length);
                  for (let i = 0; i < video.audioTracks.length; i++) {
                    video.audioTracks[i].enabled = i === command.trackIndex;
                  }
                } else if (video.videoTracks && video.videoTracks.length > command.trackIndex) {
                  // Fallback to video tracks
                  console.log('[WEBVIEW-PLAYER] 🎵 Using video tracks:', video.videoTracks.length);
                  for (let i = 0; i < video.videoTracks.length; i++) {
                    video.videoTracks[i].selected = i === command.trackIndex;
                  }
                } else {
                  console.warn('[WEBVIEW-PLAYER] ⚠️ No audio tracks available for switching to:', command.trackIndex);
                }
                break;
              case 'setSubtitleTrack':
                // Subtitle track switching with queue support
                console.log('[WEBVIEW-PLAYER] 🎞️ Setting subtitle track to:', command.trackIndex);
                if (video.textTracks && video.textTracks.length > command.trackIndex) {
                  for (let i = 0; i < video.textTracks.length; i++) {
                    const isActive = i === command.trackIndex;
                    video.textTracks[i].mode = isActive ? 'showing' : 'hidden';
                    if (isActive) {
                      console.log('[WEBVIEW-PLAYER] 🎞️ Activated subtitle track:', {
                        index: i,
                        language: video.textTracks[i].language,
                        label: video.textTracks[i].label,
                        kind: video.textTracks[i].kind
                      });
                    }
                  }
                  pendingSubtitleTrack = null; // Clear pending since we applied it
                } else {
                  console.log('[WEBVIEW-PLAYER] 🎞️ Subtitle tracks not ready, queuing selection:', command.trackIndex);
                  pendingSubtitleTrack = command.trackIndex;
                }
                break;
            }
          }
          
          // Initialize HLS.js
          let hls;
          let pendingAudioTrack = null;
          let pendingSubtitleTrack = null;
          const trackBlobUrls = [];
          const videoUrl = '${videoUrl}';
          
          console.log('Initializing video with URL:', videoUrl);
          
          // Subtitle data
          const subtitles = ${JSON.stringify(subtitles)};
          
          // Improved ASS to VTT conversion with Format field support
          function convertASSToVTT(assText) {
            const lines = assText.split('\\n');
            let inEvents = false;
            let fmt = [];
            const cues = [];
            
            for (const raw of lines) {
              const line = raw.trim();
              if (line === '[Events]') { 
                inEvents = true; 
                continue; 
              }
              if (inEvents && line.startsWith('Format:')) {
                fmt = line.slice(7).split(',').map(s => s.trim());
                continue;
              }
              if (inEvents && line.startsWith('Dialogue:')) {
                const payload = line.slice(9).split(',');
                const idx = (name) => Math.max(0, fmt.indexOf(name));
                const start = parseASSTime(payload[idx('Start')] || payload[1]);
                const end = parseASSTime(payload[idx('End')] || payload[2]);
                const text = payload.slice(idx('Text') || 9).join(',')
                  .replace(/\\{[^}]*\\}/g, '')
                  .replace(/\\\\N/g, '\\n')
                  .replace(/\\\\n/g, '\\n')
                  .trim();
                
                if (!isNaN(start) && !isNaN(end) && end > start && text) {
                  cues.push({ start, end, text });
                }
              } else if (inEvents && line.startsWith('[')) {
                // Next section - stop scanning
                break;
              }
            }
            
            // Generate VTT
            let vtt = 'WEBVTT\\n\\n';
            let i = 1;
            for (const cue of cues) {
              vtt += i++ + '\\n';
              vtt += formatVTTTime(cue.start) + ' --> ' + formatVTTTime(cue.end) + '\\n';
              vtt += cue.text + '\\n\\n';
            }
            
            return vtt;
          }
          
          function parseASSTime(t) {
            const m = (t || '').trim().match(/(\\d+):(\\d{2}):(\\d{2})[.,](\\d{2})/);
            if (!m) return NaN;
            return (+m[1]) * 3600 + (+m[2]) * 60 + (+m[3]) + (+m[4]) / 100;
          }
          
          function formatVTTTime(sec) {
            const h = String(Math.floor(sec / 3600)).padStart(2, '0');
            const m = String(Math.floor((sec % 3600) / 60)).padStart(2, '0');
            const s = String(Math.floor(sec % 60)).padStart(2, '0');
            const ms = String(Math.floor((sec % 1) * 1000)).padStart(3, '0');
            return h + ':' + m + ':' + s + '.' + ms;
          }
          
          // Apply pending subtitle track selection
          function applyPendingSubtitleTrackIfAny() {
            if (pendingSubtitleTrack != null && video.textTracks?.length > pendingSubtitleTrack) {
              console.log('[WEBVIEW-PLAYER] 🎞️ Applying pending subtitle track:', pendingSubtitleTrack);
              for (let i = 0; i < video.textTracks.length; i++) {
                video.textTracks[i].mode = i === pendingSubtitleTrack ? 'showing' : 'hidden';
              }
              pendingSubtitleTrack = null;
            }
          }

          // Clear old tracks and revoke blob URLs
          function clearOldTracks() {
            const oldTracks = video.querySelectorAll('track');
            oldTracks.forEach(t => t.remove());
            console.log('[WEBVIEW-PLAYER] 🧹 Cleared', oldTracks.length, 'old tracks');
            
            // Revoke blob URLs to free memory
            while (trackBlobUrls.length) {
              const url = trackBlobUrls.pop();
              try { 
                URL.revokeObjectURL(url); 
                console.log('[WEBVIEW-PLAYER] 🧹 Revoked blob URL:', url.substring(0, 50) + '...');
              } catch (e) {
                console.warn('[WEBVIEW-PLAYER] ⚠️ Failed to revoke blob URL:', e);
              }
            }
          }

          // Subtitle caching with IndexedDB
          const subtitleCache = {
            async get(key) {
              try {
                const db = await this.openDB();
                const transaction = db.transaction(['subtitles'], 'readonly');
                const store = transaction.objectStore('subtitles');
                const result = await store.get(key);
                return result?.vttContent || null;
              } catch (e) {
                console.warn('[WEBVIEW-PLAYER] ⚠️ Cache get failed:', e);
                return null;
              }
            },
            
            async set(key, vttContent) {
              try {
                const db = await this.openDB();
                const transaction = db.transaction(['subtitles'], 'readwrite');
                const store = transaction.objectStore('subtitles');
                await store.put({ key, vttContent, timestamp: Date.now() });
              } catch (e) {
                console.warn('[WEBVIEW-PLAYER] ⚠️ Cache set failed:', e);
              }
            },
            
            async openDB() {
              return new Promise((resolve, reject) => {
                const request = indexedDB.open('subtitleCache', 1);
                request.onerror = () => reject(request.error);
                request.onsuccess = () => resolve(request.result);
                request.onupgradeneeded = (event) => {
                  const db = event.target.result;
                  if (!db.objectStoreNames.contains('subtitles')) {
                    db.createObjectStore('subtitles', { keyPath: 'key' });
                  }
                };
              });
            }
          };

          // Improved subtitle loading with caching
          async function loadSubtitles() {
            console.log('[WEBVIEW-PLAYER] 🎞️ Loading subtitles for', subtitles.length, 'tracks');
            
            // Clear old tracks and revoke blob URLs
            clearOldTracks();
            
            if (subtitles.length === 0) {
              console.log('[WEBVIEW-PLAYER] ℹ️ No subtitles to load');
              return;
            }
            
            // Load each subtitle track
            for (let i = 0; i < subtitles.length; i++) {
              const subtitle = subtitles[i];
              console.log('[WEBVIEW-PLAYER] 🎞️ Loading track', i + 1, ':', subtitle.language_name || subtitle.language);
              
              try {
                // Create cache key from URL hash
                const cacheKey = 'vtt:' + btoa(subtitle.url).replace(/[^a-zA-Z0-9]/g, '');
                
                // Try to get from cache first
                let vttContent = await subtitleCache.get(cacheKey);
                
                if (!vttContent) {
                  // Fetch subtitle content
                  const response = await fetch(subtitle.url);
                  if (!response.ok) throw new Error('HTTP ' + response.status);
                  
                  const subtitleText = await response.text();
                  console.log('[WEBVIEW-PLAYER] 📄 Loaded', subtitleText.length, 'characters');
                  
                  // Convert ASS to VTT if needed
                  if (subtitle.format === 'ass') {
                    console.log('[WEBVIEW-PLAYER] 🔄 Converting ASS to VTT');
                    vttContent = convertASSToVTT(subtitleText);
                  } else if (subtitle.format === 'vtt') {
                    vttContent = subtitleText;
                  } else {
                    console.warn('[WEBVIEW-PLAYER] ⚠️ Unsupported format:', subtitle.format);
                    continue;
                  }
                  
                  // Cache the converted VTT
                  await subtitleCache.set(cacheKey, vttContent);
                  console.log('[WEBVIEW-PLAYER] 💾 Cached VTT for future use');
                } else {
                  console.log('[WEBVIEW-PLAYER] ⚡ Using cached VTT');
                }
                
                // Create blob URL and track element
                const blob = new Blob([vttContent], { type: 'text/vtt' });
                const blobUrl = URL.createObjectURL(blob);
                trackBlobUrls.push(blobUrl); // Track for cleanup
                
                const track = document.createElement('track');
                track.kind = 'subtitles';
                track.src = blobUrl;
                track.srclang = subtitle.language || 'en';
                track.label = subtitle.language_name || subtitle.language || 'Unknown';
                track.default = (i === 0 || subtitle.is_default);
                
                video.appendChild(track);
                console.log('[WEBVIEW-PLAYER] ✅ Added track:', track.label);
                
              } catch (error) {
                console.error('[WEBVIEW-PLAYER] ❌ Failed to load track', i + 1, ':', error);
              }
            }
            
            console.log('[WEBVIEW-PLAYER] 🎞️ Subtitle loading complete. Tracks:', video.textTracks.length);
            
            // Apply any pending subtitle track selection
            applyPendingSubtitleTrackIfAny();
          }
          
          
          // Initialize video player
          function initializePlayer() {
            console.log('[WEBVIEW-PLAYER] 🚀 Initializing video player');
            initializeVideo();
          }
          
          function initializeVideo() {
            console.log('[WEBVIEW-PLAYER] 🎬 Starting video initialization');
            
            if (Hls.isSupported()) {
            console.log('HLS.js is supported, initializing...');
             hls = new Hls({
               // Move demuxing off the UI thread
               enableWorker: true,
               
               // This is VOD, not live: keep it simple & smooth
               lowLatencyMode: false,
               
               // Buffer sanely so we don't hoard memory nor starve
               backBufferLength: 15,
               maxBufferLength: 12,
               maxMaxBufferLength: 18,
               maxBufferSize: 20 * 1000 * 1000,
               
               // Let hls drop to a lower level if frames are dropping
               capLevelOnFPSDrop: true,
               fpsDroppedMonitoringPeriod: 5000,
               fpsDroppedMonitoringThreshold: 0.15,
               
               // Don't fetch higher than the player's pixel size
               capLevelToPlayerSize: true,
               
               // Retry strategy that doesn't thrash
               manifestLoadingTimeOut: 8000,
               manifestLoadingMaxRetry: 2,
               levelLoadingTimeOut: 8000,
               levelLoadingMaxRetry: 2,
               fragLoadingTimeOut: 15000,
               fragLoadingMaxRetry: 2,
               
               // Tolerate small gaps after seek for faster resume
               maxBufferHole: 0.5,
               startPosition: -1, // use default, ensures hls respects set currentTime
               
               // Enable software AES for compatibility
               enableSoftwareAES: true
             });
            
            console.log('[WEBVIEW-PLAYER] 🎬 Loading HLS source:', videoUrl);
            hls.loadSource(videoUrl);
            hls.attachMedia(video);
            
            // Add more detailed error logging and recovery
            hls.on(Hls.Events.ERROR, (event, data) => {
              console.error('[WEBVIEW-PLAYER] ❌ HLS Error:', {
                type: data.type,
                details: data.details,
                fatal: data.fatal,
                url: data.url,
                response: data.response
              });
              
              if (data.fatal) {
                switch (data.type) {
                  case Hls.ErrorTypes.NETWORK_ERROR:
                    console.log('[WEBVIEW-PLAYER] 🔄 Fatal network error, trying to recover...');
                    hls.startLoad();
                    break;
                  case Hls.ErrorTypes.MEDIA_ERROR:
                    console.log('[WEBVIEW-PLAYER] 🔄 Fatal media error, trying to recover...');
                    hls.recoverMediaError();
                    break;
                  default:
                    console.error('[WEBVIEW-PLAYER] ❌ Fatal error, cannot recover:', data);
                    sendMessage({ type: 'error', message: 'HLS playback error: ' + data.details });
                    break;
                }
              } else {
                console.warn('[WEBVIEW-PLAYER] ⚠️ Non-fatal HLS error:', data.details);
                
                // Handle specific non-fatal errors
                if (data.details === 'bufferStalledError') {
                  console.log('[WEBVIEW-PLAYER] 🔄 Buffer stalled, trying to recover...');
                  setTimeout(() => {
                    if (video.paused) {
                      video.play().catch(e => console.log('[WEBVIEW-PLAYER] ❌ Recovery play failed:', e));
                    }
                  }, 1000);
                }
              }
            });
            
            hls.on(Hls.Events.MANIFEST_PARSED, () => {
              console.log('[WEBVIEW-PLAYER] ✅ HLS manifest parsed, ready to play');
              
              // Cap auto level for small screens (e.g., limit to 720p level index)
              hls.autoLevelCapping = 3; // Adjust based on your quality levels
              
              // Apply pending audio track selection
              if (pendingAudioTrack !== null && hls.audioTracks.length > pendingAudioTrack) {
                console.log('[WEBVIEW-PLAYER] 🎵 Applying pending audio track:', pendingAudioTrack);
                hls.audioTrack = pendingAudioTrack;
                pendingAudioTrack = null;
              }
              
              // Load subtitles after video is ready
              loadSubtitles().then(() => {
                console.log('[WEBVIEW-PLAYER] ✅ Subtitles loaded successfully');
              }).catch(error => {
                console.error('[WEBVIEW-PLAYER] ❌ Subtitle loading failed:', error);
              });
              
              sendMessage({ type: 'ready' });
              
              // Wait for video metadata to be loaded before sending duration
              const checkDuration = () => {
                if (video.duration && video.duration > 0) {
                  console.log('[WEBVIEW-PLAYER] 📊 Video duration detected:', video.duration);
                  sendMessage({ type: 'playbackStatus', isPlaying: false, position: 0, duration: video.duration });
                } else {
                  // Retry after a short delay, but limit retries
                  setTimeout(checkDuration, 100);
                }
              };
              checkDuration();
              
              // Fallback: also listen for loadedmetadata event
              video.addEventListener('loadedmetadata', () => {
                if (video.duration && video.duration > 0) {
                  console.log('[WEBVIEW-PLAYER] 📊 Duration from loadedmetadata:', video.duration);
                  sendMessage({ type: 'playbackStatus', isPlaying: false, position: 0, duration: video.duration });
                }
              });
              
              // Auto-play after manifest is loaded (with interaction fallback)
              video.play().catch(e => {
                console.warn('[WEBVIEW-PLAYER] ⚠️ Autoplay blocked (normal behavior):', e.message);
                // Don't send error to RN - autoplay blocking is expected, user can manually play
                // Show play button overlay instead
                playButton.style.display = 'block';
              });
            });
            
            // Add timeout for manifest loading
            setTimeout(() => {
              if (!hls.media) {
                console.error('[WEBVIEW-PLAYER] ❌ HLS manifest loading timeout');
                sendMessage({ type: 'error', message: 'HLS manifest loading timeout' });
              }
            }, 15000);
            
            
            // Get available audio tracks
            hls.on(Hls.Events.MANIFEST_PARSED, () => {
              const audioTracks = hls.audioTracks;
              console.log('[WEBVIEW-PLAYER] 🎵 Available audio tracks:', audioTracks.length);
              audioTracks.forEach((track, i) => {
                console.log('[WEBVIEW-PLAYER] 🎵 Audio track ' + i + ':', track.name, track.lang);
              });
              
              // Set the initial audio track based on the current selection
              if (audioTracks.length > 0) {
                const currentTrack = window.selectedAudioTrack || 0;
                console.log('[WEBVIEW-PLAYER] 🎵 Setting initial audio track to:', currentTrack);
                hls.audioTrack = currentTrack;
              }
            });
            
            // Listen for audio track changes
            hls.on(Hls.Events.AUDIO_TRACK_SWITCHED, (event, data) => {
              console.log('[WEBVIEW-PLAYER] 🎵 Audio track switched to:', data.id, 'Details:', data);
              const currentTrack = hls.audioTracks[data.id];
              if (currentTrack) {
                console.log('[WEBVIEW-PLAYER] 🎵 Current track details:', currentTrack.name, currentTrack.lang);
              }
            });
            
            // Safer audio-track apply: re-assert selection when tracks update
            hls.on(Hls.Events.AUDIO_TRACKS_UPDATED, () => {
              if (window.selectedAudioTrack != null && hls.audioTracks?.[window.selectedAudioTrack]) {
                console.log('[WEBVIEW-PLAYER] 🎵 Re-asserting audio track:', window.selectedAudioTrack);
                hls.audioTrack = window.selectedAudioTrack;
              }
            });
            
            // Add subtitle track event listeners
            video.addEventListener('loadstart', function() {
              console.log('[WEBVIEW-PLAYER] 🎞️ Video load started, checking subtitle tracks...');
              console.log('[WEBVIEW-PLAYER] 🎞️ Initial textTracks length:', video.textTracks?.length || 0);
            });
            
            // Check for subtitle tracks after a short delay
            setTimeout(function() {
              console.log('[WEBVIEW-PLAYER] 🎞️ Delayed check - textTracks length:', video.textTracks?.length || 0);
              if (video.textTracks) {
                for (let i = 0; i < video.textTracks.length; i++) {
                  const track = video.textTracks[i];
                  console.log('[WEBVIEW-PLAYER] 🎞️ Track ' + i + ' after delay:', {
                    language: track.language,
                    label: track.label,
                    kind: track.kind,
                    mode: track.mode,
                    readyState: track.readyState,
                    cues: track.cues?.length || 0
                  });
                }
              }
            }, 2000);
            
            video.addEventListener('loadedmetadata', function() {
              console.log('[WEBVIEW-PLAYER] 🎞️ Video metadata loaded, subtitle tracks:', video.textTracks?.length || 0);
              if (video.textTracks) {
                for (let i = 0; i < video.textTracks.length; i++) {
                  const track = video.textTracks[i];
                  console.log('[WEBVIEW-PLAYER] 🎞️ Subtitle track ' + i + ':', {
                    language: track.language,
                    label: track.label,
                    kind: track.kind,
                    mode: track.mode,
                    readyState: track.readyState
                  });
                  
                  // Set the first track as active by default
                  if (i === 0) {
                    track.mode = 'showing';
                    console.log('[WEBVIEW-PLAYER] 🎞️ Activated default subtitle track:', i);
                  }
                  
                  // Listen for cue changes (optimized - no console spam)
                  track.addEventListener('cuechange', function() {
                    // Removed console.log from hot path for performance
                    if (track.activeCues && track.activeCues.length > 0) {
                      const cue = track.activeCues[0];
                      // Only log in debug mode
                      if (window.__DEBUG__) {
                        console.log('[WEBVIEW-PLAYER] 🎞️ Subtitle cue active:', {
                          text: cue.text,
                          startTime: cue.startTime,
                          endTime: cue.endTime
                        });
                      }
                    }
                  });
                  
                  // Listen for track loading
                  track.addEventListener('load', function() {
                    console.log('[WEBVIEW-PLAYER] 🎞️ Subtitle track loaded:', i, track.label);
                  });
                  
                  track.addEventListener('error', function(e) {
                    console.error('[WEBVIEW-PLAYER] ❌ Subtitle track error:', i, e);
                  });
                }
              } else {
                console.warn('[WEBVIEW-PLAYER] ⚠️ No text tracks found on video element');
              }
            });
            
             // Duration updates from LEVEL_LOADED (VOD)
             hls.on(Hls.Events.LEVEL_LOADED, (_e, data) => {
               if (!data.details.live && video.duration > 0) {
                 console.log('[WEBVIEW-PLAYER] 📊 Duration from LEVEL_LOADED:', video.duration);
                 sendMessage({ type: 'playbackStatus', isPlaying: !video.paused, position: video.currentTime, duration: video.duration });
               }
             });
             
             // Minimal event listeners for performance
             hls.on(Hls.Events.BUFFER_EOS, () => {
               // Buffer end of stream - ready for next segment
             });
             
             // Performance monitoring
             hls.on(Hls.Events.FPS_DROP, (event, data) => {
               console.warn('[WEBVIEW-PLAYER] ⚠️ FPS_DROP detected:', data);
               // The ABR + capLevelOnFPSDrop should automatically handle this
             });
             
             // Only log critical fragment errors
             hls.on(Hls.Events.FRAG_LOAD_ERROR, (event, data) => {
               console.warn('Fragment load error:', data.frag.sn);
             });
             
             // Monitor video playback quality
             video.addEventListener('timeupdate', () => {
               const q = video.getVideoPlaybackQuality?.();
               if (q && q.totalVideoFrames > 0) {
                 const dropRate = q.droppedVideoFrames / q.totalVideoFrames;
                 if (dropRate > 0.05) {
                   console.warn('[WEBVIEW-PLAYER] ⚠️ High frame drop rate:', (dropRate * 100).toFixed(1) + '%');
                 }
               }
             });
            
          } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
            // Native HLS support (Safari/iOS) - optimized for performance
            console.log('[WEBVIEW-PLAYER] 🎬 Using native HLS support');
            video.src = videoUrl;
            video.muted = false; // Start muted for autoplay
            video.playsInline = true; // Better performance on iOS
            
            video.addEventListener('loadedmetadata', () => {
              console.log('[WEBVIEW-PLAYER] ✅ Native HLS loaded');
              // Load subtitles after video is ready
              loadSubtitles().then(() => {
                console.log('[WEBVIEW-PLAYER] ✅ Subtitles loaded successfully');
              }).catch(error => {
                console.error('[WEBVIEW-PLAYER] ❌ Subtitle loading failed:', error);
              });
              sendMessage({ type: 'ready' });
              // Auto-play muted first (with interaction fallback)
              video.play().catch(e => {
                console.warn('[WEBVIEW-PLAYER] ⚠️ Native HLS autoplay blocked (normal behavior):', e.message);
                // Don't send error - autoplay blocking is expected, show play button instead
                playButton.style.display = 'block';
              });
            });
            
            // Unmute on first user interaction
            video.addEventListener('click', () => {
              if (video.muted) {
                video.muted = false;
                video.play().catch(() => {});
              }
            });
          } else {
            console.error('[WEBVIEW-PLAYER] ❌ HLS not supported');
            sendMessage({ type: 'error', message: 'HLS playback not supported on this device' });
          }
          }
          
          // Memory hygiene: cleanup on beforeunload
          window.addEventListener('beforeunload', () => {
            console.log('[WEBVIEW-PLAYER] 🧹 Cleaning up before unload...');
            if (hls) {
              hls.destroy();
              console.log('[WEBVIEW-PLAYER] 🧹 HLS.js destroyed');
            }
            // Revoke any remaining blob URLs
            while (trackBlobUrls.length) {
              try {
                URL.revokeObjectURL(trackBlobUrls.pop());
              } catch (e) {
                // Silently fail
              }
            }
          });
          
          // Start the initialization process
          console.log('[WEBVIEW-PLAYER] 🎬 Starting player initialization');
          console.log('[WEBVIEW-PLAYER] 📊 Video element found:', !!video);
          console.log('[WEBVIEW-PLAYER] 📊 Subtitles array:', subtitles.length);
          console.log('[WEBVIEW-PLAYER] 📊 Subtitles data:', JSON.stringify(subtitles.map(s => ({ format: s.format, language: s.language, url: s.url.substring(0, 50) + '...' }))));
          
          // Initialize player with subtitle pre-loading
          initializePlayer();
         </script>
       </body>
       </html>
     `;
   }, [videoData]);

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

  return (
    <View style={styles.container}>
      <StatusBar hidden translucent backgroundColor="transparent" />
      
      {/* WebView Video Player */}
      <TouchableOpacity 
        style={styles.videoContainer} 
        activeOpacity={1} 
        onPress={showControlsTemporarily}
      >
         <WebView
           ref={webViewRef}
           source={{ html: generateHTML() }}
           style={styles.webview}
           onMessage={handleWebViewMessage}
           allowsInlineMediaPlayback={true}
           mediaPlaybackRequiresUserAction={false}
           javaScriptEnabled={true}
           domStorageEnabled={true}
           startInLoadingState={false}
           scalesPageToFit={false}
           scrollEnabled={false}
           bounces={false}
           showsHorizontalScrollIndicator={false}
           showsVerticalScrollIndicator={false}
           allowsFullscreenVideo={true}
           allowsBackForwardNavigationGestures={false}
           cacheEnabled={true}
           thirdPartyCookiesEnabled={false}
           sharedCookiesEnabled={false}
           mixedContentMode="compatibility"
           androidLayerType="hardware"
           overScrollMode="never"
           nestedScrollEnabled={false}
           keyboardDisplayRequiresUserAction={false}
           onShouldStartLoadWithRequest={() => true}
           onLoadEnd={() => console.log('[WEBVIEW-PLAYER] WebView loaded')}
           removeClippedSubviews={true}
           renderToHardwareTextureAndroid={true}
           setSupportMultipleWindows={false}
         />
        
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
                  console.log('[WEBVIEW-PLAYER] 🚪 Back button pressed, emitting exit request');
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
                  onPress={() => console.log('[WEBVIEW-PLAYER] 🔍 PiP button pressed but not supported')}
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
                   ref={progressRef}
                   style={styles.progressBar}
                   onLayout={e => setProgressBarWidth(e.nativeEvent.layout.width)}
                   onStartShouldSetResponder={() => true}
                   onMoveShouldSetResponder={() => true}
                   onResponderGrant={handleResponderGrant}
                   onResponderMove={handleResponderMove}
                   onResponderRelease={handleResponderRelease}
                   onResponderTerminationRequest={() => true}
                 >
                   <View style={styles.progressTrack}>
                     <View style={[styles.progressFill, { width: `${duration > 0 ? (position / duration) * 100 : 0}%` }]} />
                     
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
                     
                     <View style={[styles.progressThumb, { left: `${duration > 0 ? (position / duration) * 100 : 0}%` }]} />
                   </View>
                 </View>
               </View>
               
               <Text style={styles.timeText}>{formatTime(duration)}</Text>
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
                  <Text style={styles.settingLabel}>Audio Track</Text>
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
                        selectedAudioTrack === 1 && styles.optionButtonSelected
                      ]}
                      onPress={() => setSelectedAudioTrack(1)}
                    >
                      <Text style={[
                        styles.optionText,
                        selectedAudioTrack === 1 && styles.optionTextSelected
                      ]}>
                        {videoData.audioType === 'sub' ? 'English (Dub)' : 'Japanese (Original)'}
                      </Text>
                    </TouchableOpacity>
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
  webview: {
    flex: 1,
    backgroundColor: '#000',
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
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 40,
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
     marginHorizontal: 15,
     paddingVertical: 10,
   },
   progressBar: {
     height: 20,
     justifyContent: 'center',
     paddingVertical: 8,
   },
   progressTrack: {
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
});
