import axios from 'axios';
import { JIKAN_API_ENDPOINT } from '../../../../constants/api';

export interface JikanEpisode {
  mal_id: number;
  url: string;
  title: string;
  title_japanese: string;
  title_romanji: string;
  aired: string;
  score: number;
  filler: boolean;
  recap: boolean;
  forum_url: string;
}

export interface JikanEpisodeResponse {
  data: JikanEpisode[];
  pagination: {
    last_visible_page: number;
    has_next_page: boolean;
    current_page: number;
    items: {
      count: number;
      total: number;
      per_page: number;
    };
  };
}

export class JikanProvider {
  private baseUrl = JIKAN_API_ENDPOINT;

  /**
   * Get episodes from Jikan API using MAL ID
   */
  async getEpisodes(malId: string | number): Promise<any[]> {
    try {
      console.log(`\n📺 [JIKAN EPISODES START] ===================`);
      console.log(`[JIKAN] 📺 Getting episodes for MAL ID: ${malId}`);
      
      const episodesUrl = `${this.baseUrl}/anime/${malId}/episodes`;
      console.log(`[JIKAN] 📡 Episodes URL: ${episodesUrl}`);
      
      const response = await axios.get(episodesUrl, {
        params: { page: 1 }
      });
      
      console.log(`[JIKAN] ✅ Episodes response received (status ${response.status})`);
      
      if (!response.data?.data || !Array.isArray(response.data.data)) {
        throw new Error('No episodes in Jikan response');
      }

      const episodes = response.data.data;
      const pagination = response.data.pagination;
      
      console.log(`[JIKAN] 📊 Initial response:`, {
        episodesFound: episodes.length,
        hasNextPage: pagination?.has_next_page,
        totalPages: pagination?.last_visible_page
      });

      let allEpisodes = [...episodes];

      // Fetch remaining pages if any
      if (pagination?.has_next_page) {
        const totalPages = pagination.last_visible_page;
        console.log(`[JIKAN] 📄 Fetching remaining ${totalPages - 1} pages...`);

        // Fetch episodes in batches to avoid overwhelming the API
        const batchSize = 5;
        const batches = Math.ceil((totalPages - 1) / batchSize);

        for (let batch = 0; batch < batches; batch++) {
          const startPage = batch * batchSize + 2; // +2 because we already have page 1
          const endPage = Math.min(startPage + batchSize - 1, totalPages);
          console.log(`[JIKAN] 📦 Fetching batch ${batch + 1}/${batches} (pages ${startPage}-${endPage})`);

          const batchPromises = [];
          for (let page = startPage; page <= endPage; page++) {
            batchPromises.push(
              axios.get(episodesUrl, { params: { page } })
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

      console.log(`[JIKAN] ✅ Total episodes fetched: ${allEpisodes.length}`);
      
      // Debug: Log first few episodes to see the structure
      if (allEpisodes.length > 0) {
        console.log(`[JIKAN] 🔍 Sample episode structure:`, {
          firstEpisode: allEpisodes[0],
          episodeKeys: Object.keys(allEpisodes[0]),
          malId: allEpisodes[0].mal_id,
          title: allEpisodes[0].title,
          aired: allEpisodes[0].aired
        });
      }
      
      // Convert Jikan episodes to our Episode format
      const convertedEpisodes = allEpisodes.map((ep: JikanEpisode) => ({
        id: `jikan-${malId}-${ep.mal_id}`,
        number: ep.mal_id, // Use mal_id as episode number
        title: ep.title || `Episode ${ep.mal_id}`,
        image: undefined, // Jikan episodes endpoint doesn't include images
        description: undefined,
        duration: undefined,
        provider: 'Jikan',
        isSubbed: true, // Jikan doesn't distinguish sub/dub, assume subbed
        isDubbed: false,
        isFiller: ep.filler || false,
        isRecap: ep.recap || false,
        aired: ep.aired,
        anilistId: malId.toString(),
        providerIds: {
          jikan: malId.toString()
        }
      }));

      console.log(`[JIKAN] ✅ Processed ${convertedEpisodes.length} episodes`);
      console.log(`📺 [JIKAN EPISODES END] ===================\n`);
      
      return convertedEpisodes;
      
    } catch (error) {
      console.log(`[JIKAN] ❌ Error fetching episodes:`, {
        error: (error as any)?.message,
        status: (error as any)?.response?.status,
        malId
      });
      throw error;
    }
  }

  /**
   * Get anime info from Jikan API
   */
  async getAnimeInfo(malId: string | number): Promise<any> {
    try {
      console.log(`[JIKAN] 🔍 Getting anime info for MAL ID: ${malId}`);
      
      const infoUrl = `${this.baseUrl}/anime/${malId}/full`;
      const response = await axios.get(infoUrl);
      
      if (!response.data?.data) {
        throw new Error('No anime data in Jikan response');
      }

      const anime = response.data.data;
      console.log(`[JIKAN] ✅ Found anime: ${anime.title}`);
      
      return {
        id: anime.mal_id,
        title: {
          userPreferred: anime.title,
          english: anime.title_english,
          romaji: anime.title_romaji,
          native: anime.title_japanese
        },
        episodes: anime.episodes,
        status: anime.status,
        format: anime.type,
        coverImage: {
          large: anime.images?.jpg?.large_image_url || anime.images?.jpg?.image_url
        },
        startDate: {
          year: anime.aired?.from ? new Date(anime.aired.from).getFullYear() : undefined,
          month: anime.aired?.from ? new Date(anime.aired.from).getMonth() + 1 : undefined,
          day: anime.aired?.from ? new Date(anime.aired.from).getDate() : undefined
        }
      };
      
    } catch (error) {
      console.log(`[JIKAN] ❌ Error fetching anime info:`, {
        error: (error as any)?.message,
        status: (error as any)?.response?.status,
        malId
      });
      throw error;
    }
  }
}

export const jikanProvider = new JikanProvider();
