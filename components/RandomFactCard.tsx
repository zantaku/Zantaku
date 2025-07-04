import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { FontAwesome5 } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../hooks/useTheme';
import { LinearGradient } from 'expo-linear-gradient';

interface RandomFact {
  id: string;
  title: string;
  fact: string;
  category: 'trivia' | 'production' | 'voice_actor' | 'studio' | 'cultural';
  relatedAnime?: {
    id: number;
    title: string;
    coverImage: string;
  };
  source?: string;
  icon: string;
}

const animeFacts: RandomFact[] = [
  {
    id: '1',
    title: 'Did You Know?',
    fact: 'The word "anime" is simply an abbreviation of "animation" in Japanese, and refers to all animation regardless of style or origin.',
    category: 'trivia',
    icon: 'lightbulb',
  },
  {
    id: '2',
    title: 'Studio Fact',
    fact: 'Studio Ghibli\'s name comes from the Italian aircraft Caproni Ca.309 Ghibli, which was used during World War II.',
    category: 'studio',
    icon: 'plane',
  },
  {
    id: '3',
    title: 'Production Secret',
    fact: 'Most anime episodes are produced just days before they air, leading to incredible time pressure on animation studios.',
    category: 'production',
    icon: 'clock',
  },
  {
    id: '4',
    title: 'Voice Acting',
    fact: 'Many popular anime voice actors (seiyuu) have huge fan followings and hold concerts, similar to pop stars.',
    category: 'voice_actor',
    icon: 'microphone',
  },
  {
    id: '5',
    title: 'Cultural Impact',
    fact: 'Pokemon is the highest-grossing media franchise of all time, earning over $100 billion across all media.',
    category: 'cultural',
    relatedAnime: {
      id: 527,
      title: 'Pokemon',
      coverImage: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx527-PBPdCUOWaP92.jpg'
    },
    icon: 'globe',
  },
  {
    id: '6',
    title: 'Animation Technique',
    fact: 'Traditional anime is drawn at 12 frames per second, while Disney animation typically uses 24 frames per second.',
    category: 'production',
    icon: 'film',
  },
  {
    id: '7',
    title: 'Studio History',
    fact: 'Toei Animation, founded in 1948, is one of the oldest anime studios and created classics like Dragon Ball and One Piece.',
    category: 'studio',
    icon: 'history',
  },
  {
    id: '8',
    title: 'Manga Origins',
    fact: 'Over 60% of anime are adaptations of manga, with the rest being original stories, light novel adaptations, or game adaptations.',
    category: 'trivia',
    icon: 'book',
  }
];

interface RandomFactCardProps {
  onRefresh?: () => void;
}

