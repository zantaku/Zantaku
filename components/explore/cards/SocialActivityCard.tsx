import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { FontAwesome5 } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

interface SocialActivityCardProps {
  data: {
    activities?: any[];
    title?: string;
    subtitle?: string;
    showFollowButton?: boolean;
    isInteractive?: boolean;
  } | any[];
  theme: any;
  isDarkMode: boolean;
}

export default function SocialActivityCard({ data, theme, isDarkMode }: SocialActivityCardProps) {
  const router = useRouter();
  
  // Handle both old array format and new object format
  const activities = Array.isArray(data) ? data : (data?.activities || []);
  const title = Array.isArray(data) ? 'Friend Activity' : (data?.title || 'Friend Activity');
  const subtitle = Array.isArray(data) ? 'What your friends are watching' : (data?.subtitle || 'What your friends are watching');

  if (!activities || activities.length === 0) return null;

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View>
                  <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>{title}</Text>
        <Text style={[styles.sectionSubtitle, { color: theme.colors.textSecondary }]}>
          {subtitle}
        </Text>
        </View>
      </View>
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {activities.map((activity: any) => {
          const timeAgo = new Date(activity.createdAt * 1000).toLocaleDateString();
          const statusText = activity.status === 'completed' ? 'completed' : 
                           activity.status === 'current' ? `watching ep ${activity.progress}` :
                           activity.status === 'planning' ? 'added to plan to watch' :
                           activity.status === 'dropped' ? 'dropped' : 'updated';

          return (
            <TouchableOpacity 
              key={activity.id}
              style={[
                styles.socialActivityCard,
                { 
                  backgroundColor: theme.colors.surface,
                  shadowColor: isDarkMode ? '#000' : '#666'
                }
              ]}
              onPress={() => router.push(`/anime/${activity.media.id}`)}
              activeOpacity={0.7}
            >
              <View style={styles.socialActivityHeader}>
                <ExpoImage
                  source={{ uri: activity.user.avatar.medium }}
                  style={styles.socialUserAvatar}
                  contentFit="cover"
                />
                <View style={styles.socialActivityText}>
                  <Text style={[styles.socialUserName, { color: theme.colors.primary }]}>
                    {activity.user.name}
                  </Text>
                  <Text style={[styles.socialActivityStatus, { color: theme.colors.textSecondary }]}>
                    {statusText}
                  </Text>
                </View>
              </View>
              <ExpoImage
                source={{ uri: activity.media.coverImage.large }}
                style={styles.socialActivityImage}
                contentFit="cover"
                transition={300}
              />
              <View style={styles.socialActivityInfo}>
                <Text style={[styles.socialActivityTitle, { color: theme.colors.text }]} numberOfLines={2}>
                  {activity.media.title.english || activity.media.title.userPreferred}
                </Text>
                <Text style={[styles.socialActivityTime, { color: theme.colors.textSecondary }]}>
                  {timeAgo}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    paddingHorizontal: 20,
    marginBottom: 40,
  },
  sectionHeader: {
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  sectionSubtitle: {
    fontSize: 15,
    opacity: 0.7,
  },
  scrollContent: {
    paddingRight: 20,
    paddingBottom: 4,
  },
  socialActivityCard: {
    width: 160,
    marginRight: 16,
    borderRadius: 16,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  socialActivityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    gap: 8,
  },
  socialUserAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  socialActivityText: {
    flex: 1,
  },
  socialUserName: {
    fontSize: 12,
    fontWeight: '700',
  },
  socialActivityStatus: {
    fontSize: 10,
    fontWeight: '500',
  },
  socialActivityImage: {
    width: '100%',
    height: 180,
  },
  socialActivityInfo: {
    padding: 8,
    gap: 4,
  },
  socialActivityTitle: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  socialActivityTime: {
    fontSize: 10,
    fontWeight: '500',
  },
}); 