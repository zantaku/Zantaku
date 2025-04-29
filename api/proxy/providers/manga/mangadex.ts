// mangadex.ts
import { CONSUMET_API_URL } from '../../../../app/constants/api';
import axios from 'axios';

// MangaDex Manga Provider
export const MANGADEX_API_URL = `${CONSUMET_API_URL}/manga`;

export interface MangaDexChapter {
  id: string;
  number: string;
  title: string;
  url: string;
  isAnimeAdapted?: boolean;
  adaptationInfo?: string;
  volume?: string;
  chapter?: string;
  pages?: number;
  translatedLanguage?: string;
  updatedAt?: string;
  scanlationGroup?: string;
  thumbnail?: string;
  isLatest?: boolean;
  source: string;
}

export interface MangaDexSearchResult {
  id: string;
  title: string;
  source: string;
  coverImage?: string;
  status?: string;
  genres?: string[];
  summary?: string;
  chapterCount?: number;
  lastUpdated?: string;
}

export class MangaDexProvider {
  static readonly BASE_URL = MANGADEX_API_URL;
  
  static getHeaders() {
    return {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    };
  }

  static getImageHeaders() {
    return {
      'Referer': 'https://takiapi.xyz/',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    };
  }

  static getSearchUrl(query: string): string {
    // Special case handling for titles that need specific formatting
    let formattedQuery = query;
    
    // Handle "Jirai Nan Desu ka? Chihara-san" and similar titles
    if (query.includes('Jirai Nan Desu ka?')) {
      formattedQuery = query.replace('Jirai Nan Desu ka?', 'Jirai Nandesuka');
      console.log('[MangaDex] Applied special formatting for Jirai title');
    }
    
    // General cleanup: remove question marks and excess spaces for better results
    formattedQuery = formattedQuery
      .replace(/\?/g, '') // Remove question marks
      .replace(/\s+/g, ' ') // Replace multiple spaces with a single space
      .trim();
      
    const apiURL = `${CONSUMET_API_URL}/manga/mangadex/${encodeURIComponent(formattedQuery)}`;
    console.log('[MangaDex] Search URL:', apiURL);
    console.log('[MangaDex] Original query:', query);
    console.log('[MangaDex] Formatted query:', formattedQuery);
    return apiURL;
  }

  static getSeriesInfoUrl(id: string, offset: number = 0, limit: number = 100, language: string = 'en'): string {
    // Log the API URL for debugging
    const apiURL = `${CONSUMET_API_URL}/manga/mangadex/info/${id}?lang=${language}`;
    console.log('[MangaDex] Series info URL:', apiURL);
    return apiURL;
  }

  static getChapterUrl(chapterId: string, language: string = 'en'): string {
    const apiURL = `${CONSUMET_API_URL}/manga/mangadex/read/${chapterId}`;
    console.log('[MangaDex] Chapter URL:', apiURL);
    return apiURL;
  }

  static async fetchInfo(id: string, language: string = 'en'): Promise<any> {
    try {
      const url = this.getSeriesInfoUrl(id, 0, 100, language);
      console.log('[MangaDex] Fetching info from:', url);
      
      const response = await axios.get(url, {
        headers: this.getHeaders(),
        timeout: 10000 // 10 second timeout
      });
      
      if (response.status === 200 && response.data) {
        console.log('[MangaDex] Successfully fetched info');
        return {
          success: true,
          data: response.data
        };
      }
      
      throw new Error(`Invalid response from MangaDex API: ${response.status}`);
    } catch (error: any) {
      console.error('[MangaDex] Error fetching info:', error.message);
      return {
        success: false,
        data: {
          error: 'Failed to fetch from MangaDex',
          errorMessage: error.message,
          errorTrace: error.stack
        }
      };
    }
  }

  static parseChapterPagesResponse(responseData: any): string[] {
    let images: string[] = [];
    
    console.log('[MangaDex] Parsing chapter pages response');
    
    // Check if the response is an array of objects with img property
    if (responseData && Array.isArray(responseData) && responseData.length > 0) {
      // Get all valid image URLs
      images = responseData.map((item: any) => {
        if (typeof item === 'string') return item;
        return item.img || item.url || item;
      }).filter(Boolean);
    }
    
    // Check for other formats
    if (responseData?.images && Array.isArray(responseData.images)) {
      images = responseData.images.map((img: any) => 
        typeof img === 'string' ? img : img.url || img
      ).filter(Boolean);
    }
    
    if (responseData?.result?.images && Array.isArray(responseData.result.images)) {
      images = responseData.result.images.map((img: any) => 
        typeof img === 'string' ? img : img.url || img
      ).filter(Boolean);
    }
    
    console.log(`[MangaDex] Extracted ${images.length} images from response`);
    return images;
  }

