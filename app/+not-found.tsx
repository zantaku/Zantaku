import { Link, Stack } from 'expo-router';
import { StyleSheet, View, Dimensions } from 'react-native';
import React, { useEffect, useState } from 'react';

import { ThemedText } from '@/components/ThemedText';

const { width, height } = Dimensions.get('window');

const ANIME_404_MESSAGES = [
  "Ara ara~ This page seems to have vanished! (´･ω･`)",
  "Nani?! 404 Error desu! ヽ(°〇°)ﾉ",
  "Gomen nasai! Page not found! (╥﹏╥)",
  "Eh?! This page got isekai'd to another world! ✨",
  "Mou~ The page you're looking for is missing! (>_<)",
  "Kyaa! 404 - Page-kun has disappeared! (⊙_⊙)",
];

export default function NotFoundScreen() {
  const [message, setMessage] = useState('');

  useEffect(() => {
    setMessage(ANIME_404_MESSAGES[Math.floor(Math.random() * ANIME_404_MESSAGES.length)]);
  }, []);

  return (
    <>
      <Stack.Screen options={{ 
        title: 'Page Not Found',
        headerShown: false,
      }} />
      <View style={styles.container}>
        <View style={styles.sadFaceContainer}>
          <ThemedText style={styles.sadFace}>:(</ThemedText>
        </View>
        
        <View style={styles.contentContainer}>
          <ThemedText style={styles.mainMessage}>
            {message}
          </ThemedText>
          
          <ThemedText style={styles.errorCode}>
            Error Code: 404_ANIME_CHAN
          </ThemedText>
          
          <ThemedText style={styles.description}>
            Your waifu ran into a problem and needs to restart. We're{'\n'}
            just collecting some error info, and then we'll redirect you{'\n'}
            back to safety.
          </ThemedText>
          
          <ThemedText style={styles.percentage}>
            0% complete
          </ThemedText>
          
          <View style={styles.infoContainer}>
            <ThemedText style={styles.infoText}>
              For more information about this issue and possible fixes, visit our help center
            </ThemedText>
            
            <ThemedText style={styles.infoText}>
              If you call a support person, give them this info:
            </ThemedText>
            
            <ThemedText style={styles.stopCode}>
              Stop code: PAGE_NOT_FOUND_DESU
            </ThemedText>
          </View>
          
          <Link href="/" style={styles.homeButton}>
            <ThemedText style={styles.homeButtonText}>
              Return to Home ♡
            </ThemedText>
          </Link>
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0078D4', // Classic Windows blue
    paddingHorizontal: 40,
    paddingVertical: 60,
  },
  sadFaceContainer: {
    marginBottom: 40,
  },
  sadFace: {
    fontSize: 120,
    color: '#FFFFFF',
    fontWeight: '300',
    textAlign: 'left',
  },
  contentContainer: {
    flex: 1,
  },
  mainMessage: {
    fontSize: 24,
    color: '#FFFFFF',
    fontWeight: '400',
    marginBottom: 30,
    lineHeight: 32,
  },
  errorCode: {
    fontSize: 18,
    color: '#FFFFFF',
    fontWeight: '600',
    marginBottom: 20,
  },
  description: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '300',
    lineHeight: 24,
    marginBottom: 30,
  },
  percentage: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '300',
    marginBottom: 40,
  },
  infoContainer: {
    marginBottom: 40,
  },
  infoText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '300',
    marginBottom: 8,
    lineHeight: 20,
  },
  stopCode: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '400',
    marginTop: 8,
  },
  homeButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    alignSelf: 'flex-start',
    marginTop: 20,
  },
  homeButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
  },
});
