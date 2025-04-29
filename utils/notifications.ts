import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import axios from 'axios';
import Constants from 'expo-constants';

const STORAGE_KEY = {
  NOTIFICATIONS: 'notifications_settings',
  LAST_CHECK: 'last_notification_check'
};

const ANILIST_API_URL = Constants.expoConfig?.extra?.anilistapi || 'https://graphql.anilist.co';
const JIKAN_API_URL = Constants.expoConfig?.extra?.jikianapi || 'https://api.jikan.moe/v4';
const ENOKI_API_URL = Constants.expoConfig?.extra?.enokiapi || 'https://enoki-api.vercel.app';

interface NotificationItem {
  id: string;
  type: 'anime' | 'manga';
  title: string;
  lastKnownNumber: number;
  anilistId?: string;
  malId?: string;
  manganatoId?: string;
}

export async function requestNotificationPermissions() {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    return false;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#02A9FF',
    });
  }

  return true;
}

export async function toggleNotifications(item: NotificationItem): Promise<boolean> {
  try {
    const notificationsStr = await SecureStore.getItemAsync(STORAGE_KEY.NOTIFICATIONS);
    let notifications: NotificationItem[] = notificationsStr ? JSON.parse(notificationsStr) : [];
    
    const existingIndex = notifications.findIndex(n => n.id === item.id);
    
    if (existingIndex !== -1) {
      notifications.splice(existingIndex, 1);
      await SecureStore.setItemAsync(STORAGE_KEY.NOTIFICATIONS, JSON.stringify(notifications));
      console.log(`🔔 Notifications turned OFF for: ${item.title}`);
      return false;
    } else {
      notifications.push(item);
      await SecureStore.setItemAsync(STORAGE_KEY.NOTIFICATIONS, JSON.stringify(notifications));
      console.log(`🔔 Notifications turned ON for: ${item.title}`);
      return true;
    }
  } catch (error) {
    console.error('Error toggling notifications:', error);
    return false;
  }
}

export async function isNotificationEnabled(id: string): Promise<boolean> {
  try {
    const notificationsStr = await SecureStore.getItemAsync(STORAGE_KEY.NOTIFICATIONS);
    if (!notificationsStr) return false;
    
    const notifications: NotificationItem[] = JSON.parse(notificationsStr);
    return notifications.some(n => n.id === id);
  } catch (error) {
    console.error('Error checking notification status:', error);
    return false;
  }
}

async function checkAniList(item: NotificationItem): Promise<number | null> {
  if (!item.anilistId) return null;

  const query = `
    query ($id: Int) {
      Media (id: $id) {
        episodes
        chapters
        nextAiringEpisode {
          episode
        }
      }
    }
  `;

  try {
    const response = await axios.post(ANILIST_API_URL, {
      query,
      variables: { id: parseInt(item.anilistId) }
    });

    const media = response.data?.data?.Media;
    if (item.type === 'anime') {
      return media?.nextAiringEpisode?.episode || media?.episodes || null;
    } else {
      return media?.chapters || null;
    }
  } catch (error) {
    console.error('Error checking AniList:', error);
    return null;
  }
}

async function checkJikan(item: NotificationItem): Promise<number | null> {
  if (!item.malId) return null;

  try {
    const response = await axios.get(`${JIKAN_API_URL}/${item.type}/${item.malId}`);
    if (item.type === 'anime') {
      return response.data?.data?.episodes || null;
    } else {
      return response.data?.data?.chapters || null;
    }
  } catch (error) {
    console.error('Error checking Jikan:', error);
    return null;
  }
}

async function checkEnoki(item: NotificationItem): Promise<number | null> {
  if (item.type !== 'manga' || !item.manganatoId) return null;

  try {
    const response = await axios.get(`${ENOKI_API_URL}/manganato/details/${item.manganatoId}`);
    const chapters = response.data?.chapters || [];
    return chapters.length > 0 ? chapters.length : null;
  } catch (error) {
    console.error('Error checking Enoki:', error);
    return null;
  }
}

export async function checkForUpdates() {
  try {
    const notificationsStr = await SecureStore.getItemAsync(STORAGE_KEY.NOTIFICATIONS);
    if (!notificationsStr) return;

    const notifications: NotificationItem[] = JSON.parse(notificationsStr);
    const lastCheckStr = await SecureStore.getItemAsync(STORAGE_KEY.LAST_CHECK);
    const lastCheck = lastCheckStr ? parseInt(lastCheckStr) : 0;
    const now = Date.now();

    // Only check once per hour
    if (now - lastCheck < 3600000) return;

    await SecureStore.setItemAsync(STORAGE_KEY.LAST_CHECK, now.toString());

    for (const item of notifications) {
      const [anilistNumber, jikanNumber, enokiNumber] = await Promise.all([
        checkAniList(item),
        checkJikan(item),
        checkEnoki(item)
      ]);

      const highestNumber = Math.max(
        anilistNumber || 0,
        jikanNumber || 0,
        enokiNumber || 0
      );

      if (highestNumber > item.lastKnownNumber) {
        // Update the stored last known number
        item.lastKnownNumber = highestNumber;
        await SecureStore.setItemAsync(STORAGE_KEY.NOTIFICATIONS, JSON.stringify(notifications));

        // Send notification
        await Notifications.scheduleNotificationAsync({
          content: {
            title: 'New Release!',
            body: `${item.title} has dropped a new ${item.type === 'anime' ? 'episode' : 'chapter'}. ${item.type === 'anime' ? 'Watch' : 'Read'} it now!`,
            data: { id: item.id, type: item.type },
          },
          trigger: null,
        });
      }
    }
  } catch (error) {
    console.error('Error checking for updates:', error);
  }
}

// Set up background fetch task for periodic checks
export async function registerBackgroundFetch() {
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    if (existingStatus !== 'granted') return;

    // Check for updates every hour when the app is in the background
    const BACKGROUND_FETCH_INTERVAL = 60 * 60; // 1 hour in seconds

    await Notifications.registerTaskAsync('background-fetch-task', {
      minimumInterval: BACKGROUND_FETCH_INTERVAL,
      stopOnTerminate: false,
      startOnBoot: true,
    });
  } catch (error) {
    console.error('Error registering background fetch:', error);
  }
} 