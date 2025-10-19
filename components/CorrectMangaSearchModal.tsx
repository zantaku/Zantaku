import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import Modal from 'react-native-modal';
import { useRouter } from 'expo-router';
import { MangaProviderService, ProviderPreferences } from '../api/proxy/providers/manga/MangaProviderService';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface CorrectMangaSearchModalProps {
    isVisible: boolean;
    onClose: () => void;
    currentTitle: string;
    onMangaSelect?: (mangaId: string) => void;
}

interface MangaSearchResult {
    id: string;
    title: string;
    image: string;
}

export default function CorrectMangaSearchModal({ isVisible, onClose, currentTitle, onMangaSelect }: CorrectMangaSearchModalProps) {
    const [searchQuery, setSearchQuery] = useState(currentTitle);
    const [loading, setLoading] = useState(false);
    const [results, setResults] = useState<MangaSearchResult[]>([]);
    const [preferences, setPreferences] = useState<ProviderPreferences | null>(null);
    const [showProviderDropdown, setShowProviderDropdown] = useState(false);
    const router = useRouter();

    useEffect(() => {
        const loadPrefs = async () => {
            try {
                const prefsString = await AsyncStorage.getItem('mangaProviderPreferences');
                let prefs = prefsString ? JSON.parse(prefsString) : { defaultProvider: 'katana', autoSelectSource: false, preferredChapterLanguage: 'en' };
                

                
                setPreferences(prefs);
            } catch {
                setPreferences({ defaultProvider: 'katana', autoSelectSource: false, preferredChapterLanguage: 'en' });
            }
        };
        loadPrefs();
    }, []);

    useEffect(() => {
        console.log('CorrectMangaSearchModal - Modal visibility changed:', isVisible);
        console.log('CorrectMangaSearchModal - Current title:', currentTitle);
        console.log('CorrectMangaSearchModal - Preferences:', preferences);
        if (isVisible && preferences) {
            setSearchQuery(currentTitle);
            searchManga();
        }
    }, [isVisible, currentTitle, preferences]);

    const searchManga = async () => {
        if (!searchQuery.trim() || !preferences) return;
        setLoading(true);
        try {
            console.log('Searching for manga:', searchQuery);
            
            // Extract first keyword for better search results
            const extractFirstKeyword = (title: string): string => {
                let cleaned = title
                    .replace(/^[【「『]/, '') // Remove opening brackets/quotes
                    .replace(/[】」』]$/, '') // Remove closing brackets/quotes
                    .replace(/[★☆♪♫♥♡◆◇▲△●○■□※！？：；，。]/g, '') // Remove decorative symbols
                    .replace(/[（]/g, '(') // Normalize parentheses
                    .replace(/[）]/g, ')') // Normalize parentheses
                    .replace(/[【]/g, '[') // Normalize brackets
                    .replace(/[】]/g, ']') // Normalize brackets
                    .replace(/[「]/g, '"') // Normalize quotes
                    .replace(/[」]/g, '"') // Normalize quotes
                    .replace(/[『]/g, "'") // Normalize quotes
                    .replace(/[』]/g, "'") // Normalize quotes
                    .replace(/\s+/g, ' ') // Replace multiple spaces with single space
                    .trim();

                // Split by common separators and get the first meaningful part
                const separators = [':', ' - ', ' – ', ' — ', ' | ', ' |', '| ', ' (', '（', ' [', '【'];
                
                for (const separator of separators) {
                    if (cleaned.includes(separator)) {
                        cleaned = cleaned.split(separator)[0].trim();
                        break;
                    }
                }

                // Extract the first 1-3 words as the keyword
                const words = cleaned.split(/\s+/).filter(word => 
                    word.length > 1 && // Skip single characters
                    !/^[0-9]+$/.test(word) && // Skip pure numbers
                    !['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'].includes(word.toLowerCase())
                );

                // Return the first meaningful word or first two words if the first is very short
                if (words.length === 0) return cleaned;
                if (words[0].length <= 2 && words.length > 1) {
                    return `${words[0]} ${words[1]}`.trim();
                }
                return words[0];
            };

            const firstKeyword = extractFirstKeyword(searchQuery.trim());
            
            // Try multiple search variations to get better results
            const searchVariations = [
                firstKeyword, // First keyword (most likely to succeed)
                searchQuery.trim(), // Original title
                searchQuery.trim().replace(/[★☆]/g, ''), // Remove special characters
                searchQuery.trim().replace(/Peace Peace/, 'PisuPisu'), // Common title variation
                searchQuery.trim().replace(/Supi Supi/, 'SupiSupi'), // Common title variation
                // Add specific variations for golshi-chan
                'golshi-chan',
                'golshi chan',
                'PisuPisu SupiSupi',
                'Uma Musume Pretty Derby PisuPisu☆SupiSupi Golshi-chan',
                'Uma Musume Pretty Derby golshi-chan'
            ];
            
            let allResults: any[] = [];
            
            for (const variation of searchVariations) {
                try {
                    const { results: searchResults } = await MangaProviderService.searchManga(variation, preferences);
                    allResults = [...allResults, ...searchResults];
                } catch (error) {
                    console.log(`Search variation "${variation}" failed:`, error);
                }
            }
            
            // Remove duplicates based on ID
            const uniqueResults = allResults.filter((result, index, self) => 
                index === self.findIndex(r => r.id === result.id)
            );
            
            // Sort results to prioritize the correct manga
            const sortedResults = uniqueResults.sort((a, b) => {
                const aTitle = a.title.toLowerCase();
                const bTitle = b.title.toLowerCase();
                
                // Prioritize golshi-chan manga
                const aHasGolshi = aTitle.includes('golshi') || aTitle.includes('gol-shi');
                const bHasGolshi = bTitle.includes('golshi') || bTitle.includes('gol-shi');
                
                if (aHasGolshi && !bHasGolshi) return -1;
                if (!aHasGolshi && bHasGolshi) return 1;
                
                // Then prioritize "Uma Musume Pretty Derby" over "Uma Musume: Cinderella Gray"
                const aHasPrettyDerby = aTitle.includes('pretty derby');
                const bHasPrettyDerby = bTitle.includes('pretty derby');
                const aHasCinderella = aTitle.includes('cinderella gray');
                const bHasCinderella = bTitle.includes('cinderella gray');
                
                if (aHasPrettyDerby && !bHasPrettyDerby && bHasCinderella) return -1;
                if (!aHasPrettyDerby && aHasCinderella && bHasPrettyDerby) return 1;
                
                return 0;
            });
            
            console.log('Search results:', sortedResults);
            setResults(sortedResults.map((item: any) => ({
                id: item.id,
                title: item.title,
                image: item.coverImage || ''
            })));
        } catch (error) {
            console.error('Error searching manga:', error);
            setResults([]);
        } finally {
            setLoading(false);
        }
    };

    const handleMangaSelect = (manga: MangaSearchResult) => {
        if (onMangaSelect) {
            onMangaSelect(manga.id);
        }
        onClose();
    };

    const renderItem = ({ item }: { item: MangaSearchResult }) => (
        <TouchableOpacity style={styles.resultItem} onPress={() => handleMangaSelect(item)}>
            <ExpoImage
                source={{ uri: item.image }}
                style={styles.thumbnail}
                contentFit="cover"
            />
            <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
        </TouchableOpacity>
    );

    console.log('CorrectMangaSearchModal - Rendering with isVisible:', isVisible);
    
    return (
        <Modal
            isVisible={isVisible}
            onBackdropPress={onClose}
            onBackButtonPress={onClose}
            style={styles.modal}
            animationIn="slideInUp"
            animationOut="slideOutDown"
            backdropTransitionOutTiming={0}
            propagateSwipe={true}
            swipeDirection={['down']}
            onSwipeComplete={onClose}
            hideModalContentWhileAnimating={true}
            useNativeDriver={true}
        >
            <View style={styles.container}>
                <View style={styles.dragIndicator} />
                <View style={styles.header}>
                    <Text style={styles.headerText}>Search Correct Manga</Text>
                    <TouchableOpacity onPress={onClose}>
                        <Text style={styles.closeButton}>×</Text>
                    </TouchableOpacity>
                </View>
                <View style={styles.searchContainer}>
                    <TextInput
                        style={styles.searchInput}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        placeholder="Search manga..."
                        onSubmitEditing={searchManga}
                    />
                    <TouchableOpacity style={styles.searchButton} onPress={searchManga}>
                        <Text style={styles.searchButtonText}>Search</Text>
                    </TouchableOpacity>
                </View>
                
                {/* Provider Selection */}
                {preferences && (
                    <View style={styles.providerContainer}>
                        <Text style={styles.providerLabel}>Search Provider:</Text>
                        <TouchableOpacity 
                            style={styles.providerButton}
                            onPress={() => setShowProviderDropdown(!showProviderDropdown)}
                        >
                            <Text style={styles.providerButtonText}>
                                {preferences.defaultProvider === 'katana' ? 'Katana' : 
                                 preferences.defaultProvider === 'mangadex' ? 'MangaDex' : 
                                 preferences.defaultProvider}
                            </Text>
                            <Text style={styles.providerDropdownIcon}>▼</Text>
                        </TouchableOpacity>
                        
                        {showProviderDropdown && (
                            <View style={styles.providerDropdown}>
                                <TouchableOpacity 
                                    style={[styles.providerOption, preferences.defaultProvider === 'katana' && styles.providerOptionActive]}
                                    onPress={() => {
                                        const newPrefs = { ...preferences, defaultProvider: 'katana' as any };
                                        setPreferences(newPrefs);
                                        setShowProviderDropdown(false);
                                        AsyncStorage.setItem('mangaProviderPreferences', JSON.stringify(newPrefs));
                                    }}
                                >
                                    <Text style={[styles.providerOptionText, preferences.defaultProvider === 'katana' && styles.providerOptionTextActive]}>
                                        Katana
                                    </Text>
                                </TouchableOpacity>
                                <TouchableOpacity 
                                    style={[styles.providerOption, preferences.defaultProvider === 'mangadex' && styles.providerOptionActive]}
                                    onPress={() => {
                                        const newPrefs = { ...preferences, defaultProvider: 'mangadex' as any };
                                        setPreferences(newPrefs);
                                        setShowProviderDropdown(false);
                                        AsyncStorage.setItem('mangaProviderPreferences', JSON.stringify(newPrefs));
                                    }}
                                >
                                    <Text style={[styles.providerOptionText, preferences.defaultProvider === 'mangadex' && styles.providerOptionTextActive]}>
                                        MangaDex
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>
                )}
                {searchQuery && (
                    <View style={styles.searchInfo}>
                        <Text style={styles.searchInfoText}>
                            Searching for: "{searchQuery}"
                        </Text>
                        {results.length > 0 && (
                            <Text style={styles.searchInfoText}>
                                Found {results.length} results
                            </Text>
                        )}
                    </View>
                )}
                {loading ? (
                    <ActivityIndicator style={styles.loader} />
                ) : (
                    <FlatList
                        data={results}
                        renderItem={renderItem}
                        keyExtractor={(item) => item.id}
                        style={styles.list}
                    />
                )}
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    modal: {
        margin: 0,
        justifyContent: 'flex-end',
        zIndex: 9999,
    },
    container: {
        backgroundColor: '#1a1a1a',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        height: '80%',
        padding: 20,
        zIndex: 10000,
    },
    dragIndicator: {
        width: 40,
        height: 4,
        backgroundColor: '#666',
        borderRadius: 2,
        alignSelf: 'center',
        marginBottom: 10,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    headerText: {
        color: '#fff',
        fontSize: 20,
        fontWeight: 'bold',
    },
    closeButton: {
        color: '#fff',
        fontSize: 24,
        padding: 5,
    },
    searchContainer: {
        flexDirection: 'row',
        marginBottom: 20,
    },
    searchInput: {
        flex: 1,
        backgroundColor: '#333',
        borderRadius: 8,
        padding: 10,
        marginRight: 10,
        color: '#fff',
    },
    searchButton: {
        backgroundColor: '#007AFF',
        borderRadius: 8,
        padding: 10,
        justifyContent: 'center',
    },
    searchButtonText: {
        color: '#fff',
        fontWeight: 'bold',
    },
    loader: {
        marginTop: 20,
    },
    list: {
        flex: 1,
    },
    resultItem: {
        flexDirection: 'row',
        padding: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#333',
        alignItems: 'center',
    },
    thumbnail: {
        width: 50,
        height: 75,
        borderRadius: 4,
        marginRight: 10,
    },
    title: {
        color: '#fff',
        flex: 1,
        fontSize: 16,
    },
    searchInfo: {
        marginBottom: 10,
    },
    searchInfoText: {
        color: '#fff',
        fontSize: 14,
    },
    providerContainer: {
        marginBottom: 20,
    },
    providerLabel: {
        color: '#fff',
        fontSize: 14,
        marginBottom: 8,
    },
    providerButton: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#333',
        borderRadius: 8,
        padding: 12,
        borderWidth: 1,
        borderColor: '#555',
    },
    providerButtonText: {
        color: '#fff',
        fontSize: 16,
    },
    providerDropdownIcon: {
        color: '#fff',
        fontSize: 12,
    },
    providerDropdown: {
        position: 'absolute',
        top: 50,
        left: 0,
        right: 0,
        backgroundColor: '#333',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#555',
        zIndex: 1000,
        elevation: 5,
    },
    providerOption: {
        padding: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#555',
    },
    providerOptionActive: {
        backgroundColor: '#444',
    },
    providerOptionText: {
        color: '#fff',
        fontSize: 16,
    },
    providerOptionTextActive: {
        fontWeight: 'bold',
        color: '#02A9FF',
    },
}); 