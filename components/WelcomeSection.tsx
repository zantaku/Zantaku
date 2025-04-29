import React, { useState, useEffect, useRef, useCallback, memo, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Easing, Modal, Platform, FlatList, BackHandler, Alert, DeviceEventEmitter, UIManager, LayoutAnimation } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { LinearGradient } from 'expo-linear-gradient';
import * as SecureStore from 'expo-secure-store';
import { useQuery } from '@tanstack/react-query';
import { supabase, getAnilistUser, getUserRewards } from '../lib/supabase';
import BadgeCounter from './BadgeCounter';
import AchievementsList from './AchievementsList';
import { useRouter } from 'expo-router';
import { useRewards, RewardDetail, BadgeDisplay } from '../hooks/useRewards';
import { useStreaks } from '../hooks/useStreaks';
import { STORAGE_KEY } from '../constants/auth';
import { processUserRewards } from '../utils/rewards';
import { checkAndUpdateStreaks } from '../utils/streakTracker';
import ENV from '../config';

// Welcome section storage key (should match the one in homesections.tsx)
const WELCOME_SECTION_STORAGE_KEY = "welcome_section";

// Welcome section type enum (should match the one in homesections.tsx)
enum WelcomeSectionType {
  BASIC = 'basic',
  ACHIEVEMENT = 'achievement'
}

// Add a storage key for greeting index
const GREETING_INDEX_KEY = 'LAST_GREETING_INDEX';

// Modify the getTimeBasedGreeting function to use a rotating index
const getTimeBasedGreeting = async (name: string) => {
  const hour = new Date().getHours();
  
  // Early morning (5 AM - 8 AM)
  const earlyMorningGreetings = [
    `Rise and shine, ${name}! ☀️`,
    `Ohayou, ${name}! 🌅`,
    `Early bird, ${name}? Let's start the day right!`,
    `Morning anime vibes, ${name}!`,
  ];

  // Morning (8 AM - 11 AM)
  const morningGreetings = [
    `Good morning, ${name}! ☀️`,
    `Hello ${name}! Ready for some anime?`,
    `What's on your watchlist today, ${name}?`,
    `Fresh picks waiting for you, ${name}!`,
  ];

  // Afternoon (11 AM - 5 PM)
  const afternoonGreetings = [
    `Hey ${name}! ✨`,
    `Afternoon anime break, ${name}?`,
    `Perfect time for a new episode, ${name}!`,
    `Konnichiwa, ${name}! 🍵`,
  ];

  // Evening (5 PM - 9 PM)
  const eveningGreetings = [
    `Good evening, ${name}! 🌙`,
    `Konbanwa, ${name}! Ready to relax?`,
    `Evening anime session, ${name}?`,
    `Your watchlist is waiting, ${name}!`,
  ];

  // Night (9 PM - 12 AM)
  const nightGreetings = [
    `Cozy night vibes, ${name}! 🌟`,
    `Night time is anime time, ${name}!`,
    `One more episode, ${name}?`,
    `Late night anime hits different, ${name}!`,
  ];

  // Midnight/Late Night (12 AM - 5 AM)
  const midnightGreetings = [
    `Night owl ${name}? Same here! 🦉`,
    `Can't sleep? Anime can help, ${name}!`,
    `Late night anime hits different, ${name}!`,
    `The perfect time for manga, ${name}!`,
  ];

  // Select appropriate greetings array based on time
  let greetings;
  if (hour >= 5 && hour < 8) greetings = earlyMorningGreetings;
  else if (hour >= 8 && hour < 11) greetings = morningGreetings;
  else if (hour >= 11 && hour < 17) greetings = afternoonGreetings;
  else if (hour >= 17 && hour < 21) greetings = eveningGreetings;
  else if (hour >= 21 && hour < 24) greetings = nightGreetings;
  else greetings = midnightGreetings;

  try {
    // Get the last used index
    const lastIndexStr = await SecureStore.getItemAsync(GREETING_INDEX_KEY) || '-1';
    let lastIndex = parseInt(lastIndexStr);
    
    // If invalid, reset to -1
    if (isNaN(lastIndex) || lastIndex < -1 || lastIndex >= greetings.length - 1) {
      lastIndex = -1;
    }
    
    // Select the next index
    const newIndex = (lastIndex + 1) % greetings.length;
    
    // Save the new index for next time
    await SecureStore.setItemAsync(GREETING_INDEX_KEY, newIndex.toString());
    
    // Return the greeting at the new index
    return greetings[newIndex];
  } catch (error) {
    console.error('Error rotating greetings:', error);
    // Fallback to random if storage fails
  return greetings[Math.floor(Math.random() * greetings.length)];
  }
};

const getTrendingPhrase = (rank: number, score: number) => {
  const phrases = [
    `#${rank} on AniList right now!`,
    `Ranked #${rank} with ${score}% rating`,
    `Top ${rank} trending worldwide`,
    `${score}% of fans are loving this`,
    `Climbing to #${rank} this week`,
    `Making waves at #${rank}`,
    `${score}% community score - Rank #${rank}`,
    `Rising star at #${rank}`,
    `Join ${score}% of fans watching this`,
    `Hot pick at #${rank}`,
    `${score}% fan approval - #${rank}`,
    `Trending at #${rank} globally`
  ];
  return phrases[Math.floor(Math.random() * phrases.length)];
};

// New interfaces for AniList API data
interface UserStats {
  chaptersRead: number;
  minutesWatched: number;
  episodesWatched: number;
  meanScore: number;
  standardDeviation: number;
  count: number;
  statuses: {
    status: string;
    count: number;
  }[];
  formats: {
    format: string;
    count: number;
  }[];
}

interface AniListUserStats {
  anime: UserStats;
  manga: UserStats;
}

interface UserActivity {
  id: number;
  status: string;
  progress: number;
  media: {
    id: number;
    title: {
      userPreferred: string;
    };
    coverImage: {
      medium: string;
    };
    type: 'ANIME' | 'MANGA';
  };
  createdAt: number;
}

interface MediaItem {
  id: number;
  title: {
    userPreferred: string;
    romaji?: string;
    english?: string;
    native?: string;
  };
  coverImage: {
    medium: string;
    large: string;
  };
  progress?: number;
  episodes?: number;
  trending?: number;
  averageScore?: number;
  popularity?: number;
  type: 'ANIME' | 'MANGA';
}

interface WelcomeSectionProps {
  user: { 
    name: string;
    titleLanguage: string;
    id: number;  // Added user ID for API calls
  };
  trendingMedia: MediaItem[];
  currentlyWatching: MediaItem[];
  currentlyReading: MediaItem[];
  onViewAll: () => void;
  welcomeSectionType?: WelcomeSectionType; // Optional prop for section type preference
}

// Add storage key for viewed rewards
const VIEWED_REWARDS_KEY = 'VIEWED_REWARDS';

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

