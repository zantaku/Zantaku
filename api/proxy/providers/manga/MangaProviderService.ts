import { Chapter, Provider } from './index';
import { MangaDexProvider } from './mangadx';
import KatanaProvider from './katana';
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
   * Extract the first meaningful keyword from a manga title for searching
   */
  private static extractFirstKeyword(title: string): string {
    // Remove common prefixes and suffixes that don't help with search
    let cleaned = title
      .replace(/^[【「『]/, '') // Remove opening brackets/quotes
      .replace(/[】」』]$/, '') // Remove closing brackets/quotes
      .replace(/[★☆♪♫♥♡◆◇▲△●○■□※！？：；，。]/g, '') // Remove decorative symbols
      .replace(/[（]/g, '(') // Normalize parentheses
      .replace(/[）]/g, ')') // Normalize parentheses
      .replace(/[【]/g, '[') // Normalize brackets
      .replace(/[】]/g, ']') // Normalize brackets
      .replace(/[「]/g, '"') // Normalize quotes
      .replace(/[」]/g, '"') // Normalize quotes
      .replace(/[『]/g, "'") // Normalize quotes
      .replace(/[』]/g, "'") // Normalize quotes
      .replace(/\s+/g, ' ') // Replace multiple spaces with single space
      .trim();

    // Split by common separators and get the first meaningful part
    const separators = [':', ' - ', ' – ', ' — ', ' | ', ' |', '| ', ' (', '（', ' [', '【'];
    
    for (const separator of separators) {
      if (cleaned.includes(separator)) {
        cleaned = cleaned.split(separator)[0].trim();
        break;
      }
    }

    // Extract the first 1-3 words as the keyword
    const words = cleaned.split(/\s+/).filter(word => 
      word.length > 1 && // Skip single characters
      !/^[0-9]+$/.test(word) && // Skip pure numbers
      !['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'].includes(word.toLowerCase())
    );

    // Return the first meaningful word or first two words if the first is very short
    if (words.length === 0) return cleaned;
    if (words[0].length <= 2 && words.length > 1) {
      return `${words[0]} ${words[1]}`.trim();
    }
    return words[0];
  }

  /**
   * Normalize manga title by removing problematic symbols and characters
   */
  private static normalizeTitle(title: string): string {
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
      .replace(/\s+/g, ' ') // Replace multiple spaces with single space
      .trim(); // Remove leading/trailing whitespace
  }

  /**
   * Search for manga across providers with auto-fallback support
   */
  static async searchManga(
    title: string, 
    preferences: ProviderPreferences
  ): Promise<{ results: SearchResult[]; provider: Provider }> {
    const { defaultProvider, autoSelectSource } = preferences;
    
    // Extract first keyword for better search results
    const firstKeyword = this.extractFirstKeyword(title);
    const normalizedTitle = this.normalizeTitle(title);
    
    this.logDebug(`Original title: "${title}"`);
    this.logDebug(`First keyword: "${firstKeyword}"`);
    this.logDebug(`Normalized title: "${normalizedTitle}"`);
    
    // Determine which providers to try
    const providersToTry: Provider[] = autoSelectSource 
      ? ['katana', 'mangadex'] // Try best sources first when auto-select is ON
      : [defaultProvider]; // Only try the selected provider when auto-select is OFF

    this.logDebug(`Auto-select is ${autoSelectSource ? 'ON' : 'OFF'}`);
    this.logDebug(`Will try providers in order:`, providersToTry);

    let lastError: any = null;

    for (const provider of providersToTry) {
      try {
        this.logDebug(`Trying provider: ${provider} for "${firstKeyword}"`);
        
        let results: SearchResult[] = [];

        // Try first keyword, then normalized title, then original title
        const titlesToTry = [firstKeyword];
        if (normalizedTitle !== firstKeyword) {
          titlesToTry.push(normalizedTitle);
        }
        if (title !== normalizedTitle && title !== firstKeyword) {
          titlesToTry.push(title);
        }

        for (const currentTitle of titlesToTry) {
          try {
            switch (provider) {
              case 'katana':
                const katanaResults = await KatanaProvider.search(currentTitle);
                results = katanaResults.map(r => ({
                  id: r.id,
                  title: r.title,
                  source: 'katana' as Provider,
                  coverImage: r.coverImage,
                  status: r.status,
                  genres: r.genres,
                  summary: r.description,
                  lastUpdated: r.lastUpdated
                }));
                break;

              case 'mangadex':
                const mangadxUrl = MangaDexProvider.getSearchUrl(currentTitle);
                const mangadxResponse = await axios.get(mangadxUrl, {
                  headers: MangaDexProvider.getHeaders(),
                  timeout: 15000 // 15 second timeout
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

            // If we got results, break out of the title loop
            if (results.length > 0) {
              break;
            }
          } catch (titleError) {
            this.logDebug(`Title "${currentTitle}" failed for ${provider}:`, titleError);
            // Continue to next title variation
          }
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
        case 'katana':
          const katanaChapters = await KatanaProvider.getChapters(mangaId);
          chapters = katanaChapters.map(ch => ({
            ...ch,
            thumbnail: coverImage,
            source: 'katana'
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
          } else {
            throw new Error(mangadxResponse.data?.errorMessage || 'Failed to fetch manga info from MangaDex');
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
        case 'katana':
          const katanaResponse = await KatanaProvider.getChapterPages(chapterId);
          pages = katanaResponse.pages.map(p => ({
            url: p.url,
            headers: p.headers
          }));
          break;


        case 'mangadex':
          const mangadxResponse = await MangaDexProvider.fetchChapterPages(chapterId);
          
          if (mangadxResponse.success) {
            const urls = MangaDexProvider.parseChapterPagesResponse(mangadxResponse.data);
            pages = urls.map(url => ({
              url,
              headers: MangaDexProvider.getImageHeaders()
            }));
          } else {
            throw new Error(mangadxResponse.data?.errorMessage || 'Failed to fetch chapter pages');
          }
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
        case 'katana':
          return "Katana is currently unavailable. Please try enabling 'Auto-Select Best Source' or choose a different provider.";
        case 'mangadex':
          return "MangaDex is currently unavailable due to DMCA restrictions. Please try enabling 'Auto-Select Best Source' or choose a different provider.";
        default:
          return "The selected provider is currently unavailable. Please try enabling 'Auto-Select Best Source' or choose a different provider.";
      }
    } else {
      return "All manga sources are currently unavailable. Please try again later.";
    }
  }
} 