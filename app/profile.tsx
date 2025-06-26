import React, { useEffect, useState, useRef } from 'react';
import { View, Text, Image, ScrollView, StyleSheet, Pressable, useColorScheme, TouchableOpacity, ActivityIndicator, Animated } from 'react-native';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { useAuth } from '../hooks/useAuth';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../lib/supabase';
import * as SecureStore from 'expo-secure-store';
import { STORAGE_KEY } from '../constants/auth';
import { useStreaks } from '../hooks/useStreaks';
import { rateLimitedAxios } from '../utils/api';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// PROPER Theme System - Clean & Readable
const tokens = {
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24 },
  radius: { sm: 8, md: 12, lg: 16, xl: 20, xxl: 24 },
  colors: {
    light: {
      bg: '#FFFFFF',
      card: '#F8F9FA',
      elevated: '#FFFFFF',
      text: '#1A1A1A',
      subtext: '#6B7280',
      border: '#E5E7EB',
      accent: '#3B82F6',
      success: '#10B981',
      warning: '#F59E0B',
      error: '#EF4444',
      purple: '#8B5CF6',
    },
    dark: {
      bg: '#0A0A0A',
      card: '#1A1A1A',
      elevated: '#262626',
      text: '#FFFFFF',
      subtext: '#9CA3AF',
      border: '#374151',
      accent: '#60A5FA',
      success: '#34D399',
      warning: '#FBBF24',
      error: '#F87171',
      purple: '#A78BFA',
    },
  },
  shadows: {
    light: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 8,
      elevation: 2,
    },
    medium: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08,
      shadowRadius: 12,
      elevation: 4,
    },
  },
};

// Types
interface AniListUser {
      id: number;
      name: string;
  about?: string | null;
  avatar?: { large?: string; medium?: string };
  bannerImage?: string | null;
  favourites?: {
    anime: { nodes: any[] };
    manga: { nodes: any[] };
    characters: { nodes: any[] };
  };
  statistics: {
    anime: { count: number; meanScore: number; minutesWatched: number; statuses: Array<{ status: string; count: number }> };
    manga: { count: number; meanScore: number; chaptersRead: number; statuses: Array<{ status: string; count: number }> };
  };
}

interface UserStats {
  totalAnime: number;
  totalManga: number;
  daysWatched: number;
  chaptersRead: number;
  animeStatusDistribution: { CURRENT: number; COMPLETED: number; PLANNING: number; DROPPED: number; PAUSED: number };
  mangaStatusDistribution: { CURRENT: number; COMPLETED: number; PLANNING: number; DROPPED: number; PAUSED: number };
}

// Clean TopBar Component
const TopBar = ({ title, leftIcon, onLeftPress, rightIcon, onRightPress, colors }: any) => {
  const insets = useSafeAreaInsets();
  
  return (
    <View style={[
      styles.topBar, 
      { 
        backgroundColor: colors.bg,
        paddingTop: insets.top > 0 ? insets.top + 8 : 16,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
      }
    ]}>
      <TouchableOpacity 
        style={[styles.topBarButton, { backgroundColor: colors.card }]} 
        onPress={onLeftPress} 
        activeOpacity={0.7}
      >
        <MaterialCommunityIcons name={leftIcon} size={22} color={colors.text} />
      </TouchableOpacity>
      
      <Text style={[styles.topBarTitle, { color: colors.text }]} numberOfLines={1}>{title}</Text>
      
      {rightIcon ? (
        <TouchableOpacity 
          style={[styles.topBarButton, { backgroundColor: colors.card }]} 
          onPress={onRightPress} 
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons name={rightIcon} size={22} color={colors.text} />
        </TouchableOpacity>
      ) : (
        <View style={styles.topBarButton} />
      )}
    </View>
  );
};

