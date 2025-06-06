import React, { useState, useEffect, useCallback } from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, FlatList, Dimensions, StatusBar, DeviceEventEmitter } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Image as ExpoImage } from 'expo-image';
import { useTheme } from '../hooks/useTheme';
import { useIncognito } from '../hooks/useIncognito';
import { Chapter } from '../api/proxy/providers/manga';
import { MangaProviderService, PageWithHeaders } from '../api/proxy/providers/manga/MangaProviderService';

interface ChapterSourcesModalProps {
  visible: boolean;
  onClose: () => void;
  chapter: Chapter | null;
  mangaTitle: { english: string; userPreferred: string; };
  mangaId: string;
  anilistId?: string;
}

const logDebug = (message: string, data?: any) => console.log(`[ChapterModal DEBUG] ${message}`, data || '');
const logError = (message: string, error?: any) => console.error(`[ChapterModal ERROR] ${message}`, error || '');

export default function ChapterSourcesModal({ visible, onClose, chapter, mangaTitle, mangaId, anilistId }: ChapterSourcesModalProps) {
  const router = useRouter();
  const { currentTheme: theme, isDarkMode } = useTheme();
  const { isIncognito } = useIncognito();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pages, setPages] = useState<PageWithHeaders[]>([]);

  const fetchChapterPages = useCallback(async (selectedChapter: Chapter) => {
    setLoading(true);
    setError(null);
    setPages([]);
    
    logDebug("Fetching pages for chapter:", selectedChapter);
    
    const { id: chapterId, source } = selectedChapter;

    try {
        logDebug(`Fetching pages for chapter ${chapterId} from ${source}`);
        
        const imageUrls = await MangaProviderService.getChapterPages(chapterId, source as any);
        
        if (imageUrls.length === 0) {
            throw new Error("No pages found for this chapter.");
        }

        logDebug(`Successfully fetched ${imageUrls.length} pages.`);
        setPages(imageUrls);

    } catch (err: any) {
        logError("Failed to fetch chapter pages:", err);
        setError(err.message || `Could not load chapter from ${source}.`);
    } finally {
        setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (visible && chapter) {
      fetchChapterPages(chapter);
    }
  }, [visible, chapter, fetchChapterPages]);

  const navigateToReader = () => {
    if (pages.length === 0 || !chapter) return;
    const params: Record<string, any> = {
        title: chapter.title,
        chapter: chapter.number,
        mangaId,
        anilistId,
        shouldSaveProgress: !isIncognito,
    };
    
    // Add image URLs and headers
    pages.forEach((page, i) => {
      params[`image${i + 1}`] = page.url;
      if (page.headers) {
        params[`header${i + 1}`] = JSON.stringify(page.headers);
      }
    });

    router.replace({ pathname: '/reader', params });
    onClose();
  };

  const renderPagePreview = ({ item, index }: { item: PageWithHeaders; index: number }) => (
      <View style={styles.pageItem}>
        <ExpoImage 
          source={{ 
            uri: item.url,
            headers: item.headers 
          }} 
          style={styles.pageImage} 
          contentFit="cover" 
        />
        <View style={styles.pageNumberBadge}><Text style={styles.pageNumberText}>{index + 1}</Text></View>
      </View>
  );

  return (
    <Modal visible={visible} transparent={true} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.modalContainer, { backgroundColor: isDarkMode ? 'rgba(0,0,0,0.9)' : 'rgba(0,0,0,0.8)' }]}>
        <View style={[styles.modalContent, { backgroundColor: theme.colors.background }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Chapter {chapter?.number}</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}><FontAwesome5 name="times" size={20} color={theme.colors.text} /></TouchableOpacity>
          </View>
          {loading ? (
            <View style={styles.statusContainer}><ActivityIndicator size="large" color={theme.colors.primary} /></View>
          ) : error ? (
            <View style={styles.statusContainer}>
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity style={styles.retryButton} onPress={() => {if(chapter) fetchChapterPages(chapter)}}><Text style={styles.retryButtonText}>Retry</Text></TouchableOpacity>
            </View>
          ) : (
            <>
              <FlatList<PageWithHeaders>
                data={pages.slice(0, 6)} // Show a preview of the first 6 pages
                renderItem={renderPagePreview}
                keyExtractor={(item, index) => `preview-${index}`}
                numColumns={3}
                contentContainerStyle={styles.listContent}
              />
              <TouchableOpacity style={styles.readButton} onPress={navigateToReader}>
                <Text style={styles.readButtonText}>Read Chapter ({pages.length} pages)</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
    modalContainer: { flex: 1, justifyContent: 'flex-end' },
    modalContent: { width: '100%', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 16, maxHeight: '85%' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: 'rgba(128,128,128,0.2)', paddingBottom: 16, marginBottom: 16 },
    modalTitle: { fontSize: 20, fontWeight: 'bold', flex: 1 },
    closeButton: { padding: 8 },
    statusContainer: { padding: 32, alignItems: 'center' },
    errorText: { color: '#ff4444', fontSize: 16, textAlign: 'center', marginBottom: 24 },
    retryButton: { backgroundColor: '#02A9FF', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
    retryButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
    listContent: { paddingBottom: 8 },
    pageItem: { flex: 1, margin: 4, aspectRatio: 2 / 3, borderRadius: 8, overflow: 'hidden' },
    pageImage: { width: '100%', height: '100%' },
    pageNumberBadge: { position: 'absolute', bottom: 4, right: 4, backgroundColor: 'rgba(0,0,0,0.7)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
    pageNumberText: { color: '#fff', fontSize: 10 },
    readButton: { margin: 16, backgroundColor: '#02A9FF', paddingVertical: 16, borderRadius: 8, alignItems: 'center' },
    readButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
}); 