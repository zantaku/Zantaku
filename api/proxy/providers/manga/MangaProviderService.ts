import { Chapter, Provider } from './index';
import { MangaDexProvider } from './mangadx';
import MangaFireProvider from './mangafire';
import axios from 'axios';

export interface SearchResult {
  id: string;
  title: string;
  source: Provider;
  coverImage?: string;
  status?: string;
  genres?: string[];
  summary?: string;
  chapterCount?: number;
  lastUpdated?: string;
}

export interface ProviderPreferences {
  defaultProvider: Provider;
  autoSelectSource: boolean;
  preferredChapterLanguage: string;
}

export interface PageWithHeaders {
  url: string;
  headers?: Record<string, string>;
}

export class MangaProviderService {
  private static logDebug = (message: string, data?: any) => 
    console.log(`[MangaProviderService DEBUG] ${message}`, data || '');
  
  private static logError = (message: string, error?: any) => 
    console.error(`[MangaProviderService ERROR] ${message}`, error || '');

  /**
   * Search for manga across providers with auto-fallback support
   */
  static async searchManga(
    title: string, 
    preferences: ProviderPreferences
  ): Promise<{ results: SearchResult[]; provider: Provider }> {
    const { defaultProvider, autoSelectSource } = preferences;
    
    // Determine which providers to try
    const providersToTry: Provider[] = autoSelectSource 
      ? ['mangafire', 'mangadex'] // Try best sources first when auto-select is ON
      : [defaultProvider]; // Only try the selected provider when auto-select is OFF

    this.logDebug(`Auto-select is ${autoSelectSource ? 'ON' : 'OFF'}`);
    this.logDebug(`Will try providers in order:`, providersToTry);

    let lastError: any = null;

    for (const provider of providersToTry) {
      try {
        this.logDebug(`Trying provider: ${provider} for "${title}"`);
        
        let results: SearchResult[] = [];

        switch (provider) {
          case 'mangafire':
            const mangafireResults = await MangaFireProvider.search(title);
            results = mangafireResults.map(r => ({
              id: r.id,
              title: r.title,
              source: 'mangafire' as Provider,
              coverImage: r.coverImage,
              status: r.status,
              genres: r.genres,
              summary: r.description,
              lastUpdated: r.lastUpdated
            }));
            break;

          case 'mangadex':
            const mangadxUrl = MangaDexProvider.getSearchUrl(title);
            const mangadxResponse = await axios.get(mangadxUrl, {
              headers: MangaDexProvider.getHeaders()
            });
            const mangadxData = mangadxResponse.data;
            
            if (mangadxData?.results) {
              results = mangadxData.results.map((r: any) => ({
                id: r.id,
                title: r.title,
                source: 'mangadex' as Provider,
                coverImage: r.image,
                status: r.status,
                genres: r.genres,
                summary: r.description,
                lastUpdated: r.lastUpdated
              }));
            }
            break;
        }

        if (results.length > 0) {
          this.logDebug(`Successfully found ${results.length} results from ${provider}`);
          return { results, provider };
        } else {
          throw new Error(`No results found on ${provider}`);
        }

      } catch (err: any) {
        lastError = err;
        this.logError(`Provider ${provider} failed:`, err.message);

        // If auto-select is OFF and this provider fails, don't try others
        if (!autoSelectSource) {
          break;
        }
      }
    }

    // If we get here, all providers failed
    throw lastError || new Error('All providers failed');
  }

  /**
   * Get chapters for a specific manga from a provider
   */
  static async getChapters(
    mangaId: string, 
    provider: Provider,
    coverImage?: string
  ): Promise<Chapter[]> {
    this.logDebug(`Getting chapters for ${mangaId} from ${provider}`);

    try {
      let chapters: Chapter[] = [];

      switch (provider) {
        case 'mangafire':
          const mangafireChapters = await MangaFireProvider.getChapters(mangaId);
          chapters = mangafireChapters.map(ch => ({
            ...ch,
            thumbnail: coverImage,
            source: 'mangafire'
          }));
          break;

        case 'mangadex':
          const mangadxResponse = await MangaDexProvider.fetchInfo(mangaId);
          
          if (mangadxResponse.success) {
            chapters = MangaDexProvider.formatChaptersFromResponse(mangadxResponse.data, 'mangadex')
              .map(ch => ({
                ...ch,
                thumbnail: coverImage,
                source: 'mangadex'
              }));
          }
          break;
      }

      this.logDebug(`Successfully loaded ${chapters.length} chapters from ${provider}`);
      return chapters;

    } catch (error: any) {
      this.logError(`Failed to get chapters from ${provider}:`, error);
      throw error;
    }
  }

  /**
   * Get chapter pages for reading
   */
  static async getChapterPages(
    chapterId: string, 
    provider: Provider
  ): Promise<PageWithHeaders[]> {
    this.logDebug(`Getting pages for chapter ${chapterId} from ${provider}`);

    try {
      let pages: PageWithHeaders[] = [];

      switch (provider) {
        case 'mangafire':
          const mangafireResponse = await MangaFireProvider.getChapterPages(chapterId);
          pages = mangafireResponse.pages.map(p => ({
            url: p.url,
            headers: p.headers
          }));
          break;

        case 'mangadex':
          const mangadxUrl = MangaDexProvider.getChapterUrl(chapterId);
          const response = await axios.get(mangadxUrl, {
            headers: MangaDexProvider.getHeaders()
          });
          const data = response.data;
          const urls = MangaDexProvider.parseChapterPagesResponse(data);
          pages = urls.map(url => ({
            url,
            headers: MangaDexProvider.getImageHeaders()
          }));
          break;
      }

      this.logDebug(`Successfully loaded ${pages.length} pages from ${provider}`);
      return pages;

    } catch (error: any) {
      this.logError(`Failed to get chapter pages from ${provider}:`, error);
      throw error;
    }
  }

  /**
   * Get first page of a chapter for thumbnail preview
   */
  static async getChapterThumbnailPage(
    chapterId: string, 
    provider: Provider
  ): Promise<PageWithHeaders | null> {
    this.logDebug(`Getting thumbnail page for chapter ${chapterId} from ${provider}`);

    try {
      const allPages = await this.getChapterPages(chapterId, provider);
      // Return first page for thumbnail preview
      const thumbnailPage = allPages[0] || null;
      
      this.logDebug(`Successfully loaded thumbnail page from ${provider}`);
      return thumbnailPage;

    } catch (error: any) {
      this.logError(`Failed to get chapter thumbnail page from ${provider}:`, error);
      throw error;
    }
  }

  /**
   * Get error message based on provider and auto-select setting
   */
  static getProviderErrorMessage(
    provider: Provider, 
    autoSelectSource: boolean
  ): string {
    if (!autoSelectSource) {
      // Specific error messages for when auto-select is OFF
      switch (provider) {
        case 'mangadex':
          return "MangaDex is currently unavailable due to DMCA restrictions. Please try enabling 'Auto-Select Best Source' or choose a different provider.";
        case 'mangafire':
          return "MangaFire is currently unavailable. Please try enabling 'Auto-Select Best Source' or choose a different provider.";
        default:
          return "The selected provider is currently unavailable. Please try enabling 'Auto-Select Best Source' or choose a different provider.";
      }
    } else {
      return "All manga sources are currently unavailable. Please try again later.";
    }
  }
} 