// Clean Header Component
const CleanHeader = ({ userProfile, isVerified, currentStreak, colors }: any) => {
  const getUserLevel = () => {
    const total = (userProfile?.statistics?.anime?.count || 0) + (userProfile?.statistics?.manga?.count || 0);
    if (total >= 1000) return { level: 'Legend', color: colors.warning, emoji: '👑' };
    if (total >= 500) return { level: 'Master', color: colors.purple, emoji: '🥈' };
    if (total >= 200) return { level: 'Expert', color: colors.accent, emoji: '🥉' };
    if (total >= 50) return { level: 'Fan', color: colors.success, emoji: '⭐' };
    return { level: 'Newbie', color: colors.subtext, emoji: '🌱' };
  };

  const level = getUserLevel();

  return (
    <View style={[
      styles.headerCard, 
      { backgroundColor: colors.elevated },
      tokens.shadows.medium
    ]}>
      {userProfile?.bannerImage && (
        <Image 
          source={{ uri: userProfile.bannerImage }} 
          style={styles.bannerImage} 
          resizeMode="cover" 
        />
      )}
      
      <View style={styles.headerContent}>
        <View style={styles.avatarRow}>
          <View style={styles.avatarContainer}>
            <Image
              source={{ uri: userProfile?.avatar?.large || 'https://placekitten.com/200/200' }}
              style={[styles.avatar, { borderColor: colors.border }]}
            />
            <View style={[styles.levelBadge, { backgroundColor: level.color }]}>
              <Text style={styles.levelEmoji}>{level.emoji}</Text>
            </View>
          </View>
          
          <View style={styles.userInfo}>
            <View style={styles.nameRow}>
              <Text style={[styles.username, { color: colors.text }]}>
                {userProfile?.name || 'Username'}
              </Text>
              {isVerified && (
                <View style={styles.verifiedBadgeIcon}>
                  <MaterialCommunityIcons name="check-circle" size={20} color="#1DA1F2" />
                </View>
              )}
            </View>
            
            <View style={styles.tagsRow}>
              {currentStreak > 0 && (
                <View style={[styles.streakTag, { backgroundColor: colors.warning + '15' }]}>
                  <MaterialCommunityIcons name="fire" size={14} color={colors.warning} />
                  <Text style={[styles.streakText, { color: colors.warning }]}>{currentStreak} day streak</Text>
                </View>
              )}
            </View>
          </View>
        </View>
      </View>
    </View>
  );
};

// Clean Stat Pill Component
const StatPill = ({ icon, label, value, color, colors }: any) => (
  <View style={[
    styles.statPill,
    { backgroundColor: colors.elevated },
    tokens.shadows.light
  ]}>
    <View style={[styles.statIconContainer, { backgroundColor: color + '15' }]}>
      <MaterialCommunityIcons name={icon} size={24} color={color} />
    </View>
    <View>
      <Text style={[styles.statValue, { color: colors.text }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: colors.subtext }]}>{label.toUpperCase()}</Text>
    </View>
  </View>
);

// Clean Section Card Component
const SectionCard = ({ title, icon, children, action, colors }: any) => (
  <View style={[
    styles.sectionCard, 
    { backgroundColor: colors.elevated },
    tokens.shadows.light
  ]}>
    <View style={styles.sectionHeader}>
      <View style={styles.sectionTitleRow}>
        <View style={[styles.sectionIconContainer, { backgroundColor: colors.accent + '15' }]}>
          <MaterialCommunityIcons name={icon} size={24} color={colors.accent} />
        </View>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>{title}</Text>
      </View>
      {action}
    </View>
    {children}
  </View>
);

