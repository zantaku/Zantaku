import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform } from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import type { Subtitle } from '../types';
import { BlurView } from 'expo-blur';
import Slider from '@react-native-community/slider';

interface SettingsModalProps {
  onClose: () => void;
  subtitles: Subtitle[];
  selectedLanguage: string;
  setSelectedLanguage: (lang: string) => void;
  preferences: {
    subtitlesEnabled: boolean;
    subtitleStyle?: {
      fontSize: number;
      backgroundColor: string;
      textColor: string;
      backgroundOpacity: number;
      boldText: boolean;
    };
    markerSettings: {
      showMarkers: boolean;
      autoSkipIntro: boolean;
      autoSkipOutro: boolean;
      autoPlayNextEpisode: boolean;
    };
    [key: string]: any;
  };
  setPreferences: (newPrefs: any) => void;
  playbackSpeed: number;
  setPlaybackSpeed: (speed: number) => void;
  scalingMode: string;
  setScalingMode: (mode: string) => void;
  autoRotateEnabled: boolean;
  setAutoRotateEnabled: (enabled: boolean) => void;
  videoRef: any;
  currentAudioTrack?: 'sub' | 'dub';
  availableAudioTracks?: { sub: boolean; dub: boolean };
  onAudioTrackChange?: (track: 'sub' | 'dub') => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({
  onClose,
  subtitles,
  selectedLanguage,
  setSelectedLanguage,
  preferences,
  setPreferences,
  playbackSpeed,
  setPlaybackSpeed,
  scalingMode,
  setScalingMode,
  autoRotateEnabled,
  setAutoRotateEnabled,
  videoRef,
  currentAudioTrack,
  availableAudioTracks,
  onAudioTrackChange,
}) => {
  // Add state for sample subtitle text
  const [previewText] = useState('Sample subtitle text for preview');
  
  // Create a map to keep track of language display names to prevent duplicates
  const uniqueLanguages = new Map();
  
  // Process subtitles to prevent duplicates with the same language name
  const processedSubtitles = subtitles.filter(subtitle => {
    // Create a simplified version of the language name for deduplication
    const simpleLang = subtitle.lang.split(' - ')[0].trim();
    
    // If we haven't seen this language before, keep it
    if (!uniqueLanguages.has(simpleLang)) {
      uniqueLanguages.set(simpleLang, subtitle.lang);
      return true;
    }
    return false;
  });
  
  return (
    <View style={styles.settingsModal}>
      <View style={styles.settingsContainer}>
        <View style={styles.settingsHeader}>
          <Text style={styles.settingsTitle}>Settings</Text>
          <TouchableOpacity 
            style={styles.closeButton}
            onPress={onClose}
          >
            <Ionicons name="close" size={24} color="white" />
          </TouchableOpacity>
        </View>

        <ScrollView 
          style={styles.settingsScrollView}
          contentContainerStyle={styles.settingsContent}
          showsVerticalScrollIndicator={true}
        >
          {/* Playback Section */}
          <View style={styles.settingSection}>
            <Text style={styles.settingSectionTitle}>Playback</Text>
            
            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>Speed</Text>
              <View style={styles.speedOptions}>
                {[0.5, 0.75, 1.0, 1.25, 1.5, 2.0].map(speed => (
                  <TouchableOpacity
                    key={`speed-${speed}`}
                    style={[
                      styles.speedOption,
                      playbackSpeed === speed && styles.speedOptionSelected
                    ]}
                    onPress={() => {
                      setPlaybackSpeed(speed);
                      if (videoRef.current) {
                        videoRef.current.setRateAsync(speed, true);
                      }
                    }}
                  >
                    <Text style={[
                      styles.speedOptionText,
                      playbackSpeed === speed && styles.speedOptionTextSelected
                    ]}>
                      {speed}x
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>

          {/* Audio Track Section */}
          {availableAudioTracks && onAudioTrackChange && (availableAudioTracks.sub || availableAudioTracks.dub) && (
            <View style={styles.settingSection}>
              <Text style={styles.settingSectionTitle}>Audio Track</Text>
              
              <View style={styles.settingRow}>
                <Text style={styles.settingLabel}>Version</Text>
                <View style={styles.audioTrackOptions}>
                  {availableAudioTracks.sub && (
                    <TouchableOpacity
                      style={[
                        styles.audioTrackOption,
                        currentAudioTrack === 'sub' && styles.audioTrackOptionSelected
                      ]}
                      onPress={() => onAudioTrackChange('sub')}
                    >
                      <View style={styles.audioTrackContent}>
                        <Text style={styles.audioTrackIcon}>💬</Text>
                        <Text style={[
                          styles.audioTrackText,
                          currentAudioTrack === 'sub' && styles.audioTrackTextSelected
                        ]}>
                          Subbed
                        </Text>
                      </View>
                    </TouchableOpacity>
                  )}
                  
                  {availableAudioTracks.dub && (
                    <TouchableOpacity
                      style={[
                        styles.audioTrackOption,
                        currentAudioTrack === 'dub' && styles.audioTrackOptionSelected
                      ]}
                      onPress={() => onAudioTrackChange('dub')}
                    >
                      <View style={styles.audioTrackContent}>
                        <Text style={styles.audioTrackIcon}>🎤</Text>
                        <Text style={[
                          styles.audioTrackText,
                          currentAudioTrack === 'dub' && styles.audioTrackTextSelected
                        ]}>
                          Dubbed
                        </Text>
                      </View>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
              
              {/* Show loading indicator when switching */}
              <View style={styles.audioTrackNote}>
                <Text style={styles.audioTrackNoteText}>
                  💡 Switching audio track will reload the video
                </Text>
              </View>
            </View>
          )}

          {/* Subtitles Section */}
          <View style={styles.settingSection}>
            <Text style={styles.settingSectionTitle}>Subtitles</Text>
            
            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>Enable Subtitles</Text>
              <View style={styles.checkboxRow}>
                <TouchableOpacity
                  onPress={() => {
                    setPreferences((prev: typeof preferences) => ({
                      ...prev,
                      subtitlesEnabled: !prev.subtitlesEnabled
                    }));
                  }}
                  style={styles.checkboxContainer}
                >
                  <Ionicons 
                    name={preferences.subtitlesEnabled ? "checkbox" : "square-outline"} 
                    size={28} 
                    color={preferences.subtitlesEnabled ? "#FF6B00" : "white"} 
                  />
                </TouchableOpacity>
              </View>
            </View>
            
            {processedSubtitles.length > 0 && (
              <View style={styles.settingRow}>
                <Text style={styles.settingLabel}>Language</Text>
                <View style={styles.languageOptionsContainer}>
                  {processedSubtitles.map(subtitle => {
                    // Display only the main language name, not the full format
                    const displayName = subtitle.lang.split(' - ')[0].trim();
                    
                    return (
                      <TouchableOpacity
                        key={`lang-${subtitle.lang}`}
                        style={[
                          styles.languageOption,
                          selectedLanguage === subtitle.lang && styles.languageOptionSelected
                        ]}
                        onPress={() => {
                          setSelectedLanguage(subtitle.lang);
                        }}
                      >
                        <Text style={[
                          styles.languageOptionText,
                          selectedLanguage === subtitle.lang && styles.languageTextSelected
                        ]}>
                          {displayName}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {/* After the language selection, add subtitle appearance customization */}
            {preferences.subtitlesEnabled && (
              <View style={styles.settingRow}>
                <Text style={styles.settingLabel}>Subtitle Appearance</Text>
                
                {/* Subtitle Preview */}
                <View style={styles.subtitlePreviewContainer}>
                  <BlurView intensity={40 * (preferences.subtitleStyle?.backgroundOpacity || 0.7)} tint="dark" style={styles.subtitlePreviewBox}>
                    <Text style={[
                      styles.subtitlePreviewText,
                      { 
                        fontSize: preferences.subtitleStyle?.fontSize || 18,
                        color: preferences.subtitleStyle?.textColor || '#FFFFFF',
                        fontWeight: preferences.subtitleStyle?.boldText ? 'bold' : 'normal'
                      }
                    ]}>
                      {previewText}
                    </Text>
                  </BlurView>
                </View>
                
                {/* Font Size */}
                <View style={styles.subSettingRow}>
                  <View style={styles.subSettingLabelContainer}>
                    <MaterialIcons name="format-size" size={20} color="#FFF" />
                    <Text style={styles.subSettingLabel}>Font Size</Text>
                  </View>
                  <View style={styles.sliderContainer}>
                    <Slider
                      style={{ width: '100%', height: 40 }}
                      minimumValue={12}
                      maximumValue={30}
                      step={1}
                      value={preferences.subtitleStyle?.fontSize || 18}
                      onValueChange={(value) => {
                        setPreferences({
                          ...preferences,
                          subtitleStyle: {
                            ...preferences.subtitleStyle,
                            fontSize: value
                          }
                        });
                      }}
                      minimumTrackTintColor="#FF6B00"
                      maximumTrackTintColor="#666666"
                      thumbTintColor="#FF6B00"
                    />
                    <Text style={styles.sliderValue}>
                      {preferences.subtitleStyle?.fontSize || 18}px
                    </Text>
                  </View>
                </View>
                
                {/* Background Opacity */}
                <View style={styles.subSettingRow}>
                  <View style={styles.subSettingLabelContainer}>
                    <MaterialIcons name="opacity" size={20} color="#FFF" />
                    <Text style={styles.subSettingLabel}>Background Opacity</Text>
                  </View>
                  <View style={styles.sliderContainer}>
                    <Slider
                      style={{ width: '100%', height: 40 }}
                      minimumValue={0}
                      maximumValue={1}
                      step={0.1}
                      value={preferences.subtitleStyle?.backgroundOpacity || 0.7}
                      onValueChange={(value) => {
                        setPreferences({
                          ...preferences,
                          subtitleStyle: {
                            ...preferences.subtitleStyle,
                            backgroundOpacity: value
                          }
                        });
                      }}
                      minimumTrackTintColor="#FF6B00"
                      maximumTrackTintColor="#666666"
                      thumbTintColor="#FF6B00"
                    />
                    <Text style={styles.sliderValue}>
                      {Math.round((preferences.subtitleStyle?.backgroundOpacity || 0.7) * 100)}%
                    </Text>
                  </View>
                </View>
                
                {/* Text Color */}
                <View style={styles.subSettingRow}>
                  <View style={styles.subSettingLabelContainer}>
                    <MaterialIcons name="format-color-text" size={20} color="#FFF" />
                    <Text style={styles.subSettingLabel}>Text Color</Text>
                  </View>
                  <View style={styles.colorOptions}>
                    {['#FFFFFF', '#FFFF00', '#00FFFF', '#FF9900', '#66FF66'].map(color => (
                      <TouchableOpacity
                        key={`color-${color}`}
                        style={[
                          styles.colorOption,
                          { backgroundColor: color },
                          (preferences.subtitleStyle?.textColor || '#FFFFFF') === color && styles.colorOptionSelected
                        ]}
                        onPress={() => {
                          setPreferences({
                            ...preferences,
                            subtitleStyle: {
                              ...preferences.subtitleStyle,
                              textColor: color
                            }
                          });
                        }}
                      />
                    ))}
                  </View>
                </View>
                
                {/* Bold Text */}
                <View style={styles.subSettingRow}>
                  <View style={styles.subSettingLabelContainer}>
                    <MaterialIcons name="format-bold" size={20} color="#FFF" />
                    <Text style={styles.subSettingLabel}>Bold Text</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => {
                      setPreferences({
                        ...preferences,
                        subtitleStyle: {
                          ...preferences.subtitleStyle,
                          boldText: !(preferences.subtitleStyle?.boldText || false)
                        }
                      });
                    }}
                    style={styles.checkboxContainer}
                  >
                    <Ionicons 
                      name={(preferences.subtitleStyle?.boldText || false) ? "checkbox" : "square-outline"} 
                      size={28} 
                      color={(preferences.subtitleStyle?.boldText || false) ? "#FF6B00" : "white"} 
                    />
                  </TouchableOpacity>
                </View>
                
                {/* Reset Button */}
                <TouchableOpacity
                  style={styles.resetButton}
                  onPress={() => {
                    setPreferences({
                      ...preferences,
                      subtitleStyle: {
                        fontSize: 18,
                        backgroundColor: 'rgba(0, 0, 0, 0.7)',
                        textColor: '#FFFFFF',
                        backgroundOpacity: 0.7,
                        boldText: false
                      }
                    });
                  }}
                >
                  <MaterialIcons name="refresh" size={16} color="#FFF" />
                  <Text style={styles.resetButtonText}>Reset to Default</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Display Section */}
          <View style={styles.settingSection}>
            <Text style={styles.settingSectionTitle}>Display</Text>
            
            {/* Auto-Rotate Toggle - Disabled to force landscape */}
            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>Auto-Rotate</Text>
              <View style={styles.settingControl}>
                <TouchableOpacity 
                  style={[styles.switchOption, { opacity: 0.5 }]} // Dimmed to show it's disabled
                  disabled={true} // Disable the control
                >
                  <Text style={styles.switchOptionText}>Disabled</Text>
                  <Text style={styles.switchHint}>(Locked to landscape)</Text>
                </TouchableOpacity>
              </View>
            </View>
            
            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>Scaling Mode</Text>
              <View style={styles.scaleOptions}>
                {['contain', 'cover', 'stretch'].map(mode => (
                  <TouchableOpacity
                    key={`scale-${mode}`}
                    style={[
                      styles.scaleOption,
                      scalingMode === mode && styles.scaleOptionActive
                    ]}
                    onPress={() => {
                      setScalingMode(mode);
                    }}
                  >
                    <Text style={[
                      styles.scaleOptionText,
                      scalingMode === mode && styles.scaleOptionTextActive
                    ]}>
                      {mode.charAt(0).toUpperCase() + mode.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>

          {/* Intro & Outro Section */}
          <View style={styles.settingSection}>
            <Text style={styles.settingSectionTitle}>Intro & Outro</Text>
            
            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>Show Markers</Text>
              <View style={styles.checkboxRow}>
                <TouchableOpacity
                  onPress={() => {
                    setPreferences((prev: typeof preferences) => ({
                      ...prev,
                      markerSettings: {
                        ...prev.markerSettings,
                        showMarkers: !prev.markerSettings.showMarkers
                      }
                    }));
                  }}
                  style={styles.checkboxContainer}
                >
                  <Ionicons 
                    name={preferences.markerSettings.showMarkers ? "checkbox" : "square-outline"} 
                    size={28} 
                    color={preferences.markerSettings.showMarkers ? "#FF6B00" : "white"} 
                  />
                </TouchableOpacity>
              </View>
            </View>
            
            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>Auto-Skip Intro</Text>
              <View style={styles.checkboxRow}>
                <TouchableOpacity
                  onPress={() => {
                    setPreferences((prev: typeof preferences) => ({
                      ...prev,
                      markerSettings: {
                        ...prev.markerSettings,
                        autoSkipIntro: !prev.markerSettings.autoSkipIntro
                      }
                    }));
                  }}
                  style={styles.checkboxContainer}
                >
                  <Ionicons 
                    name={preferences.markerSettings.autoSkipIntro ? "checkbox" : "square-outline"} 
                    size={28} 
                    color={preferences.markerSettings.autoSkipIntro ? "#FF6B00" : "white"} 
                  />
                </TouchableOpacity>
              </View>
            </View>
            
            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>Auto-Skip Outro</Text>
              <View style={styles.checkboxRow}>
                <TouchableOpacity
                  onPress={() => {
                    setPreferences((prev: typeof preferences) => ({
                      ...prev,
                      markerSettings: {
                        ...prev.markerSettings,
                        autoSkipOutro: !prev.markerSettings.autoSkipOutro
                      }
                    }));
                  }}
                  style={styles.checkboxContainer}
                >
                  <Ionicons 
                    name={preferences.markerSettings.autoSkipOutro ? "checkbox" : "square-outline"} 
                    size={28} 
                    color={preferences.markerSettings.autoSkipOutro ? "#FF6B00" : "white"} 
                  />
                </TouchableOpacity>
              </View>
            </View>
            
            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>Auto-Play Next Episode</Text>
              <View style={styles.checkboxRow}>
                <TouchableOpacity
                  onPress={() => {
                    setPreferences((prev: typeof preferences) => ({
                      ...prev,
                      markerSettings: {
                        ...prev.markerSettings,
                        autoPlayNextEpisode: !prev.markerSettings.autoPlayNextEpisode
                      }
                    }));
                  }}
                  style={styles.checkboxContainer}
                >
                  <Ionicons 
                    name={preferences.markerSettings.autoPlayNextEpisode ? "checkbox" : "square-outline"} 
                    size={28} 
                    color={preferences.markerSettings.autoPlayNextEpisode ? "#FF6B00" : "white"} 
                  />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </ScrollView>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  settingsModal: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
  },
  settingsContainer: {
    width: Platform.OS === 'ios' || Platform.OS === 'android' ? '92%' : '85%',
    maxWidth: 420,
    backgroundColor: '#1E1E1E',
    borderRadius: 20,
    minHeight: 400,
    maxHeight: Platform.OS === 'ios' || Platform.OS === 'android' ? '90%' : '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.8,
    shadowRadius: 10,
    elevation: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  settingsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  settingsTitle: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 20,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsScrollView: {
    flex: 1,
    width: '100%',
  },
  settingsContent: {
    padding: 20,
    paddingBottom: 30,
    minWidth: '100%',
  },
  settingSection: {
    marginBottom: 28,
    width: '100%',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  settingSectionTitle: {
    color: '#FF6B00',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  settingRow: {
    marginBottom: 16,
    width: '100%',
    flexDirection: 'column',
  },
  settingLabel: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 8,
  },
  checkboxRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 4,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  speedOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
  },
  speedOption: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    margin: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  speedOptionSelected: {
    backgroundColor: '#FF6B00',
  },
  speedOptionText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
  },
  speedOptionTextSelected: {
    color: 'white',
    fontWeight: 'bold',
  },
  languageOptionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
  },
  languageOption: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    margin: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  languageOptionSelected: {
    backgroundColor: '#FF6B00',
  },
  languageOptionText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
  },
  languageTextSelected: {
    color: 'white',
    fontWeight: 'bold',
  },
  scaleOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
  },
  scaleOption: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    margin: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  scaleOptionActive: {
    backgroundColor: '#FF6B00',
  },
  scaleOptionText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
  },
  scaleOptionTextActive: {
    color: 'white',
    fontWeight: 'bold',
  },
  subtitlePreviewContainer: {
    width: '100%',
    height: 80,
    marginVertical: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
    borderRadius: 8,
    overflow: 'hidden',
  },
  subtitlePreviewBox: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    maxWidth: '85%',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  subtitlePreviewText: {
    textAlign: 'center',
    fontWeight: '500',
    textShadowColor: 'rgba(0, 0, 0, 0.9)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 4,
  },
  subSettingRow: {
    marginTop: 16,
    width: '100%',
  },
  subSettingLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  subSettingLabel: {
    color: 'white',
    fontSize: 15,
    marginLeft: 8,
  },
  sliderContainer: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
  },
  sliderValue: {
    width: 48,
    textAlign: 'right',
    fontSize: 14,
    color: 'white',
  },
  colorOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  colorOption: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  colorOptionSelected: {
    borderColor: '#FF6B00',
    borderWidth: 3,
  },
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 107, 0, 0.2)',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    marginTop: 16,
    alignSelf: 'center',
  },
  resetButtonText: {
    color: 'white',
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '500',
  },
  settingControl: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  switchOption: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  switchOptionText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
  },
  switchHint: {
    color: 'white',
    fontSize: 12,
    fontWeight: '500',
  },
  audioTrackOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
  },
  audioTrackOption: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    margin: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  audioTrackOptionSelected: {
    backgroundColor: '#FF6B00',
  },
  audioTrackContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  audioTrackIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  audioTrackText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
  },
  audioTrackTextSelected: {
    color: 'white',
    fontWeight: 'bold',
  },
  audioTrackNote: {
    marginTop: 16,
    padding: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  audioTrackNoteText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
  },
});

export default SettingsModal;