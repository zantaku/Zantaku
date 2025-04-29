import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { useUserStreak } from '../hooks/useUserStreak';

interface UserStreakCardProps {
  anilistId: number | null;
  todayActivity?: boolean;
  onPress?: () => void;
}

const UserStreakCard: React.FC<UserStreakCardProps> = ({ 
  anilistId, 
  todayActivity = false,
  onPress 
}) => {
  const { currentTheme } = useTheme();
  const { streakData, isLoading, checkStreak } = useUserStreak(anilistId);
  
  useEffect(() => {
    if (anilistId) {
      // Check streak when component mounts
      checkStreak(todayActivity);
    }
  }, [anilistId, todayActivity]);
  
  const renderStreakFlame = () => {
    const streakCount = streakData?.current_streak || 0;
    let flameColor = '#9E9E9E'; // Gray for no streak
    let flameSize = 24;
    
    if (streakCount > 0) {
      // Start with orange
      flameColor = '#FF9800';
      
      if (streakCount >= 7) {
        // After a week, bright red
        flameColor = '#FF5722';
      }
      
      if (streakCount >= 30) {
        // After a month, blue flame
        flameColor = '#2196F3';
      }
      
      if (streakCount >= 100) {
        // After 100 days, purple flame
        flameColor = '#9C27B0';
        flameSize = 28; // Slightly bigger
      }
    }
    
    return (
      <FontAwesome5
        name="fire"
        size={flameSize}
        color={flameColor}
        style={styles.flameIcon}
      />
    );
  };
  
  return (
    <TouchableOpacity
      style={[
        styles.container,
        { backgroundColor: currentTheme.colors.surface }
      ]}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={onPress ? 0.7 : 1}
    >
      {renderStreakFlame()}
      
      <View style={styles.textContainer}>
        <Text style={[styles.count, { color: currentTheme.colors.text }]}>
          {isLoading ? '...' : streakData?.current_streak || 0}
        </Text>
        <Text style={[styles.label, { color: currentTheme.colors.textSecondary }]}>
          Current Streak
        </Text>
      </View>
      
      <View style={styles.divider} />
      
      <View style={styles.textContainer}>
        <Text style={[styles.count, { color: currentTheme.colors.text }]}>
          {todayActivity ? '1' : '0'}
        </Text>
        <Text style={[styles.label, { color: currentTheme.colors.textSecondary }]}>
          Watched Today
        </Text>
      </View>
      
      <View style={styles.divider} />
      
      <View style={styles.textContainer}>
        <Text style={[styles.count, { color: currentTheme.colors.text }]}>
          {userRewards()}
        </Text>
        <Text style={[styles.label, { color: currentTheme.colors.textSecondary }]}>
          Badges Earned
        </Text>
      </View>
    </TouchableOpacity>
  );
  
  function userRewards() {
    // This would normally fetch the count of user rewards from the backend
    // For now, let's return a placeholder
    return isLoading ? '...' : streakData?.longest_streak ? Math.floor(streakData.longest_streak / 7) : 0;
  }
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 8,
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  flameIcon: {
    marginRight: 16,
  },
  textContainer: {
    flex: 1,
    alignItems: 'center',
  },
  count: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  label: {
    fontSize: 12,
    fontWeight: '500',
  },
  divider: {
    width: 1,
    height: '80%',
    backgroundColor: 'rgba(0,0,0,0.1)',
    marginHorizontal: 8,
  }
});

export default UserStreakCard; 