import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Switch, Platform, BackHandler, DeviceEventEmitter } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../../hooks/useTheme';
import { usePlayerContext } from '../../contexts/PlayerContext';
import { VideoQuality } from '../../types/player';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BlurView } from 'expo-blur';
import Slider from '@react-native-community/slider';

// Add this type definition at the top of the file after imports
// Extended PlayerPreferences interface for local use
interface ExtendedPlayerPreferences {
  volume: number;
  playbackRate: number;
  subtitlesEnabled: boolean;
  preferredQuality: VideoQuality;
  autoplayNext: boolean;
  rememberPosition: boolean;
  selectedSubtitleLanguage: string;
  debugOverlayEnabled?: boolean;
  subtitleStyle?: {
    fontSize: number;
    backgroundColor: string;
    textColor: string;
    backgroundOpacity: number;
    boldText: boolean;
  };
  markerSettings?: {
    showMarkers: boolean;
    autoSkipIntro: boolean;
    autoSkipOutro: boolean;
    autoPlayNextEpisode: boolean;
  };
}

export default function AnimeSettingsPage() {
  const router = useRouter();
  const { isDarkMode, currentTheme } = useTheme();
  const { preferences, setPreferences } = usePlayerContext();
  const [activeTab, setActiveTab] = useState('player'); // 'player', 'episodes'
  
  // Local state for episode list settings
  const [episodeListSettings, setEpisodeListSettings] = useState({
    defaultColumnCount: 2,
    newestFirst: true,
    showFillerBadges: true,
    showAiredDates: true,
  });

  // Sources removed – Zencloud is the only provider now

  // Add sample subtitle text
  const [previewText, setPreviewText] = useState('Sample subtitle text for preview');

  // Load settings from AsyncStorage
  useEffect(() => {
    const loadSettings = async () => {
      try {
        // Load episode list settings
        const episodeListData = await AsyncStorage.getItem('episodeListSettings');
        if (episodeListData) {
          setEpisodeListSettings(JSON.parse(episodeListData));
        }

        // Sources removed (Zencloud only)

        // Load player integration settings
        const playerData = await AsyncStorage.getItem('playerSettings');
        if (playerData) {
          const parsed = JSON.parse(playerData);
          setPlayerSettings(prev => ({
            ...prev,
            ...parsed,
          }));
        }
      } catch (error) {
        console.error('Failed to load settings:', error);
      }
    };

    loadSettings();
  }, []);

  // Save episode list settings
  const saveEpisodeListSettings = async (newSettings: typeof episodeListSettings) => {
    try {
      await AsyncStorage.setItem('episodeListSettings', JSON.stringify(newSettings));
      setEpisodeListSettings(newSettings);
      DeviceEventEmitter.emit('episodeListSettingsChanged');
    } catch (error) {
      console.error('Failed to save episode list settings:', error);
    }
  };

  // Sources removed – no separate source settings to persist

  // Removed preset helper: we keep independent controls to support future providers

  // Save player preferences
  const savePlayerPreferences = async (newPreferences: any) => {
    setPreferences(newPreferences as typeof preferences);
    try {
      await AsyncStorage.setItem('playerPreferences', JSON.stringify(newPreferences));
      DeviceEventEmitter.emit('playerPreferencesChanged');
    } catch (e) {
      console.warn('Failed to persist player preferences:', e);
    }
  };

  // Player integration settings (reflect in Player component)
  const [playerSettings, setPlayerSettings] = useState({
    pipEnabled: true,
    forceLandscape: true,
    saveToAniList: true,
  });

  const savePlayerSettings = useCallback(async (newSettings: typeof playerSettings) => {
    try {
      await AsyncStorage.setItem('playerSettings', JSON.stringify(newSettings));
      setPlayerSettings(newSettings);
      DeviceEventEmitter.emit('playerSettingsChanged');
    } catch (error) {
      console.error('Failed to save player settings:', error);
    }
  }, []);

  // Handle back navigation
  const handleBack = () => {
    // Tell the AppSettingsModal to show the settings page
    DeviceEventEmitter.emit('showSettings');
    // Push directly to the settings screen
    router.replace('/settings');
    return true;
  };

  // Handle hardware back button
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      return handleBack();
    });

    return () => backHandler.remove();
  }, [router]);

  // Tab rendering functions
  const renderPlayerTab = () => (
    <>
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <FontAwesome5 name="play-circle" size={20} color="#2196F3" />
          <Text style={[styles.sectionTitle, { color: currentTheme.colors.text }]}>Video Player</Text>
        </View>

        {/* Player integration settings */}
        <View style={[styles.settingItem, { borderBottomColor: currentTheme.colors.border }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={[styles.settingLabel, { color: currentTheme.colors.text, marginBottom: 0 }]}>Enable Picture-in-Picture</Text>
            <Switch
              value={playerSettings.pipEnabled}
              onValueChange={(value) => {
                savePlayerSettings({ ...playerSettings, pipEnabled: value });
              }}
              trackColor={{ false: '#767577', true: '#2196F3' }}
              thumbColor={playerSettings.pipEnabled ? '#fff' : '#f4f3f4'}
            />
          </View>
          <Text style={[styles.settingDescription, { color: currentTheme.colors.textSecondary }]}>Show PiP when supported by device</Text>
        </View>

        <View style={[styles.settingItem, { borderBottomColor: currentTheme.colors.border }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={[styles.settingLabel, { color: currentTheme.colors.text, marginBottom: 0 }]}>Force Landscape Orientation</Text>
            <Switch
              value={playerSettings.forceLandscape}
              onValueChange={(value) => {
                savePlayerSettings({ ...playerSettings, forceLandscape: value });
              }}
              trackColor={{ false: '#767577', true: '#2196F3' }}
              thumbColor={playerSettings.forceLandscape ? '#fff' : '#f4f3f4'}
            />
          </View>
          <Text style={[styles.settingDescription, { color: currentTheme.colors.textSecondary }]}>Rotate and lock player to landscape when opening</Text>
        </View>

        <View style={[styles.settingItem, { borderBottomColor: currentTheme.colors.border }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={[styles.settingLabel, { color: currentTheme.colors.text, marginBottom: 0 }]}>Save Progress to AniList</Text>
            <Switch
              value={playerSettings.saveToAniList}
              onValueChange={(value) => {
                savePlayerSettings({ ...playerSettings, saveToAniList: value });
              }}
              trackColor={{ false: '#767577', true: '#2196F3' }}
              thumbColor={playerSettings.saveToAniList ? '#fff' : '#f4f3f4'}
            />
          </View>
          <Text style={[styles.settingDescription, { color: currentTheme.colors.textSecondary }]}>Update your AniList watch progress while watching</Text>
        </View>

        <View style={[styles.settingItem, { borderBottomColor: currentTheme.colors.border }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={[styles.settingLabel, { color: currentTheme.colors.text, marginBottom: 0 }]}>Enable Subtitles by Default</Text>
            <Switch
              value={preferences.subtitlesEnabled}
              onValueChange={(value) => {
                savePlayerPreferences({
                  ...preferences,
                  subtitlesEnabled: value
                });
              }}
              trackColor={{ false: '#767577', true: '#2196F3' }}
              thumbColor={preferences.subtitlesEnabled ? '#fff' : '#f4f3f4'}
            />
          </View>
        </View>

        <View style={[styles.settingItem, { borderBottomColor: currentTheme.colors.border }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={[styles.settingLabel, { color: currentTheme.colors.text, marginBottom: 0 }]}>Autoplay Next Episode</Text>
            <Switch
              value={preferences.autoplayNext}
              onValueChange={(value) => {
                savePlayerPreferences({
                  ...preferences,
                  autoplayNext: value
                });
              }}
              trackColor={{ false: '#767577', true: '#2196F3' }}
              thumbColor={preferences.autoplayNext ? '#fff' : '#f4f3f4'}
            />
          </View>
        </View>

        <View style={[styles.settingItem, { borderBottomColor: currentTheme.colors.border }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={[styles.settingLabel, { color: currentTheme.colors.text, marginBottom: 0 }]}>Remember Playback Position</Text>
            <Switch
              value={preferences.rememberPosition}
              onValueChange={(value) => {
                savePlayerPreferences({
                  ...preferences,
                  rememberPosition: value
                });
              }}
              trackColor={{ false: '#767577', true: '#2196F3' }}
              thumbColor={preferences.rememberPosition ? '#fff' : '#f4f3f4'}
            />
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <FontAwesome5 name="forward" size={20} color="#4CAF50" />
            <Text style={[styles.sectionTitle, { color: currentTheme.colors.text }]}>Intro/Outro Settings</Text>
          </View>

          <View style={[styles.settingItem, { borderBottomColor: currentTheme.colors.border }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={[styles.settingLabel, { color: currentTheme.colors.text, marginBottom: 0 }]}>Show Intro/Outro Markers</Text>
              <Switch
                              value={(preferences as any).markerSettings?.showMarkers ?? false}
              onValueChange={(value) => {
                savePlayerPreferences({
                  ...preferences,
                  markerSettings: {
                    ...(preferences as any).markerSettings,
                    showMarkers: value
                  }
                });
              }}
                trackColor={{ false: '#767577', true: '#4CAF50' }}
                thumbColor={(preferences as any).markerSettings?.showMarkers ? '#fff' : '#f4f3f4'}
              />
            </View>
            <Text style={[styles.settingDescription, { color: currentTheme.colors.textSecondary }]}>
              Show visual markers on the progress bar for intro and outro sections
            </Text>
          </View>

          <View style={[styles.settingItem, { borderBottomColor: currentTheme.colors.border }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={[styles.settingLabel, { color: currentTheme.colors.text, marginBottom: 0 }]}>Auto-Skip Intro</Text>
              <Switch
                value={preferences.markerSettings?.autoSkipIntro || false}
                onValueChange={(value) => {
                  savePlayerPreferences({
                    ...preferences,
                    markerSettings: {
                      ...preferences.markerSettings,
                      autoSkipIntro: value
                    }
                  });
                }}
                trackColor={{ false: '#767577', true: '#4CAF50' }}
                thumbColor={preferences.markerSettings?.autoSkipIntro ? '#fff' : '#f4f3f4'}
              />
            </View>
            <Text style={[styles.settingDescription, { color: currentTheme.colors.textSecondary }]}>
              Automatically skip intro sequences when detected
            </Text>
          </View>

          <View style={[styles.settingItem, { borderBottomColor: currentTheme.colors.border }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={[styles.settingLabel, { color: currentTheme.colors.text, marginBottom: 0 }]}>Auto-Skip Outro</Text>
              <Switch
                value={preferences.markerSettings?.autoSkipOutro || false}
                onValueChange={(value) => {
                  savePlayerPreferences({
                    ...preferences,
                    markerSettings: {
                      ...preferences.markerSettings,
                      autoSkipOutro: value
                    }
                  });
                }}
                trackColor={{ false: '#767577', true: '#4CAF50' }}
                thumbColor={preferences.markerSettings?.autoSkipOutro ? '#fff' : '#f4f3f4'}
              />
            </View>
            <Text style={[styles.settingDescription, { color: currentTheme.colors.textSecondary }]}>
              Automatically skip outro sequences and start next episode countdown
            </Text>
          </View>

          <View style={[styles.settingItem, { borderBottomColor: currentTheme.colors.border }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={[styles.settingLabel, { color: currentTheme.colors.text, marginBottom: 0 }]}>Auto-Play Next Episode</Text>
              <Switch
                value={preferences.markerSettings?.autoPlayNextEpisode || false}
                onValueChange={(value) => {
                  savePlayerPreferences({
                    ...preferences,
                    markerSettings: {
                      ...preferences.markerSettings,
                      autoPlayNextEpisode: value
                    }
                  });
                }}
                trackColor={{ false: '#767577', true: '#4CAF50' }}
                thumbColor={preferences.markerSettings?.autoPlayNextEpisode ? '#fff' : '#f4f3f4'}
              />
            </View>
            <Text style={[styles.settingDescription, { color: currentTheme.colors.textSecondary }]}>
              Automatically continue to the next episode after countdown
            </Text>
          </View>
        </View>
      </View>
    </>
  );

  const renderEpisodesTab = () => (
    <>
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <FontAwesome5 name="list" size={20} color="#FF9800" />
          <Text style={[styles.sectionTitle, { color: currentTheme.colors.text }]}>Episode List</Text>
        </View>

        <View style={[styles.settingItem, { borderBottomColor: currentTheme.colors.border }]}>
          <View style={{ marginBottom: 12 }}>
            <Text style={[styles.settingLabel, { color: currentTheme.colors.text }]}>Default Column Count</Text>
          </View>
          <View style={styles.columnOptions}>
            {[1, 2, 3].map(count => (
              <TouchableOpacity
                key={`column-${count}`}
                style={[
                  styles.columnOption,
                  episodeListSettings.defaultColumnCount === count && styles.columnOptionSelected
                ]}
                onPress={() => {
                  saveEpisodeListSettings({
                    ...episodeListSettings,
                    defaultColumnCount: count
                  });
                }}
              >
                <FontAwesome5 
                  name={count === 1 ? "grip-lines" : count === 2 ? "grip-lines-vertical" : "grip"}
                  size={16} 
                  color={episodeListSettings.defaultColumnCount === count ? "#fff" : currentTheme.colors.text} 
                />
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={[styles.settingItem, { borderBottomColor: currentTheme.colors.border }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={[styles.settingLabel, { color: currentTheme.colors.text, marginBottom: 0 }]}>Show Newest Episodes First</Text>
            <Switch
              value={episodeListSettings.newestFirst}
              onValueChange={(value) => {
                saveEpisodeListSettings({
                  ...episodeListSettings,
                  newestFirst: value
                });
              }}
              trackColor={{ false: '#767577', true: '#FF9800' }}
              thumbColor={episodeListSettings.newestFirst ? '#fff' : '#f4f3f4'}
            />
          </View>
        </View>

        <View style={[styles.settingItem, { borderBottomColor: currentTheme.colors.border }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={[styles.settingLabel, { color: currentTheme.colors.text, marginBottom: 0 }]}>Show Filler Episode Badges</Text>
            <Switch
              value={episodeListSettings.showFillerBadges}
              onValueChange={(value) => {
                saveEpisodeListSettings({
                  ...episodeListSettings,
                  showFillerBadges: value
                });
              }}
              trackColor={{ false: '#767577', true: '#FF9800' }}
              thumbColor={episodeListSettings.showFillerBadges ? '#fff' : '#f4f3f4'}
            />
          </View>
        </View>

        <View style={[styles.settingItem, { borderBottomColor: currentTheme.colors.border }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={[styles.settingLabel, { color: currentTheme.colors.text, marginBottom: 0 }]}>Show Episode Air Dates</Text>
            <Switch
              value={episodeListSettings.showAiredDates}
              onValueChange={(value) => {
                saveEpisodeListSettings({
                  ...episodeListSettings,
                  showAiredDates: value
                });
              }}
              trackColor={{ false: '#767577', true: '#FF9800' }}
              thumbColor={episodeListSettings.showAiredDates ? '#fff' : '#f4f3f4'}
            />
          </View>
        </View>
      </View>
    </>
  );

  // Sources tab removed

  // Add header with back button
  const Header = () => (
    <View style={[styles.header, { 
      backgroundColor: currentTheme.colors.background,
      borderBottomColor: currentTheme.colors.border 
    }]}>
      <TouchableOpacity onPress={handleBack} style={styles.backButton}>
        <FontAwesome5 name="arrow-left" size={20} color={currentTheme.colors.text} />
      </TouchableOpacity>
      <Text style={[styles.headerTitle, { color: currentTheme.colors.text }]}>Anime Settings</Text>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: currentTheme.colors.background }]}>
      <Header />
      {/* Tab Navigation */}
      <View style={[styles.tabContainer, { borderBottomColor: currentTheme.colors.border }]}>
        <TouchableOpacity
          style={[
            styles.tabButton,
            activeTab === 'player' && styles.activeTabButton
          ]}
          onPress={() => setActiveTab('player')}
        >
          <FontAwesome5 
            name="play-circle" 
            size={18} 
            color={activeTab === 'player' ? "#2196F3" : currentTheme.colors.text} 
          />
          <Text 
            style={[
              styles.tabButtonText, 
              { color: activeTab === 'player' ? "#2196F3" : currentTheme.colors.text }
            ]}
          >
            Player
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[
            styles.tabButton,
            activeTab === 'episodes' && styles.activeTabButton
          ]}
          onPress={() => setActiveTab('episodes')}
        >
          <FontAwesome5 
            name="list" 
            size={18} 
            color={activeTab === 'episodes' ? "#FF9800" : currentTheme.colors.text} 
          />
          <Text 
            style={[
              styles.tabButtonText, 
              { color: activeTab === 'episodes' ? "#FF9800" : currentTheme.colors.text }
            ]}
          >
            Episodes
          </Text>
        </TouchableOpacity>
        
        {/* Sources tab removed (Zencloud only) */}
      </View>

      {/* Settings Content */}
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {activeTab === 'player' && renderPlayerTab()}
        {activeTab === 'episodes' && renderEpisodesTab()}
        {/* Bottom padding */}
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 8,
    marginRight: 16,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  scrollView: {
    flex: 1,
  },
  section: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 12,
  },
  settingItem: {
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  settingLabel: {
    fontSize: 16,
    marginBottom: 12,
    flexShrink: 1,
  },
  speedOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  speedOption: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  speedOptionSelected: {
    backgroundColor: '#EC407A',
    borderColor: '#EC407A',
  },
  speedOptionText: {
    fontSize: 15,
    fontWeight: '500',
  },
  speedOptionTextSelected: {
    color: '#fff',
  },
  qualityOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  qualityOption: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  qualityOptionSelected: {
    backgroundColor: '#EC407A',
    borderColor: '#EC407A',
  },
  qualityOptionText: {
    fontSize: 15,
    fontWeight: '500',
  },
  qualityOptionTextSelected: {
    color: '#fff',
  },
  columnOptions: {
    flexDirection: 'row',
    gap: 8,
  },
  columnOption: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  columnOptionSelected: {
    backgroundColor: '#FF9800',
    borderColor: '#FF9800',
  },
  versionOptions: {
    flexDirection: 'row',
    gap: 8,
  },
  versionOption: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
  },
  versionOptionSelected: {
    backgroundColor: '#2196F3',
    borderColor: '#2196F3',
  },
  versionOptionText: {
    fontSize: 15,
    fontWeight: '500',
    textTransform: 'uppercase',
  },
  versionOptionTextSelected: {
    color: '#fff',
  },
  settingGroupLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#EC407A',
  },
  settingRow: {
    marginBottom: 16,
    width: '100%',
  },
  checkboxRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 6,
  },
  subtitlePreviewContainer: {
    width: '100%',
    height: 80,
    marginVertical: 10,
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
  sliderContainer: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
  },
  sliderValue: {
    width: 48,
    textAlign: 'right',
    fontSize: 14,
  },
  colorOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  colorOption: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  colorOptionSelected: {
    borderColor: '#2196F3',
    borderWidth: 3,
  },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    backgroundColor: 'transparent',
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
  },
  activeTabButton: {
    borderBottomWidth: 2,
    borderBottomColor: '#2196F3',
  },
  tabButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  settingDescription: {
    fontSize: 12,
    fontWeight: '400',
    marginTop: 4,
  },
  providerOptions: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
  },
  providerOption: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 2,
    alignItems: 'center',
    minWidth: 120,
  },
  providerOptionSelected: {
    backgroundColor: '#4CAF50',
    borderColor: '#4CAF50',
  },
  providerOptionText: {
    fontSize: 15,
    fontWeight: '600',
  },
  providerOptionDisabled: {
    opacity: 0.5,
    borderColor: '#666',
  },
}); 