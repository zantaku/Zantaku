import React, { useState, useEffect, useCallback } from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, FlatList, Dimensions, StatusBar, DeviceEventEmitter } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Image as ExpoImage } from 'expo-image';
import { useTheme } from '../hooks/useTheme';
import { useIncognito } from '../hooks/useIncognito';
import { Chapter } from '../api/proxy/providers/manga';
import { MangaProviderService, PageWithHeaders } from '../api/proxy/providers/manga/MangaProviderService';
import { ChapterManager, NormalizedChapter } from '../utils/ChapterManager';

interface ChapterSourcesModalProps {
  visible: boolean;
  onClose: () => void;
  chapter: Chapter | null;
  mangaTitle: { english: string; userPreferred: string; };
  mangaId: string;
  anilistId?: string;
  currentProvider?: 'mangadex' | 'katana' | 'mangafire' | 'unknown';
  mangaSlugId?: string;
  chapterManager?: ChapterManager;
}

const logDebug = (message: string, data?: any) => console.log(`[ChapterModal DEBUG] ${message}`, data || '');
const logError = (message: string, error?: any) => console.error(`[ChapterModal ERROR] ${message}`, error || '');

const BASE_API_URL = 'https://takiapi.xyz';
const KATANA_API_URL = 'https://magaapinovel.xyz';

