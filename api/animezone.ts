import axios from 'axios';
import { Source, Subtitle, WatchResponse } from './proxy/providers/anime/zorohianime';

type AnyObject = Record<string, any>;

export class AnimeZoneProvider {
  private base = 'https://api.shizuru.app/api/holyshit';

  /**
   * ⚠️ WARNING: This is a new API being worked on
   * Some anime may work while others may not work properly.
   * This is a last-minute addition and is still in development.
   */

  async searchAnime(query: string, anilistId?: string): Promise<Array<{ id: string; title?: string; anilistId?: string }>> {
    try {
      console.warn(`⚠️ [ANIMEZONE] WARNING: This is a new API being worked on. Some anime may work while others may not work properly.`);
      console.log(`🔍 [ANIMEZONE] Searching for: "${query}"${anilistId ? ` (AniList ID: ${anilistId})` : ''}`);
      const url = `${this.base}/search?q=${encodeURIComponent(query)}`;
      console.log(`📡 [ANIMEZONE] Search URL: ${url}`);
      
      // Use the correct 'q' parameter as confirmed by API testing
      let res = await axios.get(url, { timeout: 12000 });
      let data: AnyObject = res?.data ?? {};

      console.log(`📊 [ANIMEZONE] Response status: ${res.status}`);
      console.log(`📊 [ANIMEZONE] Response data structure:`, {
        hasData: !!data,
        isArray: Array.isArray(data),
        hasResults: !!data?.results,
        resultsCount: data?.results?.length || 0,
        hasDataKey: !!data?.data,
        dataKeys: Object.keys(data || {})
      });
      
      // Log the actual response content for debugging
      console.log(`📄 [ANIMEZONE] Full response data:`, JSON.stringify(data, null, 2));
      console.log(`📄 [ANIMEZONE] Data key content:`, data?.data);
      console.log(`📄 [ANIMEZONE] Success flag:`, data?.success);
      console.log(`📄 [ANIMEZONE] Results path check:`, {
        'data?.data?.results': data?.data?.results,
        'data?.results': data?.results,
        'data?.data': data?.data,
        'Array.isArray(data?.data?.results)': Array.isArray(data?.data?.results),
        'Array.isArray(data?.results)': Array.isArray(data?.results),
        'Array.isArray(data?.data)': Array.isArray(data?.data)
      });

      // Normalize various possible shapes into an array of { id, title }
      const list: any[] = Array.isArray(data?.data?.results)
        ? data.data.results  // Primary path: { data: { results: [...] } }
        : Array.isArray(data?.results)
        ? data.results        // Fallback: { results: [...] }
        : Array.isArray(data?.data)
        ? data.data           // Fallback: { data: [...] }
        : Array.isArray(data)
        ? data                // Fallback: direct array
        : Array.isArray(data?.anime)
        ? data.anime
        : Array.isArray(data?.items)
        ? data.items
        : [];

      console.log(`📋 [ANIMEZONE] Normalized list length: ${list.length}`);

      const results = list
        .map((item: AnyObject, index: number) => {
          const result = {
            id: String(item?.id ?? item?.anizoneId ?? item?._id ?? ''),
            title: item?.title ?? item?.name ?? item?.userPreferred ?? undefined,
            anilistId: item?.anilistId || item?.anilistData?.id
          };
          
          if (index < 3) {
            console.log(`📝 [ANIMEZONE] Result ${index + 1}:`, {
              id: result.id,
              title: result.title,
              anilistId: result.anilistId,
              originalItem: {
                id: item?.id,
                anizoneId: item?.anizoneId,
                _id: item?._id,
                title: item?.title,
                name: item?.name,
                userPreferred: item?.userPreferred,
                anilistId: item?.anilistId,
                anilistData: item?.anilistData
              }
            });
          }
          
          return result;
        })
        .filter((x) => x.id);

      // If AniList ID is provided, prioritize exact matches
      if (anilistId && results.length > 0) {
        const exactMatch = results.find(r => r.anilistId === parseInt(anilistId));
        if (exactMatch) {
          console.log(`🎯 [ANIMEZONE] Found exact AniList ID match: ${exactMatch.id} (${exactMatch.title})`);
          return [exactMatch, ...results.filter(r => r.anilistId !== parseInt(anilistId))];
        }
      }

      console.log(`✅ [ANIMEZONE] Final results: ${results.length} valid entries`);
      return results;
    } catch (err: any) {
      console.error(`❌ [ANIMEZONE] Search error for "${query}":`, {
        errorMessage: err?.message,
        errorCode: err?.code,
        httpStatus: err?.response?.status,
        responseData: err?.response?.data
      });
      return [];
    }
  }

