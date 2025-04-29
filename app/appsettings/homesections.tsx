import { View, Text, StyleSheet, TouchableOpacity, Switch, Platform, TextInput, DeviceEventEmitter, ActivityIndicator, BackHandler, ScrollView } from 'react-native';
import { useCallback, useEffect, useState } from 'react';
import { FontAwesome5 } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../../hooks/useTheme';
import DraggableFlatList, { ScaleDecorator } from 'react-native-draggable-flatlist';
import * as SecureStore from 'expo-secure-store';
import { STORAGE_KEY } from '../../constants/auth';

// Define welcome section storage key
const WELCOME_SECTION_STORAGE_KEY = "welcome_section";

// Welcome section type enum
enum WelcomeSectionType {
  BASIC = 'basic',
  ACHIEVEMENT = 'achievement'
}

interface Section {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  visible: boolean;
  order: number;
}

// Welcome section preferences interface
interface WelcomeSectionPreferences {
  type: WelcomeSectionType;
}

const DEFAULT_WELCOME_PREFERENCES: WelcomeSectionPreferences = {
  type: WelcomeSectionType.BASIC
};

const DEFAULT_SECTIONS: Section[] = [
  {
    id: 'watching',
    title: 'Continue Watching',
    subtitle: 'Currently watching anime',
    icon: 'play-circle',
    visible: true,
    order: 0,
  },
  {
    id: 'reading',
    title: 'Continue Reading',
    subtitle: 'Currently reading manga',
    icon: 'book-reader',
    visible: true,
    order: 1,
  },
  {
    id: 'completedAnime',
    title: 'Completed Anime',
    subtitle: 'Finished watching',
    icon: 'check-circle',
    visible: true,
    order: 2,
  },
  {
    id: 'completedManga',
    title: 'Completed Manga',
    subtitle: 'Finished reading',
    icon: 'book',
    visible: true,
    order: 3,
  },
  {
    id: 'planningAnime',
    title: 'Planned Anime',
    subtitle: 'Plan to watch',
    icon: 'clock',
    visible: true,
    order: 4,
  },
  {
    id: 'planningManga',
    title: 'Planned Manga',
    subtitle: 'Plan to read',
    icon: 'bookmark',
    visible: true,
    order: 5,
  },
  {
    id: 'news',
    title: 'News & Updates',
    subtitle: 'Latest anime & manga news',
    icon: 'newspaper',
    visible: true,
    order: 6,
  },
];

