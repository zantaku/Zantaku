import React, { useEffect, useState, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  Platform, 
  RefreshControl,
  ActivityIndicator,
  Image,
  DeviceEventEmitter
} from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as SecureStore from 'expo-secure-store';
import { useTheme } from '../hooks/useTheme';
import { useAuth } from '../hooks/useAuth';
import { STORAGE_KEY, ANILIST_GRAPHQL_ENDPOINT } from '../constants/auth';
import axios from 'axios';

interface NotificationItem {
  id: string;
  type: 'AIRING' | 'MEDIA_DATA_CHANGE' | 'ACTIVITY_LIKE' | 'ACTIVITY_REPLY' | 'FOLLOWING' | 'ACTIVITY_MESSAGE' | 'MEDIA_MERGE' | 'MEDIA_DELETION';
  title: string;
  subtitle?: string;
  timestamp: number;
  read: boolean;
  image?: string;
  media?: {
    id: number;
    title: string;
    coverImage?: string;
    type: 'ANIME' | 'MANGA';
  };
  user?: {
    id: number;
    name: string;
    avatar?: string;
  };
  episode?: number;
  chapter?: number;
  context?: string;
  contexts?: string[];
}

// Storage key for read notifications
const READ_NOTIFICATIONS_KEY = 'read_notifications';

const GET_NOTIFICATIONS_QUERY = `
  query GetNotifications($page: Int, $perPage: Int) {
    Page(page: $page, perPage: $perPage) {
      pageInfo {
        total
        currentPage
        lastPage
        hasNextPage
        perPage
      }
      notifications {
        ... on AiringNotification {
          id
          type
          animeId
          episode
          contexts
          createdAt
          media {
            id
            title {
              userPreferred
            }
            coverImage {
              medium
              large
            }
            type
          }
        }
        ... on MediaDataChangeNotification {
          id
          type
          mediaId
          context
          reason
          createdAt
          media {
            id
            title {
              userPreferred
            }
            coverImage {
              medium
              large
            }
            type
          }
        }
        ... on ActivityLikeNotification {
          id
          type
          userId
          context
          createdAt
          user {
            id
            name
            avatar {
              medium
            }
          }
          activity {
            ... on TextActivity {
              id
              text
            }
            ... on ListActivity {
              id
              status
              media {
                id
                title {
                  userPreferred
                }
                coverImage {
                  medium
                }
              }
            }
          }
        }
        ... on ActivityReplyNotification {
          id
          type
          userId
          context
          createdAt
          user {
            id
            name
            avatar {
              medium
            }
          }
          activity {
            ... on TextActivity {
              id
              text
            }
            ... on ListActivity {
              id
              status
              media {
                id
                title {
                  userPreferred
                }
                coverImage {
                  medium
                }
              }
            }
          }
        }
        ... on FollowingNotification {
          id
          type
          userId
          context
          createdAt
          user {
            id
            name
            avatar {
              medium
            }
          }
        }
        ... on ActivityMessageNotification {
          id
          type
          userId
          context
          createdAt
          user {
            id
            name
            avatar {
              medium
            }
          }
          message {
            id
            message
          }
        }
        ... on MediaMergeNotification {
          id
          type
          mediaId
          context
          reason
          createdAt
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
        }
        ... on MediaDeletionNotification {
          id
          type
          context
          reason
          createdAt
          deletedMediaTitle
        }
      }
    }
  }
`;

