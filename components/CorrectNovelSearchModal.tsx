import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import Modal from 'react-native-modal';
import { useTheme } from '../hooks/useTheme';

interface CorrectNovelSearchModalProps {
    isVisible: boolean;
    onClose: () => void;
    currentTitle: string;
    onNovelSelect?: (novelId: string, novelTitle: string) => void;
}

interface NovelSearchResult {
    id: string;
    title: string;
    cover: string;
    status: string;
    type: string;
    rating: string;
    synopsis: string;
}

export default function CorrectNovelSearchModal({ isVisible, onClose, currentTitle, onNovelSelect }: CorrectNovelSearchModalProps) {
    const [searchQuery, setSearchQuery] = useState(currentTitle);
    const [loading, setLoading] = useState(false);
    const [results, setResults] = useState<NovelSearchResult[]>([]);
    const { currentTheme } = useTheme();

    useEffect(() => {
        console.log('Novel Modal visibility changed:', isVisible);
        if (isVisible) {
            setSearchQuery(currentTitle);
            if (currentTitle.trim()) {
                searchNovel();
            }
        }
    }, [isVisible, currentTitle]);

    const searchNovel = async () => {
        if (!searchQuery.trim()) return;
        setLoading(true);
        try {
            console.log('Searching for novel:', searchQuery);
            const url = `https://jelleeapi.app/novel/jellee/search?query=${encodeURIComponent(searchQuery)}`;
            console.log('API URL:', url);
            
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                },
            });
            
            console.log('Response status:', response.status);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            console.log('API Response:', data);
            
            // Handle the API response structure: { success: true, data: [...] }
            let novels = [];
            if (data.success && Array.isArray(data.data)) {
                novels = data.data;
            } else if (Array.isArray(data)) {
                novels = data;
            } else {
                console.log('Unexpected data format:', data);
                novels = [];
            }
            
            console.log('Novels found:', novels.length);
            
            // Map the API response to our expected format
            const mappedResults = novels.map((novel: any) => ({
                id: novel.id || novel.slug || novel.title,
                title: novel.title || 'Unknown Title',
                cover: novel.cover || novel.image || novel.thumbnail || '',
                status: novel.status || 'Unknown',
                type: novel.type || 'Novel',
                rating: novel.rating || 'N/A',
                synopsis: novel.synopsis || 'No synopsis available.'
            }));
            
            console.log('Mapped results:', mappedResults);
            setResults(mappedResults);
        } catch (error) {
            console.error('Error searching novel:', error);
            setResults([]);
        } finally {
            setLoading(false);
        }
    };

    const handleNovelSelect = (novel: NovelSearchResult) => {
        console.log('Selected novel:', novel);
        if (onNovelSelect) {
            onNovelSelect(novel.id, novel.title);
        }
        onClose();
    };

    const renderItem = ({ item }: { item: NovelSearchResult }) => (
        <TouchableOpacity 
            style={[styles.resultItem, { backgroundColor: currentTheme.colors.surface }]} 
            onPress={() => handleNovelSelect(item)}
        >
            <ExpoImage
                source={{ uri: item.cover || 'https://via.placeholder.com/150' }}
                style={styles.thumbnail}
                contentFit="cover"
            />
            <View style={styles.itemContent}>
                <Text style={[styles.title, { color: currentTheme.colors.text }]} numberOfLines={2}>
                    {item.title}
                </Text>
                <View style={styles.metadata}>
                    <Text style={[styles.metaText, { color: currentTheme.colors.textSecondary }]}>
                        {item.type} • {item.status}
                    </Text>
                    {item.rating !== 'N/A' && (
                        <Text style={[styles.rating, { color: currentTheme.colors.primary }]}>
                            ★ {item.rating}
                        </Text>
                    )}
                </View>
                <Text 
                    style={[styles.synopsis, { color: currentTheme.colors.textSecondary }]} 
                    numberOfLines={2}
                >
                    {item.synopsis}
                </Text>
            </View>
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
            <View style={[styles.container, { backgroundColor: currentTheme.colors.background }]}>
                <View style={[styles.dragIndicator, { backgroundColor: currentTheme.colors.textSecondary }]} />
                <View style={styles.header}>
                    <Text style={[styles.headerText, { color: currentTheme.colors.text }]}>
                        Search Correct Novel
                    </Text>
                    <TouchableOpacity onPress={onClose}>
                        <Text style={[styles.closeButton, { color: currentTheme.colors.text }]}>×</Text>
                    </TouchableOpacity>
                </View>
                <View style={styles.searchContainer}>
                    <TextInput
                        style={[styles.searchInput, { 
                            backgroundColor: currentTheme.colors.surface, 
                            color: currentTheme.colors.text 
                        }]}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        placeholder="Search novel..."
                        placeholderTextColor={currentTheme.colors.textSecondary}
                        onSubmitEditing={searchNovel}
                    />
                    <TouchableOpacity 
                        style={[styles.searchButton, { backgroundColor: currentTheme.colors.primary }]} 
                        onPress={searchNovel}
                        disabled={loading}
                    >
                        <Text style={styles.searchButtonText}>
                            {loading ? 'Searching...' : 'Search'}
                        </Text>
                    </TouchableOpacity>
                </View>
                {loading ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color={currentTheme.colors.primary} />
                        <Text style={[styles.loadingText, { color: currentTheme.colors.textSecondary }]}>
                            Searching novels...
                        </Text>
                    </View>
                ) : (
                    <FlatList
                        data={results}
                        renderItem={renderItem}
                        keyExtractor={(item) => item.id}
                        style={styles.list}
                        showsVerticalScrollIndicator={false}
                        ListEmptyComponent={
                            <View style={styles.emptyContainer}>
                                <Text style={[styles.emptyText, { color: currentTheme.colors.textSecondary }]}>
                                    {searchQuery.trim() ? 'No novels found. Try a different search term.' : 'Enter a search term to find novels.'}
                                </Text>
                            </View>
                        }
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
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        height: '80%',
        padding: 20,
        zIndex: 1001,
    },
    dragIndicator: {
        width: 40,
        height: 4,
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
        fontSize: 20,
        fontWeight: 'bold',
    },
    closeButton: {
        fontSize: 24,
        padding: 5,
    },
    searchContainer: {
        flexDirection: 'row',
        marginBottom: 20,
        gap: 10,
    },
    searchInput: {
        flex: 1,
        borderRadius: 8,
        padding: 12,
        fontSize: 16,
    },
    searchButton: {
        borderRadius: 8,
        paddingHorizontal: 16,
        paddingVertical: 12,
        justifyContent: 'center',
        minWidth: 80,
    },
    searchButtonText: {
        color: '#fff',
        fontWeight: 'bold',
        textAlign: 'center',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 16,
    },
    loadingText: {
        fontSize: 16,
    },
    list: {
        flex: 1,
    },
    resultItem: {
        flexDirection: 'row',
        padding: 12,
        borderRadius: 12,
        marginBottom: 12,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    thumbnail: {
        width: 60,
        height: 90,
        borderRadius: 8,
        marginRight: 12,
    },
    itemContent: {
        flex: 1,
        justifyContent: 'space-between',
    },
    title: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 4,
    },
    metadata: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    metaText: {
        fontSize: 12,
        flex: 1,
    },
    rating: {
        fontSize: 12,
        fontWeight: '600',
    },
    synopsis: {
        fontSize: 12,
        lineHeight: 16,
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingTop: 60,
    },
    emptyText: {
        fontSize: 16,
        textAlign: 'center',
        paddingHorizontal: 20,
    },
}); 