  static formatChaptersFromResponse(responseData: any, source: string = 'mangadex'): MangaDexChapter[] {
    let chapters: MangaDexChapter[] = [];
    
    console.log('[MangaDex] Response type:', typeof responseData);
    
    if (!responseData) {
      console.log('[MangaDex] No data provided to formatChaptersFromResponse');
      return [];
    }
    
    console.log('[MangaDex] Response structure:', 
      JSON.stringify({
        keys: responseData ? Object.keys(responseData) : [],
        hasId: !!responseData?.id,
        hasTitle: !!responseData?.title,
        hasChapters: Array.isArray(responseData?.chapters),
        chaptersLength: Array.isArray(responseData?.chapters) ? responseData.chapters.length : 0,
        isArray: Array.isArray(responseData)
      })
    );
    
    try {
      // Handle Consumet API response format (matches your JSON)
      if (responseData?.id && responseData?.title && Array.isArray(responseData?.chapters)) {
        console.log('[MangaDex] Detected Consumet API format with', responseData.chapters.length, 'chapters');
        chapters = responseData.chapters.map((ch: any, index: number) => ({
          id: ch.id || '',
          number: ch.chapterNumber || ch.number || '',
          title: ch.title || `Chapter ${ch.chapterNumber || ch.number || ''}`,
          url: ch.id || '',
          volume: ch.volumeNumber || ch.volume || '',
          pages: ch.pages || 0,
          translatedLanguage: ch.translatedLanguage || ch.lang || 'en',
          updatedAt: ch.releaseDate || ch.updatedAt || '',
          thumbnail: responseData.image || ch.thumbnail || '',
          isLatest: index === 0,
          source: 'mangadex'
        }));
      }
      // Standard format with chapters inside a chapters property
      else if (responseData?.chapters && Array.isArray(responseData.chapters)) {
        console.log('[MangaDex] Found standard chapters array with', responseData.chapters.length, 'chapters');
        chapters = responseData.chapters.map((ch: any, index: number) => ({
          id: ch.id || '',
          number: ch.number || ch.chapterNumber || '',
          title: ch.title || `Chapter ${ch.number || ch.chapterNumber || ''}`,
          url: ch.id || '',
          volume: ch.volume || ch.volumeNumber || '',
          pages: ch.pages || 0,
          translatedLanguage: ch.lang || ch.translatedLanguage || 'en',
          updatedAt: ch.updatedAt || '',
          thumbnail: ch.thumbnail || responseData.image || responseData.coverImage || '',
          isLatest: index === 0,
          source: 'mangadex'
        }));
      }
      // Response is itself an array of chapters
      else if (Array.isArray(responseData)) {
        console.log('[MangaDex] Response is an array with', responseData.length, 'items');
        chapters = responseData.map((ch: any, index: number) => ({
          id: ch.id || '',
          number: ch.number || ch.chapterNumber || '',
          title: ch.title || `Chapter ${ch.number || ch.chapterNumber || ''}`,
          url: ch.id || '',
          volume: ch.volume || ch.volumeNumber || '',
          pages: ch.pages || 0,
          translatedLanguage: ch.lang || ch.translatedLanguage || 'en',
          updatedAt: ch.updatedAt || '',
          thumbnail: ch.thumbnail || '',
          isLatest: index === 0,
          source: 'mangadex'
        }));
      }
      
      console.log('[MangaDex] Parsed', chapters.length, 'chapters successfully');
    } catch (error: any) {
      console.error('[MangaDex] Error parsing chapters:', error.message);
    }
    
    return chapters;
  }

  static formatSearchResults(responseData: any, source: string = 'mangadex'): MangaDexSearchResult[] {
    let results: MangaDexSearchResult[] = [];
    
    if (!responseData) {
      console.log('[MangaDex] No data provided to formatSearchResults');
      return [];
    }
    
    console.log('[MangaDex] Formatting search results, data structure:', 
      JSON.stringify({
        hasResults: !!responseData?.results,
        resultsLength: responseData?.results?.length || 0
      })
    );
    
    if (responseData?.results && Array.isArray(responseData.results)) {
      results = responseData.results.map((result: any) => ({
        ...result,
        source: 'mangadex'
      }));
      console.log(`[MangaDex] Formatted ${results.length} search results`);
    }
    
    return results;
  }
}
