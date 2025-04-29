import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Platform, Animated, Alert } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { useRewards } from '../../hooks/useRewards';
import { useStreaks } from '../../hooks/useStreaks';
import { FontAwesome5 } from '@expo/vector-icons';
import RewardBadge from '../../components/RewardBadge';
import { supabase } from '../../lib/supabase';
import type { UserReward as SupabaseUserReward } from '../../lib/supabase';
import { getAnilistUser } from '../../lib/supabase';
import * as SecureStore from 'expo-secure-store';
import { STORAGE_KEY } from '../../constants/auth';
import { LinearGradient } from 'expo-linear-gradient';

// Badge icons mapping for rewards that don't have custom icon_url
const BADGE_ICONS: Record<string, string> = {
  // Anime rewards
  'Binge Master': 'play',
  'Opening Skipper': 'fast-forward',
  'Late Night Otaku': 'moon',
  'First Episode Fever': 'tv',
  'Season Slayer': 'calendar-check',
  
  // Manga rewards
  'Power Reader': 'book',
  'Panel Hopper': 'arrows-alt',
  'Chapter Clutch': 'bolt',
  'Cliffhanger Addict': 'mountain',
  'Silent Protagonist': 'volume-mute',
  
  // Combo rewards
  'Dual Wielder': 'gamepad',
  'Otaku Mode: ON': 'toggle-on',
  'Multiverse Traveler': 'globe-asia',
  'Weekend Warrior': 'calendar-week',
  'The Completionist': 'trophy',
  
  // Default icon for any reward not in the mapping
  'default': 'award'
};

// Badge colors mapping
const BADGE_COLORS: Record<string, string> = {
  // Anime rewards - blue tones
  'Binge Master': '#2196F3',
  'Opening Skipper': '#03A9F4',
  'Late Night Otaku': '#1A237E',
  'First Episode Fever': '#3F51B5',
  'Season Slayer': '#5C6BC0',
  
  // Manga rewards - green/teal tones
  'Power Reader': '#4CAF50',
  'Panel Hopper': '#009688',
  'Chapter Clutch': '#00796B',
  'Cliffhanger Addict': '#607D8B',
  'Silent Protagonist': '#795548',
  
  // Combo rewards - purple/gold tones
  'Dual Wielder': '#9C27B0',
  'Otaku Mode: ON': '#673AB7',
  'Multiverse Traveler': '#4A148C',
  'Weekend Warrior': '#FF5722',
  'The Completionist': '#FFC107',
  
  // Default color
  'default': '#9E9E9E'
};

