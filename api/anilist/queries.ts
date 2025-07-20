import { axios } from '../../services/api';
import * as SecureStore from 'expo-secure-store';
import { STORAGE_KEY } from '../../constants/auth';

const ANILIST_API = 'https://graphql.anilist.co';

// GraphQL Fragments for reusability
const MEDIA_FRAGMENT = `
  fragment MediaInfo on Media {
    id
    title {
      userPreferred
      english
      romaji
      native
    }
    coverImage {
      extraLarge
      large
      color
    }
    bannerImage
    description
    episodes
    duration
    averageScore
    trending
    popularity
    status
    format
    season
    seasonYear
    startDate {
      year
      month
      day
    }
    genres
    studios {
      nodes {
        name
      }
    }
    nextAiringEpisode {
      episode
      timeUntilAiring
    }
  }
`;

const CHARACTER_FRAGMENT = `
  fragment CharacterInfo on Character {
    id
    name {
      userPreferred
      first
      middle
      last
      full
      native
    }
    image {
      medium
      large
    }
    dateOfBirth {
      month
      day
    }
    favourites
  }
`;

const STAFF_FRAGMENT = `
  fragment StaffInfo on Staff {
    id
    name {
      userPreferred
      first
      middle
      last
      full
      native
    }
    image {
      medium
      large
    }
    dateOfBirth {
      month
      day
    }
    favourites
  }
`;

const USER_FRAGMENT = `
  fragment UserInfo on User {
    id
    name
    avatar {
      medium
      large
    }
    statistics {
      anime {
        genres {
          genre
          count
          meanScore
          minutesWatched
        }
      }
    }
  }
`;

// Individual Query Functions
export const fetchTrendingAnime = async (perPage: number = 10, isAdult: boolean = false) => {
  const query = `
    ${MEDIA_FRAGMENT}
    query ($perPage: Int, $isAdult: Boolean) {
      Page(perPage: $perPage) {
        media(sort: TRENDING_DESC, type: ANIME, isAdult: $isAdult) {
          ...MediaInfo
        }
      }
    }
  `;

  const token = await SecureStore.getItemAsync(STORAGE_KEY.AUTH_TOKEN);
  
  const response = await axios.post(
    ANILIST_API,
    {
      query,
      variables: { perPage, isAdult }
    },
    {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      },
      timeout: 30000
    }
  );

  return response.data.data.Page.media;
};

export const fetchAiringSchedule = async (days: number = 7) => {
  const now = Math.floor(Date.now() / 1000);
  const endTime = now + (days * 24 * 60 * 60);

  const query = `
    query ($now: Int, $endTime: Int) {
      Page(perPage: 100) {
        airingSchedules(
          airingAt_greater: $now
          airingAt_lesser: $endTime
          sort: TIME
        ) {
          id
          airingAt
          timeUntilAiring
          episode
          media {
            id
            title {
              userPreferred
              english
              romaji
              native
            }
            coverImage {
              large
              color
            }
            averageScore
            status
            format
            type
            isAdult
            genres
          }
        }
      }
    }
  `;

  const token = await SecureStore.getItemAsync(STORAGE_KEY.AUTH_TOKEN);
  
  const response = await axios.post(
    ANILIST_API,
    {
      query,
      variables: { now, endTime }
    },
    {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      },
      timeout: 30000
    }
  );

  return response.data.data.Page.airingSchedules;
};

export const fetchBirthdays = async (perPage: number = 25) => {
  const query = `
    ${CHARACTER_FRAGMENT}
    ${STAFF_FRAGMENT}
    query ($perPage: Int) {
      birthdayCharacters: Page(perPage: $perPage) {
        characters(sort: FAVOURITES_DESC, isBirthday: true) {
          ...CharacterInfo
        }
      }
      birthdayStaff: Page(perPage: $perPage) {
        staff(sort: FAVOURITES_DESC, isBirthday: true) {
          ...StaffInfo
        }
      }
    }
  `;

  const token = await SecureStore.getItemAsync(STORAGE_KEY.AUTH_TOKEN);
  
  const response = await axios.post(
    ANILIST_API,
    {
      query,
      variables: { perPage }
    },
    {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      },
      timeout: 30000
    }
  );

  const characters = response.data.data.birthdayCharacters.characters.map((char: any) => ({
    ...char,
    type: 'CHARACTER'
  }));
  
  const staff = response.data.data.birthdayStaff.staff.map((staff: any) => ({
    ...staff,
    type: 'STAFF'
  }));

  return [...characters, ...staff].sort((a, b) => (b.favourites || 0) - (a.favourites || 0));
};

