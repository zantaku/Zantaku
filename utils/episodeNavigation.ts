import AsyncStorage from '@react-native-async-storage/async-storage';
import { loadEpisodesFromCache } from './episodeOptimization';

// Episode interface matching the existing structure
interface Episode {
  id: string;
  number: number;
  title?: string;
  image?: string;
  progress?: number;
  isFiller?: boolean;
  isRecap?: boolean;
  aired?: string;
  anilistId?: string;
  description?: string;
  duration?: number;
  provider?: string;
  isSubbed?: boolean;
  isDubbed?: boolean;
  providerIds?: {
    animepahe?: string;
    zoro?: string;
  };
}

// Video data interface matching the existing structure
interface VideoData {
  source: string;
  headers?: Record<string, string>;
  subtitles?: any[];
  timings?: any;
  episodeId?: string;
  episodeNumber?: number;
  animeTitle?: string;
  anilistId?: string;
  audioTracks?: any;
}

// Next episode result interface
export interface NextEpisodeResult {
  hasNext: boolean;
  nextEpisode?: Episode;
  episodeId?: string;
  provider?: string;
}

/**
 * Provider-agnostic utility to find the next episode
 * This works regardless of the current provider (Zoro, AnimePahe, etc.)
 */
export class EpisodeNavigationUtils {
  
  /**
   * Find the next episode based on current video data
   */
  static async findNextEpisode(currentVideoData: VideoData): Promise<NextEpisodeResult> {
    try {
      console.log('[EPISODE_NAV] 🔍 Finding next episode for:', {
        currentEpisode: currentVideoData.episodeNumber,
        animeTitle: currentVideoData.animeTitle,
        anilistId: currentVideoData.anilistId
      });

      if (!currentVideoData.anilistId || !currentVideoData.episodeNumber) {
        console.log('[EPISODE_NAV] ❌ Missing required data (anilistId or episodeNumber)');
        return { hasNext: false };
      }

      // Try to load episode list from cache first
      const episodeList = await this.loadEpisodeListFromCache(currentVideoData.anilistId, currentVideoData.animeTitle);
      
      if (!episodeList || episodeList.length === 0) {
        console.log('[EPISODE_NAV] ❌ No episode list found in cache');
        // Fallback: synthesize next episode using current context so UX features still work
        const currentEpisodeNumber = currentVideoData.episodeNumber;
        const nextEpisodeNumber = currentEpisodeNumber + 1;
        const provider = await this.getCurrentProvider();
        const episodeId = this.generateEpisodeId({
          id: '',
          number: nextEpisodeNumber,
          title: undefined,
          providerIds: {}
        } as any, provider, currentVideoData.anilistId);

        console.log('[EPISODE_NAV] 🔁 Fallback next-episode synthesis (cache-miss):', {
          currentEpisode: currentEpisodeNumber,
          nextEpisode: nextEpisodeNumber,
          provider,
          episodeId
        });

        return {
          hasNext: true,
          nextEpisode: { number: nextEpisodeNumber } as any,
          episodeId,
          provider
        };
      }

      // Find the next episode (current episode number + 1)
      const currentEpisodeNumber = currentVideoData.episodeNumber;
      const nextEpisodeNumber = currentEpisodeNumber + 1;
      
      const nextEpisode = episodeList.find(ep => ep.number === nextEpisodeNumber);
      
      if (!nextEpisode) {
        console.log('[EPISODE_NAV] ❌ Next episode not found in list', {
          currentEpisode: currentEpisodeNumber,
          nextEpisode: nextEpisodeNumber,
          availableEpisodes: episodeList.map(ep => ep.number).slice(0, 10) // Show first 10 for debugging
        });
        return { hasNext: false };
      }

      // Determine the provider and generate the appropriate episode ID
      const provider = await this.getCurrentProvider();
      const episodeId = this.generateEpisodeId(nextEpisode, provider, currentVideoData.anilistId);

      console.log('[EPISODE_NAV] ✅ Found next episode:', {
        episode: nextEpisode.number,
        title: nextEpisode.title,
        episodeId: episodeId,
        provider: provider
      });

      return {
        hasNext: true,
        nextEpisode: nextEpisode,
        episodeId: episodeId,
        provider: provider
      };

    } catch (error) {
      console.error('[EPISODE_NAV] ❌ Error finding next episode:', error);
      return { hasNext: false };
    }
  }