// Enable LayoutAnimation for Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// Enhance the achievement badge system to consider anime, manga and combined activity
const getAchievementBadge = (chapters: number, episodes: number, streakDays: number, todayActivity: number, weeklyProgress: number) => {
  // Determine badge based on overall progress AND recent activity
  
  // Calculate total content consumed (chapters + episodes)
  const totalContent = chapters + episodes;
  
  // Determine if user is primarily anime, manga, or balanced
  const isAnimeUser = episodes > chapters * 2; // Significantly more episodes than chapters
  const isMangaUser = chapters > episodes * 2; // Significantly more chapters than episodes
  const isBalancedUser = !isAnimeUser && !isMangaUser && episodes > 0 && chapters > 0;
  
  // Check if user has been inactive recently
  const isInactive = streakDays === 0 || (weeklyProgress < 10 && todayActivity === 0);
  
  // If inactive, prioritize motivation over achievement level
  if (isInactive) {
    // Different inactive states based on total progress and type of content
    if (totalContent >= 1000) {
      if (isAnimeUser) {
        return {
          name: "Taking a Break",
          icon: "hourglass-half",
          color: "#3F51B5", // Indigo - anime color
          message: `We miss your anime time! You've watched ${episodes} episodes overall.`,
          isMotivational: true
        };
      } else if (isMangaUser) {
        return {
          name: "Taking a Break",
          icon: "hourglass-half",
          color: "#607D8B", // Blue-gray - manga color
          message: `Your manga is waiting! You've read ${chapters} chapters overall.`,
          isMotivational: true
        };
      } else {
        return {
          name: "Taking a Break",
          icon: "hourglass-half",
          color: "#673AB7", // Deep Purple - balanced color
          message: `We miss you! You've enjoyed ${chapters} chapters and ${episodes} episodes overall.`,
          isMotivational: true
        };
      }
    } else {
      return {
        name: "New Journey",
        icon: "map-signs",
        color: "#795548", // Brown
        message: `Ready to start your anime/manga journey?`,
        isMotivational: true
      };
    }
  }
  
  // Calculate anime tier based on episodes watched
  let animeTier = 0;
  if (episodes >= 5000) animeTier = 5; // Ultimate anime tier
  else if (episodes >= 2500) animeTier = 4; // Master anime tier
  else if (episodes >= 1000) animeTier = 3; // Expert anime tier
  else if (episodes >= 300) animeTier = 2; // Intermediate anime tier
  else if (episodes >= 50) animeTier = 1; // Beginner anime tier
  
  // Calculate manga tier based on chapters read
  let mangaTier = 0;
  if (chapters >= 10000) mangaTier = 5; // Ultimate manga tier
  else if (chapters >= 5000) mangaTier = 4; // Master manga tier
  else if (chapters >= 2000) mangaTier = 3; // Expert manga tier
  else if (chapters >= 500) mangaTier = 2; // Intermediate manga tier
  else if (chapters >= 100) mangaTier = 1; // Beginner manga tier
  
  // Calculate combined tier based on total content
  let combinedTier = 0;
  if (totalContent >= 12000) combinedTier = 5; // Ultimate combined tier
  else if (totalContent >= 6000) combinedTier = 4; // Master combined tier
  else if (totalContent >= 3000) combinedTier = 3; // Expert combined tier
  else if (totalContent >= 800) combinedTier = 2; // Intermediate combined tier
  else if (totalContent >= 150) combinedTier = 1; // Beginner combined tier
  
  // Calculate activity tier based on recent engagement
  let activityTier = 0;
  if (streakDays >= 7 && weeklyProgress >= 50) activityTier = 3; // Super active
  else if (streakDays >= 3 && weeklyProgress >= 20) activityTier = 2; // Very active
  else if (streakDays >= 1 && todayActivity > 0) activityTier = 1; // Active
  
  // Add streak-specific recognition if streak is impressive
  if (streakDays >= 10) {
    return {
      name: "Streak Master",
      icon: "fire",
      color: "#F44336", // Red
      message: `🔥 ${streakDays} day streak! You're on fire!`,
      isMotivational: false
    };
  }
  
  // Format chapters/episodes text for messages
  const chaptersText = chapters > 0 ? `${chapters} chapters` : "";
  const episodesText = episodes > 0 ? `${episodes} episodes` : "";
  const contentText = chapters > 0 && episodes > 0 
    ? `${chapters} chapters and ${episodes} episodes` 
    : chaptersText || episodesText;
  
  // ANIME-SPECIFIC ACHIEVEMENTS
  if (isAnimeUser) {
    // Adjust tier based on activity
    const adjustedTier = Math.min(5, animeTier + Math.floor(activityTier / 2));
    
    const animeAchievements = [
      {
        name: "Anime Rookie",
        icon: "tv",
        color: "#2196F3", // Blue
        message: `Making progress! ${episodes} episodes and counting.`,
        isMotivational: false
      },
      {
        name: "Binge Watcher",
        icon: "play",
        color: "#03A9F4", // Light blue
        message: `Nice binging! ${episodes} episodes watched!`,
        isMotivational: false
      },
      {
        name: "Anime Explorer",
        icon: "compass",
        color: "#3F51B5", // Indigo
        message: `Impressive! You've watched ${episodes} episodes.`,
        isMotivational: false
      },
      {
        name: "Seasoned Viewer",
        icon: "trophy",
        color: "#5C6BC0", // Lighter indigo
        message: `Amazing! ${episodes} episodes under your belt.`,
        isMotivational: false
      },
      {
        name: "Anime Master",
        icon: "film",
        color: "#7E57C2", // Mid purple
        message: `Outstanding! ${episodes} episodes completed!`,
        isMotivational: false
      },
      {
        name: "Anime Legend",
        icon: "star",
        color: "#673AB7", // Deep purple
        message: `Legendary! You've watched ${episodes} episodes!`,
        isMotivational: false
      }
    ];
    
    return animeAchievements[adjustedTier];
  }
  
  // MANGA-SPECIFIC ACHIEVEMENTS
  if (isMangaUser) {
    // Adjust tier based on activity
    const adjustedTier = Math.min(5, mangaTier + Math.floor(activityTier / 2));
    
    const mangaAchievements = [
      {
        name: "Reading Rookie",
        icon: "book",
        color: "#8BC34A", // Light green
        message: `Making progress! ${chapters} chapters and counting.`,
        isMotivational: false
      },
      {
        name: "Manga Fan",
        icon: "book-open",
        color: "#4CAF50", // Green
        message: `Nice reading! ${chapters} chapters completed!`,
        isMotivational: false
      },
      {
        name: "Manga Explorer",
        icon: "bookmark",
        color: "#009688", // Teal
        message: `Impressive! You've read ${chapters} chapters.`,
        isMotivational: false
      },
      {
        name: "Page Turner",
        icon: "scroll",
        color: "#00796B", // Darker teal
        message: `Amazing! ${chapters} chapters under your belt.`,
        isMotivational: false
      },
      {
        name: "Manga Master",
        icon: "book-reader",
        color: "#FF9800", // Orange
        message: `Outstanding! ${chapters} chapters read!`,
        isMotivational: false
      },
      {
        name: "Chapter Beast",
        icon: "crown",
        color: "#FFD700", // Gold
        message: `Legendary! You've conquered ${chapters} chapters!`,
        isMotivational: false
      }
    ];
    
    return mangaAchievements[adjustedTier];
  }
  
  // BALANCED USER WITH BOTH ANIME AND MANGA - SPECIAL ACHIEVEMENTS
  if (isBalancedUser) {
    // For balanced users, give special combined achievements
    // Higher tiers for users who engage with both types of content
    const adjustedTier = Math.min(5, combinedTier + activityTier);
    
    const combinedAchievements = [
      {
        name: "Media Enthusiast",
        icon: "globe",
        color: "#9C27B0", // Purple
        message: `A versatile fan! Enjoying ${contentText}.`,
        isMotivational: false
      },
      {
        name: "Story Lover",
        icon: "heart",
        color: "#E91E63", // Pink
        message: `You enjoy stories in all forms! ${contentText}.`,
        isMotivational: false
      },
      {
        name: "Media Connoisseur",
        icon: "glasses",
        color: "#9575CD", // Light purple
        message: `A refined taste in anime and manga! ${contentText}.`,
        isMotivational: false
      },
      {
        name: "Otaku Elite",
        icon: "space-shuttle",
        color: "#D500F9", // Purple accent
        message: `True otaku status achieved! ${contentText}.`,
        isMotivational: false
      },
      {
        name: "Anime & Manga Sage",
        icon: "gem",
        color: "#AA00FF", // Deep purple accent
        message: `Mastery of both worlds! ${contentText}.`,
        isMotivational: false
      },
      {
        name: "Ultimate Fan",
        icon: "dragon",
        color: "#6200EA", // Deep purple variant
        message: `The pinnacle of fandom! An incredible ${contentText}!`,
        isMotivational: false
      }
    ];
    
    return combinedAchievements[adjustedTier];
  }
  
  // Default achievements for users who don't fit the other categories
  const defaultTier = Math.min(5, combinedTier + Math.floor(activityTier / 2));
  
  const defaultAchievements = [
    {
      name: "Media Rookie",
      icon: "seedling",
      color: "#8BC34A", // Light green
      message: `Making progress! ${contentText} and counting.`,
      isMotivational: false
    },
    {
      name: "Anime & Manga Fan",
      icon: "book-reader",
      color: "#03A9F4", // Light blue
      message: `Nice work with ${contentText}!`,
      isMotivational: false
    },
    {
      name: "Story Explorer",
      icon: "compass",
      color: "#9C27B0", // Purple
      message: `Impressive! You've consumed ${contentText}.`,
      isMotivational: false
    },
    {
      name: "Page Turner",
      icon: "bookmark",
      color: "#FF9800", // Orange
      message: `Amazing! ${contentText} under your belt.`,
      isMotivational: false
    },
    {
      name: "Media Master",
      icon: "star",
      color: "#FF5722", // Deep orange
      message: `Outstanding! ${contentText} completed!`,
      isMotivational: false
    },
    {
      name: "Content Beast",
      icon: "crown",
      color: "#FFD700", // Gold
      message: `Legendary! You've conquered ${contentText}!`,
      isMotivational: false
    }
  ];
  
  return defaultAchievements[defaultTier];
};

// Generate celebratory or motivational message based on badge and activity
const getWelcomeMessage = (badge: any, name: string, todayChapters: number, streakDays: number) => {
  // If the badge has a specific message, use that
  if (badge.message) {
    return badge.message;
  }
  
  // Otherwise generate based on activity
  if (badge.isMotivational) {
    const motivationalMessages = [
      `Welcome back, ${name}! Ready to continue your journey?`,
      `Hey ${name}! Pick up where you left off?`,
      `${name}, your manga collection is waiting for you!`,
      `Missing your daily manga fix, ${name}?`,
      `The stories miss you, ${name}! Jump back in?`
    ];
    return motivationalMessages[Math.floor(Math.random() * motivationalMessages.length)];
  }
  
  // For active users
  if (todayChapters > 0) {
    const activeMessages = [
      `🎉 Great job today, ${name}! You've read ${todayChapters} chapters!`,
      `🌟 You're on fire, ${name}! ${todayChapters} chapters today!`,
      `📚 Awesome reading session, ${name}! ${todayChapters} chapters today!`
    ];
    return activeMessages[Math.floor(Math.random() * activeMessages.length)];
  }
  
  if (streakDays > 0) {
    const streakMessages = [
      `💫 Welcome back, ${name}! Keep your ${streakDays}-day streak going!`,
      `🔥 Day ${streakDays} of your streak, ${name}! What's next?`,
      `⚡ ${streakDays} days in a row! You're consistent, ${name}!`
    ];
    return streakMessages[Math.floor(Math.random() * streakMessages.length)];
  }
  
  // Default celebratory message
  const messages = [
    `Welcome back, ${name}! Ready for more stories?`,
    `Hey ${name}! What will you read today?`,
    `It's a great day for manga, ${name}!`,
    `Your library awaits, ${name}!`,
    `What adventure will you choose today, ${name}?`
  ];
  return messages[Math.floor(Math.random() * messages.length)];
};

