import React, { useState, useRef, useEffect, useCallback, memo, useMemo } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet, Dimensions, Platform, TextInput, ScrollView, FlatList } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useTheme } from '../hooks/useTheme';
import { Image as ExpoImage } from 'expo-image';
import { FontAwesome5 } from '@expo/vector-icons';
import ChapterSourcesModal from './ChapterSourcesModal';
import CorrectMangaSearchModal from './CorrectMangaSearchModal';
import { ChapterManager } from '../utils/ChapterManager';
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
  format?: string;
  countryOfOrigin?: string;
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

// #region Chapter Thumbnail Component
const ChapterThumbnail = memo(({ 
  thumbnailPage, 
  isLoading = false,
  fallbackImage
}: { 
  thumbnailPage?: { url: string; headers?: Record<string, string> }; 
  isLoading?: boolean;
  fallbackImage?: string;
}) => {
  if (isLoading) {
    return (
      <View style={styles.thumbnailContainer}>
        <ActivityIndicator size="small" color="#02A9FF" />
      </View>
    );
  }

  if (!thumbnailPage && !fallbackImage) {
    return (
      <View style={styles.thumbnailContainer}>
        <FontAwesome5 name="image" size={20} color="#666" />
      </View>
    );
  }

  return (
    <ExpoImage
      source={{ 
        uri: thumbnailPage?.url || fallbackImage || defaultThumbnail,
        headers: thumbnailPage?.headers 
      }}
      style={styles.thumbnailImage}
      contentFit="cover"
      placeholder={PLACEHOLDER_BLUR_HASH}
      transition={200}
    />
  );
});
// #endregion

// #region Production-Safe Chapter Card Components
const GridChapterCard = memo(({ 
    chapter, 
    onPress, 
    readProgress, 
    currentTheme, 
    coverImage, 
    onLoadThumbnails,
    isLoadingThumbnails 
}: { 
    chapter: Chapter; 
    onPress: (chapter: Chapter) => void; 
    readProgress: number; 
    currentTheme: any; 
    coverImage?: string; 
    onLoadThumbnails: (chapter: Chapter) => void;
    isLoadingThumbnails: boolean;
}) => {
    const chapterNum = parseFloat(chapter.number);
    const isRead = !isNaN(chapterNum) && chapterNum <= readProgress;
    
    // Trigger thumbnail loading when component mounts
    useEffect(() => {
        if (!chapter.thumbnailPage && !isLoadingThumbnails) {
            onLoadThumbnails(chapter);
        }
    }, [chapter, onLoadThumbnails, isLoadingThumbnails]);
    
    return (
        <TouchableOpacity style={[styles.gridChapterCard, { backgroundColor: currentTheme.colors.surface }, isRead && styles.readGridCard]} onPress={() => onPress(chapter)} activeOpacity={0.7}>
            <View style={styles.gridThumbnailContainer}>
                <ChapterThumbnail 
                    thumbnailPage={chapter.thumbnailPage} 
                    isLoading={isLoadingThumbnails}
                    fallbackImage={coverImage}
                />
                {isRead && <View style={styles.gridReadBadge}><FontAwesome5 name="check" size={8} color="#FFFFFF" /></View>}
                <View style={styles.gridChapterNumberBadge}><Text style={styles.gridChapterNumberText}>Ch. {chapter.number || '??'}</Text></View>
            </View>
            <View style={styles.gridChapterContent}>
                <Text style={[styles.gridChapterTitle, { color: currentTheme.colors.text }]} numberOfLines={2}>{chapter.title || `Chapter ${chapter.number}`}</Text>
            </View>
        </TouchableOpacity>
    );
});

