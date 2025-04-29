import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  Image,
  ActivityIndicator,
} from 'react-native';
import axios from 'axios';
import { FontAwesome5 } from '@expo/vector-icons';

interface CorrectAnimeSearchModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectAnime: (animeId: string, poster: string) => void;
  initialQuery?: string;
}

interface AnimeResult {
  id: string;
  title: string;
  image: string;
  releaseDate: string | null;
  type: string;
}

export default function CorrectAnimeSearchModal({
  visible,
  onClose,
  onSelectAnime,
  initialQuery = '',
}: CorrectAnimeSearchModalProps) {
  const [searchText, setSearchText] = useState(initialQuery);
  const [results, setResults] = useState<AnimeResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const searchAnime = async (query: string) => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    try {
      setLoading(true);
      setError('');
      
      console.log('Searching for anime with query:', query);
      const searchUrl = `https://api.jikan.moe/v4/anime?q=${encodeURIComponent(query.trim())}&sfw=true&limit=15`;
      console.log('Search URL:', searchUrl);

      const { data } = await axios.get(searchUrl);

      console.log('Search response:', JSON.stringify(data, null, 2));

      if (!data?.data || data.data.length === 0) {
        console.log('No results found for query:', query);
        setError('No results found');
      } else {
        console.log('Found results:', data.data.length);
        const mappedResults = data.data.map((item: any) => ({
          id: item.mal_id.toString(),
          title: item.title,
          image: item.images.jpg.image_url,
          releaseDate: item.aired?.from ? new Date(item.aired.from).getFullYear().toString() : null,
          type: item.type || 'Unknown'
        }));
        setResults(mappedResults);
      }
    } catch (err: any) {
      console.error('Search error details:', {
        message: err.message,
        response: err.response?.data,
        status: err.response?.status,
        headers: err.response?.headers
      });
      setError('Failed to search anime: ' + (err.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchText) {
        searchAnime(searchText);
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [searchText]);

  const renderItem = ({ item }: { item: AnimeResult }) => (
    <TouchableOpacity
      style={styles.resultItem}
      onPress={() => onSelectAnime(item.id, item.image)}
    >
      <Image 
        source={{ uri: item.image }} 
        style={styles.posterImage}
        resizeMode="cover"
      />
      <View style={styles.infoContainer}>
        <Text style={styles.titleText} numberOfLines={2}>
          {item.title}
        </Text>
        <View style={styles.detailsContainer}>
          <View style={styles.tagContainer}>
            <Text style={styles.statusTag}>
              {item.type}
            </Text>
            {item.releaseDate && (
              <Text style={styles.formatTag}>
                {item.releaseDate}
              </Text>
            )}
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalContainer}>
        <View style={styles.contentContainer}>
          <View style={styles.header}>
            <View style={styles.searchInputContainer}>
              <FontAwesome5 name="search" size={16} color="#666" />
              <TextInput
                style={styles.searchInput}
                placeholder="Search correct anime..."
                value={searchText}
                onChangeText={setSearchText}
                autoFocus
                placeholderTextColor="#666"
              />
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <FontAwesome5 name="times" size={20} color="#666" />
            </TouchableOpacity>
          </View>

          {loading ? (
            <ActivityIndicator size="large" color="#02A9FF" style={styles.loader} />
          ) : error ? (
            <Text style={styles.errorText}>{error}</Text>
          ) : (
            <FlatList
              data={results}
              renderItem={renderItem}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.resultsList}
              showsVerticalScrollIndicator={false}
              removeClippedSubviews={true}
              initialNumToRender={6}
              maxToRenderPerBatch={10}
              windowSize={5}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  contentContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: '90%',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    backgroundColor: '#fff',
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    paddingHorizontal: 12,
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 8,
    fontSize: 16,
    color: '#000',
  },
  closeButton: {
    padding: 4,
  },
  resultsList: {
    padding: 16,
  },
  resultItem: {
    flexDirection: 'row',
    marginBottom: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  posterImage: {
    width: 100,
    height: 140,
    borderRadius: 8,
  },
  infoContainer: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'space-between',
  },
  titleText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 4,
  },
  detailsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 4,
  },
  tagContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  statusTag: {
    backgroundColor: '#02A9FF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    fontSize: 12,
    color: '#fff',
  },
  formatTag: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    fontSize: 12,
    color: '#666',
  },
  releaseDate: {
    fontSize: 12,
    color: '#666',
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    textAlign: 'center',
    color: '#ff0000',
    padding: 16,
  },
}); 