export const fetchContinueWatching = async (userId?: number) => {
  if (!userId) return [];

  const query = `
    ${MEDIA_FRAGMENT}
    query ($userId: Int) {
      MediaListCollection(userId: $userId, type: ANIME, status: CURRENT) {
        lists {
          entries {
            id
            progress
            updatedAt
            media {
              ...MediaInfo
            }
          }
        }
      }
    }
  `;

  const token = await SecureStore.getItemAsync(STORAGE_KEY.AUTH_TOKEN);
  
  const response = await axios.post(
    ANILIST_API,
    {
      query,
      variables: { userId }
    },
    {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      },
      timeout: 30000
    }
  );

  const entries = response.data.data.MediaListCollection?.lists?.[0]?.entries || [];
  return entries.map((entry: any) => ({
    ...entry.media,
    progress: entry.progress,
    updatedAt: entry.updatedAt
  })).sort((a: any, b: any) => b.updatedAt - a.updatedAt);
};

export const fetchFollowingUsers = async () => {
  const query = `
    ${USER_FRAGMENT}
    query {
      Viewer {
        following {
          ...UserInfo
        }
      }
    }
  `;

  const token = await SecureStore.getItemAsync(STORAGE_KEY.AUTH_TOKEN);
  if (!token) return [];
  
  const response = await axios.post(
    ANILIST_API,
    {
      query
    },
    {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      timeout: 30000
    }
  );

  return response.data.data.Viewer?.following || [];
};

export const fetchFriendWatching = async (friendIds: number[]) => {
  if (friendIds.length === 0) return [];

  const queries = friendIds.map(userId => `
    user_${userId}: MediaListCollection(userId: ${userId}, type: ANIME, status: CURRENT) {
      lists {
        entries {
          progress
          media {
            id
            title {
              userPreferred
              english
              romaji
            }
            coverImage {
              large
            }
          }
        }
      }
    }
  `);

  const query = `
    query {
      ${queries.join('\n')}
    }
  `;

  const token = await SecureStore.getItemAsync(STORAGE_KEY.AUTH_TOKEN);
  if (!token) return [];
  
  const response = await axios.post(
    ANILIST_API,
    {
      query
    },
    {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      timeout: 30000
    }
  );

  // Process friend watching data
  const friendWatching: any[] = [];
  Object.entries(response.data.data).forEach(([key, value]: [string, any]) => {
    const userId = parseInt(key.split('_')[1]);
    const entries = value.lists?.[0]?.entries || [];
    entries.forEach((entry: any) => {
      friendWatching.push({
        userId,
        media: entry.media,
        progress: entry.progress
      });
    });
  });

  return friendWatching;
};

export const fetchGenreRecommendations = async (userId?: number, genres?: string[], perPage: number = 10) => {
  const query = `
    ${MEDIA_FRAGMENT}
    query ($genres: [String], $perPage: Int, $isAdult: Boolean) {
      Page(perPage: $perPage) {
        media(
          genre_in: $genres
          sort: POPULARITY_DESC
          type: ANIME
          isAdult: $isAdult
        ) {
          ...MediaInfo
        }
      }
    }
  `;

  const token = await SecureStore.getItemAsync(STORAGE_KEY.AUTH_TOKEN);
  
  const response = await axios.post(
    ANILIST_API,
    {
      query,
      variables: { 
        genres: genres || ['Action', 'Adventure', 'Comedy'], 
        perPage,
        isAdult: false
      }
    },
    {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      },
      timeout: 30000
    }
  );

  return response.data.data.Page.media;
};

export const fetchPopularNow = async (perPage: number = 10) => {
  const query = `
    ${MEDIA_FRAGMENT}
    query ($perPage: Int, $isAdult: Boolean) {
      Page(perPage: $perPage) {
        media(sort: POPULARITY_DESC, type: ANIME, isAdult: $isAdult) {
          ...MediaInfo
        }
      }
    }
  `;

  const token = await SecureStore.getItemAsync(STORAGE_KEY.AUTH_TOKEN);
  
  const response = await axios.post(
    ANILIST_API,
    {
      query,
      variables: { perPage, isAdult: false }
    },
    {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      },
      timeout: 30000
    }
  );

  return response.data.data.Page.media;
};

