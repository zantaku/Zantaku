import React, { useEffect, useState } from 'react';
import { BackHandler, View, Text, Alert, TouchableOpacity, StyleSheet, TextInput, ScrollView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SettingsLayout, SettingsSection, SettingsToggle, SettingsRadioGroup, SettingsSlider } from '../../components/SettingsComponents';
import { FontAwesome5 } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';

interface NewsSettings {
  // Sources
  enableAniList: boolean;
  enableANN: boolean;
  enableCrunchyrollNews: boolean;
  enableMyAnimeListNews: boolean;
  enableJapanTimes: boolean;
  enableNHKWorld: boolean;
  enableSoraNews24: boolean;
  enableTokyoReporter: boolean;
  
  // Categories
  enableAnimeNews: boolean;
  enableMangaNews: boolean;
  enableLightNovelNews: boolean;
  enableJapanCulture: boolean;
  enableTechnology: boolean;
  enableGaming: boolean;
  enableEntertainment: boolean;
  enableLifestyle: boolean;
  
  // Preferences
  prioritizeJapanContent: boolean;
  showTrendingOnly: boolean;
  enableEndlessLoading: boolean;
  newsRefreshInterval: number; // in minutes
  maxNewsItems: number;
  
  // Language & Region
  preferredLanguage: 'en' | 'ja' | 'both';
  showJapaneseText: boolean;
  enableAutoTranslation: boolean;
  
  // Display
  showThumbnails: boolean;
  showScores: boolean;
  showTimestamps: boolean;
  compactView: boolean;
}

const DEFAULT_SETTINGS: NewsSettings = {
  // Sources
  enableAniList: true,
  enableANN: true,
  enableCrunchyrollNews: false,
  enableMyAnimeListNews: false,
  enableJapanTimes: false,
  enableNHKWorld: false,
  enableSoraNews24: false,
  enableTokyoReporter: false,
  
  // Categories
  enableAnimeNews: true,
  enableMangaNews: true,
  enableLightNovelNews: true,
  enableJapanCulture: false,
  enableTechnology: false,
  enableGaming: false,
  enableEntertainment: false,
  enableLifestyle: false,
  
  // Preferences
  prioritizeJapanContent: true,
  showTrendingOnly: false,
  enableEndlessLoading: true,
  newsRefreshInterval: 30,
  maxNewsItems: 50,
  
  // Language & Region
  preferredLanguage: 'en',
  showJapaneseText: false,
  enableAutoTranslation: false,
  
  // Display
  showThumbnails: true,
  showScores: true,
  showTimestamps: true,
  compactView: false,
};

// Helper function to check if settings are still default (basic)
const isBasicSettings = (settings: NewsSettings): boolean => {
  // Check if only AniList and ANN are enabled (basic setup)
  const basicSources = settings.enableAniList && settings.enableANN && 
    !settings.enableCrunchyrollNews && !settings.enableMyAnimeListNews &&
    !settings.enableJapanTimes && !settings.enableNHKWorld && 
    !settings.enableSoraNews24 && !settings.enableTokyoReporter;
  
  // Check if only basic categories are enabled
  const basicCategories = settings.enableAnimeNews && settings.enableMangaNews && 
    settings.enableLightNovelNews && !settings.enableJapanCulture &&
    !settings.enableTechnology && !settings.enableGaming && 
    !settings.enableEntertainment && !settings.enableLifestyle;
  
  return basicSources && basicCategories;
};