// Clean Favorite Card Component
const FavoriteCard = ({ item, type, onPress, colors }: any) => {
  const imageUrl = type === 'characters' ? item.image?.medium : item.coverImage?.medium;
  const displayName = type === 'characters' ? item.name?.full : item.title?.userPreferred;

  return (
    <TouchableOpacity
      style={styles.favoriteCardContainer}
      onPress={() => onPress?.(item)}
      activeOpacity={0.8}
    >
      <View style={[
        styles.favoriteImageContainer, 
        { backgroundColor: colors.card },
        tokens.shadows.light
      ]}>
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={styles.favoriteImage} resizeMode="cover" />
        ) : (
          <View style={styles.favoritePlaceholder}>
            <MaterialCommunityIcons name="image" size={32} color={colors.subtext} />
          </View>
        )}
        <View style={[styles.favoriteHeart, { backgroundColor: colors.error + 'CC' }]}>
          <MaterialCommunityIcons name="heart" size={14} color="#FFFFFF" />
        </View>
      </View>
      <Text style={[styles.favoriteName, { color: colors.text }]} numberOfLines={2}>
        {displayName}
      </Text>
    </TouchableOpacity>
  );
};

// Clean Status Grid Component
const StatusGrid = ({ title, data, type, colors }: any) => {
  const statusConfig = {
    CURRENT: { 
      label: type === 'anime' ? 'Watching' : 'Reading', 
      icon: 'play-circle', 
      color: colors.accent 
    },
    COMPLETED: { 
      label: 'Completed', 
      icon: 'check-circle', 
      color: colors.success 
    },
    PLANNING: { 
      label: 'Planning', 
      icon: 'calendar-plus', 
      color: colors.purple 
    },
    DROPPED: { 
      label: 'Dropped', 
      icon: 'close-circle', 
      color: colors.error 
    },
  };

  return (
    <SectionCard title={title} icon={type === 'anime' ? 'television' : 'book-open-variant'} colors={colors}>
      <View style={styles.statusGrid}>
        {Object.entries(statusConfig).map(([key, config]) => (
          <TouchableOpacity key={key} style={styles.statusCardContainer} activeOpacity={0.8}>
            <View style={[
              styles.statusCard, 
              { backgroundColor: config.color + '10', borderColor: config.color + '20' },
              tokens.shadows.light
            ]}>
              <View style={styles.statusIconContainer}>
                <MaterialCommunityIcons name={config.icon as any} size={32} color={config.color} />
              </View>
              <Text style={[styles.statusValue, { color: colors.text }]}>
                {data[key as keyof typeof data] || 0}
              </Text>
              <Text style={[styles.statusLabel, { color: colors.subtext }]}>
                {config.label}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </SectionCard>
  );
};

// Main Profile Screen
const ProfileScreen = () => {
  const colorScheme = useColorScheme();
  const { user, signIn, signOut } = useAuth();
  const [userProfile, setUserProfile] = useState<AniListUser | null>(null);
  const [stats, setStats] = useState<UserStats>({
    totalAnime: 0, totalManga: 0, daysWatched: 0, chaptersRead: 0,
    animeStatusDistribution: { CURRENT: 0, COMPLETED: 0, PLANNING: 0, DROPPED: 0, PAUSED: 0 },
    mangaStatusDistribution: { CURRENT: 0, COMPLETED: 0, PLANNING: 0, DROPPED: 0, PAUSED: 0 },
  });
  const isDark = colorScheme === 'dark';
  const colors = isDark ? tokens.colors.dark : tokens.colors.light;
  const router = useRouter();
  const params = useLocalSearchParams();
  const targetUserId = params.userId ? parseInt(params.userId as string) : user?.id;
  const [isVerified, setIsVerified] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const { currentStreak } = useStreaks(targetUserId);
  
  const fetchUserProfile = async () => {
    if (!targetUserId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const token = await SecureStore.getItemAsync(STORAGE_KEY.AUTH_TOKEN);
      
      if (!token && targetUserId === user?.id) {
        setError('Please sign in to view your profile');
        setLoading(false);
        return;
      }

      const query = `
            query ($userId: Int) {
              User(id: $userId) {
            id name about(asHtml: true)
            avatar { large medium }
                bannerImage
                favourites {
              anime { nodes { id title { userPreferred } coverImage { medium } } }
              manga { nodes { id title { userPreferred } coverImage { medium } } }
              characters { nodes { id name { full } image { medium } } }
                }
                statistics {
              anime { count meanScore minutesWatched statuses { status count } }
              manga { count meanScore chaptersRead statuses { status count } }
            }
          }
        }
      `;

      const response = await rateLimitedAxios(query, { userId: targetUserId }, token || undefined);

      if (response.data?.User) {
        setUserProfile(response.data.User);
        
        const animeStats = response.data.User.statistics.anime;
        const mangaStats = response.data.User.statistics.manga;
        
        const animeStatusDist: any = {};
        const mangaStatusDist: any = {};
        
        animeStats.statuses.forEach(({ status, count }: any) => {
          animeStatusDist[status] = count;
        });
        
        mangaStats.statuses.forEach(({ status, count }: any) => {
          mangaStatusDist[status] = count;
        });

        setStats({
          totalAnime: animeStats.count,
          totalManga: mangaStats.count,
          daysWatched: Math.round(animeStats.minutesWatched / 1440),
          chaptersRead: mangaStats.chaptersRead,
          animeStatusDistribution: {
            CURRENT: animeStatusDist.CURRENT || 0,
            COMPLETED: animeStatusDist.COMPLETED || 0,
            PLANNING: animeStatusDist.PLANNING || 0,
            DROPPED: animeStatusDist.DROPPED || 0,
            PAUSED: animeStatusDist.PAUSED || 0,
          },
          mangaStatusDistribution: {
            CURRENT: mangaStatusDist.CURRENT || 0,
            COMPLETED: mangaStatusDist.COMPLETED || 0,
            PLANNING: mangaStatusDist.PLANNING || 0,
            DROPPED: mangaStatusDist.DROPPED || 0,
            PAUSED: mangaStatusDist.PAUSED || 0,
          },
        });
      }
    } catch (error: any) {
      console.error('Error fetching user profile:', error);
      setError('Failed to load profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUserProfile();
    Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
  }, [targetUserId]);

  useEffect(() => {
    const checkVerificationStatus = async () => {
      if (!targetUserId) {
        setIsVerified(false);
        return;
      }
      
      try {
        const { data, error } = await supabase
          .from('anilist_users')
          .select('is_verified')
          .eq('anilist_id', targetUserId)
          .single();
        
        if (!error && data) {
          setIsVerified(data.is_verified || false);
        } else {
          setIsVerified(false);
        }
      } catch (error) {
        console.error('Error checking verification status:', error);
        setIsVerified(false);
      }
    };

    checkVerificationStatus();
  }, [targetUserId]);

  if (!targetUserId) {
    return (
      <View style={[styles.container, { backgroundColor: colors.bg }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <TopBar title="Profile" leftIcon="chevron-left" onLeftPress={() => router.back()} colors={colors} />
        <View style={styles.centerContainer}>
          <View style={[styles.emptyIconContainer, { backgroundColor: colors.card }]}>
            <MaterialCommunityIcons name="account-circle" size={64} color={colors.subtext} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>Sign in to AniList</Text>
          <Text style={[styles.emptySubtitle, { color: colors.subtext }]}>Track your anime and manga progress</Text>
          <TouchableOpacity 
            style={[styles.signInButton, { backgroundColor: colors.accent }]} 
            onPress={signIn}
          >
            <Text style={styles.signInButtonText}>Sign In</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.bg }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <TopBar title="Profile" leftIcon="chevron-left" onLeftPress={() => router.back()} colors={colors} />
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={[styles.loadingText, { color: colors.subtext }]}>Loading profile...</Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, { backgroundColor: colors.bg }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <TopBar title="Profile" leftIcon="chevron-left" onLeftPress={() => router.back()} colors={colors} />
        <View style={styles.centerContainer}>
          <View style={[styles.emptyIconContainer, { backgroundColor: colors.card }]}>
            <MaterialCommunityIcons name="alert-circle" size={64} color={colors.error} />
          </View>
          <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
          <TouchableOpacity 
            style={[styles.retryButton, { backgroundColor: colors.accent }]} 
            onPress={fetchUserProfile}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }
      
  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <TopBar 
        title="Profile" 
        leftIcon="chevron-left" 
        onLeftPress={() => router.back()} 
        colors={colors} 
      />
      
      <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
        <CleanHeader 
          userProfile={userProfile}
          isVerified={isVerified}
          currentStreak={currentStreak}
          colors={colors}
        />

        <Animated.View style={[styles.contentContainer, { opacity: fadeAnim }]}>
          {/* Clean Stats Pills Row */}
          <View style={styles.statsRow}>
            <StatPill 
              icon="television" 
              label="Anime" 
              value={stats.totalAnime} 
              color={colors.accent}
              colors={colors} 
            />
            <StatPill 
              icon="clock-outline" 
              label="Days" 
              value={stats.daysWatched} 
              color={colors.success}
              colors={colors} 
            />
          </View>
          
          <View style={styles.statsRow}>
            <StatPill 
              icon="book-open-variant" 
              label="Manga" 
              value={stats.totalManga} 
              color={colors.purple}
              colors={colors} 
            />
            <StatPill 
              icon="bookmark-outline" 
              label="Chapters" 
              value={`${(stats.chaptersRead / 1000).toFixed(1)}k`} 
              color={colors.warning}
              colors={colors} 
            />
          </View>
        
          {/* About Section */}
          {userProfile?.about && (
            <SectionCard title="About" icon="account-heart" colors={colors}>
              <View style={styles.aboutContainer}>
                <Text style={[styles.aboutText, { color: colors.text }]}>
                  {userProfile.about.replace(/<[^>]*>/g, '')}
                </Text>
              </View>
            </SectionCard>
          )}

          {/* Favorite Anime */}
          {userProfile?.favourites?.anime?.nodes && userProfile.favourites.anime.nodes.length > 0 && (
            <SectionCard 
              title="Favorite Anime" 
              icon="television"
              action={
                <View style={[styles.countBadge, { backgroundColor: colors.accent + '15' }]}>
                  <Text style={[styles.countText, { color: colors.accent }]}>
                    {userProfile.favourites.anime.nodes.length}
                  </Text>
                </View>
              }
              colors={colors}
            >
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.favoritesContainer}>
                {userProfile.favourites.anime.nodes.map((item: any, index: number) => (
                  <FavoriteCard
                    key={index}
                    item={item}
                    type="anime"
                    colors={colors}
                    onPress={(item: any) => router.push({ pathname: '/anime/[id]', params: { id: item.id } })}
                  />
                ))}
              </ScrollView>
            </SectionCard>
          )}

          {/* Favorite Manga */}
          {userProfile?.favourites?.manga?.nodes && userProfile.favourites.manga.nodes.length > 0 && (
            <SectionCard 
              title="Favorite Manga" 
              icon="book-open-variant"
              action={
                <View style={[styles.countBadge, { backgroundColor: colors.purple + '15' }]}>
                  <Text style={[styles.countText, { color: colors.purple }]}>
                    {userProfile.favourites.manga.nodes.length}
                  </Text>
                </View>
              }
              colors={colors}
            >
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.favoritesContainer}>
                {userProfile.favourites.manga.nodes.map((item: any, index: number) => (
                  <FavoriteCard
                    key={index}
                    item={item}
                    type="manga"
                    colors={colors}
                    onPress={(item: any) => router.push({ pathname: '/manga/[id]', params: { id: item.id } })}
                  />
                ))}
              </ScrollView>
            </SectionCard>
          )}

          {/* Favorite Characters */}
          {userProfile?.favourites?.characters?.nodes && userProfile.favourites.characters.nodes.length > 0 && (
            <SectionCard 
              title="Favorite Characters" 
              icon="account-group"
              action={
                <View style={[styles.countBadge, { backgroundColor: colors.success + '15' }]}>
                  <Text style={[styles.countText, { color: colors.success }]}>
                    {userProfile.favourites.characters.nodes.length}
                  </Text>
                </View>
              }
              colors={colors}
            >
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.favoritesContainer}>
                {userProfile.favourites.characters.nodes.map((item: any, index: number) => (
                  <FavoriteCard 
                    key={index} 
                    item={item} 
                    type="characters" 
                    colors={colors}
                    onPress={() => {}} 
                  />
                ))}
              </ScrollView>
            </SectionCard>
          )}

          {/* Clean Status Distributions */}
          <StatusGrid title="Anime Status Distribution" data={stats.animeStatusDistribution} type="anime" colors={colors} />
          <StatusGrid title="Manga Status Distribution" data={stats.mangaStatusDistribution} type="manga" colors={colors} />

        </Animated.View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  
  // Clean TopBar
  topBar: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    paddingHorizontal: tokens.spacing.lg, 
    paddingBottom: tokens.spacing.md,
  },
  topBarButton: { 
    width: 44, 
    height: 44, 
    justifyContent: 'center', 
    alignItems: 'center', 
    borderRadius: tokens.radius.md,
  },
  topBarTitle: { 
    fontSize: 20, 
    fontWeight: '700', 
    flex: 1, 
    textAlign: 'center',
    marginHorizontal: tokens.spacing.md,
  },
  
  // Empty States
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: tokens.spacing.xl },
  emptyIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: tokens.spacing.lg,
  },
  emptyTitle: { fontSize: 24, fontWeight: '700', marginBottom: tokens.spacing.sm, textAlign: 'center' },
  emptySubtitle: { fontSize: 16, textAlign: 'center', marginBottom: tokens.spacing.xl },
  signInButton: { 
    borderRadius: tokens.radius.md, 
    paddingHorizontal: tokens.spacing.xl, 
    paddingVertical: tokens.spacing.lg 
  },
  signInButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600', textAlign: 'center' },
  loadingText: { fontSize: 16, marginTop: tokens.spacing.lg },
  errorText: { fontSize: 16, textAlign: 'center', marginTop: tokens.spacing.lg, marginBottom: tokens.spacing.xl },
  retryButton: { 
    borderRadius: tokens.radius.md, 
    paddingHorizontal: tokens.spacing.xl, 
    paddingVertical: tokens.spacing.lg 
  },
  retryButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600', textAlign: 'center' },
  
  // Clean Header
  headerCard: { 
    borderRadius: tokens.radius.xl, 
    margin: tokens.spacing.lg, 
    marginTop: tokens.spacing.sm, 
    overflow: 'hidden', 
    position: 'relative', 
    minHeight: 140,
  },
  bannerImage: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, opacity: 0.3 },
  headerContent: { padding: tokens.spacing.xl, position: 'relative', zIndex: 1 },
  avatarRow: { flexDirection: 'row', alignItems: 'center' },
  avatarContainer: { position: 'relative', marginRight: tokens.spacing.lg },
  avatar: { width: 80, height: 80, borderRadius: 40, borderWidth: 3 },
  levelBadge: { 
    position: 'absolute', 
    right: -4, 
    bottom: -4, 
    width: 24, 
    height: 24, 
    borderRadius: 12, 
    justifyContent: 'center', 
    alignItems: 'center', 
    borderWidth: 2, 
    borderColor: '#FFFFFF' 
  },
  levelEmoji: { fontSize: 12 },
  userInfo: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', marginBottom: tokens.spacing.xs },
  username: { fontSize: 20, fontWeight: '700', marginRight: tokens.spacing.sm },
  verifiedBadge: {
    borderRadius: tokens.radius.sm,
    padding: 4,
  },
  verifiedBadgeIcon: {
    marginLeft: 6,
  },
  tagsRow: { flexDirection: 'row', gap: tokens.spacing.sm },
  verifiedTag: { 
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: tokens.spacing.sm, 
    paddingVertical: 4, 
    borderRadius: tokens.radius.sm,
  },
  verifiedText: { fontSize: 12, fontWeight: '600' },
  levelTag: { 
    paddingHorizontal: tokens.spacing.sm, 
    paddingVertical: 4, 
    borderRadius: tokens.radius.sm,
  },
  levelText: { fontSize: 12, fontWeight: '600' },
  streakTag: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 4, 
    paddingHorizontal: tokens.spacing.sm, 
    paddingVertical: 4, 
    borderRadius: tokens.radius.sm,
  },
  streakText: { fontSize: 12, fontWeight: '600' },
  
  // Content
  contentContainer: { padding: tokens.spacing.lg, paddingTop: 0, gap: tokens.spacing.xl },
  statsRow: { flexDirection: 'row', gap: tokens.spacing.md },
  
  // Clean Stat Pills
  statPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: tokens.spacing.lg,
    borderRadius: tokens.radius.lg,
    marginBottom: 12,
  },
  statIconContainer: { 
    width: 40, 
    height: 40, 
    borderRadius: 20, 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginRight: 12,
  },
  statValue: { fontSize: 18, fontWeight: '700' },
  statLabel: { fontSize: 11, letterSpacing: 0.5, fontWeight: '500' },
  
  // Clean Sections
  sectionCard: { 
    borderRadius: tokens.radius.lg, 
    padding: tokens.spacing.lg,
  },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: tokens.spacing.md },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center' },
  sectionIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: tokens.spacing.sm,
  },
  sectionTitle: { fontSize: 18, fontWeight: '600' },
  countBadge: { paddingHorizontal: tokens.spacing.sm, paddingVertical: 4, borderRadius: tokens.radius.sm },
  countText: { fontSize: 12, fontWeight: '600' },
  
  // About
  aboutContainer: { padding: tokens.spacing.sm },
  aboutText: { fontSize: 15, lineHeight: 22, fontStyle: 'italic' },
  
  // Clean Favorites
  favoritesContainer: { paddingLeft: 2 },
  favoriteCardContainer: { width: 120, marginRight: 12 },
  favoriteImageContainer: { 
    width: 120, 
    height: 180, 
    borderRadius: tokens.radius.md, 
    overflow: 'hidden', 
    marginBottom: 6,
    position: 'relative',
  },
  favoriteImage: { width: '100%', height: '100%' },
  favoritePlaceholder: { 
    width: '100%', 
    height: '100%', 
    justifyContent: 'center', 
    alignItems: 'center',
  },
  favoriteHeart: { 
    position: 'absolute', 
    top: 8, 
    right: 8, 
    borderRadius: 12, 
    width: 24, 
    height: 24, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  favoriteName: { 
    fontSize: 13, 
    fontWeight: '500', 
    textAlign: 'center',
  },
  
  // Clean Status Grid
  statusGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spacing.sm },
  statusCardContainer: { flex: 0.48 },
  statusCard: { 
    padding: tokens.spacing.lg, 
    borderRadius: tokens.radius.md, 
    alignItems: 'center', 
    minHeight: 100, 
    justifyContent: 'center',
    borderWidth: 1,
  },
  statusIconContainer: { marginBottom: tokens.spacing.sm },
  statusValue: { 
    fontSize: 24, 
    fontWeight: '700', 
    lineHeight: 28, 
    textAlign: 'center', 
    marginBottom: 4,
  },
  statusLabel: { 
    fontSize: 12, 
    fontWeight: '500', 
    textAlign: 'center', 
    textTransform: 'uppercase', 
    letterSpacing: 0.5, 
  },
});

export default ProfileScreen; 