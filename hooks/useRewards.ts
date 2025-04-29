import { useEffect, useState } from 'react';
import { FontAwesome5 } from '@expo/vector-icons';
import { getAllRewards, getUserRewards, assignRewardToUser, Reward, UserReward } from '../lib/supabase';
import { createClient } from '@supabase/supabase-js';
import ENV from '../config';

// Initialize Supabase client
const supabase = createClient(ENV.SUPABASE_URL, ENV.SUPABASE_ANON_KEY);

// Badge icons mapping for rewards that don't have custom icon_url
const BADGE_ICONS: Record<string, string> = {
  // Anime rewards
  'Binge Master': 'play',
  'Opening Skipper': 'fast-forward',
  'Late Night Otaku': 'moon',
  'First Episode Fever': 'tv',
  'Season Slayer': 'calendar-check',
  
  // Manga rewards
  'Power Reader': 'book',
  'Panel Hopper': 'arrows-alt',
  'Chapter Clutch': 'bolt',
  'Cliffhanger Addict': 'mountain',
  'Silent Protagonist': 'volume-mute',
  
  // Combo rewards
  'Dual Wielder': 'gamepad',
  'Otaku Mode: ON': 'toggle-on',
  'Multiverse Traveler': 'globe-asia',
  'Weekend Warrior': 'calendar-week',
  'The Completionist': 'trophy',
  
  // Default icon for any reward not in the mapping
  'default': 'award'
};

// Badge colors mapping
const BADGE_COLORS: Record<string, string> = {
  // Anime rewards - blue tones
  'Binge Master': '#2196F3',
  'Opening Skipper': '#03A9F4',
  'Late Night Otaku': '#1A237E',
  'First Episode Fever': '#3F51B5',
  'Season Slayer': '#5C6BC0',
  
  // Manga rewards - green/teal tones
  'Power Reader': '#4CAF50',
  'Panel Hopper': '#009688',
  'Chapter Clutch': '#00796B',
  'Cliffhanger Addict': '#607D8B',
  'Silent Protagonist': '#795548',
  
  // Combo rewards - purple/gold tones
  'Dual Wielder': '#9C27B0',
  'Otaku Mode: ON': '#673AB7',
  'Multiverse Traveler': '#4A148C',
  'Weekend Warrior': '#FF5722',
  'The Completionist': '#FFC107',
  
  // Default color
  'default': '#9E9E9E'
};

export interface BadgeDisplay {
  id: string;
  name: string;
  icon: string;
  color: string;
  message: string;
  isMotivational: boolean;
  description: string;
  type: 'anime' | 'manga' | 'combo';
  unlocked?: boolean;
  unlocked_at?: string;
}

export interface RewardDetail {
  id: string;
  name: string;
  description: string;
  type: 'anime' | 'manga' | 'combo';
  unlocked_at?: string;
}

export interface UserStats {
  weeklyEpisodes?: number;
  skippedIntros?: number;
  lateNightCount?: number;
  firstEpisodesWeek?: number;
  seasonIn48h?: boolean;
  weeklyChapters?: number;
  monthlyMangaSeries?: number;
  volumeIn24h?: boolean;
  ongoingManga?: number;
  readingHours?: number;
  totalMinutes?: number;
  matchTitle?: boolean;
  weekendEntries?: number;
  completedSeason?: boolean;
  completedVolume?: boolean;
  [key: string]: any; // Allow for other stats
}

