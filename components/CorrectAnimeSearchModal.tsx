import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import Modal from 'react-native-modal';
import { useRouter } from 'expo-router';
import { useTheme } from '../hooks/useTheme';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

interface CorrectAnimeSearchModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectAnime: (animeId: string, poster: string, provider: string) => void;
  initialQuery?: string;
  currentProvider?: string;
  onProviderChange?: (provider: string) => void;
}

interface AnimeSearchResult {
  id: string;
  title: string;
  image: string;
  releaseDate?: string;
  type?: string;
  anilistId?: string;
}

export default function CorrectAnimeSearchModal({
  visible,
  onClose,
  onSelectAnime,
  initialQuery = '',
  currentProvider = 'anilist',
  onProviderChange,
}: CorrectAnimeSearchModalProps) {
  const { isDarkMode, currentTheme } = useTheme();
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<AnimeSearchResult[]>([]);
  const router = useRouter();

  useEffect(() => {
    console.log('Modal visibility changed:', visible);
    if (visible) {
      setSearchQuery(initialQuery);
      if (initialQuery.trim()) {
        searchAnime();
      }
    }
  }, [visible, initialQuery]);

  const searchAnime = async () => {
    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }

    setLoading(true);
    try {
      console.log('Searching for anime using AniList API:', searchQuery);
      
      const query = `
        query ($search: String) {
          Page(perPage: 20) {
            media(search: $search, type: ANIME, sort: SEARCH_MATCH) {
              id
              title {
                userPreferred
                english
                romaji
                native
              }
              coverImage {
                large
                medium
              }
              startDate {
                year
                month
                day
              }
              format
              status
              episodes
              averageScore
              genres
            }
          }
        }
      `;

      const response = await axios.post(
        'https://graphql.anilist.co',
        {
          query,
          variables: { search: searchQuery }
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          timeout: 30000
        }
      );
      
      console.log('AniList search results:', response.data);
      
      if (response.data?.data?.Page?.media && response.data.data.Page.media.length > 0) {
        const mappedResults = response.data.data.Page.media.map((item: any) => ({
          id: item.id.toString(),
          anilistId: item.id.toString(),
          title: item.title.userPreferred || item.title.english || item.title.romaji || item.title.native,
          image: item.coverImage?.large || item.coverImage?.medium || '',
          releaseDate: item.startDate?.year?.toString() || '',
          type: item.format || 'TV',
          status: item.status,
          episodes: item.episodes,
          score: item.averageScore,
          genres: item.genres
        }));
        setResults(mappedResults);
        console.log('Mapped results:', mappedResults);
      } else {
        console.log('No results found for query:', searchQuery);
        setResults([]);
      }
    } catch (error: any) {
      console.error('AniList search error:', error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAnimeSelect = (anime: AnimeSearchResult) => {
    // Use AniList ID for better compatibility
    const animeId = anime.anilistId || anime.id;
    onSelectAnime(animeId, anime.image, 'anilist');
    onClose();
  };

  const renderItem = ({ item }: { item: AnimeSearchResult }) => (
    <TouchableOpacity 
      style={[styles.resultItem, { backgroundColor: currentTheme.colors.surface, borderBottomColor: currentTheme.colors.border }]} 
      onPress={() => handleAnimeSelect(item)}
    >
      <ExpoImage
        source={{ uri: item.image }}
        style={styles.thumbnail}
        contentFit="cover"
      />
      <View style={styles.infoContainer}>
        <Text style={[styles.title, { color: currentTheme.colors.text }]} numberOfLines={2}>
          {item.title}
        </Text>
        <View style={styles.metaContainer}>
          {item.type && (
            <Text style={[styles.metaText, { color: currentTheme.colors.textSecondary }]}>
              {item.type}
            </Text>
          )}
          {item.releaseDate && (
            <Text style={[styles.metaText, { color: currentTheme.colors.textSecondary }]}>
              {item.releaseDate}
            </Text>
          )}
          {item.episodes && (
            <Text style={[styles.metaText, { color: currentTheme.colors.textSecondary }]}>
              {item.episodes} eps
            </Text>
          )}
        </View>
        {item.score && (
          <Text style={[styles.scoreText, { color: currentTheme.colors.primary }]}>
            ⭐ {item.score}/100
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <Modal
      isVisible={visible}
      onBackdropPress={onClose}
      onBackButtonPress={onClose}
      style={styles.modal}
      animationIn="slideInUp"
      animationOut="slideOutDown"
      backdropTransitionOutTiming={0}
      propagateSwipe={true}
      swipeDirection={['down']}
      onSwipeComplete={onClose}
      hideModalContentWhileAnimating={true}
      useNativeDriver={true}
    >
      <View style={[styles.container, { backgroundColor: currentTheme.colors.background }]}>
        <View style={[styles.dragIndicator, { backgroundColor: currentTheme.colors.textSecondary }]} />
        <View style={styles.header}>
          <Text style={[styles.headerText, { color: currentTheme.colors.text }]}>
            Search Anime (AniList)
          </Text>
          <TouchableOpacity onPress={onClose}>
            <Text style={[styles.closeButton, { color: currentTheme.colors.text }]}>×</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.searchContainer}>
          <TextInput
            style={[
              styles.searchInput, 
              { 
                backgroundColor: currentTheme.colors.surface, 
                color: currentTheme.colors.text,
                borderColor: currentTheme.colors.border
              }
            ]}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search anime..."
            placeholderTextColor={currentTheme.colors.textSecondary}
            onSubmitEditing={searchAnime}
          />
          <TouchableOpacity style={[styles.searchButton, { backgroundColor: currentTheme.colors.primary }]} onPress={searchAnime}>
            <Text style={styles.searchButtonText}>Search</Text>
          </TouchableOpacity>
        </View>
        {loading ? (
          <ActivityIndicator style={styles.loader} color={currentTheme.colors.primary} />
        ) : (
          <FlatList
            data={results}
            renderItem={renderItem}
            keyExtractor={(item) => item.id}
            style={styles.list}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modal: {
    margin: 0,
    justifyContent: 'flex-end',
    zIndex: 1000,
  },
  container: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: '80%',
    padding: 20,
    zIndex: 1001,
  },
  dragIndicator: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerText: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  closeButton: {
    fontSize: 24,
    padding: 5,
  },
  searchContainer: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  searchInput: {
    flex: 1,
    borderRadius: 8,
    padding: 12,
    marginRight: 10,
    borderWidth: 1,
  },
  searchButton: {
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    justifyContent: 'center',
  },
  searchButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  loader: {
    marginTop: 20,
  },
  list: {
    flex: 1,
  },
  resultItem: {
    flexDirection: 'row',
    padding: 12,
    borderBottomWidth: 1,
    alignItems: 'center',
    borderRadius: 8,
    marginBottom: 8,
  },
  thumbnail: {
    width: 60,
    height: 85,
    borderRadius: 6,
    marginRight: 12,
  },
  infoContainer: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  metaContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  metaText: {
    fontSize: 12,
    fontWeight: '500',
  },
  scoreText: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
}); 