import { StyleSheet, View, Text, FlatList, Image, TouchableOpacity, ActivityIndicator, Modal, ScrollView, TextInput, Platform, StatusBar, DeviceEventEmitter } from 'react-native';
import { useEffect, useState, memo } from 'react';
import axios from 'axios';
import { useAuth } from '../hooks/useAuth';
import { ANILIST_GRAPHQL_ENDPOINT } from '../constants/auth';
import { FontAwesome5 } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { getRatingColor, getStatusColor, formatScore } from '../utils/colors';
import { useTheme } from '../hooks/useTheme';
import { BlurView } from 'expo-blur';

interface MangaEntry {
  id: number;
  progress: number;
  score: number;
  status: string;
  updatedAt: number;
  media: {
    id: number;
    title: {
      userPreferred: string;
    };
    coverImage: {
      medium: string;
    };
    chapters: number;
    format: string;
    countryOfOrigin: string;
    genres: string[];
    startDate: {
      year: number;
    };
  };
}

interface Filters {
  status: string;
  format: string;
  genres: string[];
  country: string;
  year: number | null;
  sort: string;
}

const formatStatus = (status: string) => {
  return status.charAt(0) + status.slice(1).toLowerCase();
};

const getAniListStatus = (status: string) => {
  switch (status) {
    case 'Reading': return 'CURRENT';
    case 'Completed': return 'COMPLETED';
    case 'Planning': return 'PLANNING';
    case 'Dropped': return 'DROPPED';
    case 'Paused': return 'PAUSED';
    default: return 'All';
  }
};

