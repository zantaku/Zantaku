import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';
import { useTheme } from '../hooks/useTheme';
import { Image as ExpoImage } from 'expo-image';
import Modal from 'react-native-modal';
import { useAuth } from '../hooks/useAuth';
import { STORAGE_KEY } from '../constants/auth';

interface NotificationHistoryItem {
  id: string;
  type: 'airing' | 'media' | 'activity' | 'follows';
  title: string;
  animeId?: number;
  mangaId?: string;
  episode?: number;
  chapter?: number;
  timestamp: number;
  read: boolean;
  image?: string;
  media?: {
    id: number;
    title: string;
    coverImage?: string;
    type: 'ANIME' | 'MANGA';
  };
  username?: string;
  action?: string;
}

interface NotificationSubscription {
  id: string;
  type: 'anime' | 'manga';
  title: string;
  lastKnownNumber: number;
  anilistId?: string;
  manganatoId?: string;
}

const ANILIST_API = 'https://graphql.anilist.co';

const GET_NOTIFICATIONS = `
  query GetNotifications {
    Page(page: 1, perPage: 25) {
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
            }
          }
        }
        ... on MediaDataChangeNotification {
          id
          type
          mediaId
          context
          createdAt
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
        ... on ActivityLikeNotification {
          id
          type
          userId
          context
          createdAt
          user {
            name
            avatar {
              medium
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
            name
            avatar {
              medium
            }
          }
        }
      }
    }
  }
`;

