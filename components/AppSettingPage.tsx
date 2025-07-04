// TODO: FINISH THE SETTINGS PAGE

import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Linking } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../hooks/useTheme';
import { useAuth } from '../hooks/useAuth';
import { SettingsTile } from './SettingsComponents';
import Logo from './Logo';

interface AppSettingPageProps {
  onClose: () => void;
}

export default function AppSettingPage({ onClose }: AppSettingPageProps) {
  const router = useRouter();
  const { isDarkMode, currentTheme } = useTheme();
  const { user } = useAuth();

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
    } else if (id === 'accounts') {
      onClose();
      router.push('/appsettings/accountsetting');
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
      id: 'accounts',
      icon: 'users',
      title: 'Accounts',
      description: 'Manage your Anilist Account',
      iconBgColor: '#5C6BC0',
      requiresAuth: true,
    },
    {
      id: 'notifications',
      icon: 'bell',
      title: 'Notifications',
      description: 'Customise your news and updates',
      iconBgColor: '#EF5350',
      requiresAuth: true,
    },
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
      requiresAuth: false,
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

  // Social media links
  const socialLinks = [
    { icon: 'discord', url: 'https://discord.gg/Pm7KyBYdA5', color: '#5865F2' },
    { icon: 'telegram', url: 'https://t.me/zantakuapp', color: '#0088CC' },
    { icon: 'github', url: 'https://github.com/zantaku/', color: '#333333' },
    { icon: 'reddit', url: 'https://www.reddit.com/r/Zantaku/', color: '#FF4500' },
    { icon: 'youtube', url: 'https://www.youtube.com/@Zantaku', color: '#FF0000' },
  ];

  const openLink = (url: string) => {
    Linking.openURL(url).catch(err => console.error('An error occurred', err));
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
            style={[styles.footerContent, { backgroundColor: currentTheme.colors.surface || 'rgba(0,0,0,0.02)' }]}
            onPress={() => openLink('https://www.zantaku.com')}
            activeOpacity={0.7}
          >
            <Logo width={120} height={40} variant="auto" />
            <Text style={[styles.versionText, { color: currentTheme.colors.textSecondary }]}>
              Public Beta V1.5
            </Text>
            <Text style={[styles.tapHintText, { color: currentTheme.colors.textSecondary }]}>
              Tap to visit website
            </Text>
          </TouchableOpacity>
          
          {/* Social Media Links */}
          <View style={styles.socialLinksContainer}>
            {socialLinks.map((social, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.socialButton,
                  { backgroundColor: `${social.color}15` }
                ]}
                onPress={() => openLink(social.url)}
                activeOpacity={0.6}
              >
                <FontAwesome5 name={social.icon} size={22} color={social.color} />
              </TouchableOpacity>
            ))}
          </View>
          
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