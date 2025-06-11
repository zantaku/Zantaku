import AsyncStorage from '@react-native-async-storage/async-storage';
import { NewsItem, ANNProvider } from './ANN';
import { AniListProvider } from './AniList';
import { CrunchyrollProvider } from './Crunchyroll';
import { SoraNews24Provider } from './soranews24';
import type { NewsSettings } from '../../../../app/appsettings/newssettings';

// Default settings fallback
const DEFAULT_SETTINGS: NewsSettings = {
  enableAniList: true,
  enableANN: true,
  enableCrunchyrollNews: false,
  enableMyAnimeListNews: false,
  enableJapanTimes: false,
  enableNHKWorld: false,
  enableSoraNews24: false,
  enableTokyoReporter: false,
  enableAnimeNews: true,
  enableMangaNews: true,
  enableLightNovelNews: true,
  enableJapanCulture: false,
  enableTechnology: false,
  enableGaming: false,
  enableEntertainment: false,
  enableLifestyle: false,
  prioritizeJapanContent: true,
  showTrendingOnly: false,
  enableEndlessLoading: true,
  newsRefreshInterval: 30,
  maxNewsItems: 50,
  preferredLanguage: 'en',
  showJapaneseText: false,
  enableAutoTranslation: false,
  showThumbnails: true,
  showScores: true,
  showTimestamps: true,
  compactView: false,
};

