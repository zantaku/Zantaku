// TODO: FINISH THE SETTINGS PAGE

import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform, Alert } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../hooks/useTheme';
import { useAuth } from '../hooks/useAuth';
import { SettingsTile } from './SettingsComponents';
import Logo from './Logo';
import * as Linking from 'expo-linking';
import * as Application from 'expo-application';
import { Image as ExpoImage } from 'expo-image';

interface AppSettingPageProps {
  onClose: () => void;
}

// User Profile Component
const UserProfile = ({ user, currentTheme, onNavigateToAccountSettings }: { user: any; currentTheme: any; onNavigateToAccountSettings: () => void }) => {
  if (!user || user.isAnonymous) {
    return (
      <TouchableOpacity 
        style={[styles.userProfileContainer, { backgroundColor: currentTheme.colors.surface, borderColor: currentTheme.colors.border }]}
        onPress={() => {
          // Navigate to login
          console.log('Navigate to login');
        }}
        activeOpacity={0.7}
      >
        <View style={styles.userProfileContent}>
          <View style={[styles.userAvatar, { backgroundColor: currentTheme.colors.primary }]}>
            <FontAwesome5 name="user-plus" size={24} color="#fff" />
          </View>
          <View style={styles.userInfo}>
            <Text style={[styles.userName, { color: currentTheme.colors.text }]}>Guest User</Text>
            <Text style={[styles.userStatus, { color: currentTheme.colors.textSecondary }]}>Tap to sign in with AniList</Text>
          </View>
          <FontAwesome5 name="chevron-right" size={16} color={currentTheme.colors.textSecondary} />
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <View style={[styles.userProfileContainer, { backgroundColor: currentTheme.colors.surface, borderColor: currentTheme.colors.border }]}>
      {/* Banner Image */}
      {user.bannerImage && (
        <View style={styles.userBannerContainer}>
          <ExpoImage
            source={{ uri: user.bannerImage }}
            style={styles.userBanner}
            contentFit="cover"
            placeholder="L6PZfSi_.AyE_3t7t7R**0o#DgR4"
          />
          <View style={styles.userBannerOverlay} />
        </View>
      )}
      
      <View style={styles.userProfileContent}>
        {/* Avatar */}
        <View style={styles.userAvatarContainer}>
          <ExpoImage
            source={{ uri: user.avatar?.large || user.avatar?.medium }}
            style={styles.userAvatar}
            contentFit="cover"
            placeholder="L6PZfSi_.AyE_3t7t7R**0o#DgR4"
          />
          {user.bannerImage && <View style={styles.userAvatarBorder} />}
        </View>
        
        {/* User Info */}
        <View style={styles.userInfo}>
          <Text style={[styles.userName, { color: currentTheme.colors.text }]} numberOfLines={1}>
            {user.name || user.username || 'AniList User'}
          </Text>
          <Text style={[styles.userStatus, { color: currentTheme.colors.textSecondary }]}>
            {user.isVerified ? '✓ Verified' : 'Not Verified'}
          </Text>
        </View>
        
        {/* Settings Icon */}
        <TouchableOpacity 
          style={styles.userSettingsButton}
          onPress={onNavigateToAccountSettings}
          activeOpacity={0.7}
        >
          <FontAwesome5 name="cog" size={16} color={currentTheme.colors.textSecondary} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default function AppSettingPage({ onClose }: AppSettingPageProps) {
  const router = useRouter();
  const { isDarkMode, currentTheme } = useTheme();
  const { user } = useAuth();
  const [isOpeningLink, setIsOpeningLink] = useState(false);

  const handleNavigateToAccountSettings = () => {
    onClose();
    router.push('/appsettings/accountsetting');
  };

  const handleSettingPress = (id: string) => {
    // Add logging for navigation attempts
    console.log('Settings Navigation:', {
      destination: id,
      isUserAuthenticated: !!user
    });

    if (id === 'theme') {
      onClose();
      router.push('/appsettings/themesettings');
    } else if (id === 'commons') {
      onClose();
      router.push('/appsettings/commonsetting');
    } else if (id === 'achievements') {
      onClose();
      router.push('/appsettings/achievementsettings');
    } else if (id === 'homesections') {
      onClose();
      router.push('/appsettings/homesections');
    } else if (id === 'anime') {
      onClose();
      router.push('/appsettings/animesettings');
    } else if (id === 'manga') {
      onClose();
      router.push('/appsettings/mangasettings');
    } else if (id === 'novel') {
      onClose();
      router.push('/appsettings/novelsettings');
    } else if (id === 'news') {
      onClose();
      router.push('/appsettings/newssettings');
    } else if (id === 'apistatus') {
      onClose();
      router.push('/appsettings/api');
    }
  };

  const allSettings = [
    {
      id: 'theme',
      icon: 'palette',
      title: 'Theme',
      description: 'Change the vibe of your app',
      iconBgColor: '#26A69A',
      requiresAuth: false,
    },
    {
      id: 'commons',
      icon: 'sliders-h',
      title: 'Common',
      description: 'General app settings',
      iconBgColor: '#9C27B0',
      requiresAuth: false,
    },
    {
      id: 'homesections',
      icon: 'columns',
      title: 'Home Sections',
      description: 'Customize your home page layout',
      iconBgColor: '#FF9800',
      requiresAuth: true,
    },
    {
      id: 'anime',
      icon: 'play',
      title: 'Anime',
      description: 'Configure video & episode settings',
      iconBgColor: '#EC407A',
      requiresAuth: false,
    },
    {
      id: 'manga',
      icon: 'book-reader',
      title: 'Reader',
      description: 'Choose how you read your content',
      iconBgColor: '#42A5F5',
      requiresAuth: false,
    },
    {
      id: 'novel',
      icon: 'book-open',
      title: 'Novel',
      description: 'Configure your LN reading experience',
      iconBgColor: '#8BC34A',
      requiresAuth: false,
    },
    {
      id: 'news',
      icon: 'newspaper',
      title: 'News Feed',
      description: 'Customize your news sources and preferences',
      iconBgColor: '#FF6B35',
      requiresAuth: true,
    },
    {
      id: 'apistatus',
      icon: 'server',
      title: 'API Status',
      description: 'Monitor real-time API health & performance',
      iconBgColor: '#4CAF50',
      requiresAuth: false,
    },
    // {
    //   id: 'sources',
    //   icon: 'puzzle-piece',
    //   title: 'Sources',
    //   description: 'Manage your sources \n(COMING SOON)',
    //   iconBgColor: '#66BB6A',
    // },
  ];

  const settings = allSettings.filter(setting => {
    // Show setting if it doesn't require auth, or if user is authenticated
    const isVisible = !setting.requiresAuth || (user && !user.isAnonymous);
    
    console.log('Setting visibility:', {
      settingId: setting.id,
      requiresAuth: setting.requiresAuth,
      isUserAuthenticated: user && !user.isAnonymous,
      isVisible
    });
    
    return isVisible;
  });

  // Sort settings to ensure consistent order
  settings.sort((a, b) => {
    const order = ['commons', 'theme', 'apistatus', 'news', 'anime', 'manga', 'novel'];
    return order.indexOf(a.id) - order.indexOf(b.id);
  });

  // Add logging for debugging
  console.log('AppSettingPage Render:', {
    isUserAuthenticated: user && !user.isAnonymous,
    isAnonymous: user?.isAnonymous,
    userData: user,
    themeMode: isDarkMode ? 'dark' : 'light',
    availableSettings: allSettings.length,
    filteredSettings: settings.length
  });

  // Social media links with app schemes
  const socialLinks = [
    { 
      icon: 'discord', 
      url: 'https://discord.gg/Pm7KyBYdA5', 
      color: '#5865F2',
      appScheme: Platform.OS === 'ios' ? 'discord://' : 'com.discord',
      packageName: Platform.OS === 'android' ? 'com.discord' : undefined
    },
    { 
      icon: 'telegram', 
      url: 'https://t.me/zantakuapp', 
      color: '#0088CC',
      appScheme: Platform.OS === 'ios' ? 'tg://' : 'org.telegram.messenger',
      packageName: Platform.OS === 'android' ? 'org.telegram.messenger' : undefined
    },
    { 
      icon: 'github', 
      url: 'https://github.com/zantaku/', 
      color: '#333333',
      appScheme: Platform.OS === 'ios' ? 'github://' : 'com.github.android',
      packageName: Platform.OS === 'android' ? 'com.github.android' : undefined
    },
    { 
      icon: 'reddit', 
      url: 'https://www.reddit.com/r/Zantaku/', 
      color: '#FF4500',
      appScheme: Platform.OS === 'ios' ? 'reddit://' : 'com.reddit.frontpage',
      packageName: Platform.OS === 'android' ? 'com.reddit.frontpage' : undefined
    },
    { 
      icon: 'youtube', 
      url: 'https://www.youtube.com/@Zantaku', 
      color: '#FF0000',
      appScheme: Platform.OS === 'ios' ? 'youtube://' : 'com.google.android.youtube',
      packageName: Platform.OS === 'android' ? 'com.google.android.youtube' : undefined
    },
  ];

  const openLink = async (social: typeof socialLinks[0]) => {
    if (isOpeningLink) return; // Prevent multiple simultaneous opens
    
    setIsOpeningLink(true);
    try {
      // Try to open the app first
      if (social.appScheme) {
        const canOpen = await Linking.canOpenURL(social.appScheme);
        if (canOpen) {
          // Open the app with the specific URL
          let appUrl = social.appScheme;
          
          // Handle specific app schemes
          if (social.icon === 'discord') {
            appUrl = `${social.appScheme}invite/${social.url.split('/').pop()}`;
          } else if (social.icon === 'telegram') {
            appUrl = `${social.appScheme}resolve?domain=${social.url.split('/').pop()}`;
          } else if (social.icon === 'github') {
            appUrl = `${social.appScheme}${social.url.split('github.com/')[1]}`;
          } else if (social.icon === 'reddit') {
            appUrl = `${social.appScheme}r/${social.url.split('/r/')[1]}`;
          } else if (social.icon === 'youtube') {
            appUrl = `${social.appScheme}channel/${social.url.split('@')[1]}`;
          }
          
          try {
            await Linking.openURL(appUrl);
            console.log(`Successfully opened ${social.icon} in the app`);
            return;
          } catch (appError) {
            console.log(`Failed to open ${social.icon} app, falling back to webview:`, appError);
            // If app fails to open, continue to fallback
          }
        }
      }
      
      // If app is not available, show option to user
      if (Platform.OS === 'android' && social.packageName) {
        Alert.alert(
          `${social.icon.charAt(0).toUpperCase() + social.icon.slice(1)} App Not Found`,
          `Would you like to install the ${social.icon} app or open in browser?`,
          [
            {
              text: 'Install App',
              onPress: () => {
                // Open Play Store to install the app
                Linking.openURL(`market://details?id=${social.packageName}`);
              }
            },
            {
              text: 'Open in Browser',
              onPress: () => {
                router.push({ pathname: '/webview', params: { url: social.url } });
              }
            },
            {
              text: 'Cancel',
              style: 'cancel'
            }
          ]
        );
      } else if (Platform.OS === 'ios') {
        // For iOS, show option to open App Store
        const appStoreUrls = {
          discord: 'https://apps.apple.com/app/discord/id985746746',
          telegram: 'https://apps.apple.com/app/telegram/id686449807',
          github: 'https://apps.apple.com/app/github/id1477376905',
          reddit: 'https://apps.apple.com/app/reddit/id1064216828',
          youtube: 'https://apps.apple.com/app/youtube/id544007664'
        };
        
        Alert.alert(
          `${social.icon.charAt(0).toUpperCase() + social.icon.slice(1)} App Not Found`,
          `Would you like to install the ${social.icon} app or open in browser?`,
          [
            {
              text: 'Install App',
              onPress: () => {
                // Open App Store to install the app
                const appStoreUrl = appStoreUrls[social.icon as keyof typeof appStoreUrls];
                if (appStoreUrl) {
                  Linking.openURL(appStoreUrl);
                }
              }
            },
            {
              text: 'Open in Browser',
              onPress: () => {
                router.push({ pathname: '/webview', params: { url: social.url } });
              }
            },
            {
              text: 'Cancel',
              style: 'cancel'
            }
          ]
        );
      } else {
        // For other platforms or when no package name, just open in webview
        console.log(`App not available for ${social.icon}, opening in webview`);
        router.push({ pathname: '/webview', params: { url: social.url } });
      }
      
    } catch (error) {
      console.error('Error opening link:', error);
      // Fallback to webview on error
      router.push({ pathname: '/webview', params: { url: social.url } });
    } finally {
      setIsOpeningLink(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: currentTheme.colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { 
        backgroundColor: currentTheme.colors.background,
        borderBottomColor: currentTheme.colors.border 
      }]}>
        <TouchableOpacity 
          onPress={onClose} 
          style={[styles.backButton, { backgroundColor: 'rgba(0,0,0,0.05)' }]}
        >
          <FontAwesome5 name="arrow-left" size={20} color={currentTheme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: currentTheme.colors.text }]}>Settings</Text>
      </View>

      {/* Settings List */}
      <ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={[
          styles.scrollViewContent,
          (!user || user.isAnonymous) && styles.scrollViewContentGuest
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* User Profile Section */}
        <View style={styles.userProfileSection}>
          <UserProfile 
            user={user} 
            currentTheme={currentTheme} 
            onNavigateToAccountSettings={handleNavigateToAccountSettings}
          />
        </View>

        <View style={[
          styles.settingsContainer,
          (!user || user.isAnonymous) && styles.settingsContainerGuest
        ]}>
          {settings.map((setting) => (
            <SettingsTile
              key={setting.id}
              title={setting.title}
              description={setting.description}
              icon={setting.icon}
              iconBgColor={setting.iconBgColor}
              onPress={() => handleSettingPress(setting.id)}
              rightComponent={<FontAwesome5 name="chevron-right" size={16} color={currentTheme.colors.textSecondary} />}
              style={styles.settingItemCustom}
            />
          ))}
        </View>
        
        {/* Copyright Section */}
        <View style={[
          styles.copyrightSection, 
          { 
            backgroundColor: currentTheme.colors.background,
            borderTopColor: 'rgba(0,0,0,0.05)'
          },
          (!user || user.isAnonymous) && styles.copyrightSectionGuest
        ]}>
          <TouchableOpacity 
            style={[styles.footerContent, { 
              backgroundColor: isDarkMode 
                ? 'rgba(139, 69, 19, 0.25)' // Dark mode: dark orange/brown Halloween color
                : 'rgba(255, 140, 0, 0.15)' // Light mode: light orange Halloween color
            }]}
            onPress={() => router.push({ pathname: '/webview', params: { url: 'https://www.zantaku.com' } })}
            activeOpacity={0.7}
          >
            <Logo width={120} height={40} variant="auto" />
            <Text style={[styles.versionText, { color: currentTheme.colors.textSecondary }]}>
              V1.6.0
            </Text>
            <Text style={[styles.tapHintText, { color: currentTheme.colors.textSecondary }]}>
            Visit website
            </Text>
          </TouchableOpacity>
          
          {/* Social Media Links */}
          <View style={styles.socialLinksContainer}>
            {socialLinks.map((social, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.socialButton,
                  { backgroundColor: `${social.color}15` },
                  isOpeningLink && styles.socialButtonDisabled
                ]}
                onPress={() => openLink(social)}
                activeOpacity={0.6}
                disabled={isOpeningLink}
                onLongPress={() => {
                  // Show info about what this button does
                  Alert.alert(
                    `${social.icon.charAt(0).toUpperCase() + social.icon.slice(1)}`,
                    `Opens ${social.icon} in the app if installed, otherwise in browser. Long press to open directly in browser.`,
                    [
                      {
                        text: 'Open in Browser',
                        onPress: () => {
                          router.push({ pathname: '/webview', params: { url: social.url } });
                        }
                      },
                      {
                        text: 'Cancel',
                        style: 'cancel'
                      }
                    ]
                  );
                }}
              >
                <FontAwesome5 
                  name={isOpeningLink ? 'spinner' : social.icon} 
                  size={22} 
                  color={isOpeningLink ? currentTheme.colors.textSecondary : social.color}
                  style={isOpeningLink ? styles.spinningIcon : undefined}
                />
              </TouchableOpacity>
            ))}
          </View>
          
          {/* Hint text */}
          <Text style={[styles.hintText, { color: currentTheme.colors.textSecondary }]}>
            Tap to open in app • Long press to open in browser
          </Text>
          
          <Text style={[styles.copyrightText, { color: currentTheme.colors.textSecondary }]}>
            © 2025 Zantaku. All rights reserved.
          </Text>
        </View>
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
    padding: 10,
    marginRight: 16,
    borderRadius: 12,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: 'bold',
    letterSpacing: -0.5,
  },
  scrollView: {
    flex: 1,
  },
  userProfileSection: {
    marginTop: 12,
    marginHorizontal: 16,
    marginBottom: 8,
  },
  userProfileContainer: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  userBannerContainer: {
    height: 80,
    position: 'relative',
  },
  userBanner: {
    width: '100%',
    height: '100%',
  },
  userBannerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  userProfileContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    position: 'relative',
  },
  userAvatarContainer: {
    position: 'relative',
  },
  userAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#f0f0f0',
  },
  userAvatarBorder: {
    position: 'absolute',
    top: -2,
    left: -2,
    right: -2,
    bottom: -2,
    borderRadius: 32,
    borderWidth: 3,
    borderColor: '#fff',
  },
  userInfo: {
    flex: 1,
    marginLeft: 16,
    justifyContent: 'center',
  },
  userName: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  userStatus: {
    fontSize: 14,
    opacity: 0.8,
  },
  userSettingsButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  scrollViewContent: {
    flexGrow: 1,
    justifyContent: 'space-between',
    paddingBottom: 100, // Add padding to account for bottom navigation
  },
  scrollViewContentGuest: {
    paddingBottom: 100, // Consistent padding for guest users too
  },
  settingsContainer: {
    marginTop: 12,
    marginBottom: 24,
    backgroundColor: 'rgba(0,0,0,0.02)',
    borderRadius: 16,
    marginHorizontal: 16,
    overflow: 'hidden',
  },
  settingsContainerGuest: {
    marginBottom: 0,
  },
  settingItemCustom: {
    backgroundColor: 'transparent',
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  copyrightSection: {
    padding: 16,
    alignItems: 'center',
    borderTopWidth: 1,
    marginTop: 16,
    marginBottom: 20, // Add margin to separate from bottom edge
  },
  copyrightSectionGuest: {
    marginTop: 0,
    paddingTop: 24,
    paddingBottom: 24,
    marginBottom: 20, // Consistent margin for guest users
  },
  socialLinksContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginVertical: 16,
    flexWrap: 'wrap',
  },
  socialButton: {
    marginHorizontal: 8,
    marginVertical: 4,
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 48,
    minHeight: 48,
  },
  socialButtonDisabled: {
    opacity: 0.6,
  },
  spinningIcon: {
    // Add rotation animation for spinner
  },
  hintText: {
    fontSize: 11,
    marginTop: 8,
    opacity: 0.6,
    textAlign: 'center',
  },
  copyrightText: {
    fontSize: 12,
    marginTop: 12,
    opacity: 0.7,
  },
  footerContent: {
    alignItems: 'center',
    marginBottom: 8,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    minWidth: 200,
  },
  tapHintText: {
    fontSize: 12,
    marginTop: 4,
    opacity: 0.6,
    fontStyle: 'italic',
  },
  versionText: {
    fontSize: 14,
    marginTop: 8,
    opacity: 0.7,
  },
}); 