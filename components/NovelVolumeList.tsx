import React from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ActivityIndicator, 
  TouchableOpacity, 
  Dimensions, 
  Platform, 
  Modal, 
  Animated, 
  Alert
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { Image as ExpoImage } from 'expo-image';
import { FontAwesome5 } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { useNovelData } from '../hooks/useNovelData';
import { useNovelDownloader } from '../hooks/useNovelDownloader';
import * as FileSystem from 'expo-file-system';
import * as Constants from 'expo-constants';
import CorrectNovelSearchModal from './CorrectNovelSearchModal';

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
    romaji?: string;
    native?: string;
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

  // UI State
  const [viewMode, setViewMode] = React.useState<'list' | 'grid'>('list');
  const [sortMode, setSortMode] = React.useState<'newest' | 'oldest'>('newest');
  const [showOptionsModal, setShowOptionsModal] = React.useState(false);
  const [selectedVolume, setSelectedVolume] = React.useState<Volume | null>(null);
  const [showNotification, setShowNotification] = React.useState(false);
  const [notificationMessage, setNotificationMessage] = React.useState('');
  const [showCorrectNovelModal, setShowCorrectNovelModal] = React.useState(false);
  const [currentNovelTitle, setCurrentNovelTitle] = React.useState<string>('');
  const [loadingMessage, setLoadingMessage] = React.useState<string | null>(null);

  // Animations
  const notificationAnim = React.useRef(new Animated.Value(-100)).current;

  // Check downloaded volumes when volumes list changes
  React.useEffect(() => {
    if (volumes.length > 0) {
      checkDownloadedVolumes(volumes);
    }
  }, [volumes, checkDownloadedVolumes]);

  React.useEffect(() => {
    setCurrentNovelTitle(mangaTitle.userPreferred || mangaTitle.english || '');
  }, [mangaTitle]);

  // Sort and categorize volumes
  const sortedVolumes = React.useMemo(() => {
    const sorted = [...volumes].sort((a, b) => {
      const aNum = parseInt(a.number);
      const bNum = parseInt(b.number);
      return sortMode === 'newest' ? bNum - aNum : aNum - bNum;
    });

    // Separate downloaded and non-downloaded
    const downloaded = sorted.filter(v => downloadedVolumes.has(v.id));
    const downloading = sorted.filter(v => downloadingVolumes.has(v.id));
    const available = sorted.filter(v => 
      !downloadedVolumes.has(v.id) && !downloadingVolumes.has(v.id)
    );

    // Return in order: downloading, downloaded, available
    return [...downloading, ...downloaded, ...available];
  }, [volumes, sortMode, downloadedVolumes, downloadingVolumes]);

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

    console.log('Download URL:', downloadUrl);

    if (isDownloading) {
      await cancelDownload(volume.id);
      return;
    }

    if (isDownloaded) {
      // Add haptic feedback for better UX
      try {
        const { Haptics } = require('expo-haptics');
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch (error) {
        // Haptics not available, continue without it
      }
      
      router.push(`/novelreader?novelId=${novelId}&volumeId=${volume.id}&title=${encodeURIComponent(mangaTitle.userPreferred)}&volumeTitle=${encodeURIComponent(volume.title)}&downloadUrl=${encodeURIComponent(downloadUrl)}`);
      return;
    }

    // Start download and show validation status
    try {
      setLoadingMessage(`Downloading ${volume.title}...`);
      const success = await startDownload(volume);
      
      if (success) {
        showNotificationIsland(`Volume ${volume.number} downloaded and validated successfully! Tap to read.`);
      } else {
        // Show error notification
        showNotificationIsland(`❌ Failed to validate ${volume.title}. The file may be corrupted. Please try downloading again.`);
        
        // Remove from downloaded volumes if it was added
        await deleteVolume(volume.id);
      }
    } catch (error) {
      console.error('Error downloading volume:', error);
      showNotificationIsland(`❌ Error downloading ${volume.title}. Please try again.`);
    } finally {
      setLoadingMessage(null);
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

  const handleNovelChange = () => {
    setShowCorrectNovelModal(true);
  };

  const handleNovelSelect = (novelId: string, novelTitle: string) => {
    setCurrentNovelTitle(novelTitle);
    setShowCorrectNovelModal(false);
    // Handle novel selection - this would trigger a re-fetch with the new novel
    console.log('Selected novel ID:', novelId, 'Title:', novelTitle);
  };

  const getStatusBadge = (volume: Volume) => {
    const isDownloading = downloadingVolumes.has(volume.id);
    const isDownloaded = downloadedVolumes.has(volume.id);
    const downloadProgress = downloadingVolumes.get(volume.id)?.progress || 0;

    if (isDownloading) {
      return (
        <View style={[styles.statusBadge, { backgroundColor: '#FFA50020' }]}>
          <Text style={[styles.statusText, { color: '#FFA500' }]}>
            {Math.round(downloadProgress * 100)}%
          </Text>
        </View>
      );
    }

    if (isDownloaded) {
      return (
        <View style={[styles.statusBadge, { backgroundColor: '#28A74520' }]}>
          <Text style={[styles.statusText, { color: '#28A745' }]}>
            Downloaded
          </Text>
        </View>
      );
    }

    return null;
  };

  const renderVolumeItem = ({ item }: { item: Volume }) => {
    const downloadInfo = downloadingVolumes.get(item.id);
    const isDownloading = downloadInfo !== undefined;
    const downloadProgress = downloadInfo?.progress || 0;
    const isDownloaded = downloadedVolumes.has(item.id);

    if (viewMode === 'grid') {
      return (
        <View style={styles.gridWrapper}>
          <TouchableOpacity
            style={[
              styles.gridItem,
              {
                backgroundColor: currentTheme.colors.surface,
                borderColor: isDownloaded 
                  ? '#28A745'
                  : currentTheme.colors.border,
                borderWidth: isDownloaded ? 2 : 1,
              }
            ]}
            onPress={() => handleVolumePress(item)}
            onLongPress={() => handleVolumeLongPress(item)}
            delayLongPress={500}
          >
            <View style={styles.gridCoverContainer}>
              {item.cover ? (
                <ExpoImage
                  source={{ uri: item.cover }}
                  style={styles.gridCover}
                  contentFit="cover"
                />
              ) : (
                <View style={[styles.gridPlaceholderCover, { backgroundColor: currentTheme.colors.background }]}>
                  <FontAwesome5 name="book" size={24} color={currentTheme.colors.textSecondary} />
                </View>
              )}
              
              {isDownloaded && (
                <View style={styles.gridStatusOverlay}>
                  <FontAwesome5 name="check-circle" size={16} color="#28A745" solid />
                </View>
              )}
              
              {isDownloading && (
                <View style={styles.gridDownloadingOverlay}>
                  {loadingMessage ? (
                    <View style={styles.validationOverlay}>
                      <ActivityIndicator size="small" color={currentTheme.colors.primary} />
                      <Text style={[styles.validationText, { color: currentTheme.colors.text }]}>
                        {loadingMessage}
                      </Text>
                    </View>
                  ) : (
                    <Text style={styles.gridDownloadingText}>
                      {Math.round(downloadProgress * 100)}%
                    </Text>
                  )}
                </View>
              )}
            </View>
            
            <View style={styles.gridInfo}>
              <Text style={[styles.gridVolumeNumber, { color: currentTheme.colors.primary }]}>
                Vol. {item.number}
              </Text>
              <Text 
                style={[styles.gridVolumeTitle, { color: currentTheme.colors.text }]} 
                numberOfLines={2}
              >
                {item.title}
              </Text>
            </View>
          </TouchableOpacity>
        </View>
      );
    }

    // List view
    return (
      <View style={styles.listWrapper}>
        <TouchableOpacity
          style={[
            styles.listItem,
            {
              backgroundColor: currentTheme.colors.surface,
              borderColor: isDownloaded 
                ? '#28A745'
                : currentTheme.colors.border,
              borderWidth: isDownloaded ? 2 : 1,
            }
          ]}
          onPress={() => handleVolumePress(item)}
          onLongPress={() => handleVolumeLongPress(item)}
          delayLongPress={500}
        >
          <View style={styles.listCoverContainer}>
            {item.cover ? (
              <ExpoImage
                source={{ uri: item.cover }}
                style={styles.listCover}
                contentFit="cover"
              />
            ) : (
              <View style={[styles.listPlaceholderCover, { backgroundColor: currentTheme.colors.background }]}>
                <FontAwesome5 name="book" size={24} color={currentTheme.colors.textSecondary} />
              </View>
            )}
            
            {isDownloaded && (
              <View style={styles.listStatusOverlay}>
                <FontAwesome5 name="check-circle" size={16} color="#28A745" solid />
              </View>
            )}
            
            {isDownloading && (
              <View style={styles.listDownloadingOverlay}>
                {loadingMessage ? (
                  <View style={styles.validationOverlay}>
                    <ActivityIndicator size="small" color={currentTheme.colors.primary} />
                    <Text style={[styles.validationText, { color: currentTheme.colors.text }]}>
                      {loadingMessage}
                    </Text>
                  </View>
                ) : (
                  <Text style={styles.listDownloadingText}>
                    {Math.round(downloadProgress * 100)}%
                  </Text>
                )}
              </View>
            )}
          </View>
          
          <View style={styles.listInfo}>
            <Text style={[styles.listVolumeNumber, { color: currentTheme.colors.primary }]}>
              Vol. {item.number}
            </Text>
            <Text 
              style={[styles.listVolumeTitle, { color: currentTheme.colors.text }]} 
              numberOfLines={2}
            >
              {item.title}
            </Text>
          </View>
        </TouchableOpacity>
      </View>
    );
  };

  const renderHeader = () => (
    <View style={[styles.header, { backgroundColor: currentTheme.colors.background }]}>
      {/* Novel Info Section */}
      <View style={[styles.novelInfo, { backgroundColor: currentTheme.colors.surface }]}>
        <TouchableOpacity 
          style={styles.novelTitleContainer}
          onPress={handleNovelChange}
        >
          <Text style={[styles.novelTitle, { color: currentTheme.colors.text }]} numberOfLines={1}>
            {currentNovelTitle}
          </Text>
          <FontAwesome5 name="edit" size={12} color={currentTheme.colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Controls */}
      <View style={styles.controls}>
        <Text style={[styles.volumesTitle, { color: currentTheme.colors.text }]}>Volumes</Text>
        <View style={styles.controlButtons}>
          <TouchableOpacity
            style={[styles.controlButton, { backgroundColor: currentTheme.colors.surface }]}
            onPress={() => setSortMode(sortMode === 'newest' ? 'oldest' : 'newest')}
          >
            <FontAwesome5 
              name={sortMode === 'newest' ? "sort-numeric-down" : "sort-numeric-up"} 
              size={16} 
              color={currentTheme.colors.text} 
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.controlButton, { backgroundColor: currentTheme.colors.surface }]}
            onPress={() => setViewMode(viewMode === 'list' ? 'grid' : 'list')}
          >
            <FontAwesome5 
              name={viewMode === 'list' ? 'th' : 'list'} 
              size={16} 
              color={currentTheme.colors.text} 
            />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  const verifyFile = async () => {
    if (!selectedVolume || !novelId) return;
    
    try {
      setLoadingMessage('Verifying file...');
      setShowOptionsModal(false);
      
      // Get the file path
      const fileUri = getStoragePath(novelId, selectedVolume.id, 'epub');
      
      // Read the file
      const fileContent = await FileSystem.readAsStringAsync(fileUri, { 
        encoding: FileSystem.EncodingType.Base64 
      });
      
      // Create JSZip instance
      const JSZip = require('jszip');
      const zip = new JSZip();
      
      // Load and validate the EPUB
      const { validateEpub } = require('../utils/epubValidator');
      await zip.loadAsync(fileContent, { base64: true });
      const validation = await validateEpub(zip);
      
      if (validation.isValid) {
        showNotificationIsland('✅ File verified successfully! No issues found.');
      } else {
        // If there are issues, show them and offer to redownload
        const issues = validation.issues.join('\n');
        Alert.alert(
          'File Validation Issues',
          `The following issues were found:\n\n${issues}\n\nWould you like to redownload this volume?`,
          [
            {
              text: 'Cancel',
              style: 'cancel'
            },
            {
              text: 'Redownload',
              onPress: handleRedownload
            }
          ]
        );
      }
    } catch (error) {
      console.error('Error verifying file:', error);
      showNotificationIsland('❌ Error verifying file. The file may be corrupted.');
    } finally {
      setLoadingMessage(null);
    }
  };

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: currentTheme.colors.background }]}>
        <ActivityIndicator size="large" color={currentTheme.colors.primary} />
        <Text style={[styles.loadingText, { color: currentTheme.colors.textSecondary }]}>
          Loading volumes...
        </Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.errorContainer, { backgroundColor: currentTheme.colors.background }]}>
        <FontAwesome5 name="exclamation-triangle" size={48} color={currentTheme.colors.error} />
        <Text style={[styles.errorText, { color: currentTheme.colors.text }]}>
          Failed to load volumes
        </Text>
        <Text style={[styles.errorSubtext, { color: currentTheme.colors.textSecondary }]}>
          {error}
        </Text>
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

      <View style={[styles.container, { backgroundColor: currentTheme.colors.background }]}>
        <FlashList
          data={sortedVolumes}
          renderItem={renderVolumeItem}
          keyExtractor={(item) => item.id}
          numColumns={viewMode === 'grid' ? 2 : 1}
          key={viewMode}
          estimatedItemSize={viewMode === 'grid' ? 200 : 120}
          ListHeaderComponent={renderHeader}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <FontAwesome5 name="book-open" size={48} color={currentTheme.colors.textSecondary} />
              <Text style={[styles.emptyText, { color: currentTheme.colors.text }]}>
                No volumes found
              </Text>
              <Text style={[styles.emptySubtext, { color: currentTheme.colors.textSecondary }]}>
                No volumes available for this novel
              </Text>
            </View>
          }
        />
      </View>

      {/* Volume Options Modal */}
      {showOptionsModal && selectedVolume && (
        <Modal
          visible={showOptionsModal}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowOptionsModal(false)}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setShowOptionsModal(false)}
          >
            <View style={[styles.modalContent, { backgroundColor: currentTheme.colors.surface }]}>
              <TouchableOpacity
                style={[styles.modalButton, { borderBottomWidth: 1, borderBottomColor: currentTheme.colors.border }]}
                onPress={handleViewFile}
              >
                <FontAwesome5 name="folder-open" size={16} color={currentTheme.colors.text} />
                <Text style={[styles.modalButtonText, { color: currentTheme.colors.text }]}>View Files</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.modalButton, { borderBottomWidth: 1, borderBottomColor: currentTheme.colors.border }]}
                onPress={verifyFile}
              >
                <FontAwesome5 name="check-circle" size={16} color={currentTheme.colors.text} />
                <Text style={[styles.modalButtonText, { color: currentTheme.colors.text }]}>Verify File</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, { borderBottomWidth: 1, borderBottomColor: currentTheme.colors.border }]}
                onPress={handleRedownload}
              >
                <FontAwesome5 name="sync" size={16} color={currentTheme.colors.text} />
                <Text style={[styles.modalButtonText, { color: currentTheme.colors.text }]}>Redownload</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, { borderBottomColor: '#FF3B30' }]}
                onPress={handleDeleteVolume}
              >
                <FontAwesome5 name="trash-alt" size={16} color="#FF3B30" />
                <Text style={[styles.modalButtonText, { color: '#FF3B30' }]}>Delete</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>
      )}

      {/* Correct Novel Search Modal */}
      <CorrectNovelSearchModal
        isVisible={showCorrectNovelModal}
        onClose={() => setShowCorrectNovelModal(false)}
        currentTitle={currentNovelTitle}
        onNovelSelect={handleNovelSelect}
      />
    </>
  );
}

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 16,
  },
  header: {
    padding: 16,
    paddingBottom: 8,
  },
  novelInfo: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  novelTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  novelTitle: {
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 8,
  },
  novelDescription: {
    fontSize: 16,
    lineHeight: 24,
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  volumesTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  controlButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  controlButton: {
    padding: 8,
    borderRadius: 20,
    width: 38,
    height: 38,
    justifyContent: 'center',
    alignItems: 'center',
  },

  listContainer: {
    paddingBottom: 100,
  },
  
  // List View Styles
  listWrapper: {
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  listItem: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
  },
  listCoverContainer: {
    width: 80,
    height: 120,
    borderRadius: 8,
    overflow: 'hidden',
  },
  listCover: {
    width: '100%',
    height: '100%',
  },
  listPlaceholderCover: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
  },
  listInfo: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
  },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  listVolumeNumber: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  listVolumeTitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  listStatusOverlay: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 12,
    padding: 4,
  },
  listDownloadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  listDownloadingText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },

  // Grid View Styles
  gridWrapper: {
    width: '50%',
    padding: 8,
  },
  gridItem: {
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
  },
  gridCoverContainer: {
    aspectRatio: 2/3,
    width: '100%',
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 8,
  },
  gridCover: {
    width: '100%',
    height: '100%',
  },
  gridPlaceholderCover: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
  },
  gridInfo: {
    marginTop: 8,
  },
  gridVolumeNumber: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  gridVolumeTitle: {
    fontSize: 12,
    lineHeight: 16,
  },
  gridStatusOverlay: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 12,
    padding: 4,
  },
  gridDownloadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  gridDownloadingText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },

  // Status Badge Styles
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
  },

  // Loading & Error States
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    paddingTop: 100,
  },
  loadingText: {
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    gap: 16,
    paddingTop: 100,
  },
  errorText: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  errorSubtext: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  emptyContainer: {
    padding: 32,
    alignItems: 'center',
    gap: 16,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    width: '90%',
    maxWidth: 400,
    padding: 24,
    borderRadius: 16,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  modalButton: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#000',
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  notificationIsland: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 20,
    left: 20,
    right: 20,
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

  validationOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 8,
  },
  validationText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 4,
  },

}); 