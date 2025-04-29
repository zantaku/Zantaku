import { differenceInHours, differenceInDays, isWithinInterval, subDays, isWeekend, parseISO } from 'date-fns';
import { supabase } from '../lib/supabase';
import * as SecureStore from 'expo-secure-store';
import { STORAGE_KEY } from '../constants/auth';

// Types for AniList API responses
interface MediaTitle {
  romaji: string;
  english?: string;
  native?: string;
  userPreferred?: string;
}

interface Media {
  id: number;
  episodes?: number;
  chapters?: number;
  title: MediaTitle;
  type: 'ANIME' | 'MANGA';
}

interface DatePart {
  year?: number;
  month?: number;
  day?: number;
}

interface MediaListEntry {
  media: Media;
  status: string;
  progress: number;
  completedAt: DatePart;
  updatedAt: number; // Unix timestamp
  startedAt: DatePart;
}

interface MediaListCollection {
  lists: {
    name: string;
    entries: MediaListEntry[];
  }[];
}

interface UserActivityData {
  anime: MediaListEntry[];
  manga: MediaListEntry[];
  recentAnime: MediaListEntry[]; // Last 7 days
  recentManga: MediaListEntry[]; // Last 7 days
  completedLastMonth: {
    anime: MediaListEntry[];
    manga: MediaListEntry[];
  };
  lastWeekendActivity: {
    anime: MediaListEntry[];
    manga: MediaListEntry[];
  };
  last48HoursActivity: {
    anime: MediaListEntry[];
    manga: MediaListEntry[];
  };
  last24HoursActivity: {
    anime: MediaListEntry[];
    manga: MediaListEntry[];
  };
}

// Main function to fetch user activity from AniList
export async function getUserWeeklyActivity(userId: number): Promise<UserActivityData | null> {
  try {
    console.log('Fetching user activity for userId:', userId);
    
    // Get auth token
    const token = await SecureStore.getItemAsync(STORAGE_KEY.AUTH_TOKEN);
    if (!token) {
      console.error('No auth token found');
      return null;
    }
    
    // Fetch anime activity
    const animeData = await fetchMediaListCollection(userId, 'ANIME', token);
    
    // Fetch manga activity
    const mangaData = await fetchMediaListCollection(userId, 'MANGA', token);
    
    if (!animeData || !mangaData) {
      console.error('Failed to fetch media list collections');
      return null;
    }
    
    // Extract all entries
    const allAnimeEntries = animeData.lists.flatMap(list => list.entries);
    const allMangaEntries = mangaData.lists.flatMap(list => list.entries);
    
    // Current date reference
    const now = new Date();
    const oneWeekAgo = subDays(now, 7);
    const oneMonthAgo = subDays(now, 30);
    const yesterday = subDays(now, 1);
    const twoDaysAgo = subDays(now, 2);
    
    // Filter for recent activity (last 7 days)
    const recentAnimeEntries = filterRecentEntries(allAnimeEntries, oneWeekAgo);
    const recentMangaEntries = filterRecentEntries(allMangaEntries, oneWeekAgo);
    
    // Filter for last month completed
    const completedLastMonthAnime = filterCompletedInTimeRange(allAnimeEntries, oneMonthAgo, now);
    const completedLastMonthManga = filterCompletedInTimeRange(allMangaEntries, oneMonthAgo, now);
    
    // Filter for weekend activity
    const lastWeekendAnimeActivity = filterWeekendActivity(allAnimeEntries);
    const lastWeekendMangaActivity = filterWeekendActivity(allMangaEntries);
    
    // Filter for last 48 hours activity
    const last48HoursAnimeActivity = filterRecentEntries(allAnimeEntries, twoDaysAgo);
    const last48HoursMangaActivity = filterRecentEntries(allMangaEntries, twoDaysAgo);
    
    // Filter for last 24 hours activity
    const last24HoursAnimeActivity = filterRecentEntries(allAnimeEntries, yesterday);
    const last24HoursMangaActivity = filterRecentEntries(allMangaEntries, yesterday);
    
    return {
      anime: allAnimeEntries,
      manga: allMangaEntries,
      recentAnime: recentAnimeEntries,
      recentManga: recentMangaEntries,
      completedLastMonth: {
        anime: completedLastMonthAnime,
        manga: completedLastMonthManga,
      },
      lastWeekendActivity: {
        anime: lastWeekendAnimeActivity,
        manga: lastWeekendMangaActivity,
      },
      last48HoursActivity: {
        anime: last48HoursAnimeActivity,
        manga: last48HoursMangaActivity,
      },
      last24HoursActivity: {
        anime: last24HoursAnimeActivity,
        manga: last24HoursMangaActivity,
      }
    };
  } catch (error) {
    console.error('Error fetching user activity:', error);
    return null;
  }
}