// Smart Presets
const PRESETS = {
  'anime-only': {
    name: '📺 Anime-Only',
    description: 'Just anime news and updates',
    settings: {
      ...DEFAULT_SETTINGS,
      enableAniList: true,
      enableANN: true,
      enableCrunchyrollNews: true,
      enableMyAnimeListNews: false,
      enableJapanTimes: false,
      enableNHKWorld: false,
      enableSoraNews24: false,
      enableTokyoReporter: false,
      enableAnimeNews: true,
      enableMangaNews: false,
      enableLightNovelNews: false,
      enableJapanCulture: false,
      enableTechnology: false,
      enableGaming: false,
      enableEntertainment: false,
      enableLifestyle: false,
    }
  },
  'otaku-tech': {
    name: '🎮 Otaku & Tech',
    description: 'Anime, gaming, and Japanese tech',
    settings: {
      ...DEFAULT_SETTINGS,
      enableAniList: true,
      enableANN: true,
      enableCrunchyrollNews: true,
      enableMyAnimeListNews: true,
      enableJapanTimes: false,
      enableNHKWorld: false,
      enableSoraNews24: true,
      enableTokyoReporter: false,
      enableAnimeNews: true,
      enableMangaNews: true,
      enableLightNovelNews: true,
      enableJapanCulture: false,
      enableTechnology: true,
      enableGaming: true,
      enableEntertainment: true,
      enableLifestyle: false,
    }
  },
  'japan-focused': {
    name: '🇯🇵 Japan-Focused',
    description: 'Everything about Japan and culture',
    settings: {
      ...DEFAULT_SETTINGS,
      enableAniList: true,
      enableANN: true,
      enableCrunchyrollNews: false,
      enableMyAnimeListNews: false,
      enableJapanTimes: true,
      enableNHKWorld: true,
      enableSoraNews24: true,
      enableTokyoReporter: true,
      enableAnimeNews: true,
      enableMangaNews: true,
      enableLightNovelNews: true,
      enableJapanCulture: true,
      enableTechnology: true,
      enableGaming: true,
      enableEntertainment: true,
      enableLifestyle: true,
      prioritizeJapanContent: true,
      showJapaneseText: true,
    }
  },
  'minimalist': {
    name: '🧠 Minimalist',
    description: 'Clean, essential news only',
    settings: {
      ...DEFAULT_SETTINGS,
      enableAniList: true,
      enableANN: false,
      enableCrunchyrollNews: false,
      enableMyAnimeListNews: false,
      enableJapanTimes: false,
      enableNHKWorld: false,
      enableSoraNews24: false,
      enableTokyoReporter: false,
      enableAnimeNews: true,
      enableMangaNews: false,
      enableLightNovelNews: false,
      enableJapanCulture: false,
      enableTechnology: false,
      enableGaming: false,
      enableEntertainment: false,
      enableLifestyle: false,
      showTrendingOnly: true,
      compactView: true,
      maxNewsItems: 20,
    }
  }
};

