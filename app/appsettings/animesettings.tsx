import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Switch, Platform, BackHandler, DeviceEventEmitter } from 'react-native';
import { FontAwesome5, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
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
  const [activeTab, setActiveTab] = useState('player'); // 'player', 'episodes', 'sources'
  
  // Local state for episode list settings
  const [episodeListSettings, setEpisodeListSettings] = useState({
    defaultColumnCount: 2,
    newestFirst: true,
    showFillerBadges: true,
    showAiredDates: true,
  });

  // Local state for source settings
  const [sourceSettings, setSourceSettings] = useState({
    preferredType: 'sub' as 'sub' | 'dub',
    autoTryAlternateVersion: true,
    preferHLSStreams: true,
    logSourceDetails: true,
    // Provider settings
    defaultProvider: 'animepahe' as 'animepahe' | 'zoro',
    autoSelectSource: true,
    providerPriority: ['animepahe', 'zoro'] as ('animepahe' | 'zoro')[],
  });

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

        // Load source settings
        const sourceData = await AsyncStorage.getItem('sourceSettings');
        if (sourceData) {
          setSourceSettings(JSON.parse(sourceData));
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
    } catch (error) {
      console.error('Failed to save episode list settings:', error);
    }
  };

  // Save source settings
  const saveSourceSettings = async (newSettings: typeof sourceSettings) => {
    try {
      await AsyncStorage.setItem('sourceSettings', JSON.stringify(newSettings));
      setSourceSettings(newSettings);
    } catch (error) {
      console.error('Failed to save source settings:', error);
    }
  };

  // Save player preferences
  const savePlayerPreferences = (newPreferences: any) => {
    setPreferences(newPreferences as typeof preferences);
  };

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

  const renderSourcesTab = () => (
    <>
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <FontAwesome5 name="server" size={20} color="#2196F3" />
          <Text style={[styles.sectionTitle, { color: currentTheme.colors.text }]}>Source Settings</Text>
        </View>

        <View style={[styles.settingItem, { borderBottomColor: currentTheme.colors.border }]}>
          <View style={{ marginBottom: 12 }}>
            <Text style={[styles.settingLabel, { color: currentTheme.colors.text }]}>Preferred Version</Text>
            <Text style={{ color: currentTheme.colors.text, opacity: 0.7, fontSize: 12, marginTop: 4 }}>
              Choose your preferred audio version
            </Text>
          </View>
          <View style={styles.versionOptions}>
            {['sub', 'dub'].map(type => (
              <TouchableOpacity
                key={`version-${type}`}
                style={[
                  styles.versionOption,
                  sourceSettings.preferredType === type && styles.versionOptionSelected
                ]}
                onPress={() => {
                  saveSourceSettings({
                    ...sourceSettings,
                    preferredType: type as 'sub' | 'dub'
                  });
                }}
              >
                <Text style={[
                  styles.versionOptionText,
                  { color: sourceSettings.preferredType === type ? '#fff' : currentTheme.colors.text }
                ]}>
                  {type.toUpperCase()}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={[styles.settingItem, { borderBottomColor: currentTheme.colors.border }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.settingLabel, { color: currentTheme.colors.text, marginBottom: 0 }]}>Try Alternate Version if Preferred Unavailable</Text>
              <Text style={{ color: currentTheme.colors.text, opacity: 0.7, fontSize: 12, marginTop: 4 }}>
                Automatically try DUB if SUB is unavailable (or vice versa)
              </Text>
            </View>
            <Switch
              value={sourceSettings.autoTryAlternateVersion}
              onValueChange={(value) => {
                saveSourceSettings({
                  ...sourceSettings,
                  autoTryAlternateVersion: value
                });
              }}
              trackColor={{ false: '#767577', true: '#2196F3' }}
              thumbColor={sourceSettings.autoTryAlternateVersion ? '#fff' : '#f4f3f4'}
            />
          </View>
        </View>

      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <FontAwesome5 name="server" size={20} color="#4CAF50" />
          <Text style={[styles.sectionTitle, { color: currentTheme.colors.text }]}>Anime Providers</Text>
        </View>

        <View style={[styles.settingItem, { borderBottomColor: currentTheme.colors.border }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.settingLabel, { color: currentTheme.colors.text, marginBottom: 0 }]}>Auto-Select Best Source</Text>
              <Text style={{ color: currentTheme.colors.text, opacity: 0.7, fontSize: 12, marginTop: 4 }}>
                Automatically try AnimePahe first, then fallback to Zoro if needed
              </Text>
            </View>
            <Switch
              value={sourceSettings.autoSelectSource}
              onValueChange={(value) => {
                saveSourceSettings({
                  ...sourceSettings,
                  autoSelectSource: value
                });
              }}
              trackColor={{ false: '#767577', true: '#4CAF50' }}
              thumbColor={sourceSettings.autoSelectSource ? '#fff' : '#f4f3f4'}
            />
          </View>
        </View>

        <View style={[styles.settingItem, { borderBottomColor: currentTheme.colors.border }]}>
          <View style={{ marginBottom: 12 }}>
            <Text style={[styles.settingLabel, { color: currentTheme.colors.text }]}>Default Provider</Text>
            {sourceSettings.autoSelectSource && (
              <Text style={{ color: currentTheme.colors.text, opacity: 0.7, fontSize: 12, marginTop: 4 }}>
                Used when auto-select is disabled
              </Text>
            )}
          </View>
          <View style={styles.providerOptions}>
            {[
              { id: 'animepahe', name: 'AnimePahe', color: '#4CAF50' },
              { id: 'zoro', name: 'Zoro (HiAnime)', color: '#2196F3' }
            ].map(provider => (
              <TouchableOpacity
                key={`provider-${provider.id}`}
                style={[
                  styles.providerOption,
                  sourceSettings.defaultProvider === provider.id && styles.providerOptionSelected,
                  { borderColor: provider.color },
                  sourceSettings.autoSelectSource && styles.providerOptionDisabled
                ]}
                onPress={() => {
                  if (!sourceSettings.autoSelectSource) {
                    saveSourceSettings({
                      ...sourceSettings,
                      defaultProvider: provider.id as 'animepahe' | 'zoro'
                    });
                  }
                }}
              >
                <Text style={[
                  styles.providerOptionText,
                  { 
                    color: sourceSettings.defaultProvider === provider.id 
                      ? '#fff' 
                      : sourceSettings.autoSelectSource
                      ? '#666'
                      : currentTheme.colors.text 
                  }
                ]}>
                  {provider.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <FontAwesome5 name="cogs" size={20} color="#9C27B0" />
          <Text style={[styles.sectionTitle, { color: currentTheme.colors.text }]}>Advanced</Text>
        </View>

        <TouchableOpacity 
          style={[styles.settingItem, { borderBottomColor: currentTheme.colors.border }]}
          onPress={() => {
            // Clear cache action
            AsyncStorage.removeItem('videoProgressData');
            AsyncStorage.removeItem('recentlyWatched');
            alert('Video cache cleared successfully');
          }}
        >
          <Text style={[styles.settingLabel, { color: currentTheme.colors.text }]}>Clear Video Progress Cache</Text>
          <FontAwesome5 name="trash-alt" size={20} color="#f44336" />
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.settingItem, { borderBottomColor: currentTheme.colors.border }]}
          onPress={() => {
            // Reset all settings to default
            savePlayerPreferences({
              volume: 1,
              playbackRate: 1,
              subtitlesEnabled: true,
              preferredQuality: '1080p',
              autoplayNext: true,
              rememberPosition: true,
              selectedSubtitleLanguage: 'English',
              debugOverlayEnabled: false,
              subtitleStyle: {
                fontSize: 18,
                backgroundColor: 'rgba(0, 0, 0, 0.7)',
                textColor: '#FFFFFF',
                backgroundOpacity: 0.7,
                boldText: false
              },
              markerSettings: {
                showMarkers: true,
                autoSkipIntro: false,
                autoSkipOutro: false,
                autoPlayNextEpisode: true
              }
            });
            
            saveEpisodeListSettings({
              defaultColumnCount: 2,
              newestFirst: true,
              showFillerBadges: true,
              showAiredDates: true,
            });
            
            saveSourceSettings({
              preferredType: 'sub',
              autoTryAlternateVersion: true,
              preferHLSStreams: true,
              logSourceDetails: true,
              defaultProvider: 'animepahe',
              autoSelectSource: true,
              providerPriority: ['animepahe', 'zoro'],
            });
            
            alert('All settings reset to default');
          }}
        >
          <Text style={[styles.settingLabel, { color: currentTheme.colors.text }]}>Reset All Settings</Text>
          <FontAwesome5 name="undo" size={20} color="#f44336" />
        </TouchableOpacity>
      </View>
    </>
  );

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
        
        <TouchableOpacity
          style={[
            styles.tabButton,
            activeTab === 'sources' && styles.activeTabButton
          ]}
          onPress={() => setActiveTab('sources')}
        >
          <FontAwesome5 
            name="server" 
            size={18} 
            color={activeTab === 'sources' ? "#2196F3" : currentTheme.colors.text} 
          />
          <Text 
            style={[
              styles.tabButtonText, 
              { color: activeTab === 'sources' ? "#2196F3" : currentTheme.colors.text }
            ]}
          >
            Sources
          </Text>
        </TouchableOpacity>
      </View>

      {/* Settings Content */}
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {activeTab === 'player' && renderPlayerTab()}
        {activeTab === 'episodes' && renderEpisodesTab()}
        {activeTab === 'sources' && renderSourcesTab()}
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