// Helper function to fetch media list collection from AniList
async function fetchMediaListCollection(userId: number, type: 'ANIME' | 'MANGA', token: string): Promise<MediaListCollection | null> {
  try {
    const query = `
      query ($userId: Int, $type: MediaType) {
        MediaListCollection(userId: $userId, type: $type) {
          lists {
            name
            entries {
              media {
                id
                episodes
                chapters
                title {
                  romaji
                  english
                  native
                  userPreferred
                }
                type
              }
              status
              progress
              completedAt {
                year
                month
                day
              }
              updatedAt
              startedAt {
                year
                month
                day
              }
            }
          }
        }
      }
    `;
    
    const variables = {
      userId,
      type
    };
    
    const response = await fetch('https://graphql.anilist.co', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        query,
        variables
      })
    });
    
    if (!response.ok) {
      throw new Error(`AniList API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.errors) {
      console.error('GraphQL errors:', data.errors);
      return null;
    }
    
    return data.data?.MediaListCollection || null;
  } catch (error) {
    console.error(`Error fetching ${type} list collection:`, error);
    return null;
  }
}

// Helper functions to filter entries by time
function filterRecentEntries(entries: MediaListEntry[], fromDate: Date): MediaListEntry[] {
  return entries.filter(entry => {
    // Use updatedAt as the primary timestamp
    const updatedDate = new Date(entry.updatedAt * 1000); // Convert UNIX timestamp to Date
    
    // Also check completedAt if available
    let isRecentlyCompleted = false;
    if (entry.completedAt?.year) {
      const { year, month, day } = entry.completedAt;
      if (year && month && day) {
        const completedDate = new Date(year, month - 1, day); // Month is 0-indexed in JS Date
        isRecentlyCompleted = completedDate >= fromDate;
      }
    }
    
    return updatedDate >= fromDate || isRecentlyCompleted;
  });
}

// Filter entries completed within a specific time range
function filterCompletedInTimeRange(entries: MediaListEntry[], fromDate: Date, toDate: Date): MediaListEntry[] {
  return entries.filter(entry => {
    if (entry.status !== 'COMPLETED' || !entry.completedAt?.year) return false;
    
    const { year, month, day } = entry.completedAt;
    if (!year || !month || !day) return false;
    
    const completedDate = new Date(year, month - 1, day);
    return completedDate >= fromDate && completedDate <= toDate;
  });
}

// Filter entries with activity during weekends
function filterWeekendActivity(entries: MediaListEntry[]): MediaListEntry[] {
  // Get last weekend date range
  const today = new Date();
  const dayOfWeek = today.getDay();
  
  // Calculate days since last weekend
  let daysToLastSaturday: number;
  if (dayOfWeek === 0) { // Sunday
    daysToLastSaturday = 1;
  } else {
    daysToLastSaturday = dayOfWeek + 1; // For Monday(1) through Saturday(6)
  }
  
  const lastSaturday = subDays(today, daysToLastSaturday);
  const lastSunday = subDays(today, daysToLastSaturday - 1);
  
  // Set to beginning/end of day
  lastSaturday.setHours(0, 0, 0, 0);
  lastSunday.setHours(23, 59, 59, 999);
  
  return entries.filter(entry => {
    const updatedDate = new Date(entry.updatedAt * 1000);
    return updatedDate >= lastSaturday && updatedDate <= lastSunday;
  });
}

// Evaluate rewards based on activity data
export async function evaluateRewards(userData: UserActivityData): Promise<string[]> {
  const unlockedRewardIds: string[] = [];
  
  // Get all available rewards from Supabase
  try {
    const { data: allRewards } = await supabase
      .from('rewards')
      .select('*');
    
    if (!allRewards || allRewards.length === 0) {
      console.log('No rewards found in Supabase - this is normal for new users');
      return [];
    }
    
    // Anime Rewards
    
    // 1. Binge Master – 50+ eps/week
    const weeklyEpisodes = userData.recentAnime.reduce((sum, entry) => sum + (entry.progress || 0), 0);
    if (weeklyEpisodes >= 50) {
      const reward = allRewards.find(r => r.name === 'Binge Master');
      if (reward) unlockedRewardIds.push(reward.id);
    }
    
    // 2. Season Slayer – full 12 eps in 48h
    const completedSeasonsIn48h = checkCompletedSeasonsIn48h(userData.last48HoursActivity.anime);
    if (completedSeasonsIn48h) {
      const reward = allRewards.find(r => r.name === 'Season Slayer');
      if (reward) unlockedRewardIds.push(reward.id);
    }
    
    // 3. First Episode Fever – 10 new shows
    const newShowsStarted = countNewShowsStarted(userData.recentAnime);
    if (newShowsStarted >= 10) {
      const reward = allRewards.find(r => r.name === 'First Episode Fever');
      if (reward) unlockedRewardIds.push(reward.id);
    }
    
    // 4. Late Night Otaku – Need special tracking for time of day
    // This would require additional tracking that we don't have in this implementation
    
    // 5. Opening Skipper – Need special tracking for skipped intros
    // This would require additional tracking that we don't have in this implementation
    
    // Manga Rewards
    
    // 1. Power Reader – 100+ ch/week
    const weeklyChapters = userData.recentManga.reduce((sum, entry) => sum + (entry.progress || 0), 0);
    if (weeklyChapters >= 100) {
      const reward = allRewards.find(r => r.name === 'Power Reader');
      if (reward) unlockedRewardIds.push(reward.id);
    }
    
    // 2. Chapter Clutch – 8+ ch in 24h
    const chaptersLast24h = userData.last24HoursActivity.manga.reduce((sum, entry) => sum + (entry.progress || 0), 0);
    if (chaptersLast24h >= 8) {
      const reward = allRewards.find(r => r.name === 'Chapter Clutch');
      if (reward) unlockedRewardIds.push(reward.id);
    }
    
    // 3. Cliffhanger Addict – 3+ ongoing manga
    const ongoingMangaCount = userData.manga.filter(entry => entry.status === 'CURRENT').length;
    if (ongoingMangaCount >= 3) {
      const reward = allRewards.find(r => r.name === 'Cliffhanger Addict');
      if (reward) unlockedRewardIds.push(reward.id);
    }
    
    // 4. Silent Protagonist – Needs tracking for time spent
    // This would require additional tracking that we don't have in this implementation
    
    // Combo Rewards
    
    // 1. Dual Wielder – 20+ eps & 20+ ch/week
    if (weeklyEpisodes >= 20 && weeklyChapters >= 20) {
      const reward = allRewards.find(r => r.name === 'Dual Wielder');
      if (reward) unlockedRewardIds.push(reward.id);
    }
    
    // 2. Otaku Mode: ON – 1000+ mins total
    const totalMinutes = userData.anime.reduce((sum, entry) => {
      // Estimate ~24 mins per episode
      return sum + ((entry.progress || 0) * 24);
    }, 0);
    
    if (totalMinutes >= 1000) {
      const reward = allRewards.find(r => r.name === 'Otaku Mode: ON');
      if (reward) unlockedRewardIds.push(reward.id);
    }
    
    // 3. Multiverse Traveler – watched/read same title
    const hasMultiverseTravel = checkForMultiverseTravel(userData.anime, userData.manga);
    if (hasMultiverseTravel) {
      const reward = allRewards.find(r => r.name === 'Multiverse Traveler');
      if (reward) unlockedRewardIds.push(reward.id);
    }
    
    // 4. Weekend Warrior – 10+ entries in 1 weekend
    const weekendEntries = userData.lastWeekendActivity.anime.length + userData.lastWeekendActivity.manga.length;
    if (weekendEntries >= 10) {
      const reward = allRewards.find(r => r.name === 'Weekend Warrior');
      if (reward) unlockedRewardIds.push(reward.id);
    }
    
    // 5. The Completionist – 1 anime + 1 manga finished in month
    if (userData.completedLastMonth.anime.length >= 1 && userData.completedLastMonth.manga.length >= 1) {
      const reward = allRewards.find(r => r.name === 'The Completionist');
      if (reward) unlockedRewardIds.push(reward.id);
    }
    
    return unlockedRewardIds;
  } catch (error) {
    console.log('Note: Unable to fetch new rewards from Supabase, using existing rewards');
    return [];
  }
}

// Helper for checking Season Slayer criteria
function checkCompletedSeasonsIn48h(animeEntries: MediaListEntry[]): boolean {
  // Group entries by media ID to find unique anime
  const mediaGroups = new Map<number, MediaListEntry[]>();
  
  for (const entry of animeEntries) {
    if (!mediaGroups.has(entry.media.id)) {
      mediaGroups.set(entry.media.id, []);
    }
    mediaGroups.get(entry.media.id)?.push(entry);
  }
  
  // Check each anime group for a completed season
  for (const [mediaId, entries] of mediaGroups) {
    // Sort by updatedAt
    const sortedEntries = [...entries].sort((a, b) => a.updatedAt - b.updatedAt);
    
    if (sortedEntries.length > 0) {
      const latestEntry = sortedEntries[sortedEntries.length - 1];
      
      // Check if latest status is COMPLETED and has ~12+ episodes
      if (latestEntry.status === 'COMPLETED' && 
          latestEntry.media.episodes && 
          latestEntry.media.episodes >= 10 && 
          latestEntry.media.episodes <= 13) {
        // If completed recently, count it
        return true;
      }
    }
  }
  
  return false;
}

// Helper for counting new shows started
function countNewShowsStarted(animeEntries: MediaListEntry[]): number {
  // Get unique media IDs that have progress = 1
  const uniqueFirstEpisodes = new Set<number>();
  
  for (const entry of animeEntries) {
    if (entry.progress === 1) {
      uniqueFirstEpisodes.add(entry.media.id);
    }
  }
  
  return uniqueFirstEpisodes.size;
}

// Helper for Multiverse Traveler check
function checkForMultiverseTravel(animeEntries: MediaListEntry[], mangaEntries: MediaListEntry[]): boolean {
  // Extract titles from both media types
  const animeTitles = new Set(animeEntries.map(entry => 
    entry.media.title.romaji.toLowerCase()
  ));
  
  // Check if any manga titles match anime titles
  for (const mangaEntry of mangaEntries) {
    const mangaTitle = mangaEntry.media.title.romaji.toLowerCase();
    if (animeTitles.has(mangaTitle)) {
      return true;
    }
  }
  
  return false;
}

// Assign rewards to user in Supabase
export async function assignRewardsToUser(userId: string, rewardIds: string[]): Promise<void> {
  if (!userId || rewardIds.length === 0) return;
  
  try {
    console.log(`Assigning ${rewardIds.length} rewards to user ${userId}`);
    
    // First, check which rewards the user already has
    const { data: existingRewards } = await supabase
      .from('user_rewards')
      .select('reward_id')
      .eq('user_id', userId);
    
    const existingRewardIds = new Set(existingRewards?.map(r => r.reward_id) || []);
    
    // Filter out rewards the user already has
    const newRewardIds = rewardIds.filter(id => !existingRewardIds.has(id));
    
    if (newRewardIds.length === 0) {
      console.log('User already has all these rewards');
      return;
    }
    
    // Prepare records for insertion
    const rewardsToInsert = newRewardIds.map(rewardId => ({
      user_id: userId,
      reward_id: rewardId,
      unlocked_at: new Date().toISOString(),
      proof_data: {}
    }));
    
    // Insert new rewards
    const { data, error } = await supabase
      .from('user_rewards')
      .insert(rewardsToInsert);
    
    if (error) {
      console.error('Error assigning rewards:', error);
      return;
    }
    
    console.log(`Successfully assigned ${newRewardIds.length} new rewards to user`);
  } catch (error) {
    console.error('Error in assignRewardsToUser:', error);
  }
}

// Main function to process rewards for a user
export async function processUserRewards(anilistId: number, supabaseUserId: string): Promise<string[]> {
  // 1. Get user activity
  const activityData = await getUserWeeklyActivity(anilistId);
  if (!activityData) {
    console.error('Failed to get user activity data');
    return [];
  }
  
  // 2. Evaluate which rewards should be unlocked
  const unlockedRewardIds = await evaluateRewards(activityData);
  
  // 3. Assign rewards to user in database
  await assignRewardsToUser(supabaseUserId, unlockedRewardIds);
  
  return unlockedRewardIds;
} 