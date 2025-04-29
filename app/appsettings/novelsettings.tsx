import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Switch, Platform, DeviceEventEmitter, BackHandler } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../../hooks/useTheme';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Slider from '@react-native-community/slider';

// Storage keys used in NovelReader
const STORAGE_KEYS = {
  FONT_SIZE: 'reader_font_size',
  THEME: 'reader_theme',
  FONT: 'reader_font',
  LINE_HEIGHT: 'reader_line_height',
  TEXT_ALIGN: 'reader_text_align',
  PARAGRAPH_SPACING: 'reader_paragraph_spacing',
  MARGIN_SIZE: 'reader_margin_size',
  DONT_ASK_SAVE: 'reader_dont_ask_save'
};

// Interface for novel reader preferences
interface NovelReaderPreferences {
  fontSize: number;
  theme: 'light' | 'dark' | 'sepia' | 'amoled' | 'cream';
  font: 'inter' | 'merriweather' | 'lora' | 'sourceSansPro';
  lineHeight: number;
  textAlign: 'left' | 'justify';
  paragraphSpacing: number;
  marginSize: 'compact' | 'normal' | 'wide';
  dontAskSave: boolean;
}

// Font definitions
const FONTS = {
  inter: {
    name: 'Inter',
    label: 'Inter'
  },
  merriweather: {
    name: 'Merriweather',
    label: 'Merriweather'
  },
  lora: {
    name: 'Lora',
    label: 'Lora'
  },
  sourceSansPro: {
    name: 'Source Sans Pro',
    label: 'Source Sans'
  }
};

// Theme definitions
const THEMES = {
  light: {
    name: 'Light',
    color: '#FFFFFF',
    textColor: '#2C3E50'
  },
  dark: {
    name: 'Dark',
    color: '#1A1A1A',
    textColor: '#E0E0E0'
  },
  sepia: {
    name: 'Sepia',
    color: '#F5ECE2',
    textColor: '#5C4B3C'
  },
  amoled: {
    name: 'AMOLED',
    color: '#000000',
    textColor: '#CCCCCC'
  },
  cream: {
    name: 'Cream',
    color: '#FFF8E7',
    textColor: '#4A4A4A'
  }
};

