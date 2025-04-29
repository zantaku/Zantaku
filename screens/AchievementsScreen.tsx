import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { useTheme } from '../hooks/useTheme';
import { useUserStreak } from '../hooks/useUserStreak';
import { useRewards } from '../hooks/useRewards';
import UserStreakCard from '../components/UserStreakCard';
import AchievementsDisplay from '../components/AchievementsDisplay';
import * as SecureStore from 'expo-secure-store';
import { STORAGE_KEY } from '../constants/auth';
import { getAnilistUser } from '../lib/supabase';

interface UserData {
  id: number;
  name: string;
}

const AchievementsScreen: React.FC = () => {
  const { currentTheme } = useTheme();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({
    episodesWatched: 0,
    chaptersRead: 0
  });
  
  // Load user data from secure storage
  useEffect(() => {
    async function loadUserData() {
      try {
        setIsLoading(true);
        
        // Get AniList user data from secure storage
        const userDataStr = await SecureStore.getItemAsync(STORAGE_KEY.USER_DATA);
        if (userDataStr) {
          const parsedData = JSON.parse(userDataStr);
          setUserData({
            id: parsedData.id,
            name: parsedData.name
          });
          
          // Get Supabase user ID
          if (parsedData.id) {
            const supabaseUser = await getAnilistUser(parsedData.id);
            if (supabaseUser) {
              setUserId(supabaseUser.id);
            }
          }
        }
        
        // Load some mock stats (in a real app, you'd fetch these from AniList or your backend)
        setStats({
          episodesWatched: 637,
          chaptersRead: 6281
        });
      } catch (error) {
        console.error('Error loading user data:', error);
      } finally {
        setIsLoading(false);
      }
    }
    
    loadUserData();
  }, []);
  
  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: currentTheme.colors.background }]}>
        <ActivityIndicator size="large" color={currentTheme.colors.primary} />
        <Text style={[styles.loadingText, { color: currentTheme.colors.textSecondary }]}>
          Loading your achievements...
        </Text>
      </View>
    );
  }
  
  return (
    <ScrollView 
      style={[styles.container, { backgroundColor: currentTheme.colors.background }]}
      contentContainerStyle={styles.content}
    >
      <Text style={[styles.header, { color: currentTheme.colors.text }]}>
        Achievements
      </Text>
      
      <View style={styles.statsContainer}>
        <View style={[styles.statsCard, { backgroundColor: currentTheme.colors.surface }]}>
          <Text style={[styles.statsTitle, { color: currentTheme.colors.textSecondary }]}>
            Episodes watched
          </Text>
          <Text style={[styles.statsValue, { color: currentTheme.colors.text }]}>
            {stats.episodesWatched}
          </Text>
        </View>
        
        <View style={[styles.statsCard, { backgroundColor: currentTheme.colors.surface }]}>
          <Text style={[styles.statsTitle, { color: currentTheme.colors.textSecondary }]}>
            Chapters read
          </Text>
          <Text style={[styles.statsValue, { color: currentTheme.colors.text }]}>
            {stats.chaptersRead}
          </Text>
        </View>
      </View>
      
      {userData && (
        <UserStreakCard 
          anilistId={userData.id} 
          todayActivity={true} 
        />
      )}
      
      <View style={styles.achievementsContainer}>
        <AchievementsDisplay 
          userId={userId || undefined} 
          anilistId={userData?.id} 
        />
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
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
  header: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 24,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  statsCard: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    marginHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
    elevation: 2,
  },
  statsTitle: {
    fontSize: 14,
    marginBottom: 8,
  },
  statsValue: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  achievementsContainer: {
    marginTop: 24,
    flex: 1,
  }
});

export default AchievementsScreen; 