  async getAnimeInfo(id: string): Promise<AnyObject | null> {
    try {
      const url = `${this.base}/anime/${encodeURIComponent(id)}`;
      const res = await axios.get(url, { timeout: 12000 });
      return (res?.data as AnyObject) ?? null;
    } catch {
      return null;
    }
  }

  async getEpisodes(id: string): Promise<any[]> {
    try {
      const url = `${this.base}/episodes/${encodeURIComponent(id)}`;
      const res = await axios.get(url, { timeout: 12000 });
      const data = res?.data;
      const list: any[] = Array.isArray(data) ? data : Array.isArray(data?.episodes) ? data.episodes : Array.isArray(data?.data) ? data.data : [];
      return list;
    } catch {
      return [];
    }
  }

  async getLanguages(id: string): Promise<string[] | null> {
    try {
      const url = `${this.base}/languages/${encodeURIComponent(id)}`;
      const res = await axios.get(url, { timeout: 12000 });
      const data = res?.data;
      const langs: any[] = Array.isArray(data) ? data : Array.isArray(data?.languages) ? data.languages : Array.isArray(data?.data) ? data.data : [];
      return langs.map((x) => String(x)).filter(Boolean);
    } catch {
      return null;
    }
  }

  async getWatchDataByTitle(title: string, episode: number): Promise<WatchResponse> {
    console.log(`🎬 [ANIMEZONE] Getting watch data for title: "${title}", episode: ${episode}`);
    
    // Try multiple search variations for better results
    let results = await this.searchAnime(title);
    let id = results[0]?.id;
    
    // If first search fails, try alternative search terms
    if (!id && title.includes(':')) {
      const alternativeTitle = title.split(':')[0].trim();
      console.log(`🔄 [ANIMEZONE] Trying alternative title: "${alternativeTitle}"`);
      results = await this.searchAnime(alternativeTitle);
      id = results[0]?.id;
    }
    
    // If still no results, try removing common suffixes
    if (!id && title.includes('Kimetsu no Yaiba')) {
      console.log(`🔄 [ANIMEZONE] Trying simplified title: "Demon Slayer"`);
      results = await this.searchAnime('Demon Slayer');
      id = results[0]?.id;
    }
    
    // If still no results, try Japanese title
    if (!id && title.includes('Demon Slayer')) {
      console.log(`🔄 [ANIMEZONE] Trying Japanese title: "Kimetsu no Yaiba"`);
      results = await this.searchAnime('Kimetsu no Yaiba');
      id = results[0]?.id;
    }
    
    if (!id) {
      console.log(`❌ [ANIMEZONE] No ID found for title: "${title}" after trying variations`);
      return { sources: [], subtitles: [] };
    }
    
    console.log(`✅ [ANIMEZONE] Found ID: ${id} for title: "${title}"`);
    return this.getWatchData(id, episode);
  }

