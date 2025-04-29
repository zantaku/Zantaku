// React Native client test script for rewards
// This can be pasted into a React component or run in the app to test rewards

import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Button, ActivityIndicator } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { STORAGE_KEY } from '../constants/auth';
import { getAllRewards, getUserRewards } from '../lib/supabase';

/**
 * Test function to run in any component to debug rewards
 */
async function testRewardsClient() {
  console.log('🔍 Starting client-side rewards test...');
  
  try {
    // Step 1: Get user data from SecureStore
    console.log('📂 Getting user data from SecureStore...');
    const userDataStr = await SecureStore.getItemAsync(STORAGE_KEY.USER_DATA);
    
    if (!userDataStr) {
      console.error('❌ No user data found in SecureStore');
      return {
        success: false,
        error: 'No user data found'
      };
    }
    
    const userData = JSON.parse(userDataStr);
    console.log('✅ Found user data:', { ...userData, token: userData.token ? '[REDACTED]' : null });
    
    // Extract the user ID
    let userId = null;
    
    if (userData.id) {
      userId = userData.id;
      console.log('✅ Using user ID from user data:', userId);
    } else if (userData.supabase_id) {
      userId = userData.supabase_id;
      console.log('✅ Using supabase_id from user data:', userId);
    } else if (userData.anilist_id) {
      console.log('⚠️ Using anilist_id as fallback (not recommended):', userData.anilist_id);
      userId = userData.anilist_id.toString();
    } else {
      console.error('❌ No user ID found in user data');
      return {
        success: false,
        error: 'No user ID found in user data'
      };
    }
    
    // Step 2: Get all rewards
    console.log('📡 Getting all rewards...');
    const allRewards = await getAllRewards();
    
    if (!allRewards || allRewards.length === 0) {
      console.error('❌ No rewards found');
      return {
        success: false,
        error: 'No rewards found'
      };
    }
    
    console.log(`✅ Found ${allRewards.length} rewards`);
    console.log('Sample rewards:', allRewards.slice(0, 2));
    
    // Step 3: Get user rewards
    console.log(`📡 Getting rewards for user ID: ${userId}...`);
    const userRewards = await getUserRewards(userId);
    
    console.log(`✅ Found ${userRewards.length} user rewards`);
    
    if (userRewards.length > 0) {
      console.log('Sample user rewards:', userRewards.slice(0, 2));
    } else {
      console.log('No rewards unlocked for this user yet');
    }
    
    // Return the test results
    return {
      success: true,
      userData: {
        id: userId,
        anilist_id: userData.anilist_id
      },
      allRewards: allRewards.length,
      userRewards: userRewards.length,
      userRewardsSample: userRewards.slice(0, 2),
      allRewardsSample: allRewards.slice(0, 2)
    };
  } catch (error) {
    console.error('❌ Error in rewards client test:', error);
    return {
      success: false,
      error: error.message || 'Unknown error'
    };
  }
}

/**
 * Hook to test rewards in any component
 */
export function useRewardsTest() {
  const [results, setResults] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const runTest = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const testResults = await testRewardsClient();
      setResults(testResults);
      
      if (!testResults.success) {
        setError(testResults.error);
      }
    } catch (err) {
      setError(err.message || 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };
  
  return {
    results,
    isLoading,
    error,
    runTest
  };
}

/**
 * Test component to use in any screen
 */
export function RewardsDebugger() {
  const { results, isLoading, error, runTest } = useRewardsTest();
  
  useEffect(() => {
    // Auto-run the test when component mounts
    runTest();
  }, []);
  
  return (
    <ScrollView style={{ flex: 1, padding: 16 }}>
      <Text style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 16 }}>
        Rewards System Debugger
      </Text>
      
      <Button title="Run Test" onPress={runTest} disabled={isLoading} />
      
      {isLoading && (
        <View style={{ padding: 16, alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#0000ff" />
          <Text>Running rewards test...</Text>
        </View>
      )}
      
      {error && (
        <View style={{ padding: 16, backgroundColor: '#ffeeee', marginTop: 16, borderRadius: 8 }}>
          <Text style={{ color: 'red', fontWeight: 'bold' }}>Error:</Text>
          <Text style={{ color: 'red' }}>{error}</Text>
        </View>
      )}
      
      {results && results.success && (
        <View style={{ padding: 16, backgroundColor: '#eeffee', marginTop: 16, borderRadius: 8 }}>
          <Text style={{ fontWeight: 'bold', marginBottom: 8 }}>Test Results:</Text>
          
          <Text style={{ marginTop: 8 }}>User ID: {results.userData.id}</Text>
          <Text>Anilist ID: {results.userData.anilist_id}</Text>
          
          <Text style={{ marginTop: 16 }}>Total rewards: {results.allRewards}</Text>
          <Text>User rewards: {results.userRewards}</Text>
          
          {results.userRewards > 0 && (
            <View style={{ marginTop: 8 }}>
              <Text style={{ fontWeight: 'bold' }}>Sample user rewards:</Text>
              {results.userRewardsSample.map((reward, index) => (
                <Text key={index} style={{ marginLeft: 8 }}>
                  - ID: {reward.id}, Reward ID: {reward.reward_id}
                </Text>
              ))}
            </View>
          )}
        </View>
      )}
    </ScrollView>
  );
} 