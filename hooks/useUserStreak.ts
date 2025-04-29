import { useState, useEffect } from 'react';
import { getUserStreakData, updateUserStreak, checkAndUpdateStreak, UserStreak } from '../lib/userStreaks';

export const useUserStreak = (anilistId: number | null) => {
  const [streakData, setStreakData] = useState<UserStreak | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  // Load streak data from API
  useEffect(() => {
    if (anilistId === null) return;

    async function loadStreakData() {
      setIsLoading(true);
      setError(null);
      try {
        const data = await getUserStreakData(anilistId);
        setStreakData(data);
      } catch (err) {
        console.error('Error loading streak data:', err);
        setError('Failed to load streak data');
      } finally {
        setIsLoading(false);
        setLastChecked(new Date());
      }
    }

    loadStreakData();
  }, [anilistId]);

  // Function to check and update streak based on activity
  const checkStreak = async (hasActivityToday: boolean = false) => {
    if (anilistId === null) return null;
    
    // Don't check more than once per hour to avoid spam
    if (lastChecked) {
      const hoursSinceLastCheck = (new Date().getTime() - lastChecked.getTime()) / (1000 * 60 * 60);
      if (hoursSinceLastCheck < 1) {
        console.log('Skipping streak update, already checked recently');
        return streakData;
      }
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      const updatedStreak = await checkAndUpdateStreak(anilistId, hasActivityToday);
      setStreakData(updatedStreak);
      setLastChecked(new Date());
      return updatedStreak;
    } catch (err) {
      console.error('Error checking streak:', err);
      setError('Failed to check streak');
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  // Function to manually reset streak
  const resetStreak = async () => {
    if (anilistId === null) return null;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const updatedStreak = await updateUserStreak(anilistId, {
        current_streak: 0,
        last_active: new Date().toISOString()
      });
      
      setStreakData(updatedStreak);
      setLastChecked(new Date());
      return updatedStreak;
    } catch (err) {
      console.error('Error resetting streak:', err);
      setError('Failed to reset streak');
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  // Function to manually increment streak
  const incrementStreak = async () => {
    if (anilistId === null || !streakData) return null;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const newCurrentStreak = (streakData.current_streak || 0) + 1;
      const newLongestStreak = Math.max(newCurrentStreak, streakData.longest_streak || 0);
      
      const updatedStreak = await updateUserStreak(anilistId, {
        current_streak: newCurrentStreak,
        longest_streak: newLongestStreak,
        last_active: new Date().toISOString()
      });
      
      setStreakData(updatedStreak);
      setLastChecked(new Date());
      return updatedStreak;
    } catch (err) {
      console.error('Error incrementing streak:', err);
      setError('Failed to increment streak');
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    streakData,
    isLoading,
    error,
    checkStreak,
    resetStreak,
    incrementStreak
  };
}; 