export function useRewards(userId: string | null) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rewards, setRewards] = useState<RewardDetail[]>([]);
  const [rewardsCount, setRewardsCount] = useState(0);
  const [allRewardsList, setAllRewardsList] = useState<Reward[]>([]);

  useEffect(() => {
    const loadRewards = async () => {
      if (!userId) {
        console.log('useRewards: No user ID provided');
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        console.log('useRewards: Loading rewards for user ID:', userId);
        
        // Always load all rewards to get their details
        const allRewards = await getAllRewards();
        
        if (!allRewards || allRewards.length === 0) {
          console.log('useRewards: No rewards found in the system');
          setAllRewardsList([]);
          setRewards([]);
          setRewardsCount(0);
          setIsLoading(false);
          return;
        }
        
        console.log(`useRewards: Found ${allRewards.length} reward definitions in the system`);
        
        // Debug logging - print out available rewards
        console.log('Available rewards:', allRewards.map(reward => ({
          id: reward.id,
          name: reward.name,
          type: reward.type
        })));
        
        setAllRewardsList(allRewards);
        
        // Then load user's earned rewards
        try {
          const userRewards = await getUserRewards(userId);
          
          // Add debug log for userRewards
          console.log('useRewards: getUserRewards returned:', {
            success: !!userRewards,
            count: userRewards?.length || 0,
            sampleData: userRewards?.length > 0 ? userRewards[0] : null
          });
          
          if (!userRewards || userRewards.length === 0) {
            console.log('useRewards: User has no earned rewards yet');
            setRewards([]);
            setRewardsCount(0);
            setIsLoading(false);
            return;
          }
          
          console.log(`useRewards: User has ${userRewards.length} earned rewards`);
          setRewardsCount(userRewards.length);
          
          // Map user rewards to their details
          let rewardDetails = userRewards.map(userReward => {
            // Handle case where reward comes directly in the response
            if (userReward.reward) {
              return {
                id: userReward.reward_id || userReward.id,
                name: userReward.reward.name,
                description: userReward.reward.description,
                type: userReward.reward.type as 'anime' | 'manga' | 'combo',
                unlocked_at: userReward.unlocked_at
              };
            }
            
            // Find reward details from allRewards if not in response
            const rewardDetail = allRewards.find(r => r.id === userReward.reward_id);
            
            if (!rewardDetail) {
              console.log(`useRewards: Reward ${userReward.reward_id} not found in allRewards`);
              return null;
            }
            
            return {
              id: userReward.reward_id,
              name: rewardDetail.name,
              description: rewardDetail.description,
              type: rewardDetail.type as 'anime' | 'manga' | 'combo',
              unlocked_at: userReward.unlocked_at
            };
          }).filter(Boolean) as RewardDetail[];
          
          // Add more detailed logging for the mapped rewards
          console.log(`useRewards: Mapped ${rewardDetails.length} rewards with details`, {
            rewardDetailsSample: rewardDetails.length > 0 ? rewardDetails[0] : null,
            allKeys: rewardDetails.length > 0 ? Object.keys(rewardDetails[0]) : [],
            rewardTypes: rewardDetails.map(r => r.type)
          });
          
          // Extract reward IDs for fallback query
          const rewardIds = userRewards.map(ur => ur.reward_id);
          
          // If we have user rewards but couldn't get details, try a direct approach
          if (rewardDetails.length === 0 && rewardIds.length > 0) {
            console.log('useRewards: Could not map reward details through the normal approach, trying direct fetch', rewardIds);
            try {
              // Fetch reward details directly from rewards table
              const { data, error } = await supabase
                .from('rewards')
                .select('*')
                .in('id', rewardIds);
                
              if (error) {
                console.error('Error fetching reward details directly:', error);
              } else if (data && data.length > 0) {
                console.log(`useRewards: Successfully fetched ${data.length} reward details directly`);
                
                // Map the details to our expected format
                rewardDetails = data.map((reward: any) => ({
                  id: reward.id,
                  name: reward.name,
                  description: reward.description,
                  type: reward.type as 'anime' | 'manga' | 'combo',
                  unlocked_at: userRewards.find(ur => ur.reward_id === reward.id)?.unlocked_at || new Date().toISOString()
                }));
              }
            } catch (fallbackError) {
              console.error('Error in fallback reward details fetch:', fallbackError);
            }
          }
          
          setRewards(rewardDetails);
        } catch (userRewardsError) {
          console.log('useRewards: Error fetching user rewards:', userRewardsError);
          // Still continue with empty rewards list rather than failing completely
          setRewards([]);
          setRewardsCount(0);
        }
      } catch (err) {
        console.log('useRewards: Error loading rewards:', err);
        setError('Failed to load achievements');
      } finally {
        setIsLoading(false);
      }
    };

    loadRewards();
  }, [userId]);

  // Get primary badge to show
  const getPrimaryBadge = (): BadgeDisplay | null => {
    if (rewards.length === 0) return null;
    
    // Get the most recently unlocked reward
    const mostRecent = [...rewards].sort((a, b) => 
      new Date(b.unlocked_at || 0).getTime() - new Date(a.unlocked_at || 0).getTime()
    )[0];
    
    if (!mostRecent) return null;
    
    return {
      id: mostRecent.id,
      name: mostRecent.name,
      icon: BADGE_ICONS[mostRecent.name] || BADGE_ICONS.default,
      color: BADGE_COLORS[mostRecent.name] || BADGE_COLORS.default,
      message: mostRecent.description,
      isMotivational: false,
      description: mostRecent.description,
      type: mostRecent.type,
      unlocked: true,
      unlocked_at: mostRecent.unlocked_at
    };
  };
  
  // Check reward criteria and assign if qualified
  const checkAndAssignRewards = async (userStats: UserStats): Promise<RewardDetail[]> => {
    if (!userId) return [];
    
    console.log('checkAndAssignRewards: Processing user stats:', userStats);
    
    try {
      // Define criteria for each reward and map to actual UUIDs from allRewardsList
      const qualifiedRewards: string[] = [];
      
      // Helper function to find reward ID by name
      const findRewardIdByName = (name: string): string | null => {
        const reward = allRewardsList.find(r => r.name === name);
        if (reward) {
          return reward.id;
        }
        console.log(`Warning: Could not find reward with name "${name}" in allRewardsList`);
        return null;
      };
      
      if (userStats.weeklyEpisodes && userStats.weeklyEpisodes >= 50) {
        const rewardId = findRewardIdByName('Binge Master');
        if (rewardId) qualifiedRewards.push(rewardId);
      }
      
      if (userStats.skippedIntros && userStats.skippedIntros >= 20) {
        const rewardId = findRewardIdByName('Opening Skipper');
        if (rewardId) qualifiedRewards.push(rewardId);
      }
      
      if (userStats.lateNightCount && userStats.lateNightCount >= 3) {
        const rewardId = findRewardIdByName('Late Night Otaku');
        if (rewardId) qualifiedRewards.push(rewardId);
      }
      
      if (userStats.firstEpisodesWeek && userStats.firstEpisodesWeek >= 10) {
        const rewardId = findRewardIdByName('First Episode Fever');
        if (rewardId) qualifiedRewards.push(rewardId);
      }
      
      if (userStats.seasonIn48h) {
        const rewardId = findRewardIdByName('Season Slayer');
        if (rewardId) qualifiedRewards.push(rewardId);
      }
      
      if (userStats.weeklyChapters && userStats.weeklyChapters >= 100) {
        const rewardId = findRewardIdByName('Power Reader');
        if (rewardId) qualifiedRewards.push(rewardId);
      }
      
      if (userStats.monthlyMangaSeries && userStats.monthlyMangaSeries >= 10) {
        const rewardId = findRewardIdByName('Panel Hopper');
        if (rewardId) qualifiedRewards.push(rewardId);
      }
      
      if (userStats.volumeIn24h) {
        const rewardId = findRewardIdByName('Chapter Clutch');
        if (rewardId) qualifiedRewards.push(rewardId);
      }
      
      if (userStats.ongoingManga && userStats.ongoingManga >= 3) {
        const rewardId = findRewardIdByName('Cliffhanger Addict');
        if (rewardId) qualifiedRewards.push(rewardId);
      }
      
      if (userStats.readingHours && userStats.readingHours >= 10) {
        const rewardId = findRewardIdByName('Silent Protagonist');
        if (rewardId) qualifiedRewards.push(rewardId);
      }
      
      if (userStats.weeklyEpisodes && userStats.weeklyChapters && 
          userStats.weeklyEpisodes >= 20 && userStats.weeklyChapters >= 20) {
        const rewardId = findRewardIdByName('Dual Wielder');
        if (rewardId) qualifiedRewards.push(rewardId);
      }
      
      if (userStats.totalMinutes && userStats.totalMinutes >= 1000) {
        const rewardId = findRewardIdByName('Otaku Mode: ON');
        if (rewardId) qualifiedRewards.push(rewardId);
      }
      
      if (userStats.matchTitle) {
        const rewardId = findRewardIdByName('Multiverse Traveler');
        if (rewardId) qualifiedRewards.push(rewardId);
      }
      
      if (userStats.weekendEntries && userStats.weekendEntries >= 10) {
        const rewardId = findRewardIdByName('Weekend Warrior');
        if (rewardId) qualifiedRewards.push(rewardId);
      }
      
      if (userStats.completedSeason && userStats.completedVolume) {
        const rewardId = findRewardIdByName('The Completionist');
        if (rewardId) qualifiedRewards.push(rewardId);
      }
      
      console.log(`checkAndAssignRewards: User qualified for ${qualifiedRewards.length} rewards:`, qualifiedRewards);
      
      // Assign the rewards to the user
      for (const rewardId of qualifiedRewards) {
        try {
          await assignRewardToUser(userId, rewardId, userStats);
        } catch (assignError) {
          console.log(`Error assigning reward ${rewardId}:`, assignError);
        }
      }
      
      // Reload rewards after assigning
      const updatedUserRewards = await getUserRewards(userId);
      
      if (!updatedUserRewards || updatedUserRewards.length === 0) {
        return [];
      }
      
      // Format the newly assigned rewards
      const newRewards = updatedUserRewards
        .filter(ur => qualifiedRewards.includes(ur.reward_id))
        .map(ur => {
          const reward = allRewardsList.find(r => r.id === ur.reward_id);
          if (!reward) return null;
          
          return {
            id: ur.reward_id,
            name: reward.name,
            description: reward.description,
            type: reward.type as 'anime' | 'manga' | 'combo',
            unlocked_at: ur.unlocked_at
          };
        })
        .filter(Boolean) as RewardDetail[];
      
      // Update local state
      setRewards(prev => [...prev, ...newRewards]);
      setRewardsCount(prev => prev + newRewards.length);
      
      return newRewards;
    } catch (error) {
      console.log('Error checking and assigning rewards:', error);
      return [];
    }
  };

  return { rewards, isLoading, error, rewardsCount, getPrimaryBadge, checkAndAssignRewards, allRewards: allRewardsList };
}

