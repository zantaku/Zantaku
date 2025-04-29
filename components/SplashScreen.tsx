import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Dimensions, StatusBar, Image } from 'react-native';
import Animated, { 
  useAnimatedStyle, 
  withTiming, 
  Easing,
  SlideInUp,
  useSharedValue,
  withSequence,
  runOnJS,
  interpolate,
  Extrapolate,
} from 'react-native-reanimated';
import { useTheme } from '../hooks/useTheme';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import axios from 'axios';

const { width, height } = Dimensions.get('window');
const LOGO_SIZE = width * 0.4;

interface SplashScreenProps {
  onAnimationComplete?: () => void;
}

interface AnimeData {
  imageUrl: string;
  dominantColors: string[];
  isLoading: boolean;
  title: string;
}

// GraphQL query to get random trending anime or manga
const RANDOM_MEDIA_QUERY = `
  query ($type: MediaType) {
    Page(page: 1, perPage: 20) {
      media(sort: TRENDING_DESC, type: $type) {
        id
        title {
          romaji
          english
        }
        coverImage {
          extraLarge
          large
          color
        }
      }
    }
  }
`;

const getRandomAnimeBackground = async (): Promise<AnimeData> => {
  try {
    // Randomly choose between ANIME or MANGA
    const mediaType = Math.random() > 0.5 ? 'ANIME' : 'MANGA';
    
    const response = await axios.post('https://graphql.anilist.co', {
      query: RANDOM_MEDIA_QUERY,
      variables: {
        type: mediaType
      }
    });
    
    const mediaList = response.data.data.Page.media;
    const randomIndex = Math.floor(Math.random() * mediaList.length);
    const selectedMedia = mediaList[randomIndex];
    
    // Get the cover image URL
    const imageUrl = selectedMedia.coverImage.extraLarge || selectedMedia.coverImage.large;
    
    // Get dominant color from API response
    const dominantColor = selectedMedia.coverImage.color || '#02A9FF';
    
    // Create a lighter variant for the gradient
    const lighterColor = dominantColor;
    
    // Get title
    const title = selectedMedia.title.english || selectedMedia.title.romaji || '';
    
    return {
      imageUrl,
      dominantColors: [dominantColor, lighterColor],
      isLoading: false,
      title
    };
  } catch (error) {
    console.error('Error fetching anime data:', error);
    return {
      imageUrl: '',
      dominantColors: ['#02A9FF', '#87CEFA'],
      isLoading: false,
      title: ''
    };
  }
};

const BackgroundImage = ({ 
  progress,
  animeData
}: { 
  progress: Animated.SharedValue<number>,
  animeData: AnimeData
}) => {
  const { isDarkMode } = useTheme();
  const blurIntensity = useSharedValue(0);

  useEffect(() => {
    if (!animeData.isLoading && animeData.imageUrl) {
      // Animate blur intensity when image loads
      blurIntensity.value = withTiming(20, { duration: 1000 });
    }
  }, [animeData.isLoading, animeData.imageUrl]);

  const imageStyle = useAnimatedStyle(() => {
    return {
      opacity: interpolate(
        progress.value,
        [0, 50, 100],
        [0.3, 0.6, 0.9],
        Extrapolate.CLAMP
      ),
      transform: [
        {
          scale: interpolate(
            progress.value,
            [0, 100],
            [1.05, 1],
            Extrapolate.CLAMP
          )
        }
      ]
    };
  });

  const blurStyle = useAnimatedStyle(() => {
    return {
      opacity: interpolate(
        blurIntensity.value,
        [0, 20],
        [0, 1],
        Extrapolate.CLAMP
      ),
    };
  });

  if (animeData.isLoading || !animeData.imageUrl) {
    return (
      <View style={styles.backgroundContainer}>
        <View style={[styles.backgroundImage, { backgroundColor: isDarkMode ? '#1a1a1a' : '#f5f5f5' }]} />
        <LinearGradient
          colors={['transparent', isDarkMode ? '#000' : '#fff']}
          style={styles.gradient}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
        />
      </View>
    );
  }

  return (
    <View style={styles.backgroundContainer}>
      <Animated.Image 
        source={{ uri: animeData.imageUrl }}
        style={[styles.backgroundImage, imageStyle]}
        resizeMode="cover"
      />
      <Animated.View style={[styles.blurContainer, blurStyle]}>
        <BlurView intensity={25} style={styles.blurOverlay} tint={isDarkMode ? "dark" : "light"} />
      </Animated.View>
      <LinearGradient
        colors={['transparent', animeData.dominantColors[0]]}
        style={styles.gradient}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />
    </View>
  );
};

