import { Chapter } from '../api/proxy/providers/manga';
import { TAKIAPI_URL } from '../app/constants/api';

export interface NormalizedChapter {
  id: string;
  number: string;
  normalizedNumber: number; // For sorting and navigation
  title: string;
  url: string;
  source: string;
  originalChapter: Chapter;
}

export interface ChapterNavigationContext {
  chapters: NormalizedChapter[];
  currentChapter: NormalizedChapter;
  currentIndex: number;
  hasNext: boolean;
  hasPrevious: boolean;
  nextChapter?: NormalizedChapter;
  previousChapter?: NormalizedChapter;
}

export class ChapterManager {
  private chapters: NormalizedChapter[] = [];
  private provider: string = '';
  private mangaId: string = '';

  constructor(chapters: Chapter[], provider: string, mangaId: string) {
    this.provider = provider;
    this.mangaId = mangaId;
    this.chapters = this.normalizeChapters(chapters);
  }

  /**
   * Normalize chapters from different providers into a consistent format
   */
  private normalizeChapters(chapters: Chapter[]): NormalizedChapter[] {
    return chapters.map(chapter => {
      const normalizedNumber = this.extractChapterNumber(chapter.number);
      
      return {
        id: chapter.id,
        number: chapter.number,
        normalizedNumber,
        title: chapter.title,
        url: chapter.url,
        source: this.provider,
        originalChapter: chapter
      };
    }).sort((a, b) => a.normalizedNumber - b.normalizedNumber);
  }

  /**
   * Extract numeric chapter number from various formats
   * Examples:
   * - "10" -> 10
   * - "9: Hyo's day off" -> 9
   * - "Chapter 15.5" -> 15.5
   * - "198: Winter Nights Are Long" -> 198
   */
  private extractChapterNumber(chapterString: string): number {
    // Remove common prefixes
    const cleaned = chapterString.replace(/^(chapter|ch\.?)\s*/i, '');
    
    // Extract first number (including decimals)
    const match = cleaned.match(/^(\d+(?:\.\d+)?)/);
    
    if (match) {
      return parseFloat(match[1]);
    }
    
    // Fallback: try to extract any number
    const fallbackMatch = chapterString.match(/(\d+(?:\.\d+)?)/);
    if (fallbackMatch) {
      return parseFloat(fallbackMatch[1]);
    }
    
    // Last resort: return 0
    console.warn(`Could not extract chapter number from: "${chapterString}"`);
    return 0;
  }

  /**
   * Get navigation context for a specific chapter
   */
  getNavigationContext(chapterId: string): ChapterNavigationContext | null {
    const currentIndex = this.chapters.findIndex(ch => ch.id === chapterId);
    if (currentIndex === -1) {
      console.warn(`Chapter not found: ${chapterId}`);
      return null;
    }

    const currentChapter = this.chapters[currentIndex];
    const hasNext = currentIndex < this.chapters.length - 1;
    const hasPrevious = currentIndex > 0;
    const nextChapter = hasNext ? this.chapters[currentIndex + 1] : undefined;
    const previousChapter = hasPrevious ? this.chapters[currentIndex - 1] : undefined;

    return {
      chapters: this.chapters,
      currentChapter,
      currentIndex,
      hasNext,
      hasPrevious,
      nextChapter,
      previousChapter
    };
  }

  /**
   * Get navigation context by chapter number (for fallback when ID not found)
   */
  getNavigationContextByNumber(chapterNumber: string): ChapterNavigationContext | null {
    const normalizedNumber = this.extractChapterNumber(chapterNumber);
    const currentChapter = this.chapters.find(ch => ch.normalizedNumber === normalizedNumber);
    
    if (!currentChapter) {
      console.warn(`Chapter not found by number: ${chapterNumber}`);
      return null;
    }

    return this.getNavigationContext(currentChapter.id);
  }

  /**
   * Get next chapter from current chapter ID
   */
  getNextChapter(chapterId: string): NormalizedChapter | null {
    const context = this.getNavigationContext(chapterId);
    return context?.nextChapter || null;
  }

  /**
   * Get previous chapter from current chapter ID  
   */
  getPreviousChapter(chapterId: string): NormalizedChapter | null {
    const context = this.getNavigationContext(chapterId);
    return context?.previousChapter || null;
  }

  /**
   * Get all chapters
   */
  getAllChapters(): NormalizedChapter[] {
    return [...this.chapters];
  }

  /**
   * Find chapter by ID
   */
  getChapterById(chapterId: string): NormalizedChapter | null {
    return this.chapters.find(ch => ch.id === chapterId) || null;
  }

  /**
   * Generate proper API URL for fetching chapter pages based on provider
   */
  getChapterPagesUrl(chapter: NormalizedChapter, baseApiUrl: string): string {
    switch (this.provider) {
      case 'mangafire':
        // MangaFire uses /api/manga/page?id={chapterId}
        return `${baseApiUrl}/api/manga/page?id=${chapter.id}`;
        
      case 'mangadex':
        // Use TakiAPI (Consumet) endpoint for MangaDex
        // This endpoint is stable and returns the page list directly
        return `${TAKIAPI_URL}/manga/mangadex/read/${chapter.id}`;
        
      case 'katana':
        // Katana uses /katana/series/{mangaId}/{chapterId}
        return `${baseApiUrl}/katana/series/${this.mangaId}/${chapter.id}`;
        
      default:
        // Default fallback
        return `${baseApiUrl}/api/manga/page?id=${chapter.id}`;
    }
  }

  /**
   * Get provider info
   */
  getProvider(): string {
    return this.provider;
  }

  /**
   * Get manga ID
   */
  getMangaId(): string {
    return this.mangaId;
  }

  /**
   * Debug info
   */
  getDebugInfo() {
    return {
      provider: this.provider,
      mangaId: this.mangaId,
      totalChapters: this.chapters.length,
      firstChapter: this.chapters[0],
      lastChapter: this.chapters[this.chapters.length - 1]
    };
  }
} 