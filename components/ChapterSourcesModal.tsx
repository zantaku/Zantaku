import React, { useState, useEffect, useCallback } from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, FlatList } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Image as ExpoImage } from 'expo-image';
import { useTheme } from '../hooks/useTheme';
import { useIncognito } from '../hooks/useIncognito';
import { Chapter } from '../api/proxy/providers/manga';
import { MangaProviderService, PageWithHeaders } from '../api/proxy/providers/manga/MangaProviderService';
import { ChapterManager } from '../utils/ChapterManager';
import { useChapterPages } from '../contexts/ChapterPagesContext';

// Helper to convert Uint8Array to base64
function uint8ArrayToBase64(uint8Array: Uint8Array): string {
  let binary = '';
  const len = uint8Array.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(uint8Array[i]);
  }
  return btoa(binary);
}

// Process Mangakatana images (convert to base64 data URIs)
async function processKatanaImage(url: string, headers: Record<string, string>, retryCount = 0): Promise<string> {
  try {
    console.log(`🔓 [Modal] Processing Katana image (attempt ${retryCount + 1}): ${url.substring(0, 50)}...`);
    
    // Add a small delay between requests to avoid rate limiting
    if (retryCount > 0) {
      await new Promise(resolve => setTimeout(resolve, 500 * retryCount));
    }
    
    const response = await fetch(url, { 
      method: 'GET', 
      headers: {
        ...headers,
        'Accept': 'image/*, application/octet-stream, */*',
        'Cache-Control': 'no-cache'
      }
    });
    
    if (!response.ok) {
      console.warn(`🔓 [Modal] HTTP ${response.status} - ${retryCount < 2 ? 'retrying...' : 'giving up'}`);
      if (retryCount < 2) {
        return processKatanaImage(url, headers, retryCount + 1);
      }
      throw new Error(`HTTP ${response.status}`);
    }
    
    const arrayBuffer = await response.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    
    // Check if we got empty data
    if (uint8Array.length === 0) {
      console.warn(`🔓 [Modal] Empty response - ${retryCount < 2 ? 'retrying...' : 'using original URL'}`);
      if (retryCount < 2) {
        return processKatanaImage(url, headers, retryCount + 1);
      }
      throw new Error('Empty image data');
    }
    
    // Check if it's a valid JPEG (starts with FF D8 FF)
    const isJPEG = uint8Array[0] === 0xFF && uint8Array[1] === 0xD8 && uint8Array[2] === 0xFF;
    
    if (isJPEG) {
      const base64 = uint8ArrayToBase64(uint8Array);
      const dataUri = `data:image/jpeg;base64,${base64}`;
      console.log(`🔓 [Modal] ✅ Processed image (${uint8Array.length} bytes) - ${(uint8Array.length / 1024).toFixed(0)}KB`);
      return dataUri;
    }
    
    // Not a JPEG - check if it's HTML error page
    const text = new TextDecoder().decode(uint8Array.slice(0, 100));
    if (text.includes('<html') || text.includes('<!DOCTYPE')) {
      console.warn(`🔓 [Modal] Got HTML instead of image - ${retryCount < 2 ? 'retrying...' : 'using original URL'}`);
      if (retryCount < 2) {
        return processKatanaImage(url, headers, retryCount + 1);
      }
    }
    
    throw new Error('Invalid image format');
  } catch (error) {
    console.error(`🔓 [Modal] ❌ Failed to process image after ${retryCount + 1} attempts:`, error);
    return url; // Fallback to original URL with headers
  }
}

interface ChapterSourcesModalProps {
  visible: boolean;
  onClose: () => void;
  chapter: Chapter | null;
  mangaTitle: { english: string; userPreferred: string; romaji?: string; native?: string; };
  mangaId: string;
  anilistId?: string;
  currentProvider?: 'mangadex' | 'katana' | 'unknown';
  mangaSlugId?: string;
  chapterManager?: ChapterManager;
  format?: string;
  countryOfOrigin?: string;
}

const logDebug = (message: string, data?: any) => console.log(`[ChapterModal DEBUG] ${message}`, data || '');
const logError = (message: string, error?: any) => console.error(`[ChapterModal ERROR] ${message}`, error || '');

// const BASE_API_URL = 'https://takiapi.xyz';