const WelcomeMessage = ({ animeData }: { animeData: AnimeData }) => {
  const glowOpacity = useSharedValue(0.5);
  const glowRadius = useSharedValue(10);
  const titleOpacity = useSharedValue(0);
  
  useEffect(() => {
    // Create a pulsating glow effect
    glowOpacity.value = withSequence(
      withTiming(0.8, { duration: 1000 }),
      withTiming(0.5, { duration: 1000 })
    );
    
    // Fade in the title
    titleOpacity.value = withTiming(1, { duration: 1500, easing: Easing.out(Easing.cubic) });
    
    // Repeat the animation
    const interval = setInterval(() => {
      glowOpacity.value = withSequence(
        withTiming(0.8, { duration: 1000 }),
        withTiming(0.5, { duration: 1000 })
      );
      
      glowRadius.value = withSequence(
        withTiming(15, { duration: 1000 }),
        withTiming(10, { duration: 1000 })
      );
    }, 2000);
    
    return () => clearInterval(interval);
  }, [animeData]);
  
  const animatedGlowStyle = useAnimatedStyle(() => {
    return {
      shadowOpacity: glowOpacity.value,
      shadowRadius: glowRadius.value,
    };
  });
  
  const animatedTitleStyle = useAnimatedStyle(() => {
    return {
      opacity: titleOpacity.value,
    };
  });

  const glowStyle = {
    shadowColor: animeData.dominantColors[0],
    shadowOffset: { width: 0, height: 0 },
    elevation: 10,
  };

  // Set to true to show the title of the anime/manga
  const SHOW_TITLE = false;

  return (
    <Animated.View 
      entering={SlideInUp.delay(200).springify()} 
      style={[styles.welcomeContainer]}
    >
      <Animated.View style={[styles.logoGlow, glowStyle, animatedGlowStyle]}>
        <Image 
          source={require('../assets/images/splash.png')}
          style={{
            width: LOGO_SIZE,
            height: LOGO_SIZE,
            resizeMode: 'contain'
          }}
        />
      </Animated.View>
      
      {SHOW_TITLE && animeData.title && (
        <Animated.Text style={[styles.titleText, animatedTitleStyle]}>
          {animeData.title}
        </Animated.Text>
      )}
    </Animated.View>
  );
};

export default function SplashScreen({ onAnimationComplete }: SplashScreenProps) {
  const progress = useSharedValue(0);
  const { isDarkMode } = useTheme();
  const [animeData, setAnimeData] = useState<AnimeData>({
    imageUrl: '',
    dominantColors: ['#02A9FF', '#87CEFA'],
    isLoading: true,
    title: ''
  });

  const handleFillComplete = () => {
    if (onAnimationComplete) {
      onAnimationComplete();
    }
  };

  useEffect(() => {
    // Fetch random anime/manga cover
    const fetchAnimeData = async () => {
      const data = await getRandomAnimeBackground();
      setAnimeData(data);
    };
    
    fetchAnimeData();

    // Simulate loading without network calls
    progress.value = withSequence(
      withTiming(100, {
        duration: 2000,
        easing: Easing.bezier(0.25, 0.1, 0.25, 1),
      }, () => {
        runOnJS(handleFillComplete)();
      }),
    );
  }, []);

  return (
    <View style={[
      styles.overlay,
      { backgroundColor: isDarkMode ? '#000' : '#fff' }
    ]}>
      <StatusBar hidden />
      <BackgroundImage progress={progress} animeData={animeData} />
      <WelcomeMessage animeData={animeData} />
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
    zIndex: 9999,
    elevation: 9999,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backgroundContainer: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    overflow: 'hidden',
  },
  backgroundImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  blurOverlay: {
    position: 'absolute',
    width: '100%',
    height: '100%',
  },
  gradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    height: '100%',
  },
  welcomeContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  logoGlow: {
    borderRadius: LOGO_SIZE / 2,
  },
  blurContainer: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    zIndex: 1,
  },
  titleText: {
    marginTop: 20,
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
    maxWidth: width * 0.8,
  },
}); 