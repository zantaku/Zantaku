import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { NewsItem } from './ANN';

const ANILIST_GRAPHQL_ENDPOINT = 'https://graphql.anilist.co';
const STORAGE_KEY = {
  AUTH_TOKEN: 'auth_token'
};

export class AniListProvider {
  
  static async fetchNews(maxItems: number = 10): Promise<NewsItem[]> {
    try {
      console.log('🔍 Fetching AniList trending...');
      
      const token = await SecureStore.getItemAsync(STORAGE_KEY.AUTH_TOKEN);
      
      const { data } = await axios.post(
        ANILIST_GRAPHQL_ENDPOINT,
        {
          query: `
            query {
              Page(page: 1, perPage: ${maxItems}) {
                media(type: ANIME, sort: TRENDING_DESC, status: RELEASING) {
                  id
                  title {
                    userPreferred
                    romaji
                    english
                    native
                  }
                  coverImage {
                    medium
                  }
                  meanScore
                  nextAiringEpisode {
                    episode
                    timeUntilAiring
                  }
                  genres
                  format
                  status
                }
              }
              Viewer {
                options {
                  titleLanguage
                }
                mediaListOptions {
                  scoreFormat
                }
              }
            }
          `
        },
        {
          headers: {
            'Authorization': token ? `Bearer ${token}` : '',
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          }
        }
      );

      const newsItems = data.data.Page.media.map((anime: any) => {
        const titleLanguage = data.data.Viewer?.options?.titleLanguage?.toLowerCase() || 'romaji';
        const title = anime.title[titleLanguage] || anime.title.romaji || anime.title.userPreferred;
        
        return {
          id: `anilist-trending-${anime.id}`,
          title: title,
          source: 'AniList',
          timestamp: this.formatAiringTime(anime.nextAiringEpisode?.timeUntilAiring),
          url: `/anime/${anime.id}`,
          thumbnail: anime.coverImage.medium,
          category: 'Trending',
          isInternalLink: true,
          nextEpisode: anime.nextAiringEpisode?.episode,
          score: anime.meanScore,
          scoreFormat: data.data.Viewer?.mediaListOptions?.scoreFormat,
          description: `${anime.format} • ${anime.genres?.slice(0, 2).join(', ')} • ${anime.status}`,
          author: 'AniList Community'
        };
      });

      console.log(`✅ AniList: Fetched ${newsItems.length} trending items`);
      return newsItems;
      
    } catch (error) {
      console.error('❌ Error fetching AniList trending:', error);
      return [];
    }
  }
  
  private static formatAiringTime(seconds?: number): string {
    if (!seconds) return 'TBA';
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    return days > 0 ? `${days}d` : `${hours}h`;
  }
  
  static isAvailable(): boolean {
    return true;
  }
  
  static getSourceInfo() {
    return {
      name: 'AniList Trending',
      description: 'Show trending anime and manga from AniList',
      categories: ['anime', 'trending', 'community'],
      language: 'en',
      updateFrequency: '1 hour'
    };
  }
} 