export default function NotificationHistoryScreen() {
  const router = useRouter();
  const { isDarkMode, currentTheme } = useTheme();
  const [notifications, setNotifications] = useState<NotificationHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'airing' | 'activity' | 'follows' | 'media'>('all');
  const [activeSubscriptions, setActiveSubscriptions] = useState<{
    anime: number;
    manga: number;
  }>({ anime: 0, manga: 0 });
  const [showFilterModal, setShowFilterModal] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      loadNotifications();
    }
    loadActiveSubscriptions();
  }, [user]);

  const loadActiveSubscriptions = async () => {
    try {
      const subscriptionsData = await SecureStore.getItemAsync('notification_subscriptions');
      if (subscriptionsData) {
        const subscriptions: NotificationSubscription[] = JSON.parse(subscriptionsData);
        const animeCount = subscriptions.filter(sub => sub.type === 'anime').length;
        const mangaCount = subscriptions.filter(sub => sub.type === 'manga').length;
        setActiveSubscriptions({ anime: animeCount, manga: mangaCount });
      }
    } catch (error) {
      console.error('Error loading active subscriptions:', error);
    }
  };

  const loadNotifications = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      const token = await SecureStore.getItemAsync(STORAGE_KEY.AUTH_TOKEN);
      if (!token) {
        console.error('No auth token found');
        setLoading(false);
        return;
      }

      const response = await fetch(ANILIST_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          query: GET_NOTIFICATIONS,
        }),
      });

      const data = await response.json();
      
      if (data.data?.Page?.notifications) {
        const anilistNotifications = data.data.Page.notifications
          .filter((notif: any) => notif && notif.id)
          .map((notif: any) => {
          let type: 'airing' | 'media' | 'activity' | 'follows';
          switch (notif.type) {
            case 'AIRING':
              type = 'airing';
              break;
            case 'MEDIA_DATA_CHANGE':
              type = 'media';
              break;
            case 'ACTIVITY_LIKE':
              type = 'activity';
              break;
            case 'FOLLOWING':
              type = 'follows';
              break;
            default:
              type = 'media';
          }

          return {
            id: String(notif.id || `${type}-${Date.now()}-${Math.random()}`),
            type,
            title: notif.media?.title?.userPreferred || '',
            animeId: notif.animeId || notif.mediaId,
            episode: notif.episode,
            timestamp: notif.createdAt * 1000,
            read: false,
            image: notif.media?.coverImage?.medium || notif.user?.avatar?.medium,
            username: notif.user?.name,
            action: notif.context,
            media: notif.media ? {
              id: notif.media.id,
              title: notif.media.title.userPreferred,
              coverImage: notif.media.coverImage?.medium,
              type: 'ANIME'
            } : undefined
          };
        });

        setNotifications(anilistNotifications);
      }
    } catch (error) {
      console.error('Error fetching AniList notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatTimestamp = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const weeks = Math.floor(days / 7);

    if (weeks > 0) {
      return `${weeks} weeks ago`;
    }
    if (days > 0) {
      return `${days} days ago`;
    }
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours > 0) {
      return `${hours}h ago`;
    }
    const minutes = Math.floor(diff / (1000 * 60));
    return `${minutes}m ago`;
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'airing':
        return 'tv';
      case 'media':
        return 'plus';
      case 'activity':
        return 'heart';
      case 'follows':
        return 'user-plus';
      default:
        return 'bell';
    }
  };

  const getNotificationText = (item: NotificationHistoryItem) => {
    switch (item.type) {
      case 'airing':
        if (item.episode) {
          return {
            main: item.title,
            secondary: `Episode ${item.episode} aired`
          };
        } else if (item.chapter) {
          return {
            main: item.title,
            secondary: `Chapter ${item.chapter} released`
          };
        }
        return { main: item.title };
      case 'media':
        return {
          main: item.title,
          secondary: 'was recently added to the site'
        };
      case 'activity':
        return {
          main: item.username || '',
          secondary: item.action || 'liked your activity'
        };
      case 'follows':
        return {
          main: item.username || '',
          secondary: 'started following you'
        };
      default:
        return { main: item.title };
    }
  };

  const filteredNotifications = notifications.filter(item => 
    selectedFilter === 'all' || item.type === selectedFilter
  );

  const renderFilterOption = (filter: 'all' | 'airing' | 'activity' | 'follows' | 'media', label: string) => (
    <TouchableOpacity
      style={[
        styles.filterOption,
        selectedFilter === filter && [
          styles.filterOptionActive,
          { backgroundColor: isDarkMode ? 'rgba(2, 169, 255, 0.1)' : 'rgba(2, 169, 255, 0.06)' }
        ]
      ]}
      onPress={() => {
        setSelectedFilter(filter);
        setShowFilterModal(false);
      }}
      activeOpacity={0.7}
    >
      <Text
        style={[
          styles.filterOptionText,
          { color: currentTheme.colors.text },
          selectedFilter === filter && [
            styles.filterOptionTextActive,
            { color: '#02A9FF' }
          ]
        ]}
      >
        {label}
      </Text>
      {selectedFilter === filter && (
        <FontAwesome5
          name="check"
          size={14}
          color="#02A9FF"
          style={styles.checkIcon}
        />
      )}
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: isDarkMode ? '#000000' : '#FFFFFF' }]}>
      <View style={[
        styles.header,
        {
          backgroundColor: isDarkMode ? '#000000' : '#FFFFFF',
          borderBottomColor: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)'
        }
      ]}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <FontAwesome5 name="arrow-left" size={20} color={currentTheme.colors.text} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: currentTheme.colors.text }]}>
            Notifications
          </Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.filterButton}
            onPress={() => setShowFilterModal(true)}
          >
            <Text style={styles.filterButtonText}>
              All
            </Text>
            <FontAwesome5 name="chevron-down" size={12} color="#02A9FF" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.markAllButton}>
            <Text style={styles.markAllText}>Mark all as read</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={[styles.content, { backgroundColor: isDarkMode ? '#000000' : '#FFFFFF' }]} contentContainerStyle={{ paddingBottom: 24 }}>
        {filteredNotifications.length === 0 ? (
          <Text style={[styles.emptyText, { color: currentTheme.colors.textSecondary }]}>
            No notifications
          </Text>
        ) : (
          filteredNotifications.map((item) => (
            <TouchableOpacity
              key={`${item.type}-${item.id}`}
              style={[
                styles.notificationItem,
                { 
                  backgroundColor: isDarkMode ? '#000000' : '#FFFFFF',
                  borderBottomColor: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)'
                },
                !item.read && {
                  backgroundColor: isDarkMode ? 
                    'rgba(2, 169, 255, 0.1)' : 
                    'rgba(2, 169, 255, 0.05)'
                }
              ]}
            >
              {item.image ? (
                <ExpoImage
                  source={{ uri: item.image }}
                  style={styles.notificationImage}
                  contentFit="cover"
                  transition={200}
                />
              ) : (
                <View style={[
                  styles.notificationIcon,
                  { backgroundColor: isDarkMode ? '#1A1A1A' : 'rgba(0, 0, 0, 0.05)' }
                ]}>
                  <FontAwesome5
                    name={getNotificationIcon(item.type)}
                    size={16}
                    color="#02A9FF"
                    solid
                  />
                </View>
              )}
              <View style={styles.notificationContent}>
                <Text style={[
                  styles.notificationMainText,
                  { color: currentTheme.colors.text }
                ]}>
                  {getNotificationText(item).main}
                </Text>
                {getNotificationText(item).secondary && (
                  <Text style={[
                    styles.notificationSecondaryText,
                    { color: currentTheme.colors.textSecondary }
                  ]}>
                    {getNotificationText(item).secondary}
                  </Text>
                )}
                <Text style={[
                  styles.timestamp,
                  { color: currentTheme.colors.textSecondary }
                ]}>
                  {formatTimestamp(item.timestamp)}
                </Text>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      <Modal
        isVisible={showFilterModal}
        onBackdropPress={() => setShowFilterModal(false)}
        backdropOpacity={0.5}
        style={styles.modal}
        animationIn="slideInUp"
        animationOut="slideOutDown"
        hideModalContentWhileAnimating={true}
        useNativeDriver={true}
      >
        <View style={[
          styles.filterModal,
          { backgroundColor: isDarkMode ? '#151515' : '#FFFFFF' }
        ]}>
          {renderFilterOption('all', 'All')}
          {renderFilterOption('airing', 'Airing')}
          {renderFilterOption('activity', 'Activity')}
          {renderFilterOption('follows', 'Follows')}
          {renderFilterOption('media', 'Media')}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 60 : 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 24,
  },
  backButton: {
    padding: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#02A9FF',
  },
  markAllButton: {
    paddingVertical: 4,
  },
  markAllText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#02A9FF',
    opacity: 0.9,
  },
  content: {
    flex: 1,
  },
  notificationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  notificationImage: {
    width: 40,
    height: 40,
    borderRadius: 4,
  },
  notificationIcon: {
    width: 40,
    height: 40,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationContent: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
  },
  notificationMainText: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '600',
  },
  notificationSecondaryText: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '400',
    marginTop: 1,
  },
  timestamp: {
    fontSize: 12,
    marginTop: 4,
    fontWeight: '500',
    opacity: 0.7,
  },
  emptyText: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
    padding: 24,
    opacity: 0.7,
  },
  modal: {
    margin: 0,
    justifyContent: 'flex-end',
  },
  filterModal: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    overflow: 'hidden',
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 34 : 24,
  },
  filterOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  filterOptionActive: {
    // Remove the backgroundColor from here as we're applying it dynamically
  },
  filterOptionText: {
    fontSize: 15,
    fontWeight: '500',
  },
  filterOptionTextActive: {
    fontWeight: '600',
  },
  checkIcon: {
    marginLeft: 8,
  },
}); 