  async getWatchData(id: string, episode: number): Promise<WatchResponse> {
    try {
      console.warn(`⚠️ [ANIMEZONE] WARNING: This is a new API being worked on. Some anime may work while others may not work properly.`);
      const url = `${this.base}/stream/${encodeURIComponent(id)}/${encodeURIComponent(String(episode))}`;
      console.log(`📡 [ANIMEZONE] Streaming URL: ${url}`);
      const res = await axios.get(url, { timeout: 15000 });
      const data: AnyObject = res?.data ?? {};

      console.log(`📊 [ANIMEZONE] Stream response:`, {
        success: data?.success,
        hasData: !!data?.data,
        hasServers: !!data?.data?.servers,
        serverCount: data?.data?.servers?.length || 0
      });

      // The API returns { data: { servers: [...] } } format
      const rawSources: any[] = Array.isArray(data?.data?.servers)
        ? data.data.servers
        : Array.isArray(data?.servers)
        ? data.servers
        : Array.isArray(data)
        ? data
        : [];

      console.log(`📊 [ANIMEZONE] Raw servers from API:`, rawSources.map(s => ({
        name: s?.name,
        dubType: s?.dubType,
        language: s?.language
      })));

      const headers: Record<string, string> = (data?.headers || data?.data?.headers || {}) as Record<string, string>;
      const subtitleArr: any[] = Array.isArray(data?.subtitles)
        ? data.subtitles
        : Array.isArray(data?.data?.subtitles)
        ? data.data.subtitles
        : [];

      const sources: Source[] = rawSources
        .map((s: AnyObject) => {
          const urlStr = s?.url ?? s?.file ?? s?.src ?? '';
          if (!urlStr) return null;
          
          // Map server properties to Source format
          const quality: string = s?.quality ?? s?.name ?? s?.label ?? 'default';
          const audioType = s?.dubType === 'DUB' ? 'dub' : 'sub';
          
          console.log(`📝 [ANIMEZONE] Processing server:`, {
            name: s?.name,
            quality,
            url: urlStr.substring(0, 50) + '...',
            dubType: s?.dubType,
            mappedType: audioType
          });
          
          return {
            url: urlStr,
            quality,
            type: audioType,
            headers: headers || {},
            isM3U8: typeof urlStr === 'string' && urlStr.includes('.m3u8'),
            name: s?.name, // Preserve the server name for display
          } as Source;
        })
        .filter(Boolean) as Source[];

      // Extract subtitles from server data if available
      const subtitles: Subtitle[] = [];
      rawSources.forEach((server: AnyObject) => {
        if (server?.subtitleLanguages && Array.isArray(server.subtitleLanguages)) {
          server.subtitleLanguages.forEach((lang: string) => {
            // Create subtitle entry for each language
            subtitles.push({
              url: '', // The API doesn't provide separate subtitle URLs
              lang: String(lang)
            });
          });
        }
      });

      console.log(`🎞️ [ANIMEZONE] Extracted subtitles:`, subtitles);

      return { sources, subtitles, headers };
    } catch (err) {
      return { sources: [], subtitles: [] };
    }
  }

