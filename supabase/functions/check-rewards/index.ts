// Supabase Edge Function to check and assign rewards
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.14.0';

// Types for user stats evaluation
interface UserStats {
  weeklyEpisodes: number;
  weeklyChapters: number;
  skippedIntros: number;
  lateNightCount: number;
  firstEpisodesWeek: number;
  seasonIn48h: boolean;
  volumeIn24h: boolean;
  monthlyMangaSeries: number;
  ongoingManga: number;
  readingHours: number;
  totalMinutes: number;
  matchTitle: boolean;
  weekendEntries: number;
  completedSeason: boolean;
  completedVolume: boolean;
}

interface ActivityResponse {
  data?: {
    Page?: {
      activities?: Array<{
        id: number;
        status: string;
        progress: number;
        createdAt: number;
        media: {
          id: number;
          type: 'ANIME' | 'MANGA';
          title: {
            userPreferred: string;
          }
        }
      }>
    }
  }
}

interface UserStatsResponse {
  data?: {
    User?: {
      id: number;
      name: string;
      statistics?: {
        anime?: {
          count: number;
          episodesWatched: number;
          minutesWatched: number;
          statuses?: Array<{ status: string; count: number }>;
        };
        manga?: {
          count: number;
          chaptersRead: number;
          volumesRead: number;
          statuses?: Array<{ status: string; count: number }>;
        };
      }
    }
  }
}

