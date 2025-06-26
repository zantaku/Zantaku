import axios, { AxiosResponse, AxiosError } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { TAKIAPI_URL, MAGAAPI_URL, JELLEE_API_URL, API_CONFIG } from '../app/constants/api';

interface ApiEndpointStatus {
  url: string;
  type: 'anime' | 'manga' | 'unified';
  isHealthy: boolean;
  lastChecked: number;
  responseTime: number;
  failureCount: number;
  successRate: number;
}

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  endpoint?: string;
  retries?: number;
  cacheHit?: boolean;
}

// ===== HIGH TRAFFIC OPTIMIZATION FOR 3 REAL APIs =====
class RobustApiClient {
  private endpointStatus: Map<string, ApiEndpointStatus> = new Map();
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private requestQueue: Array<() => Promise<any>> = [];
  private activeRequests = 0;
  private lastRequestTime = 0;
  private requestCache = new Map<string, { data: any; timestamp: number }>();
  
  // Conservative settings for high traffic
  private readonly MAX_CONCURRENT_REQUESTS = API_CONFIG.MAX_CONCURRENT_REQUESTS; // 2 from config
  private readonly RATE_LIMIT_DELAY = API_CONFIG.REQUEST_INTERVAL; // 1.5 seconds from config
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes cache

  constructor() {
    this.initializeEndpoints();
    this.startHealthMonitoring();
  }

  private initializeEndpoints() {
    // Initialize the 3 real API endpoints
    const endpoints = [
      { url: TAKIAPI_URL, type: 'anime' as const },
      { url: MAGAAPI_URL, type: 'manga' as const },
      { url: JELLEE_API_URL, type: 'unified' as const }
    ];

    endpoints.forEach(({ url, type }) => {
      this.endpointStatus.set(url, {
        url,
        type,
        isHealthy: true,
        lastChecked: 0,
        responseTime: 0,
        failureCount: 0,
        successRate: 100
      });
    });
    
    console.log('[RobustApiClient] Initialized 3 real API endpoints for high traffic optimization');
  }

  private startHealthMonitoring() {
    // Check endpoint health every 5 minutes
    this.healthCheckInterval = setInterval(async () => {
      await this.performHealthChecks();
    }, 5 * 60 * 1000);
  }

  private async performHealthChecks() {
    console.log('[RobustApiClient] Performing health checks...');
    
    const healthPromises = Array.from(this.endpointStatus.keys()).map(async (endpoint) => {
      try {
        const startTime = Date.now();
        await axios.get(`${endpoint}/health`, {
          timeout: 5000,
          headers: {
            'User-Agent': 'Kamilist-App/1.0.0',
            'Accept': 'application/json'
          }
        });
        const responseTime = Date.now() - startTime;

        this.updateEndpointStatus(endpoint, true, responseTime, 0);
      } catch (error) {
        this.updateEndpointStatus(endpoint, false, 0, 1);
      }
    });

    await Promise.allSettled(healthPromises);
    console.log('[RobustApiClient] Health checks completed');
  }

  private updateEndpointStatus(
    endpoint: string, 
    isHealthy: boolean, 
    responseTime: number, 
    failureIncrement: number
  ) {
    const status = this.endpointStatus.get(endpoint);
    if (status) {
      status.isHealthy = isHealthy;
      status.lastChecked = Date.now();
      status.responseTime = responseTime;
      status.failureCount = isHealthy ? 0 : status.failureCount + failureIncrement;
      
      // Calculate success rate based on recent history
      const historyKey = `api_history_${endpoint.replace(/[^a-zA-Z0-9]/g, '_')}`;
      AsyncStorage.getItem(historyKey).then(history => {
        const checks = history ? JSON.parse(history) : [];
        
        // Add current check
        checks.push({
          timestamp: Date.now(),
          success: isHealthy,
          responseTime
        });
        
        // Keep only last 20 checks
        const recentChecks = checks.slice(-20);
        AsyncStorage.setItem(historyKey, JSON.stringify(recentChecks));
        
        // Calculate success rate
        const successCount = recentChecks.filter((check: any) => check.success).length;
        status.successRate = (successCount / recentChecks.length) * 100;
      });
      
      // Mark as unhealthy if too many failures
      if (status.failureCount >= 3) {
        status.isHealthy = false;
      }
    }
  }

  private getHealthyEndpoints(type: 'anime' | 'manga' | 'unified'): string[] {
    // Get all endpoints that match the requested type
    const endpoints = Array.from(this.endpointStatus.values())
      .filter(status => type === 'unified' || status.type === type)
      .filter(status => status.isHealthy !== false)
      .sort((a, b) => {
        // Sort by success rate first, then response time
        if (a.successRate !== b.successRate) {
          return b.successRate - a.successRate;
        }
        return (a.responseTime || 9999) - (b.responseTime || 9999);
      })
      .map(status => status.url);

    return endpoints;
  }