const ListChapterCard = memo(({ 
    chapter, 
    onPress, 
    readProgress, 
    currentTheme, 
    coverImage, 
    onLoadThumbnails,
    isLoadingThumbnails 
}: { 
    chapter: Chapter; 
    onPress: (chapter: Chapter) => void; 
    readProgress: number; 
    currentTheme: any; 
    coverImage?: string; 
    onLoadThumbnails: (chapter: Chapter) => void;
    isLoadingThumbnails: boolean;
}) => {
    const chapterNum = parseFloat(chapter.number);
    const isRead = !isNaN(chapterNum) && chapterNum <= readProgress;
    
    // Trigger thumbnail loading when component mounts
    useEffect(() => {
        if (!chapter.thumbnailPage && !isLoadingThumbnails) {
            onLoadThumbnails(chapter);
        }
    }, [chapter, onLoadThumbnails, isLoadingThumbnails]);
    
    return (
        <TouchableOpacity style={[styles.listChapterCard, { backgroundColor: currentTheme.colors.surface }, isRead && styles.readListCard]} onPress={() => onPress(chapter)} activeOpacity={0.7}>
            <View style={styles.listThumbnailContainer}>
                <ChapterThumbnail 
                    thumbnailPage={chapter.thumbnailPage} 
                    isLoading={isLoadingThumbnails}
                    fallbackImage={coverImage}
                />
            </View>
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

// #region Continue Reading Button Component
const ContinueReadingButton = memo(({ 
    chapters, 
    readProgress, 
    onPress, 
    currentTheme, 
    coverImage 
}: { 
    chapters: Chapter[]; 
    readProgress: number; 
    onPress: (chapter: Chapter) => void; 
    currentTheme: any; 
    coverImage?: string; 
}) => {
    // Find the next unread chapter
    const nextChapter = useMemo(() => {
        if (readProgress === 0) {
            // If no progress, start from chapter 1 or the first available chapter
            return chapters.find(ch => parseFloat(ch.number) === 1) || chapters[0];
        }
        
        // Find the next chapter after current progress
        const sortedChapters = [...chapters].sort((a, b) => parseFloat(a.number) - parseFloat(b.number));
        return sortedChapters.find(ch => parseFloat(ch.number) > readProgress);
    }, [chapters, readProgress]);

    if (!nextChapter || chapters.length === 0) {
        return null; // Don't show button if no next chapter or no chapters
    }

    const isFirstChapter = readProgress === 0;
    const chapterNumber = nextChapter.number;
    const buttonText = isFirstChapter ? 'Start Reading' : `Continue Ch. ${chapterNumber}`;
    const progressText = isFirstChapter ? 'Begin your journey' : `Last read: Ch. ${readProgress}`;

    return (
        <TouchableOpacity 
            style={[styles.continueButton, { backgroundColor: currentTheme.colors.surface }]}
            onPress={() => onPress(nextChapter)}
            activeOpacity={0.8}
        >
            <View style={styles.continueButtonContent}>
                <View style={styles.continueThumbnailContainer}>
                    <ExpoImage
                        source={{ uri: coverImage || defaultThumbnail }}
                        style={styles.continueThumbnail}
                        contentFit="cover"
                        placeholder={PLACEHOLDER_BLUR_HASH}
                        transition={200}
                    />
                    <View style={styles.continueOverlay}>
                        <FontAwesome5 
                            name={isFirstChapter ? "play" : "book-open"} 
                            size={24} 
                            color="#FFFFFF" 
                        />
                    </View>
                </View>
                <View style={styles.continueTextContainer}>
                    <Text style={[styles.continueButtonText, { color: currentTheme.colors.text }]}>
                        {buttonText}
                    </Text>
                    <Text style={[styles.continueProgressText, { color: currentTheme.colors.textSecondary }]}>
                        {progressText}
                    </Text>
                    {nextChapter.title && (
                        <Text style={[styles.continueChapterTitle, { color: currentTheme.colors.textSecondary }]} numberOfLines={1}>
                            {nextChapter.title}
                        </Text>
                    )}
                </View>
                <View style={styles.continueArrow}>
                    <FontAwesome5 name="chevron-right" size={16} color={currentTheme.colors.textSecondary} />
                </View>
            </View>
        </TouchableOpacity>
    );
});
// #endregion

export default function ChapterList({ mangaTitle, anilistId, coverImage, mangaId, format, countryOfOrigin }: ChapterListProps) {
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
    const [showCorrectMangaModal, setShowCorrectMangaModal] = useState(false);
    const [currentMangaTitle, setCurrentMangaTitle] = useState<string>('');
    const [showProviderDropdown, setShowProviderDropdown] = useState(false);
    const [loadingThumbnails, setLoadingThumbnails] = useState<Set<string>>(new Set());
    const [chapterManager, setChapterManager] = useState<ChapterManager | undefined>(undefined);

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
        
        // Create a list of title variations to try, prioritizing Japanese/romaji titles
        const titleVariations = [
            mangaTitle.romaji,
            mangaTitle.native,
            mangaTitle.userPreferred,
            mangaTitle.english
        ].filter((title): title is string => Boolean(title)); // Remove null/undefined values and ensure type safety

        // Add specific title mappings for common variations
        const titleMappings: Record<string, string[]> = {
            'Uma Musume: Peace Peace★Supi Supi Gol': [
                'Uma Musume Pretty Derby PisuPisu☆SupiSupi Golshi-chan',
                'ウマ娘 ピスピス☆スピスピ ゴルシちゃん',
                'Uma Musume PisuPisu☆SupiSupi Golshi-chan',
                'golshi-chan',
                'golshi chan',
                'PisuPisu SupiSupi'
            ],
            'Uma Musume: Peace Peace☆Supi Supi Gol': [
                'Uma Musume Pretty Derby PisuPisu☆SupiSupi Golshi-chan',
                'ウマ娘 ピスピス☆スピスピ ゴルシちゃん',
                'Uma Musume PisuPisu☆SupiSupi Golshi-chan',
                'golshi-chan',
                'golshi chan',
                'PisuPisu SupiSupi'
            ],
            'Uma Musume: Peace Peace': [
                'Uma Musume Pretty Derby PisuPisu☆SupiSupi Golshi-chan',
                'golshi-chan',
                'PisuPisu SupiSupi'
            ]
        };

        // Add mapped variations to the search list
        for (const originalTitle of titleVariations) {
            if (titleMappings[originalTitle]) {
                titleVariations.push(...titleMappings[originalTitle]);
            }
        }

        // Remove duplicates while preserving order
        const uniqueTitleVariations = titleVariations.filter((title, index) => 
            titleVariations.indexOf(title) === index
        );

        if (uniqueTitleVariations.length === 0) {
            setError("Manga title is missing.");
            setIsLoading(false);
            return;
        }

        let lastError: Error | null = null;

        // Helper function to find the best match from search results
        const findBestMatch = (results: any[], searchTitle: string): any => {
            if (results.length === 0) return null;
            
            // Since MangaFire now returns results sorted by relevance, the first result is usually the best match
            // But let's still do some validation to ensure we're getting the right manga
            
            // First, try to find an exact match (case insensitive)
            const exactMatch = results.find(r => 
                r.title.toLowerCase() === searchTitle.toLowerCase()
            );
            if (exactMatch) {
                logDebug(`Found exact match: "${exactMatch.title}" for search "${searchTitle}"`);
                return exactMatch;
            }
            
            // Special case: Look for "golshi" or "gol-shi" in the title
            // This is a unique identifier for "Uma Musume Pretty Derby PisuPisu☆SupiSupi Golshi-chan"
            const golshiMatch = results.find(r => 
                r.title.toLowerCase().includes('golshi') || 
                r.title.toLowerCase().includes('gol-shi') ||
                r.title.toLowerCase().includes('golshi-chan')
            );
            if (golshiMatch) {
                logDebug(`Found golshi match: "${golshiMatch.title}" for search "${searchTitle}"`);
                logDebug(`Golshi match ID: "${golshiMatch.id}"`);
                return golshiMatch;
            }
            
            // Additional check: Look for the specific ID we know is correct
            const correctIdMatch = results.find(r => 
                r.id === 'uma-musume-pretty-derby-pisupisusupisupi-golshi-chann.3p4v8'
            );
            if (correctIdMatch) {
                logDebug(`Found correct ID match: "${correctIdMatch.title}" with ID: "${correctIdMatch.id}"`);
                return correctIdMatch;
            }
            
            // For Japanese titles, check if the first result contains key Japanese words
            const japaneseKeywords = ['地雷', '地原', 'なんですか', 'jirai', 'chihara'];
            const hasJapaneseKeywords = japaneseKeywords.some(keyword => 
                searchTitle.toLowerCase().includes(keyword.toLowerCase())
            );
            
            if (hasJapaneseKeywords) {
                // Look for results that contain Japanese keywords or their English equivalents
                const japaneseMatch = results.find(r => {
                    const title = r.title.toLowerCase();
                    return japaneseKeywords.some(keyword => 
                        title.includes(keyword.toLowerCase()) ||
                        (keyword === '地雷' && title.includes('landmine')) ||
                        (keyword === '地原' && title.includes('chihara')) ||
                        (keyword === 'なんですか' && title.includes('desu ka'))
                    );
                });
                
                if (japaneseMatch) {
                    logDebug(`Found Japanese keyword match: "${japaneseMatch.title}" for search "${searchTitle}"`);
                    return japaneseMatch;
                }
            }
            
            // If no exact match, try to find the best partial match
            const searchWords = searchTitle.toLowerCase().split(/\s+/).filter(word => word.length > 2);
            let bestMatch = results[0]; // Start with the first result (already sorted by relevance)
            let bestScore = 0;
            
            for (const result of results) {
                const resultTitle = result.title.toLowerCase();
                let score = 0;
                
                // Check how many search words are found in the result title
                for (const word of searchWords) {
                    if (resultTitle.includes(word)) {
                        score += word.length; // Longer words get more weight
                    }
                }
                
                // Bonus for matching at the beginning of the title
                if (resultTitle.startsWith(searchWords[0] || '')) {
                    score += 10;
                }
                
                // Bonus for having similar length
                const lengthDiff = Math.abs(resultTitle.length - searchTitle.length);
                if (lengthDiff < 10) {
                    score += 5;
                }
                
                // Special bonus for "Uma Musume Pretty Derby" titles
                if (resultTitle.includes('uma musume pretty derby')) {
                    score += 15;
                }
                
                // Penalty for "Cinderella Gray" when we're looking for something else
                if (resultTitle.includes('cinderella gray') && !searchTitle.toLowerCase().includes('cinderella')) {
                    score -= 20;
                }
                
                // Special handling for Japanese titles
                if (hasJapaneseKeywords) {
                    // Bonus for titles that seem to match the Japanese content
                    if (resultTitle.includes('landmine') && searchTitle.includes('地雷')) {
                        score += 25;
                    }
                    if (resultTitle.includes('chihara') && searchTitle.includes('地原')) {
                        score += 25;
                    }
                    if (resultTitle.includes('dangerous') && searchTitle.includes('地雷')) {
                        score += 20;
                    }
                }
                
                if (score > bestScore) {
                    bestScore = score;
                    bestMatch = result;
                }
            }
            
            logDebug(`Best match found: "${bestMatch.title}" with score ${bestScore} for search "${searchTitle}"`);
            
            // Additional validation: if the first result has a much higher score than others, prefer it
            if (results.length > 1) {
                const firstResultScore = calculateScoreForResult(results[0], searchTitle, searchWords, hasJapaneseKeywords);
                if (firstResultScore > bestScore + 10) {
                    logDebug(`First result has significantly higher score (${firstResultScore}), using it instead`);
                    return results[0];
                }
            }
            
            return bestMatch;
        };
        
        // Helper function to calculate score for a specific result
        const calculateScoreForResult = (result: any, searchTitle: string, searchWords: string[], hasJapaneseKeywords: boolean): number => {
            const resultTitle = result.title.toLowerCase();
            let score = 0;
            
            // Check how many search words are found in the result title
            for (const word of searchWords) {
                if (resultTitle.includes(word)) {
                    score += word.length;
                }
            }
            
            // Bonus for matching at the beginning of the title
            if (resultTitle.startsWith(searchWords[0] || '')) {
                score += 10;
            }
            
            // Bonus for having similar length
            const lengthDiff = Math.abs(resultTitle.length - searchTitle.length);
            if (lengthDiff < 10) {
                score += 5;
            }
            
            // Special handling for Japanese titles
            if (hasJapaneseKeywords) {
                if (resultTitle.includes('landmine') && searchTitle.includes('地雷')) {
                    score += 25;
                }
                if (resultTitle.includes('chihara') && searchTitle.includes('地原')) {
                    score += 25;
                }
                if (resultTitle.includes('dangerous') && searchTitle.includes('地雷')) {
                    score += 20;
                }
            }
            
            return score;
        };

        // Try each title variation until we find results
        for (const titleToSearch of uniqueTitleVariations) {
            try {
                logDebug(`Searching for "${titleToSearch}" with preferences:`, prefs);
                
                // Step 1: Search for the manga
                const { results, provider: successfulProvider } = await MangaProviderService.searchManga(titleToSearch, prefs);
                
                if (results.length === 0) {
                    logDebug(`No results found for "${titleToSearch}", trying next variation...`);
                    continue;
                }

                // Debug: Log all search results to understand what we're working with
                logDebug(`Search results for "${titleToSearch}":`);
                results.slice(0, 5).forEach((result: any, index: number) => {
                    logDebug(`  ${index + 1}. "${result.title}" (ID: ${result.id})`);
                });
                if (results.length > 5) {
                    logDebug(`  ... and ${results.length - 5} more results`);
                }

                // Step 2: Find the best match using improved algorithm
                let bestMatch = findBestMatch(results, titleToSearch);
                if (!bestMatch) {
                    logDebug(`No suitable match found for "${titleToSearch}", trying next variation...`);
                    continue;
                }
                
                logDebug(`Selected manga: "${bestMatch.title}" (ID: ${bestMatch.id}) from search results`);
                
                // Additional validation: Check if this seems like the right manga
                const expectedTitle = mangaTitle.userPreferred || mangaTitle.english || '';
                if (expectedTitle && bestMatch.title !== expectedTitle) {
                    logDebug(`⚠️ Title mismatch detected!`);
                    logDebug(`  Expected: "${expectedTitle}"`);
                    logDebug(`  Found: "${bestMatch.title}"`);
                    logDebug(`  Search query was: "${titleToSearch}"`);
                    
                    // Check if we should try to find a better match
                    const betterMatch = results.find(r => 
                        r.title.toLowerCase().includes('landmine') || 
                        r.title.toLowerCase().includes('chihara') ||
                        r.title.toLowerCase().includes('dangerous')
                    );
                    
                    if (betterMatch && betterMatch.id !== bestMatch.id) {
                        logDebug(`🔍 Found potentially better match: "${betterMatch.title}" (ID: ${betterMatch.id})`);
                        logDebug(`   Switching to better match`);
                        bestMatch = betterMatch;
                    }
                }
                
                setInternalMangaId(bestMatch.id);
                setProvider(successfulProvider);
                
                logDebug(`Found manga: ${bestMatch.title} (ID: ${bestMatch.id}) from ${successfulProvider} using title: "${titleToSearch}"`);
                
                // Log if this might be the wrong manga
                if (mangaTitle.userPreferred && bestMatch.title !== mangaTitle.userPreferred) {
                    logDebug(`⚠️ Potential wrong manga detected! Expected: "${mangaTitle.userPreferred}", Found: "${bestMatch.title}"`);
                }
                
                // Log the exact ID being used
                logDebug(`🔍 Using manga ID: "${bestMatch.id}" for title: "${bestMatch.title}"`);
                
                // Check if this is the correct golshi-chan manga
                if (bestMatch.title.includes('Golshi-chan') || bestMatch.title.includes('golshi')) {
                    logDebug(`✅ Found correct golshi-chan manga: "${bestMatch.title}" with ID: "${bestMatch.id}"`);
                }

                // Step 3: Get chapters for the manga
                const chapters = await MangaProviderService.getChapters(bestMatch.id, successfulProvider, coverImage);
                
                if (chapters.length === 0) {
                    logDebug(`Manga found but no chapters available for "${titleToSearch}", trying next variation...`);
                    continue;
                }

                setChapters(chapters);
                
                // Create ChapterManager for navigation
                const manager = new ChapterManager(chapters, successfulProvider, bestMatch.id);
                setChapterManager(manager);
                logDebug(`Created ChapterManager with ${chapters.length} chapters from ${successfulProvider}`);
                
                logDebug(`Successfully loaded ${chapters.length} chapters from ${successfulProvider} using title: "${titleToSearch}"`);
                setIsLoading(false);
                return; // Success! Exit the function

            } catch (error: any) {
                logError(`Failed to search for "${titleToSearch}":`, error);
                lastError = error;
                continue; // Try next title variation
            }
        }

        // If we get here, all title variations failed
        logError('Failed to load chapters with any title variation:', lastError);
        const errorMessage = `Could not find manga with any of the available titles: ${uniqueTitleVariations.join(', ')}. ${MangaProviderService.getProviderErrorMessage(prefs.defaultProvider, prefs.autoSelectSource)}`;
        setError(errorMessage);
        setIsLoading(false);
    }, [mangaTitle, coverImage]);

    useEffect(() => {
        const loadPrefs = async () => {
            try {
                const prefsString = await AsyncStorage.getItem('mangaProviderPreferences');
                let prefs = prefsString ? JSON.parse(prefsString) : { defaultProvider: 'mangafire', autoSelectSource: false, preferredChapterLanguage: 'en' };
                
                // Migrate from Katana to MangaFire if needed
                if (prefs.defaultProvider === 'katana') {
                    prefs.defaultProvider = 'mangafire';
                    await AsyncStorage.setItem('mangaProviderPreferences', JSON.stringify(prefs));
                    logDebug('Migrated default provider from katana to mangafire');
                }
                
                setPreferences(prefs);
            } catch {
                setPreferences({ defaultProvider: 'mangafire', autoSelectSource: false, preferredChapterLanguage: 'en' });
            }
        };
        const loadSortOrder = async () => {
            try {
                const sortOrder = await AsyncStorage.getItem('chapterSortOrder');
                if (sortOrder !== null) {
                    setIsNewestFirst(sortOrder === 'newest');
                }
            } catch (error) {
                logError('Failed to load chapter sort order:', error);
            }
        };
        loadPrefs();
        loadSortOrder();
        fetchAniListProgress();
        setCurrentMangaTitle(mangaTitle.userPreferred || mangaTitle.english || '');
    }, [fetchAniListProgress, mangaTitle]);
    
    useEffect(() => {
        if (preferences) searchAndFetchChapters(preferences);
    }, [preferences, searchAndFetchChapters]);

    useEffect(() => {
        logDebug(`Processing chapter ranges - chapters.length: ${chapters.length}, isNewestFirst: ${isNewestFirst}, activeTab: ${activeTab}`);
        
        // First sort chapters by number to create consistent ranges
        const sortedForRanges = [...chapters].sort((a, b) => parseFloat(a.number) - parseFloat(b.number));
        
        // Create ranges of 24 chapters each
        const ranges: Chapter[][] = [];
        for (let i = 0; i < sortedForRanges.length; i += 24) {
            const range = sortedForRanges.slice(i, i + 24);
            // Apply the sort order to each range
            const sortedRange = isNewestFirst 
                ? range.sort((a, b) => parseFloat(b.number) - parseFloat(a.number))
                : range.sort((a, b) => parseFloat(a.number) - parseFloat(b.number));
            ranges.push(sortedRange);
        }
        
        // If we want newest first, reverse the order of ranges too
        if (isNewestFirst) {
            ranges.reverse();
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

    const handleProviderChange = useCallback((newProvider: Provider) => {
        if (preferences) {
            const newPrefs = { ...preferences, defaultProvider: newProvider };
            setPreferences(newPrefs);
            AsyncStorage.setItem('mangaProviderPreferences', JSON.stringify(newPrefs));
        }
    }, [preferences]);

    const handleMangaChange = useCallback(() => {
        setShowCorrectMangaModal(true);
    }, []);

    const handleMangaSelect = useCallback((mangaId: string) => {
        setInternalMangaId(mangaId);
        if (preferences) {
            searchAndFetchChapters(preferences);
        }
    }, [preferences, searchAndFetchChapters]);

    // Function to lazily load thumbnail pages for a specific chapter
    const loadChapterThumbnails = useCallback(async (chapter: Chapter) => {
        if (chapter.thumbnailPage || loadingThumbnails.has(chapter.id)) {
            return; // Already loaded or loading
        }

        setLoadingThumbnails(prev => new Set(prev).add(chapter.id));

        try {
            const thumbnailPage = await MangaProviderService.getChapterThumbnailPage(chapter.id, provider);
            
            setChapters(prevChapters => 
                prevChapters.map(ch => 
                    ch.id === chapter.id 
                        ? { ...ch, thumbnailPage: thumbnailPage || undefined }
                        : ch
                )
            );
            
            logDebug(`Successfully loaded thumbnail for chapter ${chapter.number}`);
        } catch (error) {
            logError(`Failed to load thumbnail for chapter ${chapter.number}:`, error);
        } finally {
            setLoadingThumbnails(prev => {
                const newSet = new Set(prev);
                newSet.delete(chapter.id);
                return newSet;
            });
        }
    }, [provider, loadingThumbnails]);

    const renderItem = useCallback(({ item }: { item: Chapter }) => {
        logDebug(`Rendering chapter item:`, { id: item.id, number: item.number, title: item.title });
        return (
            <View style={styles.cardWrapper}>
                {columnCount === 1 ? (
                    <ListChapterCard 
                        chapter={item} 
                        onPress={handleChapterPress} 
                        readProgress={readProgress} 
                        currentTheme={currentTheme} 
                        coverImage={coverImage} 
                        onLoadThumbnails={loadChapterThumbnails} 
                        isLoadingThumbnails={loadingThumbnails.has(item.id)} 
                    />
                ) : (
                    <GridChapterCard 
                        chapter={item} 
                        onPress={handleChapterPress} 
                        readProgress={readProgress} 
                        currentTheme={currentTheme} 
                        coverImage={coverImage} 
                        onLoadThumbnails={loadChapterThumbnails} 
                        isLoadingThumbnails={loadingThumbnails.has(item.id)} 
                    />
                )}
            </View>
        );
    }, [columnCount, handleChapterPress, readProgress, currentTheme, coverImage, loadChapterThumbnails, loadingThumbnails]);

    const renderTabLabel = (range: Chapter[]) => {
        if (!range || range.length === 0) return <Text style={styles.rangeButtonText}>...</Text>;
        const first = range[0]?.number;
        const last = range[range.length - 1]?.number;
        return <Text style={styles.rangeButtonText}>{first === last ? `Ch. ${first}` : `${first}-${last}`}</Text>;
    };

    const getProviderColor = (provider: Provider) => {
        switch (provider) {
            case 'mangafire': return '#f44336';
            case 'mangadex': return '#FF6740';
    
            default: return '#02A9FF';
        }
    };

    const getProviderName = (provider: Provider) => {
        switch (provider) {
            case 'mangafire': return 'Mangafire';
            case 'mangadex': return 'MangaDex';
    
            default: return 'Unknown';
        }
    };

    const renderProviderChanger = () => (
        <View style={[styles.providerChanger, { backgroundColor: currentTheme.colors.surface }]}>
            <View style={styles.providerInfo}>
                <View style={styles.providerRow}>
                    <TouchableOpacity 
                        style={[styles.providerBadge, { backgroundColor: getProviderColor(provider) }]}
                        onPress={() => setShowProviderDropdown(!showProviderDropdown)}
                    >
                        <Text style={styles.providerBadgeText}>{getProviderName(provider)}</Text>
                        <FontAwesome5 
                            name={showProviderDropdown ? "chevron-up" : "chevron-down"} 
                            size={10} 
                            color="#fff" 
                            style={{ marginLeft: 6 }}
                        />
                    </TouchableOpacity>
                    <TouchableOpacity 
                        style={styles.changeProviderButton}
                        onPress={() => {
                            // Cycle through providers
                            const providers: Provider[] = ['mangafire', 'mangadex'];
                            const currentIndex = providers.indexOf(provider);
                            const nextProvider = providers[(currentIndex + 1) % providers.length];
                            handleProviderChange(nextProvider);
                        }}
                    >
                        <FontAwesome5 name="sync-alt" size={14} color={currentTheme.colors.text} />
                    </TouchableOpacity>
                </View>
                
                {showProviderDropdown && (
                    <View style={[styles.providerDropdown, { backgroundColor: currentTheme.colors.surface, borderColor: currentTheme.colors.border }]}>
                        {[
                            { id: 'mangafire', name: 'Mangafire', color: '#f44336' },
                            { id: 'mangadex', name: 'MangaDex', color: '#FF6740' },
                        ].map((providerOption) => (
                            <TouchableOpacity
                                key={providerOption.id}
                                style={[
                                    styles.providerDropdownItem,
                                    provider === providerOption.id && styles.providerDropdownItemActive,
                                    { borderBottomColor: currentTheme.colors.border }
                                ]}
                                onPress={() => {
                                    handleProviderChange(providerOption.id as Provider);
                                    setShowProviderDropdown(false);
                                }}
                            >
                                <View style={[styles.providerDropdownBadge, { backgroundColor: providerOption.color }]} />
                                <Text style={[
                                    styles.providerDropdownText, 
                                    { color: currentTheme.colors.text },
                                    provider === providerOption.id && styles.providerDropdownTextActive
                                ]}>
                                    {providerOption.name}
                                </Text>
                                {provider === providerOption.id && (
                                    <FontAwesome5 name="check" size={14} color={providerOption.color} />
                                )}
                            </TouchableOpacity>
                        ))}
                    </View>
                )}
                
                <TouchableOpacity 
                    style={styles.mangaTitleContainer}
                    onPress={handleMangaChange}
                >
                    <Text style={[styles.mangaTitle, { color: currentTheme.colors.text }]} numberOfLines={1}>
                        {currentMangaTitle}
                    </Text>
                    <FontAwesome5 name="edit" size={12} color={currentTheme.colors.textSecondary} />
                    {/* Warning indicator if wrong manga detected */}
                    {(() => {
                        if (!currentMangaTitle || !mangaTitle.userPreferred) return null;
                        
                        const currentWords = currentMangaTitle.toLowerCase().split(/\s+/);
                        const expectedWords = mangaTitle.userPreferred.toLowerCase().split(/\s+/);
                        
                        // Check if the current manga title is significantly different from expected
                        const hasCommonWords = expectedWords.some(word => 
                            word.length > 2 && currentWords.some(cw => cw.includes(word) || word.includes(cw))
                        );
                        
                        // Check for specific cases like "Uma Musume" vs "Uma Musume: Cinderella Gray"
                        const isWrongManga = !hasCommonWords || 
                            (currentMangaTitle.includes('Cinderella Gray') && !mangaTitle.userPreferred.includes('Cinderella Gray'));
                        
                        if (isWrongManga) {
                            return (
                                <TouchableOpacity 
                                    style={styles.warningIndicator}
                                    onPress={() => setShowCorrectMangaModal(true)}
                                >
                                    <FontAwesome5 name="exclamation-triangle" size={10} color="#FFA500" />
                                </TouchableOpacity>
                            );
                        }
                        return null;
                    })()}
                </TouchableOpacity>
            </View>
        </View>
    );

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
            {showProviderDropdown && (
                <TouchableOpacity 
                    style={styles.dropdownOverlay}
                    activeOpacity={1}
                    onPress={() => setShowProviderDropdown(false)}
                />
            )}
            {renderProviderChanger()}
            <ContinueReadingButton 
                chapters={chapters}
                readProgress={readProgress}
                onPress={handleChapterPress}
                currentTheme={currentTheme}
                coverImage={coverImage}
            />
            <View style={styles.header}>
                <Text style={[styles.titleText, {color: currentTheme.colors.text}]}>Chapters</Text>
                <View style={styles.headerButtons}>
                    <TouchableOpacity style={styles.headerButton} onPress={() => {
                        setIsNewestFirst(prev => {
                            const newValue = !prev;
                            AsyncStorage.setItem('chapterSortOrder', newValue ? 'newest' : 'oldest');
                            return newValue;
                        });
                    }}><FontAwesome5 name={isNewestFirst ? "sort-numeric-down" : "sort-numeric-up"} size={16} color={currentTheme.colors.text} /></TouchableOpacity>
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
                currentProvider={provider}
                mangaSlugId={internalMangaId || undefined}
                chapterManager={chapterManager}
                format={format}
                countryOfOrigin={countryOfOrigin}
            />
            <CorrectMangaSearchModal
                isVisible={showCorrectMangaModal}
                onClose={() => setShowCorrectMangaModal(false)}
                currentTitle={currentMangaTitle}
                onMangaSelect={handleMangaSelect}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, width: '100%', paddingTop: 100 },
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
    
    // Thumbnail Styles
    thumbnailContainer: { 
        width: '100%', 
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(128,128,128,0.2)',
        borderRadius: 8,
    },
    thumbnailImage: { 
        width: '100%', 
        height: '100%',
        borderRadius: 8,
    },
    
    // Grid Chapter Card Styles
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
    
    // List Chapter Card Styles
    listChapterCard: { flexDirection: 'row', alignItems: 'center', padding: 8, borderRadius: 10, gap: 12 },
    readListCard: { opacity: 0.7 },
    listThumbnailContainer: { width: 80, height: 110, borderRadius: 6, overflow: 'hidden' },
    listChapterThumbnail: { width: 50, height: 70, borderRadius: 6 },
    readListThumbnail: { opacity: 0.6 },
    listChapterContent: { flex: 1, gap: 4 },
    listChapterTitle: { fontSize: 14, fontWeight: '600' },
    listMetaRow: { flexDirection: 'row', gap: 12 },
    listMetaText: { fontSize: 12 },
    listReadButton: { padding: 10, borderRadius: 8, backgroundColor: '#02A9FF' },
    listRereadButton: { backgroundColor: '#01579B' },
    
    // Provider changer styles
    providerChanger: {
        marginHorizontal: 16,
        marginBottom: 16,
        borderRadius: 12,
        padding: 16,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        zIndex: 10000,
        position: 'relative',
    },
    providerInfo: {
        gap: 12,
    },
    providerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    providerBadge: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        flexDirection: 'row',
        alignItems: 'center',
    },
    providerBadgeText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '600',
    },
    changeProviderButton: {
        padding: 8,
        borderRadius: 20,
        backgroundColor: 'rgba(128,128,128,0.2)',
        width: 36,
        height: 36,
        justifyContent: 'center',
        alignItems: 'center',
    },
    mangaTitleContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 4,
    },
    mangaTitle: {
        fontSize: 16,
        fontWeight: '600',
        flex: 1,
        marginRight: 8,
    },
    // Provider dropdown styles
    providerDropdown: {
        position: 'absolute',
        top: 50,
        left: 0,
        right: 0,
        borderRadius: 8,
        borderWidth: 1,
        elevation: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        zIndex: 9999,
    },
    providerDropdownItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
    },
    providerDropdownItemActive: {
        backgroundColor: 'rgba(128,128,128,0.1)',
    },
    providerDropdownBadge: {
        width: 12,
        height: 12,
        borderRadius: 6,
        marginRight: 12,
    },
    providerDropdownText: {
        fontSize: 14,
        fontWeight: '500',
        flex: 1,
    },
    providerDropdownTextActive: {
        fontWeight: '600',
    },
    dropdownOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 9998,
    },
    
    // Continue Reading Button Styles
    continueButton: {
        marginHorizontal: 16,
        marginBottom: 16,
        borderRadius: 12,
        overflow: 'hidden',
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    continueButtonContent: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
    },
    continueThumbnailContainer: {
        width: 60,
        height: 80,
        borderRadius: 8,
        overflow: 'hidden',
        position: 'relative',
        marginRight: 16,
    },
    continueThumbnail: {
        width: '100%',
        height: '100%',
    },
    continueOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    continueTextContainer: {
        flex: 1,
        justifyContent: 'center',
    },
    continueButtonText: {
        fontSize: 18,
        fontWeight: '700',
        marginBottom: 4,
    },
    continueProgressText: {
        fontSize: 14,
        marginBottom: 2,
    },
    continueChapterTitle: {
        fontSize: 12,
        fontStyle: 'italic',
    },
    continueArrow: {
        marginLeft: 12,
    },
    warningIndicator: {
        marginLeft: 8,
        padding: 4,
        borderRadius: 4,
        backgroundColor: 'rgba(255, 165, 0, 0.2)',
    },
});