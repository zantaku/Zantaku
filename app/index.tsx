import { Redirect } from 'expo-router';
import { useAuth } from '../hooks/useAuth';
import { View, ActivityIndicator, Platform, Dimensions } from 'react-native';
import { isTVEnvironment } from '../utils/tvDetection';
import { useEffect, useState } from 'react';

export default function Index() {
  const { user, loading, enableAnonymousMode } = useAuth();
  const [isTV, setIsTV] = useState<boolean | null>(null);
  const [tvAnonymousHandled, setTvAnonymousHandled] = useState(false);

  useEffect(() => {
    const checkTVDevice = () => {
      const tvDetected = isTVEnvironment();
      console.log('🔥 INDEX.TSX TV DETECTION:', {
        isTV: tvDetected,
        platformIsTV: Platform.isTV,
        screenDimensions: Dimensions.get('screen'),
        windowDimensions: Dimensions.get('window')
      });
      setIsTV(tvDetected);
    };
    checkTVDevice();
  }, []);

  // Handle anonymous mode for TV users without account
  useEffect(() => {
    console.log('🔥 INDEX.TSX AUTH STATE:', {
      isTV,
      user: user ? { name: user.name, isAnonymous: user.isAnonymous } : null,
      loading,
      tvAnonymousHandled
    });
    
    if (isTV && !user && !loading && !tvAnonymousHandled) {
      console.log('🔥 TV detected without user, enabling anonymous mode');
      enableAnonymousMode().then(() => {
        console.log('🔥 Anonymous mode enabled successfully');
        setTvAnonymousHandled(true);
      }).catch((error) => {
        console.error('🔥 Failed to enable anonymous mode for TV:', error);
        setTvAnonymousHandled(true);
      });
    }
  }, [isTV, user, loading, tvAnonymousHandled, enableAnonymousMode]);

  // Show loading while checking auth and TV status
  if (loading || isTV === null || (isTV && !user && !tvAnonymousHandled)) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' }}>
        <ActivityIndicator size="large" color="#02A9FF" />
      </View>
    );
  }

  // TV-specific routing - always go to tabs (anonymous mode handled above)
  if (isTV) {
    console.log('🔥 INDEX.TSX: Redirecting TV to /(tabs)');
    return <Redirect href="/(tabs)" />;
  }

  // Mobile/tablet routing (original logic)
  if (!user) {
    console.log('🔥 INDEX.TSX: Redirecting mobile user to /welcome');
    return <Redirect href="/welcome" />;
  }

  console.log('🔥 INDEX.TSX: Redirecting authenticated user to /(tabs)');
  return <Redirect href="/(tabs)" />;
} 