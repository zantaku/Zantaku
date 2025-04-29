import { useEffect } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useAuth } from '../../hooks/useAuth';

export default function AuthCallback() {
  const params = useLocalSearchParams();
  const { handleToken } = useAuth();

  useEffect(() => {
    const processAuth = async () => {
      console.log('Processing auth callback with params:', params);
      
      // The token will be in the URL fragment (#), not in the query params
      // Expo Router should parse it for us
      const token = params.access_token as string;
      
      if (token) {
        console.log('Found token in params, handling...');
        const success = await handleToken(token);
        if (success) {
          console.log('Token handled successfully, redirecting to home');
          router.replace('/');
        } else {
          console.error('Failed to handle token');
          router.replace('/welcome');
        }
      } else {
        console.error('No token found in params');
        router.replace('/welcome');
      }
    };

    processAuth();
  }, [params]);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1A1A1A' }}>
      <ActivityIndicator size="large" color="#02A9FF" />
      <Text style={{ marginTop: 20, color: '#FFFFFF' }}>Completing login...</Text>
    </View>
  );
} 