// Calculate streak from user activities
const calculateStreak = (activities: UserActivity[]): number => {
  if (!activities || activities.length === 0) return 0;
  
  // Sort activities by date (newest first)
  const sortedActivities = [...activities].sort((a, b) => b.createdAt - a.createdAt);
  
  // Get today's date (truncated to day)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayTimestamp = today.getTime() / 1000; // Convert to seconds for AniList
  
  // Check if there's activity today
  const hasTodayActivity = sortedActivities.some(
    activity => activity.createdAt >= todayTimestamp
  );
  
  if (!hasTodayActivity) return 0; // Streak is broken if no activity today
  
  let streak = 1; // Start with today
  let currentDay = today;
  
  while (true) {
    // Move to previous day
    currentDay.setDate(currentDay.getDate() - 1);
    const dayStart = new Date(currentDay).setHours(0, 0, 0, 0) / 1000;
    const dayEnd = new Date(currentDay).setHours(23, 59, 59, 999) / 1000;
    
    // Check if there's activity on this day
    const hasDayActivity = sortedActivities.some(
      activity => activity.createdAt >= dayStart && activity.createdAt <= dayEnd
    );
    
    if (hasDayActivity) {
      streak++;
    } else {
      break; // Streak ends
    }
    
    // Limit streak calculation to avoid excessive processing
    if (streak >= 100) break;
  }
  
  return streak;
};