const MemoizedMangaCard = memo(({ item, onPress }: { item: MangaEntry; onPress: () => void }) => {
  const { currentTheme } = useTheme();
  return (
    <TouchableOpacity 
      style={[styles.card, { 
        backgroundColor: currentTheme.colors.surface,
        borderColor: currentTheme.colors.border,
      }]}
      onPress={onPress}
    >
      <Image source={{ uri: item.media.coverImage.medium }} style={styles.cover} />
      <View style={styles.details}>
        <Text style={[styles.title, { color: currentTheme.colors.text }]} numberOfLines={2}>
          {item.media.title.userPreferred}
        </Text>
        <View style={styles.stats}>
          <Text style={[styles.progress, { color: currentTheme.colors.textSecondary }]}>
            Progress: {item.progress}/{item.media.chapters || '?'} Chapters
          </Text>
          <View style={styles.badges}>
            {item.score > 0 && (
              <View style={[styles.statusBadge, { backgroundColor: getRatingColor(item.score) }]}>
                <Text style={styles.statusText}>{formatScore(item.score)}</Text>
              </View>
            )}
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
              <Text style={styles.statusText}>{formatStatus(item.status)}</Text>
            </View>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
});

export default function ReadlistScreen() {
  const { user } = useAuth();
  const { isDarkMode, currentTheme } = useTheme();
  const [entries, setEntries] = useState<MangaEntry[]>([]);
  const [filteredEntries, setFilteredEntries] = useState<MangaEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<Filters>({
    status: 'All',
    format: 'All',
    genres: [],
    country: 'All',
    year: null,
    sort: 'Score',
  });
  const [collapsedSections, setCollapsedSections] = useState<{ [key: string]: boolean }>({
    lists: false,
    format: false,
    sort: false,
  });
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [scrollOffset, setScrollOffset] = useState(0);
  const router = useRouter();
  const params = useLocalSearchParams();
  const targetUserId = params.userId ? parseInt(params.userId as string) : user?.id;

  useEffect(() => {
    if (targetUserId) {
      fetchReadlist();
    }
  }, [targetUserId]);

  useEffect(() => {
    applyFilters();
  }, [filters, entries, searchQuery]);

  // Add event listener for refreshing readlist when List Editor saves data
  useEffect(() => {
    const refreshReadlistListener = DeviceEventEmitter.addListener('refreshReadlist', () => {
      console.log('[Readlist] Received refreshReadlist event, refreshing data...');
      fetchReadlist();
    });

    return () => {
      refreshReadlistListener.remove();
    };
  }, [targetUserId]);

  const fetchReadlist = async () => {
    try {
      const { data } = await axios.post(
        ANILIST_GRAPHQL_ENDPOINT,
        {
          query: `
            query ($userId: Int) {
              MediaListCollection(userId: $userId, type: MANGA) {
                lists {
                  name
                  entries {
                    id
                    progress
                    score(format: POINT_100)
                    status
                    updatedAt
                    media {
                      id
                      title {
                        userPreferred
                      }
                      coverImage {
                        medium
                      }
                      chapters
                      format
                      countryOfOrigin
                      genres
                      startDate {
                        year
                      }
                    }
                  }
                }
              }
            }
          `,
          variables: {
            userId: targetUserId
          }
        }
      );

      const allEntries = data.data.MediaListCollection?.lists?.flatMap((list: any) => list.entries) || [];
      setEntries(allEntries);
      setFilteredEntries(allEntries);
    } catch (error) {
      console.error('Error fetching readlist:', error);
      setEntries([]);
      setFilteredEntries([]);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...entries];

    // Apply sorting
    switch (filters.sort) {
      case 'Updated':
        filtered.sort((a, b) => b.updatedAt - a.updatedAt);
        break;
      case 'Score':
      default:
        filtered.sort((a, b) => (b.score || 0) - (a.score || 0));
        break;
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(entry => 
        entry.media.title.userPreferred.toLowerCase().includes(query)
      );
    }

    // Apply status filter
    if (filters.status !== 'All') {
      filtered = filtered.filter(entry => entry.status === filters.status);
    }

    // Apply format filter
    if (filters.format !== 'All') {
      filtered = filtered.filter(entry => entry.media.format === filters.format);
    }

    // Apply genre filters
    if (filters.genres.length > 0) {
      filtered = filtered.filter(entry => 
        filters.genres.every(genre => entry.media.genres.includes(genre))
      );
    }

    // Apply country filter
    if (filters.country !== 'All') {
      filtered = filtered.filter(entry => entry.media.countryOfOrigin === filters.country);
    }

    // Apply year filter
    if (filters.year) {
      filtered = filtered.filter(entry => entry.media.startDate.year === filters.year);
    }

    console.log('Current filters:', filters);
    console.log('Filtered entries:', filtered.map(e => ({ 
      title: e.media.title.userPreferred,
      status: e.status,
      format: e.media.format 
    })));

    setFilteredEntries(filtered);
  };

  const FilterSection = ({ title, options, stateKey, value, onSelect }: {
    title: string;
    options: string[];
    stateKey: 'status' | 'format' | 'sort';
    value: string;
    onSelect: (value: string) => void;
  }) => {
    const isCollapsed = collapsedSections[stateKey];
    
    return (
      <View style={styles.filterSection}>
        <TouchableOpacity 
          style={[styles.filterSectionHeader, { borderBottomColor: currentTheme.colors.border }]}
          onPress={() => setCollapsedSections(prev => ({ 
            ...prev, 
            [stateKey]: !prev[stateKey] 
          }))}
        >
          <Text style={[styles.filterTitle, { color: currentTheme.colors.text }]}>{title}</Text>
          <FontAwesome5 
            name={isCollapsed ? 'chevron-down' : 'chevron-up'} 
            size={16} 
            color={currentTheme.colors.text} 
          />
        </TouchableOpacity>
        
        {!isCollapsed && (
          <View style={styles.filterOptions}>
            {options.map((option) => (
              <TouchableOpacity
                key={option}
                style={[
                  styles.filterOption,
                  value === (stateKey === 'status' ? getAniListStatus(option) : option) && [
                    styles.filterOptionSelected,
                    { backgroundColor: currentTheme.colors.primary }
                  ]
                ]}
                onPress={() => onSelect(stateKey === 'status' ? getAniListStatus(option) : option)}
              >
                <Text style={[
                  styles.filterOptionText,
                  { color: currentTheme.colors.textSecondary },
                  value === (stateKey === 'status' ? getAniListStatus(option) : option) && styles.filterOptionTextSelected
                ]}>{option}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    );
  };

  const FilterModal = () => (
    <Modal
      animationType="slide"
      transparent={true}
      visible={showFilters}
      onRequestClose={() => setShowFilters(false)}
    >
      <View style={[styles.modalContainer, { backgroundColor: isDarkMode ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.3)' }]}>
        <View style={[styles.modalContent, { 
          backgroundColor: currentTheme.colors.background,
        }]}>
          <BlurView intensity={100} tint={isDarkMode ? "dark" : "light"} style={StyleSheet.absoluteFill} />
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: currentTheme.colors.text }]}>Filters</Text>
            <TouchableOpacity onPress={() => setShowFilters(false)}>
              <FontAwesome5 name="times" size={20} color={currentTheme.colors.text} />
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.filterScroll}>
            <FilterSection
              title="Lists"
              options={['All', 'Reading', 'Completed', 'Paused', 'Dropped', 'Planning']}
              stateKey="status"
              value={filters.status}
              onSelect={(status) => setFilters({ ...filters, status })}
            />

            <FilterSection
              title="Format"
              options={['All', 'MANGA', 'MANHWA', 'MANHUA', 'ONE_SHOT', 'NOVEL']}
              stateKey="format"
              value={filters.format}
              onSelect={(format) => setFilters({ ...filters, format })}
            />

            <FilterSection
              title="Sort"
              options={['Updated', 'Score']}
              stateKey="sort"
              value={filters.sort}
              onSelect={(sort) => setFilters({ ...filters, sort })}
            />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  const renderItem = ({ item }: { item: MangaEntry }) => (
    <MemoizedMangaCard 
      item={item} 
      onPress={() => {
        router.push({
          pathname: '/manga/[id]',
          params: { id: item.media.id }
        });
      }}
    />
  );

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: currentTheme.colors.background }]}>
        <ActivityIndicator size="large" color={currentTheme.colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: currentTheme.colors.background }]}>
      <View style={[styles.searchHeader, { backgroundColor: currentTheme.colors.background }]}>
        <View style={[
          styles.searchBar,
          { backgroundColor: isDarkMode ? '#2A2A2A' : '#FFFFFF' }
        ]}>
          <FontAwesome5 name="search" size={16} color={currentTheme.colors.primary} />
          <TextInput
            style={[styles.searchInput, { color: currentTheme.colors.text }]}
            placeholder="Search your readlist..."
            placeholderTextColor={currentTheme.colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity 
              onPress={() => setSearchQuery('')}
              style={styles.clearButton}
            >
              <FontAwesome5 name="times" size={14} color={currentTheme.colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          style={[styles.filterButton, { backgroundColor: isDarkMode ? '#2A2A2A' : '#FFFFFF' }]}
          onPress={() => setShowFilters(true)}
        >
          <FontAwesome5
            name="filter"
            size={16}
            color={Object.values(filters).some(f => 
              Array.isArray(f) ? f.length > 0 : f !== null
            ) ? '#02A9FF' : currentTheme.colors.primary}
          />
        </TouchableOpacity>
      </View>

      <FlatList
        data={filteredEntries}
        renderItem={renderItem}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={[
          styles.listContainer,
          { paddingTop: 0 }
        ]}
        onScroll={event => {
          setScrollOffset(event.nativeEvent.contentOffset.y);
        }}
        scrollEventThrottle={16}
        removeClippedSubviews={true}
        maxToRenderPerBatch={10}
        windowSize={5}
        initialNumToRender={8}
        updateCellsBatchingPeriod={30}
      />
      
      <FilterModal />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    flexDirection: 'row',
    borderRadius: 12,
    marginBottom: 12,
    padding: 12,
    borderWidth: 1,
  },
  cover: {
    width: 70,
    height: 100,
    borderRadius: 8,
  },
  details: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
    lineHeight: 22,
  },
  stats: {
    gap: 8,
  },
  progress: {
    fontSize: 14,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    padding: 20,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
  },
  filterScroll: {
    maxHeight: '90%',
  },
  filterSection: {
    marginBottom: 24,
  },
  filterTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  filterOption: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 8,
  },
  filterOptionSelected: {
    backgroundColor: '#02A9FF',
  },
  filterOptionText: {
    fontSize: 15,
  },
  filterOptionTextSelected: {
    color: '#fff',
    fontWeight: '600',
  },
  listContainer: {
    padding: 16,
    paddingTop: Platform.OS === 'ios' ? 100 : (StatusBar.currentHeight || 24) + 80,
  },
  filterSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    marginBottom: 12,
  },
  filterOptions: {
    marginTop: 8,
  },
  headerButtons: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : (StatusBar.currentHeight || 24) + 20,
    left: 16,
    right: 16,
    zIndex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerButtonsRight: {
    flexDirection: 'row',
    gap: 12,
  },
  headerButtonsScrolled: {
    backgroundColor: 'transparent',
  },
  headerButton: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  searchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: Platform.OS === 'ios' ? 100 : 60,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
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
  searchInput: {
    flex: 1,
    fontSize: 15,
    marginLeft: 8,
    marginRight: 8,
  },
  clearButton: {
    padding: 4,
  },
  filterButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
  },
  badges: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
}); 