export default function HomeSectionsScreen() {
  const router = useRouter();
  const { isDarkMode, currentTheme } = useTheme();
  const [sections, setSections] = useState<Section[]>([]);
  const [welcomePreferences, setWelcomePreferences] = useState<WelcomeSectionPreferences>(DEFAULT_WELCOME_PREFERENCES);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSectionPreferences();
    loadWelcomePreferences();
  }, []);

  // Handle back navigation
  const handleBack = () => {
    // Save settings first
    saveSectionPreferences(sections, false);
    saveWelcomePreferences(welcomePreferences);
    // Tell the AppSettingsModal to show the settings page
    DeviceEventEmitter.emit('showSettings');
    // Push directly to the settings screen
    router.replace('/settings');
    return true;
  };

  // Handle hardware back button
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      saveSectionPreferences(sections, true);
      saveWelcomePreferences(welcomePreferences);
      return true;
    });

    return () => backHandler.remove();
  }, [sections, welcomePreferences]);

  // Load welcome section preferences
  const loadWelcomePreferences = async () => {
    try {
      console.log('[Sections] Loading welcome section preferences...');
      const savedWelcomePrefs = await SecureStore.getItemAsync(WELCOME_SECTION_STORAGE_KEY);
      
      if (savedWelcomePrefs) {
        try {
          const parsedPrefs = JSON.parse(savedWelcomePrefs);
          console.log('[Sections] Loaded welcome preferences:', parsedPrefs);
          setWelcomePreferences(parsedPrefs);
        } catch (parseError) {
          console.error('[Sections] Error parsing welcome preferences:', parseError);
          setWelcomePreferences(DEFAULT_WELCOME_PREFERENCES);
          await SecureStore.setItemAsync(WELCOME_SECTION_STORAGE_KEY, JSON.stringify(DEFAULT_WELCOME_PREFERENCES));
        }
      } else {
        console.log('[Sections] No saved welcome preferences, using defaults');
        setWelcomePreferences(DEFAULT_WELCOME_PREFERENCES);
        await SecureStore.setItemAsync(WELCOME_SECTION_STORAGE_KEY, JSON.stringify(DEFAULT_WELCOME_PREFERENCES));
      }
    } catch (error) {
      console.error('[Sections] Error loading welcome preferences:', error);
      // Fallback to defaults
      setWelcomePreferences(DEFAULT_WELCOME_PREFERENCES);
    }
  };

  // Save welcome section preferences
  const saveWelcomePreferences = async (prefs: WelcomeSectionPreferences) => {
    try {
      console.log('[Sections] Saving welcome section preferences:', prefs);
      await SecureStore.setItemAsync(WELCOME_SECTION_STORAGE_KEY, JSON.stringify(prefs));
    } catch (error) {
      console.error('[Sections] Error saving welcome preferences:', error);
    }
  };

  const loadSectionPreferences = async () => {
    try {
      setIsLoading(true);
      setError(null);
      console.log('[Sections] Starting to load section preferences...');
      
      // Try to load saved preferences
      const savedPreferences = await SecureStore.getItemAsync(STORAGE_KEY.HOME_SECTIONS);
      
      if (savedPreferences) {
        console.log('[Sections] Found saved preferences, parsing...');
        try {
          const parsedSections = JSON.parse(savedPreferences);
          // Validate the parsed sections
          if (!Array.isArray(parsedSections)) {
            console.log('[Sections] Error: Invalid section data format');
            throw new Error('Invalid section data format');
          }
          
          // Ensure all default sections exist with saved preferences
          const mergedSections = DEFAULT_SECTIONS.map(defaultSection => {
            const savedSection = parsedSections.find((s: Section) => s.id === defaultSection.id);
            if (savedSection) {
              // Preserve the default properties while using saved visibility and order
              return {
                ...defaultSection,
                visible: savedSection.visible,
                order: savedSection.order
              };
            }
            return defaultSection;
          });
          
          console.log('[Sections] Merged with defaults:', mergedSections.map(s => ({
            id: s.id,
            visible: s.visible,
            order: s.order
          })));
          
          setSections(mergedSections);
        } catch (parseError) {
          console.error('[Sections] Error parsing section preferences:', parseError);
          // If preferences are corrupted, reset to defaults
          console.log('[Sections] Resetting to default preferences');
          await SecureStore.deleteItemAsync(STORAGE_KEY.HOME_SECTIONS);
          setSections(DEFAULT_SECTIONS);
          await SecureStore.setItemAsync(STORAGE_KEY.HOME_SECTIONS, JSON.stringify(DEFAULT_SECTIONS));
        }
      } else {
        console.log('[Sections] No saved preferences found, using defaults');
        setSections(DEFAULT_SECTIONS);
        await SecureStore.setItemAsync(STORAGE_KEY.HOME_SECTIONS, JSON.stringify(DEFAULT_SECTIONS));
      }
    } catch (error) {
      console.error('[Sections] Error loading section preferences:', error);
      setError('Failed to load section preferences');
      // Fallback to defaults
      console.log('[Sections] Error occurred, falling back to defaults');
      setSections(DEFAULT_SECTIONS);
    } finally {
      console.log('[Sections] Finished loading preferences');
      setIsLoading(false);
    }
  };

  const saveSectionPreferences = async (updatedSections: Section[], shouldNavigateBack: boolean = false) => {
    try {
      console.log('[Sections] Saving section preferences...');
      
      // Create a map of the updated sections for easy lookup
      const updatedSectionsMap = new Map(updatedSections.map(section => [section.id, section]));
      
      // Map over the updated sections to preserve their order and properties
      const finalSections = updatedSections.map(section => {
        const defaultSection = DEFAULT_SECTIONS.find(d => d.id === section.id);
        if (!defaultSection) return section;
        
        return {
          ...defaultSection,
          visible: section.visible,
          order: section.order
        };
      });

      console.log('[Sections] Saving updated preferences:', finalSections.map(s => ({
        id: s.id,
        visible: s.visible,
        order: s.order
      })));

      await SecureStore.setItemAsync(STORAGE_KEY.HOME_SECTIONS, JSON.stringify(finalSections));
      setSections(finalSections);

      if (shouldNavigateBack) {
        DeviceEventEmitter.emit('showSettings');
        router.replace('/settings');
      }
    } catch (error) {
      console.error('[Sections] Error saving section preferences:', error);
      setError('Failed to save section preferences');
    }
  };

  // Render item for the draggable list
  const renderDraggableItem = useCallback(({ item, drag, isActive }: any) => {
    return (
      <ScaleDecorator>
        <View style={[
          styles.sectionItem,
          {
            backgroundColor: isActive ? currentTheme.colors.border : currentTheme.colors.surface,
            borderBottomColor: currentTheme.colors.border,
            elevation: isActive ? 5 : 0,
            shadowColor: '#000',
            shadowOffset: isActive ? { width: 0, height: 2 } : { width: 0, height: 0 },
            shadowOpacity: isActive ? 0.25 : 0,
            shadowRadius: isActive ? 3.84 : 0,
          },
        ]}>
          <TouchableOpacity
            activeOpacity={0.7}
            onPressIn={drag}
            style={styles.sectionContent}
          >
            <View style={styles.dragHandle}>
              <FontAwesome5 name="grip-lines" size={14} color={currentTheme.colors.textSecondary} style={{ opacity: 0.8 }} />
            </View>
            <View style={styles.sectionIcon}>
              <FontAwesome5 name={item.icon} size={20} color={currentTheme.colors.text} />
            </View>
            <View style={styles.sectionInfo}>
              <Text style={[styles.sectionTitle, { color: currentTheme.colors.text }]}>
                {item.title}
              </Text>
              <Text style={[styles.sectionSubtitle, { color: currentTheme.colors.textSecondary }]}>
                {item.subtitle}
              </Text>
            </View>
          </TouchableOpacity>
          <Switch
            value={item.visible}
            onValueChange={() => {
              const updatedSections = sections.map(section => 
                section.id === item.id 
                  ? { ...section, visible: !section.visible }
                  : section
              );
              setSections(updatedSections);
              saveSectionPreferences(updatedSections);
            }}
            trackColor={{ false: currentTheme.colors.border, true: '#02A9FF' }}
            thumbColor={item.visible ? '#fff' : '#f4f3f4'}
          />
        </View>
      </ScaleDecorator>
    );
  }, [currentTheme, sections]);

  // Handle drag end for both the modal and the main list
  const handleDragEnd = useCallback(({ data }: { data: Section[] }) => {
    console.log('[Sections] Reordering sections...');
    
    // Create new objects for all sections to avoid Reanimated shared object issues
    // and assign new order based on position in array
    const updatedData = data.map((section, index) => ({
      ...section,
      order: index
    }));

    // Get the news section from current sections to preserve its state
    const newsSection = sections.find(section => section.id === 'news');
    
    // Combine the reordered sections with news section at the end
    const allSections = newsSection 
      ? [...updatedData, { ...newsSection, order: updatedData.length }]
      : updatedData;

    // Update state first to maintain the visual order
    setSections(allSections);
    
    // Then save the preferences with the new order
    saveSectionPreferences(allSections, false);
  }, [sections]);

  // Add header with back button
  const Header = () => (
    <View style={[styles.header, { 
      backgroundColor: currentTheme.colors.background,
      borderBottomColor: currentTheme.colors.border 
    }]}>
      <TouchableOpacity onPress={handleBack} style={styles.backButton}>
        <FontAwesome5 name="arrow-left" size={20} color={currentTheme.colors.text} />
      </TouchableOpacity>
      <Text style={[styles.headerTitle, { color: currentTheme.colors.text }]}>Home Sections</Text>
    </View>
  );

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: currentTheme.colors.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={currentTheme.colors.primary} />
          <Text style={[styles.loadingText, { color: currentTheme.colors.text }]}>
            Loading sections...
          </Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, { backgroundColor: currentTheme.colors.background }]}>
        <View style={styles.errorContainer}>
          <Text style={[styles.errorText, { color: currentTheme.colors.error }]}>
            {error}
          </Text>
          <TouchableOpacity 
            style={[styles.retryButton, { backgroundColor: currentTheme.colors.primary }]}
            onPress={loadSectionPreferences}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const draggableSections = sections.filter(section => section.id !== 'news');
  const newsSection = sections.find(section => section.id === 'news');

  // Welcome section component
  const WelcomeSectionSettings = () => {
    const [showDropdown, setShowDropdown] = useState(false);
    
    return (
      <View style={[
        styles.welcomeSectionContainer,
        { 
          backgroundColor: currentTheme.colors.surface,
          borderBottomColor: currentTheme.colors.border,
        }
      ]}>
        <View style={styles.welcomeHeaderContainer}>
          <View style={styles.welcomeIconContainer}>
            <FontAwesome5 name="home" size={20} color="#02A9FF" />
          </View>
          <View>
            <Text style={[styles.welcomeSectionTitle, { color: currentTheme.colors.text }]}>
              Welcome Section
            </Text>
            <Text style={[styles.welcomeSectionSubtitle, { color: currentTheme.colors.textSecondary }]}>
              Configure your home page greeting
            </Text>
          </View>
        </View>

        <View style={styles.welcomeOptionsContainer}>
          <Text style={[styles.welcomeOptionsLabel, { color: currentTheme.colors.text }]}>
            Greeting Style:
          </Text>
          
          <View style={styles.dropdownContainer}>
            <TouchableOpacity 
              style={[
                styles.dropdownButton,
                { backgroundColor: currentTheme.colors.background, borderColor: currentTheme.colors.border }
              ]}
              onPress={() => setShowDropdown(!showDropdown)}
              activeOpacity={0.7}
            >
              <View style={styles.selectedOption}>
                <FontAwesome5 
                  name={welcomePreferences.type === WelcomeSectionType.BASIC ? "comment-alt" : "trophy"} 
                  size={16} 
                  color={currentTheme.colors.primary} 
                  solid
                  style={styles.dropdownIcon}
                />
                <Text style={[styles.dropdownText, { color: currentTheme.colors.text }]}>
                  {welcomePreferences.type === WelcomeSectionType.BASIC ? "Basic Greeting" : "Achievement Progress"}
                </Text>
              </View>
              <FontAwesome5 
                name={showDropdown ? "chevron-up" : "chevron-down"} 
                size={14} 
                color={currentTheme.colors.textSecondary} 
              />
            </TouchableOpacity>
            
            {showDropdown && (
              <View style={[
                styles.dropdown, 
                { 
                  backgroundColor: currentTheme.colors.background,
                  borderColor: currentTheme.colors.border,
                  ...Platform.select({
                    ios: {
                      shadowColor: currentTheme.colors.text,
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.1,
                      shadowRadius: 4,
                    },
                    android: {
                      elevation: 4,
                    },
                  }) 
                }
              ]}>
                <TouchableOpacity 
                  style={[
                    styles.dropdownItem,
                    welcomePreferences.type === WelcomeSectionType.BASIC && { backgroundColor: currentTheme.colors.primary + '20' },
                    { borderBottomColor: currentTheme.colors.border }
                  ]}
                  onPress={() => {
                    const updatedPrefs = {
                      ...welcomePreferences,
                      type: WelcomeSectionType.BASIC
                    };
                    setWelcomePreferences(updatedPrefs);
                    saveWelcomePreferences(updatedPrefs);
                    setShowDropdown(false);
                  }}
                  activeOpacity={0.7}
                >
                  <FontAwesome5 
                    name="comment-alt" 
                    size={16} 
                    color={welcomePreferences.type === WelcomeSectionType.BASIC 
                      ? "#02A9FF" 
                      : currentTheme.colors.textSecondary} 
                    solid={welcomePreferences.type === WelcomeSectionType.BASIC}
                    style={styles.dropdownIcon}
                  />
                  <Text style={[
                    styles.dropdownItemText, 
                    { 
                      color: welcomePreferences.type === WelcomeSectionType.BASIC 
                        ? "#02A9FF" 
                        : currentTheme.colors.text 
                    }
                  ]}>
                    Basic Greeting
                  </Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[
                    styles.dropdownItem,
                    welcomePreferences.type === WelcomeSectionType.ACHIEVEMENT && { backgroundColor: currentTheme.colors.primary + '20' },
                    { borderBottomWidth: 0 }
                  ]}
                  onPress={() => {
                    const updatedPrefs = {
                      ...welcomePreferences,
                      type: WelcomeSectionType.ACHIEVEMENT
                    };
                    setWelcomePreferences(updatedPrefs);
                    saveWelcomePreferences(updatedPrefs);
                    setShowDropdown(false);
                  }}
                  activeOpacity={0.7}
                >
                  <FontAwesome5 
                    name="trophy" 
                    size={16} 
                    color={welcomePreferences.type === WelcomeSectionType.ACHIEVEMENT 
                      ? "#02A9FF" 
                      : currentTheme.colors.textSecondary} 
                    solid={welcomePreferences.type === WelcomeSectionType.ACHIEVEMENT}
                    style={styles.dropdownIcon}
                  />
                  <Text style={[
                    styles.dropdownItemText, 
                    { 
                      color: welcomePreferences.type === WelcomeSectionType.ACHIEVEMENT 
                        ? "#02A9FF" 
                        : currentTheme.colors.text 
                    }
                  ]}>
                    Achievement Progress (Coming Soon)
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
          
          <View style={styles.welcomeDescriptionContainer}>
            <Text style={[styles.welcomeDescription, { color: currentTheme.colors.textSecondary }]}>
              {welcomePreferences.type === WelcomeSectionType.BASIC
                ? "Shows basic greeting based on time of day with simple stats."
                : "Achievement feature coming soon! Stay tuned for badges and personalized goals."}
            </Text>
          </View>
        </View>

        <View style={styles.welcomeInfoContainer}>
          <View style={styles.welcomeInfoItem}>
            <View style={[styles.welcomeNoteDot, { backgroundColor: "#02A9FF" }]} />
            <Text style={[styles.welcomeNote, { color: currentTheme.colors.textSecondary }]}>
              The welcome section is always shown and cannot be hidden
            </Text>
          </View>
          <View style={styles.welcomeInfoItem}>
            <View style={[styles.welcomeNoteDot, { backgroundColor: "#02A9FF" }]} />
            <Text style={[styles.welcomeNote, { color: currentTheme.colors.textSecondary }]}>
              This section appears at the top of your home screen
            </Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: currentTheme.colors.background }]}>
      <Header />

      <ScrollView
        style={styles.scrollContainer}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={true}
        nestedScrollEnabled={true}
        scrollEventThrottle={16}
        bounces={true}
        overScrollMode="always"
      >
        <Text style={[styles.instructions, { color: currentTheme.colors.textSecondary }]}>
          Tap and drag sections with grip lines to reorder them. Use the switches to show/hide sections.
        </Text>

        {/* Welcome Section Settings - Not draggable */}
        <WelcomeSectionSettings />

        {/* Section Header */}
        <View style={[styles.sectionHeader, { borderBottomColor: currentTheme.colors.border }]}>
          <Text style={[styles.sectionHeaderText, { color: currentTheme.colors.text }]}>
            Content Sections
          </Text>
          <Text style={[styles.sectionHeaderSubtitle, { color: currentTheme.colors.textSecondary }]}>
            Toggle visibility and set order
          </Text>
        </View>

        {/* Draggable Sections - Only the middle sections */}
        {sections.filter(section => section.id !== 'news').length > 0 && (
          <DraggableFlatList
            data={sections.filter(section => section.id !== 'news')}
            onDragEnd={handleDragEnd}
            keyExtractor={(item) => item.id}
            renderItem={renderDraggableItem}
            dragItemOverflow={true}
            scrollEnabled={false} // Let the parent ScrollView handle scrolling
            activationDistance={20}
            contentContainerStyle={styles.draggableContainer}
          />
        )}

        {/* News Section - Not draggable */}
        {newsSection && (
          <View style={[
            styles.sectionItem, 
            { 
              backgroundColor: currentTheme.colors.surface,
              borderBottomColor: currentTheme.colors.border,
              borderTopColor: currentTheme.colors.border,
              borderTopWidth: 1,
            }
          ]}>
            <View style={styles.sectionContent}>
              <View style={[styles.dragHandle, { opacity: 0 }]} />
              <View style={styles.sectionIcon}>
                <FontAwesome5 name={newsSection.icon} size={20} color={currentTheme.colors.text} />
              </View>
              <View style={styles.sectionInfo}>
                <Text style={[styles.sectionTitle, { color: currentTheme.colors.text }]}>
                  {newsSection.title}
                </Text>
                <Text style={[styles.sectionSubtitle, { color: currentTheme.colors.textSecondary }]}>
                  {newsSection.subtitle}
                </Text>
              </View>
            </View>
            <Switch
              value={newsSection.visible}
              onValueChange={() => {
                const updatedSections = sections.map(section => 
                  section.id === newsSection.id 
                    ? { ...section, visible: !section.visible }
                    : section
                );
                setSections(updatedSections);
                saveSectionPreferences(updatedSections);
              }}
              trackColor={{ false: currentTheme.colors.border, true: '#02A9FF' }}
              thumbColor={newsSection.visible ? '#fff' : '#f4f3f4'}
            />
          </View>
        )}

        {/* Extra padding at the bottom */}
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
  instructions: {
    fontSize: 14,
    padding: 16,
    fontStyle: 'italic',
  },
  sectionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
  },
  sectionContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
  },
  dragHandle: {
    width: 20,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  sectionIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionInfo: {
    flex: 1,
    marginLeft: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  welcomeSectionContainer: {
    padding: 16,
    borderBottomWidth: 1,
    marginBottom: 8,
  },
  welcomeHeaderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  welcomeIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  welcomeSectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  welcomeSectionSubtitle: {
    fontSize: 14,
  },
  welcomeOptionsContainer: {
    marginBottom: 16,
  },
  welcomeOptionsLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  dropdownContainer: {
    position: 'relative',
    zIndex: 1,
    marginBottom: 16,
  },
  dropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
  },
  selectedOption: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  dropdownIcon: {
    marginRight: 8,
  },
  dropdownText: {
    fontSize: 14,
    fontWeight: '600',
  },
  dropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    marginTop: 4,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    zIndex: 10,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
  },
  dropdownItemText: {
    fontSize: 14,
    fontWeight: '500',
  },
  welcomeDescriptionContainer: {
    marginBottom: 16,
  },
  welcomeDescription: {
    fontSize: 14,
  },
  welcomeInfoContainer: {
    marginTop: 16,
  },
  welcomeInfoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  welcomeNoteDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#02A9FF',
    marginRight: 8,
  },
  welcomeNote: {
    fontSize: 14,
    fontStyle: 'italic',
  },
  scrollContent: {
    padding: 16,
  },
  draggableContainer: {
    marginBottom: 16,
  },
  sectionHeader: {
    padding: 16,
    borderBottomWidth: 1,
    marginBottom: 8,
  },
  sectionHeaderText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  sectionHeaderSubtitle: {
    fontSize: 14,
  },
  scrollContainer: {
    flex: 1,
  },
}); 