  private async makeRequestWithFallback<T>(
    path: string,
    type: 'anime' | 'manga' | 'unified',
    options: any = {}
  ): Promise<ApiResponse<T>> {
    // Check cache first
    const cacheKey = `${type}_${path}_${JSON.stringify(options)}`;
    const cached = this.requestCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      console.log(`[RobustApiClient] Cache hit for ${path}`);
      return {
        success: true,
        data: cached.data,
        cacheHit: true
      };
    }

    const healthyEndpoints = this.getHealthyEndpoints(type);
    
    if (healthyEndpoints.length === 0) {
      console.warn('[RobustApiClient] No healthy endpoints available, trying all endpoints...');
      const allEndpoints = [TAKIAPI_URL, MAGAAPI_URL, JELLEE_API_URL];
      healthyEndpoints.push(...allEndpoints);
    }

    let lastError: any;
    let retryCount = 0;

    for (const endpoint of healthyEndpoints) {
      try {
        // Rate limiting check
        if (this.activeRequests >= API_CONFIG.MAX_CONCURRENT_REQUESTS) {
          await this.waitForSlot();
        }

        this.activeRequests++;
        
        const fullUrl = `${endpoint}${path}`;
        console.log(`[RobustApiClient] Trying endpoint: ${endpoint}`);

        const response = await axios.get(fullUrl, {
          timeout: API_CONFIG.TIMEOUT,
          headers: {
            'User-Agent': 'Kamilist-App/1.0.0',
            'Accept': 'application/json',
            'Referer': endpoint,
            ...options.headers
          },
          ...options
        });

        this.activeRequests--;
        this.updateEndpointStatus(endpoint, true, 0, 0);

        // Cache successful response
        const cacheKey = `${type}_${path}_${JSON.stringify(options)}`;
        this.requestCache.set(cacheKey, {
          data: response.data,
          timestamp: Date.now()
        });

        // Clean old cache entries (keep cache size manageable)
        if (this.requestCache.size > 100) {
          const entries = Array.from(this.requestCache.entries());
          const oldestEntries = entries
            .sort((a, b) => a[1].timestamp - b[1].timestamp)
            .slice(0, 20);
          oldestEntries.forEach(([key]) => this.requestCache.delete(key));
        }

        return {
          success: true,
          data: response.data,
          endpoint,
          retries: retryCount
        };

      } catch (error: any) {
        this.activeRequests--;
        lastError = error;
        retryCount++;

        console.log(`[RobustApiClient] Endpoint ${endpoint} failed:`, error.message);

        // Handle rate limiting
        if (error.response?.status === 429) {
          console.log('[RobustApiClient] Rate limited, waiting...');
          await this.sleep(API_CONFIG.RATE_LIMIT_DELAY);
          continue;
        }

        // Mark endpoint as potentially unhealthy
        this.updateEndpointStatus(endpoint, false, 0, 1);

        // Add exponential backoff for network errors
        if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
          await this.sleep(API_CONFIG.RETRY_DELAY * Math.pow(2, retryCount - 1));
        }
      }
    }

    return {
      success: false,
      error: lastError?.message || 'All endpoints failed',
      retries: retryCount
    };
  }

  private async waitForSlot(): Promise<void> {
    return new Promise((resolve) => {
      const checkSlot = () => {
        if (this.activeRequests < API_CONFIG.MAX_CONCURRENT_REQUESTS) {
          resolve();
        } else {
          setTimeout(checkSlot, 100);
        }
      };
      checkSlot();
    });
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Public API methods for the 3 real APIs
  async fetchAnimeData<T>(path: string, options: any = {}): Promise<ApiResponse<T>> {
    return this.makeRequestWithFallback<T>(path, 'anime', options);
  }

  async fetchMangaData<T>(path: string, options: any = {}): Promise<ApiResponse<T>> {
    return this.makeRequestWithFallback<T>(path, 'manga', options);
  }

  async fetchUnifiedData<T>(path: string, options: any = {}): Promise<ApiResponse<T>> {
    return this.makeRequestWithFallback<T>(path, 'unified', options);
  }

  // Legacy methods for backward compatibility
  async fetchConsumentData<T>(path: string, options: any = {}): Promise<ApiResponse<T>> {
    return this.fetchAnimeData<T>(path, options);
  }

  async fetchKatanaData<T>(path: string, options: any = {}): Promise<ApiResponse<T>> {
    return this.fetchMangaData<T>(path, options);
  }

  // Get current endpoint status for debugging
  getEndpointStatus(): Map<string, ApiEndpointStatus> {
    return new Map(this.endpointStatus);
  }

  // Manual health check
  async checkHealth(): Promise<void> {
    await this.performHealthChecks();
  }

  // Cleanup method
  destroy() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }
}

// Export a singleton instance
export const robustApiClient = new RobustApiClient();
export default robustApiClient; 