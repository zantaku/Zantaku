import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform, TextInput, DeviceEventEmitter, BackHandler, Image, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { FontAwesome5 } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';
import { useEffect, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useDiscordAuth } from '../../hooks/useDiscordAuth';
import { STORAGE_KEY } from '../../constants/auth';
import * as SecureStore from 'expo-secure-store';
import { rateLimitedAxios } from '../../utils/api';
import { Switch as PaperSwitch } from 'react-native-paper';
import { Menu } from 'react-native-paper';
import SuccessToast from '../../components/SuccessToast';
import { useDiscordRPCContext } from '../../contexts/DiscordRPCContext';

interface UserSettings {
  // Account Settings
  titleLanguage: string;
  displayAdultContent: boolean;
  airingNotifications: boolean;
  profileColor: string;
  timezone: string;
  activityMergeTime: number;
  staffNameLanguage: string;
  restrictMessagesToFollowing: boolean;
  // Media Settings
  scoreFormat: string;
  scoreRaw: boolean;
  scoreOutOf: number;
  scoreOutOfRaw: number;
  rowOrder: string;
  animeList: boolean;
  mangaList: boolean;
  advancedScoringEnabled: boolean;
  advancedScoring: string[];
  // Additional settings
  notificationSettings: any;
  disabledActivities: any;
  animeCustomLists: string[];
  mangaCustomLists: string[];
}