export class NewsService {
  private static cachedNews: NewsItem[] = [];
  private static lastFetchTime: number = 0;
  private static readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  static async fetchNews(): Promise<NewsItem[]> {
    try {
      console.log('🔍 NewsService: Starting news fetch...');
      
      // Load user settings
      const settings = await this.loadSettings();
      console.log('⚙️ NewsService: Loaded settings', {
        sources: this.getEnabledSources(settings),
        maxItems: settings.maxNewsItems
      });

      // Check cache first
      const now = Date.now();
      const cacheAge = now - this.lastFetchTime;
      const refreshInterval = settings.newsRefreshInterval * 60 * 1000; // Convert to ms
      
      if (this.cachedNews.length > 0 && cacheAge < Math.min(this.CACHE_DURATION, refreshInterval)) {
        console.log('📦 NewsService: Using cached news', {
          items: this.cachedNews.length,
          ageMinutes: Math.round(cacheAge / 60000)
        });
        return this.processNews(this.cachedNews, settings);
      }

      // Fetch from enabled sources
      const newsPromises: Promise<NewsItem[]>[] = [];
      const itemsPerSource = Math.ceil(settings.maxNewsItems / this.getEnabledSourceCount(settings));

      if (settings.enableAniList) {
        newsPromises.push(AniListProvider.fetchNews(itemsPerSource));
      }
      
      if (settings.enableANN) {
        newsPromises.push(ANNProvider.fetchNews(itemsPerSource));
      }
      
      if (settings.enableCrunchyrollNews) {
        newsPromises.push(CrunchyrollProvider.fetchNews(itemsPerSource));
      }
      
      if (settings.enableSoraNews24) {
        newsPromises.push(SoraNews24Provider.fetchNews(itemsPerSource));
      }

      // TODO: Add other providers when implemented
      // if (settings.enableMyAnimeListNews) newsPromises.push(MALProvider.fetchNews(itemsPerSource));
      // if (settings.enableJapanTimes) newsPromises.push(JapanTimesProvider.fetchNews(itemsPerSource));
      // if (settings.enableNHKWorld) newsPromises.push(NHKProvider.fetchNews(itemsPerSource));
      // if (settings.enableTokyoReporter) newsPromises.push(TokyoReporterProvider.fetchNews(itemsPerSource));

      // Fetch all news concurrently
      const newsResults = await Promise.allSettled(newsPromises);
      const allNews: NewsItem[] = [];

      newsResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          allNews.push(...result.value);
        } else {
          console.error(`❌ NewsService: Provider ${index} failed:`, result.reason);
        }
      });

      console.log(`✅ NewsService: Fetched ${allNews.length} total items from ${newsResults.length} sources`);

      // Cache the results
      this.cachedNews = allNews;
      this.lastFetchTime = now;

      return this.processNews(allNews, settings);
      
    } catch (error) {
      console.error('❌ NewsService: Error fetching news:', error);
      
      // Return cached news if available
      if (this.cachedNews.length > 0) {
        console.log('📦 NewsService: Falling back to cached news');
        const settings = await this.loadSettings();
        return this.processNews(this.cachedNews, settings);
      }
      
      return [];
    }
  }

  private static async loadSettings(): Promise<NewsSettings> {
    try {
      const savedSettings = await AsyncStorage.getItem('newsSettings');
      if (savedSettings) {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(savedSettings) };
      }
    } catch (error) {
      console.error('Error loading news settings:', error);
    }
    return DEFAULT_SETTINGS;
  }

  private static processNews(news: NewsItem[], settings: NewsSettings): NewsItem[] {
    let processedNews = [...news];

    // Filter by categories
    processedNews = this.filterByCategories(processedNews, settings);

    // Filter by trending only if enabled
    if (settings.showTrendingOnly) {
      processedNews = processedNews.filter(item => 
        item.category === 'Trending' || 
        item.source === 'AniList'
      );
    }

    // Sort by priority
    processedNews = this.sortByPriority(processedNews, settings);

    // Limit to max items
    processedNews = processedNews.slice(0, settings.maxNewsItems);

    console.log(`🔄 NewsService: Processed ${processedNews.length} items after filtering`);
    return processedNews;
  }

  private static filterByCategories(news: NewsItem[], settings: NewsSettings): NewsItem[] {
    const enabledCategories: string[] = [];
    
    if (settings.enableAnimeNews) enabledCategories.push('Anime', 'Trending');
    if (settings.enableMangaNews) enabledCategories.push('Manga');
    if (settings.enableLightNovelNews) enabledCategories.push('Light Novel');
    if (settings.enableJapanCulture) enabledCategories.push('Japan Culture');
    if (settings.enableTechnology) enabledCategories.push('Technology');
    if (settings.enableGaming) enabledCategories.push('Gaming');
    if (settings.enableEntertainment) enabledCategories.push('Entertainment');
    if (settings.enableLifestyle) enabledCategories.push('Lifestyle');
    
    // Always include 'News' category as it's generic
    enabledCategories.push('News');

    return news.filter(item => 
      enabledCategories.includes(item.category) ||
      enabledCategories.length === 1 // If only 'News' is enabled, show all
    );
  }

  private static sortByPriority(news: NewsItem[], settings: NewsSettings): NewsItem[] {
    return news.sort((a, b) => {
      // Prioritize Japan content if enabled
      if (settings.prioritizeJapanContent) {
        const aIsJapan = this.isJapanContent(a);
        const bIsJapan = this.isJapanContent(b);
        
        if (aIsJapan && !bIsJapan) return -1;
        if (!aIsJapan && bIsJapan) return 1;
      }

      // Sort by timestamp (newest first)
      const aTime = new Date(a.timestamp).getTime();
      const bTime = new Date(b.timestamp).getTime();
      
      return bTime - aTime;
    });
  }

  private static isJapanContent(item: NewsItem): boolean {
    const japanSources = ['SoraNews24', 'NHK World', 'Japan Times', 'Tokyo Reporter'];
    const japanKeywords = ['japan', 'japanese', 'tokyo', 'anime', 'manga', 'otaku'];
    
    if (japanSources.includes(item.source)) return true;
    
    const titleLower = item.title.toLowerCase();
    return japanKeywords.some(keyword => titleLower.includes(keyword));
  }

  private static getEnabledSources(settings: NewsSettings): string[] {
    const sources: string[] = [];
    if (settings.enableAniList) sources.push('AniList');
    if (settings.enableANN) sources.push('ANN');
    if (settings.enableCrunchyrollNews) sources.push('Crunchyroll');
    if (settings.enableMyAnimeListNews) sources.push('MAL');
    if (settings.enableJapanTimes) sources.push('Japan Times');
    if (settings.enableNHKWorld) sources.push('NHK World');
    if (settings.enableSoraNews24) sources.push('SoraNews24');
    if (settings.enableTokyoReporter) sources.push('Tokyo Reporter');
    return sources;
  }

  private static getEnabledSourceCount(settings: NewsSettings): number {
    return this.getEnabledSources(settings).length;
  }

  // Clear cache manually if needed
  static clearCache(): void {
    this.cachedNews = [];
    this.lastFetchTime = 0;
    console.log('🗑️ NewsService: Cache cleared');
  }

  // Get cache info for debugging
  static getCacheInfo() {
    return {
      itemCount: this.cachedNews.length,
      lastFetchTime: this.lastFetchTime,
      ageMinutes: Math.round((Date.now() - this.lastFetchTime) / 60000)
    };
  }
} 