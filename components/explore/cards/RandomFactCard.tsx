import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';

interface RandomFactCardProps {
  data: {
    fact: string;
    category: string;
  };
  theme: any;
  isDarkMode: boolean;
}

export default function RandomFactCard({ data, theme, isDarkMode }: RandomFactCardProps) {
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(Math.floor(Math.random() * 50) + 10);
  const scaleAnim = new Animated.Value(1);

  const handleLike = () => {
    setIsLiked(!isLiked);
    setLikeCount(prev => isLiked ? prev - 1 : prev + 1);
    
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 1.2,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={isDarkMode 
          ? ['#667eea', '#764ba2'] 
          : ['#f093fb', '#f5576c']
        }
        style={styles.card}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <BlurView intensity={20} tint={isDarkMode ? 'dark' : 'light'} style={styles.blurContainer}>
          <View style={styles.header}>
            <View style={styles.categoryBadge}>
              <FontAwesome5 name="lightbulb" size={12} color="#FFD700" />
              <Text style={styles.categoryText}>{data.category}</Text>
            </View>
            <TouchableOpacity onPress={handleLike} style={styles.likeButton}>
              <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
                <FontAwesome5 
                  name={isLiked ? "heart" : "heart"} 
                  size={16} 
                  color={isLiked ? "#FF6B6B" : "#fff"} 
                  solid={isLiked}
                />
              </Animated.View>
              <Text style={styles.likeCount}>{likeCount}</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.content}>
            <Text style={styles.factText}>{data.fact}</Text>
          </View>
          
          <View style={styles.footer}>
            <View style={styles.interactionButtons}>
              <TouchableOpacity style={styles.interactionButton}>
                <FontAwesome5 name="share" size={14} color="#fff" />
                <Text style={styles.interactionText}>Share</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.interactionButton}>
                <FontAwesome5 name="comment" size={14} color="#fff" />
                <Text style={styles.interactionText}>Comment</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.interactionButton}>
                <FontAwesome5 name="bookmark" size={14} color="#fff" />
                <Text style={styles.interactionText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
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
    minHeight: 200,
  },
  blurContainer: {
    padding: 20,
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  categoryText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  likeButton: {
    alignItems: 'center',
    gap: 4,
  },
  likeCount: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    marginBottom: 16,
  },
  factText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    lineHeight: 26,
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  footer: {
    marginTop: 'auto',
  },
  interactionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.2)',
  },
  interactionButton: {
    alignItems: 'center',
    gap: 4,
  },
  interactionText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '500',
  },
}); 