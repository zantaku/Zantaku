import axios from 'axios';
import { Chapter } from './index';

const KATANA_BASE_URL = 'https://akane-api-main-copy.vercel.app';

interface KatanaSearchResult {
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

// interface KatanaChapter {
//   id: string;
//   number: string;
//   title: string;
//   url: string;
//   updatedAt: string;
//   scanlationGroup: string;
//   pages: number;
// }

interface KatanaPage {
  url: string;
  number: number;
  headers?: any;
}

interface KatanaChapterResponse {
  pages: KatanaPage[];
  isLatestChapter: boolean;
}

export class KatanaProvider {
  private sanitizeChapterId(chapterId: string): string {
    if (!chapterId) return '';
    let id = String(chapterId).trim();
    // Strip domain and leading path prefixes if present
    id = id.replace(/^https?:\/\/[^/]+\/(manga|series)\//i, '');
    id = id.replace(/^\/?(manga|series)\//i, '');
    if (id.startsWith('/')) id = id.slice(1);
    return id;
  }
  private async makeRequest(endpoint: string, query: string = '') {
    try {
      const url = `${KATANA_BASE_URL}${endpoint}${query}`;
      
      const response = await axios.get(url, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Kamilist/1.0'
        }
      });
      
      return response.data;
    } catch (error) {
      console.error(`Katana API Error (${endpoint}${query}):`, error);
      
      if (axios.isAxiosError(error) && error.response) {
        console.error(`[Katana] Response status: ${error.response.status}`);
        console.error(`[Katana] Response data:`, error.response.data);
      }
      
      throw error;
    }
  }