export default function NovelSettingsPage() {
  const router = useRouter();
  const { isDarkMode, currentTheme } = useTheme();
  const [activeTab, setActiveTab] = useState('reading'); // 'reading' or 'misc'
  
  // State for novel reader settings
  const [readerPreferences, setReaderPreferences] = useState<NovelReaderPreferences>({
    fontSize: 18,
    theme: 'light',
    font: 'merriweather',
    lineHeight: 1.6,
    textAlign: 'left',
    paragraphSpacing: 24,
    marginSize: 'normal',
    dontAskSave: false
  });

  // Load settings from AsyncStorage
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const [
          savedFontSize,
          savedTheme,
          savedFont,
          savedLineHeight,
          savedTextAlign,
          savedParagraphSpacing,
          savedMarginSize,
          savedDontAskSave
        ] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEYS.FONT_SIZE),
          AsyncStorage.getItem(STORAGE_KEYS.THEME),
          AsyncStorage.getItem(STORAGE_KEYS.FONT),
          AsyncStorage.getItem(STORAGE_KEYS.LINE_HEIGHT),
          AsyncStorage.getItem(STORAGE_KEYS.TEXT_ALIGN),
          AsyncStorage.getItem(STORAGE_KEYS.PARAGRAPH_SPACING),
          AsyncStorage.getItem(STORAGE_KEYS.MARGIN_SIZE),
          AsyncStorage.getItem(STORAGE_KEYS.DONT_ASK_SAVE)
        ]);

        const updatedPreferences = { ...readerPreferences };
        
        if (savedFontSize) updatedPreferences.fontSize = Number(savedFontSize);
        if (savedTheme) updatedPreferences.theme = savedTheme as NovelReaderPreferences['theme'];
        if (savedFont) updatedPreferences.font = savedFont as NovelReaderPreferences['font'];
        if (savedLineHeight) updatedPreferences.lineHeight = Number(savedLineHeight);
        if (savedTextAlign) updatedPreferences.textAlign = savedTextAlign as NovelReaderPreferences['textAlign'];
        if (savedParagraphSpacing) updatedPreferences.paragraphSpacing = Number(savedParagraphSpacing);
        if (savedMarginSize) updatedPreferences.marginSize = savedMarginSize as NovelReaderPreferences['marginSize'];
        if (savedDontAskSave) updatedPreferences.dontAskSave = savedDontAskSave === 'true';
        
        setReaderPreferences(updatedPreferences);
      } catch (error) {
        console.error('Failed to load novel reader settings:', error);
      }
    };

    loadSettings();
  }, []);

  // Save reader preferences
  const saveReaderPreferences = async (newPreferences: NovelReaderPreferences) => {
    try {
      // Update UI state first
      setReaderPreferences(newPreferences);
      
      // Then save to AsyncStorage
      await Promise.all([
        AsyncStorage.setItem(STORAGE_KEYS.FONT_SIZE, newPreferences.fontSize.toString()),
        AsyncStorage.setItem(STORAGE_KEYS.THEME, newPreferences.theme),
        AsyncStorage.setItem(STORAGE_KEYS.FONT, newPreferences.font),
        AsyncStorage.setItem(STORAGE_KEYS.LINE_HEIGHT, newPreferences.lineHeight.toString()),
        AsyncStorage.setItem(STORAGE_KEYS.TEXT_ALIGN, newPreferences.textAlign),
        AsyncStorage.setItem(STORAGE_KEYS.PARAGRAPH_SPACING, newPreferences.paragraphSpacing.toString()),
        AsyncStorage.setItem(STORAGE_KEYS.MARGIN_SIZE, newPreferences.marginSize),
        AsyncStorage.setItem(STORAGE_KEYS.DONT_ASK_SAVE, newPreferences.dontAskSave.toString())
      ]);
      
      // Broadcast an event so other components can update
      DeviceEventEmitter.emit('novelReaderPreferencesChanged', newPreferences);
    } catch (error) {
      console.error('Failed to save novel reader preferences:', error);
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
  const renderReadingTab = () => (
    <>
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <FontAwesome5 name="book-reader" size={20} color="#4A90E2" />
          <Text style={[styles.sectionTitle, { color: currentTheme.colors.text }]}>Reading Settings</Text>
        </View>

        {/* Font Family Setting */}
        <View style={[styles.settingItem, { borderBottomColor: currentTheme.colors.border }]}>
          <View style={{ marginBottom: 12 }}>
            <Text style={[styles.settingLabel, { color: currentTheme.colors.text }]}>Font</Text>
          </View>
          <View style={styles.fontOptions}>
            {Object.entries(FONTS).map(([key, value]) => (
              <TouchableOpacity
                key={`font-${key}`}
                style={[
                  styles.fontOption,
                  readerPreferences.font === key && styles.fontOptionSelected
                ]}
                onPress={() => {
                  saveReaderPreferences({
                    ...readerPreferences,
                    font: key as NovelReaderPreferences['font']
                  });
                }}
              >
                <Text style={[
                  styles.fontOptionText,
                  { color: readerPreferences.font === key ? '#fff' : currentTheme.colors.text }
                ]}>
                  {value.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Font Size Setting */}
        <View style={[styles.settingItem, { borderBottomColor: currentTheme.colors.border }]}>
          <Text style={[styles.settingLabel, { color: currentTheme.colors.text }]}>Font Size</Text>
          <View style={styles.sliderContainer}>
            <Slider
              style={{ width: '90%', height: 40 }}
              minimumValue={12}
              maximumValue={32}
              step={1}
              value={readerPreferences.fontSize}
              onValueChange={(value) => {
                saveReaderPreferences({
                  ...readerPreferences,
                  fontSize: value
                });
              }}
              minimumTrackTintColor="#4A90E2"
              maximumTrackTintColor="#777777"
              thumbTintColor="#4A90E2"
            />
            <Text style={[styles.sliderValue, { color: currentTheme.colors.text }]}>
              {readerPreferences.fontSize}px
            </Text>
          </View>
        </View>

        {/* Line Height Setting */}
        <View style={[styles.settingItem, { borderBottomColor: currentTheme.colors.border }]}>
          <Text style={[styles.settingLabel, { color: currentTheme.colors.text }]}>Line Height</Text>
          <View style={styles.sliderContainer}>
            <Slider
              style={{ width: '90%', height: 40 }}
              minimumValue={1.0}
              maximumValue={2.5}
              step={0.1}
              value={readerPreferences.lineHeight}
              onValueChange={(value) => {
                saveReaderPreferences({
                  ...readerPreferences,
                  lineHeight: value
                });
              }}
              minimumTrackTintColor="#4A90E2"
              maximumTrackTintColor="#777777"
              thumbTintColor="#4A90E2"
            />
            <Text style={[styles.sliderValue, { color: currentTheme.colors.text }]}>
              {readerPreferences.lineHeight.toFixed(1)}
            </Text>
          </View>
        </View>

        {/* Paragraph Spacing Setting */}
        <View style={[styles.settingItem, { borderBottomColor: currentTheme.colors.border }]}>
          <Text style={[styles.settingLabel, { color: currentTheme.colors.text }]}>Paragraph Spacing</Text>
          <View style={styles.sliderContainer}>
            <Slider
              style={{ width: '90%', height: 40 }}
              minimumValue={12}
              maximumValue={40}
              step={2}
              value={readerPreferences.paragraphSpacing}
              onValueChange={(value) => {
                saveReaderPreferences({
                  ...readerPreferences,
                  paragraphSpacing: value
                });
              }}
              minimumTrackTintColor="#4A90E2"
              maximumTrackTintColor="#777777"
              thumbTintColor="#4A90E2"
            />
            <Text style={[styles.sliderValue, { color: currentTheme.colors.text }]}>
              {readerPreferences.paragraphSpacing}px
            </Text>
          </View>
        </View>

        {/* Text Alignment Setting */}
        <View style={[styles.settingItem, { borderBottomColor: currentTheme.colors.border }]}>
          <View style={{ marginBottom: 12 }}>
            <Text style={[styles.settingLabel, { color: currentTheme.colors.text }]}>Text Alignment</Text>
          </View>
          <View style={styles.alignmentOptions}>
            {[
              { id: 'left', name: 'Left', icon: 'align-left' },
              { id: 'justify', name: 'Justify', icon: 'align-justify' }
            ].map(alignment => (
              <TouchableOpacity
                key={`alignment-${alignment.id}`}
                style={[
                  styles.alignmentOption,
                  readerPreferences.textAlign === alignment.id && styles.alignmentOptionSelected
                ]}
                onPress={() => {
                  saveReaderPreferences({
                    ...readerPreferences,
                    textAlign: alignment.id as 'left' | 'justify'
                  });
                }}
              >
                <FontAwesome5 
                  name={alignment.icon} 
                  size={14} 
                  color={readerPreferences.textAlign === alignment.id ? '#fff' : currentTheme.colors.text} 
                />
                <Text style={[
                  styles.alignmentOptionText,
                  { color: readerPreferences.textAlign === alignment.id ? '#fff' : currentTheme.colors.text }
                ]}>
                  {alignment.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Margin Size Setting */}
        <View style={[styles.settingItem, { borderBottomColor: currentTheme.colors.border }]}>
          <View style={{ marginBottom: 12 }}>
            <Text style={[styles.settingLabel, { color: currentTheme.colors.text }]}>Margin Size</Text>
          </View>
          <View style={styles.marginOptions}>
            {[
              { id: 'compact', name: 'Compact' },
              { id: 'normal', name: 'Normal' },
              { id: 'wide', name: 'Wide' }
            ].map(margin => (
              <TouchableOpacity
                key={`margin-${margin.id}`}
                style={[
                  styles.marginOption,
                  readerPreferences.marginSize === margin.id && styles.marginOptionSelected
                ]}
                onPress={() => {
                  saveReaderPreferences({
                    ...readerPreferences,
                    marginSize: margin.id as 'compact' | 'normal' | 'wide'
                  });
                }}
              >
                <Text style={[
                  styles.marginOptionText,
                  { color: readerPreferences.marginSize === margin.id ? '#fff' : currentTheme.colors.text }
                ]}>
                  {margin.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    </>
  );

  const renderMiscTab = () => (
    <>
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <FontAwesome5 name="palette" size={20} color="#9C27B0" />
          <Text style={[styles.sectionTitle, { color: currentTheme.colors.text }]}>Theme Settings</Text>
        </View>

        {/* Theme Selection */}
        <View style={[styles.settingItem, { borderBottomColor: currentTheme.colors.border }]}>
          <View style={{ marginBottom: 12 }}>
            <Text style={[styles.settingLabel, { color: currentTheme.colors.text }]}>Theme</Text>
          </View>
          <View style={styles.themeGrid}>
            <View style={styles.themeRow}>
              <TouchableOpacity
                style={[
                  styles.themeOption,
                  { backgroundColor: THEMES.light.color },
                  readerPreferences.theme === 'light' && styles.themeOptionSelected
                ]}
                onPress={() => {
                  saveReaderPreferences({
                    ...readerPreferences,
                    theme: 'light'
                  });
                }}
              >
                <Text style={[styles.themeOptionText, { color: THEMES.light.textColor }]}>
                  Light
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.themeOption,
                  { backgroundColor: THEMES.dark.color },
                  readerPreferences.theme === 'dark' && styles.themeOptionSelected
                ]}
                onPress={() => {
                  saveReaderPreferences({
                    ...readerPreferences,
                    theme: 'dark'
                  });
                }}
              >
                <Text style={[styles.themeOptionText, { color: THEMES.dark.textColor }]}>
                  Dark
                </Text>
              </TouchableOpacity>
            </View>
            <View style={styles.themeRow}>
              <TouchableOpacity
                style={[
                  styles.themeOption,
                  { backgroundColor: THEMES.sepia.color },
                  readerPreferences.theme === 'sepia' && styles.themeOptionSelected
                ]}
                onPress={() => {
                  saveReaderPreferences({
                    ...readerPreferences,
                    theme: 'sepia'
                  });
                }}
              >
                <Text style={[styles.themeOptionText, { color: THEMES.sepia.textColor }]}>
                  Sepia
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.themeOption,
                  { backgroundColor: THEMES.amoled.color },
                  readerPreferences.theme === 'amoled' && styles.themeOptionSelected
                ]}
                onPress={() => {
                  saveReaderPreferences({
                    ...readerPreferences,
                    theme: 'amoled'
                  });
                }}
              >
                <Text style={[styles.themeOptionText, { color: THEMES.amoled.textColor }]}>
                  AMOLED
                </Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={[
                styles.themeOption,
                styles.themeOptionFull,
                { backgroundColor: THEMES.cream.color },
                readerPreferences.theme === 'cream' && styles.themeOptionSelected
              ]}
              onPress={() => {
                saveReaderPreferences({
                  ...readerPreferences,
                  theme: 'cream'
                });
              }}
            >
              <Text style={[styles.themeOptionText, { color: THEMES.cream.textColor }]}>
                Cream
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={[styles.settingItem, { borderBottomColor: currentTheme.colors.border }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={[styles.settingLabel, { color: currentTheme.colors.text, marginBottom: 0 }]}>Don't Ask to Save Progress</Text>
            <Switch
              value={readerPreferences.dontAskSave}
              onValueChange={(value) => {
                saveReaderPreferences({
                  ...readerPreferences,
                  dontAskSave: value
                });
              }}
              trackColor={{ false: '#767577', true: '#9C27B0' }}
              thumbColor={readerPreferences.dontAskSave ? '#fff' : '#f4f3f4'}
            />
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <TouchableOpacity 
          style={[styles.settingItem, { borderBottomColor: currentTheme.colors.border }]}
          onPress={() => {
            // Clear cache action
            AsyncStorage.removeItem('recentlyReadNovels');
            alert('Novel reading history cleared successfully');
          }}
        >
          <View style={styles.settingItemContent}>
            <Text style={[styles.settingLabel, { color: currentTheme.colors.text, marginBottom: 0 }]}>Clear Reading History</Text>
            <FontAwesome5 name="trash-alt" size={20} color="#f44336" />
          </View>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.settingItem, { borderBottomColor: currentTheme.colors.border }]}
          onPress={() => {
            // Reset all novel reader settings to default
            const defaultSettings: NovelReaderPreferences = {
              fontSize: 18,
              theme: 'light',
              font: 'merriweather',
              lineHeight: 1.6,
              textAlign: 'left',
              paragraphSpacing: 24,
              marginSize: 'normal',
              dontAskSave: false
            };
            saveReaderPreferences(defaultSettings);
            alert('Reader settings reset to default');
          }}
        >
          <View style={styles.settingItemContent}>
            <Text style={[styles.settingLabel, { color: currentTheme.colors.text, marginBottom: 0 }]}>Reset Reader Settings</Text>
            <FontAwesome5 name="undo" size={20} color="#f44336" />
          </View>
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
      <Text style={[styles.headerTitle, { color: currentTheme.colors.text }]}>Novel Settings</Text>
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
            activeTab === 'reading' && styles.activeTabButton
          ]}
          onPress={() => setActiveTab('reading')}
        >
          <FontAwesome5 
            name="book-reader" 
            size={18} 
            color={activeTab === 'reading' ? "#4A90E2" : currentTheme.colors.text} 
          />
          <Text 
            style={[
              styles.tabButtonText, 
              { color: activeTab === 'reading' ? "#4A90E2" : currentTheme.colors.text }
            ]}
          >
            Reading
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[
            styles.tabButton,
            activeTab === 'misc' && styles.activeTabButton
          ]}
          onPress={() => setActiveTab('misc')}
        >
          <FontAwesome5 
            name="palette" 
            size={18} 
            color={activeTab === 'misc' ? "#9C27B0" : currentTheme.colors.text} 
          />
          <Text 
            style={[
              styles.tabButtonText, 
              { color: activeTab === 'misc' ? "#9C27B0" : currentTheme.colors.text }
            ]}
          >
            Theme & Misc
          </Text>
        </TouchableOpacity>
      </View>

      {/* Settings Content */}
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {activeTab === 'reading' && renderReadingTab()}
        {activeTab === 'misc' && renderMiscTab()}
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
  fontOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  fontOption: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    marginBottom: 8,
  },
  fontOptionSelected: {
    backgroundColor: '#4A90E2',
    borderColor: '#4A90E2',
  },
  fontOptionText: {
    fontSize: 15,
    fontWeight: '500',
  },
  sliderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  sliderValue: {
    width: 50,
    textAlign: 'right',
    fontSize: 14,
  },
  alignmentOptions: {
    flexDirection: 'row',
    gap: 12,
  },
  alignmentOption: {
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  alignmentOptionSelected: {
    backgroundColor: '#4A90E2',
    borderColor: '#4A90E2',
  },
  alignmentOptionText: {
    fontSize: 15,
    fontWeight: '500',
  },
  marginOptions: {
    flexDirection: 'row',
    gap: 8,
  },
  marginOption: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  marginOptionSelected: {
    backgroundColor: '#4A90E2',
    borderColor: '#4A90E2',
  },
  marginOptionText: {
    fontSize: 14,
    fontWeight: '500',
  },
  themeGrid: {
    width: '100%',
  },
  themeRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  themeOption: {
    flex: 1,
    height: 80,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  themeOptionFull: {
    width: '100%',
  },
  themeOptionSelected: {
    borderColor: '#4A90E2',
    borderWidth: 2,
  },
  themeOptionText: {
    fontSize: 16,
    fontWeight: '600',
  },
  settingItemContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
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
    borderBottomColor: '#4A90E2',
  },
  tabButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
}); 