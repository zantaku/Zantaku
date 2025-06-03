// TODO: FINISH THE SETTINGS PAGE

import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
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

    if (id === 'notifications') {
      onClose();
      router.push('/activenotificationslist');
    } else if (id === 'theme') {
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
    const order = ['commons', 'theme', 'anime', 'manga', 'novel'];
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
            style={styles.footerContent}
            onPress={() => router.push('https://www.zantaku.com')}
          >
            <Logo width={120} height={40} variant="auto" />
            <Text style={[styles.versionText, { color: currentTheme.colors.textSecondary }]}>
              Early Access V1.5
            </Text>
          </TouchableOpacity>
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
  copyrightText: {
    fontSize: 12,
    marginTop: 12,
    opacity: 0.7,
  },
  footerContent: {
    alignItems: 'center',
    marginBottom: 8,
  },
  versionText: {
    fontSize: 14,
    marginTop: 8,
    opacity: 0.7,
  },
}); 