  /**
   * Load episode list from cache using the same keys as EpisodeList component
   */
  private static async loadEpisodeListFromCache(anilistId: string, animeTitle?: string): Promise<Episode[]> {
    try {
      // Use the same cache loader as EpisodeList.tsx → utils/episodeOptimization.loadEpisodesFromCache
      const cached = await loadEpisodesFromCache(anilistId, undefined, animeTitle);
      if (cached && cached.episodes && Array.isArray(cached.episodes) && cached.episodes.length > 0) {
        console.log('[EPISODE_NAV] 📦 Loaded episodes via shared loader', {
          count: cached.episodes.length,
          isStale: cached.isStale,
        });
        return cached.episodes as unknown as Episode[];
      }

      // Legacy/provider-specific fallbacks (compat with older caches)
      const legacyKey = `providerEpisodes_${anilistId}`;
      const legacy = await AsyncStorage.getItem(legacyKey);
      if (legacy) {
        const episodes = JSON.parse(legacy);
        if (Array.isArray(episodes) && episodes.length > 0) {
          console.log('[EPISODE_NAV] 📦 Loaded episodes from legacy provider cache:', episodes.length);
          return episodes;
        }
      }

      return [];
    } catch (error) {
      console.error('[EPISODE_NAV] ❌ Error loading episode list from cache:', error);
      return [];
    }
  }

  /**
   * Get current provider from settings
   */
  private static async getCurrentProvider(): Promise<string> {
    try {
      const sourceSettings = await this.getSourceSettings();
      return sourceSettings.defaultProvider || 'animepahe';
    } catch (error) {
      console.error('[EPISODE_NAV] ❌ Error getting current provider:', error);
      return 'animepahe';
    }
  }

  /**
   * Get source settings from AsyncStorage
   */
  private static async getSourceSettings(): Promise<{defaultProvider: string; preferredType: string}> {
    try {
      const settings = await AsyncStorage.getItem('sourceSettings');
      if (settings) {
        return JSON.parse(settings);
      }
      return { defaultProvider: 'animepahe', preferredType: 'sub' };
    } catch (error) {
      console.error('[EPISODE_NAV] ❌ Error loading source settings:', error);
      return { defaultProvider: 'animepahe', preferredType: 'sub' };
    }
  }

  /**
   * Generate episode ID based on provider and episode data
   */
  private static generateEpisodeId(episode: Episode, provider: string, anilistId: string): string {
    console.log('[EPISODE_NAV] 🔧 Generating episode ID for provider:', provider, 'episode:', episode.number);
    
    if (provider === 'zoro') {
      // For Zoro, use the episode ID if available in providerIds, otherwise use the episode's own ID
      return episode.providerIds?.zoro || episode.id;
    } else if (provider === 'animepahe') {
      // For AnimePahe, use the format: {anime_id}/episode-{num}
      if (episode.providerIds?.animepahe) {
        return `${episode.providerIds.animepahe}/episode-${episode.number}`;
      }
      // Fallback format
      return `${anilistId}/episode-${episode.number}`;
    } else {
      // Generic fallback format
      return `${anilistId}?ep=${episode.number}`;
    }
  }

  /**
   * Save current progress for episode navigation tracking
   */
  static async saveProgressForNavigation(videoData: VideoData, currentTime: number, duration: number): Promise<void> {
    if (!videoData.anilistId || !videoData.episodeNumber) return;

    try {
      const progressData = {
        timestamp: currentTime,
        episodeNumber: videoData.episodeNumber,
        anilistId: videoData.anilistId,
        duration: duration,
        savedAt: Date.now(),
        animeTitle: videoData.animeTitle || '',
        percentage: duration > 0 ? (currentTime / duration) * 100 : 0,
      };

      // Save with both the existing key format and episode progress format
      const keys = [
        `progress_anilist_${videoData.anilistId}_ep_${videoData.episodeNumber}`,
        `episode_progress_${videoData.anilistId}_${videoData.episodeNumber}`,
      ];

      for (const key of keys) {
        await AsyncStorage.setItem(key, JSON.stringify(progressData));
      }

      console.log('[EPISODE_NAV] 💾 Saved progress for navigation:', {
        episode: videoData.episodeNumber,
        timestamp: Math.floor(currentTime),
        percentage: Math.round(progressData.percentage)
      });

    } catch (error) {
      console.error('[EPISODE_NAV] ❌ Error saving progress:', error);
    }
  }

  /**
   * Check if episode is nearly complete (95% watched)
   */
  static isEpisodeNearlyComplete(currentTime: number, duration: number): boolean {
    if (duration <= 0) return false;
    const percentage = (currentTime / duration) * 100;
    return percentage >= 95;
  }

  /**
   * Check if we're in the last minute of the episode
   */
  static isInLastMinute(currentTime: number, duration: number): boolean {
    if (duration <= 0) return false;
    const remainingTime = duration - currentTime;
    return remainingTime <= 60 && remainingTime > 0;
  }

  /**
   * Get remaining time in seconds
   */
  static getRemainingTime(currentTime: number, duration: number): number {
    return Math.max(0, duration - currentTime);
  }
} 