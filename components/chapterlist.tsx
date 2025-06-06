import React, { useState, useRef, useEffect, useCallback, memo } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet, Dimensions, Platform, TextInput, ScrollView, FlatList } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useTheme } from '../hooks/useTheme';
import { Image as ExpoImage } from 'expo-image';
import { FontAwesome5 } from '@expo/vector-icons';
import ChapterSourcesModal from './ChapterSourcesModal';
import * as SecureStore from 'expo-secure-store';
import { STORAGE_KEY } from '../constants/auth';
import { Chapter, Provider } from '../api/proxy/providers/manga';
import { MangaProviderService, ProviderPreferences } from '../api/proxy/providers/manga/MangaProviderService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useIncognito } from '../hooks/useIncognito';
import axios from 'axios';

// #region Constants & Interfaces
const ANILIST_GRAPHQL_ENDPOINT = 'https://graphql.anilist.co';
const { width } = Dimensions.get('window');
const defaultThumbnail = 'https://via.placeholder.com/150';
const PLACEHOLDER_BLUR_HASH = 'L6PZfSi_.AyE_3t7t7R**0o#DgR4';

interface ChapterListProps {
  mangaTitle: {
    english: string;
    userPreferred: string;
    romaji?: string;
    native?: string;
  };
  anilistId?: string;
  coverImage?: string;
  mangaId?: string;
}


// #endregion

// #region Production-Safe Helper Functions
const logDebug = (message: string, data?: any) => console.log(`[ChapterList DEBUG] ${message}`, data || '');
const logError = (message: string, error?: any) => console.error(`[ChapterList ERROR] ${message}`, error || '');

const safeFormatDate = (dateString?: string, options?: Intl.DateTimeFormatOptions): string | null => {
  if (!dateString) return null;
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return null;
    return date.toLocaleDateString(undefined, options);
  } catch (error) {
    return null;
  }
};
// #endregion

// #region Production-Safe Chapter Card Components
const GridChapterCard = memo(({ chapter, onPress, readProgress, currentTheme, coverImage }: { chapter: Chapter; onPress: (chapter: Chapter) => void; readProgress: number; currentTheme: any; coverImage?: string; }) => {
    const chapterNum = parseFloat(chapter.number);
    const isRead = !isNaN(chapterNum) && chapterNum <= readProgress;
    return (
             <TouchableOpacity style={[styles.gridChapterCard, { backgroundColor: currentTheme.colors.surface }, isRead && styles.readGridCard]} onPress={() => onPress(chapter)} activeOpacity={0.7}>
        <View style={styles.gridThumbnailContainer}>
          <ExpoImage source={{ uri: chapter.thumbnail || coverImage || defaultThumbnail }} placeholder={PLACEHOLDER_BLUR_HASH} style={[styles.gridChapterThumbnail, isRead && styles.readGridThumbnail]} contentFit="cover" transition={200} />
          {isRead && <View style={styles.gridReadBadge}><FontAwesome5 name="check" size={8} color="#FFFFFF" /></View>}
          <View style={styles.gridChapterNumberBadge}><Text style={styles.gridChapterNumberText}>Ch. {chapter.number || '??'}</Text></View>
        </View>
        <View style={styles.gridChapterContent}>
            <Text style={[styles.gridChapterTitle, { color: currentTheme.colors.text }]} numberOfLines={2}>{chapter.title || `Chapter ${chapter.number}`}</Text>
        </View>
      </TouchableOpacity>
    );
});

