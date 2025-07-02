import { zoroProvider, ZoroHiAnimeProvider } from './zorohianime';
import { animePaheProvider, AnimePaheProvider } from './animepahe';
import { Episode, Source, Subtitle, VideoTimings, WatchResponse } from './zorohianime';

export type ProviderType = 'zoro' | 'animepahe';

export interface ProviderResult {
  provider: ProviderType;
  episodes: Episode[];
  success: boolean;
  error?: string;
}

export interface WatchResult {
  provider: ProviderType;
  data: WatchResponse;
  success: boolean;
  error?: string;
}

// Common interface for all providers
interface BaseProvider {
  getWatchData(episodeIdOrTitle: string, isDubOrEpisodeNumber?: boolean | number): Promise<WatchResponse>;
}

export class AnimeProviderManager {
  private providers: Map<ProviderType, BaseProvider>;

  constructor() {
    this.providers = new Map();
    this.providers.set('zoro', zoroProvider);
    this.providers.set('animepahe', animePaheProvider);
  }

  /**
   * Get episodes from a specific provider
   */
  async getEpisodesFromProvider(
    provider: ProviderType,
    anilistId?: string,
    animeTitle?: string,
    isDub: boolean = false
  ): Promise<ProviderResult> {
    try {
      let episodes: Episode[] = [];

      if (provider === 'zoro' && anilistId) {
        episodes = await zoroProvider.getEpisodes(anilistId, isDub);
      } else if (provider === 'animepahe' && animeTitle) {
        episodes = await animePaheProvider.searchAndGetEpisodes(animeTitle);
      }

      return {
        provider,
        episodes,
        success: true
      };
    } catch (error) {
      console.error(`[ProviderManager] Error with ${provider}:`, error);
      return {
        provider,
        episodes: [],
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get episodes from all available providers
   */
  async getEpisodesFromAllProviders(
    anilistId?: string,
    animeTitle?: string,
    mangaTitle?: string,
    isDub: boolean = false
  ): Promise<ProviderResult[]> {
    const searchTitle = mangaTitle || animeTitle;
    
    const promises = [
      // Always try Zoro if we have AniList ID
      anilistId ? this.getEpisodesFromProvider('zoro', anilistId, undefined, isDub) : null,
      // Try AnimePahe if we have a title
      searchTitle ? this.getEpisodesFromProvider('animepahe', undefined, searchTitle) : null
    ].filter(Boolean) as Promise<ProviderResult>[];

    const results = await Promise.allSettled(promises);
    
    return results.map(result => 
      result.status === 'fulfilled' 
        ? result.value 
        : { provider: 'zoro' as ProviderType, episodes: [], success: false, error: 'Promise rejected' }
    );
  }

  /**
   * Get episodes from only the selected provider
   */
  async getEpisodesFromSingleProvider(
    selectedProvider: ProviderType,
    anilistId?: string,
    animeTitle?: string,
    mangaTitle?: string,
    isDub: boolean = false
  ): Promise<ProviderResult> {
    const searchTitle = mangaTitle || animeTitle;
    
    console.log(`[ProviderManager] Fetching episodes from ${selectedProvider} only`);
    
    if (selectedProvider === 'zoro' && anilistId) {
      return await this.getEpisodesFromProvider('zoro', anilistId, undefined, isDub);
    } else if (selectedProvider === 'animepahe' && searchTitle) {
      return await this.getEpisodesFromProvider('animepahe', undefined, searchTitle, isDub);
    } else {
      console.warn(`[ProviderManager] Cannot fetch from ${selectedProvider}: missing required parameters`);
      return {
        provider: selectedProvider,
        episodes: [],
        success: false,
        error: `Cannot fetch from ${selectedProvider}: missing required parameters`
      };
    }
  }

  /**
   * Merge episodes from multiple providers
   */
  mergeEpisodesFromProviders(providerResults: ProviderResult[], coverImage?: string): Episode[] {
    const episodeMap = new Map<number, Episode>();
    const providerPriority: ProviderType[] = ['animepahe', 'zoro']; // AnimePahe has priority

    // Sort results by provider priority
    const sortedResults = providerResults
      .filter(result => result.success && result.episodes.length > 0)
      .sort((a, b) => {
        const aPriority = providerPriority.indexOf(a.provider);
        const bPriority = providerPriority.indexOf(b.provider);
        return aPriority - bPriority;
      });

    // Merge episodes, giving priority to higher-priority providers
    sortedResults.forEach(result => {
      result.episodes.forEach(episode => {
        const existing = episodeMap.get(episode.number);
        
        if (!existing) {
          // Add new episode with provider-specific ID
          episodeMap.set(episode.number, {
            ...episode,
            image: episode.image || coverImage,
            providerIds: {
              [result.provider]: episode.id
            }
          });
        } else {
          // Update provider info to show multiple sources
          const providers = existing.provider?.split(', ') || [];
          if (!providers.includes(episode.provider || '')) {
            providers.push(episode.provider || '');
          }
          
          episodeMap.set(episode.number, {
            ...existing,
            provider: providers.join(', '),
            // Keep the higher priority provider's data but add availability info
            isSubbed: existing.isSubbed || episode.isSubbed,
            isDubbed: existing.isDubbed || episode.isDubbed,
            // Merge provider-specific IDs
            providerIds: {
              ...existing.providerIds,
              [result.provider]: episode.id
            }
          });
        }
      });
    });

    return Array.from(episodeMap.values()).sort((a, b) => a.number - b.number);
  }

  /**
   * Get watch data from a specific provider
   */
  async getWatchDataFromProvider(
    provider: ProviderType,
    episodeId: string,
    isDub: boolean = false,
    animeTitle?: string,
    episodeNumber?: number
  ): Promise<WatchResult> {
    try {
      let watchData: WatchResponse;

      if (provider === 'zoro') {
        watchData = await zoroProvider.getWatchData(episodeId, isDub);
      } else if (provider === 'animepahe') {
        // AnimePahe requires anime title and episode number
        if (!animeTitle || !episodeNumber) {
          throw new Error('AnimePahe requires anime title and episode number');
        }
        
        // Get the AnimePahe anime ID first
        const animeId = await animePaheProvider.getAnimeIdByTitle(animeTitle);
        if (!animeId) {
          throw new Error('Anime not found on AnimePahe');
        }
        
        watchData = await animePaheProvider.getWatchData(animeId, episodeNumber, isDub);
      } else {
        throw new Error(`Unsupported provider: ${provider}`);
      }

      return {
        provider,
        data: watchData,
        success: true
      };
    } catch (error) {
      console.error(`[ProviderManager] Watch data error with ${provider}:`, error);
      return {
        provider,
        data: { sources: [], subtitles: [] },
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Try to get watch data from multiple providers with fallback
   */
  async getWatchDataWithFallback(
    episodeId: string,
    anilistId?: string,
    animeTitle?: string,
    episodeNumber?: number,
    preferredType: 'sub' | 'dub' = 'sub',
    autoSelectEnabled: boolean = true,
    specificProvider?: ProviderType
  ): Promise<WatchResult | null> {
    const isDub = preferredType === 'dub';
    
    // If auto-select is OFF and a specific provider is chosen, only try that provider
    if (!autoSelectEnabled && specificProvider) {
      console.log(`[ProviderManager] Auto-select OFF, trying only ${specificProvider} for episode ${episodeNumber || episodeId}`);
      
      // AnimePahe only provides SUB content
      
      const result = await this.getWatchDataFromProvider(
        specificProvider,
        episodeId,
        isDub,
        animeTitle,
        episodeNumber
      );
      
      if (result.success && result.data.sources.length > 0) {
        console.log(`[ProviderManager] Success with ${specificProvider}`);
        return result;
      }
      
      console.log(`[ProviderManager] ${specificProvider} failed: ${result.error}`);
      return null; // No fallback when auto-select is OFF
    }
    
    // Auto-select is ON - try providers in order of preference
    // For DUB requests, prioritize Zoro since AnimePahe doesn't provide DUB content
    let providers: ProviderType[] = isDub ? ['zoro', 'animepahe'] : ['animepahe', 'zoro'];
    
    console.log(`[ProviderManager] Will try providers for ${isDub ? 'DUB' : 'SUB'}: ${providers.join(' → ')}`);
    
    
    for (const provider of providers) {
      try {
        console.log(`[ProviderManager] Trying ${provider} for episode ${episodeNumber || episodeId}`);
        
        const result = await this.getWatchDataFromProvider(
          provider,
          episodeId,
          isDub,
          animeTitle,
          episodeNumber
        );
        
        if (result.success && result.data.sources.length > 0) {
          console.log(`[ProviderManager] Success with ${provider}`);
          return result;
        }
        
        console.log(`[ProviderManager] ${provider} failed or no sources: ${result.error}`);
      } catch (error) {
        console.error(`[ProviderManager] ${provider} error:`, error);
        continue;
      }
    }
    
    // If dub failed and auto-select is enabled, try sub as fallback
    if (isDub && autoSelectEnabled) {
      console.log('[ProviderManager] Dub failed, trying sub as fallback');
      return this.getWatchDataWithFallback(episodeId, anilistId, animeTitle, episodeNumber, 'sub', autoSelectEnabled, specificProvider);
    }
    
    console.log('[ProviderManager] All providers failed');
    return null;
  }

  /**
   * Check episode availability across providers
   */
  async checkEpisodeAvailability(
    anilistId?: string,
    animeTitle?: string,
    episodeNumber?: number
  ): Promise<{ [key in ProviderType]: boolean }> {
    const availability: { [key in ProviderType]: boolean } = {
      zoro: false,
      animepahe: false
    };

    // Check Zoro availability
    if (anilistId && episodeNumber) {
      try {
        const zoroResult = await zoroProvider.checkEpisodeAvailability(anilistId, episodeNumber);
        availability.zoro = zoroResult.sub || zoroResult.dub;
      } catch (error) {
        console.error('[ProviderManager] Zoro availability check failed:', error);
      }
    }

    // Check AnimePahe availability
    if (animeTitle && episodeNumber) {
      try {
        const paheResult = await animePaheProvider.checkEpisodeAvailability(animeTitle, episodeNumber);
        availability.animepahe = paheResult.sub; // AnimePahe only provides SUB content
      } catch (error) {
        console.error('[ProviderManager] AnimePahe availability check failed:', error);
      }
    }

    return availability;
  }
}

// Export singleton instance
export const animeProviderManager = new AnimeProviderManager();

// Re-export types and providers for convenience
export { Episode, Source, Subtitle, VideoTimings, WatchResponse };
export { zoroProvider, animePaheProvider }; 