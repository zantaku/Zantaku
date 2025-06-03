import { View, Text, StyleSheet, TouchableOpacity, FlatList, Image, ActivityIndicator } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useAuth } from '../hooks/useAuth';
import { useState, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';
import { STORAGE_KEY } from '../constants/auth';
import { useRouter } from 'expo-router';
import { useTheme } from '../hooks/useTheme';

interface Activity {
  __typename?: string;
  id: number;
  status: string;
  progress: string;
  media: {
    id: number;
    title: {
      userPreferred: string;
    };
    coverImage: {
      medium: string;
    };
    type: 'ANIME' | 'MANGA';
  };
  createdAt: number;
}

interface ActivitiesPageProps {
  onClose?: () => void;
}

export default function ActivitiesPage({ onClose }: ActivitiesPageProps) {
  const { user } = useAuth();
  const router = useRouter();
  const { isDarkMode, currentTheme } = useTheme();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    if (user?.id) {
      fetchActivities();
    }
  }, [user?.id]);

  const fetchActivities = async (pageNumber = 1, isLoadingMore = false) => {
    if (!user?.id) return;

    try {
      if (!isLoadingMore) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }

      const token = await SecureStore.getItemAsync(STORAGE_KEY.AUTH_TOKEN);
      if (!token) {
        console.error('No auth token found');
        return;
      }

      const query = `
        query ($userId: Int, $page: Int) {
          Page(page: $page, perPage: 20) {
            pageInfo {
              hasNextPage
              total
            }
            activities(userId: $userId, sort: ID_DESC) {
              ... on ListActivity {
                __typename
                id
                status
                progress
                media {
                  id
                  title {
                    userPreferred
                  }
                  coverImage {
                    medium
                  }
                  type
                }
                createdAt
              }
            }
          }
        }
      `;

      const response = await fetch('https://graphql.anilist.co', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          query,
          variables: {
            userId: user.id,
            page: pageNumber
          }
        })
      });

      const data = await response.json();
      
      if (data?.data?.Page) {
        const validActivities = data.data.Page.activities
          .filter((activity: any): activity is Activity => {
            return activity && 
                   activity.__typename === 'ListActivity' &&
                   typeof activity.id === 'number' && 
                   activity.media?.title?.userPreferred && 
                   activity.media?.coverImage?.medium && 
                   activity.media?.type && 
                   activity.status && 
                   typeof activity.createdAt === 'number';
          });

        setActivities(prev => isLoadingMore ? [...prev, ...validActivities] : validActivities);
        setHasNextPage(data.data.Page.pageInfo.hasNextPage);
        setPage(pageNumber);
      } else {
        console.error('Invalid response format:', data);
        if (!isLoadingMore) {
          setActivities([]);
        }
      }
    } catch (error) {
      console.error('Error fetching activities:', error);
      if (!isLoadingMore) {
        setActivities([]);
      }
    } finally {
      if (isLoadingMore) {
        setLoadingMore(false);
      } else {
        setLoading(false);
      }
    }
  };

  const handleLoadMore = () => {
    if (!loadingMore && hasNextPage) {
      fetchActivities(page + 1, true);
    }
  };

  const formatTimestamp = (timestamp: number) => {
    if (!timestamp || typeof timestamp !== 'number') return '';
    
    try {
      const now = Date.now();
      const diff = now - (timestamp * 1000); // AniList timestamps are in seconds
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const days = Math.floor(hours / 24);

      if (days > 0) {
        return `${days}d ago`;
      }
      if (hours > 0) {
        return `${hours}h ago`;
      }
      const minutes = Math.floor(diff / (1000 * 60));
      return `${Math.max(1, minutes)}m ago`; // Ensure we show at least "1m ago"
    } catch (error) {
      console.error('Error formatting timestamp:', error);
      return '';
    }
  };

  const handleActivityPress = (activity: Activity) => {
    // Navigate to the appropriate detail page based on media type
    if (activity.media.type === 'ANIME') {
      router.push({
        pathname: '/anime/[id]',
        params: { 
          id: activity.media.id.toString(),
          fromActivities: '1'
        }
      });
    } else {
      router.push({
        pathname: '/manga/[id]',
        params: { 
          id: activity.media.id.toString(),
          fromActivities: '1'
        }
      });
    }
  };

  const renderActivity = ({ item }: { item: Activity }) => {
    if (!item || !item.media || typeof item.id !== 'number') {
      return null;
    }

    return (
      <TouchableOpacity 
        style={[
          styles.activityItem,
          { 
            backgroundColor: isDarkMode ? currentTheme.colors.surface : '#f8f8f8'
          }
        ]}
        onPress={() => handleActivityPress(item)}
        activeOpacity={0.7}
      >
        <Image 
          source={{ uri: item.media.coverImage?.medium }} 
          style={styles.mediaCover}
        />
        <View style={styles.activityInfo}>
          <Text style={[styles.mediaTitle, { color: currentTheme.colors.text }]} numberOfLines={1}>
            {item.media.title?.userPreferred || 'Unknown Title'}
          </Text>
          <Text style={[styles.activityDetails, { color: currentTheme.colors.textSecondary }]}>
            {item.status} {item.progress || ''}
          </Text>
          <Text style={[styles.timestamp, { color: currentTheme.colors.textSecondary }]}>
            {formatTimestamp(item.createdAt)}
          </Text>
        </View>
        <View style={[styles.typeIndicator, { 
          backgroundColor: isDarkMode ? currentTheme.colors.border : '#eee'
        }]}>
          <FontAwesome5 
            name={item.media.type === 'ANIME' ? 'play' : 'book'} 
            size={12} 
            color={currentTheme.colors.textSecondary}
          />
        </View>
      </TouchableOpacity>
    );
  };

  const keyExtractor = (item: Activity) => {
    return item && typeof item.id === 'number' ? item.id.toString() : Math.random().toString();
  };

  const renderFooter = () => {
    if (!loadingMore) return null;

    return (
      <View style={styles.loadingFooter}>
        <ActivityIndicator size="small" color={currentTheme.colors.primary} />
        <Text style={[styles.loadingText, { color: currentTheme.colors.textSecondary }]}>
          Loading more activities...
        </Text>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: currentTheme.colors.background }]}>
      {/* Activities List */}
      {loading && activities.length === 0 ? (
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={currentTheme.colors.primary} />
          <Text style={[styles.loadingText, { color: currentTheme.colors.textSecondary }]}>
            Loading activities...
          </Text>
        </View>
      ) : activities.length === 0 ? (
        <View style={styles.centerContent}>
          <Text style={{ color: currentTheme.colors.textSecondary }}>No activities found</Text>
        </View>
      ) : (
        <FlatList
          data={activities}
          renderItem={renderActivity}
          keyExtractor={keyExtractor}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.3}
          ListFooterComponent={renderFooter}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 60,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContainer: {
    padding: 16,
    paddingTop: 0,
  },
  activityItem: {
    flexDirection: 'row',
    marginBottom: 16,
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  mediaCover: {
    width: 50,
    height: 70,
    borderRadius: 6,
  },
  activityInfo: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  mediaTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  activityDetails: {
    fontSize: 13,
    marginBottom: 2,
  },
  timestamp: {
    fontSize: 12,
  },
  typeIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingFooter: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    gap: 8,
  },
  loadingText: {
    fontSize: 14,
    marginLeft: 8,
  },
}); 