const ListChapterCard = memo(({ chapter, onPress, readProgress, currentTheme, coverImage }: { chapter: Chapter; onPress: (chapter: Chapter) => void; readProgress: number; currentTheme: any; coverImage?: string; }) => {
    const chapterNum = parseFloat(chapter.number);
    const isRead = !isNaN(chapterNum) && chapterNum <= readProgress;
    return (
             <TouchableOpacity style={[styles.listChapterCard, { backgroundColor: currentTheme.colors.surface }, isRead && styles.readListCard]} onPress={() => onPress(chapter)} activeOpacity={0.7}>
        <ExpoImage source={{ uri: chapter.thumbnail || coverImage || defaultThumbnail }} placeholder={PLACEHOLDER_BLUR_HASH} style={[styles.listChapterThumbnail, isRead && styles.readListThumbnail]} contentFit="cover" transition={200} />
        <View style={styles.listChapterContent}>
          <Text style={[styles.listChapterTitle, { color: currentTheme.colors.text }]} numberOfLines={1}>Ch. {chapter.number}: {chapter.title || ''}</Text>
          <View style={styles.listMetaRow}>
            {chapter.updatedAt && <Text style={[styles.listMetaText, { color: currentTheme.colors.textSecondary }]}>{safeFormatDate(chapter.updatedAt, { month: 'short', day: 'numeric' })}</Text>}
          </View>
        </View>
        <TouchableOpacity style={[styles.listReadButton, isRead && styles.listRereadButton]} onPress={() => onPress(chapter)}>
            <FontAwesome5 name={isRead ? "book-reader" : "book-open"} size={14} color="#FFFFFF" />
        </TouchableOpacity>
      </TouchableOpacity>
    );
});
// #endregion