export const fetchUserGenreStats = async (userId?: number) => {
  if (!userId) return null;

  const query = `
    ${USER_FRAGMENT}
    query ($userId: Int) {
      User(id: $userId) {
        ...UserInfo
      }
    }
  `;

  const token = await SecureStore.getItemAsync(STORAGE_KEY.AUTH_TOKEN);
  if (!token) return null;
  
  const response = await axios.post(
    ANILIST_API,
    {
      query,
      variables: { userId }
    },
    {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      timeout: 30000
    }
  );

  return response.data.data.User?.statistics?.anime?.genres || [];
};

export const fetchSocialActivity = async (userId?: number, perPage: number = 10) => {
  if (!userId) return [];

  const query = `
    query ($userId: Int, $perPage: Int) {
      Page(page: 1, perPage: $perPage) {
        activities(sort: ID_DESC, userId: $userId) {
          ... on ListActivity {
            id
            type
            status
            progress
            user {
              id
              name
              avatar {
                medium
              }
            }
            media {
              id
              title {
                userPreferred
                english
                romaji
              }
              coverImage {
                large
              }
              type
            }
            createdAt
          }
        }
      }
    }
  `;

  const token = await SecureStore.getItemAsync(STORAGE_KEY.AUTH_TOKEN);
  if (!token) return [];
  
  const response = await axios.post(
    ANILIST_API,
    {
      query,
      variables: { userId, perPage }
    },
    {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      timeout: 30000
    }
  );

  return response.data.data.Page.activities || [];
};

// Main batch query function
export const fetchExplorePageSections = async (userId?: number, showAdultContent: boolean = false) => {
  try {
    console.log('Starting parallel fetch for explore page sections...');
    
    const results = await Promise.allSettled([
      fetchTrendingAnime(10, showAdultContent),
      fetchAiringSchedule(7),
      fetchBirthdays(25),
      fetchContinueWatching(userId),
      fetchFollowingUsers(),
      fetchPopularNow(10),
      fetchSocialActivity(userId, 10),
      fetchUserGenreStats(userId)
    ]);

    const [
      trendingResult,
      airingScheduleResult,
      birthdaysResult,
      continueWatchingResult,
      followingUsersResult,
      popularNowResult,
      socialActivityResult,
      userGenreStatsResult
    ] = results;

    // Process results and handle errors gracefully
    const trendingAnime = trendingResult.status === 'fulfilled' ? trendingResult.value : [];
    const airingSchedule = airingScheduleResult.status === 'fulfilled' ? airingScheduleResult.value : [];
    const birthdays = birthdaysResult.status === 'fulfilled' ? birthdaysResult.value : [];
    const continueWatching = continueWatchingResult.status === 'fulfilled' ? continueWatchingResult.value : [];
    const followingUsers = followingUsersResult.status === 'fulfilled' ? followingUsersResult.value : [];
    const popularNow = popularNowResult.status === 'fulfilled' ? popularNowResult.value : [];
    const socialActivity = socialActivityResult.status === 'fulfilled' ? socialActivityResult.value : [];
    const userGenreStats = userGenreStatsResult.status === 'fulfilled' ? userGenreStatsResult.value : [];

    // Fetch friend watching data if we have friends
    let friendWatching: any[] = [];
    if (followingUsers && Array.isArray(followingUsers) && followingUsers.length > 0) {
      const friendIds = followingUsers.map((user: any) => user.id);
      try {
        friendWatching = await fetchFriendWatching(friendIds);
      } catch (error) {
        console.error('Error fetching friend watching:', error);
      }
    }

    // Fetch genre recommendations based on user stats
    let genreRecommendations: any[] = [];
    if (userGenreStats && Array.isArray(userGenreStats) && userGenreStats.length > 0) {
      const topGenres = userGenreStats
        .sort((a: any, b: any) => b.count - a.count)
        .slice(0, 3)
        .map((stat: any) => stat.genre);
      
      try {
        genreRecommendations = await fetchGenreRecommendations(userId, topGenres, 10);
      } catch (error) {
        console.error('Error fetching genre recommendations:', error);
      }
    }

    console.log('Explore page sections fetched successfully');
    console.log('Results:', {
      trending: Array.isArray(trendingAnime) ? trendingAnime.length : 0,
      airing: Array.isArray(airingSchedule) ? airingSchedule.length : 0,
      birthdays: Array.isArray(birthdays) ? birthdays.length : 0,
      continueWatching: Array.isArray(continueWatching) ? continueWatching.length : 0,
      friends: Array.isArray(followingUsers) ? followingUsers.length : 0,
      friendWatching: Array.isArray(friendWatching) ? friendWatching.length : 0,
      popular: Array.isArray(popularNow) ? popularNow.length : 0,
      social: Array.isArray(socialActivity) ? socialActivity.length : 0,
      genreRecs: Array.isArray(genreRecommendations) ? genreRecommendations.length : 0
    });

    return {
      trendingAnime,
      airingSchedule,
      birthdays,
      continueWatching,
      friendWatching,
      popularNow,
      socialActivity,
      genreRecommendations,
      userGenreStats
    };
  } catch (error) {
    console.error('Error in fetchExplorePageSections:', error);
    throw error;
  }
};

