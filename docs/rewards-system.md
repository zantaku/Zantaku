# AniList Rewards System

This document explains the rewards/badges system that tracks user achievements based on their AniList activity.

## Overview

The rewards system consists of:

1. Database tables in Supabase to store rewards and user achievements
2. A React hook to access and display rewards in the UI
3. Logic to check and assign rewards based on user activity
4. A background function to periodically check for new rewards

## Streak System

The streak system tracks users' daily engagement with anime and manga content. It's designed to encourage consistent activity and reward users for maintaining their engagement.

### How Streaks Work

1. **Activity Types**
   - `anime`: When user only watches anime in a day
   - `manga`: When user only reads manga in a day
   - `combo`: When user both watches anime AND reads manga in a day
   - `none`: When no activity is recorded

2. **Streak Counting**
   - A streak day is counted when a user has any anime or manga activity
   - Activities include: updating progress, completing episodes/chapters, or changing status
   - The streak counter increases by 1 for each consecutive day with activity
   - Streaks reset to 0 if a day is missed

3. **Streak Updates**
   - Streaks are checked and updated every time the user:
     - Opens the app and views their profile
     - Updates their anime/manga progress
     - Changes the status of any media
   - To prevent excessive API calls, updates are cached for 4 hours
   - After 4 hours, the next user action will trigger a new streak check

4. **Maintaining Streaks**
   - To maintain a streak, users must:
     - Have at least one activity every day (before midnight in their timezone)
     - Update their progress on either anime or manga
     - Log the activity through the app or AniList website
   - Users have until the end of the current day to log activity to maintain their streak
   - If no activity is logged by midnight, the streak resets

5. **Streak Data**
   - Current streak: Number of consecutive days with activity
   - Longest streak: Highest streak achieved
   - Activity type: Primary type of content engaged with
   - Last active: Timestamp of most recent activity

6. **Grace Period**
   - Users have until midnight in their timezone to log activity for the current day
   - Activity logged for the previous day (backfilling) does not count towards streaks
   - The system uses the activity's creation timestamp, not the timestamp of the content consumed

7. **Streak Display**
   - Streaks are displayed in multiple locations:
     - Profile page (detailed view)
     - Welcome section (compact view)
     - As badges next to usernames
   - The streak badge color indicates the activity type:
     - Blue: Anime
     - Green: Manga
     - Purple: Combo
     - Orange: Default/Fire

### Tips for Users

1. **Maintaining Streaks**
   - Log at least one episode or chapter each day
   - Use the app to track progress in real-time
   - Check the streak badge to confirm activity was counted
   - Try to log activity before the end of your day

2. **Optimal Strategy**
   - Mix anime and manga activity to earn "combo" status
   - Log activity as you consume content, don't wait until later
   - Keep the app updated to ensure accurate tracking
   - Check your profile to verify streak counting

3. **Troubleshooting**
   - If streak seems incorrect, wait 4 hours for cache to clear
   - Verify activity timestamps on your AniList profile
   - Ensure app has proper permissions to fetch activity data
   - Contact support if streak tracking seems inaccurate

## Achievements System

The achievements system rewards users for their engagement with anime and manga content. Achievements are displayed as badges that users can collect and showcase on their profile.

### Achievement Categories

#### Anime Achievements
- **Binge Master**: Watch 50+ episodes in a week
- **Opening Skipper**: Skip 100 opening sequences
- **Late Night Otaku**: Watch anime between 12 AM and 4 AM
- **First Episode Fever**: Start 10 new anime series
- **Season Slayer**: Complete a 12-episode season within 48 hours

#### Manga Achievements
- **Power Reader**: Read 100+ chapters in a week
- **Panel Hopper**: Read manga from 5 different genres
- **Chapter Clutch**: Complete a volume (8+ chapters) in 24 hours
- **Cliffhanger Addict**: Read ongoing series weekly
- **Silent Protagonist**: Read 50+ chapters of a manga with minimal dialogue

#### Combo Achievements
- **Dual Wielder**: Watch 20+ episodes AND read 20+ chapters in one week
- **Otaku Mode: ON**: Maintain a 7-day streak in both anime and manga
- **Multiverse Traveler**: Complete series from 3 different countries
- **Weekend Warrior**: 12+ hours of combined anime/manga activity on weekends
- **The Completionist**: Finish 1 anime season and 1 manga volume in a month

### How to Earn Achievements

1. **Activity Tracking**
   - Achievements are automatically tracked based on your AniList activity
   - Progress is updated in real-time as you watch episodes or read chapters
   - Some achievements require consistent activity over time

2. **Viewing Your Achievements**
   - Access your achievements through the Settings > Achievements screen
   - View detailed requirements and progress for each achievement
   - See when you unlocked each achievement

3. **Tips for Success**
   - Log your activity regularly to ensure accurate tracking
   - Mix different types of content to unlock combo achievements
   - Check your profile regularly to track your progress
   - Try to maintain daily streaks for streak-based achievements

### Future Updates

More achievements will be added regularly to provide new challenges and rewards. Future updates may include:
- Seasonal achievements tied to currently airing anime
- Community achievements for social interactions
- Special event achievements during holidays or anime conventions
- Tiered achievements with bronze, silver, and gold variants

## Supabase Tables

