# Zantaku Achievements System

The Zantaku app now includes a comprehensive achievements and streaks system to increase user engagement and retention. This document outlines how to use the new features and components.

## Database Setup

Before using the achievements system, you need to set up the database tables:

1. Navigate to the PostgreSQL admin interface for your Supabase project
2. Run the SQL migrations in the `db_migrations` folder:
   - `01_create_badges_tables.sql` - Creates tables for badges, user badges, and user streaks

## Available Components

### UserStreakCard

This component displays the user's current streak data, including:
- Current streak count (days in a row with activity)
- Whether they have activity today
- Number of badges earned

```jsx
import UserStreakCard from '../components/UserStreakCard';

// In your component:
<UserStreakCard 
  anilistId={123456} 
  todayActivity={true} 
  onPress={() => console.log('Card pressed')}
/>
```

### AchievementsDisplay

This component shows a filterable list of badges/achievements the user has earned or can earn.

```jsx
import AchievementsDisplay from '../components/AchievementsDisplay';

// In your component:
<AchievementsDisplay 
  userId="user-uuid-from-supabase" 
  anilistId={123456}
  onViewAllPress={() => navigation.navigate('Achievements')}
/>
```

### AchievementModal

This modal displays detailed information about a specific achievement.

```jsx
import AchievementModal from '../components/AchievementModal';
import { BadgeDisplay } from '../hooks/useRewards';

// In your component:
const [selectedBadge, setSelectedBadge] = useState<BadgeDisplay | null>(null);
const [modalVisible, setModalVisible] = useState(false);

// Show the modal
<AchievementModal
  visible={modalVisible}
  onClose={() => setModalVisible(false)}
  achievement={selectedBadge}
  onDismiss={() => {
    // Handle dismissal, e.g., mark as seen
    setModalVisible(false);
  }}
/>
```

### RewardBadge

Individual badge component used in lists:

```jsx
import RewardBadge from '../components/RewardBadge';

// In your component:
<RewardBadge
  icon="trophy"
  name="Achievement Name"
  description="Description of the achievement"
  color="#4CAF50"
  date="2025-04-15T12:00:00Z" // Optional, if unlocked
  onPress={() => handleBadgePress(badge)}
/>
```

## Hooks

### useUserStreak

This hook manages user streak data:

```tsx
import { useUserStreak } from '../hooks/useUserStreak';

// In your component:
const { 
  streakData,      // Current streak data
  isLoading,       // Loading state
  error,           // Error state
  checkStreak,     // Function to check and update streak
  resetStreak,     // Function to reset streak
  incrementStreak  // Function to manually increment streak
} = useUserStreak(anilistId);

// Check streak with activity today
checkStreak(true);
```

### useRewards

This hook manages user rewards/badges:

```tsx
import { useRewards, BadgeDisplay } from '../hooks/useRewards';

// In your component:
const { 
  getFormattedBadges,   // Get all badges with display info
  isLoading,           // Loading state
  awardBadge,          // Function to award a badge
  loadRewardsData,     // Function to reload rewards data
  getPrimaryBadge      // Get the most relevant badge to show
} = useRewards(userId);

// Get all badges
const badges = getFormattedBadges();

// Award a badge
awardBadge('badge-uuid', { proof: 'data' });
```

## Screens

### AchievementsScreen

A ready-to-use screen showing user achievements and statistics:

```jsx
import AchievementsScreen from '../screens/AchievementsScreen';

// In your navigation:
<Stack.Screen name="Achievements" component={AchievementsScreen} />
```

## Testing

Use the provided test scripts to verify functionality:

- `test-components.js` - Tests basic functionality of user streak and user data retrieval
- `test-rewards.js` - Tests creating rewards and awarding badges

Run with:
```bash
node test-rewards.js
```

## Database Tables

- `badges` - Stores achievement definitions
- `user_badges` - Maps users to their earned badges
- `user_streaks` - Tracks daily activity streaks for each user

## API Functions

The following functions are available for working with badges and streaks:

- `getUserStreakData(anilistId)` - Get streak data for a user
- `updateUserStreak(anilistId, streakData)` - Update streak values
- `checkAndUpdateStreak(anilistId, hasActivityToday)` - Check and update streak based on activity
- `getAllRewards()` - Get all available achievements
- `getUserRewards(userId)` - Get achievements earned by a user
- `assignRewardToUser(userId, rewardId, proofData)` - Award an achievement to a user

## Badge Types

Badges are categorized into three types:
- `anime` - Related to anime watching activities
- `manga` - Related to manga reading activities
- `combo` - Related to combined activities or general app usage 