// Helper function to format scores based on user preference
export const formatScoreForUser = (score: number, format: string = 'POINT_10') => {
  switch (format) {
    case 'POINT_100':
      return score;
    case 'POINT_10_DECIMAL':
      return (score / 10).toFixed(1);
    case 'POINT_10':
      return Math.round(score / 10);
    case 'POINT_5':
      return Math.round(score / 20);
    case 'POINT_3':
      return Math.round(score / 33.33);
    default:
      return (score / 10).toFixed(1);
  }
};

// Helper function to organize schedule by date
export const organizeSchedulesByDate = (schedules: any[]): any[] => {
  const today = new Date();
  const days: any[] = [];
  
  for (let i = 0; i < 7; i++) {
    const dateKey = new Date(today.getTime() + i * 86400000).toISOString().split('T')[0];
    
    const daySchedules = schedules.filter(schedule => {
      const airingDateKey = new Date(schedule.airingAt * 1000).toISOString().split('T')[0];
      return airingDateKey === dateKey;
    }).sort((a, b) => a.airingAt - b.airingAt);

    const displayDate = new Date(today.getTime() + i * 86400000);
    
    days.push({
      date: dateKey,
      dayName: displayDate.toLocaleDateString('en-US', { weekday: 'short' }),
      isToday: i === 0,
      schedules: daySchedules
    });
  }
  
  return days;
};