### rewards

This table stores all possible rewards/badges that users can earn:

| Column          | Type        | Description                                     |
|-----------------|-------------|-------------------------------------------------|
| id              | uuid        | Primary key                                     |
| name            | text        | Badge name (e.g., "Binge Master")               |
| type            | text        | Category: 'anime', 'manga', or 'combo'          |
| description     | text        | What the user did to earn this badge            |
| icon_url        | text        | Optional URL to a custom badge icon (currently null) |
| unlock_criteria | jsonb       | JSON object with specific criteria to unlock    |
| created_at      | timestamptz | When this reward was added to the system        |

### user_rewards

This table tracks which rewards each user has unlocked:

| Column      | Type        | Description                                     |
|-------------|-------------|-------------------------------------------------|
| id          | uuid        | Primary key                                     |
| user_id     | uuid        | References anilist_users.id                     |
| reward_id   | uuid        | References rewards.id                           |
| unlocked_at | timestamptz | When the user earned this badge                 |
| proof_data  | jsonb       | JSON data that proves how the reward was earned |

## Available Rewards

### Anime Rewards
| Badge             | Trigger                                        |
|-------------------|------------------------------------------------|
| Binge Master      | Watch 50+ episodes in a week                   |
| Opening Skipper   | Skip intros on 20+ episodes                    |
| Late Night Otaku  | Watch anime between 1AM–5AM, 3+ times          |
| First Episode Fever | Watch first episode of 10 different shows in a week |
| Season Slayer     | Finish a 12-episode season in 48 hours         |

### Manga Rewards
| Badge             | Trigger                                        |
|-------------------|------------------------------------------------|
| Power Reader      | Read 100+ chapters in a week                   |
| Panel Hopper      | Read 10 different manga series in a month      |
| Chapter Clutch    | Finish a volume (8+ chapters) in 24 hrs        |
| Cliffhanger Addict | Read 3+ ongoing manga series                  |
| Silent Protagonist | Read for 10+ hours without audio total        |

### Combo Rewards
| Badge             | Trigger                                        |
|-------------------|------------------------------------------------|
| Dual Wielder      | 20+ episodes AND 20+ chapters in one week      |
| Otaku Mode: ON    | 1000+ total minutes logged (anime + manga)     |
| Multiverse Traveler | Watch and read same title                     |
| Weekend Warrior   | 10+ entries watched/read in a single weekend   |
| The Completionist | Finish 1 anime season and 1 manga volume in a month |

## Implementation

### 1. Seeding Rewards

To seed the rewards table with initial data, run:

```bash
node scripts/seedRewards.js
```

### 2. Using the Rewards Hook

The `useRewards` hook provides access to rewards data in React components:

```jsx
import { useRewards } from '../hooks/useRewards';

function MyComponent() {
  const { 
    allRewards,          // All available rewards
    userRewards,         // Rewards the user has unlocked
    getFormattedBadges,  // Get badges formatted for display
    getPrimaryBadge,     // Get the primary badge to show
    checkAndAssignRewards // Check if user qualifies for new rewards
  } = useRewards(userId);
  
  // Get a badge to display
  const badge = getPrimaryBadge();
  
  return (
    <div>
      {badge && (
        <Badge 
          name={badge.name}
          icon={badge.icon}
          color={badge.color}
          description={badge.description}
        />
      )}
    </div>
  );
}
```

### 3. Checking and Assigning Rewards

Rewards can be checked and assigned in two ways:

1. **Client-side**: Using the `checkAndAssignRewards` function from the hook.
2. **Server-side**: Using the Supabase Edge Function.

#### Client-side Example

```jsx
// Inside a component
useEffect(() => {
  const checkRewards = async () => {
    const userStats = {
      weeklyEpisodes: 55,      // Watched 55 episodes this week
      weeklyChapters: 30,      // Read 30 chapters this week
      totalMinutes: 1200,      // Watched 1200 minutes total
      // ... other stats
    };
    
    // This will check if the user qualifies for any new rewards
    // and automatically assign them in Supabase
    const newRewards = await checkAndAssignRewards(userStats);
    
    if (newRewards.length > 0) {
      // Show notification or celebration
    }
  };
  
  checkRewards();
}, []);
```

### 4. Scheduling Background Checks

The Supabase Edge Function `check-rewards` can be scheduled to run periodically:

```bash
# Deploy the Edge Function
supabase functions deploy check-rewards

# Set up a cron job to run it weekly
supabase functions schedule 'check-rewards' --cron "0 0 * * 0"
```

## UI Integration

The WelcomeSection component has been updated to display achievement badges from Supabase. It will:

1. Fetch and show the user's most recently earned badge, or
2. Show a badge they're close to earning as motivation, or
3. Fall back to the existing badge system if no Supabase rewards exist yet

## Next Steps

1. **Tracking Advanced Metrics**: Some badges require additional tracking that's not available from AniList directly (like skipping intros). Consider adding this tracking to the app.

2. **Custom Badge Icons**: Update badges with custom icons by setting the `icon_url` field.

3. **Notifications**: Add notifications when users earn new badges.

4. **Badge Display**: Create a dedicated badges/achievements page to display all earned and locked badges.

5. **Testing**: Test the reward criteria to ensure they trigger correctly based on user activity. 