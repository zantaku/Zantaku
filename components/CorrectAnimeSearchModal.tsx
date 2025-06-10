import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import Modal from 'react-native-modal';
import { useRouter } from 'expo-router';
import { useTheme } from '../hooks/useTheme';
import { animePaheProvider, zoroProvider } from '../api/proxy/providers/anime';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
}

export default function CorrectAnimeSearchModal({
  visible,
  onClose,
  onSelectAnime,
  initialQuery = '',
  currentProvider = 'animepahe',
  onProviderChange,
}: CorrectAnimeSearchModalProps) {
  const { isDarkMode, currentTheme } = useTheme();
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<AnimeSearchResult[]>([]);
  const [provider, setProvider] = useState(currentProvider);
  const router = useRouter();

  useEffect(() => {
    const loadProviderSettings = async () => {
      try {
        const settings = await AsyncStorage.getItem('animeProviderSettings');
        if (settings) {
          const parsed = JSON.parse(settings);
          setProvider(parsed.defaultProvider || 'animepahe');
        }
      } catch (error) {
        console.error('Error loading provider settings:', error);
      }
    };
    loadProviderSettings();
  }, []);

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
      console.log('Searching for anime:', searchQuery, 'with provider:', provider);
      
      let searchResults: any[] = [];
      
      // Use the specific provider's search method
      if (provider === 'animepahe') {
        console.log(`[CorrectAnimeSearchModal] Using AnimePahe search route: anime/animepahe/${encodeURIComponent(searchQuery)}`);
        searchResults = await animePaheProvider.searchAnime(searchQuery);
      } else if (provider === 'zoro') {
        console.log(`[CorrectAnimeSearchModal] Using Zoro search route: anime/zoro/${encodeURIComponent(searchQuery)}?type=1`);
        searchResults = await zoroProvider.searchAnime(searchQuery);
      }
      
      console.log('Search results:', searchResults);
      
      if (searchResults && searchResults.length > 0) {
        const mappedResults = searchResults.map((item: any) => ({
          id: item.id,
          title: item.title,
          image: item.image || item.poster || '',
          releaseDate: item.releaseDate || item.year,
          type: item.type || 'TV'
        }));
        setResults(mappedResults);
      } else {
        console.log('No results found for query:', searchQuery);
        setResults([]);
      }
    } catch (error: any) {
      console.error('Search error:', error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAnimeSelect = (anime: AnimeSearchResult) => {
    onSelectAnime(anime.id, anime.image, provider);
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
        {(item.releaseDate || item.type) && (
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
          </View>
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
            Search Correct Anime
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
}); 