export default function ChapterSourcesModal({ visible, onClose, chapter, mangaTitle, mangaId, anilistId, currentProvider, mangaSlugId, chapterManager }: ChapterSourcesModalProps) {
  const router = useRouter();
  const { currentTheme: theme, isDarkMode } = useTheme();
  const { isIncognito } = useIncognito();

  // Debug props at component level
  console.log('🚀 MODAL COMPONENT PROPS:', {
    visible,
    currentProvider,
    mangaSlugId,
    mangaId,
    chapterId: chapter?.id,
    chapterNumber: chapter?.number,
    hasChapterManager: !!chapterManager
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pages, setPages] = useState<PageWithHeaders[]>([]);

  const fetchChapterPages = useCallback(async (selectedChapter: Chapter) => {
    setLoading(true);
    setError(null);
    setPages([]);
    
    logDebug("=== STARTING CHAPTER FETCH WITH CHAPTER MANAGER ===");
    logDebug("Selected chapter:", selectedChapter);
    logDebug("Has ChapterManager:", !!chapterManager);
    
    if (!chapterManager) {
      logError("No ChapterManager provided - falling back to legacy method");
      setError("Chapter navigation not properly initialized");
      setLoading(false);
      return;
    }

    const { id: chapterId } = selectedChapter;
    
    try {
        // Get the normalized chapter from ChapterManager
        const normalizedChapter = chapterManager.getChapterById(chapterId);
        if (!normalizedChapter) {
            throw new Error(`Chapter ${chapterId} not found in chapter manager`);
        }

        logDebug("=== CHAPTER MANAGER INFO ===");
        console.log('🏗️ CHAPTER MANAGER DEBUG:', chapterManager.getDebugInfo());
        console.log('📖 NORMALIZED CHAPTER:', normalizedChapter);
        
        // Get navigation context
        const navContext = chapterManager.getNavigationContext(chapterId);
        if (navContext) {
            console.log('🧭 NAVIGATION CONTEXT:', {
                currentIndex: navContext.currentIndex,
                hasNext: navContext.hasNext,
                hasPrevious: navContext.hasPrevious,
                nextChapter: navContext.nextChapter?.number,
                previousChapter: navContext.previousChapter?.number
            });
        }

        // Get the proper API URL using ChapterManager
        const pagesUrl = chapterManager.getChapterPagesUrl(normalizedChapter, KATANA_API_URL);
        const provider = chapterManager.getProvider();
        
        logDebug(`=== USING ${provider.toUpperCase()} API VIA CHAPTER MANAGER ===`);
        console.log('🔗 GENERATED API URL:', pagesUrl);
        console.log('📍 PROVIDER:', provider);
        
        // Fetch the pages
        let imageUrls: PageWithHeaders[] = [];
        
        if (provider === 'katana') {
            const response = await fetch(pagesUrl);
            logDebug('Response status:', response.status);
            
            const data = await response.json();
            logDebug('=== API RESPONSE RECEIVED ===');

            if (data?.error) {
                logError('API returned error:', data.error);
                throw new Error(`${data.error}. ${data.message || ''}`);
            }

            if (data?.success && data?.data?.imageUrls && Array.isArray(data.data.imageUrls)) {
                imageUrls = data.data.imageUrls.map((img: any, index: number) => {
                    const imageUrl = `${KATANA_API_URL}${img.proxyUrl}`;
                    return { url: imageUrl, headers: {} } as PageWithHeaders;
                });
                logDebug(`Successfully processed ${imageUrls.length} pages from Katana API.`);
            } else {
                throw new Error("Invalid Katana API response format.");
            }
            
        } else if (provider === 'mangafire' || provider === 'mangadex') {
            const response = await fetch(pagesUrl);
            logDebug('Response status:', response.status);
            
            const data = await response.json();
            logDebug('=== API RESPONSE RECEIVED ===');

            if (data?.error) {
                logError('API returned error:', data.error);
                throw new Error(`${data.error}. ${data.message || ''}`);
            }

            if (data?.pages && Array.isArray(data.pages)) {
                imageUrls = data.pages.map((page: any, index: number) => {
                    const imageUrl = page.url;
                    const headers = page.headers || 
                        (provider === 'mangafire' ? { 'Referer': 'https://mangafire.to' } : {});
                    return { url: imageUrl, headers } as PageWithHeaders;
                });
                logDebug(`Successfully processed ${imageUrls.length} pages from ${provider} API.`);
            } else {
                throw new Error(`Invalid ${provider} API response format.`);
            }
            
        } else {
            // Fallback to MangaProviderService
            logDebug('=== USING MANGA PROVIDER SERVICE FALLBACK ===');
            imageUrls = await MangaProviderService.getChapterPages(chapterId, provider as any);
            logDebug(`MangaProviderService returned: ${imageUrls.length} pages`);
        }

        logDebug('=== FINAL RESULT ===');
        logDebug('Total image URLs found:', imageUrls.length);
        
        if (imageUrls.length === 0) {
            throw new Error("No pages found for this chapter.");
        }
        
        logDebug(`Setting pages state with ${imageUrls.length} images`);
        setPages(imageUrls);

    } catch (err: any) {
        logError("=== ERROR OCCURRED ===");
        logError("Error details:", err);
        
        const errorMsg = err.message || `Could not load chapter ${selectedChapter.number}.`;
        logError('Setting error:', errorMsg);
        setError(errorMsg);
    } finally {
        logDebug('=== FETCH COMPLETE ===');
        setLoading(false);
    }
  }, [chapterManager]);

  useEffect(() => {
    if (visible && chapter) {
      logDebug("Modal opened with chapter:", chapter);
      logDebug("Current provider:", currentProvider);
      logDebug("Manga slug ID:", mangaSlugId);
      logDebug("Manga ID:", mangaId);
      logDebug("AniList ID:", anilistId);
      console.log('🎯 PROVIDER DEBUG:', {
        currentProvider,
        mangaSlugId,
        mangaId,
        anilistId,
        chapterId: chapter.id,
        chapterNumber: chapter.number
      });
      fetchChapterPages(chapter);
    } else if (visible && !chapter) {
      logError("Modal opened without chapter data");
      setError("No chapter data available");
      setLoading(false);
    }
  }, [visible, chapter, fetchChapterPages, currentProvider, mangaSlugId]);

  const navigateToReader = () => {
    if (pages.length === 0 || !chapter) return;
    
    // Always pass the fetched pages to the reader, regardless of chapter type
    const params: Record<string, any> = {
      title: chapter.title,
      chapter: chapter.number,
      mangaId,
      anilistId,
      shouldSaveProgress: !isIncognito,
      // Pass provider information to ensure reader maintains context
      readerCurrentProvider: currentProvider,
      readerMangaSlugId: mangaSlugId,
    };
    
    // Add the already-fetched image URLs and headers
    pages.forEach((page, i) => {
      params[`image${i + 1}`] = page.url;
      if (page.headers) {
        params[`header${i + 1}`] = JSON.stringify(page.headers);
      }
    });

    logDebug('Navigating to reader with fetched pages:', {
      chapterTitle: chapter.title,
      chapterNumber: chapter.number,
      totalPages: pages.length,
      currentProvider,
      mangaSlugId,
      firstPageUrl: pages[0]?.url,
      hasHeaders: pages.some(p => p.headers && Object.keys(p.headers).length > 0)
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