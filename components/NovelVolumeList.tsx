import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator, FlatList, TouchableOpacity, Dimensions, Platform, Modal, Animated, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Image as ExpoImage } from 'expo-image';
import { FontAwesome5 } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { useNovelData } from '../hooks/useNovelData';
import { useNovelDownloader } from '../hooks/useNovelDownloader';
import * as FileSystem from 'expo-file-system';
import * as Constants from 'expo-constants';

const getStoragePath = (novelId: string, volumeId: string, type: 'root' | 'epub' | 'images' = 'root') => {
  const isExpoGo = Constants.default.appOwnership === 'expo';
  
  // Base directory changes based on environment
  const baseDir = isExpoGo
    ? FileSystem.cacheDirectory // Use cache directory for Expo Go
    : Platform.OS === 'android'
      ? FileSystem.documentDirectory // Use document directory for standalone Android
      : FileSystem.cacheDirectory; // Use cache directory for iOS
  
  const novelDir = `${baseDir}novels/${novelId}_${volumeId}/`;
  
  switch (type) {
    case 'epub':
      return `${baseDir}novels/${novelId}_${volumeId}.epub`;
    case 'images':
      return `${novelDir}images/`;
    default:
      return novelDir;
  }
};

interface Volume {
  id: string;
  title: string;
  number: string;
  epub: string;
  pdf: string;
  cover?: string;
  downloadProgress?: number;
  isDownloading?: boolean;
}

interface NovelVolumeListProps {
  mangaTitle: {
    english: string;
    userPreferred: string;
  };
  anilistId?: string;
}