const AchievementSettings = () => {
  const { currentTheme } = useTheme();
  const [activeTab, setActiveTab] = useState<'achievements' | 'howItWorks'>('achievements');
  const [supabaseUserId, setSupabaseUserId] = useState<string>();
  const [statusFilter, setStatusFilter] = useState<'all' | 'unlocked' | 'locked'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'anime' | 'manga'>('all');
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);
  const fadeAnim = useState(new Animated.Value(0))[0];
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Animation effect
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 1000,
      useNativeDriver: true,
    }).start();
  }, []);

  // Get the Supabase user ID on mount
  useEffect(() => {
    const getUser = async () => {
      try {
        // Get AniList token
        const token = await SecureStore.getItemAsync(STORAGE_KEY.AUTH_TOKEN);
        if (!token) {
          console.log('No auth token found');
          return;
        }

        // Get AniList user ID from token
        const tokenData = JSON.parse(atob(token.split('.')[1]));
        const anilistId = tokenData.sub;
        console.log('AniList ID from token:', anilistId);

        if (anilistId) {
          const anilistUser = await getAnilistUser(parseInt(anilistId));
          console.log('AniList user data:', anilistUser);
          
          if (anilistUser?.id) {
            console.log('Setting Supabase user ID:', anilistUser.id);
            setSupabaseUserId(anilistUser.id);
          } else {
            console.log('No Supabase user ID found in AniList user data');
          }
        }
      } catch (error) {
        console.error('Error getting user:', error);
      }
    };
    getUser();
  }, []);

  const { rewards, isLoading, error, rewardsCount, allRewards: hookAllRewards, checkAndAssignRewards } = useRewards(supabaseUserId ? supabaseUserId : null);
  const { currentStreak, longestStreak } = useStreaks();

  // Debug logs
  useEffect(() => {
    console.log('Debug Info:', {
      supabaseUserId,
      rewardsCount,
      rewardsLength: rewards?.length,
      isLoading,
      error
    });
  }, [supabaseUserId, rewards, isLoading, error]);

  // Create allRewards and userRewards structures that match the old hook format
  const allRewards = React.useMemo(() => {
    // If we have real rewards from the hook, use those
    if (hookAllRewards && hookAllRewards.length > 0) {
      return hookAllRewards;
    }
    
    // Otherwise use hardcoded fallback rewards (same as before)
    const availableRewards = [
      // Anime rewards
      { id: '1', name: 'Binge Master', description: 'Watch 50+ episodes in a week', type: 'anime' },
      { id: '2', name: 'Opening Skipper', description: 'Skip intros on 20+ episodes', type: 'anime' },
      { id: '3', name: 'Late Night Otaku', description: 'Watch anime between 1AM–5AM, 3+ times', type: 'anime' },
      { id: '4', name: 'First Episode Fever', description: 'Watch first episode of 10 different shows in a week', type: 'anime' },
      { id: '5', name: 'Season Slayer', description: 'Finish a 12-episode season in 48 hours', type: 'anime' },
      
      // Manga rewards
      { id: '6', name: 'Power Reader', description: 'Read 100+ chapters in a week', type: 'manga' },
      { id: '7', name: 'Panel Hopper', description: 'Read 10 different manga series in a month', type: 'manga' },
      { id: '8', name: 'Chapter Clutch', description: 'Finish a volume (8+ chapters) in 24 hrs', type: 'manga' },
      { id: '9', name: 'Cliffhanger Addict', description: 'Read 3+ ongoing manga series', type: 'manga' },
      { id: '10', name: 'Silent Protagonist', description: 'Read for 10+ hours without audio total', type: 'manga' },
      
      // Combo rewards
      { id: '11', name: 'Dual Wielder', description: '20+ episodes AND 20+ chapters in one week', type: 'combo' },
      { id: '12', name: 'Otaku Mode: ON', description: 'Log 1000+ total minutes of anime + manga time', type: 'combo' },
      { id: '13', name: 'Multiverse Traveler', description: 'Watch and read the same title', type: 'combo' },
      { id: '14', name: 'Weekend Warrior', description: '10+ entries watched/read in a single weekend', type: 'combo' },
      { id: '15', name: 'The Completionist', description: 'Finish 1 anime season and 1 manga volume in a month', type: 'combo' },
    ];
    
    return availableRewards;
  }, [hookAllRewards]);

  // Get the user rewards by comparing available rewards with the ones from the hook
  const userRewardIds = React.useMemo(() => {
    return rewards.map(r => r.id);
  }, [rewards]);

  // Group rewards by type
  const groupedRewards = {
    anime: allRewards.filter(reward => reward.type === 'anime'),
    manga: allRewards.filter(reward => reward.type === 'manga'),
    combo: allRewards.filter(reward => reward.type === 'combo'),
  };

  // Group user rewards by type
  const unlockedRewards = {
    anime: groupedRewards.anime.filter(reward => userRewardIds.includes(reward.id)),
    manga: groupedRewards.manga.filter(reward => userRewardIds.includes(reward.id)),
    combo: groupedRewards.combo.filter(reward => userRewardIds.includes(reward.id)),
  };

  // Progress calculations
  const progress = {
    anime: groupedRewards.anime.length > 0 ? unlockedRewards.anime.length / groupedRewards.anime.length : 0,
    manga: groupedRewards.manga.length > 0 ? unlockedRewards.manga.length / groupedRewards.manga.length : 0,
    combo: groupedRewards.combo.length > 0 ? unlockedRewards.combo.length / groupedRewards.combo.length : 0,
    total: allRewards?.length > 0 ? rewardsCount / allRewards.length : 0,
  };

  // Add function to process rewards
  const processUserActivity = async () => {
    if (!supabaseUserId) {
      console.log("Cannot process rewards without user ID");
      Alert.alert("Cannot Process", "Please make sure you're logged in to process achievements.");
      return;
    }
    
    // Demo stats for testing - in a real app, these would come from analytics
    const userStats = {
      weeklyEpisodes: 60,      // Unlocks Binge Master
      skippedIntros: 25,       // Unlocks Opening Skipper
      lateNightCount: 4,       // Unlocks Late Night Otaku
      weeklyChapters: 120,     // Unlocks Power Reader
      ongoingManga: 5,         // Unlocks Cliffhanger Addict
      totalMinutes: 1200,      // Unlocks Otaku Mode: ON
      matchTitle: true,        // Unlocks Multiverse Traveler
      // Add more stats for other achievements
    };
    
    try {
      const newRewards = await checkAndAssignRewards(userStats);
      console.log(`Processed user activity, unlocked ${newRewards.length} new rewards`);
      
      if (newRewards.length > 0) {
        // Show confirmation
        Alert.alert(
          "Achievements Unlocked!", 
          `You've unlocked ${newRewards.length} new achievements!`,
          [{ text: "Great!", style: "default" }]
        );
      } else {
        // Also show a message when no new rewards are unlocked
        Alert.alert(
          "Achievement Check Complete", 
          "No new achievements unlocked this time. Keep watching anime and reading manga!",
          [{ text: "OK", style: "default" }]
        );
      }
    } catch (error) {
      console.error("Error processing user rewards:", error);
      Alert.alert(
        "Error Processing Achievements", 
        "There was a problem checking your achievements. Please try again later."
      );
    }
  };
  
  // Add an effect to process rewards when the component mounts
  useEffect(() => {
    if (supabaseUserId && !isLoading) {
      // Wait a bit to let the UI render first
      const timer = setTimeout(() => {
        processUserActivity();
      }, 1000);
      
      return () => clearTimeout(timer);
    }
  }, [supabaseUserId, isLoading]);

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: currentTheme.colors.background,
    },
    tabContainer: {
      flexDirection: 'row',
      paddingHorizontal: 16,
      paddingTop: 16,
      marginBottom: 16,
      borderBottomWidth: 1,
      borderBottomColor: currentTheme.colors.border,
    },
    tab: {
      paddingVertical: 12,
      paddingHorizontal: 16,
      marginRight: 16,
      borderRadius: 8,
    },
    activeTab: {
      backgroundColor: currentTheme.colors.primary + '20',
    },
    tabText: {
      fontSize: 16,
      fontWeight: '600',
      color: currentTheme.colors.text,
    },
    activeTabText: {
      color: currentTheme.colors.primary,
    },
    content: {
      flex: 1,
      paddingHorizontal: 16,
    },
    contentContainer: {
      paddingBottom: 100,
    },
    bottomPadding: {
      height: 80,
    },
    celebrationHeader: {
      alignItems: 'center',
      marginBottom: 24,
      paddingVertical: 20,
      borderRadius: 16,
      overflow: 'hidden',
    },
    headerGradient: {
      position: 'absolute',
      width: '100%',
      height: '100%',
    },
    medalIcon: {
      marginBottom: 12,
    },
    headerText: {
      fontSize: 24,
      fontWeight: '800',
      color: currentTheme.colors.text,
      marginBottom: 8,
      textAlign: 'center',
    },
    subHeaderText: {
      fontSize: 16,
      color: currentTheme.colors.textSecondary,
      textAlign: 'center',
    },
    filtersRow: {
      marginBottom: 16,
    },
    filterContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: currentTheme.colors.surface,
      borderRadius: 20,
      padding: 4,
      marginBottom: 8,
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 3,
        },
        android: {
          elevation: 2,
        },
      }),
    },
    filterLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: currentTheme.colors.textSecondary,
      marginLeft: 10,
      marginRight: 4,
    },
    filterButton: {
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: 16,
      marginHorizontal: 2,
    },
    activeFilter: {
      backgroundColor: currentTheme.colors.primary,
    },
    filterText: {
      fontSize: 13,
      fontWeight: '600',
      color: currentTheme.colors.textSecondary,
    },
    activeFilterText: {
      color: '#FFF',
    },
    categorySection: {
      marginBottom: 24,
    },
    categoryHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
    },
    categoryIcon: {
      marginRight: 8,
    },
    categoryTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: currentTheme.colors.text,
    },
    progressContainer: {
      height: 8,
      backgroundColor: currentTheme.colors.surface,
      borderRadius: 4,
      marginBottom: 16,
      overflow: 'hidden',
    },
    progressBar: {
      height: '100%',
      borderRadius: 4,
    },
    statsContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 24,
    },
    statItem: {
      flex: 1,
      alignItems: 'center',
      backgroundColor: currentTheme.colors.surface,
      borderRadius: 16,
      paddingVertical: 16,
      marginHorizontal: 4,
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 3,
        },
        android: {
          elevation: 3,
        },
      }),
    },
    statValue: {
      fontSize: 24,
      fontWeight: '800',
      color: currentTheme.colors.text,
      marginBottom: 4,
    },
    statLabel: {
      fontSize: 12,
      fontWeight: '500',
      color: currentTheme.colors.textSecondary,
    },
    achievementItem: {
      backgroundColor: '#222',
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      flexDirection: 'row',
      alignItems: 'center',
    },
    achievementIcon: {
      width: 56,
      height: 56,
      borderRadius: 28,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 16,
    },
    achievementDetails: {
      flex: 1,
      justifyContent: 'center',
    },
    achievementTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: currentTheme.colors.text,
      marginBottom: 4,
    },
    achievementSubtitle: {
      fontSize: 14,
      color: currentTheme.colors.textSecondary,
    },
    unlockedAchievement: {
      borderColor: '#FFD700',
      backgroundColor: currentTheme.colors.surface + '90',
      ...Platform.select({
        ios: {
          shadowColor: '#FFD700',
          shadowOffset: { width: 0, height: 3 },
          shadowOpacity: 0.3,
          shadowRadius: 5,
        },
        android: {
          elevation: 5,
        },
      }),
    },
    lockedAchievement: {
      opacity: 0.7,
    },
    noAchievements: {
      fontSize: 16,
      color: currentTheme.colors.textSecondary,
      textAlign: 'center',
      marginTop: 32,
    },
    infoCard: {
      backgroundColor: currentTheme.colors.surface,
      borderRadius: 16,
      marginBottom: 20,
      overflow: 'hidden',
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 4,
        },
        android: {
          elevation: 3,
        },
      }),
    },
    infoCardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
      backgroundColor: currentTheme.colors.surface + '80',
      borderBottomWidth: 1,
      borderBottomColor: currentTheme.colors.border + '40',
    },
    infoCardIcon: {
      marginRight: 12,
    },
    infoCardTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: currentTheme.colors.text,
    },
    infoCardContent: {
      padding: 16,
    },
    categoryCard: {
      marginVertical: 8,
      backgroundColor: currentTheme.colors.background + '80',
      borderRadius: 12,
      borderLeftWidth: 4,
      overflow: 'hidden',
      padding: 12,
    },
    categoryCardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 8,
    },
    categoryCardIcon: {
      marginRight: 8,
    },
    categoryCardTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: currentTheme.colors.text,
    },
    guideItem: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginVertical: 8,
    },
    guideIcon: {
      marginRight: 12,
      marginTop: 2,
    },
    guideText: {
      flex: 1,
      fontSize: 14,
      color: currentTheme.colors.text,
      lineHeight: 20,
    },
    guideBold: {
      fontWeight: '700',
    },
    filtersContainer: {
      marginBottom: 20,
    },
    dropdownContainer: {
      marginBottom: 10,
      position: 'relative',
      zIndex: 1,
    },
    dropdownButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: '#222',
      borderRadius: 25,
      paddingVertical: 10,
      paddingHorizontal: 16,
    },
    dropdownLabel: {
      fontSize: 14,
      color: currentTheme.colors.textSecondary,
      fontWeight: '600',
    },
    selectedValueContainer: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    selectedValue: {
      fontSize: 14,
      color: currentTheme.colors.text,
      fontWeight: '600',
      marginRight: 8,
    },
    dropdownIcon: {
      marginTop: 2,
    },
    dropdownMenu: {
      position: 'absolute',
      top: '100%',
      left: 0,
      right: 0,
      backgroundColor: '#222',
      borderRadius: 15,
      marginTop: 5,
      paddingVertical: 5,
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.25,
          shadowRadius: 5,
        },
        android: {
          elevation: 5,
        },
      }),
    },
    dropdownMenuItem: {
      paddingVertical: 10,
      paddingHorizontal: 16,
    },
    activeMenuItem: {
      backgroundColor: '#0095FF',
    },
    menuItemText: {
      fontSize: 14,
      color: currentTheme.colors.text,
      fontWeight: '500',
    },
    activeMenuItemText: {
      color: '#FFFFFF',
      fontWeight: '600',
    },
    betaText: {
      fontWeight: '700',
      color: '#FB8C00',
    },
    statsWithRefresh: {
      marginBottom: 24,
    },
    refreshButton: {
      backgroundColor: '#2196F3',
      borderRadius: 12,
      paddingVertical: 10,
      paddingHorizontal: 16,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 12,
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.2,
          shadowRadius: 2,
        },
        android: {
          elevation: 2,
        },
      }),
    },
    refreshingButton: {
      backgroundColor: '#9E9E9E',
    },
    refreshButtonText: {
      color: '#FFFFFF',
      fontWeight: '600',
      fontSize: 14,
      marginLeft: 8,
    },
    spinningIcon: {
      transform: [{ rotate: '45deg' }],
    },
  });

  const getCategoryColor = (category: 'anime' | 'manga' | 'combo') => {
    switch (category) {
      case 'anime':
        return '#2196F3'; // Blue
      case 'manga':
        return '#4CAF50'; // Green
      case 'combo':
        return '#9C27B0'; // Purple
      default:
        return currentTheme.colors.primary;
    }
  };

  // Function to render each reward item
  const renderRewardItem = (reward: any, isUnlocked: boolean) => {
    return (
      <View 
        key={reward.id}
        style={[
          styles.achievementItem,
          !isUnlocked && { opacity: 0.6 }
        ]}
      >
        <View 
          style={[
            styles.achievementIcon,
            { backgroundColor: isUnlocked ? BADGE_COLORS[reward.name] || BADGE_COLORS.default : '#333' }
          ]}
        >
          <FontAwesome5 
            name={BADGE_ICONS[reward.name] || BADGE_ICONS.default} 
            size={24} 
            color="#FFFFFF" 
            solid 
          />
        </View>
        <View style={styles.achievementDetails}>
          <Text style={styles.achievementTitle}>
            {reward.name}
          </Text>
          <Text style={styles.achievementSubtitle} numberOfLines={2}>
            {reward.description}
          </Text>
        </View>
      </View>
    );
  };

  // Function to render each category section
  const renderCategorySection = (category: 'anime' | 'manga' | 'combo', title: string, icon: string) => {
    // Skip this section if it doesn't match the type filter
    if (typeFilter !== 'all' && typeFilter !== category) return null;
    
    const categoryRewards = groupedRewards[category];
    const categoryUnlocked = unlockedRewards[category];
    
    const filteredRewards = statusFilter === 'all' 
      ? categoryRewards
      : statusFilter === 'unlocked' 
        ? categoryUnlocked
        : categoryRewards.filter(reward => !userRewardIds.includes(reward.id));
    
    if (filteredRewards.length === 0) return null;
    
    const color = getCategoryColor(category);
    
    return (
      <View style={styles.categorySection}>
        <View style={styles.categoryHeader}>
          <FontAwesome5 
            name={icon} 
            size={20} 
            color={color} 
            solid 
            style={styles.categoryIcon} 
          />
          <Text style={styles.categoryTitle}>{title}</Text>
        </View>
        
        {filteredRewards.map((reward: any) => 
          renderRewardItem(reward, userRewardIds.includes(reward.id))
        )}
      </View>
    );
  };

  // Helper function to get display text for filters
  const getFilterDisplayText = (filter: string) => {
    switch (filter) {
      case 'all': return 'All';
      case 'unlocked': return 'Unlocked';
      case 'locked': return 'Locked';
      case 'anime': return 'Anime';
      case 'manga': return 'Manga';
      default: return 'All';
    }
  };

  // Updated filter UI
  const renderFilters = () => {
    return (
      <View style={styles.filtersContainer}>
        {/* Status Dropdown */}
        <View style={styles.dropdownContainer}>
          <TouchableOpacity 
            style={styles.dropdownButton}
            onPress={() => {
              setShowStatusDropdown(!showStatusDropdown);
              setShowTypeDropdown(false);
            }}
          >
            <Text style={styles.dropdownLabel}>Status:</Text>
            <View style={styles.selectedValueContainer}>
              <Text style={styles.selectedValue}>
                {getFilterDisplayText(statusFilter)}
              </Text>
              <FontAwesome5 
                name={showStatusDropdown ? "chevron-up" : "chevron-down"} 
                size={12} 
                color={currentTheme.colors.textSecondary} 
                style={styles.dropdownIcon}
              />
            </View>
          </TouchableOpacity>

          {showStatusDropdown && (
            <View style={styles.dropdownMenu}>
              <TouchableOpacity 
                style={[styles.dropdownMenuItem, statusFilter === 'all' && styles.activeMenuItem]}
                onPress={() => {
                  setStatusFilter('all');
                  setShowStatusDropdown(false);
                }}
              >
                <Text style={[styles.menuItemText, statusFilter === 'all' && styles.activeMenuItemText]}>All</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.dropdownMenuItem, statusFilter === 'unlocked' && styles.activeMenuItem]}
                onPress={() => {
                  setStatusFilter('unlocked');
                  setShowStatusDropdown(false);
                }}
              >
                <Text style={[styles.menuItemText, statusFilter === 'unlocked' && styles.activeMenuItemText]}>Unlocked</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.dropdownMenuItem, statusFilter === 'locked' && styles.activeMenuItem]}
                onPress={() => {
                  setStatusFilter('locked');
                  setShowStatusDropdown(false);
                }}
              >
                <Text style={[styles.menuItemText, statusFilter === 'locked' && styles.activeMenuItemText]}>Locked</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Type Dropdown */}
        <View style={styles.dropdownContainer}>
          <TouchableOpacity 
            style={styles.dropdownButton}
            onPress={() => {
              setShowTypeDropdown(!showTypeDropdown);
              setShowStatusDropdown(false);
            }}
          >
            <Text style={styles.dropdownLabel}>Type:</Text>
            <View style={styles.selectedValueContainer}>
              <Text style={styles.selectedValue}>
                {getFilterDisplayText(typeFilter)}
              </Text>
              <FontAwesome5 
                name={showTypeDropdown ? "chevron-up" : "chevron-down"} 
                size={12} 
                color={currentTheme.colors.textSecondary} 
                style={styles.dropdownIcon}
              />
            </View>
          </TouchableOpacity>

          {showTypeDropdown && (
            <View style={styles.dropdownMenu}>
              <TouchableOpacity 
                style={[styles.dropdownMenuItem, typeFilter === 'all' && styles.activeMenuItem]}
                onPress={() => {
                  setTypeFilter('all');
                  setShowTypeDropdown(false);
                }}
              >
                <Text style={[styles.menuItemText, typeFilter === 'all' && styles.activeMenuItemText]}>All</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.dropdownMenuItem, typeFilter === 'anime' && styles.activeMenuItem]}
                onPress={() => {
                  setTypeFilter('anime');
                  setShowTypeDropdown(false);
                }}
              >
                <Text style={[styles.menuItemText, typeFilter === 'anime' && styles.activeMenuItemText]}>Anime</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.dropdownMenuItem, typeFilter === 'manga' && styles.activeMenuItem]}
                onPress={() => {
                  setTypeFilter('manga');
                  setShowTypeDropdown(false);
                }}
              >
                <Text style={[styles.menuItemText, typeFilter === 'manga' && styles.activeMenuItemText]}>Manga</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    );
  };

  const renderStatsContainer = () => (
    <View style={styles.statsWithRefresh}>
      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{rewardsCount || 0}</Text>
          <Text style={styles.statLabel}>Unlocked</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{currentStreak}</Text>
          <Text style={styles.statLabel}>Day Streak</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{longestStreak}</Text>
          <Text style={styles.statLabel}>Best Streak</Text>
        </View>
      </View>
      <TouchableOpacity 
        style={[styles.refreshButton, isRefreshing && styles.refreshingButton]}
        onPress={async () => {
          if (isRefreshing) return;
          setIsRefreshing(true);
          await processUserActivity();
          setTimeout(() => setIsRefreshing(false), 1000);
        }}
        disabled={isRefreshing}
      >
        <FontAwesome5 
          name={isRefreshing ? "sync" : "sync-alt"} 
          size={16} 
          color="#FFFFFF" 
          style={isRefreshing && styles.spinningIcon} 
        />
        <Text style={styles.refreshButtonText}>
          {isRefreshing ? "Checking..." : "Refresh Achievements"}
        </Text>
      </TouchableOpacity>
    </View>
  );

  const renderAchievementsTab = () => (
    <ScrollView 
      style={styles.content} 
      contentContainerStyle={{ paddingBottom: 100 }}
      showsVerticalScrollIndicator={false}
    >
      <Animated.View style={{ opacity: fadeAnim }}>
        <LinearGradient
          colors={['#FFD700', '#FFC107', '#FFB300']}
          style={styles.celebrationHeader}
        >
          <FontAwesome5 
            name="medal" 
            size={36} 
            color="#FFFFFF" 
            solid 
            style={styles.medalIcon} 
          />
          <Text style={[styles.headerText, { color: '#FFFFFF' }]}>
            You've Unlocked {rewardsCount || 0} Achievements!
          </Text>
          <Text style={[styles.subHeaderText, { color: 'rgba(255,255,255,0.9)' }]}>
            {allRewards?.length ? `${allRewards.length - rewardsCount} more to go!` : 'Keep watching and reading to earn more!'}
          </Text>
        </LinearGradient>
      </Animated.View>
      
      {renderStatsContainer()}
      
      {/* Updated Filter Dropdowns */}
      {renderFilters()}
      
      {/* Render achievement sections based on filters */}
      {renderCategorySection('anime', 'Anime Achievements', 'tv')}
      {renderCategorySection('manga', 'Manga Achievements', 'book')}
      {renderCategorySection('combo', 'Combo Achievements', 'gamepad')}
      
      {rewardsCount === 0 && statusFilter !== 'locked' && (
        <Text style={styles.noAchievements}>
          No achievements unlocked yet. Keep watching anime and reading manga to earn badges!
        </Text>
      )}
      
      {/* Add extra padding at the bottom */}
      <View style={styles.bottomPadding} />
    </ScrollView>
  );

  const renderHowItWorksTab = () => (
    <ScrollView 
      style={styles.content} 
      contentContainerStyle={{ paddingBottom: 100 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Beta Notice Card */}
      <View style={styles.infoCard}>
        <View style={[styles.infoCardHeader, { backgroundColor: 'rgba(251, 140, 0, 0.2)' }]}>
          <FontAwesome5 name="flask" size={24} color="#FB8C00" solid style={styles.infoCardIcon} />
          <Text style={[styles.infoCardTitle, { color: '#FB8C00' }]}>Public Beta Notice</Text>
        </View>
        <View style={styles.infoCardContent}>
          <Text style={styles.guideText}>
            The achievements system is currently in <Text style={styles.betaText}>public beta</Text>. Please expect the following:
          </Text>
          <View style={styles.guideItem}>
            <FontAwesome5 name="info-circle" size={16} color="#FB8C00" style={styles.guideIcon} />
            <Text style={styles.guideText}>
              The system may not always work as expected and is currently limited
            </Text>
          </View>
          <View style={styles.guideItem}>
            <FontAwesome5 name="code-branch" size={16} color="#FB8C00" style={styles.guideIcon} />
            <Text style={styles.guideText}>
              We're working to expand it to reward more activities in the app
            </Text>
          </View>
          <View style={styles.guideItem}>
            <FontAwesome5 name="medal" size={16} color="#FB8C00" style={styles.guideIcon} />
            <Text style={styles.guideText}>
              Currently, achievements are decorative and visible on your home page and profile
            </Text>
          </View>
          <View style={styles.guideItem}>
            <FontAwesome5 name="discord" size={16} color="#FB8C00" style={styles.guideIcon} />
            <Text style={styles.guideText}>
              Coming soon: Integration with Discord to showcase your achievements
            </Text>
          </View>
          <Text style={[styles.guideText, { marginTop: 10, fontStyle: 'italic' }]}>
            We appreciate your feedback as we continue to improve this feature!
          </Text>
        </View>
      </View>

      {/* Streaks Card */}
      <View style={styles.infoCard}>
        <View style={styles.infoCardHeader}>
          <FontAwesome5 name="fire" size={24} color="#FF5722" solid style={styles.infoCardIcon} />
          <Text style={styles.infoCardTitle}>How Streaks Work</Text>
        </View>
        <View style={styles.infoCardContent}>
          <View style={styles.guideItem}>
            <FontAwesome5 name="tv" size={16} color="#2196F3" solid style={styles.guideIcon} />
            <Text style={styles.guideText}>
              <Text style={styles.guideBold}>Anime streak:</Text> Watch at least one episode daily
            </Text>
          </View>
          <View style={styles.guideItem}>
            <FontAwesome5 name="book" size={16} color="#4CAF50" solid style={styles.guideIcon} />
            <Text style={styles.guideText}>
              <Text style={styles.guideBold}>Manga streak:</Text> Read at least one chapter daily
            </Text>
          </View>
          <View style={styles.guideItem}>
            <FontAwesome5 name="gamepad" size={16} color="#9C27B0" solid style={styles.guideIcon} />
            <Text style={styles.guideText}>
              <Text style={styles.guideBold}>Combo streak:</Text> Both watch anime AND read manga in a day
            </Text>
          </View>
        </View>
      </View>

      {/* Achievement Categories Cards */}
      <View style={styles.infoCard}>
        <View style={styles.infoCardHeader}>
          <FontAwesome5 name="trophy" size={24} color="#FFC107" solid style={styles.infoCardIcon} />
          <Text style={styles.infoCardTitle}>Achievement Categories</Text>
        </View>
        
        {/* Anime Achievements */}
        <View style={[styles.categoryCard, { borderLeftColor: '#2196F3' }]}>
          <View style={styles.categoryCardHeader}>
            <FontAwesome5 name="tv" size={18} color="#2196F3" solid style={styles.categoryCardIcon} />
            <Text style={styles.categoryCardTitle}>Anime Achievements</Text>
          </View>
          <View style={styles.guideItem}>
            <FontAwesome5 name="play" size={14} color="#2196F3" style={styles.guideIcon} />
            <Text style={styles.guideText}>
              <Text style={styles.guideBold}>Binge Master:</Text> Watch 50+ episodes in a week
            </Text>
          </View>
          <View style={styles.guideItem}>
            <FontAwesome5 name="calendar-check" size={14} color="#5C6BC0" style={styles.guideIcon} />
            <Text style={styles.guideText}>
              <Text style={styles.guideBold}>Season Slayer:</Text> Finish a 12-episode season in 48 hours
            </Text>
          </View>
        </View>
        
        {/* Manga Achievements */}
        <View style={[styles.categoryCard, { borderLeftColor: '#4CAF50' }]}>
          <View style={styles.categoryCardHeader}>
            <FontAwesome5 name="book" size={18} color="#4CAF50" solid style={styles.categoryCardIcon} />
            <Text style={styles.categoryCardTitle}>Manga Achievements</Text>
          </View>
          <View style={styles.guideItem}>
            <FontAwesome5 name="book" size={14} color="#4CAF50" style={styles.guideIcon} />
            <Text style={styles.guideText}>
              <Text style={styles.guideBold}>Power Reader:</Text> Read 100+ chapters in a week
            </Text>
          </View>
          <View style={styles.guideItem}>
            <FontAwesome5 name="mountain" size={14} color="#607D8B" style={styles.guideIcon} />
            <Text style={styles.guideText}>
              <Text style={styles.guideBold}>Cliffhanger Addict:</Text> Read 3+ ongoing manga series
            </Text>
          </View>
        </View>
        
        {/* Combo Achievements */}
        <View style={[styles.categoryCard, { borderLeftColor: '#9C27B0' }]}>
          <View style={styles.categoryCardHeader}>
            <FontAwesome5 name="gamepad" size={18} color="#9C27B0" solid style={styles.categoryCardIcon} />
            <Text style={styles.categoryCardTitle}>Combo Achievements</Text>
          </View>
          <View style={styles.guideItem}>
            <FontAwesome5 name="toggle-on" size={14} color="#673AB7" style={styles.guideIcon} />
            <Text style={styles.guideText}>
              <Text style={styles.guideBold}>Otaku Mode: ON:</Text> 1000+ total minutes logged
            </Text>
          </View>
          <View style={styles.guideItem}>
            <FontAwesome5 name="globe-asia" size={14} color="#4A148C" style={styles.guideIcon} />
            <Text style={styles.guideText}>
              <Text style={styles.guideBold}>Multiverse Traveler:</Text> Watch and read the same title
            </Text>
          </View>
        </View>
      </View>

      {/* Tips Card */}
      <View style={styles.infoCard}>
        <View style={styles.infoCardHeader}>
          <FontAwesome5 name="lightbulb" size={24} color="#FFC107" solid style={styles.infoCardIcon} />
          <Text style={styles.infoCardTitle}>Tips for Success</Text>
        </View>
        <View style={styles.infoCardContent}>
          <View style={styles.guideItem}>
            <FontAwesome5 name="check-circle" size={16} color={currentTheme.colors.primary} style={styles.guideIcon} />
            <Text style={styles.guideText}>
              Log your activity as you watch/read to maintain accurate tracking
            </Text>
          </View>
          <View style={styles.guideItem}>
            <FontAwesome5 name="random" size={16} color={currentTheme.colors.primary} style={styles.guideIcon} />
            <Text style={styles.guideText}>
              Mix anime and manga activity to earn special combo achievements
            </Text>
          </View>
          <View style={styles.guideItem}>
            <FontAwesome5 name="calendar-alt" size={16} color={currentTheme.colors.primary} style={styles.guideIcon} />
            <Text style={styles.guideText}>
              Daily consistency is more important than binge sessions
            </Text>
          </View>
        </View>
      </View>
      
      {/* Add extra padding at the bottom */}
      <View style={styles.bottomPadding} />
    </ScrollView>
  );

  return (
    <View style={styles.container}>
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'achievements' && styles.activeTab]}
          onPress={() => setActiveTab('achievements')}
        >
          <Text style={[styles.tabText, activeTab === 'achievements' && styles.activeTabText]}>
            Achievements
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.tab, activeTab === 'howItWorks' && styles.activeTab]}
          onPress={() => setActiveTab('howItWorks')}
        >
          <Text style={[styles.tabText, activeTab === 'howItWorks' && styles.activeTabText]}>
            How It Works
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'achievements' ? renderAchievementsTab() : renderHowItWorksTab()}
    </View>
  );
};

export default AchievementSettings; 