// New TikTok-style Explore Feed Function
export const getExploreFeed = async (userId?: number, showAdultContent: boolean = false) => {
  try {
    console.log('🚀 Generating TikTok-style explore feed...');
    
    // Fetch all data in parallel for maximum speed
    const results = await Promise.allSettled([
      fetchTrendingAnime(15, showAdultContent),
      fetchAiringSchedule(7),
      fetchBirthdays(20),
      fetchContinueWatching(userId),
      fetchFollowingUsers(),
      fetchPopularNow(15),
      fetchSocialActivity(userId, 15),
      fetchUserGenreStats(userId),
      fetchTopGainersThisWeek(),
      fetchRandomAnimeFacts(),
      fetchSeasonalHighlights(),
      fetchUpcomingReleases()
    ]);

    // Extract results safely
    const [
      trendingResult,
      airingScheduleResult,
      birthdaysResult,
      continueWatchingResult,
      followingUsersResult,
      popularNowResult,
      socialActivityResult,
      userGenreStatsResult,
      topGainersResult,
      animeFactsResult,
      seasonalHighlightsResult,
      upcomingReleasesResult
    ] = results;

    const trendingAnime = trendingResult.status === 'fulfilled' ? trendingResult.value : [];
    const airingSchedule = airingScheduleResult.status === 'fulfilled' ? airingScheduleResult.value : [];
    const birthdays = birthdaysResult.status === 'fulfilled' ? birthdaysResult.value : [];
    const continueWatching = continueWatchingResult.status === 'fulfilled' ? continueWatchingResult.value : [];
    const followingUsers = followingUsersResult.status === 'fulfilled' ? followingUsersResult.value : [];
    const popularNow = popularNowResult.status === 'fulfilled' ? popularNowResult.value : [];
    const socialActivity = socialActivityResult.status === 'fulfilled' ? socialActivityResult.value : [];
    const userGenreStats = userGenreStatsResult.status === 'fulfilled' ? userGenreStatsResult.value : [];
    const topGainers = topGainersResult.status === 'fulfilled' ? topGainersResult.value : [];
    const animeFacts = animeFactsResult.status === 'fulfilled' ? animeFactsResult.value : [];
    const seasonalHighlights = seasonalHighlightsResult.status === 'fulfilled' ? seasonalHighlightsResult.value : [];
    const upcomingReleases = upcomingReleasesResult.status === 'fulfilled' ? upcomingReleasesResult.value : [];

    // Fetch friend watching data if we have friends
    let friendWatching: any[] = [];
    if (followingUsers && Array.isArray(followingUsers) && followingUsers.length > 0) {
      const friendIds = followingUsers.map((user: any) => user.id);
      try {
        friendWatching = await fetchFriendWatching(friendIds);
      } catch (error) {
        console.error('Error fetching friend watching:', error);
      }
    }

    // Fetch personalized genre recommendations
    let genreRecommendations: any[] = [];
    if (userGenreStats && Array.isArray(userGenreStats) && userGenreStats.length > 0) {
      const topGenres = userGenreStats
        .sort((a: any, b: any) => b.count - a.count)
        .slice(0, 3)
        .map((stat: any) => stat.genre);
      
      try {
        genreRecommendations = await fetchGenreRecommendations(userId, topGenres, 12);
      } catch (error) {
        console.error('Error fetching genre recommendations:', error);
      }
    }

    // Generate TikTok-style feed items with dynamic mixing
    const feedItems = [];
    
    // 1. HERO CARD - Always first for immediate impact
    if (trendingAnime.length > 0) {
      feedItems.push({
        type: 'hero',
        id: 'hero-trending',
        priority: 1,
        data: {
          title: 'Trending Now',
          subtitle: 'What everyone\'s watching',
          items: trendingAnime.slice(0, 5),
          autoScroll: true,
          showProgress: true
        }
      });
    }

    // 2. CONTINUE WATCHING - High priority for returning users
    if (continueWatching.length > 0) {
      feedItems.push({
        type: 'continueWatching',
        id: 'continue-watching',
        priority: 2,
        data: {
          title: 'Continue Watching',
          subtitle: 'Pick up where you left off',
          items: continueWatching.slice(0, 4),
          showProgress: true,
          personalizedMessage: `You have ${continueWatching.length} anime in progress`
        }
      });
    }

    // 3. RANDOM FACT CARD - Dopamine hit with trivia
    if (animeFacts.length > 0) {
      const randomFact = animeFacts[Math.floor(Math.random() * animeFacts.length)];
      feedItems.push({
        type: 'randomFact',
        id: `fact-${Date.now()}`,
        priority: 3,
        data: {
          fact: randomFact.fact,
          anime: randomFact.anime,
          category: randomFact.category,
          difficulty: randomFact.difficulty,
          source: randomFact.source,
          isInteractive: true,
          showLikeButton: true,
          showShareButton: true,
          showCommentButton: true
        }
      });
    }

    // 4. STAT BATTLE CARD - Interactive engagement
    if (trendingAnime.length >= 2) {
      const battleAnime = trendingAnime.slice(0, 2);
      // Ensure both anime have valid data before creating battle card
      if (battleAnime[0] && battleAnime[1] && 
          battleAnime[0].id && battleAnime[1].id &&
          battleAnime[0].title && battleAnime[1].title) {
        feedItems.push({
          type: 'statBattle',
          id: `battle-${Date.now()}`,
          priority: 4,
          data: {
            title: 'Anime Battle',
            subtitle: 'Which would you choose?',
            anime1: battleAnime[0],
            anime2: battleAnime[1],
            battleType: 'popularity', // or 'score', 'episodes', etc.
            isInteractive: true,
            showVoteButton: true,
            showResultsAfterVote: true
          }
        });
      }
    }

    // 5. SOCIAL ACTIVITY - Friend engagement
    if (socialActivity.length > 0) {
      feedItems.push({
        type: 'socialActivity',
        id: 'social-activity',
        priority: 5,
        data: {
          title: 'Friend Activity',
          subtitle: 'See what your friends are watching',
          activities: socialActivity.slice(0, 3),
          showFollowButton: true,
          isInteractive: true
        }
      });
    }

    // 6. PERSONALIZED RECOMMENDATIONS - AI-powered suggestions
    if (genreRecommendations.length > 0) {
      feedItems.push({
        type: 'personalizedRecommendations',
        id: 'personalized-recs',
        priority: 6,
        data: {
          title: 'Made for You',
          subtitle: `Based on your ${userGenreStats.slice(0, 2).map((g: any) => g.genre).join(' & ')} history`,
          items: genreRecommendations.slice(0, 6),
          algorithm: 'genre-based',
          confidence: 0.85,
          showAddToListButton: true
        }
      });
    }

    // 7. AIRING SCHEDULE - Time-sensitive content
    if (airingSchedule.length > 0) {
      const todaySchedule = airingSchedule.filter((schedule: any) => {
        const airingDate = new Date(schedule.airingAt * 1000);
        const today = new Date();
        return airingDate.toDateString() === today.toDateString();
      });

      if (todaySchedule.length > 0) {
        feedItems.push({
          type: 'airingSchedule',
          id: 'airing-today',
          priority: 7,
          data: {
            title: 'Airing Today',
            subtitle: 'Don\'t miss these episodes',
            items: todaySchedule.slice(0, 4),
            showCountdown: true,
            showNotificationButton: true
          }
        });
      }
    }

    // 8. BIRTHDAY CELEBRATIONS - Special occasions
    if (birthdays.length > 0) {
      feedItems.push({
        type: 'birthdayToday',
        id: 'birthdays-today',
        priority: 8,
        data: {
          title: 'Birthday Celebrations',
          subtitle: 'Characters & creators celebrating today',
          items: birthdays.slice(0, 3),
          showCelebrationAnimation: true,
          showShareButton: true
        }
      });
    }

    // 9. TOP GAINERS - Trending momentum
    if (topGainers.length > 0) {
      feedItems.push({
        type: 'trendingAd',
        id: 'top-gainers',
        priority: 9,
        data: {
          title: 'Rising Stars',
          subtitle: 'Anime gaining popularity fast',
          items: topGainers.slice(0, 4),
          showTrendingBadge: true,
          showGrowthPercentage: true,
          isSponsored: false
        }
      });
    }

    // 10. FOMO CARD - Social pressure
    if (friendWatching.length > 0) {
      const popularAmongFriends = friendWatching
        .reduce((acc: any[], curr: any) => {
          const existing = acc.find(item => item.media.id === curr.media.id);
          if (existing) {
            existing.friendCount++;
            existing.friends.push(curr.userId);
          } else {
            acc.push({
              media: curr.media,
              friendCount: 1,
              friends: [curr.userId]
            });
          }
          return acc;
        }, [])
        .filter(item => item.friendCount >= 2)
        .sort((a, b) => b.friendCount - a.friendCount)[0];

      if (popularAmongFriends) {
        feedItems.push({
          type: 'fomo',
          id: 'fomo-friends',
          priority: 10,
          data: {
            title: 'Your Friends Are Watching',
            subtitle: `${popularAmongFriends.friendCount} friends are watching this`,
            anime: popularAmongFriends.media,
            friendCount: popularAmongFriends.friendCount,
            friends: popularAmongFriends.friends,
            showJoinButton: true,
            urgencyLevel: 'high'
          }
        });
      }
    }

    // 11. QUOTE CARD - Inspirational content
    if (seasonalHighlights.length > 0) {
      const randomHighlight = seasonalHighlights[Math.floor(Math.random() * seasonalHighlights.length)];
      feedItems.push({
        type: 'quote',
        id: `quote-${Date.now()}`,
        priority: 11,
        data: {
          quote: randomHighlight.quote,
          anime: randomHighlight.anime,
          character: randomHighlight.character,
          episode: randomHighlight.episode,
          backgroundImage: randomHighlight.anime.bannerImage,
          showShareButton: true
        }
      });
    }

    // 12. UPCOMING RELEASES - Future content
    if (upcomingReleases.length > 0) {
      feedItems.push({
        type: 'skeleton',
        id: 'upcoming-releases',
        priority: 12,
        data: {
          title: 'Coming Soon',
          subtitle: 'Anime to look forward to',
          items: upcomingReleases.slice(0, 4),
          showCountdown: true,
          showWishlistButton: true,
          anticipationLevel: 'high'
        }
      });
    }

    // Sort by priority and add dynamic spacing
    const sortedFeedItems = feedItems
      .sort((a, b) => a.priority - b.priority)
      .map((item, index) => ({
        ...item,
        index,
        timestamp: Date.now(),
        viewCount: 0,
        engagementScore: 0
      }));

    // Add skeleton loaders for anticipation
    const finalFeedItems: any[] = [];
    sortedFeedItems.forEach((item, index) => {
      finalFeedItems.push(item);
      
      // Add skeleton loaders every 3-4 items for anticipation
      if (index > 0 && index % 3 === 0 && index < sortedFeedItems.length - 1) {
        finalFeedItems.push({
          type: 'skeleton',
          id: `skeleton-${index}`,
          priority: item.priority + 0.5,
          data: {
            height: Math.random() > 0.5 ? 200 : 300,
            showShimmer: true,
            delayMs: 1000 + Math.random() * 2000
          }
        });
      }
    });

    console.log('✅ TikTok-style feed generated successfully');
    console.log('📊 Feed stats:', {
      totalItems: finalFeedItems.length,
      uniqueTypes: [...new Set(finalFeedItems.map(item => item.type))],
      hasPersonalization: !!userId,
      dataQuality: {
        trending: trendingAnime.length,
        continuing: continueWatching.length,
        social: socialActivity.length,
        friends: friendWatching.length,
        recommendations: genreRecommendations.length
      }
    });

    return {
      feedItems: finalFeedItems,
      metadata: {
        generatedAt: new Date().toISOString(),
        userId,
        personalizedItems: finalFeedItems.filter(item => 
          ['personalizedRecommendations', 'continueWatching', 'socialActivity', 'fomo'].includes(item.type)
        ).length,
        totalItems: finalFeedItems.length,
        algorithm: 'tiktok-style-v1',
        freshness: 'live'
      }
    };

  } catch (error) {
    console.error('❌ Error generating explore feed:', error);
    throw error;
  }
};