export const RandomFactCard: React.FC<RandomFactCardProps> = ({ onRefresh }) => {
  const router = useRouter();
  const { isDarkMode, currentTheme } = useTheme();
  const [currentFact, setCurrentFact] = useState<RandomFact>(animeFacts[0]);
  const [isFlipped, setIsFlipped] = useState(false);

  useEffect(() => {
    // Rotate facts every 30 seconds
    const interval = setInterval(() => {
      getRandomFact();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const getRandomFact = () => {
    const randomIndex = Math.floor(Math.random() * animeFacts.length);
    setCurrentFact(animeFacts[randomIndex]);
    setIsFlipped(false);
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'trivia': return '#4CAF50';
      case 'production': return '#FF9800';
      case 'voice_actor': return '#E91E63';
      case 'studio': return '#9C27B0';
      case 'cultural': return '#2196F3';
      default: return currentTheme.colors.primary;
    }
  };

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case 'trivia': return 'Anime Trivia';
      case 'production': return 'Behind the Scenes';
      case 'voice_actor': return 'Voice Acting';
      case 'studio': return 'Studio Facts';
      case 'cultural': return 'Cultural Impact';
      default: return 'Did You Know?';
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: currentTheme.colors.surface }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.titleSection}>
          <FontAwesome5 
            name={currentFact.icon as any} 
            size={20} 
            color={getCategoryColor(currentFact.category)} 
          />
          <Text style={[styles.title, { color: currentTheme.colors.text }]}>
            {currentFact.title}
          </Text>
        </View>
        
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.iconButton, { backgroundColor: currentTheme.colors.primary + '20' }]}
            onPress={() => setIsFlipped(!isFlipped)}
          >
            <FontAwesome5 
              name={isFlipped ? "eye-slash" : "eye"} 
              size={14} 
              color={currentTheme.colors.primary} 
            />
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.iconButton, { backgroundColor: currentTheme.colors.primary + '20' }]}
            onPress={getRandomFact}
          >
            <FontAwesome5 name="sync-alt" size={14} color={currentTheme.colors.primary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Category Badge */}
      <View style={[styles.categoryBadge, { backgroundColor: getCategoryColor(currentFact.category) + '20' }]}>
        <Text style={[styles.categoryText, { color: getCategoryColor(currentFact.category) }]}>
          {getCategoryLabel(currentFact.category)}
        </Text>
      </View>

      {/* Fact Content */}
      <View style={styles.factContainer}>
        <Text 
          style={[
            styles.factText, 
            { 
              color: isFlipped ? currentTheme.colors.textSecondary : currentTheme.colors.text,
              fontStyle: isFlipped ? 'italic' : 'normal'
            }
          ]}
          numberOfLines={isFlipped ? 1 : undefined}
        >
          {isFlipped ? "Tap the eye icon to reveal the fact!" : currentFact.fact}
        </Text>

        {/* Related Anime */}
        {currentFact.relatedAnime && !isFlipped && (
          <TouchableOpacity
            style={styles.relatedAnime}
            onPress={() => router.push(`/anime/${currentFact.relatedAnime?.id}`)}
            activeOpacity={0.7}
          >
            <ExpoImage
              source={{ uri: currentFact.relatedAnime.coverImage }}
              style={styles.animeImage}
              contentFit="cover"
            />
            <View style={styles.animeInfo}>
              <Text style={[styles.relatedLabel, { color: currentTheme.colors.textSecondary }]}>
                Related Anime:
              </Text>
              <Text style={[styles.animeTitle, { color: currentTheme.colors.text }]}>
                {currentFact.relatedAnime.title}
              </Text>
            </View>
            <FontAwesome5 
              name="chevron-right" 
              size={12} 
              color={currentTheme.colors.textSecondary} 
            />
          </TouchableOpacity>
        )}
      </View>

      {/* Footer Actions */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: getCategoryColor(currentFact.category) + '15' }]}
          onPress={getRandomFact}
        >
          <FontAwesome5 name="dice" size={12} color={getCategoryColor(currentFact.category)} />
          <Text style={[styles.actionText, { color: getCategoryColor(currentFact.category) }]}>
            Another Fact
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: currentTheme.colors.primary + '15' }]}
          onPress={() => {/* Share fact logic */}}
        >
          <FontAwesome5 name="share-alt" size={12} color={currentTheme.colors.primary} />
          <Text style={[styles.actionText, { color: currentTheme.colors.primary }]}>
            Share
          </Text>
        </TouchableOpacity>
      </View>

      {/* Decoration */}
      <LinearGradient
        colors={[getCategoryColor(currentFact.category) + '20', 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.decoration}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 20,
    marginVertical: 8,
    borderRadius: 16,
    padding: 20,
    position: 'relative',
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  titleSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  iconButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 16,
  },
  categoryText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  factContainer: {
    marginBottom: 16,
  },
  factText: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 16,
  },
  relatedAnime: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    borderRadius: 12,
    gap: 12,
  },
  animeImage: {
    width: 40,
    height: 56,
    borderRadius: 6,
  },
  animeInfo: {
    flex: 1,
  },
  relatedLabel: {
    fontSize: 11,
    fontWeight: '500',
    marginBottom: 2,
  },
  animeTitle: {
    fontSize: 13,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    gap: 6,
  },
  actionText: {
    fontSize: 12,
    fontWeight: '600',
  },
  decoration: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 60,
    height: 60,
    borderRadius: 30,
    opacity: 0.5,
  },
}); 