export const useRewardsOld = (userId?: string) => {
  const [allRewards, setAllRewards] = useState<Reward[]>([]);
  const [userRewards, setUserRewards] = useState<UserReward[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastLoaded, setLastLoaded] = useState<Date | null>(null);
  
  const loadRewardsData = async (force = false) => {
    if (!userId) {
      setIsLoading(false);
      return;
    }
    
    // Don't reload if we loaded in the last 5 minutes, unless forced
    if (!force && lastLoaded) {
      const minutesSinceLastLoad = (new Date().getTime() - lastLoaded.getTime()) / (1000 * 60);
      if (minutesSinceLastLoad < 5) {
        console.log('Skipping rewards reload, data is fresh');
        return;
      }
    }
    
    try {
      setIsLoading(true);
      setError(null);
      
      // Load all rewards
      const rewards = await getAllRewards();
      setAllRewards(rewards || []);
      
      // Load user rewards
      const userRewardsData = await getUserRewards(userId);
      setUserRewards(userRewardsData || []);
      setLastLoaded(new Date());
    } catch (err) {
      console.error('Error loading rewards data:', err);
      setError('Failed to load rewards');
    } finally {
      setIsLoading(false);
    }
  };
  
  useEffect(() => {
    loadRewardsData();
  }, [userId]);
  
  // Format badges for display with proper icons and colors
  const getFormattedBadges = (): BadgeDisplay[] => {
    // If no userId is provided, return empty array
    if (!userId) return [];
    
    // Map all rewards to badge display format
    return allRewards.map(reward => {
      // Check if user has this reward
      const userReward = userRewards.find(ur => ur.reward_id === reward.id);
      const isUnlocked = !!userReward;
      
      // Get icon - use mapping if icon_url is null
      const icon = BADGE_ICONS[reward.name] || BADGE_ICONS.default;
      
      // Get color
      const color = BADGE_COLORS[reward.name] || BADGE_COLORS.default;
      
      // Format badge for display
      return {
        id: reward.id,
        name: reward.name,
        icon,
        color,
        message: `${reward.description}`,
        isMotivational: !isUnlocked, // Motivational if not unlocked yet
        description: reward.description,
        type: reward.type,
        unlocked: isUnlocked,
        unlocked_at: userReward?.unlocked_at
      };
    });
  };
  
  // Get primary badge to show
  const getPrimaryBadge = (): BadgeDisplay | null => {
    const badges = getFormattedBadges();
    
    // First priority: show most recently unlocked badge
    const unlockedBadges = badges.filter(badge => badge.unlocked)
      .sort((a, b) => 
        new Date(b.unlocked_at || 0).getTime() - new Date(a.unlocked_at || 0).getTime()
      );
    
    if (unlockedBadges.length > 0) {
      return unlockedBadges[0];
    }
    
    // Second priority: show a random badge that can be unlocked
    const lockedBadges = badges.filter(badge => !badge.unlocked);
    if (lockedBadges.length > 0) {
      return lockedBadges[Math.floor(Math.random() * lockedBadges.length)];
    }
    
    return null;
  };
  
  // Award a new badge to user
  const awardBadge = async (rewardId: string, proofData: any = {}) => {
    if (!userId || !rewardId) return null;
    
    try {
      setIsLoading(true);
      const result = await assignRewardToUser(userId, rewardId, proofData);
      if (result) {
        // Find the reward details
        const rewardDetails = allRewards.find(r => r.id === rewardId);
        
        // Update local state
        const updatedReward = {
          ...result,
          reward: rewardDetails
        };
        
        setUserRewards(prev => {
          // Replace if exists or add new
          const exists = prev.some(ur => ur.reward_id === rewardId);
          if (exists) {
            return prev.map(ur => ur.reward_id === rewardId ? updatedReward : ur);
          } else {
            return [...prev, updatedReward];
          }
        });
        
        return updatedReward;
      }
      return null;
    } catch (err) {
      console.error('Error awarding badge:', err);
      return null;
    } finally {
      setIsLoading(false);
    }
  };
  
  // Check reward criteria and assign if qualified
  const checkAndAssignRewards = async (userStats: UserStats): Promise<RewardDetail[]> => {
    if (!userId) return [];
    
    console.log('checkAndAssignRewards: This is now a stub function');
    console.log('User stats:', userStats);
    
    // This is just a stub to avoid errors
    // The real implementation would check which rewards the user qualifies for
    // and assign them, but for now we're just returning an empty array
    return [];
  };
  
  return {
    allRewards,
    userRewards,
    isLoading,
    error,
    getFormattedBadges,
    getPrimaryBadge,
    awardBadge,
    checkAndAssignRewards,
    loadRewardsData
  };
}; 