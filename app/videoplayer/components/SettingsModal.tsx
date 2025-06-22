import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform } from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import type { Subtitle } from '../types';
import { BlurView } from 'expo-blur';
import Slider from '@react-native-community/slider';
import { PLAYER_COLORS, MODAL_STYLES } from '../constants';

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
            
            {/* Show message when no subtitles are available */}
            {(!subtitles || subtitles.length === 0) && (
              <View style={styles.noSubtitlesContainer}>
                <Text style={styles.noSubtitlesText}>
                  No external subtitles available. This video likely uses hardsub.
                </Text>
              </View>
            )}
            
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
            
            {/* Quality Information */}
            <View style={styles.settingRow}>
              <View style={styles.qualityInfoContainer}>
                <Text style={styles.qualityInfoTitle}>Video Quality</Text>
                <Text style={styles.qualityInfoText}>
                  The app automatically selects the highest available quality (1080p or higher when available).
                  If videos appear pixelated, check your internet connection or try a different episode source.
                </Text>
              </View>
            </View>
            
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
    backgroundColor: 'rgba(13, 27, 42, 0.7)',
    zIndex: 1000,
  },
  settingsContainer: {
    width: '90%',
    maxWidth: 500,
    maxHeight: '80%',
    backgroundColor: 'rgba(13, 27, 42, 0.95)',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(173, 216, 230, 0.2)',
  },
  settingsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(173, 216, 230, 0.2)',
  },
  settingsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
  },
  closeButton: {
    padding: 5,
  },
  settingsScrollView: {
    maxHeight: '80%',
  },
  settingsContent: {
    paddingBottom: 20,
  },
  settingSection: {
    marginTop: 15,
    paddingHorizontal: 20,
  },
  settingSectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 10,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  settingLabel: {
    fontSize: 14,
    color: 'white',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkboxContainer: {
    marginLeft: 10,
  },
  speedOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
  },
  speedOption: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 15,
    marginLeft: 5,
    backgroundColor: 'rgba(173, 216, 230, 0.2)',
  },
  speedOptionSelected: {
    backgroundColor: PLAYER_COLORS.PRIMARY,
  },
  speedOptionText: {
    color: 'white',
    fontSize: 14,
  },
  speedOptionTextSelected: {
    fontWeight: 'bold',
  },
  languageOptionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
  },
  languageOption: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 15,
    marginLeft: 5,
    marginBottom: 5,
    backgroundColor: 'rgba(173, 216, 230, 0.2)',
  },
  languageOptionSelected: {
    backgroundColor: PLAYER_COLORS.PRIMARY,
  },
  languageOptionText: {
    color: 'white',
    fontSize: 14,
  },
  languageTextSelected: {
    fontWeight: 'bold',
  },
  audioTrackOptions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  audioTrackOption: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 15,
    marginLeft: 5,
    backgroundColor: 'rgba(173, 216, 230, 0.2)',
  },
  audioTrackOptionSelected: {
    backgroundColor: PLAYER_COLORS.PRIMARY,
  },
  audioTrackContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  audioTrackIcon: {
    marginRight: 5,
    fontSize: 14,
  },
  audioTrackText: {
    color: 'white',
    fontSize: 14,
  },
  audioTrackTextSelected: {
    fontWeight: 'bold',
  },
  audioTrackNote: {
    marginTop: 5,
    marginBottom: 10,
  },
  audioTrackNoteText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
    fontStyle: 'italic',
  },
  subtitlePreviewContainer: {
    width: '100%',
    padding: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    marginBottom: 16,
    alignItems: 'center',
  },
  subtitlePreviewBox: {
    padding: 8,
    borderRadius: 4,
    overflow: 'hidden',
    width: '100%',
    alignItems: 'center',
  },
  subtitlePreviewText: {
    textAlign: 'center',
    color: 'white',
    fontSize: 18,
  },
  subSettingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  subSettingLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  subSettingLabel: {
    color: 'white',
    fontSize: 14,
    marginLeft: 8,
  },
  sliderContainer: {
    flex: 1,
    alignItems: 'flex-end',
    marginLeft: 16,
  },
  sliderValue: {
    color: 'white',
    fontSize: 12,
    marginTop: -8,
  },
  colorOptions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  colorOption: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginLeft: 8,
    borderWidth: 1,
    borderColor: '#444',
  },
  colorOptionSelected: {
    borderWidth: 2,
    borderColor: '#FF6B00',
  },
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#444',
    padding: 8,
    borderRadius: 4,
    marginTop: 8,
  },
  resetButtonText: {
    color: 'white',
    fontSize: 14,
    marginLeft: 4,
  },
  settingControl: {
    flexDirection: 'row',
  },
  switchOption: {
    padding: 8,
    borderRadius: 4,
    backgroundColor: '#333',
  },
  switchOptionText: {
    color: 'white',
    fontSize: 14,
  },
  switchHint: {
    color: '#999',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
  },
  scaleOptions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  scaleOption: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 4,
    backgroundColor: '#333',
    marginLeft: 8,
  },
  scaleOptionActive: {
    backgroundColor: '#FF6B00',
  },
  scaleOptionText: {
    color: 'white',
    fontSize: 14,
  },
  scaleOptionTextActive: {
    fontWeight: 'bold',
  },
  noSubtitlesContainer: {
    marginTop: 8,
    marginBottom: 16,
    padding: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 107, 0, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 0, 0.5)',
  },
  noSubtitlesText: {
    color: '#FFC399',
    fontSize: 14,
    fontWeight: '500',
  },
  qualityInfoContainer: {
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  qualityInfoTitle: {
    color: '#FF6B00',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  qualityInfoText: {
    color: 'white',
    fontSize: 14,
  },
});

export default SettingsModal;