export const API_BASE_URL = 'https://kamicom-dazaseals-projects.vercel.app/anime/gogoanime';
export const JIKAN_API_ENDPOINT = 'https://api.jikan.moe/v4';
export const CONSUMET_API_URL = 'https://takiapi.xyz';
export const YOUTUBE_API_KEY = 'AIzaSyBclGtotWp7P8OdThs929Hlpl3SVnm_0TU';

// Define backup URLs for Katana in case the main one fails
export const KATANA_API_URLS = {
  PRIMARY: 'https://magaapinovel.xyz',
  FALLBACK: 'https://takiapi.xyz/manga'
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