export default function ChapterList({ mangaTitle, anilistId, coverImage, mangaId }: ChapterListProps) {
    const { isDarkMode, currentTheme } = useTheme();
    const { isIncognito } = useIncognito();

    const [chapters, setChapters] = useState<Chapter[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [readProgress, setReadProgress] = useState(0);
    const [isNewestFirst, setIsNewestFirst] = useState(true);
    const [provider, setProvider] = useState<Provider>('mangadex');
    const [showChapterModal, setShowChapterModal] = useState(false);
    const [selectedChapter, setSelectedChapter] = useState<Chapter | null>(null);
    const [preferences, setPreferences] = useState<ProviderPreferences | null>(null);
    const [internalMangaId, setInternalMangaId] = useState<string | null>(mangaId || null);
    const [chapterRanges, setChapterRanges] = useState<Chapter[][]>([]);
    const [activeTab, setActiveTab] = useState(0);
    const [columnCount, setColumnCount] = useState<number>(1);

    const fetchAniListProgress = useCallback(async () => {
        if (!anilistId || isIncognito) return;
        try {
            const token = await SecureStore.getItemAsync(STORAGE_KEY.AUTH_TOKEN);
            if (!token) return;
            const query = `query ($mediaId: Int) { Media(id: $mediaId) { mediaListEntry { progress } } }`;
            const response = await axios.post(ANILIST_GRAPHQL_ENDPOINT, { query, variables: { mediaId: parseInt(anilistId) } }, { headers: { Authorization: `Bearer ${token}` } });
            if (response.data?.data?.Media?.mediaListEntry?.progress) {
                setReadProgress(response.data.data.Media.mediaListEntry.progress);
            }
        } catch (err) { logError('Failed to fetch AniList progress', err); }
    }, [anilistId, isIncognito]);

    const searchAndFetchChapters = useCallback(async (prefs: ProviderPreferences) => {
        setIsLoading(true);
        setError(null);
        setChapters([]);
        
        const titleToSearch = mangaTitle.userPreferred || mangaTitle.english;

        if (!titleToSearch) {
            setError("Manga title is missing.");
            setIsLoading(false);
            return;
        }

        try {
            logDebug(`Searching for "${titleToSearch}" with preferences:`, prefs);
            
            // Step 1: Search for the manga
            const { results, provider: successfulProvider } = await MangaProviderService.searchManga(titleToSearch, prefs);
            
            if (results.length === 0) {
                throw new Error("No manga found matching the search criteria.");
            }

            // Step 2: Find the best match
            const bestMatch = results.find(r => r.title.toLowerCase() === titleToSearch.toLowerCase()) || results[0];
            setInternalMangaId(bestMatch.id);
            setProvider(successfulProvider);
            
            logDebug(`Found manga: ${bestMatch.title} (ID: ${bestMatch.id}) from ${successfulProvider}`);

            // Step 3: Get chapters for the manga
            const chapters = await MangaProviderService.getChapters(bestMatch.id, successfulProvider, coverImage);
            
            if (chapters.length === 0) {
                throw new Error(`Manga found on ${successfulProvider}, but no chapters are available.`);
            }

            setChapters(chapters);
            logDebug(`Successfully loaded ${chapters.length} chapters from ${successfulProvider}`);

        } catch (error: any) {
            logError('Failed to load chapters:', error);
            const errorMessage = MangaProviderService.getProviderErrorMessage(prefs.defaultProvider, prefs.autoSelectSource);
            setError(errorMessage);
        }

        setIsLoading(false);
    }, [mangaTitle, coverImage]);

    useEffect(() => {
        const loadPrefs = async () => {
            try {
                const prefsString = await AsyncStorage.getItem('mangaProviderPreferences');
                                 setPreferences(prefsString ? JSON.parse(prefsString) : { defaultProvider: 'mangadex', autoSelectSource: false, preferredChapterLanguage: 'en' });
            } catch {
                                 setPreferences({ defaultProvider: 'mangadex', autoSelectSource: false, preferredChapterLanguage: 'en' });
            }
        };
        loadPrefs();
        fetchAniListProgress();
    }, [fetchAniListProgress]);
    
    useEffect(() => {
        if (preferences) searchAndFetchChapters(preferences);
    }, [preferences, searchAndFetchChapters]);

    useEffect(() => {
        logDebug(`Processing chapter ranges - chapters.length: ${chapters.length}, isNewestFirst: ${isNewestFirst}, activeTab: ${activeTab}`);
        
        const sorted = [...chapters].sort((a, b) => (isNewestFirst ? parseFloat(b.number) : parseFloat(a.number)) - (isNewestFirst ? parseFloat(a.number) : parseFloat(b.number)));
        const ranges: Chapter[][] = [];
        for (let i = 0; i < sorted.length; i += 24) {
            ranges.push(sorted.slice(i, i + 24));
        }
        
        logDebug(`Created ${ranges.length} chapter ranges`);
        logDebug(`First range has ${ranges[0]?.length || 0} chapters`);
        
        setChapterRanges(ranges);
        if (activeTab >= ranges.length) setActiveTab(0);
    }, [chapters, isNewestFirst, activeTab]);

    const handleChapterPress = useCallback((chapter: Chapter) => {
        logDebug("Chapter pressed, passing to modal:", chapter);
        setSelectedChapter(chapter);
        setShowChapterModal(true);
    }, []);

    const renderItem = useCallback(({ item }: { item: Chapter }) => {
        logDebug(`Rendering chapter item:`, { id: item.id, number: item.number, title: item.title });
        return (
            <View style={styles.cardWrapper}>
                {columnCount === 1 ? (
                    <ListChapterCard chapter={item} onPress={handleChapterPress} readProgress={readProgress} currentTheme={currentTheme} coverImage={coverImage} />
                ) : (
                    <GridChapterCard chapter={item} onPress={handleChapterPress} readProgress={readProgress} currentTheme={currentTheme} coverImage={coverImage} />
                )}
            </View>
        );
    }, [columnCount, handleChapterPress, readProgress, currentTheme, coverImage]);

    const renderTabLabel = (range: Chapter[]) => {
        if (!range || range.length === 0) return <Text style={styles.rangeButtonText}>...</Text>;
        const first = range[0]?.number;
        const last = range[range.length - 1]?.number;
        return <Text style={styles.rangeButtonText}>{first === last ? `Ch. ${first}` : `${first}-${last}`}</Text>;
    };

    if (isLoading) return <View style={styles.loadingContainer}><ActivityIndicator size="large" color={currentTheme.colors.primary} /></View>;
    if (error) return <View style={styles.errorContainer}><Text style={styles.errorText}>{error}</Text><TouchableOpacity style={styles.retryButton} onPress={() => {if(preferences) searchAndFetchChapters(preferences)}}><Text style={styles.retryButtonText}>Retry</Text></TouchableOpacity></View>;
    if (chapters.length === 0) return <View style={styles.emptyContainer}><Text style={styles.emptyText}>No chapters available.</Text></View>;

    // Debug the data being passed to FlashList
    const activeRange = chapterRanges[activeTab] || [];
    logDebug(`About to render FlashList with:`, {
        chaptersLength: chapters.length,
        chapterRangesLength: chapterRanges.length,
        activeTab,
        activeRangeLength: activeRange.length,
        firstChapterInRange: activeRange[0] ? { id: activeRange[0].id, number: activeRange[0].number } : null
    });

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={[styles.titleText, {color: currentTheme.colors.text}]}>Chapters</Text>
                <View style={styles.headerButtons}>
                    <TouchableOpacity style={styles.headerButton} onPress={() => setIsNewestFirst(p => !p)}><FontAwesome5 name={isNewestFirst ? "sort-numeric-down" : "sort-numeric-up"} size={16} color={currentTheme.colors.text} /></TouchableOpacity>
                    <TouchableOpacity style={styles.headerButton} onPress={() => setColumnCount(p => p === 1 ? 2 : 1)}><FontAwesome5 name={columnCount === 1 ? "th-large" : "th-list"} size={16} color={currentTheme.colors.text} /></TouchableOpacity>
                </View>
            </View>
             {chapterRanges.length > 1 && (
                <FlatList horizontal data={chapterRanges} keyExtractor={(_, index) => `range-${index}`} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rangeSelector}
                                         renderItem={({ item, index }) => (<TouchableOpacity style={[styles.rangeButton, {backgroundColor: currentTheme.colors.surface}, activeTab === index && styles.activeRangeButton]} onPress={() => setActiveTab(index)}>{renderTabLabel(item)}</TouchableOpacity>)} />
            )}
            <FlashList
                data={activeRange}
                renderItem={renderItem}
                keyExtractor={(item: Chapter) => item.id}
                numColumns={columnCount}
                key={columnCount}
                estimatedItemSize={columnCount === 1 ? 80 : 200}
                contentContainerStyle={styles.listContentContainer}
            />
            <ChapterSourcesModal
                visible={showChapterModal}
                chapter={selectedChapter}
                onClose={() => setShowChapterModal(false)}
                mangaTitle={mangaTitle}
                mangaId={internalMangaId || ''}
                anilistId={anilistId}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, width: '100%', paddingTop: 95 },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
    errorText: { fontSize: 16, textAlign: 'center', marginBottom: 16, color: '#FF5252' },
    retryButton: { backgroundColor: '#02A9FF', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
    retryButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
    emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    emptyText: { fontSize: 16, textAlign: 'center' },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, paddingHorizontal: 16 },
    titleText: { fontSize: 20, fontWeight: '700' },
    headerButtons: { flexDirection: 'row', gap: 8 },
    headerButton: { padding: 8, borderRadius: 20, width: 38, height: 38, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(128,128,128,0.2)' },
    rangeSelector: { paddingVertical: 8, paddingHorizontal: 16, gap: 8 },
    rangeButton: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
    activeRangeButton: { backgroundColor: '#02A9FF' },
    rangeButtonText: { fontWeight: '600', fontSize: 13, color: '#FFFFFF' },
    listContentContainer: { paddingHorizontal: 10, paddingBottom: 90 },
    cardWrapper: { flex: 1, padding: 6 },
    gridChapterCard: { borderRadius: 12, overflow: 'hidden' },
    gridThumbnailContainer: { width: '100%', aspectRatio: 3 / 4, position: 'relative' },
    gridChapterThumbnail: { width: '100%', height: '100%' },
    readGridThumbnail: { opacity: 0.6 },
    gridReadBadge: { position: 'absolute', top: 6, right: 6, backgroundColor: '#02A9FF', width: 18, height: 18, borderRadius: 9, justifyContent: 'center', alignItems: 'center' },
    gridChapterNumberBadge: { position: 'absolute', bottom: 6, left: 6, backgroundColor: 'rgba(0,0,0,0.7)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
    gridChapterNumberText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
    gridChapterContent: { padding: 8 },
    gridChapterTitle: { fontSize: 13, fontWeight: '600', minHeight: 32 },
    readGridCard: { opacity: 0.8 },
    listChapterCard: { flexDirection: 'row', alignItems: 'center', padding: 8, borderRadius: 10, gap: 12 },
    readListCard: { opacity: 0.7 },
    listChapterThumbnail: { width: 50, height: 70, borderRadius: 6 },
    readListThumbnail: { opacity: 0.6 },
    listChapterContent: { flex: 1, gap: 4 },
    listChapterTitle: { fontSize: 14, fontWeight: '600' },
    listMetaRow: { flexDirection: 'row', gap: 12 },
    listMetaText: { fontSize: 12 },
    listReadButton: { padding: 10, borderRadius: 8, backgroundColor: '#02A9FF' },
    listRereadButton: { backgroundColor: '#01579B' },
});