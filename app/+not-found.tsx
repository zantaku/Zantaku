import { Link, Stack } from 'expo-router';
import { StyleSheet, Image, Dimensions, View } from 'react-native';
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome5 } from '@expo/vector-icons';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useTheme } from '@/hooks/useTheme';

const { width, height } = Dimensions.get('window');

const ANILIST_ENDPOINT = 'https://graphql.anilist.co';

const NOT_FOUND_MESSAGES = [
  "Oops! Looks like this page got isekai'd! 🌟",
  "404 - Even my Stand can't find this page! ゴゴゴゴ",
  "Nani?! This page seems to have disappeared! 👀",
  "Gomen ne~ The page you're looking for isn't here! 🎀",
  "This page must be training in the Hyperbolic Time Chamber! ⏳",
  "Even with my Sharingan, I can't see this page! 👁️",
];

export default function NotFoundScreen() {
  const [character, setCharacter] = useState<any>(null);
  const [message, setMessage] = useState('');
  const { isDarkMode, currentTheme } = useTheme();

  useEffect(() => {
    const fetchRandomCharacter = async () => {
      try {
        const query = `
          query {
            Page(page: ${Math.floor(Math.random() * 50)}, perPage: 1) {
              characters(sort: FAVOURITES_DESC) {
                id
                name {
                  full
                }
                image {
                  large
                }
                media(perPage: 1) {
                  nodes {
                    coverImage {
                      extraLarge
                      color
                    }
                  }
                }
              }
            }
          }
        `;

        const { data } = await axios.post(ANILIST_ENDPOINT, { query });
        const characters = data?.data?.Page?.characters;
        if (characters && characters.length > 0) {
          setCharacter(characters[0]);
        }
      } catch (error) {
        console.error('Error fetching character:', error);
      }
    };

    fetchRandomCharacter();
    setMessage(NOT_FOUND_MESSAGES[Math.floor(Math.random() * NOT_FOUND_MESSAGES.length)]);
  }, []);

  const accentColor = character?.media?.nodes?.[0]?.coverImage?.color || '#5C73F2';

  return (
    <>
      <Stack.Screen options={{ 
        title: 'Page Not Found',
        headerStyle: {
          backgroundColor: 'transparent',
        },
        headerTransparent: true,
        headerTintColor: isDarkMode ? '#fff' : '#000',
        headerShadowVisible: false,
      }} />
      <ThemedView style={styles.container}>
        {character && (
          <>
            <Image
              source={{ uri: character.media?.nodes?.[0]?.coverImage?.extraLarge || character.image.large }}
              style={[styles.backgroundImage, { opacity: 0.4 }]}
              blurRadius={15}
            />
            <View style={styles.characterContainer}>
              <Image
                source={{ uri: character.image.large }}
                style={styles.characterImage}
                resizeMode="contain"
              />
              <LinearGradient
                colors={[
                  'transparent',
                  isDarkMode ? 'rgba(0,0,0,0.85)' : 'rgba(255,255,255,0.85)',
                  isDarkMode ? 'rgba(0,0,0,0.95)' : 'rgba(255,255,255,0.95)'
                ]}
                locations={[0, 0.5, 1]}
                style={styles.gradient}
              />
            </View>
          </>
        )}
        <View style={styles.contentContainer}>
          <View style={styles.messageContainer}>
            <ThemedText type="title" style={[
              styles.message,
              isDarkMode ? styles.darkModeText : styles.lightModeText
            ]}>{message}</ThemedText>
            <ThemedText style={[
              styles.subMessage,
              isDarkMode ? styles.darkModeText : styles.lightModeText
            ]}>
              The page you're looking for doesn't exist or has been moved.
            </ThemedText>
          </View>
          <Link 
            href="/" 
            style={styles.link}
          >
            <ThemedText type="link" style={styles.linkText}>Take me</ThemedText>
            <FontAwesome5 name="home" size={14} color="#FFF" style={styles.linkIcon} />
          </Link>
        </View>
      </ThemedView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  backgroundImage: {
    width: width,
    height: height,
    position: 'absolute',
  },
  characterContainer: {
    position: 'absolute',
    width: width,
    height: height,
    alignItems: 'center',
  },
  characterImage: {
    width: width * 0.9,
    height: height * 0.6,
    marginTop: height * 0.1,
  },
  gradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: height * 0.5,
  },
  contentContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: height * 0.08,
  },
  messageContainer: {
    alignItems: 'center',
    paddingHorizontal: 32,
    marginBottom: 24,
    backgroundColor: 'transparent',
  },
  message: {
    fontSize: 32,
    textAlign: 'center',
    marginBottom: 12,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  subMessage: {
    fontSize: 16,
    textAlign: 'center',
    opacity: 0.8,
    fontWeight: '500',
  },
  darkModeText: {
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
    color: '#FFFFFF',
  },
  lightModeText: {
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
    color: '#000000',
  },
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 50,
    backgroundColor: '#00C2FF',
    width: 150,
  },
  linkIcon: {
    marginLeft: 6,
  },
  linkText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
});