export default function NewsSettingsScreen() {
  const [settings, setSettings] = useState<NewsSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('presets');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const { currentTheme } = useTheme();
  const router = useRouter();

  useEffect(() => {
    loadSettings();
  }, []);

  // Handle hardware back button
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      router.back();
      return true;
    });

    return () => backHandler.remove();
  }, [router]);

  const loadSettings = async () => {
    try {
      const savedSettings = await AsyncStorage.getItem('newsSettings');
      if (savedSettings) {
        const parsed = JSON.parse(savedSettings);
        setSettings({ ...DEFAULT_SETTINGS, ...parsed });
      }
    } catch (error) {
      console.error('Error loading news settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveSettings = async (newSettings: NewsSettings) => {
    try {
      await AsyncStorage.setItem('newsSettings', JSON.stringify(newSettings));
      setSettings(newSettings);
    } catch (error) {
      console.error('Error saving news settings:', error);
      Alert.alert('Error', 'Failed to save settings. Please try again.');
    }
  };

  const updateSetting = <K extends keyof NewsSettings>(key: K, value: NewsSettings[K]) => {
    const newSettings = { ...settings, [key]: value };
    saveSettings(newSettings);
  };

  const applyPreset = (presetKey: string) => {
    const preset = PRESETS[presetKey as keyof typeof PRESETS];
    if (preset) {
      Alert.alert(
        'Apply Preset',
        `This will replace your current settings with "${preset.name}". Continue?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Apply', 
            onPress: () => {
              saveSettings(preset.settings);
              setActiveTab('sources'); // Switch to sources tab to show changes
            }
          }
        ]
      );
    }
  };

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const getActiveSourcesCount = () => {
    const sources = [
      'enableAniList', 'enableANN', 'enableCrunchyrollNews', 'enableMyAnimeListNews',
      'enableJapanTimes', 'enableNHKWorld', 'enableSoraNews24', 'enableTokyoReporter'
    ];
    return sources.filter(source => settings[source as keyof NewsSettings]).length;
  };

  const getActiveCategoriesCount = () => {
    const categories = [
      'enableAnimeNews', 'enableMangaNews', 'enableLightNovelNews', 'enableJapanCulture',
      'enableTechnology', 'enableGaming', 'enableEntertainment', 'enableLifestyle'
    ];
    return categories.filter(category => settings[category as keyof NewsSettings]).length;
  };

  if (isLoading) {
    return (
      <SettingsLayout title="News Settings">
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text>Loading settings...</Text>
        </View>
      </SettingsLayout>
    );
  }

  const tabs = [
    { id: 'presets', name: 'Quick Setup', icon: 'magic' },
    { id: 'sources', name: `Sources (${getActiveSourcesCount()})`, icon: 'rss' },
    { id: 'categories', name: `Topics (${getActiveCategoriesCount()})`, icon: 'tags' },
    { id: 'preferences', name: 'Preferences', icon: 'sliders-h' },
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'presets':
        return (
          <View>
            {/* Quick Stats */}
            <View style={[newStyles.statsCard, { backgroundColor: currentTheme.colors.surface }]}>
              <Text style={[newStyles.statsTitle, { color: currentTheme.colors.text }]}>
                Current Setup
              </Text>
              <Text style={[newStyles.statsText, { color: currentTheme.colors.textSecondary }]}>
                📰 {getActiveSourcesCount()} sources • 🏷️ {getActiveCategoriesCount()} topics
              </Text>
              <Text style={[newStyles.statsSubtext, { color: currentTheme.colors.textSecondary }]}>
                Expect ~{Math.max(5, getActiveSourcesCount() * 3 + getActiveCategoriesCount() * 2)} articles/day
              </Text>
            </View>

            {/* Presets */}
            <Text style={[newStyles.sectionTitle, { color: currentTheme.colors.text }]}>
              🚀 Quick Start Presets
            </Text>
            <Text style={[newStyles.sectionSubtitle, { color: currentTheme.colors.textSecondary }]}>
              Choose a preset to get started, then customize as needed
            </Text>
            
            {Object.entries(PRESETS).map(([key, preset]) => (
              <TouchableOpacity
                key={key}
                style={[newStyles.presetCard, { 
                  backgroundColor: currentTheme.colors.surface,
                  borderColor: currentTheme.colors.border 
                }]}
                onPress={() => applyPreset(key)}
                activeOpacity={0.7}
              >
                <View style={newStyles.presetContent}>
                  <Text style={[newStyles.presetName, { color: currentTheme.colors.text }]}>
                    {preset.name}
                  </Text>
                  <Text style={[newStyles.presetDescription, { color: currentTheme.colors.textSecondary }]}>
                    {preset.description}
                  </Text>
                </View>
                <FontAwesome5 name="chevron-right" size={16} color={currentTheme.colors.textSecondary} />
              </TouchableOpacity>
            ))}

            {/* Reset Option */}
            <TouchableOpacity
              style={[newStyles.resetButton, { borderColor: currentTheme.colors.border }]}
              onPress={() => {
                Alert.alert(
                  'Reset to Default',
                  'This will reset all settings to their default values.',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Reset', style: 'destructive', onPress: () => saveSettings(DEFAULT_SETTINGS) }
                  ]
                );
              }}
            >
              <FontAwesome5 name="undo" size={16} color={currentTheme.colors.textSecondary} />
              <Text style={[newStyles.resetText, { color: currentTheme.colors.textSecondary }]}>
                Reset to Default
              </Text>
            </TouchableOpacity>
          </View>
        );

      case 'sources':
        return (
          <View>
            {/* Search */}
            <View style={[newStyles.searchContainer, { backgroundColor: currentTheme.colors.surface }]}>
              <FontAwesome5 name="search" size={16} color={currentTheme.colors.textSecondary} />
              <TextInput
                style={[newStyles.searchInput, { color: currentTheme.colors.text }]}
                placeholder="Search sources..."
                placeholderTextColor={currentTheme.colors.textSecondary}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>

            {/* Anime/Manga Sources */}
            <SettingsSection title="Anime & Manga" icon="play-circle" iconColor="#EC407A">
              <SettingsToggle
                title="AniList Trending"
                description="Show trending anime and manga from AniList"
                value={settings.enableAniList}
                onValueChange={(value) => updateSetting('enableAniList', value)}
              />
              <SettingsToggle
                title="Anime News Network"
                description="Latest anime and manga news from ANN"
                value={settings.enableANN}
                onValueChange={(value) => updateSetting('enableANN', value)}
              />
              <SettingsToggle
                title="Crunchyroll News"
                description="Official news from Crunchyroll"
                value={settings.enableCrunchyrollNews}
                onValueChange={(value) => updateSetting('enableCrunchyrollNews', value)}
              />
              <SettingsToggle
                title="MyAnimeList News"
                description="Community news and updates from MAL"
                value={settings.enableMyAnimeListNews}
                onValueChange={(value) => updateSetting('enableMyAnimeListNews', value)}
              />
            </SettingsSection>

            {/* Japan Sources */}
            <SettingsSection title="Japan News" icon="torii-gate" iconColor="#E91E63">
              <SettingsToggle
                title="The Japan Times"
                description="English news from Japan's leading newspaper"
                value={settings.enableJapanTimes}
                onValueChange={(value) => updateSetting('enableJapanTimes', value)}
              />
              <SettingsToggle
                title="NHK World"
                description="Japan's international broadcasting service"
                value={settings.enableNHKWorld}
                onValueChange={(value) => updateSetting('enableNHKWorld', value)}
              />
              <SettingsToggle
                title="SoraNews24"
                description="Fun and quirky news from Japan"
                value={settings.enableSoraNews24}
                onValueChange={(value) => updateSetting('enableSoraNews24', value)}
              />
              <SettingsToggle
                title="Tokyo Reporter"
                description="Crime, culture, and current events in Tokyo"
                value={settings.enableTokyoReporter}
                onValueChange={(value) => updateSetting('enableTokyoReporter', value)}
              />
            </SettingsSection>
          </View>
        );

      case 'categories':
        return (
          <View>
            <SettingsSection title="Content Topics" icon="tags" iconColor="#9C27B0">
              <SettingsToggle
                title="📺 Anime News"
                description="Latest anime releases, announcements, and updates"
                value={settings.enableAnimeNews}
                onValueChange={(value) => updateSetting('enableAnimeNews', value)}
              />
              <SettingsToggle
                title="📚 Manga News"
                description="New manga releases and manga industry news"
                value={settings.enableMangaNews}
                onValueChange={(value) => updateSetting('enableMangaNews', value)}
              />
              <SettingsToggle
                title="📖 Light Novel News"
                description="Light novel adaptations and releases"
                value={settings.enableLightNovelNews}
                onValueChange={(value) => updateSetting('enableLightNovelNews', value)}
              />
              <SettingsToggle
                title="🏯 Japan Culture"
                description="Traditional and modern Japanese culture"
                value={settings.enableJapanCulture}
                onValueChange={(value) => updateSetting('enableJapanCulture', value)}
              />
              <SettingsToggle
                title="💻 Technology"
                description="Japanese tech innovations and gaming"
                value={settings.enableTechnology}
                onValueChange={(value) => updateSetting('enableTechnology', value)}
              />
              <SettingsToggle
                title="🎮 Gaming"
                description="Japanese video games and gaming culture"
                value={settings.enableGaming}
                onValueChange={(value) => updateSetting('enableGaming', value)}
              />
              <SettingsToggle
                title="🎭 Entertainment"
                description="J-pop, dramas, movies, and celebrities"
                value={settings.enableEntertainment}
                onValueChange={(value) => updateSetting('enableEntertainment', value)}
              />
              <SettingsToggle
                title="🍜 Lifestyle"
                description="Food, fashion, and daily life in Japan"
                value={settings.enableLifestyle}
                onValueChange={(value) => updateSetting('enableLifestyle', value)}
              />
            </SettingsSection>
          </View>
        );

      case 'preferences':
        return (
          <View>
            {/* Basic Preferences */}
            <SettingsSection title="Feed Behavior" icon="sliders-h" iconColor="#2196F3">
              <SettingsToggle
                title="🇯🇵 Prioritize Japan Content"
                description="Show Japan-related news first in your feed"
                value={settings.prioritizeJapanContent}
                onValueChange={(value) => updateSetting('prioritizeJapanContent', value)}
              />
              <SettingsToggle
                title="🔥 Show Trending Only"
                description="Only display trending and popular news items"
                value={settings.showTrendingOnly}
                onValueChange={(value) => updateSetting('showTrendingOnly', value)}
              />
              <SettingsToggle
                title="♾️ Endless Loading"
                description="Automatically load more news as you scroll"
                value={settings.enableEndlessLoading}
                onValueChange={(value) => updateSetting('enableEndlessLoading', value)}
              />
            </SettingsSection>

            {/* Display Options */}
            <SettingsSection title="Display" icon="eye" iconColor="#FF9800">
              <SettingsToggle
                title="🖼️ Show Thumbnails"
                description="Display thumbnail images for news items"
                value={settings.showThumbnails}
                onValueChange={(value) => updateSetting('showThumbnails', value)}
              />
              <SettingsToggle
                title="⭐ Show Scores"
                description="Display ratings and scores for anime/manga news"
                value={settings.showScores}
                onValueChange={(value) => updateSetting('showScores', value)}
              />
              <SettingsToggle
                title="🕒 Show Timestamps"
                description="Display when news items were published"
                value={settings.showTimestamps}
                onValueChange={(value) => updateSetting('showTimestamps', value)}
              />
              <SettingsToggle
                title="📱 Compact View"
                description="Use a more compact layout for news items"
                value={settings.compactView}
                onValueChange={(value) => updateSetting('compactView', value)}
              />
            </SettingsSection>

            {/* Language Options */}
            <SettingsSection title="Language" icon="globe-asia" iconColor="#4CAF50">
              <SettingsRadioGroup
                title="Preferred Language"
                description="Choose your preferred language for news content"
                options={[
                  { label: 'English', value: 'en' },
                  { label: 'Japanese', value: 'ja' },
                  { label: 'Both', value: 'both' }
                ]}
                selectedValue={settings.preferredLanguage}
                onValueChange={(value) => updateSetting('preferredLanguage', value as 'en' | 'ja' | 'both')}
              />
              <SettingsToggle
                title="🈳 Show Japanese Text"
                description="Display original Japanese text when available"
                value={settings.showJapaneseText}
                onValueChange={(value) => updateSetting('showJapaneseText', value)}
              />
              <SettingsToggle
                title="🔄 Auto Translation"
                description="Automatically translate Japanese content to English"
                value={settings.enableAutoTranslation}
                onValueChange={(value) => updateSetting('enableAutoTranslation', value)}
              />
            </SettingsSection>

            {/* Advanced Settings */}
            <TouchableOpacity
              style={[newStyles.advancedToggle, { backgroundColor: currentTheme.colors.surface }]}
              onPress={() => setShowAdvanced(!showAdvanced)}
            >
              <Text style={[newStyles.advancedToggleText, { color: currentTheme.colors.text }]}>
                ⚙️ Advanced Settings
              </Text>
              <FontAwesome5 
                name={showAdvanced ? "chevron-up" : "chevron-down"} 
                size={16} 
                color={currentTheme.colors.textSecondary} 
              />
            </TouchableOpacity>

            {showAdvanced && (
              <SettingsSection title="Advanced" icon="cogs" iconColor="#666">
                <SettingsSlider
                  title="Refresh Interval"
                  description="How often to check for new news (minutes)"
                  value={settings.newsRefreshInterval}
                  onValueChange={(value) => updateSetting('newsRefreshInterval', value)}
                  minimumValue={5}
                  maximumValue={120}
                  step={5}
                  valueFormatter={(val) => `${val} min`}
                />
                <SettingsSlider
                  title="Max News Items"
                  description="Maximum number of news items to load"
                  value={settings.maxNewsItems}
                  onValueChange={(value) => updateSetting('maxNewsItems', value)}
                  minimumValue={10}
                  maximumValue={200}
                  step={10}
                  valueFormatter={(val) => `${val} items`}
                />
              </SettingsSection>
            )}
          </View>
        );

      default:
        return null;
    }
  };

  return (
    <SettingsLayout title="News Settings">
      {/* Tab Navigation */}
      <View style={[newStyles.tabContainer, { backgroundColor: currentTheme.colors.background }]}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={newStyles.tabScrollContent}
        >
          {tabs.map((tab) => (
            <TouchableOpacity
              key={tab.id}
              style={[
                newStyles.tab,
                activeTab === tab.id && newStyles.activeTab,
                { 
                  backgroundColor: activeTab === tab.id ? currentTheme.colors.primary : 'transparent',
                  borderColor: currentTheme.colors.border 
                }
              ]}
              onPress={() => setActiveTab(tab.id)}
            >
              <FontAwesome5 
                name={tab.icon} 
                size={14} 
                color={activeTab === tab.id ? '#fff' : currentTheme.colors.textSecondary} 
              />
              <Text style={[
                newStyles.tabText,
                { color: activeTab === tab.id ? '#fff' : currentTheme.colors.textSecondary }
              ]}>
                {tab.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Tab Content */}
      {renderTabContent()}

      {/* Footer */}
      <View style={newStyles.footer}>
        <Text style={[newStyles.footerText, { color: currentTheme.colors.textSecondary }]}>
          💡 Changes are saved automatically
        </Text>
      </View>
    </SettingsLayout>
  );
}

const newStyles = StyleSheet.create({
  tabContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  tabScrollContent: {
    paddingRight: 16,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    borderRadius: 20,
    borderWidth: 1,
    gap: 6,
  },
  activeTab: {
    // Styles handled by backgroundColor prop
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
  },
  statsCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  statsTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  statsText: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
  },
  statsSubtext: {
    fontSize: 12,
    opacity: 0.8,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
    marginTop: 8,
  },
  sectionSubtitle: {
    fontSize: 14,
    marginBottom: 16,
    opacity: 0.8,
  },
  presetCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
  },
  presetContent: {
    flex: 1,
  },
  presetName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  presetDescription: {
    fontSize: 13,
    opacity: 0.8,
  },
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 8,
    gap: 8,
  },
  resetText: {
    fontSize: 14,
    fontWeight: '500',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    padding: 0,
  },
  advancedToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    marginVertical: 16,
  },
  advancedToggleText: {
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    padding: 16,
    alignItems: 'center',
    marginTop: 20,
  },
  footerText: {
    fontSize: 13,
    textAlign: 'center',
    opacity: 0.7,
  },
});

// Export the settings interface and default values for use in other components
export type { NewsSettings };
export { DEFAULT_SETTINGS as defaultNewsSettings };
