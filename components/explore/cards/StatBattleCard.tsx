import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Dimensions } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { FontAwesome5 } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useRouter } from 'expo-router';

const { width } = Dimensions.get('window');

interface StatBattleCardProps {
  data: {
    anime1: any;
    anime2: any;
    battleType: string;
  };
  theme: any;
  isDarkMode: boolean;
}

export default function StatBattleCard({ data, theme, isDarkMode }: StatBattleCardProps) {
  const router = useRouter();
  const [selectedAnime, setSelectedAnime] = useState<number | null>(null);
  const [votes1, setVotes1] = useState(Math.floor(Math.random() * 1000) + 500);
  const [votes2, setVotes2] = useState(Math.floor(Math.random() * 1000) + 500);
  const [hasVoted, setHasVoted] = useState(false);
  
  const progressAnim1 = new Animated.Value(0);
  const progressAnim2 = new Animated.Value(0);

  const totalVotes = votes1 + votes2;
  const percentage1 = (votes1 / totalVotes) * 100;
  const percentage2 = (votes2 / totalVotes) * 100;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(progressAnim1, {
        toValue: percentage1,
        duration: 1000,
        useNativeDriver: false,
      }),
      Animated.timing(progressAnim2, {
        toValue: percentage2,
        duration: 1000,
        useNativeDriver: false,
      }),
    ]).start();
  }, [votes1, votes2]);
  
  // Add null checks for anime data after hooks
  if (!data?.anime1 || !data?.anime2) {
    return null;
  }

  const handleVote = (animeIndex: number) => {
    if (hasVoted) return;
    
    setSelectedAnime(animeIndex);
    setHasVoted(true);
    
    if (animeIndex === 0) {
      setVotes1(prev => prev + 1);
    } else {
      setVotes2(prev => prev + 1);
    }
  };

  const getBattleIcon = () => {
    switch (data?.battleType) {
      case 'Trending Score':
        return 'fire';
      case 'Popularity':
        return 'users';
      case 'Rating':
        return 'star';
      default:
        return 'sword';
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={isDarkMode 
          ? ['#2c3e50', '#34495e'] 
          : ['#74b9ff', '#0984e3']
        }
        style={styles.card}
      >
        <BlurView intensity={30} tint={isDarkMode ? 'dark' : 'light'} style={styles.blurContainer}>
          <View style={styles.header}>
            <View style={styles.battleTypeContainer}>
              <FontAwesome5 name={getBattleIcon()} size={16} color="#FFD700" />
              <Text style={styles.battleTypeText}>{data?.battleType || 'Anime'} Battle</Text>
            </View>
            <View style={styles.totalVotesContainer}>
              <Text style={styles.totalVotesText}>{totalVotes} votes</Text>
            </View>
          </View>

          <View style={styles.battleContainer}>
            {/* Anime 1 */}
            <TouchableOpacity 
              style={[
                styles.animeContainer,
                selectedAnime === 0 && styles.selectedAnime
              ]}
              onPress={() => handleVote(0)}
              disabled={hasVoted}
            >
              <ExpoImage
                source={{ uri: data.anime1.coverImage?.large || data.anime1.coverImage?.medium || 'https://via.placeholder.com/200x300' }}
                style={styles.animeImage}
                contentFit="cover"
              />
              <View style={styles.animeInfo}>
                <Text style={styles.animeTitle} numberOfLines={2}>
                  {data.anime1.title?.english || data.anime1.title?.userPreferred || 'Unknown Title'}
                </Text>
                <View style={styles.animeStats}>
                  <FontAwesome5 name="star" size={12} color="#FFD700" />
                  <Text style={styles.animeScore}>{data.anime1.averageScore ? data.anime1.averageScore.toFixed(1) : 'N/A'}</Text>
                </View>
              </View>
              <View style={styles.voteButton}>
                <FontAwesome5 
                  name={selectedAnime === 0 ? "check-circle" : "vote-yea"} 
                  size={20} 
                  color={selectedAnime === 0 ? "#4CAF50" : "#fff"} 
                />
              </View>
            </TouchableOpacity>

            {/* VS */}
            <View style={styles.vsContainer}>
              <Text style={styles.vsText}>VS</Text>
            </View>

            {/* Anime 2 */}
            <TouchableOpacity 
              style={[
                styles.animeContainer,
                selectedAnime === 1 && styles.selectedAnime
              ]}
              onPress={() => handleVote(1)}
              disabled={hasVoted}
            >
              <ExpoImage
                source={{ uri: data.anime2.coverImage?.large || data.anime2.coverImage?.medium || 'https://via.placeholder.com/200x300' }}
                style={styles.animeImage}
                contentFit="cover"
              />
              <View style={styles.animeInfo}>
                <Text style={styles.animeTitle} numberOfLines={2}>
                  {data.anime2.title?.english || data.anime2.title?.userPreferred || 'Unknown Title'}
                </Text>
                <View style={styles.animeStats}>
                  <FontAwesome5 name="star" size={12} color="#FFD700" />
                  <Text style={styles.animeScore}>{data.anime2.averageScore ? data.anime2.averageScore.toFixed(1) : 'N/A'}</Text>
                </View>
              </View>
              <View style={styles.voteButton}>
                <FontAwesome5 
                  name={selectedAnime === 1 ? "check-circle" : "vote-yea"} 
                  size={20} 
                  color={selectedAnime === 1 ? "#4CAF50" : "#fff"} 
                />
              </View>
            </TouchableOpacity>
          </View>

          {/* Results */}
          <View style={styles.resultsContainer}>
            <View style={styles.progressContainer}>
              <View style={styles.progressBar}>
                <Animated.View 
                  style={[
                    styles.progressFill1,
                    { width: progressAnim1.interpolate({
                      inputRange: [0, 100],
                      outputRange: ['0%', '100%']
                    })}
                  ]} 
                />
              </View>
              <Text style={styles.percentageText}>{percentage1.toFixed(1)}%</Text>
            </View>
            <View style={styles.progressContainer}>
              <View style={styles.progressBar}>
                <Animated.View 
                  style={[
                    styles.progressFill2,
                    { width: progressAnim2.interpolate({
                      inputRange: [0, 100],
                      outputRange: ['0%', '100%']
                    })}
                  ]} 
                />
              </View>
              <Text style={styles.percentageText}>{percentage2.toFixed(1)}%</Text>
            </View>
          </View>

          {hasVoted && (
            <View style={styles.votedMessage}>
              <FontAwesome5 name="check-circle" size={16} color="#4CAF50" />
              <Text style={styles.votedText}>Vote recorded!</Text>
            </View>
          )}
        </BlurView>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  card: {
    borderRadius: 20,
    overflow: 'hidden',
    minHeight: 300,
  },
  blurContainer: {
    padding: 20,
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  battleTypeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  battleTypeText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  totalVotesContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
  },
  totalVotesText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  battleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
    marginBottom: 20,
  },
  animeContainer: {
    flex: 1,
    alignItems: 'center',
    padding: 12,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedAnime: {
    borderColor: '#4CAF50',
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
  },
  animeImage: {
    width: 80,
    height: 120,
    borderRadius: 10,
    marginBottom: 8,
  },
  animeInfo: {
    alignItems: 'center',
    gap: 4,
  },
  animeTitle: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 16,
  },
  animeStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  animeScore: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  voteButton: {
    marginTop: 8,
  },
  vsContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  vsText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
  resultsContainer: {
    gap: 10,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  progressBar: {
    flex: 1,
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill1: {
    height: '100%',
    backgroundColor: '#FF6B6B',
    borderRadius: 4,
  },
  progressFill2: {
    height: '100%',
    backgroundColor: '#4ECDC4',
    borderRadius: 4,
  },
  percentageText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    minWidth: 35,
  },
  votedMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 10,
    paddingVertical: 8,
    backgroundColor: 'rgba(76, 175, 80, 0.2)',
    borderRadius: 10,
  },
  votedText: {
    color: '#4CAF50',
    fontSize: 14,
    fontWeight: '600',
  },
}); 