export default function ChapterSourcesModal({ visible, onClose, chapter, mangaTitle, mangaId, anilistId, currentProvider, mangaSlugId, chapterManager, format, countryOfOrigin }: ChapterSourcesModalProps) {
  const router = useRouter();
  const { currentTheme: theme, isDarkMode } = useTheme();
  const { isIncognito } = useIncognito();
  const { setChapterPages } = useChapterPages();

  // Determine if content should use webnovel reader
  const shouldUseWebnovelReader = useCallback(() => {
    // Check if we have AniList data first
    if (format && countryOfOrigin) {
      // Use webnovel reader for:
      // - Korean content (manhwa)
      // - Chinese content (manhua) 
      // - Taiwan content (manhua)
      // - Any webtoon format
      return (
        format === 'WEBTOON' || 
        countryOfOrigin === 'KR' || 
        countryOfOrigin === 'CN' || 
        countryOfOrigin === 'TW'
      );
    }
    
    // Fallback logic when AniList data is not available
    // Check manga title for common indicators
    if (mangaTitle) {
      const titleToCheck = (
        mangaTitle.english || 
        mangaTitle.userPreferred || 
        mangaTitle.romaji || 
        ''
      ).toLowerCase();
      
      // Common patterns that indicate vertical reading content
      const verticalReadingIndicators = [
        'manhwa', 'manhua', 'webtoon', 'webcomic',
        // Korean indicators
        '한국', 'korean',
        // Chinese indicators  
        '中国', '中文', 'chinese', 'manhua',
        // Common webtoon/vertical format indicators
        'full color', 'colored', 'vertical'
      ];
      
      const hasVerticalIndicator = verticalReadingIndicators.some(indicator => 
        titleToCheck.includes(indicator)
      );
      
      if (hasVerticalIndicator) {
        return true;
      }
    }
    

    
    return false;
  }, [format, countryOfOrigin, mangaTitle, currentProvider]);

  // Debug props at component level
  console.log('🚀 MODAL COMPONENT PROPS:', {
    visible,
    currentProvider,
    mangaSlugId,
    mangaId,
    chapterId: chapter?.id,
    chapterNumber: chapter?.number,
    hasChapterManager: !!chapterManager,
    format,
    countryOfOrigin,
    shouldUseWebnovelReader: shouldUseWebnovelReader()
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pages, setPages] = useState<PageWithHeaders[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [isReadyToRead, setIsReadyToRead] = useState(false);

  // Direct API fallback when no ChapterManager is available
  const fetchChapterPagesDirectly = useCallback(async (selectedChapter: Chapter) => {
    logDebug("=== USING DIRECT API FALLBACK ===");
    logDebug("Selected chapter:", selectedChapter);
    logDebug("Current provider:", currentProvider);
    logDebug("Manga slug ID:", mangaSlugId);
    
    // Construct proper chapter ID: {mangaId}/chapter-{chapterNumber}
    const chapterNumber = selectedChapter.number;
    const properChapterId = mangaSlugId ? `${mangaSlugId}/chapter-${chapterNumber}` : selectedChapter.id;
    
    logDebug("Constructed chapter ID:", properChapterId);
    
    let imageUrls: PageWithHeaders[] = [];
    
    try {
      if (currentProvider === 'katana') {
        // Use MangaProviderService for Katana
        console.log('⚔️ USING MANGA PROVIDER SERVICE FOR KATANA:', {
          chapterId: properChapterId,
          mangaSlugId: mangaSlugId,
          chapterNumber: chapterNumber
        });
        
        try {
          imageUrls = await MangaProviderService.getChapterPages(properChapterId, 'katana');
          console.log('⚔️ MANGA PROVIDER SERVICE SUCCESS:', `${imageUrls.length} pages`);
          console.log('⚔️ MANGA PROVIDER SERVICE IMAGES:', imageUrls);
        } catch (providerError) {
          console.error('⚔️ MANGA PROVIDER SERVICE ERROR:', {
            error: providerError,
            chapterId: properChapterId,
            provider: currentProvider
          });
          throw providerError;
        }
      } else {
        // Fallback to MangaProviderService for other providers
        console.log('🔧 USING MANGA PROVIDER SERVICE:', {
          provider: currentProvider,
          chapterId: properChapterId,
          mangaSlugId: mangaSlugId,
          chapterNumber: chapterNumber
        });
        
        try {
          imageUrls = await MangaProviderService.getChapterPages(properChapterId, currentProvider as any);
          console.log('🔧 MANGA PROVIDER SERVICE SUCCESS:', `${imageUrls.length} pages`);
          console.log('🔧 MANGA PROVIDER SERVICE IMAGES:', imageUrls);
        } catch (providerError) {
          console.error('🔧 MANGA PROVIDER SERVICE ERROR:', {
            error: providerError,
            chapterId: properChapterId,
            provider: currentProvider
          });
          throw providerError;
        }
      }
      
      if (imageUrls.length === 0) {
        throw new Error("No pages found for this chapter.");
      }
      
      logDebug(`Setting pages state with ${imageUrls.length} images`);
      setPages(imageUrls);
      
    } catch (err: any) {
      console.error('💥 DIRECT API CALL COMPLETE ERROR:', {
        error: err,
        message: err.message,
        stack: err.stack,
        properChapterId: properChapterId,
        mangaSlugId: mangaSlugId,
        chapterNumber: chapterNumber,
        currentProvider: currentProvider,
        originalChapterId: selectedChapter.id
      });
      logError("Direct API call failed:", err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [currentProvider, mangaSlugId]);

  const fetchChapterPages = useCallback(async (selectedChapter: Chapter) => {
    setLoading(true);
    setError(null);
    setPages([]);
    
    logDebug("=== STARTING CHAPTER FETCH WITH CHAPTER MANAGER ===");
    logDebug("Selected chapter:", selectedChapter);
    logDebug("Has ChapterManager:", !!chapterManager);
    
    if (!chapterManager) {
      logError("No ChapterManager provided - using direct API fallback");
      // Fallback to direct API call without ChapterManager
      try {
        await fetchChapterPagesDirectly(selectedChapter);
      } catch (err: any) {
        logError("Direct API fallback failed:", err);
        setError("Failed to load chapter pages");
      }
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
        const pagesUrl = chapterManager.getChapterPagesUrl(normalizedChapter, 'https://magaapinovel.xyz');
        const provider = chapterManager.getProvider();
        
        logDebug(`=== USING ${provider.toUpperCase()} API VIA CHAPTER MANAGER ===`);
        console.log('🔗 GENERATED API URL:', pagesUrl);
        console.log('📍 PROVIDER:', provider);
        
        // Fetch the pages
        let imageUrls: PageWithHeaders[] = [];
        
        if (provider === 'mangadex' || provider === 'katana') {
            const response = await fetch(pagesUrl);
            logDebug('Response status:', response.status);
            
            const data = await response.json();
            logDebug('=== API RESPONSE RECEIVED ===');

            if (data?.error) {
                logError('API returned error:', data.error);
                throw new Error(`${data.error}. ${data.message || ''}`);
            }

            if (provider === 'katana') {
                console.log('⚔️ KATANA RAW API RESPONSE (length only):', data?.success ? 'Success' : 'Failed');
                
                // Katana API returns nested { success, data: { imageUrls | imageurls | pages }}
                const payload = (data && data.success && data.data) ? data.data : data;
                const katanaArray = payload?.imageUrls || payload?.imageurls || payload?.pages;
                
                if (Array.isArray(katanaArray)) {
                    console.log(`⚔️ KATANA: Found ${katanaArray.length} pages (URLs preserved verbatim)`);
                    
                    // CRITICAL: Preserve URLs EXACTLY as received - no transformations
                    imageUrls = katanaArray.map((page: any) => {
                        const imageUrl = page?.url || page;
                        const headers = (page && page.headers) || { 'Referer': 'https://mangakatana.com' };
                        return { url: imageUrl, headers } as PageWithHeaders;
                    });
                    
                    console.log(`⚔️ KATANA: Processed ${imageUrls.length} pages (URLs UNMODIFIED)`);
                    logDebug(`Successfully processed ${imageUrls.length} pages from katana API.`);
                } else {
                    console.error('⚔️ KATANA INVALID RESPONSE FORMAT');
                    throw new Error('Invalid katana API response format.');
                }
            } else {
                console.log('📚 MANGADEX: Response received');
                
                // MangaDex via TakiAPI can return an array of URLs or an object with images array
                let urls: string[] = [];
                if (Array.isArray(data)) {
                    urls = data.map((item: any) => {
                        const url = typeof item === 'string' ? item : (item?.img || item?.url || '');
                        return url;
                    }).filter((u: string) => !!u);
                } else if (Array.isArray(data?.images)) {
                    urls = data.images.map((img: any) => typeof img === 'string' ? img : (img?.url || '')).filter(Boolean);
                } else if (Array.isArray(data?.result?.images)) {
                    urls = data.result.images.map((img: any) => typeof img === 'string' ? img : (img?.url || '')).filter(Boolean);
                }

                if (urls.length === 0 && data?.pages && Array.isArray(data.pages)) {
                    // Some mirrors may still respond with pages[]
                    urls = data.pages.map((p: any) => p?.url).filter(Boolean);
                }

                if (urls.length === 0) {
                    console.error('📚 MANGADEX NO URLS FOUND');
                    throw new Error('Invalid mangadex API response format.');
                }

                console.log(`📚 MANGADEX: Found ${urls.length} pages (URLs preserved verbatim)`);

                // CRITICAL: Preserve URLs EXACTLY as received - no transformations
                const dexHeaders = { 
                    Referer: 'https://takiapi.xyz/',
                    'User-Agent': 'Mozilla/5.0'
                };
                imageUrls = urls.map((u: string) => ({ url: u, headers: dexHeaders }));
                
                console.log(`📚 MANGADEX: Processed ${imageUrls.length} pages (URLs UNMODIFIED)`);
                logDebug(`Successfully processed ${imageUrls.length} pages from mangadex API.`);
            }
            
        } else {
            // Fallback to MangaProviderService
            logDebug('=== USING MANGA PROVIDER SERVICE FALLBACK ===');
            console.log('🔧 MANGA PROVIDER SERVICE FALLBACK:', {
                chapterId,
                provider,
                pagesUrl
            });
            imageUrls = await MangaProviderService.getChapterPages(chapterId, provider as any);
            console.log('🔧 MANGA PROVIDER SERVICE RESULT:', imageUrls);
            console.log('🔧 MANGA PROVIDER SERVICE RESULT LENGTH:', imageUrls.length);
            logDebug(`MangaProviderService returned: ${imageUrls.length} pages`);
        }

        logDebug('=== FINAL RESULT ===');
        logDebug('Total image URLs found:', imageUrls.length);
        console.log('🎯 FINAL IMAGE URLS SUMMARY:', {
            totalCount: imageUrls.length,
            provider: provider,
            firstFewUrls: imageUrls.slice(0, 3).map(p => p.url),
            allUrls: imageUrls.map(p => p.url)
        });
        
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
  }, [chapterManager, fetchChapterPagesDirectly]);

  useEffect(() => {
    if (visible && chapter) {
      logDebug("Modal opened with chapter:", chapter);
      logDebug("Current provider:", currentProvider);
      logDebug("Manga slug ID:", mangaSlugId);
      logDebug("Manga ID:", mangaId);
      logDebug("AniList ID:", anilistId);
      logDebug("Format:", format);
      logDebug("Country of Origin:", countryOfOrigin);
      console.log('🎯 PROVIDER DEBUG:', {
        currentProvider,
        mangaSlugId,
        mangaId,
        anilistId,
        chapterId: chapter.id,
        chapterNumber: chapter.number,
        format,
        countryOfOrigin
      });
      fetchChapterPages(chapter);
    } else if (visible && !chapter) {
      logError("Modal opened without chapter data");
      setError("No chapter data available");
      setLoading(false);
    }
  }, [visible, chapter, fetchChapterPages, currentProvider, mangaSlugId, format, countryOfOrigin, anilistId, mangaId]);

  // Process images (decode Katana, prefetch others)
  const processAndCacheImages = useCallback(async () => {
    if (pages.length === 0) return;
    
    setIsProcessing(true);
    setProcessingProgress(0);
    console.log(`🔧 [Modal] Starting to process ${pages.length} images...`);
    
    try {
      const processedPages: PageWithHeaders[] = [];
      
      // Detect if this is Katana (needs special processing)
      const isKatana = pages.some(p => 
        p.url.includes('mangakatana') || 
        (p.headers && 'Referer' in p.headers && p.headers.Referer?.includes('mangakatana'))
      );
      
      for (let i = 0; i < pages.length; i++) {
        const page = pages[i];
        
        try {
          if (isKatana) {
            // Process Katana images (convert to base64 data URIs)
            console.log(`🔧 [Modal] Processing Katana image ${i + 1}/${pages.length}`);
            const processedUrl = await processKatanaImage(page.url, page.headers || {});
            
            // Prefetch the data URI to ensure it's cached
            await ExpoImage.prefetch(processedUrl, {
              cachePolicy: 'memory-disk'
            });
            
            processedPages.push({
              url: processedUrl,
              headers: {} // No headers needed for data URIs
            });
          } else {
            // For other providers, just prefetch with headers
            console.log(`🔧 [Modal] Prefetching image ${i + 1}/${pages.length}`);
            await ExpoImage.prefetch(page.url, {
              headers: page.headers,
              cachePolicy: 'memory-disk'
            });
            
            processedPages.push(page); // Keep original
          }
          
          // Update progress
          const progress = ((i + 1) / pages.length) * 100;
          setProcessingProgress(progress);
          console.log(`🔧 [Modal] Progress: ${Math.round(progress)}%`);
        } catch (error) {
          console.error(`🔧 [Modal] Failed to process image ${i + 1}:`, error);
          // On error, use original page
          processedPages.push(page);
        }
      }
      
      // Update pages with processed versions
      setPages(processedPages);
      setIsReadyToRead(true);
      console.log(`🔧 [Modal] ✅ All ${processedPages.length} images processed and cached!`);
    } catch (error) {
      console.error(`🔧 [Modal] Processing failed:`, error);
      setIsReadyToRead(true); // Allow reading even if processing failed
    } finally {
      setIsProcessing(false);
    }
  }, [pages]);
  
  // Auto-process images when they're loaded
  useEffect(() => {
    if (!loading && !error && pages.length > 0 && !isProcessing && !isReadyToRead) {
      console.log(`🔧 [Modal] Auto-starting image processing...`);
      processAndCacheImages();
    }
  }, [loading, error, pages, isProcessing, isReadyToRead, processAndCacheImages]);

  const navigateToReader = () => {
    if (pages.length === 0 || !chapter || !isReadyToRead) return;
    
    // Generate a unique chapter key for storing pages
    const chapterKey = `${mangaId}_${chapter.number}`;
    
    // Store pages in context (NO URL TRANSFORMATION - stored as-is)
    console.log('🔒 [ChapterModal] Storing pages WITHOUT transformation');
    console.log('🔒 [ChapterModal] First URL (verbatim from API):', pages[0]?.url);
    setChapterPages(chapterKey, pages);
    
    // Pass only metadata through navigation params (no URLs)
    const params: Record<string, any> = {
      title: chapter.title,
      chapter: chapter.number,
      mangaId,
      anilistId,
      shouldSaveProgress: !isIncognito,
      // Pass provider information to ensure reader maintains context
      readerCurrentProvider: currentProvider,
      readerMangaSlugId: mangaSlugId,
      // Pass format and country info for proper reader selection
      format,
      countryOfOrigin,
      // Pass chapter key to retrieve pages from store
      chapterPagesKey: chapterKey,
      // Pass page count for UI
      pageCount: pages.length
    };

    logDebug('Navigating to reader with stored pages:', {
      chapterTitle: chapter.title,
      chapterNumber: chapter.number,
      totalPages: pages.length,
      currentProvider,
      mangaSlugId,
      chapterKey,
      firstPageUrl: pages[0]?.url,
      hasHeaders: pages.some(p => p.headers && Object.keys(p.headers).length > 0)
    });
    
    // Determine which reader to use
    const readerPath = shouldUseWebnovelReader() ? '/webnovelreader' : '/reader';
    router.replace({ pathname: readerPath, params });
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
            <View style={styles.statusContainer}>
              <ActivityIndicator size="large" color={theme.colors.primary} />
              <Text style={{ color: theme.colors.text, marginTop: 12 }}>Loading chapter...</Text>
            </View>
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
              
              {/* Processing status */}
              {isProcessing && (
                <View style={{ padding: 16, alignItems: 'center' }}>
                  <ActivityIndicator size="small" color={theme.colors.primary} />
                  <Text style={{ color: theme.colors.text, marginTop: 8 }}>
                    Processing images... {Math.round(processingProgress)}%
                  </Text>
                  <View style={{ width: '100%', height: 4, backgroundColor: 'rgba(128,128,128,0.2)', borderRadius: 2, marginTop: 8, overflow: 'hidden' }}>
                    <View style={{ width: `${processingProgress}%`, height: '100%', backgroundColor: theme.colors.primary }} />
                  </View>
                </View>
              )}
              
              {/* Read button - disabled until ready */}
              <TouchableOpacity 
                style={[
                  styles.readButton, 
                  !isReadyToRead && { backgroundColor: '#666', opacity: 0.5 }
                ]} 
                onPress={navigateToReader}
                disabled={!isReadyToRead}
              >
                <Text style={styles.readButtonText}>
                  {isReadyToRead ? `Read Chapter (${pages.length} pages)` : 'Preparing...'}
                </Text>
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