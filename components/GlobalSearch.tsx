import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Platform,
  Modal,
  FlatList,
  SectionList, // Import SectionList
} from 'react-native';
import { BlurView } from 'expo-blur';
import { FontAwesome5 } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { Image as ExpoImage } from 'expo-image';
import { useRouter } from 'expo-router';
import axios from 'axios';
import { debounce } from 'lodash';
import * as SecureStore from 'expo-secure-store';
import { STORAGE_KEY } from '../constants/auth';
import { useSettings } from '../hooks/useSettings';

interface GlobalSearchResult {
  id: number;
  type: 'ANIME' | 'MANGA' | 'CHARACTER' | 'STAFF' | 'USER';
  title?: {
    userPreferred: string;
    romaji: string;
    english: string;
    native?: string;
  };
  name?: {
    userPreferred: string;
    full: string;
  };
  coverImage?: {
    medium: string;
  };
  image?: {
    medium: string;
  };
  avatar?: {
    medium: string;
  };
  format?: string;
  status?: string;
  episodes?: number;
  chapters?: number;
  averageScore?: number;
  popularity?: number;
  trending?: number;
  description?: string;
}

interface SearchSection {
  title: string;
  data: GlobalSearchResult[];
}

interface Props {
  visible: boolean;
  onClose: () => void;
}

const ANILIST_GRAPHQL_ENDPOINT = 'https://graphql.anilist.co';

type FilterType = 'ALL' | 'ANIME' | 'MANGA' | 'CHARACTER' | 'STAFF' | 'USER';

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10000,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center', // Center filter modal
    alignItems: 'center', // Center filter modal
  },
  filterModal: {
    width: '80%',
    maxWidth: 300,
    padding: 20,
    borderRadius: 12,
  },
  filterOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginBottom: 8,
    borderRadius: 8,
    backgroundColor: 'transparent',
  },
  activeFilterOption: {
    backgroundColor: '#02A9FF',
  },
  filterIcon: {
    marginRight: 12,
  },
  filterText: {
    fontSize: 16,
    fontWeight: '500',
  },
  content: {
    flex: 1,
    paddingTop: Platform.OS === 'ios' ? 50 : 30,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 15,
    marginLeft: 8,
    marginRight: 8,
  },
  clearButton: {
    padding: 4,
  },
  closeButton: {
    padding: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  results: {
    flex: 1,
    paddingHorizontal: 12,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
    paddingHorizontal: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  resultItem: {
    flexDirection: 'row',
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
  },
  resultImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  imagePlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  resultInfo: {
    flex: 1,
    marginLeft: 12,
  },
  resultName: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  description: {
    fontSize: 13,
    opacity: 0.7,
  },
  noResults: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 60,
  },
  noResultsText: {
    fontSize: 14,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 14,
    textAlign: 'center',
    marginHorizontal: 20,
  },
  filterButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 8,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
  },
});

