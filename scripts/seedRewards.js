// Script to seed rewards into Supabase
require('dotenv').config({ path: '../.env' });
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Define rewards data for the 15 badge types
const rewardsData = [
  // Anime Rewards
  {
    name: 'Binge Master',
    type: 'anime',
    description: 'Watch 50+ episodes in a week',
    icon_url: null, // Using FontAwesome5 icon 'play' as fallback
    unlock_criteria: { weeklyEpisodes: 50 }
  },
  {
    name: 'Opening Skipper',
    type: 'anime',
    description: 'Skip intros on 20+ episodes',
    icon_url: null, // Using FontAwesome5 icon 'fast-forward' as fallback
    unlock_criteria: { skippedIntros: 20 }
  },
  {
    name: 'Late Night Otaku',
    type: 'anime',
    description: 'Watch anime between 1AM–5AM, 3+ times',
    icon_url: null, // Using FontAwesome5 icon 'moon' as fallback
    unlock_criteria: { lateNightCount: 3 }
  },
  {
    name: 'First Episode Fever',
    type: 'anime',
    description: 'Watch the first episode of 10 different shows in a week',
    icon_url: null, // Using FontAwesome5 icon 'tv' as fallback
    unlock_criteria: { firstEpisodesWeek: 10 }
  },
  {
    name: 'Season Slayer',
    type: 'anime',
    description: 'Finish a full 12-episode season in 48 hrs',
    icon_url: null, // Using FontAwesome5 icon 'calendar-check' as fallback
    unlock_criteria: { seasonIn48h: true }
  },
  
  // Manga Rewards
  {
    name: 'Power Reader',
    type: 'manga',
    description: 'Read 100+ chapters in a week',
    icon_url: null, // Using FontAwesome5 icon 'book' as fallback
    unlock_criteria: { weeklyChapters: 100 }
  },
  {
    name: 'Panel Hopper',
    type: 'manga',
    description: 'Read 10 different manga series in a month',
    icon_url: null, // Using FontAwesome5 icon 'arrows-alt' as fallback
    unlock_criteria: { monthlyMangaSeries: 10 }
  },
  {
    name: 'Chapter Clutch',
    type: 'manga',
    description: 'Finish an entire manga volume (8+ chapters) in 24 hrs',
    icon_url: null, // Using FontAwesome5 icon 'bolt' as fallback
    unlock_criteria: { volumeIn24h: true }
  },
  {
    name: 'Cliffhanger Addict',
    type: 'manga',
    description: 'Read 3+ ongoing manga series',
    icon_url: null, // Using FontAwesome5 icon 'mountain' as fallback
    unlock_criteria: { ongoingManga: 3 }
  },
  {
    name: 'Silent Protagonist',
    type: 'manga',
    description: 'Read manga for 10+ hours without audio',
    icon_url: null, // Using FontAwesome5 icon 'volume-mute' as fallback
    unlock_criteria: { readingHours: 10 }
  },
  
  // Combo Rewards
  {
    name: 'Dual Wielder',
    type: 'combo',
    description: 'Watch 20+ episodes AND read 20+ chapters in one week',
    icon_url: null, // Using FontAwesome5 icon 'gamepad' as fallback
    unlock_criteria: { weeklyEpisodes: 20, weeklyChapters: 20 }
  },
  {
    name: 'Otaku Mode: ON',
    type: 'combo',
    description: 'Log 1000+ total minutes of anime + manga',
    icon_url: null, // Using FontAwesome5 icon 'toggle-on' as fallback
    unlock_criteria: { totalMinutes: 1000 }
  },
  {
    name: 'Multiverse Traveler',
    type: 'combo',
    description: 'Watch and read the same title (anime & manga)',
    icon_url: null, // Using FontAwesome5 icon 'globe-asia' as fallback
    unlock_criteria: { matchTitle: true }
  },
  {
    name: 'Weekend Warrior',
    type: 'combo',
    description: 'Watch/read 10+ entries over a single weekend',
    icon_url: null, // Using FontAwesome5 icon 'calendar-week' as fallback
    unlock_criteria: { weekendEntries: 10 }
  },
  {
    name: 'The Completionist',
    type: 'combo',
    description: 'Finish 1 anime season and 1 manga volume in a month',
    icon_url: null, // Using FontAwesome5 icon 'trophy' as fallback
    unlock_criteria: { completedSeason: true, completedVolume: true }
  }
];

// Function to seed the rewards table
async function seedRewards() {
  console.log('Seeding rewards table...');
  
  // Upsert all rewards
  const { data, error } = await supabase
    .from('rewards')
    .upsert(
      rewardsData.map(reward => ({
        ...reward,
        unlock_criteria: JSON.stringify(reward.unlock_criteria)
      })),
      { onConflict: 'name' }
    );
    
  if (error) {
    console.error('Error seeding rewards:', error);
    return false;
  }
  
  console.log(`Successfully seeded ${rewardsData.length} rewards!`);
  return true;
}

// Run the seeder
seedRewards()
  .then(success => {
    if (success) {
      console.log('Rewards seeding completed successfully.');
    } else {
      console.error('Rewards seeding failed.');
    }
    process.exit(success ? 0 : 1);
  })
  .catch(err => {
    console.error('Unexpected error during seeding:', err);
    process.exit(1);
  }); 