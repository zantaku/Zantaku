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
    
    // Map to the expected format
    return paginatedChapters.map((chapter: any, index: number) => {
      const chapterNumber = chapter.name?.replace('Chap ', '')?.trim() || `${index + 1}`;
      
      return {
        id: chapter.id || '',
        number: chapterNumber,
        title: chapter.name || `Chapter ${chapterNumber}`,
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