  // Helper function to normalize titles for better matching
  private normalizeTitle(title: string): string {
    return title
      .replace(/[★☆]/g, '') // Remove star symbols
      .replace(/[♪♫]/g, '') // Remove music symbols
      .replace(/[♥♡]/g, '') // Remove heart symbols
      .replace(/[◆◇]/g, '') // Remove diamond symbols
      .replace(/[▲△]/g, '') // Remove triangle symbols
      .replace(/[●○]/g, '') // Remove circle symbols
      .replace(/[■□]/g, '') // Remove square symbols
      .replace(/[※]/g, '') // Remove reference symbols
      .replace(/[！]/g, '!') // Normalize exclamation marks
      .replace(/[？]/g, '?') // Normalize question marks
      .replace(/[：]/g, ':') // Normalize colons
      .replace(/[；]/g, ';') // Normalize semicolons
      .replace(/[，]/g, ',') // Normalize commas
      .replace(/[。]/g, '.') // Normalize periods
      .replace(/[（]/g, '(') // Normalize parentheses
      .replace(/[）]/g, ')') // Normalize parentheses
      .replace(/[【]/g, '[') // Normalize brackets
      .replace(/[】]/g, ']') // Normalize brackets
      .replace(/[「]/g, '"') // Normalize quotes
      .replace(/[」]/g, '"') // Normalize quotes
      .replace(/[『]/g, "'") // Normalize quotes
      .replace(/[』]/g, "'") // Normalize quotes
      .toLowerCase()
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
    
    for (const searchWord of searchWords) {
      for (const resultWord of resultWords) {
        if (resultWord.includes(searchWord) || searchWord.includes(resultWord)) {
          matchCount++;
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

  async search(query: string, page: number = 1): Promise<KatanaSearchResult[]> {
    // Use the search endpoint with query parameters
    const data = await this.makeRequest('/katana/search', `?search=${encodeURIComponent(query)}&search_by=book_name`);
    
    // The API returns results in a nested format: { success: true, data: { results: [...] } }
    if (!data || !data.success || !data.data || !Array.isArray(data.data.results)) {
      console.error('[Katana] Invalid search response format:', data);
      return [];
    }
    
    const results = data.data.results;
    
    // Sort results by relevance score
    const scoredResults = results.map((result: any) => {
      const score = this.calculateSimilarityScore(query, result.title || '');
      return {
        ...result,
        relevanceScore: score
      };
    }).sort((a: any, b: any) => b.relevanceScore - a.relevanceScore);
    
    return scoredResults.map((result: any) => ({
      id: result.slugId || result.id || '',
      title: result.title || '',
      altTitles: result.altTitles || [],
      description: result.summary || result.description || '',
      coverImage: result.coverImage || result.cover || '',
      status: result.status || '',
      type: result.type || 'Manga',
      genres: result.genreNames || result.genres || [],
      authors: result.authors || [],
      rating: result.rating || 0,
      views: result.views || 0,
      lastUpdated: result.lastUpdated || ''
    }));
  }

  // Helper function to detect Japanese characters
  private containsJapanese(text: string): boolean {
    return /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(text);
  }

  async getMangaDetails(id: string): Promise<KatanaSearchResult> {
    const data = await this.makeRequest(`/katana/series/${id}`, '');
    
    // Handle the response format - it might be wrapped in success/data structure
    const mangaData = data.success && data.data ? data.data : data;
    
    return {
      id: id,
      title: mangaData.title || '',
      altTitles: mangaData.altTitles || [],
      description: mangaData.summary || mangaData.description || '',
      coverImage: mangaData.coverImage || mangaData.cover || '',
      status: mangaData.status || '',
      type: 'Manga',
      genres: mangaData.genreNames || mangaData.genres || [],
      authors: mangaData.authors || [],
      rating: mangaData.rating || 0,
      views: mangaData.views || 0,
      lastUpdated: mangaData.lastUpdated || ''
    };
  }

  async getChapters(mangaId: string, options?: { offset?: number, limit?: number, includePages?: boolean }): Promise<Chapter[]> {
    // Apply defaults for pagination
    const offset = options?.offset || 0;
    const limit = options?.limit || 9999; // Default to all chapters if no limit specified
    // const includePages = options?.includePages !== false; // Default to true if not specified
    
    // Get manga details which should include chapters
    const data = await this.makeRequest(`/katana/series/${mangaId}`, '');
    
    // Handle the response format - it might be wrapped in success/data structure
    const mangaData = data.success && data.data ? data.data : data;
    
    if (!mangaData || !mangaData.chapters || !Array.isArray(mangaData.chapters)) {
      console.error('[Katana] Invalid chapters response format:', mangaData);
      return [];
    }
    
    // Apply pagination
    // Extract the requested chapters slice
    const paginatedChapters = mangaData.chapters.slice(offset, offset + limit);
    
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
      const rawUrl: string = chapter.url || chapter.href || chapter.id || '';
      const sanitizedId = this.sanitizeChapterId(rawUrl) || `${mangaId}/c${index + 1}`;
      const chapterNumber = String(chapter.number || extractChapterNumber(chapter.title, index) || sanitizedId.match(/c(\d+(?:\.\d+)?)/)?.[1] || index + 1);
      const title = cleanTitle(chapter.title, chapterNumber);

      return {
        id: sanitizedId,
        number: chapterNumber,
        title,
        url: sanitizedId,
        updatedAt: chapter.updated || chapter.updatedAt || chapter.dateUpload || '',
        scanlationGroup: chapter.scanlator || 'Unknown',
        scanlator: chapter.scanlator || '',
        pages: 0, // Will be filled later if needed
        volume: chapter.volume || '',
        translatedLanguage: 'en',
        source: 'katana',
        // Only set isLatest for the first chapter if this is the first page of results
        isLatest: offset === 0 && index === 0
      };
    });
  }

  async getChapterPages(chapterId: string): Promise<KatanaChapterResponse> {
    if (!chapterId) {
      console.error('[Katana] Empty chapterId passed to getChapterPages');
      return { pages: [], isLatestChapter: false };
    }

    // The chapter ID should be in format: manga-slug.chapter-id
    // We need to extract the manga slug and chapter from the chapterId
    const sanitizedId = this.sanitizeChapterId(chapterId);
    const data = await this.makeRequest(`/katana/series/${sanitizedId}`, '');
    
    // Handle the response format - it might be wrapped in success/data structure
    const responseData = data.success && data.data ? data.data : data;
    
    // Check if response is in the expected format
    if (!responseData) {
      console.error('[Katana] Invalid chapter pages response format:', responseData);
      return { pages: [], isLatestChapter: false };
    }
    
    // Check if the response has the isLatestChapter flag
    const isLatestChapter = responseData.isLatestChapter === true;
    
    // Handle the actual API response format: data.imageUrls
    let pages;
    if (responseData.imageUrls && Array.isArray(responseData.imageUrls)) {
      // Katana API returns imageUrls array
      pages = responseData.imageUrls;
    } else if (Array.isArray(responseData)) {
      // Direct array of pages
      pages = responseData;
    } else if (responseData.pages && Array.isArray(responseData.pages)) {
      // Object with pages array (fallback)
      pages = responseData.pages;
    } else {
      // Fallback to empty array if neither format matches
      pages = [];
    }
    
    return {
      pages: pages.map((page: any, index: number) => {
        const pageHeaders = page.headers || { 'Referer': 'https://mangakatana.com' };
        
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
  }): Promise<KatanaSearchResult[]> {
    // For now, we'll use the regular search endpoint
    // In the future, we could implement genre-based filtering
    const searchTerm = params.type || 'manga';
    const data = await this.makeRequest('/katana/search', `?search=${encodeURIComponent(searchTerm)}&search_by=book_name`);
    
    if (!data || !data.success || !data.data || !Array.isArray(data.data.results)) {
      console.error('[Katana] Invalid advanced search response format:', data);
      return [];
    }
    
    const results = data.data.results;
    
    return results.map((result: any) => ({
      id: result.slugId || result.id || '',
      title: result.title || '',
      altTitles: result.altTitles || [],
      description: result.summary || result.description || '',
      coverImage: result.coverImage || result.cover || '',
      status: result.status || '',
      type: result.type || 'Manga',
      genres: result.genreNames || result.genres || [],
      authors: result.authors || [],
      rating: result.rating || 0,
      views: result.views || 0,
      lastUpdated: result.lastUpdated || ''
    }));
  }
}

export default new KatanaProvider();