// Helper functions for new data sources
export const fetchTopGainersThisWeek = async () => {
  const oneWeekAgo = Math.floor((Date.now() - 7 * 24 * 60 * 60 * 1000) / 1000);
  
  const query = `
    query {
      Page(perPage: 10) {
        media(sort: TRENDING_DESC, type: ANIME, startDate_greater: ${oneWeekAgo}) {
          id
          title { userPreferred }
          coverImage { large color }
          trending
          popularity
          averageScore
          format
          status
          genres
          studios { nodes { name } }
        }
      }
    }
  `;

  try {
    const response = await axios.post(ANILIST_API, { query }, {
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      timeout: 30000
    });
    return response.data.data.Page.media || [];
  } catch (error) {
    console.error('Error fetching top gainers:', error);
    return [];
  }
};

export const fetchRandomAnimeFacts = async () => {
  // This would ideally connect to a facts database
  // For now, we'll generate some based on trending anime
  const trending = await fetchTrendingAnime(5);
  
  const facts = trending.map((anime: any) => ({
    fact: `Did you know that ${anime.title.userPreferred} has been trending for ${Math.floor(Math.random() * 30) + 1} days?`,
    anime: anime,
    category: 'trending',
    difficulty: 'easy',
    source: 'AniList Trending Data'
  }));

  return facts;
};

