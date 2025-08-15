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
  defaultProvider: 'mangafire' | 'mangadex';
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
  const [activeTab, setActiveTab] = useState('manga'); // 'manga', 'webtoon', or 'providers'
  
  // State for manga reader settings (horizontal reader)
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

  // State for webtoon reader settings (vertical reader)
  const [webtoonReaderPreferences, setWebtoonReaderPreferences] = useState<MangaReaderPreferences>({
    readingDirection: 'vertical',
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
    defaultProvider: 'mangafire',
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
        const mangaReaderData = await AsyncStorage.getItem('mangaReaderPreferences');
        if (mangaReaderData) {
          setMangaReaderPreferences(JSON.parse(mangaReaderData));
        }

        // Load webtoon reader settings
        const webtoonReaderData = await AsyncStorage.getItem('webtoonReaderPreferences');
        if (webtoonReaderData) {
          setWebtoonReaderPreferences(JSON.parse(webtoonReaderData));
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

  // Save manga reader preferences
  const saveMangaReaderPreferences = async (newPreferences: MangaReaderPreferences) => {
    try {
      await AsyncStorage.setItem('mangaReaderPreferences', JSON.stringify(newPreferences));
      setMangaReaderPreferences(newPreferences);
    } catch (error) {
      console.error('Failed to save manga reader preferences:', error);
    }
  };

  // Save webtoon reader preferences
  const saveWebtoonReaderPreferences = async (newPreferences: MangaReaderPreferences) => {
    try {
      await AsyncStorage.setItem('webtoonReaderPreferences', JSON.stringify(newPreferences));
      setWebtoonReaderPreferences(newPreferences);
    } catch (error) {
      console.error('Failed to save webtoon reader preferences:', error);
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
  const renderMangaTab = () => (
    <>
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <FontAwesome5 name="book-open" size={20} color="#42A5F5" />
          <Text style={[styles.sectionTitle, { color: currentTheme.colors.text }]}>Manga Reader Settings</Text>
        </View>

        {/* Reading Direction Setting - Only RTL/LTR for manga */}
        <View style={[styles.settingItem, { borderBottomColor: currentTheme.colors.border }]}>
          <View style={{ marginBottom: 12 }}>
            <Text style={[styles.settingLabel, { color: currentTheme.colors.text }]}>Reading Direction</Text>
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
                  color={mangaReaderPreferences.readingDirection === direction.id ? '#fff' : currentTheme.colors.text} 
                />
                <Text style={[
                  styles.directionOptionText,
                  { color: mangaReaderPreferences.readingDirection === direction.id ? '#fff' : currentTheme.colors.text }
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

        <View style={[styles.settingItem, { borderBottomColor: currentTheme.colors.border }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={[styles.settingLabel, { color: currentTheme.colors.text, marginBottom: 0 }]}>Auto-Navigate to Next Chapter</Text>
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

        <View style={[styles.settingItem, { borderBottomColor: currentTheme.colors.border }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={[styles.settingLabel, { color: currentTheme.colors.text, marginBottom: 0 }]}>Keep Screen On While Reading</Text>
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

        <View style={[styles.settingItem, { borderBottomColor: currentTheme.colors.border }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={[styles.settingLabel, { color: currentTheme.colors.text, marginBottom: 0 }]}>Show Page Number</Text>
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
        <View style={[styles.settingItem, { borderBottomColor: currentTheme.colors.border }]}>
          <Text style={[styles.settingLabel, { color: currentTheme.colors.text }]}>Preload Pages</Text>
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
            <Text style={[styles.sliderValue, { color: currentTheme.colors.text }]}>
              {mangaReaderPreferences.preloadPages}
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
            saveMangaReaderPreferences(defaultSettings);
            alert('Manga reader settings reset to default');
          }}
        >
          <Text style={[styles.settingLabel, { color: currentTheme.colors.text }]}>Reset Manga Reader Settings</Text>
          <FontAwesome5 name="undo" size={20} color="#f44336" />
        </TouchableOpacity>
      </View>
    </>
  );

  const renderWebtoonTab = () => (
    <>
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <FontAwesome5 name="scroll" size={20} color="#4CAF50" />
          <Text style={[styles.sectionTitle, { color: currentTheme.colors.text }]}>Webtoon Reader Settings</Text>
        </View>

        {/* Reading Direction Setting - Only Vertical for webtoon */}
        <View style={[styles.settingItem, { borderBottomColor: currentTheme.colors.border }]}>
          <View style={{ marginBottom: 12 }}>
            <Text style={[styles.settingLabel, { color: currentTheme.colors.text }]}>Reading Direction</Text>
            <Text style={{ color: currentTheme.colors.text, opacity: 0.7, fontSize: 12, marginTop: 4 }}>
              Webtoons are read vertically from top to bottom
            </Text>
          </View>
          <View style={styles.directionOptions}>
            <TouchableOpacity
              style={[
                styles.directionOption,
                styles.directionOptionSelected
              ]}
              disabled={true}
            >
              <FontAwesome5 
                name="arrow-down" 
                size={14} 
                color="#fff"
              />
              <Text style={[
                styles.directionOptionText,
                { color: '#fff' }
              ]}>
                Vertical (Top to Bottom)
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Toggle Settings */}
        <View style={[styles.settingItem, { borderBottomColor: currentTheme.colors.border }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={[styles.settingLabel, { color: currentTheme.colors.text, marginBottom: 0 }]}>Remember Reading Position</Text>
            <Switch
              value={webtoonReaderPreferences.rememberPosition}
              onValueChange={(value) => {
                saveWebtoonReaderPreferences({
                  ...webtoonReaderPreferences,
                  rememberPosition: value
                });
              }}
              trackColor={{ false: '#767577', true: '#4CAF50' }}
              thumbColor={webtoonReaderPreferences.rememberPosition ? '#fff' : '#f4f3f4'}
            />
          </View>
        </View>

        <View style={[styles.settingItem, { borderBottomColor: currentTheme.colors.border }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={[styles.settingLabel, { color: currentTheme.colors.text, marginBottom: 0 }]}>Auto-Navigate to Next Chapter</Text>
            <Switch
              value={webtoonReaderPreferences.autoNavigateNextChapter}
              onValueChange={(value) => {
                saveWebtoonReaderPreferences({
                  ...webtoonReaderPreferences,
                  autoNavigateNextChapter: value
                });
              }}
              trackColor={{ false: '#767577', true: '#4CAF50' }}
              thumbColor={webtoonReaderPreferences.autoNavigateNextChapter ? '#fff' : '#f4f3f4'}
            />
          </View>
        </View>

        <View style={[styles.settingItem, { borderBottomColor: currentTheme.colors.border }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={[styles.settingLabel, { color: currentTheme.colors.text, marginBottom: 0 }]}>Keep Screen On While Reading</Text>
            <Switch
              value={webtoonReaderPreferences.keepScreenOn}
              onValueChange={(value) => {
                saveWebtoonReaderPreferences({
                  ...webtoonReaderPreferences,
                  keepScreenOn: value
                });
              }}
              trackColor={{ false: '#767577', true: '#4CAF50' }}
              thumbColor={webtoonReaderPreferences.keepScreenOn ? '#fff' : '#f4f3f4'}
            />
          </View>
        </View>

        <View style={[styles.settingItem, { borderBottomColor: currentTheme.colors.border }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={[styles.settingLabel, { color: currentTheme.colors.text, marginBottom: 0 }]}>Show Page Number</Text>
            <Switch
              value={webtoonReaderPreferences.showPageNumber}
              onValueChange={(value) => {
                saveWebtoonReaderPreferences({
                  ...webtoonReaderPreferences,
                  showPageNumber: value
                });
              }}
              trackColor={{ false: '#767577', true: '#4CAF50' }}
              thumbColor={webtoonReaderPreferences.showPageNumber ? '#fff' : '#f4f3f4'}
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
              value={webtoonReaderPreferences.preloadPages}
              onValueChange={(value) => {
                saveWebtoonReaderPreferences({
                  ...webtoonReaderPreferences,
                  preloadPages: value
                });
              }}
              minimumTrackTintColor="#4CAF50"
              maximumTrackTintColor="#777777"
              thumbTintColor="#4CAF50"
            />
            <Text style={[styles.sliderValue, { color: currentTheme.colors.text }]}>
              {webtoonReaderPreferences.preloadPages}
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
            AsyncStorage.removeItem('webtoonReadingProgress');
            AsyncStorage.removeItem('recentlyReadWebtoons');
            alert('Webtoon reading cache cleared successfully');
          }}
        >
          <Text style={[styles.settingLabel, { color: currentTheme.colors.text }]}>Clear Reading Progress Cache</Text>
          <FontAwesome5 name="trash-alt" size={20} color="#f44336" />
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.settingItem, { borderBottomColor: currentTheme.colors.border }]}
          onPress={() => {
            // Reset all webtoon reader settings to default
            const defaultSettings: MangaReaderPreferences = {
              readingDirection: 'vertical',
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
            saveWebtoonReaderPreferences(defaultSettings);
            alert('Webtoon reader settings reset to default');
          }}
        >
          <Text style={[styles.settingLabel, { color: currentTheme.colors.text }]}>Reset Webtoon Reader Settings</Text>
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
              { id: 'mangafire', name: 'Mangafire', color: '#f44336' },
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
                      defaultProvider: provider.id as 'mangafire' | 'mangadex'
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
            activeTab === 'manga' && styles.activeTabButton
          ]}
          onPress={() => setActiveTab('manga')}
        >
          <FontAwesome5 
            name="book-open" 
            size={18} 
            color={activeTab === 'manga' ? "#42A5F5" : currentTheme.colors.text} 
          />
          <Text 
            style={[
              styles.tabButtonText, 
              { color: activeTab === 'manga' ? "#42A5F5" : currentTheme.colors.text }
            ]}
          >
            Manga
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[
            styles.tabButton,
            activeTab === 'webtoon' && styles.activeTabButton
          ]}
          onPress={() => setActiveTab('webtoon')}
        >
          <FontAwesome5 
            name="book-open" 
            size={18} 
            color={activeTab === 'webtoon' ? "#42A5F5" : currentTheme.colors.text} 
          />
          <Text 
            style={[
              styles.tabButtonText, 
              { color: activeTab === 'webtoon' ? "#42A5F5" : currentTheme.colors.text }
            ]}
          >
            Webtoon
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
        {activeTab === 'manga' && renderMangaTab()}
        {activeTab === 'webtoon' && renderWebtoonTab()}
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