export default function NovelVolumeList({ mangaTitle, anilistId }: NovelVolumeListProps) {
  const router = useRouter();
  const { currentTheme } = useTheme();
  const { loading, volumes, novelId, error } = useNovelData(mangaTitle, anilistId);
  const { 
    downloadingVolumes, 
    downloadedVolumes, 
    startDownload, 
    cancelDownload, 
    deleteVolume, 
    checkDownloadedVolumes 
  } = useNovelDownloader(novelId);
  const [showOptionsModal, setShowOptionsModal] = React.useState(false);
  const [selectedVolume, setSelectedVolume] = React.useState<Volume | null>(null);
  const [showNotification, setShowNotification] = React.useState(false);
  const [notificationMessage, setNotificationMessage] = React.useState('');
  const notificationAnim = React.useRef(new Animated.Value(-100)).current;

  // Check downloaded volumes when volumes list changes
  React.useEffect(() => {
    if (volumes.length > 0) {
      checkDownloadedVolumes(volumes);
    }
  }, [volumes, checkDownloadedVolumes]);

  const showNotificationIsland = (message: string) => {
    setNotificationMessage(message);
    setShowNotification(true);
    Animated.sequence([
      Animated.spring(notificationAnim, {
        toValue: 0,
        useNativeDriver: true,
        speed: 12,
        bounciness: 8
      }),
      Animated.delay(3000),
      Animated.spring(notificationAnim, {
        toValue: -100,
        useNativeDriver: true,
        speed: 12,
        bounciness: 8
      })
    ]).start(() => setShowNotification(false));
  };

  const handleVolumePress = async (volume: Volume) => {
    const isDownloading = downloadingVolumes.has(volume.id);
    const isDownloaded = downloadedVolumes.has(volume.id);
    const downloadUrl = `https://drive.google.com/uc?export=download&confirm=t&id=${volume.id}`;

    if (isDownloading) {
      await cancelDownload(volume.id);
      return;
    }

    if (isDownloaded) {
      router.push(`/novelreader?novelId=${novelId}&volumeId=${volume.id}&title=${encodeURIComponent(mangaTitle.userPreferred)}&volumeTitle=${encodeURIComponent(volume.title)}&downloadUrl=${encodeURIComponent(downloadUrl)}`);
      return;
    }

    // Start download but don't navigate
    const success = await startDownload(volume);
    if (success) {
      showNotificationIsland(`Volume ${volume.number} downloaded successfully! Tap to read.`);
    }
  };

  const handleVolumeLongPress = (volume: Volume) => {
    if (downloadedVolumes.has(volume.id)) {
      setSelectedVolume(volume);
      setShowOptionsModal(true);
    }
  };

  const handleRedownload = async () => {
    if (!selectedVolume) return;
    await deleteVolume(selectedVolume.id);
    setShowOptionsModal(false);
    setSelectedVolume(null);
    await startDownload(selectedVolume);
  };

  const handleViewFile = async () => {
    if (!selectedVolume) return;
    const downloadUrl = `https://drive.google.com/uc?export=download&confirm=t&id=${selectedVolume.id}`;
    router.push(`/novelreader?novelId=${novelId}&volumeId=${selectedVolume.id}&title=${encodeURIComponent(mangaTitle.userPreferred)}&volumeTitle=${encodeURIComponent(selectedVolume.title)}&downloadUrl=${encodeURIComponent(downloadUrl)}`);
    setShowOptionsModal(false);
    setSelectedVolume(null);
  };

  const handleDeleteVolume = async () => {
    if (!selectedVolume) return;
    await deleteVolume(selectedVolume.id);
    setShowOptionsModal(false);
    setSelectedVolume(null);
  };

  const renderVolumeItem = ({ item }: { item: Volume }) => {
    const downloadInfo = downloadingVolumes.get(item.id);
    const isDownloading = downloadInfo !== undefined;
    const downloadProgress = downloadInfo?.progress || 0;

    return (
      <TouchableOpacity
        style={[
          styles.volumeItem, 
          { 
            backgroundColor: currentTheme.colors.surface,
            borderColor: downloadedVolumes.has(item.id) 
              ? currentTheme.colors.primary 
              : currentTheme.colors.border,
            borderWidth: downloadedVolumes.has(item.id) ? 2 : 1,
          }
        ]}
        onPress={() => handleVolumePress(item)}
        onLongPress={() => handleVolumeLongPress(item)}
        delayLongPress={500}
      >
        <View style={styles.coverContainer}>
          {item.cover ? (
            <ExpoImage
              source={{ uri: item.cover }}
              style={styles.volumeCover}
              contentFit="cover"
            />
          ) : (
            <View style={[styles.placeholderCover, { backgroundColor: currentTheme.colors.surface }]}>
              <Text style={[styles.placeholderText, { color: currentTheme.colors.textSecondary }]}>No Cover</Text>
            </View>
          )}
          {downloadedVolumes.has(item.id) && (
            <View style={styles.downloadedOverlay}>
              <FontAwesome5 name="check-circle" size={24} color={currentTheme.colors.primary} solid />
            </View>
          )}
          {isDownloading && (
            <View style={styles.downloadingOverlay}>
              <Text style={styles.downloadingText}>
                {Math.round(downloadProgress * 100)}%
              </Text>
              <ActivityIndicator size="small" color={currentTheme.colors.primary} style={styles.downloadingSpinner} />
              <Text style={styles.downloadingLabel}>Tap to cancel</Text>
            </View>
          )}
        </View>
        <View style={styles.volumeInfo}>
          <View style={styles.volumeHeader}>
            <Text style={[styles.volumeNumber, { color: currentTheme.colors.primary }]}>
              Volume {item.number}
            </Text>
            {downloadedVolumes.has(item.id) && (
              <View style={[styles.downloadedBadge, { backgroundColor: `${currentTheme.colors.primary}20` }]}>
                <Text style={[styles.downloadedText, { color: currentTheme.colors.primary }]}>
                  Downloaded
                </Text>
              </View>
            )}
          </View>
          <Text style={[styles.volumeTitle, { color: currentTheme.colors.text }]} numberOfLines={2}>
            {item.title}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: currentTheme.colors.background }]}>
        <ActivityIndicator size="large" color="#02A9FF" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.errorContainer, { backgroundColor: currentTheme.colors.background }]}>
        <Text style={[styles.errorText, { color: currentTheme.colors.textSecondary }]}>{error}</Text>
      </View>
    );
  }

  return (
    <>
      {showNotification && (
        <Animated.View 
          style={[
            styles.notificationIsland,
            { 
              backgroundColor: currentTheme.colors.primary,
              transform: [{ translateY: notificationAnim }]
            }
          ]}
        >
          <View style={styles.notificationContent}>
            <FontAwesome5 name="check-circle" size={20} color="#fff" solid />
            <Text style={styles.notificationText}>{notificationMessage}</Text>
          </View>
        </Animated.View>
      )}

      <FlatList
        data={volumes}
        renderItem={renderVolumeItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.listContainer, { backgroundColor: currentTheme.colors.background }]}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={[styles.emptyContainer, { backgroundColor: currentTheme.colors.background }]}>
            <Text style={[styles.emptyText, { color: currentTheme.colors.textSecondary }]}>No volumes available</Text>
          </View>
        }
      />

      {/* Volume Options Modal */}
      <Modal
        visible={showOptionsModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowOptionsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.optionsModalContainer, { backgroundColor: currentTheme.colors.surface }]}>
            <Text style={[styles.optionsModalTitle, { color: currentTheme.colors.text }]}>
              Volume {selectedVolume?.number}
            </Text>
            <Text style={[styles.optionsModalSubtitle, { color: currentTheme.colors.textSecondary }]}>
              {selectedVolume?.title}
            </Text>

            <View style={styles.optionsContainer}>
              <TouchableOpacity
                style={[styles.optionButton, { backgroundColor: currentTheme.colors.background }]}
                onPress={handleRedownload}
              >
                <FontAwesome5 name="sync-alt" size={24} color={currentTheme.colors.primary} />
                <Text style={[styles.optionText, { color: currentTheme.colors.text }]}>Redownload</Text>
                <Text style={[styles.optionDescription, { color: currentTheme.colors.textSecondary }]}>
                  Download the file again
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.optionButton, { backgroundColor: currentTheme.colors.background }]}
                onPress={handleViewFile}
              >
                <FontAwesome5 name="book-reader" size={24} color={currentTheme.colors.primary} />
                <Text style={[styles.optionText, { color: currentTheme.colors.text }]}>Read</Text>
                <Text style={[styles.optionDescription, { color: currentTheme.colors.textSecondary }]}>
                  Open in reader
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.optionButton, { backgroundColor: currentTheme.colors.background }]}
                onPress={() => {
                  if (!selectedVolume?.id || !novelId) {
                    Alert.alert('Error', 'Volume or Novel ID not found');
                    return;
                  }
                  const novelDir = getStoragePath(novelId, selectedVolume.id);
                  FileSystem.getInfoAsync(novelDir).then(info => {
                    if (info.exists) {
                      FileSystem.readDirectoryAsync(novelDir).then(files => {
                        const isExpoGo = Constants.default.appOwnership === 'expo';
                        Alert.alert(
                          'Files in Directory',
                          `Running in: ${isExpoGo ? 'Expo Go' : 'Standalone App'}\n\nDirectory: ${novelDir}\n\nFiles:\n${files.join('\n')}`,
                          [{ text: 'OK' }]
                        );
                      });
                    } else {
                      Alert.alert('Directory Not Found', `${novelDir} does not exist`);
                    }
                  });
                }}
              >
                <FontAwesome5 name="folder-open" size={24} color={currentTheme.colors.primary} />
                <Text style={[styles.optionText, { color: currentTheme.colors.text }]}>View Files</Text>
                <Text style={[styles.optionDescription, { color: currentTheme.colors.textSecondary }]}>
                  Show stored files
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.optionButton, { backgroundColor: currentTheme.colors.background }]}
                onPress={handleDeleteVolume}
              >
                <FontAwesome5 name="trash-alt" size={24} color="#dc3545" />
                <Text style={[styles.optionText, { color: currentTheme.colors.text }]}>Delete</Text>
                <Text style={[styles.optionDescription, { color: currentTheme.colors.textSecondary }]}>
                  Remove from device
                </Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.cancelButton, { backgroundColor: currentTheme.colors.background }]}
              onPress={() => setShowOptionsModal(false)}
            >
              <Text style={[styles.cancelButtonText, { color: currentTheme.colors.text }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const { width } = Dimensions.get('window');
const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
  },
  listContainer: {
    padding: 16,
    paddingBottom: 100,
  },
  volumeItem: {
    flexDirection: 'row',
    borderRadius: 16,
    marginBottom: 16,
    padding: 12,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    borderWidth: 1,
  },
  coverContainer: {
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  volumeCover: {
    width: 85,
    height: 125,
    borderRadius: 12,
  },
  placeholderCover: {
    width: 85,
    height: 125,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    fontSize: 12,
  },
  volumeInfo: {
    flex: 1,
    marginLeft: 16,
    justifyContent: 'center',
  },
  volumeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  volumeTitle: {
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 20,
  },
  volumeNumber: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  downloadedOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
  },
  downloadedBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  downloadedText: {
    fontSize: 12,
    fontWeight: '600',
  },
  emptyContainer: {
    padding: 20,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
  },
  downloadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
  },
  downloadingText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  downloadingSpinner: {
    marginBottom: 8,
  },
  downloadingLabel: {
    color: '#fff',
    fontSize: 12,
    opacity: 0.8,
  },
  optionsModalContainer: {
    width: '90%',
    padding: 24,
    borderRadius: 16,
    backgroundColor: '#fff',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  optionsModalTitle: {
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 4,
  },
  optionsModalSubtitle: {
    fontSize: 16,
    marginBottom: 24,
  },
  optionsContainer: {
    gap: 12,
    marginBottom: 16,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 16,
  },
  optionText: {
    fontSize: 16,
    fontWeight: '600',
  },
  optionDescription: {
    fontSize: 14,
    marginLeft: 'auto',
  },
  cancelButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  notificationIsland: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 20,
    left: 20,
    right: 20,
    backgroundColor: '#02A9FF',
    borderRadius: 12,
    padding: 16,
    zIndex: 1000,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  notificationContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  notificationText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
}); 