export default function AccountScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { isDarkMode, currentTheme } = useTheme();
  const { user } = useAuth();
  const { 
    user: discordUser, 
    loading: discordLoading, 
    error: discordError,
    signInWithDiscord, 
    signOutDiscord, 
    loadStoredDiscordUser,
    checkCurrentSession,
    refreshDiscordUser 
  } = useDiscordAuth();
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [scoreMenuVisible, setScoreMenuVisible] = useState(false);
  const [newAnimeList, setNewAnimeList] = useState('');
  const [newMangaList, setNewMangaList] = useState('');
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  
  // Discord RPC integration
  const { 
    connected: rpcConnected
  } = useDiscordRPCContext();

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

  // Load stored Discord user on mount and when component focuses
  useEffect(() => {
    loadStoredDiscordUser();
  }, []);

  // Check for Discord user on mount only
  useEffect(() => {
    if (!discordUser) {
      console.log('🔄 Component mounted, checking for Discord user...');
      refreshDiscordUser();
    }
  }, []); // Empty dependency array - only run on mount

  // Handle Discord auth success/error from URL params
  useEffect(() => {
    if (params.discord_success === 'true') {
      setSuccessMessage('Discord account connected successfully!');
      setShowSuccessToast(true);
      // Refresh Discord user data after successful connection
      setTimeout(() => {
        refreshDiscordUser();
      }, 1000);
    } else if (params.error) {
      let errorMessage = 'Failed to connect Discord account';
      switch (params.error) {
        case 'discord_auth_failed':
          errorMessage = 'Discord authentication failed';
          break;
        case 'no_session':
          errorMessage = 'No authentication session found';
          break;
        case 'callback_failed':
          errorMessage = 'Failed to process Discord login';
          break;
        case 'invalid_provider':
          errorMessage = 'Invalid authentication provider';
          break;
        default:
          errorMessage = 'An unknown error occurred';
      }
      Alert.alert('Error', errorMessage);
    }
  }, [params, refreshDiscordUser]);

  // RPC connection is now handled globally by DiscordRPCProvider

  const handleDiscordLogin = async () => {
    try {
      console.log('Starting Discord login from account settings...');
      const success = await signInWithDiscord();
      console.log('Discord login result:', success);
      
      if (!success && discordError) {
        console.error('Discord login failed with error:', discordError);
        Alert.alert('Error', discordError);
      }
    } catch (error) {
      console.error('Discord login error:', error);
      Alert.alert('Error', 'Failed to initiate Discord login');
    }
  };

  const handleDiscordLogout = async () => {
    try {
      const success = await signOutDiscord();
      if (success) {
        setSuccessMessage('Discord account disconnected successfully!');
        setShowSuccessToast(true);
      }
    } catch (error) {
      console.error('Discord logout error:', error);
      Alert.alert('Error', 'Failed to disconnect Discord account');
    }
  };

  const handleDebugSession = async () => {
    console.log('🔧 Manual session check triggered...');
    await checkCurrentSession();
  };

  const updateSettings = async (newSettings: Partial<UserSettings>) => {
    try {
      setSaving(true);
      const token = await SecureStore.getItemAsync(STORAGE_KEY.AUTH_TOKEN);
      if (!token) return;

      // If media list options were changed
      if (newSettings.scoreFormat || newSettings.rowOrder || 
          newSettings.animeList !== undefined || newSettings.mangaList !== undefined ||
          newSettings.advancedScoringEnabled !== undefined) {
        
        const mediaListMutation = `
          mutation ($mediaListOptions: MediaListOptionsInput) {
            UpdateUser(mediaListOptions: $mediaListOptions) {
              id
              mediaListOptions {
                scoreFormat
              }
            }
          }
        `;

        const mediaListVariables = {
          mediaListOptions: {
            scoreFormat: newSettings.scoreFormat
          }
        };

        console.log('Sending update mutation with variables:', JSON.stringify(mediaListVariables, null, 2));
        const response = await rateLimitedAxios(mediaListMutation, mediaListVariables, token);
        
        if (!response?.data?.UpdateUser?.mediaListOptions?.scoreFormat) {
          console.error('Update failed. Full response:', JSON.stringify(response, null, 2));
          if (response?.data?.errors) {
            console.error('GraphQL Errors:', JSON.stringify(response.data.errors, null, 2));
          }
          throw new Error('Failed to update score format');
        }

        // Verify the change by fetching current settings
        const verifyQuery = `{
          Viewer {
            mediaListOptions {
              scoreFormat
            }
          }
        }`;

        console.log('Verifying update...');
        const verifyResponse = await rateLimitedAxios(verifyQuery, {}, token);
        console.log('Current settings after update:', JSON.stringify(verifyResponse?.data?.Viewer?.mediaListOptions, null, 2));

        // Update local state only after successful API update
        setSettings(prev => {
          if (!prev || !response?.data?.UpdateUser?.mediaListOptions?.scoreFormat) return prev;
          return {
            ...prev,
            scoreFormat: response.data.UpdateUser.mediaListOptions.scoreFormat
          };
        });
      } else {
        // Handle other settings updates
        const mutation = `
          mutation($titleLanguage: UserTitleLanguage, $staffNameLanguage: UserStaffNameLanguage) {
            UpdateUser(titleLanguage: $titleLanguage, staffNameLanguage: $staffNameLanguage) {
              id
              options {
                titleLanguage
                staffNameLanguage
              }
            }
          }
        `;

        const variables = {
          titleLanguage: newSettings.titleLanguage,
          staffNameLanguage: newSettings.staffNameLanguage
        };

        console.log('Sending settings update:', JSON.stringify(variables, null, 2));
        const response = await rateLimitedAxios(mutation, variables, token);
        
        if (!response?.data?.UpdateUser?.options) {
          console.error('Update failed. Full response:', JSON.stringify(response, null, 2));
          if (response?.data?.errors) {
            console.error('GraphQL Errors:', JSON.stringify(response.data.errors, null, 2));
          }
          throw new Error('Failed to update user settings');
        }

        // Update local state only after successful API update
        setSettings(prev => {
          if (!prev || !response?.data?.UpdateUser?.options) return prev;
          return {
            ...prev,
            titleLanguage: response.data.UpdateUser.options.titleLanguage,
            staffNameLanguage: response.data.UpdateUser.options.staffNameLanguage
          };
        });
      }

      // Update local state
      setSettings(prev => prev ? { ...prev, ...newSettings } : null);
    } catch (error) {
      console.error('Error updating settings:', error);
    } finally {
      setSaving(false);
    }
  };

  const updateCustomLists = async (type: 'anime' | 'manga', lists: string[]) => {
    try {
      setSaving(true);
      const token = await SecureStore.getItemAsync(STORAGE_KEY.AUTH_TOKEN);
      if (!token) return;

      const mutation = `
        mutation($animeList: MediaListTypeOptions, $mangaList: MediaListTypeOptions) {
          UpdateUser(mediaListOptions: {
            animeList: $animeList,
            mangaList: $mangaList
          }) {
            id
            mediaListOptions {
              animeList {
                customLists
              }
              mangaList {
                customLists
              }
            }
          }
        }
      `;

      const variables = {
        animeList: type === 'anime' ? { customLists: lists } : undefined,
        mangaList: type === 'manga' ? { customLists: lists } : undefined,
      };

      await rateLimitedAxios(mutation, variables, token);
      
      setSettings(prev => prev ? {
        ...prev,
        [type === 'anime' ? 'animeCustomLists' : 'mangaCustomLists']: lists
      } : null);
    } catch (error) {
      console.error('Error updating custom lists:', error);
    } finally {
      setSaving(false);
    }
  };

  // Add header with back button
  const Header = () => (
    <View style={[styles.header, { 
      backgroundColor: currentTheme.colors.background,
      borderBottomColor: currentTheme.colors.border 
    }]}>
      <TouchableOpacity 
        onPress={handleBack}
        style={styles.backButton}
      >
        <FontAwesome5 name="arrow-left" size={20} color={currentTheme.colors.text} />
      </TouchableOpacity>
      <Text style={[styles.headerTitle, { color: currentTheme.colors.text }]}>Account Settings</Text>
    </View>
  );

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const token = await SecureStore.getItemAsync(STORAGE_KEY.AUTH_TOKEN);
        if (!token) {
          console.error('No auth token found');
          return;
        }

        const query = `{
  Viewer {
    options {
      titleLanguage
      displayAdultContent
      airingNotifications
      profileColor
      notificationOptions {
        type
        enabled
      }
      timezone
      activityMergeTime
      staffNameLanguage
      restrictMessagesToFollowing
      disabledListActivity {
        disabled
        type
      }
    }
    mediaListOptions {
      scoreFormat
      rowOrder
      animeList {
        sectionOrder
        splitCompletedSectionByFormat
        customLists
        advancedScoring
        advancedScoringEnabled
      }
      mangaList {
        sectionOrder
        splitCompletedSectionByFormat
        customLists
        advancedScoring
        advancedScoringEnabled
      }
    }
  }
}`;

        const response = await rateLimitedAxios(query, {}, token);
        console.log('API Response:', JSON.stringify(response, null, 2));
        console.log('Response structure check:', {
          hasData: !!response?.data,
          hasViewer: !!response?.data?.Viewer,
          viewerKeys: response?.data?.Viewer ? Object.keys(response.data.Viewer) : [],
        });

        if (!response?.data?.Viewer) {
          console.error('Failed to get viewer data:', {
            responseKeys: Object.keys(response || {}),
            dataKeys: Object.keys(response?.data || {}),
          });
          setLoading(false);
          return;
        }

        const viewer = response.data.Viewer;
        const notificationSettings = viewer.options.notificationOptions?.reduce((acc: any, opt: any) => {
          acc[opt.type] = opt.enabled;
          return acc;
        }, {});

        const disabledActivities = viewer.options.disabledListActivity?.reduce((acc: any, opt: any) => {
          acc[opt.type] = opt.disabled;
          return acc;
        }, {});

        setSettings({
          // Account Settings
          titleLanguage: viewer.options.titleLanguage,
          displayAdultContent: viewer.options.displayAdultContent,
          airingNotifications: viewer.options.airingNotifications,
          profileColor: viewer.options.profileColor,
          timezone: viewer.options.timezone,
          activityMergeTime: viewer.options.activityMergeTime,
          staffNameLanguage: viewer.options.staffNameLanguage,
          restrictMessagesToFollowing: viewer.options.restrictMessagesToFollowing,
          // Media Settings
          scoreFormat: viewer.mediaListOptions.scoreFormat,
          scoreRaw: viewer.mediaListOptions.scoreRaw,
          scoreOutOf: viewer.mediaListOptions.scoreOutOf,
          scoreOutOfRaw: viewer.mediaListOptions.scoreOutOfRaw,
          rowOrder: viewer.mediaListOptions.rowOrder,
          animeList: viewer.mediaListOptions.animeList?.splitCompletedSectionByFormat ?? true,
          mangaList: viewer.mediaListOptions.mangaList?.splitCompletedSectionByFormat ?? true,
          advancedScoringEnabled: viewer.mediaListOptions.animeList?.advancedScoringEnabled || 
                                viewer.mediaListOptions.mangaList?.advancedScoringEnabled || false,
          advancedScoring: viewer.mediaListOptions.animeList?.advancedScoring || 
                          viewer.mediaListOptions.mangaList?.advancedScoring || [],
          // Additional settings
          notificationSettings,
          disabledActivities,
          animeCustomLists: viewer.mediaListOptions.animeList?.customLists || [],
          mangaCustomLists: viewer.mediaListOptions.mangaList?.customLists || [],
        });
      } catch (error) {
        console.error('Error fetching settings:', error);
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      fetchSettings();
    }
  }, [user]);

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: currentTheme.colors.background }]}>
        <Header />
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: currentTheme.colors.textSecondary }]}>Loading settings...</Text>
        </View>
      </View>
    );
  }

  if (!settings) {
    return (
      <View style={[styles.container, { backgroundColor: currentTheme.colors.background }]}>
        <Header />
        <View style={styles.errorContainer}>
          <Text style={[styles.errorText, { color: currentTheme.colors.error }]}>Failed to load settings</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: currentTheme.colors.background }]}>
      <Header />

      <ScrollView style={styles.content}>  
        {/* Account Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: currentTheme.colors.text }]}>Account</Text>
          <View style={[styles.settingsContainer, { backgroundColor: currentTheme.colors.surface }]}>
            <View style={styles.settingItem}>
              <View style={styles.switchContainer}>
                <Text style={[styles.settingLabel, { color: currentTheme.colors.text }]}>Title Language</Text>
                <Text style={[styles.settingDescription, { color: currentTheme.colors.textSecondary }]}>
                  Choose how titles are displayed
                </Text>
              </View>
              <TouchableOpacity 
                onPress={() => updateSettings({ 
                  titleLanguage: settings.titleLanguage === 'ROMAJI' ? 'ENGLISH' : 
                                settings.titleLanguage === 'ENGLISH' ? 'NATIVE' : 'ROMAJI' 
                })}
              >
                <Text style={[styles.settingValue, { color: currentTheme.colors.primary }]}>
                  {settings.titleLanguage === 'ROMAJI' ? 'Romaji' : 
                   settings.titleLanguage === 'ENGLISH' ? 'English' : 'Native'}
                </Text>
              </TouchableOpacity>
            </View>
            
            <View style={styles.settingItem}>
              <View style={styles.switchContainer}>
                <View style={styles.switchRow}>
                  <Text style={[styles.settingLabel, { color: currentTheme.colors.text }]}>Adult Content</Text>
                  <PaperSwitch 
                    value={settings.displayAdultContent} 
                    onValueChange={(value) => updateSettings({ displayAdultContent: value })}
                  />
                </View>
                <Text style={[styles.settingDescription, { color: currentTheme.colors.textSecondary }]}>
                  Show 18+ content in your feed
                </Text>
              </View>
            </View>

        

            <View style={styles.settingItem}>
              <View style={styles.switchContainer}>
                <Text style={[styles.settingLabel, { color: currentTheme.colors.text }]}>Profile Color</Text>
                <Text style={[styles.settingDescription, { color: currentTheme.colors.textSecondary }]}>
                  Your profile highlight color
                </Text>
              </View>
              <View style={[styles.colorPreview, { backgroundColor: settings.profileColor }]} />
            </View>

            <View style={styles.settingItem}>
              <View style={styles.switchContainer}>
                <Text style={[styles.settingLabel, { color: currentTheme.colors.text }]}>Staff Names</Text>
                <Text style={[styles.settingDescription, { color: currentTheme.colors.textSecondary }]}>
                  How staff and character names appear
                </Text>
              </View>
              <TouchableOpacity 
                onPress={() => updateSettings({ 
                  staffNameLanguage: settings.staffNameLanguage === 'ROMAJI' ? 'NATIVE' : 'ROMAJI'
                })}
              >
                <Text style={[styles.settingValue, { color: currentTheme.colors.primary }]}>
                  {settings.staffNameLanguage === 'ROMAJI' ? 'Romaji' : 'Native'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Anime & Manga Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: currentTheme.colors.text }]}>Anime & Manga</Text>
          <View style={[styles.settingsContainer, { backgroundColor: currentTheme.colors.surface }]}>
            <TouchableOpacity 
              style={styles.settingItem}
              onPress={() => setScoreMenuVisible(true)}
              activeOpacity={0.7}
            >
              <View style={styles.switchContainer}>
                <Text style={[styles.settingLabel, { color: currentTheme.colors.text }]}>Scoring System</Text>
                <Text style={[styles.settingDescription, { color: currentTheme.colors.textSecondary }]}>
                  How you rate anime and manga
                </Text>
              </View>
              <Menu
                visible={scoreMenuVisible}
                onDismiss={() => setScoreMenuVisible(false)}
                anchor={
                  <View style={styles.menuAnchor}>
                    <Text style={[styles.settingValue, { color: currentTheme.colors.primary }]}>
                      {settings.scoreFormat === 'POINT_10_DECIMAL' ? '10 Point Decimal' :
                       settings.scoreFormat === 'POINT_100' ? '100 Point' :
                       settings.scoreFormat === 'POINT_10' ? '10 Point' :
                       settings.scoreFormat === 'POINT_5' ? '5 Point' :
                       settings.scoreFormat === 'POINT_3' ? '3 Point' : '10 Point Decimal'}
                    </Text>
                  </View>
                }
                contentStyle={{
                  backgroundColor: currentTheme.colors.surface,
                  borderRadius: 8,
                  marginTop: 8
                }}
                style={{
                  marginTop: Platform.OS === 'android' ? -30 : 0
                }}
              >
                <Menu.Item 
                  onPress={() => {
                    updateSettings({ scoreFormat: "POINT_10_DECIMAL" });
                    setScoreMenuVisible(false);
                  }} 
                  title="10 Point Decimal (5.5/10)"
                  titleStyle={{ color: currentTheme.colors.text }}
                />
                <Menu.Item 
                  onPress={() => {
                    updateSettings({ scoreFormat: "POINT_100" });
                    setScoreMenuVisible(false);
                  }} 
                  title="100 Point (55/100)"
                  titleStyle={{ color: currentTheme.colors.text }}
                />
                <Menu.Item 
                  onPress={() => {
                    updateSettings({ scoreFormat: "POINT_10" });
                    setScoreMenuVisible(false);
                  }} 
                  title="10 Point (5/10)"
                  titleStyle={{ color: currentTheme.colors.text }}
                />
                <Menu.Item 
                  onPress={() => {
                    updateSettings({ scoreFormat: "POINT_5" });
                    setScoreMenuVisible(false);
                  }} 
                  title="5 Star (3/5)"
                  titleStyle={{ color: currentTheme.colors.text }}
                />
                <Menu.Item 
                  onPress={() => {
                    updateSettings({ scoreFormat: "POINT_3" });
                    setScoreMenuVisible(false);
                  }} 
                  title="3 Point Smiley :)"
                  titleStyle={{ color: currentTheme.colors.text }}
                />
              </Menu>
            </TouchableOpacity>
          </View>
        </View>

        {/* Lists Section */}
        <View style={[styles.section, { marginBottom: 32 }]}>
          <Text style={[styles.sectionTitle, { color: currentTheme.colors.text }]}>Lists</Text>
          <View style={[styles.settingsContainer, { backgroundColor: currentTheme.colors.surface }]}>
            <View style={styles.settingItem}>
              <View style={styles.switchContainer}>
                <View style={styles.switchRow}>
                  <Text style={[styles.settingLabel, { color: currentTheme.colors.text }]}>Split Anime Lists</Text>
                  <PaperSwitch 
                    value={settings.animeList} 
                    onValueChange={(value) => updateSettings({ animeList: value })}
                  />
                </View>
                <Text style={[styles.settingDescription, { color: currentTheme.colors.textSecondary }]}>
                  Separate completed anime by format
                </Text>
              </View>
            </View>

            <View style={styles.settingItem}>
              <View style={styles.switchContainer}>
                <View style={styles.switchRow}>
                  <Text style={[styles.settingLabel, { color: currentTheme.colors.text }]}>Split Manga Lists</Text>
                  <PaperSwitch 
                    value={settings.mangaList} 
                    onValueChange={(value) => updateSettings({ mangaList: value })}
                  />
                </View>
                <Text style={[styles.settingDescription, { color: currentTheme.colors.textSecondary }]}>
                  Separate completed manga by format
                </Text>
              </View>
            </View>

            <View style={styles.settingItem}>
              <View style={styles.switchContainer}>
                <Text style={[styles.settingLabel, { color: currentTheme.colors.text }]}>Custom Anime Lists</Text>
                <Text style={[styles.settingDescription, { color: currentTheme.colors.textSecondary }]}>
                  Create and manage custom anime lists
                </Text>
                <View style={styles.customListContainer}>
                  {settings.animeCustomLists.map((list, index) => (
                    <View key={index} style={styles.customListItem}>
                      <Text style={[styles.customListText, { color: currentTheme.colors.text }]}>{list}</Text>
                      <TouchableOpacity 
                        onPress={() => {
                          const newLists = settings.animeCustomLists.filter((_, i) => i !== index);
                          updateCustomLists('anime', newLists);
                        }}
                        style={styles.removeButton}
                      >
                        <FontAwesome5 name="times" size={16} color={currentTheme.colors.error} />
                      </TouchableOpacity>
                    </View>
                  ))}
                  <View style={styles.addListContainer}>
                    <TextInput
                      style={[styles.addListInput, { 
                        color: currentTheme.colors.text,
                        borderColor: currentTheme.colors.border,
                        backgroundColor: currentTheme.colors.surface
                      }]}
                      value={newAnimeList}
                      onChangeText={setNewAnimeList}
                      placeholder="New list name..."
                      placeholderTextColor={currentTheme.colors.textSecondary}
                    />
                    <TouchableOpacity 
                      style={[styles.addButton, { backgroundColor: currentTheme.colors.primary }]}
                      onPress={() => {
                        if (newAnimeList.trim()) {
                          updateCustomLists('anime', [...settings.animeCustomLists, newAnimeList.trim()]);
                          setNewAnimeList('');
                        }
                      }}
                    >
                      <Text style={[styles.addButtonText, { color: '#FFFFFF' }]}>Add</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </View>

            <View style={[styles.settingItem, { borderBottomWidth: 0 }]}>
              <View style={styles.switchContainer}>
                <Text style={[styles.settingLabel, { color: currentTheme.colors.text }]}>Custom Manga Lists</Text>
                <Text style={[styles.settingDescription, { color: currentTheme.colors.textSecondary }]}>
                  Create and manage custom manga lists
                </Text>
                <View style={styles.customListContainer}>
                  {settings.mangaCustomLists.map((list, index) => (
                    <View key={index} style={styles.customListItem}>
                      <Text style={[styles.customListText, { color: currentTheme.colors.text }]}>{list}</Text>
                      <TouchableOpacity 
                        onPress={() => {
                          const newLists = settings.mangaCustomLists.filter((_, i) => i !== index);
                          updateCustomLists('manga', newLists);
                        }}
                        style={styles.removeButton}
                      >
                        <FontAwesome5 name="times" size={16} color={currentTheme.colors.error} />
                      </TouchableOpacity>
                    </View>
                  ))}
                  <View style={styles.addListContainer}>
                    <TextInput
                      style={[styles.addListInput, { 
                        color: currentTheme.colors.text,
                        borderColor: currentTheme.colors.border,
                        backgroundColor: currentTheme.colors.surface
                      }]}
                      value={newMangaList}
                      onChangeText={setNewMangaList}
                      placeholder="New list name..."
                      placeholderTextColor={currentTheme.colors.textSecondary}
                    />
                    <TouchableOpacity 
                      style={[styles.addButton, { backgroundColor: currentTheme.colors.primary }]}
                      onPress={() => {
                        if (newMangaList.trim()) {
                          updateCustomLists('manga', [...settings.mangaCustomLists, newMangaList.trim()]);
                          setNewMangaList('');
                        }
                      }}
                    >
                      <Text style={[styles.addButtonText, { color: '#FFFFFF' }]}>Add</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
      
      {/* Success Toast */}
      {showSuccessToast && (
        <SuccessToast 
          message={successMessage}
          onDismiss={() => setShowSuccessToast(false)}
        />
      )}
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
    paddingTop: Platform.OS === 'ios' ? 60 : 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 8,
    marginRight: 16,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
  },
  content: {
    flex: 1,
  },
  section: {
    marginTop: 32,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 16,
    paddingHorizontal: 20,
    opacity: 0.9,
  },
  settingsContainer: {
    paddingHorizontal: 20,
    backgroundColor: Platform.OS === 'ios' ? 'rgba(150, 150, 150, 0.05)' : undefined,
    borderRadius: 16,
    marginHorizontal: 16,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(150, 150, 150, 0.2)',
  },
  settingLabel: {
    fontSize: 17,
    flex: 1,
    marginRight: 16,
    fontWeight: '500',
  },
  settingValue: {
    fontSize: 17,
    fontWeight: '500',
    opacity: 0.8,
  },
  settingDescription: {
    fontSize: 14,
    opacity: 0.6,
    marginTop: 4,
  },
  colorPreview: {
    width: 28,
    height: 28,
    borderRadius: 14,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    fontSize: 17,
    fontWeight: '500',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorText: {
    fontSize: 17,
    fontWeight: '500',
    textAlign: 'center',
  },
  switchContainer: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    flex: 1,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },
  customListContainer: {
    width: '100%',
    marginTop: 8,
  },
  customListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(150, 150, 150, 0.1)',
    borderRadius: 8,
    marginBottom: 8,
  },
  customListText: {
    fontSize: 16,
    flex: 1,
  },
  removeButton: {
    padding: 4,
  },
  addListContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  addListInput: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 16,
  },
  addButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: '500',
  },
  menuAnchor: {
    padding: 4,
  },
  discordButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    gap: 12,
  },
  discordButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  discordUserContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  discordUserInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  discordAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  discordAvatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  discordUserDetails: {
    flex: 1,
  },
  discordUsername: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  discordDiscriminator: {
    fontSize: 14,
    fontWeight: '400',
  },
  discordConnected: {
    fontSize: 14,
    fontWeight: '500',
  },
  discordRpcStatus: {
    fontSize: 12,
    fontWeight: '400',
    marginTop: 2,
  },
  discordDisconnectButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
  },
  discordDisconnectText: {
    fontSize: 14,
    fontWeight: '500',
  },
  debugButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  debugButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
}); 