  /**
   * Test the API endpoint to see what structure it returns
   */
  async testAPI(): Promise<void> {
    try {
      console.log(`🧪 [ANIMEZONE] Testing API endpoint...`);
      
      // Test with a simple search
      const testUrl = `${this.base}/search?q=test`;
      console.log(`🧪 [ANIMEZONE] Test URL: ${testUrl}`);
      
      const res = await axios.get(testUrl, { timeout: 15000 });
      console.log(`🧪 [ANIMEZONE] Test response status: ${res.status}`);
      console.log(`🧪 [ANIMEZONE] Test response data:`, JSON.stringify(res.data, null, 2));
      
      // Test with Demon Slayer specifically
      const demonSlayerUrl = `${this.base}/search?q=demon%20slayer`;
      console.log(`🧪 [ANIMEZONE] Testing Demon Slayer search: ${demonSlayerUrl}`);
      
      try {
        const demonRes = await axios.get(demonSlayerUrl, { timeout: 15000 });
        console.log(`🧪 [ANIMEZONE] Demon Slayer search status: ${demonRes.status}`);
        console.log(`🧪 [ANIMEZONE] Demon Slayer response structure:`, {
          hasData: !!demonRes.data?.data,
          hasResults: !!demonRes.data?.data?.results,
          resultsCount: demonRes.data?.data?.results?.length || 0,
          firstResult: demonRes.data?.data?.results?.[0]
        });
        
        if (demonRes.data?.data?.results?.[0]?.id) {
          const testId = demonRes.data.data.results[0].id;
          console.log(`🧪 [ANIMEZONE] Testing stream endpoint with ID: ${testId}`);
          
          const streamUrl = `${this.base}/stream/${testId}/1`;
          const streamRes = await axios.get(streamUrl, { timeout: 15000 });
          console.log(`🧪 [ANIMEZONE] Stream test status: ${streamRes.status}`);
          console.log(`🧪 [ANIMEZONE] Stream test data:`, JSON.stringify(streamRes.data, null, 2));
        }
      } catch (demonErr) {
        console.log(`🧪 [ANIMEZONE] Demon Slayer test failed:`, (demonErr as any)?.message);
      }
      
      // Also test the base endpoint
      const baseUrl = `${this.base}`;
      console.log(`🧪 [ANIMEZONE] Testing base URL: ${baseUrl}`);
      
      try {
        const baseRes = await axios.get(baseUrl, { timeout: 15000 });
        console.log(`🧪 [ANIMEZONE] Base response status: ${baseRes.status}`);
        console.log(`🧪 [ANIMEZONE] Base response data:`, JSON.stringify(baseRes.data, null, 2));
      } catch (baseErr) {
        console.log(`🧪 [ANIMEZONE] Base endpoint failed:`, (baseErr as any)?.message);
      }
      
    } catch (err: any) {
      console.error(`🧪 [ANIMEZONE] API test failed:`, {
        errorMessage: err?.message,
        errorCode: err?.code,
        httpStatus: err?.response?.status,
        responseData: err?.response?.data
      });
    }
  }

  /**
   * Smart search that tries multiple title variations to find the best match
   */
  async smartSearch(title: string, anilistId?: string): Promise<Array<{ id: string; title?: string; anilistId?: string }>> {
    console.warn(`⚠️ [ANIMEZONE] WARNING: This is a new API being worked on. Some anime may work while others may not work properly.`);
    console.log(`🧠 [ANIMEZONE] Smart search for: "${title}"${anilistId ? ` (AniList ID: ${anilistId})` : ''}`);
    
    // Try original title first (with AniList ID if available)
    let results = await this.searchAnime(title, anilistId);
    if (results.length > 0) {
      console.log(`✅ [ANIMEZONE] Smart search found ${results.length} results with original title`);
      return results;
    }
    
    // Try alternative variations
    const variations = [];
    
    // Remove subtitle after colon
    if (title.includes(':')) {
      variations.push(title.split(':')[0].trim());
    }
    
    // Try common alternative names
    if (title.includes('Kimetsu no Yaiba')) {
      variations.push('Demon Slayer');
      variations.push('Kimetsu no Yaiba');
    }
    
    if (title.includes('Demon Slayer')) {
      variations.push('Kimetsu no Yaiba');
    }
    
    // Try each variation
    for (const variation of variations) {
      console.log(`🔄 [ANIMEZONE] Trying variation: "${variation}"`);
      results = await this.searchAnime(variation, anilistId);
      if (results.length > 0) {
        console.log(`✅ [ANIMEZONE] Smart search found ${results.length} results with variation: "${variation}"`);
        return results;
      }
    }
    
    console.log(`❌ [ANIMEZONE] Smart search failed for all variations of: "${title}"`);
    
    // Test the API to see what's happening
    console.log(`🧪 [ANIMEZONE] Running API test to debug the issue...`);
    await this.testAPI();
    
    return [];
  }
}

export const animeZoneProvider = new AnimeZoneProvider();