export const fetchSeasonalHighlights = async () => {
  const currentSeason = getCurrentSeason();
  const currentYear = new Date().getFullYear();
  
  const query = `
    query {
      Page(perPage: 10) {
        media(season: ${currentSeason}, seasonYear: ${currentYear}, sort: SCORE_DESC, type: ANIME) {
          id
          title { userPreferred }
          coverImage { large }
          bannerImage
          averageScore
          description
          genres
        }
      }
    }
  `;

  try {
    const response = await axios.post(ANILIST_API, { query }, {
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      timeout: 30000
    });
    
    const highlights = response.data.data.Page.media.map((anime: any) => ({
      anime,
      quote: anime.description ? anime.description.substring(0, 100) + '...' : 'A must-watch this season!',
      character: null,
      episode: null
    }));

    return highlights;
  } catch (error) {
    console.error('Error fetching seasonal highlights:', error);
    return [];
  }
};

export const fetchUpcomingReleases = async () => {
  const nextMonth = Math.floor((Date.now() + 30 * 24 * 60 * 60 * 1000) / 1000);
  
  const query = `
    query {
      Page(perPage: 10) {
        media(status: NOT_YET_RELEASED, sort: START_DATE, type: ANIME) {
          id
          title { userPreferred }
          coverImage { large color }
          startDate { year month day }
          description
          genres
          studios { nodes { name } }
          format
        }
      }
    }
  `;

  try {
    const response = await axios.post(ANILIST_API, { query }, {
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      timeout: 30000
    });
    return response.data.data.Page.media || [];
  } catch (error) {
    console.error('Error fetching upcoming releases:', error);
    return [];
  }
};