export default function NotificationsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isDarkMode, currentTheme } = useTheme();
  const { user } = useAuth();
  
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [readNotifications, setReadNotifications] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (user && !user.isAnonymous) {
      loadReadNotifications();
      loadNotifications();
    } else {
      setLoading(false);
    }
  }, [user]);

  // Load read notifications from storage
  const loadReadNotifications = async () => {
    try {
      const readIds = await SecureStore.getItemAsync(READ_NOTIFICATIONS_KEY);
      if (readIds) {
        setReadNotifications(new Set(JSON.parse(readIds)));
      }
    } catch (error) {
      console.error('Error loading read notifications:', error);
    }
  };

  // Save read notifications to storage
  const saveReadNotifications = async (readIds: Set<string>) => {
    try {
      await SecureStore.setItemAsync(READ_NOTIFICATIONS_KEY, JSON.stringify([...readIds]));
    } catch (error) {
      console.error('Error saving read notifications:', error);
    }
  };

  // Clear all notifications (mark as read)
  const clearAllNotifications = useCallback(async () => {
    const allIds = new Set(notifications.map(n => n.id));
    setReadNotifications(allIds);
    await saveReadNotifications(allIds);
    
    // Update the notifications to show as read
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    
    // Emit event to update the badge count in AppSettingsModal
    DeviceEventEmitter.emit('notificationsCleared');
  }, [notifications]);

  // Listen for clear notifications event
  useEffect(() => {
    const clearListener = DeviceEventEmitter.addListener('clearNotifications', clearAllNotifications);
    return () => clearListener.remove();
  }, [clearAllNotifications]);

  const loadNotifications = async (pageNum: number = 1, isRefresh: boolean = false) => {
    if (!user || user.isAnonymous) return;

    try {
      if (isRefresh) {
        setRefreshing(true);
      } else if (pageNum === 1) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }

      const token = await SecureStore.getItemAsync(STORAGE_KEY.AUTH_TOKEN);
      if (!token) {
        console.error('No auth token found');
        return;
      }

      const response = await axios.post(
        ANILIST_GRAPHQL_ENDPOINT,
        {
          query: GET_NOTIFICATIONS_QUERY,
          variables: {
            page: pageNum,
            perPage: 25
          }
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Authorization': `Bearer ${token}`,
          }
        }
      );

      if (response.data?.errors) {
        console.error('GraphQL errors:', response.data.errors);
        return;
      }

      const data = response.data?.data;
      if (data?.Page?.notifications) {
        const fetchedNotifications = data.Page.notifications
          .filter((notif: any) => notif && notif.id)
          .map((notif: any) => mapNotificationData(notif));

        // Mark notifications as read/unread based on stored data
        const notificationsWithReadStatus = fetchedNotifications.map((notif: NotificationItem) => ({
          ...notif,
          read: readNotifications.has(notif.id)
        }));

        if (pageNum === 1 || isRefresh) {
          setNotifications(notificationsWithReadStatus);
        } else {
          setNotifications(prev => [...prev, ...notificationsWithReadStatus]);
        }

        setPage(pageNum);
        setHasNextPage(data.Page.pageInfo?.hasNextPage || false);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  };

  const mapNotificationData = (notif: any): NotificationItem => {
    const baseNotification = {
      id: String(notif.id),
      type: notif.type,
      timestamp: notif.createdAt * 1000,
      read: false, // AniList doesn't provide read status in this query
    };

    switch (notif.type) {
      case 'AIRING':
        return {
          ...baseNotification,
          title: `Episode ${notif.episode} of ${notif.media?.title?.userPreferred || 'Unknown'} aired`,
          subtitle: 'New episode available',
          image: notif.media?.coverImage?.medium || notif.media?.coverImage?.large,
          media: notif.media ? {
            id: notif.media.id,
            title: notif.media.title.userPreferred,
            coverImage: notif.media.coverImage?.medium,
            type: notif.media.type
          } : undefined,
          episode: notif.episode,
        };

      case 'MEDIA_DATA_CHANGE':
        return {
          ...baseNotification,
          title: `${notif.media?.title?.userPreferred || 'Media'} information updated`,
          subtitle: notif.reason || 'Media data changed',
          image: notif.media?.coverImage?.medium || notif.media?.coverImage?.large,
          media: notif.media ? {
            id: notif.media.id,
            title: notif.media.title.userPreferred,
            coverImage: notif.media.coverImage?.medium,
            type: notif.media.type
          } : undefined,
          context: notif.context,
        };

      case 'ACTIVITY_LIKE':
        return {
          ...baseNotification,
          title: `${notif.user?.name || 'Someone'} liked your activity`,
          subtitle: 'Activity interaction',
          image: notif.user?.avatar?.medium,
          user: notif.user ? {
            id: notif.user.id,
            name: notif.user.name,
            avatar: notif.user.avatar?.medium
          } : undefined,
          context: notif.context,
        };

      case 'ACTIVITY_REPLY':
        return {
          ...baseNotification,
          title: `${notif.user?.name || 'Someone'} replied to your activity`,
          subtitle: 'New reply',
          image: notif.user?.avatar?.medium,
          user: notif.user ? {
            id: notif.user.id,
            name: notif.user.name,
            avatar: notif.user.avatar?.medium
          } : undefined,
          context: notif.context,
        };

      case 'FOLLOWING':
        return {
          ...baseNotification,
          title: `${notif.user?.name || 'Someone'} started following you`,
          subtitle: 'New follower',
          image: notif.user?.avatar?.medium,
          user: notif.user ? {
            id: notif.user.id,
            name: notif.user.name,
            avatar: notif.user.avatar?.medium
          } : undefined,
          context: notif.context,
        };

      case 'ACTIVITY_MESSAGE':
        return {
          ...baseNotification,
          title: `${notif.user?.name || 'Someone'} sent you a message`,
          subtitle: 'New message',
          image: notif.user?.avatar?.medium,
          user: notif.user ? {
            id: notif.user.id,
            name: notif.user.name,
            avatar: notif.user.avatar?.medium
          } : undefined,
          context: notif.context,
        };

      case 'MEDIA_MERGE':
        return {
          ...baseNotification,
          title: `${notif.media?.title?.userPreferred || 'Media'} was merged`,
          subtitle: notif.reason || 'Media merge',
          image: notif.media?.coverImage?.medium || notif.media?.coverImage?.large,
          media: notif.media ? {
            id: notif.media.id,
            title: notif.media.title.userPreferred,
            coverImage: notif.media.coverImage?.medium,
            type: notif.media.type
          } : undefined,
          context: notif.context,
        };

      case 'MEDIA_DELETION':
        return {
          ...baseNotification,
          title: `${notif.deletedMediaTitle || 'Media'} was deleted`,
          subtitle: notif.reason || 'Media deletion',
          context: notif.context,
        };

      default:
        return {
          ...baseNotification,
          title: 'New notification',
          subtitle: 'Check AniList for details',
        };
    }
  };

  const onRefresh = useCallback(() => {
    loadNotifications(1, true);
  }, []);

  const loadMore = useCallback(() => {
    if (hasNextPage && !loadingMore) {
      loadNotifications(page + 1);
    }
  }, [hasNextPage, loadingMore, page]);

  const formatTimestamp = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return new Date(timestamp).toLocaleDateString();
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'AIRING': return 'tv';
      case 'MEDIA_DATA_CHANGE': return 'edit';
      case 'ACTIVITY_LIKE': return 'heart';
      case 'ACTIVITY_REPLY': return 'comment';
      case 'FOLLOWING': return 'user-plus';
      case 'ACTIVITY_MESSAGE': return 'envelope';
      case 'MEDIA_MERGE': return 'code-branch';
      case 'MEDIA_DELETION': return 'trash';
      default: return 'bell';
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'AIRING': return '#02A9FF';
      case 'MEDIA_DATA_CHANGE': return '#FF9500';
      case 'ACTIVITY_LIKE': return '#FF3B30';
      case 'ACTIVITY_REPLY': return '#34C759';
      case 'FOLLOWING': return '#007AFF';
      case 'ACTIVITY_MESSAGE': return '#5856D6';
      case 'MEDIA_MERGE': return '#FF9500';
      case 'MEDIA_DELETION': return '#FF3B30';
      default: return '#8E8E93';
    }
  };

  const handleNotificationPress = async (notification: NotificationItem) => {
    // Mark notification as read
    if (!notification.read) {
      const newReadNotifications = new Set(readNotifications);
      newReadNotifications.add(notification.id);
      setReadNotifications(newReadNotifications);
      await saveReadNotifications(newReadNotifications);
      
      // Update the notification in the list
      setNotifications(prev => prev.map(n => 
        n.id === notification.id ? { ...n, read: true } : n
      ));
      
      // Emit event to update the badge count
      DeviceEventEmitter.emit('notificationRead');
    }
    
    // Navigate based on notification type
    if (notification.media) {
      const mediaType = notification.media.type.toLowerCase();
      router.push(`/${mediaType}/${notification.media.id}`);
    } else if (notification.user) {
      // Could navigate to user profile if implemented
      console.log('Navigate to user profile:', notification.user.id);
    }
  };

  if (!user || user.isAnonymous) {
    return (
      <View style={[styles.container, { backgroundColor: isDarkMode ? '#121212' : '#FFFFFF', paddingTop: insets.top + 60 }]}>
        <View style={styles.emptyContainer}>
          <FontAwesome5 name="bell-slash" size={64} color="#8E8E93" />
          <Text style={[styles.emptyTitle, { color: isDarkMode ? '#FFFFFF' : '#000000' }]}>
            Login Required
          </Text>
          <Text style={[styles.emptySubtitle, { color: isDarkMode ? '#8E8E93' : '#666666' }]}>
            Please login with AniList to view your notifications
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: isDarkMode ? '#121212' : '#FFFFFF', paddingTop: insets.top + 60 }]}>

      {/* Content */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#02A9FF" />
          <Text style={[styles.loadingText, { color: isDarkMode ? '#8E8E93' : '#666666' }]}>
            Loading notifications...
          </Text>
        </View>
      ) : notifications.length === 0 ? (
        <View style={styles.emptyContainer}>
          <FontAwesome5 name="bell" size={64} color="#8E8E93" />
          <Text style={[styles.emptyTitle, { color: isDarkMode ? '#FFFFFF' : '#000000' }]}>
            No Notifications
          </Text>
          <Text style={[styles.emptySubtitle, { color: isDarkMode ? '#8E8E93' : '#666666' }]}>
            You're all caught up! New notifications will appear here.
          </Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 20 }]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#02A9FF"
              colors={['#02A9FF']}
            />
          }
          onScroll={({ nativeEvent }) => {
            const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
            const isCloseToBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - 20;
            if (isCloseToBottom && hasNextPage && !loadingMore) {
              loadMore();
            }
          }}
          scrollEventThrottle={400}
        >
          {notifications.map((notification, index) => (
            <TouchableOpacity
              key={notification.id}
              style={[
                styles.notificationItem,
                { backgroundColor: isDarkMode ? '#1E1E1E' : '#F8F8F8' },
                !notification.read && { 
                  backgroundColor: isDarkMode ? '#2A2A2A' : '#EEF7FF',
                  borderLeftWidth: 4,
                  borderLeftColor: '#02A9FF'
                },
                index === notifications.length - 1 && { marginBottom: 0 }
              ]}
              onPress={() => handleNotificationPress(notification)}
              activeOpacity={0.7}
            >
              <View style={styles.notificationContent}>
                <View style={styles.notificationLeft}>
                  {notification.image ? (
                    <Image
                      source={{ uri: notification.image }}
                      style={styles.notificationImage}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={[
                      styles.notificationIconContainer,
                      { backgroundColor: getNotificationColor(notification.type) }
                    ]}>
                      <FontAwesome5
                        name={getNotificationIcon(notification.type)}
                        size={16}
                        color="#FFFFFF"
                      />
                    </View>
                  )}
                </View>

                <View style={styles.notificationRight}>
                  <Text style={[styles.notificationTitle, { color: isDarkMode ? '#FFFFFF' : '#000000' }]}>
                    {notification.title}
                  </Text>
                  {notification.subtitle && (
                    <Text style={[styles.notificationSubtitle, { color: isDarkMode ? '#8E8E93' : '#666666' }]}>
                      {notification.subtitle}
                    </Text>
                  )}
                  <Text style={[styles.notificationTime, { color: isDarkMode ? '#666666' : '#8E8E93' }]}>
                    {formatTimestamp(notification.timestamp)}
                  </Text>
                </View>

                <View style={styles.notificationArrow}>
                  {!notification.read && (
                    <View style={styles.unreadDot} />
                  )}
                  <FontAwesome5
                    name="chevron-right"
                    size={14}
                    color={isDarkMode ? '#666666' : '#8E8E93'}
                  />
                </View>
              </View>
            </TouchableOpacity>
          ))}

          {loadingMore && (
            <View style={styles.loadMoreContainer}>
              <ActivityIndicator size="small" color="#02A9FF" />
              <Text style={[styles.loadMoreText, { color: isDarkMode ? '#8E8E93' : '#666666' }]}>
                Loading more...
              </Text>
            </View>
          )}
        </ScrollView>
      )}
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
    paddingHorizontal: 20,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginTop: 24,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  notificationItem: {
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
  },
  notificationContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  notificationLeft: {
    marginRight: 12,
  },
  notificationImage: {
    width: 50,
    height: 50,
    borderRadius: 8,
  },
  notificationIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notificationRight: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
    lineHeight: 20,
  },
  notificationSubtitle: {
    fontSize: 14,
    marginBottom: 4,
    lineHeight: 18,
  },
  notificationTime: {
    fontSize: 12,
    lineHeight: 16,
  },
  notificationArrow: {
    marginLeft: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#02A9FF',
    marginRight: 8,
  },
  loadMoreContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
  },
  loadMoreText: {
    marginLeft: 8,
    fontSize: 14,
  },
}); 