import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { convertASSToVTT, parseVTTToCues, detectSubtitleFormat } from '../utils/subtitleConverter';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface SubtitleData {
  startTime: number;
  endTime: number;
  text: string;
  style?: any;
}

interface SubtitleOverlayProps {
  isVisible: boolean;
  currentTime: number;
  videoData?: {
    subtitles?: Array<{
      url: string;
      language: string;
      format: string;
      isDefault?: boolean;
    }>;
  };
  selectedSubtitle: number;
  subtitleSize: number;
  subtitleOpacity: number;
  subtitlePosition: number;
  subtitlesEnabled: boolean;
}

export default function SubtitleOverlay({
  isVisible,
  currentTime,
  videoData,
  selectedSubtitle,
  subtitleSize,
  subtitleOpacity,
  subtitlePosition,
  subtitlesEnabled
}: SubtitleOverlayProps) {
  const [currentSubtitle, setCurrentSubtitle] = useState<SubtitleData | null>(null);
  const [subtitleData, setSubtitleData] = useState<SubtitleData[]>([]);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Load subtitle data when video data changes
  useEffect(() => {
    const loadSubtitles = async () => {
      if (!videoData?.subtitles || !videoData.subtitles[selectedSubtitle]) {
        setSubtitleData([]);
        return;
      }

      try {
        const subtitleUrl = videoData.subtitles[selectedSubtitle].url;
        console.log('[SUBTITLE-OVERLAY] 🎞️ Loading subtitles from:', subtitleUrl);
        
        const response = await fetch(subtitleUrl);
        const subtitleText = await response.text();
        
        // Detect and parse subtitle format
        const format = detectSubtitleFormat(subtitleText);
        console.log('[SUBTITLE-OVERLAY] 🎞️ Detected subtitle format:', format);
        
        let parsedSubtitles: SubtitleData[] = [];
        
        if (format === 'ass') {
          try {
            // Convert ASS to VTT for better parsing
            const vttContent = convertASSToVTT(subtitleText);
            const vttCues = parseVTTToCues(vttContent);
            
            // Convert to SubtitleData format
            parsedSubtitles = vttCues.map(cue => ({
              startTime: cue.startTime,
              endTime: cue.endTime,
              text: cue.text
            }));
            
            console.log('[SUBTITLE-OVERLAY] 🔄 ASS converted to VTT and parsed successfully');
          } catch (error) {
            console.warn('[SUBTITLE-OVERLAY] ⚠️ ASS conversion failed, using fallback parser:', error);
            parsedSubtitles = parseASSSubtitle(subtitleText);
          }
        } else if (format === 'vtt') {
          try {
            const vttCues = parseVTTToCues(subtitleText);
            parsedSubtitles = vttCues.map(cue => ({
              startTime: cue.startTime,
              endTime: cue.endTime,
              text: cue.text
            }));
            console.log('[SUBTITLE-OVERLAY] 🎞️ VTT parsed successfully');
          } catch (error) {
            console.warn('[SUBTITLE-OVERLAY] ⚠️ VTT parsing failed:', error);
            parsedSubtitles = [];
          }
        } else {
          // Fallback to ASS parser for unknown formats
          console.log('[SUBTITLE-OVERLAY] 🎞️ Using fallback ASS parser for format:', format);
          parsedSubtitles = parseASSSubtitle(subtitleText);
        }
        
        setSubtitleData(parsedSubtitles);
        console.log('[SUBTITLE-OVERLAY] 🎞️ Loaded', parsedSubtitles.length, 'subtitle cues');
      } catch (error) {
        console.error('[SUBTITLE-OVERLAY] ❌ Error loading subtitles:', error);
        setSubtitleData([]);
      }
    };

    loadSubtitles();
  }, [videoData, selectedSubtitle]);

  // Find current subtitle based on time
  useEffect(() => {
    if (!subtitlesEnabled || subtitleData.length === 0) {
      setCurrentSubtitle(null);
      return;
    }

    const subtitle = subtitleData.find(sub => 
      currentTime >= sub.startTime && currentTime <= sub.endTime
    );

    if (subtitle !== currentSubtitle) {
      setCurrentSubtitle(subtitle || null);
      
      // Animate subtitle appearance/disappearance
      Animated.timing(fadeAnim, {
        toValue: subtitle ? 1 : 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [currentTime, subtitleData, subtitlesEnabled, currentSubtitle, fadeAnim]);

  // Don't render if not visible or no subtitle
  if (!isVisible || !currentSubtitle || !subtitlesEnabled) {
    return null;
  }

  return (
    <Animated.View 
      style={[
        styles.container,
        {
          opacity: fadeAnim,
          bottom: `${subtitlePosition * 100}%`,
        }
      ]}
    >
      <Text 
        style={[
          styles.subtitleText,
          {
            fontSize: subtitleSize,
            opacity: subtitleOpacity,
          }
        ]}
      >
        {currentSubtitle.text}
      </Text>
    </Animated.View>
  );
}

// Simplified ASS subtitle parser
function parseASSSubtitle(assText: string): SubtitleData[] {
  const subtitles: SubtitleData[] = [];
  const lines = assText.split('\n');
  
  let inEvents = false;
  
  for (const line of lines) {
    if (line.startsWith('[Events]')) {
      inEvents = true;
      continue;
    }
    
    if (inEvents && line.startsWith('Dialogue:')) {
      const parts = line.split(',');
      if (parts.length >= 10) {
        const startTime = parseTime(parts[1]);
        const endTime = parseTime(parts[2]);
        const text = parts.slice(9).join(',').replace(/\\N/g, '\n').replace(/\{[^}]*\}/g, '');
        
        if (startTime !== null && endTime !== null && text.trim()) {
          subtitles.push({
            startTime,
            endTime,
            text: text.trim(),
          });
        }
      }
    }
  }
  
  return subtitles;
}

// Parse ASS time format (H:MM:SS.CC)
function parseTime(timeStr: string): number | null {
  const match = timeStr.match(/(\d+):(\d{2}):(\d{2})\.(\d{2})/);
  if (!match) return null;
  
  const hours = parseInt(match[1]);
  const minutes = parseInt(match[2]);
  const seconds = parseInt(match[3]);
  const centiseconds = parseInt(match[4]);
  
  return hours * 3600 + minutes * 60 + seconds + centiseconds / 100;
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 20,
    right: 20,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  subtitleText: {
    color: 'white',
    textAlign: 'center',
    fontWeight: '600',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
    lineHeight: 24,
  },
});
