import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import * as SecureStore from 'expo-secure-store';
import { STORAGE_KEY } from '../constants/auth';
import ENV from '../config';

interface StreakData {
  anilist_id: number;
  last_active: string;
  current_streak: number;
  longest_streak: number;
  type: 'anime' | 'manga' | 'combo' | 'none';
}

export function useStreaks(anilistId?: number) {
  const [streakData, setStreakData] = useState<StreakData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadStreakData = async () => {
      if (!anilistId) {
        setIsLoading(false);
        return;
      }
      
      try {
        setIsLoading(true);
        setError(null);
        
        // Use direct REST API access with apikey as URL parameter
        const restEndpoint = `${ENV.SUPABASE_URL.replace(/\/$/, '')}`;
        const apiKey = ENV.SUPABASE_ANON_KEY;
        const url = `${restEndpoint}/user_streaks?apikey=${apiKey}&anilist_id=eq.${anilistId}`;
        
        // Log with masked API key for security but use real key in request
        console.log('Fetching streak data via direct API:', url.replace(apiKey, '***'));
        
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          }
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('API Error loading streak data:', {
            status: response.status,
            statusText: response.statusText,
            body: errorText
          });
          throw new Error(`API error: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        
        if (!data || data.length === 0) {
          console.log('No streak data found for user:', anilistId);
          setStreakData(null);
        } else {
          console.log('Streak data loaded successfully:', {
            current_streak: data[0].current_streak,
            longest_streak: data[0].longest_streak
          });
          setStreakData(data[0] as StreakData);
        }
      } catch (err) {
        console.error('Error loading streak data:', err);
        setError('Failed to load streak data');
      } finally {
        setIsLoading(false);
      }
    };
    
    loadStreakData();
  }, [anilistId]);
  
  return {
    streakData,
    isLoading,
    error,
    currentStreak: streakData?.current_streak || 0,
    longestStreak: streakData?.longest_streak || 0,
    activityType: streakData?.type || 'none',
    lastActive: streakData?.last_active ? new Date(streakData.last_active) : null
  };
} 