// Update WelcomeSection component
const WelcomeSection = memo(({ user, trendingMedia, currentlyWatching, currentlyReading, onViewAll, welcomeSectionType }: WelcomeSectionProps) => {
  const { currentTheme } = useTheme();
  const router = useRouter();
  const [userStats, setUserStats] = useState<AniListUserStats | null>(null);
  const [userActivities, setUserActivities] = useState<UserActivity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);
  const [anilistUserId, setAnilistUserId] = useState<string | undefined>();
  const [newlyUnlockedRewards, setNewlyUnlockedRewards] = useState<string[]>([]);
  const [dismissedRewards, setDismissedRewards] = useState<string[]>([]);
  const [showCongratulations, setShowCongratulations] = useState(false);
  const [nextGoalReward, setNextGoalReward] = useState<BadgeDisplay | null>(null);
  const [nextGoalProgress, setNextGoalProgress] = useState(0);
  const [currentGreeting, setCurrentGreeting] = useState<string>('');
  // Add a new state for modal visibility
  const [isModalVisible, setIsModalVisible] = useState(false);
  // Add to the WelcomeSection component state
  const [achievementFilter, setAchievementFilter] = useState<'all' | 'anime' | 'manga'>('all');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const filterAnim = useRef(new Animated.Value(0)).current;
  // Internal welcome section type preference (fallback to prop or default)
  const [internalWelcomeSectionType, setInternalWelcomeSectionType] = useState<WelcomeSectionType>(
    welcomeSectionType || WelcomeSectionType.ACHIEVEMENT
  );
  
  // Animation ref for congratulations
  const congratsAnim = useRef(new Animated.Value(0)).current;
  
  // Use our streak hook to get the current streak information
  const { 
    currentStreak, 
    longestStreak, 
    activityType,
    isLoading: isLoadingStreaks 
  } = useStreaks(user.id);
  
  // Add chevronRotateAnim reference
  const chevronRotateAnim = useRef(new Animated.Value(0)).current;
  
  // Add chevronRotate interpolation
  const chevronRotate = chevronRotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg']
  });
  
  // Add animation refs for modal
  const modalScaleAnim = useRef(new Animated.Value(0.8)).current;
  const modalOpacityAnim = useRef(new Animated.Value(0)).current;
  
  // Add refs for achievement animations
  const achievementAnimRefs = useRef<Animated.Value[]>([]).current;
  
  // For confetti animation
  const [confettiAnimations, setConfettiAnimations] = useState<{
    anim: Animated.Value;
    config: {
      size: number;
      color: string;
      left: string;
      rotate: string;
      delay: number;
      duration: number;
    };
  }[]>([]);
  
  // Generate confetti items when modal becomes visible
  useEffect(() => {
    if (isModalVisible) {
      const confettiCount = 30;
      const confettiColors = ['#FFC107', '#FF5722', '#4CAF50', '#2196F3', '#9C27B0', '#F44336'];
      
      // Generate confetti configurations
      const newConfettiAnimations = Array(confettiCount).fill(0).map(() => {
        const size = 8 + Math.random() * 15;
        return {
          anim: new Animated.Value(0),
          config: {
            size,
            color: confettiColors[Math.floor(Math.random() * confettiColors.length)],
            left: `${Math.random() * 100}%`,
            rotate: `${Math.random() * 360}deg`,
            delay: Math.random() * 500,
            duration: 2000 + Math.random() * 3000,
          }
        };
      });
      
      setConfettiAnimations(newConfettiAnimations);
      
      // Start animations
      newConfettiAnimations.forEach(item => {
        Animated.timing(item.anim, {
          toValue: 1,
          duration: item.config.duration,
          delay: item.config.delay,
          useNativeDriver: true,
          easing: Easing.linear
        }).start();
      });
    } else {
      // Reset confetti animations when modal is closed
      setConfettiAnimations([]);
    }
  }, [isModalVisible]);
  
  // API data fetch effect...
  useEffect(() => {
    // Fetch real user statistics and activities from AniList
    const fetchUserData = async () => {
      try {
        const token = await SecureStore.getItemAsync(STORAGE_KEY.AUTH_TOKEN);
        if (!token || !user.id) return;
        
        // Get the Supabase user ID for this AniList user
        const supabaseUser = await getAnilistUser(user.id);
        
        // Even if we don't get a Supabase user, try to check streaks with the AniList ID directly
        if (supabaseUser?.id) {
          setAnilistUserId(supabaseUser.id);
          
          // Check and update streaks (returned data handled by hook now)
          try {
            await checkAndUpdateStreaks(user.id, supabaseUser.id);
          } catch (streakError) {
            console.error('Error updating streaks with Supabase user:', streakError);
          }
          
          // Get all user rewards to display in the UI
          try {
            // Get all user rewards to display in the UI
            console.log('Fetching user rewards for display...');
            const userRewardsData = await getUserRewards(supabaseUser.id);
            
            if (userRewardsData && userRewardsData.length > 0) {
              console.log(`Found ${userRewardsData.length} badges for this user`);
              const allRewardIds = userRewardsData.map((ur: { reward_id: string }) => ur.reward_id);
              setNewlyUnlockedRewards(allRewardIds);
            } else {
              console.log('No badges found for this user');
              setNewlyUnlockedRewards([]);
            }
            
            // Process rewards based on AniList data to check for new ones
            const unlockedRewardIds = await processUserRewards(user.id, supabaseUser.id);
            
            // Check if any of these rewards are newly unlocked
            if (unlockedRewardIds.length > 0) {
              console.log(`User has ${unlockedRewardIds.length} newly unlocked rewards to show`);
              
              // Get previously viewed rewards from storage
              const viewedRewardsJson = await SecureStore.getItemAsync(VIEWED_REWARDS_KEY) || '[]';
              const viewedRewards = JSON.parse(viewedRewardsJson);
              
              // Filter to only truly new rewards the user hasn't seen
              const trulyNewRewards = unlockedRewardIds.filter((id: string) => !viewedRewards.includes(id));
              
              if (trulyNewRewards.length > 0) {
                console.log(`${trulyNewRewards.length} of these are truly new and unseen`);
                
                // Add these rewards to the viewed list and to the displayed rewards
                const updatedViewedRewards = [...viewedRewards, ...trulyNewRewards];
                await SecureStore.setItemAsync(VIEWED_REWARDS_KEY, JSON.stringify(updatedViewedRewards));
                
                // Add newly unlocked rewards to the existing ones
                setNewlyUnlockedRewards(prev => [...prev, ...trulyNewRewards]);
              }
            }
          } catch (error) {
            console.error('Error fetching user rewards:', error);
          }
        } else {
          // If we don't have a Supabase user, try to use AniList ID directly
          console.log('No Supabase user found, using AniList ID directly for streaks');
          try {
            await checkAndUpdateStreaks(user.id, user.id.toString());
          } catch (fallbackError) {
            console.error('Error updating streaks with AniList ID fallback:', fallbackError);
          }
        }
      } catch (error) {
        console.error('Error fetching user statistics:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchUserData();
  }, [user.id]);
  
  // Use our rewards hook to get badges with proper Supabase UUID
  const { 
    isLoading: isLoadingRewards, 
    getPrimaryBadge, 
    checkAndAssignRewards 
  } = useRewards(anilistUserId ? anilistUserId : null);
  
  // Animation values
  const messageAnim = useRef(new Animated.Value(0)).current; 
  const badgeAnim = useRef(new Animated.Value(0)).current;
  const statsAnim = useRef(new Animated.Value(0)).current;
  const totalsAnim = useRef(new Animated.Value(0)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  
  // Helper for featured media
  const getPreferredTitle = (media: MediaItem) => {
    const titleLanguage = user.titleLanguage.toLowerCase() as 'romaji' | 'english' | 'native';
    return media.title[titleLanguage] || media.title.userPreferred;
  };

  // Get featured trending media
  const featuredMedia = useMemo(() => {
    // Logic to select a featured media item...
    if (!trendingMedia || trendingMedia.length === 0) return null;
    
    // Get items with trending and score
    const filteredItems = trendingMedia?.filter(media => media.trending && media.averageScore);
    
    // Select and return featured media...
    const animeItems = filteredItems?.filter(media => media.type === 'ANIME');
    const mangaItems = filteredItems?.filter(media => media.type === 'MANGA');
    
    // Sort by trending
    const sortedAnime = animeItems?.sort((a, b) => (b.trending || 0) - (a.trending || 0));
    const sortedManga = mangaItems?.sort((a, b) => (b.trending || 0) - (a.trending || 0));
    
    // Combine top items
    const maxItems = 5;
    let topItems: MediaItem[] = [];
    
    if (animeItems?.length === 0) {
      topItems = sortedManga?.slice(0, maxItems) || [];
    } else if (mangaItems?.length === 0) {
      topItems = sortedAnime?.slice(0, maxItems) || [];
    } else {
      const topAnime = sortedAnime?.slice(0, 3) || [];
      const topManga = sortedManga?.slice(0, 2) || [];
      topItems = [...topAnime, ...topManga];
      
      if (topItems.length < maxItems) {
        const remainingSlots = maxItems - topItems.length;
        if (sortedAnime?.length > 3) {
          topItems = [...topItems, ...sortedAnime.slice(3, 3 + remainingSlots)];
        } else if (sortedManga?.length > 2) {
          topItems = [...topItems, ...sortedManga.slice(2, 2 + remainingSlots)];
        }
      }
    }
    
    const selected = topItems?.[Math.floor(Math.random() * Math.min(topItems?.length || 0, 5))];
    return selected;
  }, [trendingMedia, user.titleLanguage]);

  // Effect to evaluate rewards based on user stats
  useEffect(() => {
    const evaluateRewards = async () => {
      if (!userStats || !anilistUserId) return;
      
      // Get today's activities
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayTimestamp = today.getTime() / 1000;
      
      const todaysActivities = userActivities.filter(
        activity => activity.createdAt >= todayTimestamp
      );

      // Get this week's activities
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - 7);
      weekStart.setHours(0, 0, 0, 0);
      const weekStartTimestamp = weekStart.getTime() / 1000;
      
      const weeklyActivities = userActivities.filter(
        activity => activity.createdAt >= weekStartTimestamp
      );

      // Calculate actual stats from activities
      const rewardsUserStats = {
        // Weekly stats from actual activities
        weeklyEpisodes: weeklyActivities
          .filter(a => a.media.type === 'ANIME')
          .reduce((sum, a) => sum + (a.progress || 0), 0),
        weeklyChapters: weeklyActivities
          .filter(a => a.media.type === 'MANGA')
          .reduce((sum, a) => sum + (a.progress || 0), 0),
        
        // Today's activity tracking
        todayEpisodes: todaysActivities
          .filter(a => a.media.type === 'ANIME')
          .reduce((sum, a) => sum + (a.progress || 0), 0),
        todayChapters: todaysActivities
          .filter(a => a.media.type === 'MANGA')
          .reduce((sum, a) => sum + (a.progress || 0), 0),
        
        // Convert AniList ID to a proper UUID format for Supabase
        userId: `anilist_${anilistUserId}`,
        
        // General stats from AniList
        totalEpisodes: userStats.anime?.episodesWatched || 0,
        totalChapters: userStats.manga?.chaptersRead || 0,
        totalMinutes: userStats.anime?.minutesWatched || 0,
        
        // Streak data - now from the hook
        currentStreak: currentStreak,
        
        // Status counts
        ongoingAnime: userStats.anime?.statuses?.find(s => s.status === 'CURRENT')?.count || 0,
        ongoingManga: userStats.manga?.statuses?.find(s => s.status === 'CURRENT')?.count || 0,
        
        // Track when this update happened
        lastUpdated: new Date().toISOString()
      };
      
      try {
        // Update user stats and check for new rewards
      await checkAndAssignRewards(rewardsUserStats);
      } catch (error) {
        console.error('Failed to evaluate rewards:', error);
      }
    };
    
    evaluateRewards();
  }, [userStats, anilistUserId, userActivities, currentStreak, checkAndAssignRewards]);
  
  // Initial animations
  useEffect(() => {
    // Start initial animations in sequence
    const initialAnimationSequence = Animated.stagger(150, [
      // Fade in message
      Animated.timing(messageAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
        easing: Easing.out(Easing.quad),
      }),
      
      // Animate badge
      Animated.parallel([
        Animated.timing(badgeAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
          easing: Easing.elastic(1.2),
        }),
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
          easing: Easing.elastic(3),
        }),
      ]),
      
      // Fade in streak stat
      Animated.timing(statsAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
    ]);
    
    // Start initial animations
    initialAnimationSequence.start();
  }, []);
  
  // Add effect for handling the modal visibility via DeviceEventEmitter
  useEffect(() => {
    // Listen for the event to show the welcome modal
    const modalListener = DeviceEventEmitter.addListener('showWelcomeModal', () => {
      setIsModalVisible(true);
    
    // Animate chevron rotation
    Animated.timing(chevronRotateAnim, {
        toValue: 1,
      duration: 300,
      useNativeDriver: true,
      easing: Easing.inOut(Easing.quad),
    }).start();
    
      // Animate modal entry
      Animated.parallel([
        Animated.timing(modalScaleAnim, {
        toValue: 1,
          duration: 400,
          useNativeDriver: true,
          easing: Easing.out(Easing.back(1.7)),
        }),
        Animated.timing(modalOpacityAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        })
      ]).start();
      
      // Animate other stats
      const expandAnimations = Animated.stagger(100, [
        Animated.timing(statsAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(totalsAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
      ]);
      
      expandAnimations.start();
    });

    // Clean up event listener
    return () => {
      modalListener.remove();
    };
  }, []);
  
  // Modify toggleExpanded to emit the event instead of directly setting modal visibility
  const toggleExpanded = () => {
    // Emit event to show welcome modal
    DeviceEventEmitter.emit('showWelcomeModal');
  };

  // Add a function to close the modal with animation
  const closeModal = () => {
    // Animate modal exit
    Animated.parallel([
      Animated.timing(modalScaleAnim, {
        toValue: 0.8,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(modalOpacityAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      })
    ]).start(() => {
      setIsModalVisible(false);
    });
    
    // Reset chevron rotation
    Animated.timing(chevronRotateAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
      easing: Easing.inOut(Easing.quad),
    }).start();
  };
  
  // Calculate data from API response...
  const totalEpisodes = useMemo(() => 
    userStats?.anime?.episodesWatched || 
    currentlyWatching?.reduce((sum, item) => sum + (item.progress || 0), 0) || 0
  , [userStats, currentlyWatching]);

  const totalChapters = useMemo(() => 
    userStats?.manga?.chaptersRead || 
    currentlyReading?.reduce((sum, item) => sum + (item.progress || 0), 0) || 0
  , [userStats, currentlyReading]);
  
  // Calculate today's activity (both manga chapters AND anime episodes)
  const todayActivity = useMemo(() => {
    if (!userActivities || userActivities.length === 0) return 0;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTimestamp = today.getTime() / 1000;
    
    return userActivities
      .filter(activity => activity.createdAt >= todayTimestamp)
      .reduce((sum, activity) => sum + (activity.progress || 0), 0);
  }, [userActivities]);
  
  // Weekly progress calculation (both manga chapters AND anime episodes)
  const { weeklyProgress, weeklyGoal } = useMemo(() => {
    const weeklyGoal = 100; // Default goal
    
    if (!userActivities || userActivities.length === 0) 
      return { weeklyProgress: 0, weeklyGoal };
    
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 7);
    weekStart.setHours(0, 0, 0, 0);
    const weekStartTimestamp = weekStart.getTime() / 1000;
    
    const progress = userActivities
      .filter(activity => activity.createdAt >= weekStartTimestamp)
      .reduce((sum, activity) => sum + (activity.progress || 0), 0);
    
    return { weeklyProgress: progress, weeklyGoal };
  }, [userActivities]);
  
  // Get the current achievement badge based on user stats and activity
  const achievementBadge = useMemo(() => {
    if (!user) return {
      name: "New User",
      icon: "seedling",
      color: "#4CAF50",
      message: "Welcome to the app!",
      isMotivational: false
    };
    
    return getAchievementBadge(
      totalChapters, 
      totalEpisodes, 
      currentStreak, 
      todayActivity,
      weeklyProgress
    );
  }, [totalChapters, totalEpisodes, currentStreak, todayActivity, weeklyProgress, user]);

  // Get welcome message based on badge and activity
  const welcomeMessage = useMemo(() => 
    getWelcomeMessage(achievementBadge, user.name, todayActivity, currentStreak)
  , [achievementBadge, user.name, todayActivity, currentStreak]);

  // Computed rotation value based on animation
  const rotate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '20deg']
  });
  
  // Query for reward details - modified to handle the console.log debugging
  const { data: rewardDetails = [], refetch: refetchRewards } = useQuery({
    queryKey: ['rewards', newlyUnlockedRewards],
    queryFn: async () => {
      console.log("Fetching reward details via useQuery for IDs:", newlyUnlockedRewards);
      
      try {
        // Use direct REST API access which is working elsewhere in the app
        // Instead of Supabase client which is causing auth errors
        const restEndpoint = `${ENV.SUPABASE_URL.replace(/\/$/, '')}`;
        const apiKey = ENV.SUPABASE_ANON_KEY;
        
        // Fix the URL format to correctly use Supabase's REST API format
        // Build the in.() filter parameter correctly for POST database
        const url = `${restEndpoint}/rest/v1/rewards?apikey=${apiKey}`;
        
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          }
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error("Error fetching rewards with direct REST API:", {
            status: response.status,
            statusText: response.statusText,
            body: errorText
          });
          return [];
        }
        
        const allRewards = await response.json();
        
        // Now filter the rewards client-side to match our IDs
        const filteredRewards = allRewards.filter((reward: RewardDetail) => 
          newlyUnlockedRewards.includes(reward.id)
        );
        
        console.log(`Successfully fetched ${filteredRewards.length} rewards using direct REST API`);
        return filteredRewards || [];
      } catch (error) {
        console.error("Error in direct REST API call for rewards:", error);
        return [];
      }
    },
    enabled: newlyUnlockedRewards.length > 0,
    staleTime: 60000, // 1 minute
  });
  
  // Log reward details changes and trigger refetch if empty but should have data
  useEffect(() => {
    console.log("Effect triggered: rewardDetails length =", rewardDetails.length, "newlyUnlockedRewards length =", newlyUnlockedRewards.length);
    
    if (rewardDetails.length === 0 && newlyUnlockedRewards.length > 0) {
      console.log("Triggering manual refetch of rewards");
      refetchRewards();
    }
  }, [rewardDetails.length, newlyUnlockedRewards.length, refetchRewards]);
  
  // New effect to determine next achievement goal
  useEffect(() => {
    const determineNextGoal = async () => {
      if (!anilistUserId) return;
      
      try {
        // Fetch all available rewards
        const { data: allRewards } = await supabase
          .from('rewards')
          .select('*');
        
        // Fetch user's unlocked rewards
        const { data: userRewards } = await supabase
          .from('user_rewards')
          .select('reward_id')
          .eq('user_id', anilistUserId);
        
        if (!allRewards || !userRewards) return;
        
        // Get IDs of unlocked rewards
        const unlockedRewardIds = userRewards.map(ur => ur.reward_id);
        
        // Filter to only get locked rewards
        const lockedRewards = allRewards.filter(
          reward => !unlockedRewardIds.includes(reward.id)
        );
        
        if (lockedRewards.length === 0) return;
        
        // Select a random locked reward as the next goal
        const randomIndex = Math.floor(Math.random() * lockedRewards.length);
        const selectedGoal = lockedRewards[randomIndex];
        
        // Determine current progress towards this goal
        let progress = 0;
        
        switch (selectedGoal.name) {
          case 'Binge Master':
            // Watch 50+ episodes in a week
            progress = Math.min(1, (userStats?.anime?.episodesWatched || 0) / 50);
            break;
          case 'Power Reader':
            // Read 100+ chapters in a week
            progress = Math.min(1, (userStats?.manga?.chaptersRead || 0) / 100);
            break;
          case 'Cliffhanger Addict':
            // Read 3+ ongoing manga series
            const ongoingManga = userStats?.manga?.statuses?.find(s => s.status === 'CURRENT')?.count || 0;
            progress = Math.min(1, ongoingManga / 3);
            break;
          case 'Otaku Mode: ON':
            // Log 1000+ total minutes
            progress = Math.min(1, (userStats?.anime?.minutesWatched || 0) / 1000);
            break;
          // Add more cases for other achievements
          default:
            progress = 0.1; // Default to show some progress
        }
        
        setNextGoalReward(selectedGoal);
        setNextGoalProgress(progress);
      } catch (error) {
        console.error('Error determining next goal:', error);
      }
    };
    
    determineNextGoal();
  }, [anilistUserId, userStats]);
  
  // New effect to show congratulations animation when new rewards are unlocked
  useEffect(() => {
    // Only show the achievement popup if we're in achievement mode
    if (newlyUnlockedRewards.length > 0 && internalWelcomeSectionType === WelcomeSectionType.ACHIEVEMENT) {
      setShowCongratulations(true);
      
      // Start the animation
      Animated.sequence([
        Animated.timing(congratsAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
          easing: Easing.elastic(1.2),
        }),
        Animated.delay(3000), // Show for 3 seconds
        Animated.timing(congratsAnim, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        })
      ]).start(() => {
        setShowCongratulations(false);
      });
    }
  }, [newlyUnlockedRewards, internalWelcomeSectionType]);
  
  // Update the function to dismiss a reward to also store in SecureStore
  const dismissReward = async (rewardId: string) => {
    try {
      // Add to local state for immediate UI update
      setDismissedRewards([...dismissedRewards, rewardId]);
      
      // Get previously viewed rewards from storage
      const viewedRewardsJson = await SecureStore.getItemAsync(VIEWED_REWARDS_KEY) || '[]';
      const viewedRewards = JSON.parse(viewedRewardsJson);
      
      // Make sure this reward is marked as viewed
      if (!viewedRewards.includes(rewardId)) {
        const updatedViewedRewards = [...viewedRewards, rewardId];
        await SecureStore.setItemAsync(VIEWED_REWARDS_KEY, JSON.stringify(updatedViewedRewards));
      }
    } catch (error) {
      console.error('Error dismissing reward:', error);
    }
  };
  
  // Handle navigation to achievements settings
  const navigateToAchievements = () => {
    router.push('/appsettings/achievementsettings');
  };
  
  // Handle navigation to find new goal
  const findNewGoal = async () => {
    if (!anilistUserId) return;
    
    try {
      // Same logic as determineNextGoal but force refresh the UI
      const { data: allRewards } = await supabase
        .from('rewards')
        .select('*');
      
      const { data: userRewards } = await supabase
        .from('user_rewards')
        .select('reward_id')
        .eq('user_id', anilistUserId);
      
      if (!allRewards || !userRewards) return;
      
      const unlockedRewardIds = userRewards.map(ur => ur.reward_id);
      const lockedRewards = allRewards.filter(
        reward => !unlockedRewardIds.includes(reward.id)
      );
      
      if (lockedRewards.length === 0) {
        Alert.alert("No more goals", "You've unlocked all available achievements!");
        return;
      }
      
      // Find a different goal than the current one
      let newGoals = lockedRewards;
      if (nextGoalReward) {
        newGoals = lockedRewards.filter(reward => reward.id !== nextGoalReward.id);
      }
      
      // If all are unlocked except current one, just keep current
      if (newGoals.length === 0) {
        Alert.alert("Last goal remaining", "This is your final achievement to unlock!");
        return;
      }
      
      const randomIndex = Math.floor(Math.random() * newGoals.length);
      const selectedGoal = newGoals[randomIndex];
      
      // Determine current progress
      let progress = 0;
      
      // Similar logic as before for progress calculation
      // ... (same as above progress calculation)
      
      setNextGoalReward(selectedGoal);
      setNextGoalProgress(progress);
      
      // Add animation for changing goal
      LayoutAnimation.configureNext(
        LayoutAnimation.create(300, LayoutAnimation.Types.easeInEaseOut, LayoutAnimation.Properties.opacity)
      );
      
    } catch (error) {
      console.error('Error finding new goal:', error);
    }
  };

  // Render a section for newly unlocked rewards
  const renderNewlyUnlockedRewards = () => {
    if (!anilistUserId) {
      return (
        <View style={{ alignItems: 'center', padding: 20 }}>
          <Text style={{ color: currentTheme.colors.textSecondary }}>
            Please sign in to view your achievements
          </Text>
        </View>
      );
    }
    
    return (
      <View style={{ flex: 1 }}>
        <AchievementsList userId={anilistUserId} theme={currentTheme} />
      </View>
    );
  };
  
  // Render next goal progress
  const renderAchievementGoals = () => {
    if (!nextGoalReward) return null;
    
    // Calculate progress percentage and state message
    const progressPercent = Math.round(nextGoalProgress * 100);
    let progressState = "Just getting started!";
    
    if (progressPercent >= 100) {
      progressState = "✅ Completed!";
    } else if (progressPercent >= 75) {
      progressState = "🔥 Almost there!";
    } else if (progressPercent >= 50) {
      progressState = "Halfway there!";
    } else if (progressPercent >= 25) {
      progressState = "Making progress!";
    }
    
    return (
      <View style={styles.achievementGoalsContainer}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: currentTheme.colors.text }]}>
            Achievement Goals
          </Text>
          <TouchableOpacity 
            style={styles.skipGoalButton}
            onPress={findNewGoal}
            activeOpacity={0.7}
          >
            <FontAwesome5 
              name="sync-alt" 
              size={12} 
              color={currentTheme.colors.primary} 
            />
            <Text style={[styles.skipGoalButtonText, { color: currentTheme.colors.primary }]}>
              Find New Goal
            </Text>
          </TouchableOpacity>
        </View>
        
        <Animated.View style={[
          styles.goalCard,
          { transform: [{ scale: new Animated.Value(1) }] } // For future animations
        ]}>
          {/* Goal Icon with Progress Ring */}
          <View style={styles.goalIconContainer}>
            <View style={[
              styles.goalProgressRing, 
              { 
                borderColor: BADGE_COLORS[nextGoalReward.name] || BADGE_COLORS.default,
                // Trick: Use borderWidth and transparent border for incomplete portion of ring
                borderTopColor: progressPercent < 25 ? 'transparent' : undefined,
                borderRightColor: progressPercent < 50 ? 'transparent' : undefined,
                borderBottomColor: progressPercent < 75 ? 'transparent' : undefined,
                borderLeftColor: progressPercent < 100 ? 'transparent' : undefined,
              }
            ]} />
            <View style={[
              styles.goalBadge, 
              { backgroundColor: BADGE_COLORS[nextGoalReward.name] || BADGE_COLORS.default }
            ]}>
              <FontAwesome5 
                name={BADGE_ICONS[nextGoalReward.name] || BADGE_ICONS.default} 
                size={20} 
                color="#fff" 
                solid 
              />
            </View>
          </View>
          
          <View style={styles.goalInfo}>
            <Text style={[styles.goalName, { color: currentTheme.colors.text }]}>
              {nextGoalReward.name}
            </Text>
            <Text style={[styles.goalDescription, { color: currentTheme.colors.textSecondary }]}>
              {nextGoalReward.description}
            </Text>
            
            <View style={styles.progressContainer}>
              <Animated.View 
                style={[
                  styles.progressBar, 
                  { 
                    backgroundColor: BADGE_COLORS[nextGoalReward.name] || BADGE_COLORS.default,
                    width: `${nextGoalProgress * 100}%`
                  }
                ]} 
              />
            </View>
            
            <Text style={[
              styles.progressState, 
              { 
                color: progressPercent >= 75 ? BADGE_COLORS[nextGoalReward.name] || BADGE_COLORS.default : currentTheme.colors.textSecondary,
                fontWeight: progressPercent >= 75 ? '700' : '500'
              }
            ]}>
              {progressState}
            </Text>
          </View>
        </Animated.View>
      </View>
    );
  };
  
  // Render congratulations animation
  const renderCongratulations = () => {
    // Don't show achievements popup if using basic welcome section
    if (!showCongratulations || internalWelcomeSectionType === WelcomeSectionType.BASIC) return null;
    
    return (
      <Animated.View 
        style={[
          styles.congratsContainer,
          {
            opacity: congratsAnim,
            transform: [
              { scale: congratsAnim.interpolate({ 
                inputRange: [0, 0.5, 1], 
                outputRange: [0.5, 1.1, 1] 
              }) },
              { translateY: congratsAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [20, 0]
              })}
            ]
          }
        ]}
      >
        <View style={styles.congratsContent}>
          <FontAwesome5 name="trophy" size={28} color="#FFC107" style={styles.congratsIcon} />
          <Text style={styles.congratsText}>
            🎉 Achievement Unlocked!
          </Text>
          <Text style={styles.congratsSubtext}>
            Tap to dismiss
          </Text>
        </View>
      </Animated.View>
    );
  };

  // Add a total stats section that always shows below the achievement goals
  const renderTotalStats = () => {
    return (
      <View style={styles.totalStatsContainer}>
        <View style={styles.totalStatsRow}>
          <View style={styles.totalStat}>
            <Text style={[styles.totalStatValue, { color: currentTheme.colors.text }]}>
              {totalEpisodes}
            </Text>
            <Text style={[styles.totalStatLabel, { color: currentTheme.colors.textSecondary }]}>
              Episodes watched
            </Text>
          </View>
          
          <View style={styles.totalStat}>
            <Text style={[styles.totalStatValue, { color: currentTheme.colors.text }]}>
              {totalChapters}
            </Text>
            <Text style={[styles.totalStatLabel, { color: currentTheme.colors.textSecondary }]}>
              Chapters read
            </Text>
          </View>
        </View>
      </View>
    );
  };

  // Add a useEffect to load the greeting on component mount
  useEffect(() => {
    const loadGreeting = async () => {
      const greeting = await getTimeBasedGreeting(user.name);
      setCurrentGreeting(greeting);
    };
    
    loadGreeting();
  }, [user.name]);

  // Get default greeting message based on time of day
  const getDefaultGreeting = (name: string) => {
    const hour = new Date().getHours();
    
    if (hour < 12) {
      return `Good morning, ${name}!`;
    } else if (hour < 18) {
      return `Good afternoon, ${name}!`;
    } else {
      return `Good evening, ${name}!`;
    }
  };

  // Render confetti
  const renderConfetti = () => {
    return (
      <View style={styles.confettiContainer}>
        {confettiAnimations.map((item, index) => (
          <Animated.View 
            key={`confetti-${index}`}
            style={{
              position: 'absolute',
              top: -item.config.size,
              left: item.config.left as any, // Cast to any to avoid type error
              width: item.config.size,
              height: item.config.size,
              backgroundColor: item.config.color,
              borderRadius: Math.random() > 0.5 ? item.config.size/2 : 0,
              transform: [
                { 
                  translateY: item.anim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, 500]
                  })
                },
                { translateX: item.anim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, (Math.random() - 0.5) * 200]
                })},
                { rotate: item.anim.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0deg', item.config.rotate]
                }) }
              ],
              opacity: item.anim.interpolate({
                inputRange: [0, 0.7, 1],
                outputRange: [1, 1, 0]
              })
            }}
          />
        ))}
      </View>
    );
  };

  // The modal content styling
  const styles = StyleSheet.create({
    container: {
      marginHorizontal: -16,
      marginBottom: 16, // Reduced from 24
      marginTop: Platform.OS === 'ios' ? 16 : 24, // Reduced top margin
    },
    gradient: {
      padding: 16, // Reduced from 20
      paddingTop: 8, // Reduced from 12
    },
    mainContainer: {
      backgroundColor: currentTheme.colors.primary + '10', // Lighter background
      borderRadius: 16, // Smaller radius
      overflow: 'hidden',
      borderWidth: internalWelcomeSectionType === WelcomeSectionType.ACHIEVEMENT ? 1 : 0,
      borderColor: currentTheme.colors.primary + '20', // Softer border
    },
    collapsibleHeader: {
      padding: 16, // Reduced from 20
      flexDirection: 'row',
      alignItems: 'center',
    },
    collapsedContent: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
    },
    badgeSmall: {
      width: 42, // Smaller from 50
      height: 42, // Smaller from 50
      borderRadius: 21, // Half of width/height
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 14, // Reduced from 16
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 }, // Reduced shadow
      shadowOpacity: 0.15, // Reduced from 0.2
      shadowRadius: 2, // Reduced from 3
      elevation: 2, // Reduced from 3
    },
    messageContainer: {
      flex: 1,
      justifyContent: 'center',
    },
    messageText: {
      fontSize: 16,
      fontWeight: '600', // Reduced from 700
      marginBottom: 2, // Reduced from 4
    },
    goalIndicator: {
      fontSize: 12, 
      marginBottom: 3,
      fontWeight: '500',
    },
    streakText: {
      fontSize: 13, // Reduced from 14
      fontWeight: '500', // Reduced from 600
      flexDirection: 'row',
      alignItems: 'center',
    },
    chevronIcon: {
      marginLeft: 'auto',
      flexDirection: 'row',
      alignItems: 'center',
    },
    iconButton: {
      width: 36,
      height: 36,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 4,
    },
    actionButtons: {
      marginLeft: 'auto',
      flexDirection: 'row',
      alignItems: 'center',
    },
    expandedContent: {
      padding: 20,
      paddingTop: 0,
    },
    badgeSection: {
      alignItems: 'center',
      marginBottom: 24,
    },
    badgeLarge: {
      width: 70,
      height: 70,
      borderRadius: 35,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 10,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 5,
      elevation: 8,
    },
    badgeTitle: {
      fontSize: 16,
      fontWeight: '700',
      textAlign: 'center',
      marginTop: 4,
    },
    statsRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      backgroundColor: currentTheme.colors.surface + '60', // More transparent
      borderRadius: 12, // Reduced from 16
      padding: 12, // Reduced from 15
      marginHorizontal: 16, // Add horizontal margin
      marginBottom: 16, // Reduced from 24
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 }, // Reduced shadow
      shadowOpacity: 0.08, // Reduced from 0.1
      shadowRadius: 2, // Reduced from 3
      elevation: 1, // Reduced from 2
    },
    statItem: {
      alignItems: 'center',
      flex: 1,
    },
    statValue: {
      fontSize: 20, // Reduced from 22
      fontWeight: '600', // Reduced from 700
      marginBottom: 2, // Reduced from 4
    },
    statLabel: {
      fontSize: 11, // Reduced from 12
      fontWeight: '500',
      opacity: 0.8,
    },
    iconContainer: {
      marginBottom: 4, // Reduced from 6
    },
    totalsRow: {
      flexDirection: 'row',
      backgroundColor: currentTheme.colors.surface + '90',
      borderRadius: 14,
      overflow: 'hidden',
    },
    totalItem: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 16,
    },
    totalValue: {
      fontSize: 22,
      fontWeight: '800',
      marginBottom: 4,
    },
    totalLabel: {
      fontSize: 12,
      fontWeight: '500',
      opacity: 0.7,
    },
    divider: {
      width: StyleSheet.hairlineWidth,
      backgroundColor: currentTheme.colors.border + '60',
    },
    loadingContainer: {
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    loadingText: {
      fontSize: 14,
      marginTop: 8,
    },
    newRewardsSection: {
      marginBottom: 24,
    },
    // Modal styles
    modalContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: 'rgba(0, 0, 0, 0.85)',
    },
    modalContent: {
      width: '90%',
      maxHeight: '85%',
      backgroundColor: currentTheme.colors.surface,
      borderRadius: 24,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: currentTheme.colors.primary + '30',
      ...Platform.select({
        ios: {
          shadowColor: currentTheme.colors.primary,
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.3,
          shadowRadius: 12,
        },
        android: {
          elevation: 10,
        },
      }),
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      borderBottomWidth: 1,
      borderBottomColor: currentTheme.colors.border,
      padding: 20,
    },
    modalTitle: {
      fontSize: 24,
      fontWeight: '800',
      color: currentTheme.colors.text,
    },
    closeButton: {
      padding: 8,
      borderRadius: 20,
      backgroundColor: currentTheme.colors.surface + '80',
    },
    modalScrollView: {
      paddingBottom: 20,
    },
    modalSectionTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: currentTheme.colors.text,
      marginBottom: 10,
      padding: 15,
      paddingBottom: 0,
    },
    
    // Achievement Goals styles
    achievementGoalsContainer: {
      marginBottom: 28,
    },
    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
    },
    sectionTitle: {
      fontSize: 20,
      fontWeight: '800',
      color: currentTheme.colors.text,
    },
    sectionSubtitle: {
      fontSize: 14,
      color: currentTheme.colors.textSecondary,
      fontWeight: '500',
    },
    skipGoalButton: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: 16,
      backgroundColor: currentTheme.colors.surface,
      borderWidth: 1,
      borderColor: currentTheme.colors.primary + '40',
    },
    skipGoalButtonText: {
      fontSize: 12,
      fontWeight: '600',
      marginLeft: 6,
      color: currentTheme.colors.primary,
    },
    goalCard: {
      flexDirection: 'row',
      backgroundColor: currentTheme.colors.surface + '80',
      borderRadius: 16,
      padding: 18,
      alignItems: 'center',
      ...Platform.select({
        ios: {
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.15,
          shadowRadius: 8,
        },
        android: {
          elevation: 4,
        },
      }),
    },
    goalIconContainer: {
      position: 'relative',
      width: 60,
      height: 60,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 18,
    },
    goalProgressRing: {
      position: 'absolute',
      width: 58,
      height: 58,
      borderRadius: 30,
      borderWidth: 3,
      borderColor: 'transparent',
    },
    goalBadge: {
      width: 48,
      height: 48,
      borderRadius: 24,
      justifyContent: 'center',
      alignItems: 'center',
      ...Platform.select({
        ios: {
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.3,
          shadowRadius: 4,
        },
        android: {
          elevation: 4,
        },
      }),
    },
    goalInfo: {
      flex: 1,
    },
    goalName: {
      fontSize: 18,
      fontWeight: '700',
      marginBottom: 4,
    },
    goalDescription: {
      fontSize: 14,
      marginBottom: 10,
      lineHeight: 18,
    },
    progressContainer: {
      height: 8,
      backgroundColor: currentTheme.colors.border + '50',
      borderRadius: 4,
      overflow: 'hidden',
      marginBottom: 8,
    },
    progressBar: {
      height: '100%',
      borderRadius: 4,
    },
    progressState: {
      fontSize: 13,
      alignSelf: 'flex-start',
      marginTop: 2,
    },
    
    // Total Stats styles
    totalStatsContainer: {
      marginBottom: 30,
    },
    totalStatsRow: {
      flexDirection: 'row',
      backgroundColor: currentTheme.colors.primary + '10',
      borderRadius: 16,
      padding: 18,
      justifyContent: 'space-around',
      borderWidth: 1,
      borderColor: currentTheme.colors.primary + '20',
    },
    totalStat: {
      alignItems: 'center',
    },
    totalStatValue: {
      fontSize: 28,
      fontWeight: '800',
      marginBottom: 4,
      color: currentTheme.colors.text,
    },
    totalStatLabel: {
      fontSize: 14,
      color: currentTheme.colors.textSecondary,
    },
    
    // Rewards styles
    newRewardsTitle: {
      fontSize: 22,
      fontWeight: '800',
      marginBottom: 0, // Changed from 18 to 0 since we now have a header container
      color: currentTheme.colors.text,
    },
    rewardTypeContainer: {
      marginBottom: 16,
    },
    rewardTypeTitle: {
      fontSize: 14,
      fontWeight: '600',
      marginBottom: 8,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    rewardCardContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: currentTheme.colors.surface + '90',
      borderRadius: 16,
      marginBottom: 12,
      padding: 14,
      borderWidth: 1,
      borderColor: currentTheme.colors.border + '30',
      ...Platform.select({
        ios: {
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 4,
        },
        android: {
          elevation: 2,
        },
      }),
    },
    rewardIconContainer: {
      width: 48,
      height: 48,
      borderRadius: 24,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 14,
      ...Platform.select({
        ios: {
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.2,
          shadowRadius: 3,
        },
        android: {
          elevation: 3,
        },
      }),
    },
    rewardTextContainer: {
      flex: 1,
    },
    rewardName: {
      fontSize: 16,
      fontWeight: '700',
      marginBottom: 2,
    },
    rewardDescription: {
      fontSize: 13,
      marginBottom: 4,
      lineHeight: 17,
    },
    rewardUnlockDate: {
      fontSize: 11,
      color: '#FFD700',
      fontWeight: '600',
    },
    dismissButton: {
      padding: 8,
      borderRadius: 16,
    },
    deleteButton: {
      backgroundColor: '#f44336',
      justifyContent: 'center',
      alignItems: 'center',
      width: 80,
      height: '100%',
      borderTopRightRadius: 16,
      borderBottomRightRadius: 16,
    },
    
    // View All button
    viewAllButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: currentTheme.colors.primary,
      paddingVertical: 12,
      paddingHorizontal: 20,
      borderRadius: 24,
      marginTop: 12,
      ...Platform.select({
        ios: {
          shadowColor: currentTheme.colors.primary,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 6,
        },
        android: {
          elevation: 4,
        },
      }),
    },
    viewAllButtonText: {
      color: '#fff',
      fontWeight: '700',
      fontSize: 16,
      marginRight: 8,
    },
    
    // Congratulations animation
    congratsContainer: {
      position: 'absolute',
      top: '30%',
      left: 20,
      right: 20,
      backgroundColor: 'rgba(33, 33, 33, 0.95)',
      borderRadius: 20,
      overflow: 'hidden',
      zIndex: 1000,
      borderWidth: 2,
      borderColor: '#FFC107',
      ...Platform.select({
        ios: {
          shadowColor: "#FFC107",
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.5,
          shadowRadius: 12,
        },
        android: {
          elevation: 12,
        },
      }),
    },
    congratsContent: {
      padding: 20,
      alignItems: 'center',
    },
    congratsIcon: {
      marginBottom: 12,
    },
    congratsText: {
      fontSize: 20,
      fontWeight: '800',
      color: '#fff',
      textAlign: 'center',
      marginBottom: 6,
    },
    congratsSubtext: {
      fontSize: 14,
      color: 'rgba(255, 255, 255, 0.8)',
      textAlign: 'center',
    },
    
    // Confetti container
    confettiContainer: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      pointerEvents: 'none',
    },
    // Filter styles
    filterContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginLeft: 'auto',
      position: 'relative', // Add this
    },
    filterLabel: {
      fontSize: 14,
      color: currentTheme.colors.textSecondary,
      fontWeight: '600',
      marginRight: 8,
    },
    filterButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between', 
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: currentTheme.colors.border + '80',
    },
    filterButtonText: {
      fontSize: 14,
      fontWeight: '500',
      marginRight: 4,
    },
    filterIcon: {
      marginLeft: 2,
    },
    achievementsHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 18,
    },
    dropdownMenu: {
      position: 'absolute',
      top: 40,
      right: 0,
      width: 160,
      backgroundColor: currentTheme.colors.surface,
      borderRadius: 12,
      paddingVertical: 8,
      zIndex: 1000,
      borderWidth: 1,
      borderColor: currentTheme.colors.border,
      ...Platform.select({
        ios: {
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.2,
          shadowRadius: 6,
        },
        android: {
          elevation: 6,
        },
      }),
    },
    dropdownItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 10,
      paddingHorizontal: 16,
    },
    dropdownItemActive: {
      backgroundColor: currentTheme.colors.primary + '10',
    },
    dropdownItemText: {
      fontSize: 15,
      fontWeight: '500',
    },
    dropdownDivider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: currentTheme.colors.border + '80',
      marginVertical: 2,
    },
    dropdownOverlay: {
      position: 'absolute',
      top: -1000,
      left: -1000,
      right: -1000,
      bottom: -1000,
      backgroundColor: 'transparent',
      zIndex: 999,
    },
    tabContainer: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      paddingVertical: 10,
      borderBottomWidth: 2,
      borderBottomColor: currentTheme.colors.primary,
    },
    tabButton: {
      paddingHorizontal: 20,
      paddingVertical: 5,
    },
    tabText: {
      fontSize: 16,
      fontWeight: '500',
    },
    questTrackerContainer: {
      marginBottom: 20,
    },
    questHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 10,
    },
    randomButton: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 5,
      paddingHorizontal: 10,
      backgroundColor: currentTheme.colors.primary,
      borderRadius: 16,
    },
    randomButtonText: {
      color: '#fff',
      fontSize: 14,
      fontWeight: '600',
      marginLeft: 5,
    },
    emptyQuestCard: {
      padding: 15,
      borderWidth: 2,
      borderColor: currentTheme.colors.border,
      borderRadius: 12,
      alignItems: 'center',
    },
    emptyQuestText: {
      fontSize: 14,
      color: currentTheme.colors.textSecondary,
      textAlign: 'center',
    },
    achievementCard: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 10,
      borderWidth: 1,
      borderColor: currentTheme.colors.border,
      borderRadius: 8,
      marginBottom: 10,
    },
    achievementIconContainer: {
      width: 40,
      height: 40,
      borderRadius: 20,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 10,
    },
    achievementInfo: {
      flex: 1,
    },
    achievementName: {
      fontSize: 16,
      fontWeight: '600',
      marginBottom: 2,
    },
    achievementDescription: {
      fontSize: 14,
      color: currentTheme.colors.textSecondary,
    },
    achievementDate: {
      fontSize: 12,
      color: currentTheme.colors.textSecondary,
    },
    modalBody: {
      flex: 1,
      width: '100%',
    },
  });

  // Add useEffect to handle outside clicks using a better approach
  // Add this at the beginning of the WelcomeSection component
  useEffect(() => {
    if (isFilterOpen) {
      const handleBackPress = () => {
        setIsFilterOpen(false);
        return true;
      };
      
      // Add back button handler for Android
      BackHandler.addEventListener('hardwareBackPress', handleBackPress);
      
      // Auto-close dropdown after 5 seconds if no selection
      const timer = setTimeout(() => {
        setIsFilterOpen(false);
      }, 5000);
      
      return () => {
        BackHandler.removeEventListener('hardwareBackPress', handleBackPress);
        clearTimeout(timer);
      };
    }
  }, [isFilterOpen]);

  // Check stored welcome section preference
  useEffect(() => {
    const loadWelcomeSectionPreference = async () => {
      try {
        const storedPreference = await SecureStore.getItemAsync(WELCOME_SECTION_STORAGE_KEY);
        if (storedPreference) {
          const preference = JSON.parse(storedPreference);
          if (preference && preference.type) {
            setInternalWelcomeSectionType(preference.type);
          }
        }
      } catch (error) {
        console.error("Error loading welcome section preference:", error);
      }
    };
    
    loadWelcomeSectionPreference();
  }, []);

  // Add useEffect for debugging
  useEffect(() => {
    console.log('All reward details:', rewardDetails);
    console.log('Reward details structure:', rewardDetails.length > 0 ? Object.keys(rewardDetails[0]) : 'No rewards');
    console.log('Dismissed rewards:', dismissedRewards);
    console.log('Newly unlocked rewards:', newlyUnlockedRewards);
    
    // Log each achievement separately for more detail
    rewardDetails.forEach((reward: RewardDetail, index: number) => {
      console.log(`Reward ${index}:`, reward);
    });
  }, [rewardDetails, dismissedRewards, newlyUnlockedRewards]);

  // Add an effect to call the refetch function
  useEffect(() => {
    if (newlyUnlockedRewards.length > 0 && rewardDetails.length === 0) {
      console.log("Triggering manual refetch of reward details");
      refetchRewards();
    }
  }, [newlyUnlockedRewards.length, rewardDetails.length, refetchRewards]);

  return (
    <View style={styles.container}>
      {renderCongratulations()}
      
      <View style={styles.gradient}>
        <View style={[
          styles.mainContainer, 
          internalWelcomeSectionType === WelcomeSectionType.BASIC && {
            backgroundColor: 'transparent', 
            borderWidth: 0
          }
        ]}>
          {/* Basic Welcome Section */}
          {internalWelcomeSectionType === WelcomeSectionType.BASIC && (
            <View style={[styles.collapsibleHeader, { 
              backgroundColor: 'transparent', 
              borderWidth: 0,
              paddingTop: 8,
              paddingBottom: 12,
            }]}>
              <View style={styles.collapsedContent}>
                {/* Simple greeting message */}
                <View style={styles.messageContainer}>
                  <Text 
                    style={[
                      styles.messageText, 
                      { 
                        color: currentTheme.colors.text,
                        fontSize: 28,
                        fontWeight: '800',
                        letterSpacing: -0.5,
                        marginBottom: 6,
                      }
                    ]}
                    numberOfLines={2}
                  >
                    {currentGreeting || getDefaultGreeting(user.name)}
                  </Text>
                </View>
              </View>
            </View>
          )}

          {/* Achievement Welcome Section */}
          {internalWelcomeSectionType === WelcomeSectionType.ACHIEVEMENT && (
            <View style={styles.collapsibleHeader}>
              <View style={styles.collapsedContent}>
                {/* Simple greeting message with coming soon notification */}
                <View style={styles.messageContainer}>
                  <Text 
                    style={[
                      styles.messageText, 
                      { 
                        color: currentTheme.colors.text,
                        fontSize: 18,
                        fontWeight: '700',
                        marginBottom: 8
                      }
                    ]}
                    numberOfLines={2}
                  >
                    {getDefaultGreeting(user.name)}
                  </Text>
                  
                  <View style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: currentTheme.colors.surface,
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderRadius: 12,
                    marginTop: 8
                  }}>
                    <FontAwesome5 name="trophy" size={18} color={currentTheme.colors.primary} solid style={{marginRight: 8}} />
                    <Text style={{color: currentTheme.colors.textSecondary, flex: 1}}>
                      Achievement tracking coming soon! Check back for updates.
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          )}
          
          {/* Rest of the component... */}
        </View>
      </View>
      
      {/* Modal for expanded content */}
      <Modal
        visible={isModalVisible}
        transparent={true}
        animationType="none" // Use our custom animation
        onRequestClose={closeModal}
      >
        <TouchableOpacity 
          style={styles.modalContainer}
          activeOpacity={1}
          onPress={closeModal} // Close modal when tapping the background
        >
          {isModalVisible && renderConfetti()}
          
          <Animated.View 
            style={[
              styles.modalContent,
              {
                opacity: modalOpacityAnim,
                transform: [{ scale: modalScaleAnim }]
              }
            ]}
            // Prevent touches on the background from closing the modal
            onStartShouldSetResponder={() => true}
            onTouchEnd={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Achievements</Text>
              <TouchableOpacity style={styles.closeButton} onPress={closeModal}>
                <FontAwesome5 name="times" size={20} color={currentTheme.colors.text} />
              </TouchableOpacity>
            </View>
              
            {/* Modal Content - Single View with AchievementsList */}
            <View style={styles.modalBody}>
              {anilistUserId ? (
                <AchievementsList 
                  userId={anilistUserId} 
                  theme={currentTheme} 
                  newlyUnlockedRewards={newlyUnlockedRewards}
                />
              ) : (
                <View style={{ alignItems: 'center', padding: 20 }}>
                  <Text style={{ color: currentTheme.colors.textSecondary }}>
                    Please sign in to view your achievements
                  </Text>
                </View>
              )}
            </View>
          </Animated.View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
});

WelcomeSection.displayName = 'WelcomeSection';

export default WelcomeSection; 