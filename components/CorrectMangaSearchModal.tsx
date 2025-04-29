import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import Modal from 'react-native-modal';
import { useRouter } from 'expo-router';

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

const BASE_API_URL = 'https://enoki-api.vercel.app';

export default function CorrectMangaSearchModal({ isVisible, onClose, currentTitle, onMangaSelect }: CorrectMangaSearchModalProps) {
    const [searchQuery, setSearchQuery] = useState(currentTitle);
    const [loading, setLoading] = useState(false);
    const [results, setResults] = useState<MangaSearchResult[]>([]);
    const router = useRouter();

    useEffect(() => {
        console.log('Modal visibility changed:', isVisible);
        if (isVisible) {
            setSearchQuery(currentTitle);
            searchManga();
        }
    }, [isVisible, currentTitle]);

    const searchManga = async () => {
        if (!searchQuery.trim()) return;
        setLoading(true);
        try {
            console.log('Searching for manga:', searchQuery);
            const cleanQuery = searchQuery.replace(/[^a-zA-Z\s]/g, '').trim();
            const response = await fetch(`${BASE_API_URL}/manganato/search/${encodeURIComponent(cleanQuery)}/1`);
            const data = await response.json();
            console.log('Search results:', data);
            if (Array.isArray(data)) {
                setResults(data.map((item: any) => ({
                    id: item.id,
                    title: item.title,
                    image: item.image
                })));
            } else {
                setResults([]);
            }
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
}); 