// ===== REAL API ENDPOINTS ONLY =====
// These are the only 3 APIs actually available
export const TAKIAPI_URL = 'https://takiapi.xyz';
export const MAGAAPI_URL = 'https://magaapinovel.xyz';
export const JELLEE_API_URL = 'https://jelleeapi.app';

// Legacy compatibility
export const API_BASE_URL = 'https://kamicom-dazaseals-projects.vercel.app/anime/gogoanime';
export const JIKAN_API_ENDPOINT = 'https://api.jikan.moe/v4';
export const CONSUMET_API_URL = TAKIAPI_URL;

export const YOUTUBE_API_KEY = 'AIzaSyBclGtotWp7P8OdThs929Hlpl3SVnm_0TU';

// ===== HIGH TRAFFIC OPTIMIZATION =====
// Aggressive settings for 3 APIs handling high traffic
export const API_CONFIG = {
  TIMEOUT: 12000, // 12 seconds - longer for high traffic
  RETRY_ATTEMPTS: 2, // Fewer retries to reduce load
  RETRY_DELAY: 3000, // 3 second delay between retries
  RATE_LIMIT_DELAY: 2500, // 2.5 seconds for rate limit backoff
  MAX_CONCURRENT_REQUESTS: 2, // Very conservative - only 2 concurrent
  REQUEST_INTERVAL: 1500, // 1.5 seconds between requests
  CONNECTION_TIMEOUT: 8000, // 8 second connection timeout
  READ_TIMEOUT: 15000 // 15 second read timeout for large responses
};

// API Health Check URLs
export const API_HEALTH_ENDPOINTS = {
  TAKIAPI_HEALTH: `${TAKIAPI_URL}/health`,
  MAGAAPI_HEALTH: `${MAGAAPI_URL}/health`,
  JELLEE_HEALTH: `${JELLEE_API_URL}/health`
};

// Available servers for video sources
export const VIDEO_SERVERS = {
  VIDSTREAMING: 'vidstreaming',
  STREAMTAPE: 'streamtape',
  VIDCLOUD: 'vidcloud'
} as const;

// Available video qualities
export const VIDEO_QUALITIES = {
  AUTO: 'auto',
  '1080P': '1080p',
  '720P': '720p',
  '480P': '480p',
  '360P': '360p'
} as const; 