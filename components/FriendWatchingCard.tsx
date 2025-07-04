import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { FontAwesome5 } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../hooks/useTheme';

interface FriendWatchingProps {
  friendData: {
    userId: number;
    userName: string;
    userAvatar: string;
    media: {
      id: number;
      title: {
        userPreferred: string;
        english: string;
        romaji: string;
      };
      coverImage: {
        large: string;
      };
    };
    progress: number;
  }[];
}

export const FriendWatchingCard: React.FC<FriendWatchingProps> = ({ friendData }) => {
  const router = useRouter();
  const { isDarkMode, currentTheme } = useTheme();

  if (!friendData || friendData.length === 0) {
    return (
      <View style={[styles.emptyCard, { backgroundColor: currentTheme.colors.surface }]}>
        <FontAwesome5 name="user-friends" size={24} color={currentTheme.colors.textSecondary} />
        <Text style={[styles.emptyText, { color: currentTheme.colors.textSecondary }]}>
          Connect with friends to see what they're watching
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {friendData.slice(0, 3).map((item, index) => (
        <TouchableOpacity
          key={`${item.userId}-${item.media.id}`}
          style={[
            styles.friendCard,
            {
              backgroundColor: currentTheme.colors.surface,
              shadowColor: isDarkMode ? '#000' : '#666',
              marginBottom: index < 2 ? 12 : 0
            }
          ]}
          onPress={() => router.push(`/anime/${item.media.id}`)}
          activeOpacity={0.7}
        >
          <View style={styles.friendHeader}>
            <ExpoImage
              source={{ uri: item.userAvatar }}
              style={[styles.userAvatar, { borderColor: currentTheme.colors.primary }]}
              contentFit="cover"
            />
            <View style={styles.friendInfo}>
              <Text style={[styles.friendName, { color: currentTheme.colors.primary }]}>
                {item.userName}
              </Text>
              <Text style={[styles.activityText, { color: currentTheme.colors.textSecondary }]}>
                watching episode {item.progress}
              </Text>
            </View>
            <View style={[styles.activityBadge, { backgroundColor: currentTheme.colors.primary + '20' }]}>
              <FontAwesome5 name="play" size={10} color={currentTheme.colors.primary} />
            </View>
          </View>

          <View style={styles.animeContent}>
            <ExpoImage
              source={{ uri: item.media.coverImage.large }}
              style={styles.animeImage}
              contentFit="cover"
              transition={300}
            />
            <View style={styles.animeInfo}>
              <Text style={[styles.animeTitle, { color: currentTheme.colors.text }]} numberOfLines={2}>
                {item.media.title.english || item.media.title.userPreferred}
              </Text>
              
              <View style={styles.progressSection}>
                <View style={styles.progressInfo}>
                  <FontAwesome5 name="clock" size={8} color="#FF9800" />
                  <Text style={[styles.progressText, { color: currentTheme.colors.textSecondary }]}>
                    Episode {item.progress}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </TouchableOpacity>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
  },
  friendCard: {
    borderRadius: 16,
    padding: 16,
    ...Platform.select({
      ios: {
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  friendHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  userAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
  },
  friendInfo: {
    flex: 1,
    marginLeft: 12,
  },
  friendName: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  activityText: {
    fontSize: 11,
    fontWeight: '500',
  },
  activityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  animeContent: {
    flexDirection: 'row',
  },
  animeImage: {
    width: 60,
    height: 85,
    borderRadius: 8,
  },
  animeInfo: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'space-between',
  },
  animeTitle: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 18,
    marginBottom: 4,
  },
  progressSection: {
    marginTop: 'auto',
  },
  progressInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  progressText: {
    fontSize: 11,
    fontWeight: '600',
  },
  emptyCard: {
    padding: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 20,
    gap: 12,
  },
  emptyText: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 20,
  },
}); 