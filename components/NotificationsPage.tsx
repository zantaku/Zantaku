import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';

interface NotificationItem {
  id: string;
  type: 'anime' | 'manga';
  title: string;
  lastKnownNumber: number;
}

export default function NotificationsPage({ onClose }: { onClose: () => void }) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadNotifications();
  }, []);

  const loadNotifications = async () => {
    try {
      const notificationsStr = await SecureStore.getItemAsync('notifications_settings');
      if (notificationsStr) {
        const notificationsList: NotificationItem[] = JSON.parse(notificationsStr);
        setNotifications(notificationsList);
      }
    } catch (error) {
      console.error('Error loading notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const animeNotifications = notifications.filter(n => n.type === 'anime');
  const mangaNotifications = notifications.filter(n => n.type === 'manga');

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.backButton}>
          <FontAwesome5 name="arrow-left" size={20} color="#333" />
        </TouchableOpacity>
        <Text style={styles.title}>Notifications</Text>
      </View>

      <ScrollView style={styles.content}>
        {/* Stats Section */}
        <View style={styles.statsContainer}>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{animeNotifications.length}</Text>
            <Text style={styles.statLabel}>Anime</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{mangaNotifications.length}</Text>
            <Text style={styles.statLabel}>Manga</Text>
          </View>
        </View>

        {/* Anime Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Anime Notifications</Text>
          {animeNotifications.length === 0 ? (
            <Text style={styles.emptyText}>No anime notifications enabled</Text>
          ) : (
            animeNotifications.map((item) => (
              <View key={item.id} style={styles.notificationItem}>
                <View style={styles.notificationContent}>
                  <Text style={styles.itemTitle}>{item.title}</Text>
                  <Text style={styles.itemSubtitle}>
                    Last Episode: {item.lastKnownNumber}
                  </Text>
                </View>
                <FontAwesome5 name="bell" size={16} color="#02A9FF" solid />
              </View>
            ))
          )}
        </View>

        {/* Manga Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Manga Notifications</Text>
          {mangaNotifications.length === 0 ? (
            <Text style={styles.emptyText}>No manga notifications enabled</Text>
          ) : (
            mangaNotifications.map((item) => (
              <View key={item.id} style={styles.notificationItem}>
                <View style={styles.notificationContent}>
                  <Text style={styles.itemTitle}>{item.title}</Text>
                  <Text style={styles.itemSubtitle}>
                    Last Chapter: {item.lastKnownNumber}
                  </Text>
                </View>
                <FontAwesome5 name="bell" size={16} color="#02A9FF" solid />
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    paddingTop: Platform.OS === 'ios' ? 50 : 25,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    backgroundColor: '#fff',
  },
  backButton: {
    padding: 8,
    marginRight: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    color: '#333',
  },
  content: {
    flex: 1,
    paddingBottom: 32,
  },
  statsContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 16,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 32,
    fontWeight: '700',
    color: '#02A9FF',
  },
  statLabel: {
    fontSize: 16,
    color: '#666',
    marginTop: 8,
  },
  section: {
    padding: 16,
    paddingTop: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  notificationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    marginBottom: 12,
  },
  notificationContent: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 18,
    fontWeight: '500',
    color: '#333',
  },
  itemSubtitle: {
    fontSize: 15,
    color: '#666',
    marginTop: 4,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    fontStyle: 'italic',
    textAlign: 'center',
    padding: 24,
  },
}); 