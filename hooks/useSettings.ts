import { useState, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';
import { STORAGE_KEY } from '../constants/auth';
import { rateLimitedAxios } from '../utils/api';

interface UserSettings {
  displayAdultContent: boolean;
  titleLanguage: string;
}

export const useSettings = () => {
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSettings = async () => {
    try {
      const token = await SecureStore.getItemAsync(STORAGE_KEY.AUTH_TOKEN);
      if (!token) {
        setSettings({ displayAdultContent: false, titleLanguage: 'ROMAJI' });
        setLoading(false);
        return;
      }

      const query = `{
        Viewer {
          options {
            displayAdultContent
            titleLanguage
          }
        }
      }`;

      const response = await rateLimitedAxios(query, {}, token);
      
      if (response?.data?.Viewer?.options) {
        setSettings({
          displayAdultContent: response.data.Viewer.options.displayAdultContent || false,
          titleLanguage: response.data.Viewer.options.titleLanguage || 'ROMAJI'
        });
      } else {
        setSettings({ displayAdultContent: false, titleLanguage: 'ROMAJI' });
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
      setSettings({ displayAdultContent: false, titleLanguage: 'ROMAJI' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  return { settings, loading, refetchSettings: fetchSettings };
}; 