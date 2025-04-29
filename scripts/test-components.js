const { getUserStreakData } = require('../lib/userStreaks');
const { getAnilistUser } = require('../lib/supabase');
const { getRewardsForUser } = require('../lib/rewards');

async function testComponents() {
  try {
    console.log('Testing getAnilistUser function...');
    const user = await getAnilistUser(6385187);
    console.log('User data:', user);
    
    console.log('\nTesting getUserStreakData function...');
    const streakData = await getUserStreakData(6385187);
    console.log('Streak data:', streakData);
    
    console.log('\nTesting getRewardsForUser function...');
    const rewards = await getRewardsForUser(6385187);
    console.log('Rewards:', rewards);
  } catch (error) {
    console.error('Error during testing:', error);
  }
}

testComponents(); 