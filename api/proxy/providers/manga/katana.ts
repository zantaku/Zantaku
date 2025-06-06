// katana.ts

// Katana Manga Provider
import { CONSUMET_API_URL, KATANA_API_URLS } from '../../../../app/constants/api';
import axios from 'axios';
import { MangaDexProvider, MANGADEX_API_URL } from './mangadx';

export const KATANA_API_URL = KATANA_API_URLS.PRIMARY;
export const KATANA_FALLBACK_URL = KATANA_API_URLS.FALLBACK;

export interface KatanaChapter {
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
  katanaUrl?: string;
}

export interface KatanaSearchResult {
  title: string;
  slugId: string;
  id: string;
  source: string;
  coverImage?: string;
  status?: string;
  genres?: string[];
  summary?: string;
  chapterCount?: number;
  lastUpdated?: string;
  latestChapters?: any[];
}

export class KatanaProvider {
  static readonly BASE_URL = KATANA_API_URL;
  
  static getHeaders() {
    return {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    };
  }

  static getImageHeaders() {
    return {
      'Referer': 'https://readmanganato.com/',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    };
  }

  static getSearchUrl(query: string): string {
    return `${this.BASE_URL}/katana/search?search=${encodeURIComponent(query)}&use_google=true`;
  }

  static getSeriesUrl(slugId: string): string {
    return `${this.BASE_URL}/katana/series/${slugId}`;
  }

  static getChapterUrl(slugId: string, chapterId: string): string {
    return `${this.BASE_URL}/katana/series/${slugId}/${chapterId}`;
  }

  static async fetchWithFallback(url: string, fallbackTitle: string, isMangaSearch = false, isChapterFetch = false, chapterId = ''): Promise<any> {
    try {
      console.log('[KatanaProvider] Attempting to fetch from Katana API:', url);
      const response = await axios.get(url, { 
        headers: this.getHeaders(),
        timeout: 8000 // Increase timeout to 8 seconds before falling back
      });
      
      if (response.status === 200 && response.data) {
        console.log('[KatanaProvider] Successfully fetched from Katana API');
        
        // Check if the response has a success property, if not, add it
        if (typeof response.data.success === 'undefined') {
          return {
            success: true,
            data: response.data
          };
        }
        
        return response.data;
      }
      throw new Error('Invalid response from Katana API');
    } catch (error: any) {
      console.log('[KatanaProvider] Katana API failed, trying fallback:', error.message);
      
      // Try using the FALLBACK_URL if the main URL failed
      try {
        const fallbackUrl = url.replace(this.BASE_URL, KATANA_FALLBACK_URL);
        console.log('[KatanaProvider] Trying Katana fallback URL:', fallbackUrl);
        
        const fallbackResponse = await axios.get(fallbackUrl, {
          headers: this.getHeaders(),
          timeout: 8000
        });
        
        if (fallbackResponse.status === 200 && fallbackResponse.data) {
          console.log('[KatanaProvider] Successfully fetched from Katana fallback URL');
          
          // Ensure the response has the success property
          if (typeof fallbackResponse.data.success === 'undefined') {
            return {
              success: true,
              data: fallbackResponse.data
            };
          }
          
          return fallbackResponse.data;
        }
      } catch (fallbackError: any) {
        console.log('[KatanaProvider] Katana fallback URL also failed:', fallbackError.message);
      }
      
      // Now try MangaDex as the last resort
      if (isMangaSearch) {
        try {
          // Fall back to MangaDex search
          const mangadexUrl = MangaDexProvider.getSearchUrl(fallbackTitle);
          console.log('[KatanaProvider] Falling back to MangaDex search:', mangadexUrl);
          
          const response = await axios.get(mangadexUrl, { headers: MangaDexProvider.getHeaders() });
          
          if (response.status === 200 && response.data) {
            // Mark the response as coming from the fallback
            return {
              success: true,
              data: {
                results: response.data.results || [],
                fromFallback: true,
                source: 'mangadex'
              }
            };
          }
        } catch (mdSearchError: any) {
          console.error('[KatanaProvider] MangaDex search fallback failed:', mdSearchError.message);
        }
      } else if (isChapterFetch && chapterId) {
        try {
          // Fall back to MangaDex chapter fetch
          const mangadexUrl = `${MANGADEX_API_URL}/mangadex/info/${chapterId}?lang=en`;
          console.log('[KatanaProvider] Falling back to MangaDex info:', mangadexUrl);
          
          const response = await axios.get(mangadexUrl, { headers: MangaDexProvider.getHeaders() });
          
          if (response.status === 200 && response.data) {
            console.log('[KatanaProvider] Successfully fetched from MangaDex fallback');
            // Transform MangaDex response to match Katana format
            return {
              success: true,
              data: {
                ...response.data,
                fromFallback: true,
                source: 'mangadex'
              }
            };
          }
        } catch (mdFetchError: any) {
          console.error('[KatanaProvider] MangaDex chapters fallback failed:', mdFetchError.message);
        }
      }
      
      // Return error data structure if all providers fail
      return {
        success: false,
        data: { 
          fromFallback: true, 
          error: 'All providers failed',
          errorMessage: error.message,
          errorTrace: error.stack
        }
      };
    }
  }