// Helper function to get current season
const getCurrentSeason = () => {
  const month = new Date().getMonth() + 1;
  if (month >= 3 && month <= 5) return 'SPRING';
  if (month >= 6 && month <= 8) return 'SUMMER';
  if (month >= 9 && month <= 11) return 'FALL';
  return 'WINTER';
};

export const fetchRelatedSeasons = async (anilistId: string, searchTitle?: string) => {
  const query = `
    query ($id: Int, $search: String) {
      Media(id: $id, type: ANIME) {
        id
        title {
          userPreferred
          english
          romaji
          native
        }
        format
        status
        startDate {
          year
          month
          day
        }
        relations {
          edges {
            relationType
            node {
              id
              title {
                userPreferred
                english
                romaji
                native
              }
              format
              status
              startDate {
                year
                month
                day
              }
              episodes
              coverImage {
                large
                color
              }
              averageScore
              season
              seasonYear
            }
          }
        }
      }
      ${searchTitle ? `
      Search: Page(perPage: 20) {
        media(search: $search, type: ANIME, sort: START_DATE) {
          id
          title {
            userPreferred
            english
            romaji
            native
          }
          format
          status
          startDate {
            year
            month
            day
          }
          episodes
          coverImage {
            large
            color
          }
          averageScore
          season
          seasonYear
        }
      }
      ` : ''}
    }
  `;

  const token = await SecureStore.getItemAsync(STORAGE_KEY.AUTH_TOKEN);
  
  const response = await axios.post(
    ANILIST_API,
    {
      query,
      variables: { 
        id: parseInt(anilistId), 
        search: searchTitle 
      }
    },
    {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      },
      timeout: 30000
    }
  );

  const mainMedia = response.data.data.Media;
  const searchResults = response.data.data.Search?.media || [];
  
  // Extract related seasons from relations
  const relatedSeasons = mainMedia.relations.edges
    .filter((edge: any) => 
      ['SEQUEL', 'PREQUEL', 'SIDE_STORY', 'ALTERNATIVE'].includes(edge.relationType) &&
      edge.node.format === 'TV' &&
      edge.node.status !== 'CANCELLED'
    )
    .map((edge: any) => edge.node);

  // Combine main media with related seasons
  const allSeasons = [mainMedia, ...relatedSeasons];
  
  // If search results are provided, merge them with relation results
  if (searchResults.length > 0) {
    const baseTitle = mainMedia.title.romaji || mainMedia.title.english || mainMedia.title.userPreferred;
    const baseTitleWords = baseTitle.toLowerCase().split(/[\s:]+/);
    
    // Filter search results to only include likely seasons
    const filteredSearchResults = searchResults.filter((media: any) => {
      const mediaTitle = media.title.romaji || media.title.english || media.title.userPreferred;
      const mediaTitleLower = mediaTitle.toLowerCase();
      
      // Check if it contains the base title words
      const containsBaseWords = baseTitleWords.some((word: string) => 
        word.length > 2 && mediaTitleLower.includes(word)
      );
      
      // Check for season indicators
      const hasSeasonIndicator = /season|part|cour|series|\d+(?:st|nd|rd|th)|final|ova|movie/i.test(mediaTitle);
      
      return containsBaseWords && (hasSeasonIndicator || media.format === 'TV');
    });
    
    // Merge with existing seasons, avoiding duplicates
    filteredSearchResults.forEach((searchMedia: any) => {
      const exists = allSeasons.some(season => season.id === searchMedia.id);
      if (!exists) {
        allSeasons.push(searchMedia);
      }
    });
  }
  
  // Sort by start date
  const sortedSeasons = allSeasons.sort((a: any, b: any) => {
    const aDate = a.startDate;
    const bDate = b.startDate;
    
    if (!aDate || !bDate) return 0;
    
    const aYear = aDate.year || 0;
    const bYear = bDate.year || 0;
    const aMonth = aDate.month || 1;
    const bMonth = bDate.month || 1;
    const aDay = aDate.day || 1;
    const bDay = bDate.day || 1;
    
    if (aYear !== bYear) return aYear - bYear;
    if (aMonth !== bMonth) return aMonth - bMonth;
    return aDay - bDay;
  });
  
  return sortedSeasons;
}; 