export default function GlobalSearch({ visible, onClose }: Props) {
  const router = useRouter();
  const { isDarkMode, currentTheme } = useTheme();
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<SearchSection[]>([]);
  const [activeFilter, setActiveFilter] = useState<FilterType>('ALL');
  const [showFilterModal, setShowFilterModal] = useState(false);
  const { settings } = useSettings();
  const [page, setPage] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const currentFilterRef = useRef<FilterType>('ALL');

  const searchAnilist = useCallback(async (searchQuery: string, pageNum: number = 1, isLoadingMore: boolean = false) => {
    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }

    try {
      if (pageNum === 1) {
        setLoading(true);
      }
      setError(null);

      // Try to get token but don't require it
      const token = await SecureStore.getItemAsync(STORAGE_KEY.AUTH_TOKEN);
      console.log('Token available:', !!token);

      const currentFilter = currentFilterRef.current;
      console.log('Searching with filter:', currentFilter);

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      };

      // Only add authorization if token exists
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const getQueryString = () => {
        if (currentFilter === 'ALL') {
          return `
            query ($search: String, $isAdult: Boolean) {
              anime: Page(page: 1, perPage: 5) {
                results: media(type: ANIME, search: $search, sort: SEARCH_MATCH, isAdult: $isAdult) {
                  id
                  type
                  title { userPreferred romaji english native }
                  coverImage { medium }
                  format status episodes averageScore popularity trending
                  description(asHtml: false)
                }
              }
              manga: Page(page: 1, perPage: 5) {
                results: media(type: MANGA, search: $search, sort: SEARCH_MATCH, isAdult: $isAdult) {
                  id
                  type
                  title { userPreferred romaji english native }
                  coverImage { medium }
                  format status chapters averageScore popularity trending
                  description(asHtml: false)
                }
              }
              characters: Page(page: 1, perPage: 5) {
                results: characters(search: $search) {
                  id
                  name { userPreferred full }
                  image { medium }
                  description(asHtml: false)
                }
              }
              staff: Page(page: 1, perPage: 5) {
                results: staff(search: $search) {
                  id
                  name { userPreferred full }
                  image { medium }
                  description(asHtml: false)
                }
              }
              users: Page(page: 1, perPage: 5) {
                results: users(search: $search) {
                  id name avatar { medium }
                  about
                }
              }
            }
          `;
        } else {
          const getTypeQuery = () => {
            switch (currentFilter) {
              case 'ANIME':
                return `
                  query ($search: String, $page: Int, $isAdult: Boolean) {
                    Page(page: $page, perPage: 20) {
                      pageInfo { hasNextPage }
                      results: media(type: ANIME, search: $search, sort: SEARCH_MATCH, isAdult: $isAdult) {
                        id type title { userPreferred romaji english native }
                        coverImage { medium }
                        format status episodes averageScore popularity trending
                        description(asHtml: false)
                      }
                    }
                  }
                `;
              case 'MANGA':
                return `
                  query ($search: String, $page: Int, $isAdult: Boolean) {
                    Page(page: $page, perPage: 20) {
                      pageInfo { hasNextPage }
                      results: media(type: MANGA, search: $search, sort: SEARCH_MATCH, isAdult: $isAdult) {
                        id type title { userPreferred romaji english native }
                        coverImage { medium }
                        format status chapters averageScore popularity trending
                        description(asHtml: false)
                      }
                    }
                  }
                `;
              case 'CHARACTER':
                return `
                  query ($search: String, $page: Int) {
                    Page(page: $page, perPage: 20) {
                      pageInfo { hasNextPage }
                      results: characters(search: $search) {
                        id name { userPreferred full }
                        image { medium }
                        description(asHtml: false)
                      }
                    }
                  }
                `;
              case 'STAFF':
                return `
                  query ($search: String, $page: Int) {
                    Page(page: $page, perPage: 20) {
                      pageInfo { hasNextPage }
                      results: staff(search: $search) {
                        id name { userPreferred full }
                        image { medium }
                        description(asHtml: false)
                      }
                    }
                  }
                `;
              case 'USER':
                return `
                  query ($search: String, $page: Int) {
                    Page(page: $page, perPage: 20) {
                      pageInfo { hasNextPage }
                      results: users(search: $search) {
                        id name avatar { medium }
                        about
                      }
                    }
                  }
                `;
              default:
                return '';
            }
          };
          return getTypeQuery();
        }
      };

      console.log('GlobalSearch: Making API request with query:', searchQuery, 'filter:', currentFilter, 'page:', pageNum);

      const response = await axios.post(
        ANILIST_GRAPHQL_ENDPOINT,
        {
          query: getQueryString(),
          variables: {
            search: searchQuery,
            page: pageNum,
            isAdult: settings?.displayAdultContent || false
          }
        },
        { headers }
      );

      if (response.data.errors) {
        console.error('GlobalSearch: GraphQL errors:', response.data.errors);
        throw new Error(response.data.errors[0]?.message || 'Error fetching results');
      }

      console.log('GlobalSearch: API response received successfully');

      if (currentFilter === 'ALL') {
        const sections: SearchSection[] = [];
        
        if (response.data.data.anime?.results?.length > 0) {
          sections.push({
            title: 'Anime',
            data: response.data.data.anime.results.map((item: any) => ({
              ...item,
              type: 'ANIME'
            }))
          });
        }
        if (response.data.data.manga?.results?.length > 0) {
          sections.push({
            title: 'Manga',
            data: response.data.data.manga.results.map((item: any) => ({
              ...item,
              type: 'MANGA'
            }))
          });
        }
        if (response.data.data.characters?.results?.length > 0) {
          sections.push({
            title: 'Characters',
            data: response.data.data.characters.results.map((item: any) => ({
              ...item,
              type: 'CHARACTER'
            }))
          });
        }
        if (response.data.data.staff?.results?.length > 0) {
          sections.push({
            title: 'Staff',
            data: response.data.data.staff.results.map((item: any) => ({
              ...item,
              type: 'STAFF'
            }))
          });
        }
        if (response.data.data.users?.results?.length > 0) {
          sections.push({
            title: 'Users',
            data: response.data.data.users.results.map((item: any) => ({
              ...item,
              type: 'USER',
              name: { userPreferred: item.name },
              description: item.about
            }))
          });
        }
        
        console.log('GlobalSearch: Processed sections:', sections.length);
        setResults(sections);
        setHasNextPage(false);
      } else {
        const newResults = response.data.data.Page.results.map((item: any) => ({
            ...item,
            type: currentFilter,
            description: item.description || item.about,
            name: item.name?.full ? item.name : { userPreferred: item.name }
        }));
        
        console.log('GlobalSearch: Processed results count:', newResults.length);
        
        setResults(prevResults => {
          if (pageNum === 1) {
            return [{
              title: currentFilter,
              data: newResults
            }];
          } else {
            const existingData = prevResults?.[0]?.data || [];
            return [{
              title: currentFilter,
              data: [...existingData, ...newResults]
            }];
          }
        });
        
        setHasNextPage(response.data.data.Page.pageInfo.hasNextPage);
        setPage(pageNum);
      }

    } catch (error: any) {
      console.error('GlobalSearch: Search error occurred');
      console.error('GlobalSearch: Error type:', typeof error);
      console.error('GlobalSearch: Error message:', error.message);
      console.error('GlobalSearch: Error response status:', error.response?.status);
      console.error('GlobalSearch: Error response data:', error.response?.data);
      console.error('GlobalSearch: Full error object:', error);
      
      setError(error.message || 'Failed to fetch results');
      if (pageNum === 1) {
        setResults([]);
      }
    } finally {
      setLoading(false);
      setIsLoadingMore(false);
    }
  }, [settings?.displayAdultContent]);

  const debouncedSearch = useCallback(
    debounce((text: string) => {
      searchAnilist(text, 1, false);
    }, 300),
    [searchAnilist]
  );

  const handleSearch = (text: string) => {
    setQuery(text);
    setPage(1);
    setResults([]);
    debouncedSearch(text);
  };

  const handleFilterChange = (filter: FilterType) => {
    console.log('Changing filter to:', filter);
    setActiveFilter(filter);
    currentFilterRef.current = filter;
    setShowFilterModal(false);
    setPage(1);
    setResults([]);
    setHasNextPage(true);
    
    if (query.trim()) {
      searchAnilist(query, 1, false);
    }
  };

  const getResultImage = (result: GlobalSearchResult) => {
    if (result.type === 'USER') {
        return result.avatar?.medium;
    }
    if (result.coverImage?.medium) return result.coverImage.medium;
    if (result.image?.medium) return result.image.medium;
    return null;
  };

  const getResultName = (result: GlobalSearchResult) => {
    if (result.title?.userPreferred) return result.title.userPreferred;
    if (result.name?.userPreferred) return result.name.userPreferred;
    if (result.name?.full) return result.name.full;
    return 'Unknown';
  };

  const navigateToResult = (result: GlobalSearchResult) => {
    let pathname = '';
    let params: { id?: number; userId?: string } = {};

    switch (result.type) {
      case 'ANIME':
        pathname = '/anime/[id]';
        params.id = result.id;
        break;
      case 'MANGA':
        pathname = '/manga/[id]';
        params.id = result.id;
        break;
      case 'CHARACTER':
        pathname = '/character/[id]';
        params.id = result.id;
        break;
      case 'STAFF':
        pathname = '/staff/[id]';
        params.id = result.id;
        break;
      case 'USER':
        pathname = '/profile';
        params.userId = result.id.toString();
        break;
    }

    if (pathname) {
      router.push({ pathname, params });
      onClose();
    }
  };

  const getTypeIcon = (type: FilterType) => {
    switch (type) {
      case 'ANIME':
        return 'tv';
      case 'MANGA':
        return 'book';
      case 'CHARACTER':
        return 'user';
      case 'STAFF':
        return 'user-tie';
      case 'USER':
        return 'user-circle';
      default:
        return 'layer-group';
    }
  };

  const FilterModal = () => (
    <Modal
      visible={showFilterModal}
      onRequestClose={() => setShowFilterModal(false)}
      transparent={true}
      animationType="fade"
    >
      <TouchableOpacity 
        style={styles.modalOverlay}
        activeOpacity={1} 
        onPress={() => setShowFilterModal(false)}
      >
        <BlurView
          intensity={isDarkMode ? 50 : 80}
          tint={isDarkMode ? 'dark' : 'light'}
          style={[
            styles.filterModal,
            { backgroundColor: isDarkMode ? 'rgba(0, 0, 0, 0.8)' : 'rgba(255, 255, 255, 0.8)' }
          ]}
        >
          {(['ALL', 'ANIME', 'MANGA', 'CHARACTER', 'STAFF', 'USER'] as FilterType[]).map((filter) => (
            <TouchableOpacity
              key={filter}
              style={[
                styles.filterOption,
                activeFilter === filter && styles.activeFilterOption
              ]}
              onPress={() => handleFilterChange(filter)}
            >
              <FontAwesome5
                name={filter === 'ALL' ? 'layer-group' : getTypeIcon(filter)}
                size={16}
                color={activeFilter === filter ? '#fff' : currentTheme.colors.text}
                style={styles.filterIcon}
              />
              <Text style={[
                styles.filterText,
                { color: activeFilter === filter ? '#fff' : currentTheme.colors.text }
              ]}>
                {filter.charAt(0) + filter.slice(1).toLowerCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </BlurView>
      </TouchableOpacity>
    </Modal>
  );

  const loadMore = () => {
    if (!hasNextPage || loading || isLoadingMore || activeFilter === 'ALL') return;
    
    setIsLoadingMore(true);
    searchAnilist(query, page + 1, true);
  };
  
  const renderResultItem = ({ item }: { item: GlobalSearchResult }) => (
    <TouchableOpacity
      style={[
        styles.resultItem,
        {
          backgroundColor: isDarkMode ? '#2A2A2A' : '#FFFFFF',
          marginBottom: 8,
        }
      ]}
      onPress={() => navigateToResult(item)}
    >
      {getResultImage(item) ? (
        <ExpoImage
          source={{ uri: getResultImage(item)! }}
          style={styles.resultImage}
          contentFit="cover"
          transition={200}
        />
      ) : (
        <View style={[styles.imagePlaceholder, { backgroundColor: currentTheme.colors.border }]}>
          <FontAwesome5 name={getTypeIcon(item.type)} size={14} color={currentTheme.colors.textSecondary} />
        </View>
      )}
      <View style={styles.resultInfo}>
        <Text style={[styles.resultName, { color: currentTheme.colors.text }]} numberOfLines={2}>
          {getResultName(item)}
        </Text>
        {item.description && (
          <Text style={[styles.description, { color: currentTheme.colors.textSecondary }]} numberOfLines={2}>
            {item.description?.replace(/<[^>]*>/g, '') || ''}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );

  const renderEmptyComponent = () => (
    query.length > 0 ? (
      <View style={styles.noResults}>
        <FontAwesome5 
          name="search" 
          size={24} 
          color={currentTheme.colors.textSecondary}
          style={{ marginBottom: 8, opacity: 0.5 }}
        />
        <Text style={[styles.noResultsText, { color: currentTheme.colors.textSecondary }]}>
          No results found for "{query}"
        </Text>
      </View>
    ) : null
  );

  if (!visible) return null;

  return (
    <View style={styles.container}>
      <Modal
        visible={visible}
        transparent={true}
        onRequestClose={onClose}
        animationType="fade"
        statusBarTranslucent={true}
        presentationStyle="overFullScreen"
      >
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={onClose}
        >
          <View style={[
            StyleSheet.absoluteFill,
            { backgroundColor: isDarkMode ? 'rgba(0, 0, 0, 0.8)' : 'rgba(0, 0, 0, 0.5)' }
          ]} />
          <BlurView 
            intensity={isDarkMode ? 50 : 80} 
            tint={isDarkMode ? 'dark' : 'light'} 
            style={StyleSheet.absoluteFill} 
          />
        </TouchableOpacity>
        <View style={styles.content}>
          <View style={styles.header}>
            <View style={[
              styles.searchBar,
              {
                backgroundColor: isDarkMode ? '#2A2A2A' : '#FFFFFF',
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.1,
                shadowRadius: 4,
                elevation: 3
              }
            ]}>
              <FontAwesome5 name="search" size={16} color={currentTheme.colors.primary} />
              <TextInput
                style={[styles.input, { color: currentTheme.colors.text }]}
                placeholder="Search everything..."
                placeholderTextColor={currentTheme.colors.textSecondary}
                value={query}
                onChangeText={handleSearch}
                autoFocus
              />
              {query.length > 0 && (
                <TouchableOpacity 
                  onPress={() => handleSearch('')}
                  style={styles.clearButton}
                >
                  <FontAwesome5 name="times" size={14} color={currentTheme.colors.textSecondary} />
                </TouchableOpacity>
              )}
            </View>
            <TouchableOpacity
              style={[styles.filterButton, { backgroundColor: isDarkMode ? '#2A2A2A' : '#FFFFFF' }]}
              onPress={() => setShowFilterModal(true)}
            >
              <FontAwesome5
                name="filter"
                size={16}
                color={activeFilter !== 'ALL' ? '#02A9FF' : currentTheme.colors.primary}
              />
            </TouchableOpacity>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <FontAwesome5 name="times" size={18} color={isDarkMode ? '#FFFFFF' : '#000000'} />
            </TouchableOpacity>
          </View>
          
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color={currentTheme.colors.primary} />
            </View>
          ) : error ? (
            <View style={styles.noResults}>
                <Text style={[styles.errorText, { color: currentTheme.colors.error || 'red' }]}>{error}</Text>
            </View>
          ) : activeFilter === 'ALL' ? (
            <SectionList
              sections={results}
              style={styles.results}
              keyboardShouldPersistTaps="handled"
              keyExtractor={(item) => `${item.type}-${item.id}`}
              renderItem={renderResultItem}
              renderSectionHeader={({ section: { title } }) => (
                <Text style={[styles.sectionTitle, { color: currentTheme.colors.textSecondary }]}>
                  {title}
                </Text>
              )}
              ListEmptyComponent={renderEmptyComponent}
            />
          ) : (
            <FlatList
              data={results[0]?.data || []}
              style={styles.results}
              keyboardShouldPersistTaps="handled"
              keyExtractor={(item) => `${item.type}-${item.id}`}
              renderItem={renderResultItem}
              ListEmptyComponent={renderEmptyComponent}
              onEndReached={loadMore}
              onEndReachedThreshold={0.5}
              ListFooterComponent={() =>
                isLoadingMore ? (
                  <View style={{ padding: 20 }}>
                    <ActivityIndicator size="small" color={currentTheme.colors.primary} />
                  </View>
                ) : null
              }
            />
          )}

        </View>
      </Modal>
      <FilterModal />
    </View>
  );
}