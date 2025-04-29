import { Redirect } from 'expo-router';
import { useAuth } from '../hooks/useAuth';
import { View, ActivityIndicator } from 'react-native';

export default function Index() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#02A9FF" />
      </View>
    );
  }

  if (!user) {
    return <Redirect href="/welcome" />;
  }

  return <Redirect href="/(tabs)" />;
} 