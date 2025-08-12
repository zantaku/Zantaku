import axios from 'axios';
import { Chapter } from './index';

const MANGAFIRE_BASE_URL = 'https://mangafire.to';
const MANGAFIRE_API_URL = 'https://magaapinovel.xyz/api';

interface MangaFireSearchResult {
  id: string;
  title: string;
  altTitles: string[];
  description: string;
  coverImage: string;
  status: string;
  type: string;
  genres: string[];
  authors: string[];
  rating: number;
  views: number;
  lastUpdated: string;
}

interface MangaFireChapter {
  id: string;
  number: string;
  title: string;
  url: string;
  updatedAt: string;
  scanlationGroup: string;
  pages: number;
}

interface MangaFirePage {
  url: string;
  number: number;
  headers?: any;
}

interface MangaFireChapterResponse {
  pages: MangaFirePage[];
  isLatestChapter: boolean;
}

export class MangaFireProvider {
  private async makeRequest(endpoint: string, query: string = '') {
    try {
      const url = `${MANGAFIRE_API_URL}${endpoint}${query}`;
      console.log(`[MangaFire] Making request to ${url}`);
      
      const response = await axios.get(url, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Kamilist/1.0'
        }
      });
      
      console.log(`[MangaFire] Response from ${endpoint}${query}:`, JSON.stringify(response.data).substring(0, 500) + (JSON.stringify(response.data).length > 500 ? '...' : ''));
      return response.data;
    } catch (error) {
      console.error(`MangaFire API Error (${endpoint}${query}):`, error);
      
      if (axios.isAxiosError(error) && error.response) {
        console.error(`[MangaFire] Response status: ${error.response.status}`);
        console.error(`[MangaFire] Response data:`, error.response.data);
      }
      
      throw error;
    }
  }

  // Helper function to normalize titles for better matching
  private normalizeTitle(title: string): string {
    return title
      .toLowerCase()
      .replace(/[★☆]/g, '') // Remove special characters
      .replace(/[:\-\s]+/g, ' ') // Normalize separators
      .trim();
  }

  // Helper function to calculate title similarity score
  private calculateSimilarityScore(searchTitle: string, resultTitle: string): number {
    const normalizedSearch = this.normalizeTitle(searchTitle);
    const normalizedResult = this.normalizeTitle(resultTitle);
    
    // Exact match gets highest score
    if (normalizedSearch === normalizedResult) {
      return 100;
    }
    
    // Check if search title is contained in result title
    if (normalizedResult.includes(normalizedSearch)) {
      return 90;
    }
    
    // Check if result title is contained in search title
    if (normalizedSearch.includes(normalizedResult)) {
      return 85;
    }
    
    // Special handling for Japanese titles and their English equivalents
    const japaneseMappings = {
      '地雷': ['landmine', 'dangerous', 'jirai'],
      '地原': ['chihara'],
      'なんですか': ['desu ka', 'what is', 'is it'],
      'jirai': ['地雷', 'landmine', 'dangerous'],
      'chihara': ['地原']
    };
    
    // Check for Japanese-English mappings
    for (const [japanese, english] of Object.entries(japaneseMappings)) {
      if (normalizedSearch.includes(japanese) || english.some(e => normalizedSearch.includes(e))) {
        if (normalizedResult.includes(japanese) || english.some(e => normalizedResult.includes(e))) {
          // High score for matching Japanese-English pairs
          return 80;
        }
      }
    }
    
    // Split into words and calculate word overlap
    const searchWords = normalizedSearch.split(/\s+/).filter(word => word.length > 2);
    const resultWords = normalizedResult.split(/\s+/).filter(word => word.length > 2);
    
    if (searchWords.length === 0 || resultWords.length === 0) {
      return 0;
    }
    
    let matchCount = 0;
    let totalScore = 0;
    
    for (const searchWord of searchWords) {
      for (const resultWord of resultWords) {
        if (resultWord.includes(searchWord) || searchWord.includes(resultWord)) {
          matchCount++;
          totalScore += Math.min(searchWord.length, resultWord.length);
        }
      }
    }
    
    if (matchCount === 0) {
      return 0;
    }
    
    // Calculate percentage of words matched
    const wordMatchPercentage = (matchCount / searchWords.length) * 100;
    
    // Bonus for matching at the beginning
    let positionBonus = 0;
    if (normalizedResult.startsWith(searchWords[0] || '')) {
      positionBonus = 10;
    }
    
    // Bonus for similar length
    const lengthDiff = Math.abs(normalizedResult.length - normalizedSearch.length);
    const lengthBonus = Math.max(0, 20 - lengthDiff);
    
    // Bonus for Japanese-English title matches
    let japaneseBonus = 0;
    if (this.containsJapanese(searchTitle) && !this.containsJapanese(resultTitle)) {
      // Bonus for finding English equivalent of Japanese title
      japaneseBonus = 15;
    }
    
    return Math.min(100, wordMatchPercentage + positionBonus + lengthBonus + japaneseBonus);
  }

  async search(query: string, page: number = 1): Promise<MangaFireSearchResult[]> {
    console.log(`[MangaFire] Searching for: "${query}" (page ${page})`);
    
    // The API uses the query directly in the URL path, not as a parameter
    const data = await this.makeRequest('/search/', encodeURIComponent(query));
    
    console.log(`[MangaFire] Search results count: ${data?.list?.length || 0}`);
    
    // The API returns results in a "list" array
    if (!data || !data.list || !Array.isArray(data.list)) {
      console.error('[MangaFire] Invalid search response format:', data);
      return [];
    }
    
    if (data.list.length > 0) {
      console.log(`[MangaFire] First search result:`, JSON.stringify(data.list[0]).substring(0, 300) + '...');
    }
    
    // Sort results by relevance score
    const scoredResults = data.list.map((result: any) => {
      const score = this.calculateSimilarityScore(query, result.name || '');
      return {
        ...result,
        relevanceScore: score
      };
    }).sort((a: any, b: any) => b.relevanceScore - a.relevanceScore);
    
    // Log the top 3 results with their scores for debugging
    console.log(`[MangaFire] Top 3 results by relevance:`);
    scoredResults.slice(0, 3).forEach((result: any, index: number) => {
      console.log(`[MangaFire] ${index + 1}. "${result.name}" - Score: ${result.relevanceScore}`);
    });
    
    // If we have Japanese characters in the query and the first result has a low score,
    // try some fallback searches
    if (this.containsJapanese(query) && scoredResults.length > 0 && scoredResults[0].relevanceScore < 50) {
      console.log(`[MangaFire] Japanese query detected with low relevance, trying fallback searches...`);
      
      // Try searching for English equivalents
      const fallbackQueries = this.getFallbackQueries(query);
      let bestFallbackResults = scoredResults;
      
      for (const fallbackQuery of fallbackQueries) {
        try {
          console.log(`[MangaFire] Trying fallback search: "${fallbackQuery}"`);
          const fallbackData = await this.makeRequest('/search/', encodeURIComponent(fallbackQuery));
          
          if (fallbackData?.list && Array.isArray(fallbackData.list) && fallbackData.list.length > 0) {
            const fallbackScored = fallbackData.list.map((result: any) => {
              const score = this.calculateSimilarityScore(query, result.name || '');
              return {
                ...result,
                relevanceScore: score
              };
            }).sort((a: any, b: any) => b.relevanceScore - a.relevanceScore);
            
            // If fallback results have better scores, use them
            if (fallbackScored[0].relevanceScore > bestFallbackResults[0].relevanceScore) {
              console.log(`[MangaFire] Fallback search "${fallbackQuery}" produced better results`);
              bestFallbackResults = fallbackScored;
            }
          }
        } catch (error) {
          console.log(`[MangaFire] Fallback search "${fallbackQuery}" failed:`, error);
        }
      }
      
      // Use the best results we found
      if (bestFallbackResults !== scoredResults) {
        console.log(`[MangaFire] Using fallback results instead of original search`);
        return bestFallbackResults.map((result: any) => ({
          id: result.id.replace('/manga/', ''),
          title: result.name || '',
          altTitles: [],
          description: '',
          coverImage: result.imageUrl || '',
          status: '',
          type: result.type || '',
          genres: [],
          authors: [],
          rating: 0,
          views: 0,
          lastUpdated: ''
        }));
      }
    }
    
    return scoredResults.map((result: any) => ({
      id: result.id.replace('/manga/', ''), // Strip "/manga/" prefix for consistency
      title: result.name || '',
      altTitles: [],
      description: '',
      coverImage: result.imageUrl || '',
      status: '',
      type: result.type || '',
      genres: [],
      authors: [],
      rating: 0,
      views: 0,
      lastUpdated: ''
    }));
  }

  // Helper function to detect Japanese characters
  private containsJapanese(text: string): boolean {
    return /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(text);
  }

  // Helper function to get fallback search queries for Japanese titles
  private getFallbackQueries(japaneseQuery: string): string[] {
    const fallbacks: string[] = [];
    
    // Common Japanese to English mappings
    if (japaneseQuery.includes('地雷')) {
      fallbacks.push('landmine');
      fallbacks.push('dangerous');
    }
    if (japaneseQuery.includes('地原')) {
      fallbacks.push('chihara');
    }
    if (japaneseQuery.includes('なんですか')) {
      fallbacks.push('desu ka');
      fallbacks.push('what is');
    }
    
    // Add the full English title if we can construct it
    if (japaneseQuery.includes('地雷') && japaneseQuery.includes('地原')) {
      fallbacks.push('landmine chihara');
      fallbacks.push('dangerous chihara');
      fallbacks.push('jirai chihara');
    }
    
    return fallbacks;
  }

  async getMangaDetails(id: string): Promise<MangaFireSearchResult> {
    console.log(`[MangaFire] Getting manga details for ID: ${id}`);
    
    // Make sure the ID has the correct format
    const mangaId = id.startsWith('/manga/') ? id : `/manga/${id}`;
    
    const data = await this.makeRequest('', mangaId);
    console.log(`[MangaFire] Manga details:`, JSON.stringify(data).substring(0, 300) + '...');
    
    return {
      id: id,
      title: data.name || '',
      altTitles: [],
      description: data.description || '',
      coverImage: data.imageUrl || '',
      status: data.status || '',
      type: 'Manga',
      genres: data.genre?.map((g: any) => g) || [],
      authors: [data.author || ''],
      rating: 0,
      views: 0,
      lastUpdated: ''
    };
  }

  async getChapters(mangaId: string, options?: { offset?: number, limit?: number, includePages?: boolean }): Promise<Chapter[]> {
    console.log(`[MangaFire] Getting chapters for manga ID: ${mangaId}`, options ? `with options: ${JSON.stringify(options)}` : '');
    
    // Apply defaults for pagination
    const offset = options?.offset || 0;
    const limit = options?.limit || 9999; // Default to all chapters if no limit specified
    const includePages = options?.includePages !== false; // Default to true if not specified
    
    // Make sure the ID has the correct format
    const formattedId = mangaId.startsWith('/manga/') ? mangaId : `/manga/${mangaId}`;
    
    // Get basic manga data
    const data = await this.makeRequest('', formattedId);
    console.log(`[MangaFire] Received data for ${mangaId}`);
    
    if (!data || !data.chapters || !Array.isArray(data.chapters)) {
      console.error('[MangaFire] Invalid chapters response format:', data);
      return [];
    }
    
    // Apply pagination
    const totalChapters = data.chapters.length;
    console.log(`[MangaFire] Total chapters: ${totalChapters}, applying pagination (offset: ${offset}, limit: ${limit})`);
    
    // Extract the requested chapters slice
    const paginatedChapters = data.chapters.slice(offset, offset + limit);
    console.log(`[MangaFire] Returning ${paginatedChapters.length} chapters (${offset} to ${offset + paginatedChapters.length - 1})`);
    
    // Helpers to normalize chapter number and title
    const extractChapterNumber = (name: string | undefined, fallbackIndex: number): string => {
      if (!name) return `${fallbackIndex + 1}`;
      const match = name.match(/(\d+(?:\.\d+)?)/);
      if (match) return match[1];
      return `${fallbackIndex + 1}`;
    };

    const cleanTitle = (name: string | undefined, numberText: string): string => {
      if (!name) return `Chapter ${numberText}`;
      const stripped = name
        .replace(/^\s*(chap(ter)?\s*)/i, '')
        .replace(/^[:\-\s]+/, '')
        .replace(/[:\-\s]+$/, '')
        .trim();
      if (stripped === '' || stripped === numberText || /^\d+(?:\.\d+)?$/.test(stripped)) {
        return `Chapter ${numberText}`;
      }
      return stripped;
    };

    // Map to the expected format
    return paginatedChapters.map((chapter: any, index: number) => {
      const chapterNumber = extractChapterNumber(chapter.name, index);
      const title = cleanTitle(chapter.name, chapterNumber);

      return {
        id: chapter.id || '',
        number: chapterNumber,
        title,
        url: chapter.id || '',
        updatedAt: chapter.dateUpload || '',
        scanlationGroup: chapter.scanlator || 'Unknown',
        scanlator: chapter.scanlator || '',
        pages: 0, // Will be filled later if needed
        volume: chapter.scanlator?.match(/Vol\s*(\d+)/i) ?
          chapter.scanlator.match(/Vol\s*(\d+)/i)[1] : '',
        translatedLanguage: 'en',
        source: 'mangafire',
        // Only set isLatest for the first chapter if this is the first page of results
        isLatest: offset === 0 && index === 0
      };
    });
  }

  async getChapterPages(chapterId: string): Promise<MangaFireChapterResponse> {
    console.log(`[MangaFire] Getting pages for chapter ID: ${chapterId}`);
    
    // Extract just the numeric chapter ID if it contains a manga path
    let cleanChapterId = chapterId;
    if (cleanChapterId.includes('/')) {
      cleanChapterId = cleanChapterId.split('/').pop() || cleanChapterId;
    }
    
    console.log(`[MangaFire] Using clean chapter ID: ${cleanChapterId}`);
    
    // Use the correct page endpoint
    const data = await this.makeRequest('/manga/page?id=', cleanChapterId);
    console.log(`[MangaFire] Chapter pages data:`, JSON.stringify(data).substring(0, 300) + '...');
    
    // Check if response is in the expected format
    if (!data) {
      console.error('[MangaFire] Invalid chapter pages response format:', data);
      return { pages: [], isLatestChapter: false };
    }
    
    // Check if the response has the new format with isLatestChapter flag
    const isLatestChapter = 
      data.isLatestChapter === true || 
      (typeof data.note === 'string' && data.note.includes("latest chapter"));
    
    console.log(`[MangaFire] Is latest chapter: ${isLatestChapter}`);
    
    // Handle both formats: array of pages directly or object with pages property
    let pages;
    if (Array.isArray(data)) {
      // Old format: direct array of pages
      pages = data;
    } else if (data.pages && Array.isArray(data.pages)) {
      // New format: object with pages array
      pages = data.pages;
    } else {
      // Fallback to empty array if neither format matches
      pages = [];
    }
    
    console.log(`[MangaFire] Pages count: ${pages.length || 0}`);
    if (pages.length > 0) {
      console.log(`[MangaFire] First page:`, JSON.stringify(pages[0]).substring(0, 300) + '...');
    }
    
    return {
      pages: pages.map((page: any, index: number) => {
        const pageHeaders = page.headers || { 'Referer': 'https://mangafire.to' };
        console.log(`[MangaFire] Page ${index + 1} headers:`, pageHeaders);
        
        return {
          url: page.url || '',
          number: index + 1,
          headers: pageHeaders
        };
      }),
      isLatestChapter: isLatestChapter
    };
  }

  async advancedSearch(params: {
    type?: string;
    status?: string;
    genres?: string[];
    excludedGenres?: string[];
    sort?: string;
    page?: number;
  }): Promise<MangaFireSearchResult[]> {
    console.log(`[MangaFire] Advanced search with params:`, params);
    
    // Advanced search isn't supported in this API, so we'll just do a regular search
    const searchTerm = params.type || 'manga';
    const data = await this.makeRequest('/search/', encodeURIComponent(searchTerm));
    
    if (!data || !data.list || !Array.isArray(data.list)) {
      console.error('[MangaFire] Invalid advanced search response format:', data);
      return [];
    }
    
    console.log(`[MangaFire] Advanced search results count: ${data.list.length || 0}`);
    
    return data.list.map((result: any) => ({
      id: result.id.replace('/manga/', ''), // Strip "/manga/" prefix for consistency
      title: result.name || '',
      altTitles: [],
      description: '',
      coverImage: result.imageUrl || '',
      status: '',
      type: result.type || '',
      genres: [],
      authors: [],
      rating: 0,
      views: 0,
      lastUpdated: ''
    }));
  }
}

export default new MangaFireProvider(); 