serve(async (req: Request) => {
  try {
    // Create a Supabase client with the env vars
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    
    // Scheduled or manual function call via POST
    if (req.method === 'POST') {
      const { userId } = await req.json();
      if (userId) {
        // Process a single user
        await processUser(supabase, userId);
        return new Response(JSON.stringify({ success: true, message: `Processed user ${userId}` }), {
          headers: { 'Content-Type': 'application/json' },
          status: 200,
        });
      }
    }
    
    // Get all users from the database
    const { data: users, error: usersError } = await supabase
      .from('anilist_users')
      .select('*');
      
    if (usersError) {
      throw new Error(`Error fetching users: ${usersError.message}`);
    }
    
    console.log(`Processing ${users.length} users for rewards check`);
    
    // Process each user
    for (const user of users) {
      await processUser(supabase, user.id);
    }
    
    return new Response(JSON.stringify({ 
      success: true, 
      message: `Processed ${users.length} users for rewards` 
    }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    });
    
  } catch (error) {
    console.error('Error processing rewards:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      headers: { 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});

async function processUser(supabase: any, userId: string) {
  try {
    // Get user from database
    const { data: user, error: userError } = await supabase
      .from('anilist_users')
      .select('*')
      .eq('id', userId)
      .single();
      
    if (userError || !user) {
      console.error(`Error fetching user ${userId}:`, userError?.message || 'User not found');
      return;
    }
    
    // Fetch AniList data for user
    const anilistStats = await fetchAniListStats(user.access_token, user.anilist_id);
    const userActivities = await fetchUserActivities(user.access_token, user.anilist_id);
    
    // Process the data and check for rewards
    const userStats = calculateUserStats(anilistStats, userActivities);
    
    // Get all rewards
    const { data: rewards, error: rewardsError } = await supabase
      .from('rewards')
      .select('*');
      
    if (rewardsError) {
      throw new Error(`Error fetching rewards: ${rewardsError.message}`);
    }
    
    // Get user's existing rewards
    const { data: userRewards, error: userRewardsError } = await supabase
      .from('user_rewards')
      .select('*')
      .eq('user_id', userId);
      
    if (userRewardsError) {
      throw new Error(`Error fetching user rewards: ${userRewardsError.message}`);
    }
    
    // Determine which rewards the user qualifies for but doesn't have yet
    const userRewardIds = userRewards.map((ur: any) => ur.reward_id);
    const rewardsToCheck = rewards.filter((r: any) => !userRewardIds.includes(r.id));
    
    console.log(`User ${user.username} (${userId}): Checking ${rewardsToCheck.length} new potential rewards`);
    
    // Check each reward criteria
    for (const reward of rewardsToCheck) {
      const criteria = typeof reward.unlock_criteria === 'string' 
        ? JSON.parse(reward.unlock_criteria) 
        : reward.unlock_criteria;
      
      let qualified = true;
      
      // Check if user meets all criteria for this reward
      for (const [key, value] of Object.entries(criteria)) {
        if (key in userStats) {
          if (typeof value === 'boolean') {
            if (userStats[key as keyof UserStats] !== value) {
              qualified = false;
              break;
            }
          } else if (typeof value === 'number') {
            if ((userStats[key as keyof UserStats] as number) < value) {
              qualified = false;
              break;
            }
          }
        } else {
          qualified = false;
          break;
        }
      }
      
      // If qualified, assign reward
      if (qualified) {
        console.log(`User ${user.username} qualified for reward: ${reward.name}`);
        
        // Save the proof data
        const proofData: Record<string, any> = {};
        for (const key of Object.keys(criteria)) {
          if (key in userStats) {
            proofData[key] = userStats[key as keyof UserStats];
          }
        }
        
        // Insert the user reward
        const { error: insertError } = await supabase
          .from('user_rewards')
          .upsert({
            user_id: userId,
            reward_id: reward.id,
            proof_data: proofData
          }, {
            onConflict: 'user_id,reward_id'
          });
          
        if (insertError) {
          console.error(`Error assigning reward ${reward.name} to user ${user.username}:`, insertError);
        } else {
          console.log(`Assigned reward ${reward.name} to user ${user.username}`);
        }
      }
    }
    
    console.log(`Completed rewards check for user ${user.username}`);
    
  } catch (error) {
    console.error(`Error processing user ${userId}:`, error);
  }
}

async function fetchAniListStats(token: string, userId: number): Promise<UserStatsResponse> {
  // GraphQL query to get user statistics
  const query = `
    query {
      User(id: ${userId}) {
        id
        name
        statistics {
          anime {
            count
            episodesWatched
            minutesWatched
            statuses {
              status
              count
            }
          }
          manga {
            count
            chaptersRead
            volumesRead
            statuses {
              status
              count
            }
          }
        }
      }
    }
  `;
  
  try {
    const response = await fetch('https://graphql.anilist.co', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': token ? `Bearer ${token}` : ''
      },
      body: JSON.stringify({ query })
    });
    
    if (!response.ok) {
      throw new Error(`AniList API error: ${response.status} ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching AniList user stats:', error);
    return {};
  }
}

async function fetchUserActivities(token: string, userId: number): Promise<ActivityResponse> {
  // GraphQL query to get user activities
  const query = `
    query {
      Page(page: 1, perPage: 50) {
        activities(userId: ${userId}, sort: ID_DESC) {
          ... on ListActivity {
            id
            status
            progress
            createdAt
            media {
              id
              type
              title {
                userPreferred
              }
            }
          }
        }
      }
    }
  `;
  
  try {
    const response = await fetch('https://graphql.anilist.co', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': token ? `Bearer ${token}` : ''
      },
      body: JSON.stringify({ query })
    });
    
    if (!response.ok) {
      throw new Error(`AniList API error: ${response.status} ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching user activities:', error);
    return {};
  }
}

function calculateUserStats(
  statsData: UserStatsResponse, 
  activitiesData: ActivityResponse
): UserStats {
  // Initialize with default values
  const stats: UserStats = {
    weeklyEpisodes: 0,
    weeklyChapters: 0,
    skippedIntros: 0, // Would need separate tracking
    lateNightCount: 0, // Would need separate tracking
    firstEpisodesWeek: 0, // Would need separate tracking
    seasonIn48h: false, // Would need separate tracking
    volumeIn24h: false, // Would need separate tracking
    monthlyMangaSeries: 0,
    ongoingManga: 0,
    readingHours: 0,
    totalMinutes: 0,
    matchTitle: false,
    weekendEntries: 0,
    completedSeason: false,
    completedVolume: false
  };
  
  // Extract stats from AniList data
  const user = statsData.data?.User;
  const activities = activitiesData.data?.Page?.activities || [];
  
  if (user?.statistics) {
    // Total minutes watched
    stats.totalMinutes = user.statistics.anime?.minutesWatched || 0;
    
    // Ongoing manga count
    const ongoingManga = user.statistics.manga?.statuses?.find(s => s.status === 'CURRENT');
    stats.ongoingManga = ongoingManga?.count || 0;
    stats.monthlyMangaSeries = ongoingManga?.count || 0; // Simplified approximation
    
    // Reading hours (rough estimate)
    stats.readingHours = Math.floor((user.statistics.manga?.chaptersRead || 0) * 5 / 60);
  }
  
  // Process activities
  if (activities && activities.length > 0) {
    // Get timestamps for time ranges
    const now = new Date();
    const oneWeekAgo = new Date(now);
    oneWeekAgo.setDate(now.getDate() - 7);
    const oneWeekAgoTimestamp = Math.floor(oneWeekAgo.getTime() / 1000);
    
    // Weekend detection
    const isWeekend = (timestamp: number): boolean => {
      const date = new Date(timestamp * 1000);
      const day = date.getDay();
      return day === 0 || day === 6; // Sunday (0) or Saturday (6)
    };
    
    // Track media titles to detect same title in anime and manga
    const animeTitles = new Set<string>();
    const mangaTitles = new Set<string>();
    
    // Track weekend activities
    const weekendMediaIds = new Set<number>();
    
    // Process weekly stats
    for (const activity of activities) {
      if (!activity || !activity.media) continue;
      
      // Add title to appropriate set
      if (activity.media.type === 'ANIME') {
        animeTitles.add(activity.media.title.userPreferred);
      } else if (activity.media.type === 'MANGA') {
        mangaTitles.add(activity.media.title.userPreferred);
      }
      
      // Check if activity is from the past week
      if (activity.createdAt >= oneWeekAgoTimestamp) {
        if (activity.media.type === 'ANIME') {
          stats.weeklyEpisodes += activity.progress || 0;
        } else if (activity.media.type === 'MANGA') {
          stats.weeklyChapters += activity.progress || 0;
        }
        
        // Check if weekend activity
        if (isWeekend(activity.createdAt)) {
          weekendMediaIds.add(activity.media.id);
        }
      }
    }
    
    // Check for title matches between anime and manga
    for (const animeTitle of animeTitles) {
      if (mangaTitles.has(animeTitle)) {
        stats.matchTitle = true;
        break;
      }
    }
    
    // Set weekend stats
    stats.weekendEntries = weekendMediaIds.size;
    
    // Simple heuristics for completion achievements
    // This is simplified and would need more detailed tracking
    if (stats.weeklyEpisodes >= 12) {
      stats.completedSeason = true;
    }
    
    if (stats.weeklyChapters >= 8) {
      stats.completedVolume = true;
    }
  }
  
  return stats;
} 