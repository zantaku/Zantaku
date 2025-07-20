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
    const router = useRouter();

    useEffect(() => {
        const loadPrefs = async () => {
            try {
                const prefsString = await AsyncStorage.getItem('mangaProviderPreferences');
                let prefs = prefsString ? JSON.parse(prefsString) : { defaultProvider: 'mangafire', autoSelectSource: false, preferredChapterLanguage: 'en' };
                
                // Migrate from Katana to MangaFire if needed
                if (prefs.defaultProvider === 'katana') {
                    prefs.defaultProvider = 'mangafire';
                    await AsyncStorage.setItem('mangaProviderPreferences', JSON.stringify(prefs));
                    console.log('Migrated default provider from katana to mangafire');
                }
                
                setPreferences(prefs);
            } catch {
                setPreferences({ defaultProvider: 'mangafire', autoSelectSource: false, preferredChapterLanguage: 'en' });
            }
        };
        loadPrefs();
    }, []);

    useEffect(() => {
        console.log('Modal visibility changed:', isVisible);
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
            
            // Try multiple search variations to get better results
            const searchVariations = [
                searchQuery.trim(),
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
        zIndex: 1000,
    },
    container: {
        backgroundColor: '#1a1a1a',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        height: '80%',
        padding: 20,
        zIndex: 1001,
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
}); 