import { View, StyleSheet, Text, Platform, StatusBar } from 'react-native';
import { useState } from 'react';
import EpisodeList from './EpisodeList';
import CorrectAnimeSearchModal from './CorrectAnimeSearchModal';
import { TouchableOpacity } from 'react-native';
import { BlurView } from 'expo-blur';
import axios from 'axios';
import { ANILIST_GRAPHQL_ENDPOINT } from '../constants/auth';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { FontAwesome5 } from '@expo/vector-icons';

interface WatchTabProps {
  episodes: any[];
  loading: boolean;
  animeTitle: {
    english: string;
    userPreferred: string;
  };
  anilistId?: string;
  malId?: string;
  coverImage?: string;
  relations?: {
    edges: {
      relationType: string;
      node: {
        id: number;
        type: string;
        title: {
          userPreferred: string;
        };
        format: string;
      };
    }[];
  };
}

export default function WatchTab({ episodes, loading, animeTitle, anilistId, malId, coverImage, relations }: WatchTabProps) {
  const { isDarkMode, currentTheme } = useTheme();
  const [searchModalVisible, setSearchModalVisible] = useState(false);
  const [currentEpisodes, setCurrentEpisodes] = useState(episodes);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Function to extract manga title from anime relations
  const getMangaTitle = () => {
    if (!relations?.edges) return undefined;
    
    // Look for manga relations, prioritizing "SOURCE" relation type
    const mangaRelations = relations.edges.filter(edge => 
      edge.node.type === 'MANGA' && 
      (edge.relationType === 'SOURCE' || edge.relationType === 'ADAPTATION')
    );
    
    // Prefer SOURCE relation (original manga), then ADAPTATION
    const sourceRelation = mangaRelations.find(edge => edge.relationType === 'SOURCE');
    const adaptationRelation = mangaRelations.find(edge => edge.relationType === 'ADAPTATION');
    
    const selectedRelation = sourceRelation || adaptationRelation || mangaRelations[0];
    
    if (selectedRelation) {
      console.log(`Found manga relation: ${selectedRelation.node.title.userPreferred} (${selectedRelation.relationType})`);
      return selectedRelation.node.title.userPreferred;
    }
    
    return undefined;
  };

  const mangaTitle = getMangaTitle();

  const handleSearchPress = () => {
    setSearchModalVisible(true);
  };

  const handleAnimeSelect = async (animeId: string, poster: string) => {
    try {
      setIsLoading(true);
      console.log('Selected anime ID:', animeId);
      console.log('Poster URL:', poster);

      // First, get the first page of episodes to get pagination info
      const episodesUrl = `https://api.jikan.moe/v4/anime/${encodeURIComponent(animeId)}/episodes`;
      console.log('Fetching initial episode info from:', episodesUrl);

      const initialResponse = await axios.get(episodesUrl);
      console.log('Initial response pagination:', initialResponse.data.pagination);

      if (!initialResponse.data?.data) {
        console.error('Failed to get anime info:', initialResponse.data);
        throw new Error('Failed to get anime info');
      }

      let allEpisodes = [...initialResponse.data.data];
      const pagination = initialResponse.data.pagination;

      // If there are more pages, fetch them all in parallel
      if (pagination.has_next_page) {
        const totalPages = pagination.last_visible_page;
        console.log(`Fetching remaining ${totalPages - 1} pages...`);

        // Fetch episodes in batches of 5 pages to avoid overwhelming the API
        const batchSize = 5;
        const batches = Math.ceil((totalPages - 1) / batchSize);

        for (let batch = 0; batch < batches; batch++) {
          const startPage = batch * batchSize + 2; // +2 because we already have page 1
          const endPage = Math.min(startPage + batchSize - 1, totalPages);
          console.log(`Fetching batch ${batch + 1}/${batches} (pages ${startPage}-${endPage})`);

          const batchPromises = [];
          for (let page = startPage; page <= endPage; page++) {
            batchPromises.push(
              axios.get(`${episodesUrl}?page=${page}`)
            );
          }

          const batchResponses = await Promise.all(batchPromises);
          for (const response of batchResponses) {
            if (response.data?.data) {
              allEpisodes = [...allEpisodes, ...response.data.data];
            }
          }

          // Add a small delay between batches to avoid rate limiting
          if (batch < batches - 1) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      }

      console.log('Total episodes fetched:', allEpisodes.length);

      // Get the anime details to get the default episode thumbnail
      const animeDetailsUrl = `https://api.jikan.moe/v4/anime/${encodeURIComponent(animeId)}/full`;
      const animeDetailsResponse = await axios.get(animeDetailsUrl);
      const defaultThumbnail = animeDetailsResponse.data?.data?.images?.jpg?.image_url || poster;

      // Fetch episode thumbnails from the videos endpoint
      const videosUrl = `https://api.jikan.moe/v4/anime/${encodeURIComponent(animeId)}/videos/episodes`;
      console.log('Fetching episode videos from:', videosUrl);

      const videoResponse = await axios.get(videosUrl);
      const videoData = videoResponse.data?.data || [];
      const videoPagination = videoResponse.data?.pagination;

      let allVideos = [...videoData];

      // Fetch remaining video pages if any
      if (videoPagination?.has_next_page) {
        const totalVideoPages = videoPagination.last_visible_page;
        console.log(`Fetching remaining ${totalVideoPages - 1} video pages...`);

        // Fetch video pages in batches
        const videoBatchSize = 5;
        const videoBatches = Math.ceil((totalVideoPages - 1) / videoBatchSize);

        for (let batch = 0; batch < videoBatches; batch++) {
          const startPage = batch * videoBatchSize + 2;
          const endPage = Math.min(startPage + videoBatchSize - 1, totalVideoPages);
          console.log(`Fetching video batch ${batch + 1}/${videoBatches} (pages ${startPage}-${endPage})`);

          const batchPromises = [];
          for (let page = startPage; page <= endPage; page++) {
            batchPromises.push(
              axios.get(`${videosUrl}?page=${page}`)
            );
          }

          const batchResponses = await Promise.all(batchPromises);
          for (const response of batchResponses) {
            if (response.data?.data) {
              allVideos = [...allVideos, ...response.data.data];
            }
          }

          // Add a small delay between batches to avoid rate limiting
          if (batch < videoBatches - 1) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      }

      console.log('Total videos fetched:', allVideos.length);

      // Create a map of episode thumbnails from videos
      const thumbnailMap = new Map<number, string>();
      allVideos.forEach((video: any) => {
        // Try multiple patterns to extract episode numbers
        let episodeNumber: number | null = null;
        
        // Try direct episode field first
        if (video.episode) {
          const directMatch = video.episode.match(/(\d+)/);
          if (directMatch) {
            episodeNumber = parseInt(directMatch[1]);
          }
        }
        
        // If no match in episode field, try title
        if (!episodeNumber && video.title) {
          // Try different title patterns
          const patterns = [
            /Episode\s*(\d+)/i,
            /Ep\.*\s*(\d+)/i,
            /\#(\d+)/,
            /(\d+)話/,  // Japanese episode number
            /^(\d+)$/,  // Just a number
            /\s(\d+)\s/ // Number surrounded by spaces
          ];

          for (const pattern of patterns) {
            const match = video.title.match(pattern);
            if (match) {
              episodeNumber = parseInt(match[1]);
              break;
            }
          }
        }

        if (episodeNumber !== null && !isNaN(episodeNumber) && video.images?.jpg?.image_url) {
          thumbnailMap.set(episodeNumber, video.images.jpg.image_url);
          console.log(`Mapped thumbnail for episode ${episodeNumber}:`, video.images.jpg.image_url);
        }
      });

      // Map episodes with thumbnails, using multiple sources for thumbnails
      const mappedEpisodes = allEpisodes.map((episode: any) => {
        const episodeNumber = episode.mal_id;
        
        // Try to get thumbnail in this order:
        // 1. Episode's own image if available
        // 2. Matching video thumbnail
        // 3. Default anime thumbnail
        // 4. Provided poster
        let thumbnail = episode.images?.jpg?.image_url;
        
        if (!thumbnail) {
          thumbnail = thumbnailMap.get(episodeNumber);
          if (thumbnail) {
            console.log(`Using video thumbnail for episode ${episodeNumber}`);
          }
        }
        
        if (!thumbnail) {
          thumbnail = defaultThumbnail || poster;
          console.log(`Using default thumbnail for episode ${episodeNumber}`);
        }

        return {
          id: `${animeId}-episode-${episodeNumber}`,
          number: episodeNumber,
          title: episode.title || `Episode ${episodeNumber}`,
          description: episode.synopsis || 'No description available',
          image: thumbnail,
          duration: episode.duration || 24,
          isFiller: episode.filler || false,
          isRecap: episode.recap || false,
          aired: episode.aired,
          anilistId: animeId
        };
      }).sort((a, b) => b.number - a.number); // Sort in reverse order (newest first)

      console.log('Total mapped episodes:', mappedEpisodes.length);
      setCurrentEpisodes(mappedEpisodes);
      setSearchModalVisible(false);
    } catch (error) {
      console.error('Error getting anime info:', error);
      setError('Failed to load episodes. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: currentTheme.colors.background }]}>
      <View style={styles.contentContainer}>
        <View style={[styles.animeInfoContainer, { 
          backgroundColor: currentTheme.colors.background,
        }]}>
          <Text style={[styles.animeTitle, { color: currentTheme.colors.text }]} numberOfLines={1}>
            {animeTitle.english || animeTitle.userPreferred}
          </Text>
          <View style={styles.headerButtons}>
            <TouchableOpacity 
              style={[styles.headerButton, {
                backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(240, 240, 240, 0.9)'
              }]}
              onPress={handleSearchPress}
              activeOpacity={0.7}
            >
              <FontAwesome5 name="search" size={16} color={currentTheme.colors.text} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={[styles.episodeListContainer, { backgroundColor: currentTheme.colors.background }]}>
          <EpisodeList 
            episodes={currentEpisodes} 
            loading={isLoading} 
            animeTitle={animeTitle.english || animeTitle.userPreferred}
            anilistId={anilistId}
            malId={malId}
            coverImage={coverImage}
            mangaTitle={mangaTitle}
          />
        </View>
      </View>

      <CorrectAnimeSearchModal
        visible={searchModalVisible}
        onClose={() => setSearchModalVisible(false)}
        onSelectAnime={handleAnimeSelect}
        initialQuery={animeTitle.english || animeTitle.userPreferred}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
  },
  contentContainer: {
    flex: 1,
    width: '100%',
    paddingBottom: Platform.OS === 'ios' ? 100 : 90,
  },
  animeInfoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginTop: Platform.OS === 'ios' ? 88 : StatusBar.currentHeight ? StatusBar.currentHeight + 44 : 64,
  },
  animeTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    marginRight: 12,
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerButton: {
    padding: 8,
    borderRadius: 8,
  },
  episodeListContainer: {
    flex: 1,
    width: '100%',
  },
}); 