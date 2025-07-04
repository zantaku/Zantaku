import ENV from '../config';

export const ANILIST_CLIENT_ID = ENV.ANILIST_CLIENT_ID;
export const ANILIST_CLIENT_SECRET = ENV.ANILIST_CLIENT_SECRET;
export const ANILIST_AUTH_ENDPOINT = 'https://anilist.co/api/v2/oauth/authorize';
export const ANILIST_TOKEN_ENDPOINT = 'https://anilist.co/api/v2/oauth/token';
export const ANILIST_GRAPHQL_ENDPOINT = 'https://graphql.anilist.co';
export const ANILIST_REDIRECT_URI = ENV.ANILIST_REDIRECT_URI;

// Development environment constants
export const ANILIST_DEV_CLIENT_ID = ENV.DEV_ANILIST_CLIENT_ID;
export const ANILIST_DEV_CLIENT_SECRET = ENV.DEV_ANILIST_CLIENT_SECRET;
export const ANILIST_DEV_REDIRECT_URI = ENV.DEV_ANILIST_REDIRECT_URI;

export const MAL_API_ENDPOINT = 'https://api.myanimelist.net/v2';

export const STORAGE_KEY = {
  AUTH_TOKEN: 'auth_token',
  REFRESH_TOKEN: 'refresh_token',
  USER_DATA: 'user_data',
  USER_ID: 'user_id',
  USER_PROFILE: 'user_profile',
  TOKEN_EXPIRATION: 'token_expiration',
  TOKEN_METADATA: 'token_metadata',
  PKCE_VERIFIER: 'pkce_verifier',
  USER_PREFERENCES: 'user_preferences',
  MAL_TOKEN: 'mal_token',
  HOME_SECTIONS: 'home_sections',
} as const; 