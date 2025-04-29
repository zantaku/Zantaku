import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Switch, Platform, DeviceEventEmitter, BackHandler } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../../hooks/useTheme';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Slider from '@react-native-community/slider';

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

// Interface for manga provider preferences
interface ProviderPreferences {
  defaultProvider: 'katana' | 'mangadex';
  autoSelectSource: boolean;
  preferredChapterLanguage: string;
  preferredScanlationGroup: string;
  showDataSaver: boolean;
  cacheImages: boolean;
  cacheDuration: number; // in days
}

export default function MangaSettingsPage() {
  const router = useRouter();
  const { isDarkMode, currentTheme } = useTheme();
  const [activeTab, setActiveTab] = useState('reader'); // 'reader' or 'providers'
  
  // State for manga reader settings
  const [readerPreferences, setReaderPreferences] = useState<MangaReaderPreferences>({
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

  // State for provider settings
  const [providerPreferences, setProviderPreferences] = useState<ProviderPreferences>({
    defaultProvider: 'katana',
    autoSelectSource: true,
    preferredChapterLanguage: 'en',
    preferredScanlationGroup: '',
    showDataSaver: false,
    cacheImages: true,
    cacheDuration: 7
  });

  // Load settings from AsyncStorage
  useEffect(() => {
    const loadSettings = async () => {
      try {
        // Load manga reader settings
        const readerData = await AsyncStorage.getItem('mangaReaderPreferences');
        if (readerData) {
          setReaderPreferences(JSON.parse(readerData));
        }

        // Load provider settings
        const providerData = await AsyncStorage.getItem('mangaProviderPreferences');
        if (providerData) {
          setProviderPreferences(JSON.parse(providerData));
        }
      } catch (error) {
        console.error('Failed to load manga settings:', error);
      }
    };

    loadSettings();
  }, []);

  // Save reader preferences
  const saveReaderPreferences = async (newPreferences: MangaReaderPreferences) => {
    try {
      await AsyncStorage.setItem('mangaReaderPreferences', JSON.stringify(newPreferences));
      setReaderPreferences(newPreferences);
    } catch (error) {
      console.error('Failed to save manga reader preferences:', error);
    }
  };

  // Save provider preferences
  const saveProviderPreferences = async (newPreferences: ProviderPreferences) => {
    try {
      // Immediately update the UI state first
      setProviderPreferences(newPreferences);
      
      // Then save to AsyncStorage
      await AsyncStorage.setItem('mangaProviderPreferences', JSON.stringify(newPreferences));
      
      // Debug logging
      console.log('[Settings] Saved provider preferences:', JSON.stringify(newPreferences));
      
      // Broadcast an event so other components can update
      DeviceEventEmitter.emit('mangaProviderPreferencesChanged', newPreferences);
    } catch (error) {
      console.error('[Settings] Failed to save manga provider preferences:', error);
      // Show an error alert to the user
      alert('Failed to save settings. Please try again.');
    }
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
  const renderReaderTab = () => (
    <>
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <FontAwesome5 name="book-open" size={20} color="#42A5F5" />
          <Text style={[styles.sectionTitle, { color: currentTheme.colors.text }]}>Reading Settings</Text>
        </View>

        {/* Reading Direction Setting */}
        <View style={[styles.settingItem, { borderBottomColor: currentTheme.colors.border }]}>
          <View style={{ marginBottom: 12 }}>
            <Text style={[styles.settingLabel, { color: currentTheme.colors.text }]}>Reading Direction</Text>
          </View>
          <View style={styles.directionOptions}>
            {[
              { id: 'rtl', name: 'Right to Left', icon: 'arrow-left' },
              { id: 'ltr', name: 'Left to Right', icon: 'arrow-right' },
              { id: 'vertical', name: 'Vertical', icon: 'arrow-down' }
            ].map(direction => (
              <TouchableOpacity
                key={`direction-${direction.id}`}
                style={[
                  styles.directionOption,
                  readerPreferences.readingDirection === direction.id && styles.directionOptionSelected
                ]}
                onPress={() => {
                  saveReaderPreferences({
                    ...readerPreferences,
                    readingDirection: direction.id as 'ltr' | 'rtl' | 'vertical'
                  });
                }}
              >
                <FontAwesome5 
                  name={direction.icon} 
                  size={14} 
                  color={readerPreferences.readingDirection === direction.id ? '#fff' : currentTheme.colors.text} 
                />
                <Text style={[
                  styles.directionOptionText,
                  { color: readerPreferences.readingDirection === direction.id ? '#fff' : currentTheme.colors.text }
                ]}>
                  {direction.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Toggle Settings */}
        <View style={[styles.settingItem, { borderBottomColor: currentTheme.colors.border }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={[styles.settingLabel, { color: currentTheme.colors.text, marginBottom: 0 }]}>Remember Reading Position</Text>
            <Switch
              value={readerPreferences.rememberPosition}
              onValueChange={(value) => {
                saveReaderPreferences({
                  ...readerPreferences,
                  rememberPosition: value
                });
              }}
              trackColor={{ false: '#767577', true: '#42A5F5' }}
              thumbColor={readerPreferences.rememberPosition ? '#fff' : '#f4f3f4'}
            />
          </View>
        </View>

        <View style={[styles.settingItem, { borderBottomColor: currentTheme.colors.border }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={[styles.settingLabel, { color: currentTheme.colors.text, marginBottom: 0 }]}>Auto-Navigate to Next Chapter</Text>
            <Switch
              value={readerPreferences.autoNavigateNextChapter}
              onValueChange={(value) => {
                saveReaderPreferences({
                  ...readerPreferences,
                  autoNavigateNextChapter: value
                });
              }}
              trackColor={{ false: '#767577', true: '#42A5F5' }}
              thumbColor={readerPreferences.autoNavigateNextChapter ? '#fff' : '#f4f3f4'}
            />
          </View>
        </View>

        <View style={[styles.settingItem, { borderBottomColor: currentTheme.colors.border }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={[styles.settingLabel, { color: currentTheme.colors.text, marginBottom: 0 }]}>Keep Screen On While Reading</Text>
            <Switch
              value={readerPreferences.keepScreenOn}
              onValueChange={(value) => {
                saveReaderPreferences({
                  ...readerPreferences,
                  keepScreenOn: value
                });
              }}
              trackColor={{ false: '#767577', true: '#42A5F5' }}
              thumbColor={readerPreferences.keepScreenOn ? '#fff' : '#f4f3f4'}
            />
          </View>
        </View>

        <View style={[styles.settingItem, { borderBottomColor: currentTheme.colors.border }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={[styles.settingLabel, { color: currentTheme.colors.text, marginBottom: 0 }]}>Show Page Number</Text>
            <Switch
              value={readerPreferences.showPageNumber}
              onValueChange={(value) => {
                saveReaderPreferences({
                  ...readerPreferences,
                  showPageNumber: value
                });
              }}
              trackColor={{ false: '#767577', true: '#42A5F5' }}
              thumbColor={readerPreferences.showPageNumber ? '#fff' : '#f4f3f4'}
            />
          </View>
        </View>

        {/* Preload Pages */}
        <View style={[styles.settingItem, { borderBottomColor: currentTheme.colors.border }]}>
          <Text style={[styles.settingLabel, { color: currentTheme.colors.text }]}>Preload Pages</Text>
          <View style={styles.sliderContainer}>
            <Slider
              style={{ width: '90%', height: 40 }}
              minimumValue={1}
              maximumValue={10}
              step={1}
              value={readerPreferences.preloadPages}
              onValueChange={(value) => {
                saveReaderPreferences({
                  ...readerPreferences,
                  preloadPages: value
                });
              }}
              minimumTrackTintColor="#42A5F5"
              maximumTrackTintColor="#777777"
              thumbTintColor="#42A5F5"
            />
            <Text style={[styles.sliderValue, { color: currentTheme.colors.text }]}>
              {readerPreferences.preloadPages}
            </Text>
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
            AsyncStorage.removeItem('mangaReadingProgress');
            AsyncStorage.removeItem('recentlyReadManga');
            alert('Manga reading cache cleared successfully');
          }}
        >
          <Text style={[styles.settingLabel, { color: currentTheme.colors.text }]}>Clear Reading Progress Cache</Text>
          <FontAwesome5 name="trash-alt" size={20} color="#f44336" />
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.settingItem, { borderBottomColor: currentTheme.colors.border }]}
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
            saveReaderPreferences(defaultSettings);
            alert('Reader settings reset to default');
          }}
        >
          <Text style={[styles.settingLabel, { color: currentTheme.colors.text }]}>Reset Reader Settings</Text>
          <FontAwesome5 name="undo" size={20} color="#f44336" />
        </TouchableOpacity>
      </View>
    </>
  );

  const renderProvidersTab = () => (
    <>
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <FontAwesome5 name="server" size={20} color="#2196F3" />
          <Text style={[styles.sectionTitle, { color: currentTheme.colors.text }]}>Manga Providers</Text>
        </View>

        <View style={[styles.settingItem, { borderBottomColor: currentTheme.colors.border }]}>
          <View style={{ marginBottom: 12 }}>
            <Text style={[styles.settingLabel, { color: currentTheme.colors.text }]}>Default Provider</Text>
          </View>
          <View style={styles.providerOptions}>
            {[
              { id: 'katana', name: 'Katana', color: '#f44336' },
              { id: 'mangadex', name: 'MangaDex', color: '#FF6740' }
            ].map(provider => (
              <TouchableOpacity
                key={`provider-${provider.id}`}
                style={[
                  styles.providerOption,
                  providerPreferences.defaultProvider === provider.id && styles.providerOptionSelected,
                  { borderColor: provider.color },
                  providerPreferences.autoSelectSource && styles.providerOptionDisabled
                ]}
                onPress={() => {
                  if (!providerPreferences.autoSelectSource) {
                    saveProviderPreferences({
                      ...providerPreferences,
                      defaultProvider: provider.id as 'katana' | 'mangadex'
                    });
                  }
                }}
              >
                <Text style={[
                  styles.providerOptionText,
                  { 
                    color: providerPreferences.defaultProvider === provider.id 
                      ? '#fff' 
                      : providerPreferences.autoSelectSource
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

        <View style={[styles.settingItem, { borderBottomColor: currentTheme.colors.border }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={[styles.settingLabel, { color: currentTheme.colors.text, marginBottom: 0 }]}>Auto-Select Best Source</Text>
            <Switch
              value={providerPreferences.autoSelectSource}
              onValueChange={(value) => {
                saveProviderPreferences({
                  ...providerPreferences,
                  autoSelectSource: value
                });
              }}
              trackColor={{ false: '#767577', true: '#2196F3' }}
              thumbColor={providerPreferences.autoSelectSource ? '#fff' : '#f4f3f4'}
            />
          </View>
        </View>

        {/* Show language preferences when MangaDex is selected */}
        {providerPreferences.defaultProvider === 'mangadex' && (
          <View style={[styles.settingItem, { borderBottomColor: currentTheme.colors.border }]}>
            <View style={{ marginBottom: 12 }}>
              <Text style={[styles.settingLabel, { color: currentTheme.colors.text }]}>Preferred Chapter Language</Text>
              {providerPreferences.autoSelectSource && (
                <Text style={{ color: currentTheme.colors.text, opacity: 0.7, fontSize: 12, marginTop: 4 }}>
                  Used for MangaDex chapters when auto-select is enabled
                </Text>
              )}
            </View>
            <View style={styles.languageOptions}>
              {[
                { id: 'en', name: 'English' },
                { id: 'jp', name: 'Japanese' },
                { id: 'kr', name: 'Korean' },
                { id: 'cn', name: 'Chinese' }
              ].map(language => (
                <TouchableOpacity
                  key={`language-${language.id}`}
                  style={[
                    styles.languageOption,
                    providerPreferences.preferredChapterLanguage === language.id && styles.languageOptionSelected
                  ]}
                  onPress={() => {
                    saveProviderPreferences({
                      ...providerPreferences,
                      preferredChapterLanguage: language.id
                    });
                  }}
                >
                  <Text style={[
                    styles.languageOptionText,
                    { color: providerPreferences.preferredChapterLanguage === language.id ? '#fff' : currentTheme.colors.text }
                  ]}>
                    {language.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        <View style={[styles.settingItem, { borderBottomColor: currentTheme.colors.border }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={[styles.settingLabel, { color: currentTheme.colors.text, marginBottom: 0 }]}>Cache Images</Text>
            <Switch
              value={providerPreferences.cacheImages}
              onValueChange={(value) => {
                saveProviderPreferences({
                  ...providerPreferences,
                  cacheImages: value
                });
              }}
              trackColor={{ false: '#767577', true: '#2196F3' }}
              thumbColor={providerPreferences.cacheImages ? '#fff' : '#f4f3f4'}
            />
          </View>
        </View>

        {providerPreferences.cacheImages && (
          <View style={[styles.settingItem, { borderBottomColor: currentTheme.colors.border }]}>
            <Text style={[styles.settingLabel, { color: currentTheme.colors.text }]}>Cache Duration (Days)</Text>
            <View style={styles.sliderContainer}>
              <Slider
                style={{ width: '90%', height: 40 }}
                minimumValue={1}
                maximumValue={30}
                step={1}
                value={providerPreferences.cacheDuration}
                onValueChange={(value) => {
                  saveProviderPreferences({
                    ...providerPreferences,
                    cacheDuration: value
                  });
                }}
                minimumTrackTintColor="#2196F3"
                maximumTrackTintColor="#777777"
                thumbTintColor="#2196F3"
              />
              <Text style={[styles.sliderValue, { color: currentTheme.colors.text }]}>
                {providerPreferences.cacheDuration}
              </Text>
            </View>
          </View>
        )}

        <TouchableOpacity 
          style={[styles.settingItem, { borderBottomColor: currentTheme.colors.border }]}
          onPress={() => {
            // Clear cache action
            AsyncStorage.removeItem('mangaImageCache');
            alert('Manga image cache cleared successfully');
          }}
        >
          <Text style={[styles.settingLabel, { color: currentTheme.colors.text }]}>Clear Image Cache</Text>
          <FontAwesome5 name="trash-alt" size={20} color="#f44336" />
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
      <Text style={[styles.headerTitle, { color: currentTheme.colors.text }]}>Manga Settings</Text>
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
            activeTab === 'reader' && styles.activeTabButton
          ]}
          onPress={() => setActiveTab('reader')}
        >
          <FontAwesome5 
            name="book-open" 
            size={18} 
            color={activeTab === 'reader' ? "#42A5F5" : currentTheme.colors.text} 
          />
          <Text 
            style={[
              styles.tabButtonText, 
              { color: activeTab === 'reader' ? "#42A5F5" : currentTheme.colors.text }
            ]}
          >
            Reader
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[
            styles.tabButton,
            activeTab === 'providers' && styles.activeTabButton
          ]}
          onPress={() => setActiveTab('providers')}
        >
          <FontAwesome5 
            name="server" 
            size={18} 
            color={activeTab === 'providers' ? "#2196F3" : currentTheme.colors.text} 
          />
          <Text 
            style={[
              styles.tabButtonText, 
              { color: activeTab === 'providers' ? "#2196F3" : currentTheme.colors.text }
            ]}
          >
            Providers
          </Text>
        </TouchableOpacity>
      </View>

      {/* Settings Content */}
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {activeTab === 'reader' && renderReaderTab()}
        {activeTab === 'providers' && renderProvidersTab()}
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
    backgroundColor: '#2196F3',
    borderColor: '#2196F3',
  },
  providerOptionText: {
    fontSize: 15,
    fontWeight: '600',
  },
  languageOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  languageOption: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  languageOptionSelected: {
    backgroundColor: '#2196F3',
    borderColor: '#2196F3',
  },
  languageOptionText: {
    fontSize: 14,
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
  tabContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
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
    borderBottomColor: '#42A5F5',
  },
  tabButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  providerOptionDisabled: {
    opacity: 0.5,
    borderColor: '#666',
  },
}); 