  static parseChapterResponse(responseData: any): string[] {
    let images: string[] = [];
    
    console.log('[KatanaProvider] Parsing chapter response:', 
      JSON.stringify({
        success: responseData.success,
        hasData: !!responseData.data,
        hasImageUrls: !!responseData.imageUrls,
        imageUrlsLength: responseData.imageUrls?.length || responseData.data?.imageUrls?.length,
        imagesLength: responseData.images?.length || responseData.data?.images?.length,
        responseType: typeof responseData
      })
    );
    
    // Check for imageUrls directly in the responseData (new API format)
    if (Array.isArray(responseData.imageUrls) && responseData.imageUrls.length > 0) {
      console.log('[KatanaProvider] Found imageUrls directly in response root');
      images = responseData.imageUrls.map((img: any) => {
        if (img && typeof img === 'object' && img.url) {
          return img.url;
        }
        return typeof img === 'string' ? img : '';
      }).filter((url: string) => url);
    }
    // Check for images directly in the responseData
    else if (Array.isArray(responseData.images) && responseData.images.length > 0) {
      console.log('[KatanaProvider] Found images directly in response root');
      images = responseData.images.map((img: any) => 
        typeof img === 'string' ? img : (img?.url || '')
      ).filter((url: string) => url);
    }
    // Then check in responseData.data as before
    else if (responseData.data) {
      // Check for imageUrls in responseData.data
      if (Array.isArray(responseData.data.imageUrls) && responseData.data.imageUrls.length > 0) {
        console.log('[KatanaProvider] Found imageUrls in response.data');
        images = responseData.data.imageUrls.map((img: any) => {
          if (img && typeof img === 'object' && img.url) {
            return img.url;
          }
          return typeof img === 'string' ? img : '';
        }).filter((url: string) => url);
      }
      // Check for images in responseData.data
      else if (Array.isArray(responseData.data.images) && responseData.data.images.length > 0) {
        console.log('[KatanaProvider] Found images in response.data');
        images = responseData.data.images.map((img: any) => 
          typeof img === 'string' ? img : (img?.url || '')
        ).filter((url: string) => url);
      }
      // Try other possible fields
      else if (Array.isArray(responseData.data.data?.images)) {
        console.log('[KatanaProvider] Found images in response.data.data');
        images = responseData.data.data.images
          .map((img: any) => typeof img === 'string' ? img : (img?.url || ''))
          .filter((url: string) => url);
      }
      else if (Array.isArray(responseData.data.pages)) {
        console.log('[KatanaProvider] Found pages in response.data');
        images = responseData.data.pages
          .map((page: any) => page?.url || page?.image || '')
          .filter((url: string) => url);
      }
    }
    
    console.log(`[KatanaProvider] Extracted ${images.length} images`);
    if (images.length > 0) {
      console.log('[KatanaProvider] First image:', images[0]);
      console.log('[KatanaProvider] Last image:', images[images.length - 1]);
    } else {
      console.log('[KatanaProvider] Raw response keys:', Object.keys(responseData));
      console.log('[KatanaProvider] Raw response partial data:', JSON.stringify(responseData).substring(0, 500));
    }
    
    return images;
  }

  static isLatestChapter(responseData: any): boolean {
    return !responseData.data?.nextChapter || responseData.data.nextChapter === "javascript:;";
  }

  static formatChaptersFromResponse(data: any, source: string = 'katana'): KatanaChapter[] {
    let chapters: KatanaChapter[] = [];
    let mangaData: { 
      coverImage?: string; 
      lastUpdated?: string;
      slug?: string;
      slugId?: string;
      fromFallback?: boolean;
    } | null = null;
    
    if (!data) {
      console.log('[KatanaProvider] No data provided to formatChaptersFromResponse');
      return [];
    }
    
    console.log('[KatanaProvider] Formatting chapters from response, data structure:', 
      JSON.stringify({
        hasSuccess: 'success' in data,
        success: data.success,
        hasData: !!data.data,
        dataKeys: data.data ? Object.keys(data.data) : [],
        fromFallback: data.data?.fromFallback
      })
    );
    
    if (data && data.success && data.data) {
      mangaData = data.data;
      
      let chaptersList = [];
      if (data.data.chapters && Array.isArray(data.data.chapters)) {
        console.log('[KatanaProvider] Found chapters array with', data.data.chapters.length, 'chapters');
        chaptersList = data.data.chapters;
      } else if (data.data.latestChapters && Array.isArray(data.data.latestChapters)) {
        console.log('[KatanaProvider] Found latestChapters array with', data.data.latestChapters.length, 'chapters');
        chaptersList = data.data.latestChapters;
      } else if (data.data.fromFallback && data.data.chapters && Array.isArray(data.data.chapters)) {
        console.log('[KatanaProvider] Found chapters from fallback with', data.data.chapters.length, 'chapters');
        chaptersList = data.data.chapters;
      }
      
      // If response came from fallback, use proper source
      source = data.data.fromFallback ? data.data.source || 'mangadex' : source;
      
      chapters = chaptersList.map((ch: any, index: number) => {
        const number = ch.number || ch.chapterNumber || ch.url?.match(/c(\d+(\.\d+)?)$/)?.[1] || '';
        const fullUrl = ch.url || ch.id || '';
        const slugId = mangaData?.slugId || '';
        const chapterUrl = fullUrl.includes(slugId) 
          ? fullUrl 
          : `${slugId}/${fullUrl}`;
        
        return {
          id: ch.id || chapterUrl,
          number: number,
          title: ch.title || `Chapter ${number}`,
          url: chapterUrl,
          updatedAt: ch.updated || ch.updatedAt || ch.releaseDate || mangaData?.lastUpdated || new Date().toISOString(),
          thumbnail: ch.thumbnail || mangaData?.coverImage || '',
          isLatest: index === 0,
          source: source,
          translatedLanguage: ch.translatedLanguage || ch.lang || 'en',
          volume: ch.volume || ch.volumeNumber || '',
          pages: ch.pages || 0
        };
      });
      
      console.log(`[KatanaProvider] Formatted ${chapters.length} chapters successfully`);
    } else if (data && !data.success) {
      console.log('[KatanaProvider] Response indicated failure:', data.data?.errorMessage || 'Unknown error');
    }
    
    return chapters;
  }
}
