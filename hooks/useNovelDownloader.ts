import { useState, useCallback, useEffect } from 'react';
import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

interface DownloadState {
  progress: number;
  downloadTask?: FileSystem.DownloadResumable;
}

export interface NovelVolume {
  id: string;
  title: string;
  number: string;
}

export function useNovelDownloader(novelId: string | null) {
  const [downloadingVolumes, setDownloadingVolumes] = useState<Map<string, DownloadState>>(new Map());
  const [downloadedVolumes, setDownloadedVolumes] = useState<Set<string>>(new Set());

  const getFileUri = useCallback((volumeId: string) => {
    const filename = `${novelId}_${volumeId}.epub`;
    return Platform.OS === 'android'
      ? `${FileSystem.documentDirectory}novels/${filename}`
      : `${FileSystem.documentDirectory}${filename}`;
  }, [novelId]);

  const checkDownloadedVolumes = useCallback(async (volumes: NovelVolume[]) => {
    if (!novelId) return;

    const downloaded = new Set<string>();
    
    // Ensure the novels directory exists on Android
    if (Platform.OS === 'android') {
      const novelDir = `${FileSystem.documentDirectory}novels`;
      const dirInfo = await FileSystem.getInfoAsync(novelDir);
      if (!dirInfo.exists) {
        console.log('📁 Creating novels directory');
        await FileSystem.makeDirectoryAsync(novelDir, { intermediates: true });
      }
    }

    for (const volume of volumes) {
      const fileUri = getFileUri(volume.id);
      try {
        const fileInfo = await FileSystem.getInfoAsync(fileUri);
        if (fileInfo.exists) {
          console.log('📚 Found downloaded volume:', volume.title);
          downloaded.add(volume.id);
        }
      } catch (err) {
        console.error('Error checking file:', err);
      }
    }
    setDownloadedVolumes(downloaded);
  }, [novelId, getFileUri]);

  const startDownload = useCallback(async (volume: NovelVolume) => {
    if (!novelId) return false;

    const downloadUrl = `https://drive.google.com/uc?export=download&confirm=t&id=${volume.id}`;
    const fileUri = getFileUri(volume.id);

    console.log('🚀 Initiating download process for:', volume.title);
    setDownloadingVolumes(prev => {
      const next = new Map(prev);
      next.set(volume.id, { progress: 0 });
      return next;
    });

    try {
      const downloadResumable = FileSystem.createDownloadResumable(
        downloadUrl,
        fileUri,
        {
          headers: {
            'Accept-Encoding': 'gzip',
            'Accept': '*/*',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3'
          },
          cache: true
        },
        (downloadProgress) => {
          const progress = downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite;
          setDownloadingVolumes(prev => {
            const next = new Map(prev);
            next.set(volume.id, { 
              progress, 
              downloadTask: downloadResumable 
            });
            return next;
          });
        }
      );

      await AsyncStorage.setItem(`download_state_${volume.id}`, JSON.stringify({
        fileUri,
        downloadUrl,
        volumeId: volume.id,
        novelId,
        timestamp: Date.now()
      }));

      const result = await downloadResumable.downloadAsync();
      
      if (result?.uri) {
        setDownloadedVolumes(prev => new Set(prev).add(volume.id));
        setDownloadingVolumes(prev => {
          const next = new Map(prev);
          next.delete(volume.id);
          return next;
        });
        await AsyncStorage.removeItem(`download_state_${volume.id}`);
        return true;
      }
      return false;
    } catch (err) {
      console.error('❌ Download error:', err);
      return false;
    }
  }, [novelId, getFileUri]);

  const cancelDownload = useCallback(async (volumeId: string) => {
    const downloadInfo = downloadingVolumes.get(volumeId);
    if (downloadInfo?.downloadTask) {
      try {
        await downloadInfo.downloadTask.cancelAsync();
        setDownloadingVolumes(prev => {
          const next = new Map(prev);
          next.delete(volumeId);
          return next;
        });
        return true;
      } catch (err) {
        console.error('Error canceling download:', err);
        return false;
      }
    }
    return false;
  }, [downloadingVolumes]);

  const deleteVolume = useCallback(async (volumeId: string) => {
    if (!novelId) return false;

    try {
      const fileUri = getFileUri(volumeId);
      const fileInfo = await FileSystem.getInfoAsync(fileUri);
      if (fileInfo.exists) {
        await FileSystem.deleteAsync(fileUri);
        setDownloadedVolumes(prev => {
          const next = new Set(prev);
          next.delete(volumeId);
          return next;
        });
        return true;
      }
      return false;
    } catch (err) {
      console.error('Error deleting volume:', err);
      return false;
    }
  }, [novelId, getFileUri]);

  // Recover interrupted downloads
  useEffect(() => {
    if (!novelId) return;

    const recoverDownloads = async () => {
      try {
        const keys = await AsyncStorage.getAllKeys();
        const downloadKeys = keys.filter(key => key.startsWith('download_state_'));
        
        for (const key of downloadKeys) {
          const stateStr = await AsyncStorage.getItem(key);
          if (!stateStr) continue;
          
          const state = JSON.parse(stateStr);
          if (!state || Date.now() - state.timestamp > 24 * 60 * 60 * 1000) {
            await AsyncStorage.removeItem(key);
            continue;
          }

          if (state.novelId === novelId) {
            console.log('🔄 Recovering download:', state.volumeId);
            startDownload({ id: state.volumeId, title: 'Unknown', number: 'Unknown' });
          }
        }
      } catch (err) {
        console.error('Error recovering downloads:', err);
      }
    };

    recoverDownloads();
  }, [novelId, startDownload]);

  return {
    downloadingVolumes,
    downloadedVolumes,
    startDownload,
    cancelDownload,
    deleteVolume,
    checkDownloadedVolumes,
    getFileUri
  };
} 