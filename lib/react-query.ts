import { QueryClient, QueryClientProvider, useQuery, useMutation, useInfiniteQuery } from '@tanstack/react-query';
import * as SecureStore from 'expo-secure-store';
import { STORAGE_KEY } from '../constants/auth';
import { fetchExplorePageSections, getExploreFeed } from '../api/anilist/queries';

// Create a client with optimal settings for mobile
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // 24 hours for static data like trending, birthdays
      staleTime: 24 * 60 * 60 * 1000,
      // 5 minutes for user-specific data
      gcTime: 5 * 60 * 1000,
      // Retry failed requests 3 times
      retry: 3,
      // Retry with exponential backoff
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      // Refetch on window focus for fresh data
      refetchOnWindowFocus: true,
      // Don't refetch on mount if data is fresh
      refetchOnMount: false,
      // Enable background updates
      refetchOnReconnect: true,
      // Network mode for offline support
      networkMode: 'offlineFirst',
    },
    mutations: {
      // Retry mutations once
      retry: 1,
      // Network mode for mutations
      networkMode: 'online',
    },
  },
});

// Query Keys factory for consistency
export const queryKeys = {
  // Explore page data
  explorePageSections: (userId?: number | null, showAdultContent?: boolean) => 
    ['explorePageSections', userId, showAdultContent],
  
  // Individual sections
  trendingAnime: (perPage?: number, isAdult?: boolean) => 
    ['trendingAnime', perPage, isAdult],
  
  airingSchedule: (days?: number) => 
    ['airingSchedule', days],
  
  birthdays: (perPage?: number) => 
    ['birthdays', perPage],
  
  continueWatching: (userId?: number) => 
    ['continueWatching', userId],
  
  friendWatching: (friendIds?: number[]) => 
    ['friendWatching', friendIds],
  
  popularNow: (perPage?: number) => 
    ['popularNow', perPage],
  
  genreRecommendations: (userId?: number, genres?: string[], perPage?: number) => 
    ['genreRecommendations', userId, genres, perPage],
  
  socialActivity: (userId?: number, perPage?: number) => 
    ['socialActivity', userId, perPage],
  
  userGenreStats: (userId?: number) => 
    ['userGenreStats', userId],
  
  // Anime specific data
  animeDetails: (id: number) => 
    ['animeDetails', id],
  
  // User data
  userProfile: (userId?: number) => 
    ['userProfile', userId],
  
  // Search
  animeSearch: (query: string, page?: number) => 
    ['animeSearch', query, page],
};

// Cache time configurations
export const cacheTime = {
  // Static data - 24 hours
  static: 24 * 60 * 60 * 1000,
  // User data - 5 minutes
  user: 5 * 60 * 1000,
  // Airing schedule - 12 hours
  airing: 12 * 60 * 60 * 1000,
  // Search results - 10 minutes
  search: 10 * 60 * 1000,
  // Trending data - 1 hour
  trending: 60 * 60 * 1000,
};

// Stale time configurations
export const staleTime = {
  // Static data - 12 hours
  static: 12 * 60 * 60 * 1000,
  // User data - 2 minutes
  user: 2 * 60 * 1000,
  // Airing schedule - 6 hours
  airing: 6 * 60 * 60 * 1000,
  // Search results - 5 minutes
  search: 5 * 60 * 1000,
  // Trending data - 30 minutes
  trending: 30 * 60 * 1000,
};

// Hook for getting user ID
export const useUserId = () => {
  return useQuery({
    queryKey: ['userId'],
    queryFn: async () => {
      const userId = await SecureStore.getItemAsync(STORAGE_KEY.USER_ID);
      return userId ? parseInt(userId) : null;
    },
    staleTime: staleTime.user,
    gcTime: cacheTime.user,
  });
};

// Main explore page sections hook
export const useExplorePageSections = (userId?: number, showAdultContent: boolean = false) => {
  return useQuery({
    queryKey: ['explorePageSections', userId, showAdultContent],
    queryFn: () => fetchExplorePageSections(userId, showAdultContent),
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 10, // 10 minutes
    enabled: true,
    refetchOnWindowFocus: false,
    retry: 2
  });
};

// New TikTok-style explore feed hook
export const useExploreFeed = (userId?: number, showAdultContent: boolean = false) => {
  return useQuery({
    queryKey: ['exploreFeed', userId, showAdultContent],
    queryFn: () => getExploreFeed(userId, showAdultContent),
    staleTime: 1000 * 60 * 2, // 2 minutes - fresher data for TikTok experience
    gcTime: 1000 * 60 * 5, // 5 minutes
    enabled: true,
    refetchOnWindowFocus: true, // Refresh when user comes back to app
    retry: 2
  });
};

// Mutation for updating user preferences
export const useUpdateUserPreferences = () => {
  return useMutation({
    mutationFn: async (preferences: any) => {
      // Update user preferences logic
      await SecureStore.setItemAsync(STORAGE_KEY.USER_PREFERENCES, JSON.stringify(preferences));
      return preferences;
    },
    onSuccess: () => {
      // Invalidate and refetch related queries
      queryClient.invalidateQueries({ queryKey: ['userPreferences'] });
    },
  });
};

// Mutation for auth token updates
export const useUpdateAuthToken = () => {
  return useMutation({
    mutationFn: async (token: string) => {
      await SecureStore.setItemAsync(STORAGE_KEY.AUTH_TOKEN, token);
      return token;
    },
    onSuccess: () => {
      // Invalidate all user-related queries
      queryClient.invalidateQueries({ queryKey: ['userId'] });
      queryClient.invalidateQueries({ queryKey: ['continueWatching'] });
      queryClient.invalidateQueries({ queryKey: ['socialActivity'] });
      queryClient.invalidateQueries({ queryKey: ['userGenreStats'] });
    },
  });
};

// Error boundary for query errors
export const handleQueryError = (error: any) => {
  console.error('Query error:', error);
  
  // Handle specific error types
  if (error?.response?.status === 401) {
    // Handle auth error
    console.log('Authentication error, redirecting to login...');
    // You might want to clear tokens and redirect to login
  } else if (error?.response?.status === 429) {
    // Handle rate limiting
    console.log('Rate limited, backing off...');
  } else if (error?.code === 'NETWORK_ERROR') {
    // Handle network errors
    console.log('Network error, using cached data...');
  }
};

// Prefetch function for preloading data
export const prefetchExplorePageSections = async (userId?: number, showAdultContent?: boolean) => {
  await queryClient.prefetchQuery({
    queryKey: queryKeys.explorePageSections(userId, showAdultContent),
    queryFn: () => fetchExplorePageSections(userId, showAdultContent),
    staleTime: staleTime.trending,
  });
};

// Helper function to get cached data
export const getCachedExplorePageSections = (userId?: number, showAdultContent?: boolean) => {
  return queryClient.getQueryData(queryKeys.explorePageSections(userId, showAdultContent));
};

// Helper function to invalidate all explore page data
export const invalidateExplorePageSections = () => {
  queryClient.invalidateQueries({ queryKey: ['explorePageSections'] });
};

// Performance optimization: Background refetch
export const enableBackgroundRefetch = () => {
  const interval = setInterval(() => {
    // Refetch trending data every 30 minutes in background
    queryClient.refetchQueries({ 
      queryKey: ['trendingAnime'],
      type: 'active' 
    });
    
    // Refetch airing schedule every hour
    queryClient.refetchQueries({ 
      queryKey: ['airingSchedule'],
      type: 'active' 
    });
  }, 30 * 60 * 1000); // 30 minutes
  
  return () => clearInterval(interval);
};

export default queryClient; 