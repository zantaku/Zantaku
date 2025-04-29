import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, FlatList, Alert } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useRewards, RewardDetail } from '../hooks/useRewards';
import ENV from '../config';

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

interface AchievementsListProps {
  userId: string;
  theme: any;
  newlyUnlockedRewards?: string[];
}

const AchievementsList: React.FC<AchievementsListProps> = ({ userId, theme, newlyUnlockedRewards }) => {
  const { rewards, isLoading, error, allRewards } = useRewards(userId);
  const [filter, setFilter] = useState<'all' | 'anime' | 'manga'>('all');
  const [filterOpen, setFilterOpen] = useState(false);
  const [fallbackRewardIds, setFallbackRewardIds] = useState<string[]>([]);
  const [randomQuest, setRandomQuest] = useState<any>(null);

  // Debug logs
  useEffect(() => {
    console.log('AchievementsList component - userId:', userId);
    console.log('AchievementsList received rewards:', {
      count: rewards.length,
      isLoading,
      error,
      rewards: rewards.map(r => ({ id: r.id, name: r.name }))
    });
    
    // Add check for allRewards
    if (allRewards && allRewards.length > 0) {
      console.log('AchievementsList has all potential rewards:', 
        allRewards.map(r => ({ id: r.id, name: r.name }))
      );
    }
    
    // Log if we have fallback reward IDs
    console.log('Fallback reward IDs:', fallbackRewardIds);
  }, [rewards, isLoading, error, userId, allRewards, fallbackRewardIds]);

  // Generate a random quest from available unlockable achievements
  const generateRandomQuest = () => {
    if (!allRewards || allRewards.length === 0) return;
    
    // Create a list of unlocked achievement IDs
    const unlockedIds = rewards.map(reward => reward.id);
    
    // Filter to only achievements that haven't been unlocked yet
    const unlockableAchievements = allRewards.filter(
      reward => !unlockedIds.includes(reward.id)
    );
    
    if (unlockableAchievements.length === 0) {
      setRandomQuest(null);
      return;
    }
    
    // Pick a random unlockable achievement
    const randomIndex = Math.floor(Math.random() * unlockableAchievements.length);
    setRandomQuest(unlockableAchievements[randomIndex]);
    
    console.log('Generated random quest:', unlockableAchievements[randomIndex]);
  };

  // Initialize random quest
  useEffect(() => {
    if (allRewards && allRewards.length > 0 && !randomQuest) {
      console.log('Initializing random quest from', allRewards.length, 'possible achievements');
      generateRandomQuest();
    }
  }, [allRewards, randomQuest]);

  // Add code to check for known reward IDs if rewards array is empty
  const checkForUserRewards = async () => {
    try {
      console.log('Manually checking for user rewards in AchievementsList');
      // Implement direct check for user rewards
      const response = await fetch(`${ENV.SUPABASE_URL}/rest/v1/user_rewards?user_id=eq.${userId}`, {
        method: 'GET',
        headers: {
          'apikey': ENV.SUPABASE_ANON_KEY,
          'Accept': 'application/json'
        }
      });
      
      if (!response.ok) {
        console.error('Error checking for user rewards:', response.statusText);
        return [];
      }
      
      const data = await response.json();
      console.log(`Found ${data.length} user rewards directly from the API`, data);
      
      if (data.length > 0) {
        // We have reward IDs but no details, so show fallback UI
        return data.map((item: any) => item.reward_id);
      }
    } catch (error) {
      console.error('Error in checkForUserRewards:', error);
    }
    return [];
  };

  // Use effect to load fallback rewards
  useEffect(() => {
    const loadFallbackRewards = async () => {
      const ids = await checkForUserRewards();
      setFallbackRewardIds(ids);
    };
    
    if (rewards.length === 0 && !isLoading) {
      loadFallbackRewards();
    }
  }, [rewards.length, isLoading, userId]);

  // Make sure to forcefully show the rewards if we have them in any form
  const forceShowRewards = rewards.length > 0 || fallbackRewardIds.length > 0;

  // If we have an error loading rewards
  if (error && rewards.length === 0) {
    return (
      <View style={styles.errorContainer}>
        <FontAwesome5 name="exclamation-circle" size={24} color="#FF5252" />
        <Text style={[styles.errorText, { color: theme.colors.text }]}>
          {error}
        </Text>
        <Text style={[styles.errorSubtext, { color: theme.colors.textSecondary }]}>
          Please try again later
        </Text>
      </View>
    );
  }

  // If we're still loading
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>
          Loading your achievements...
        </Text>
      </View>
    );
  }

  // If no rewards found but we have fallback IDs, show them
  if ((rewards.length === 0 && fallbackRewardIds.length > 0) || (forceShowRewards && rewards.length === 0)) {
    console.log('Rendering using fallback IDs or forcing display');
    return (
      <View style={styles.container}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text, marginBottom: 16 }]}>
          Your Achievements ({fallbackRewardIds.length || rewards.length})
        </Text>
        
        {fallbackRewardIds.map((id, index) => (
          <View key={id} style={[styles.rewardCard, { backgroundColor: theme.colors.card }]}>
            <View style={[
              styles.iconContainer,
              { backgroundColor: ['#2196F3', '#4CAF50', '#9C27B0', '#FF9800', '#F44336'][index % 5] }
            ]}>
              <FontAwesome5 
                name={['trophy', 'medal', 'star', 'award', 'crown'][index % 5]} 
                size={24} 
                color="#FFFFFF"
                solid
              />
            </View>
            <View style={styles.rewardDetails}>
              <Text style={[styles.rewardName, { color: theme.colors.text }]}>
                Achievement #{index + 1}
              </Text>
              <Text style={[styles.rewardDescription, { color: theme.colors.textSecondary }]}>
                ID: {id.substring(0, 8)}...
              </Text>
            </View>
          </View>
        ))}
      </View>
    );
  }
  
  // If no rewards found
  if (rewards.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <FontAwesome5 name="trophy" size={40} color={theme.colors.textSecondary} />
        <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>
          No Achievements Yet
        </Text>
        <Text style={[styles.emptySubtitle, { color: theme.colors.textSecondary }]}>
          Keep watching anime and reading manga to earn badges!
        </Text>
      </View>
    );
  }

  // Function to render a filter dropdown
  const renderFilterDropdown = () => (
    <View style={styles.filterContainer}>
      <Text style={[styles.filterLabel, { color: theme.colors.textSecondary }]}>
        Show:
      </Text>
      <TouchableOpacity
        style={[styles.filterButton, { backgroundColor: theme.colors.card }]}
        onPress={() => setFilterOpen(!filterOpen)}
      >
        <Text style={[styles.filterText, { color: theme.colors.text }]}>
          {filter === 'all' ? 'All' : filter === 'anime' ? 'Anime Only' : 'Manga Only'}
        </Text>
        <FontAwesome5 
          name="chevron-down" 
          size={12} 
          color={theme.colors.textSecondary} 
        />
      </TouchableOpacity>

      {filterOpen && (
        <View style={[styles.dropdown, { backgroundColor: theme.colors.card }]}>
          <TouchableOpacity 
            style={styles.dropdownItem}
            onPress={() => {
              setFilter('all');
              setFilterOpen(false);
            }}
          >
            <Text style={[styles.dropdownText, { 
              color: filter === 'all' ? theme.colors.primary : theme.colors.text
            }]}>
              All
            </Text>
            {filter === 'all' && <FontAwesome5 name="check" size={12} color={theme.colors.primary} />}
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.dropdownItem}
            onPress={() => {
              setFilter('anime');
              setFilterOpen(false);
            }}
          >
            <Text style={[styles.dropdownText, { 
              color: filter === 'anime' ? theme.colors.primary : theme.colors.text
            }]}>
              Anime Only
            </Text>
            {filter === 'anime' && <FontAwesome5 name="check" size={12} color={theme.colors.primary} />}
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.dropdownItem}
            onPress={() => {
              setFilter('manga');
              setFilterOpen(false);
            }}
          >
            <Text style={[styles.dropdownText, { 
              color: filter === 'manga' ? theme.colors.primary : theme.colors.text
            }]}>
              Manga Only
            </Text>
            {filter === 'manga' && <FontAwesome5 name="check" size={12} color={theme.colors.primary} />}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  // Group rewards by type
  const animeRewards = rewards.filter(r => r.type === 'anime');
  const mangaRewards = rewards.filter(r => r.type === 'manga');
  const comboRewards = rewards.filter(r => r.type === 'combo');

  // Filter based on selected filter
  const filteredRewards = filter === 'all' ? rewards : 
                          filter === 'anime' ? [...animeRewards, ...comboRewards] : 
                          [...mangaRewards, ...comboRewards];

  // Fix the renderSection function to use unique keys
  const renderSection = (title: string, data: RewardDetail[]) => {
    if (data.length === 0) return null;

    // Use a unique key based on the section type
    const sectionKey = title || `section-${data[0]?.type || Math.random().toString(36).substring(7)}`;

    return (
      <View style={styles.section} key={sectionKey}>
        {title && (
          <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}>
            {title}
          </Text>
        )}
        {data.map(reward => {
          // Direct rendering with key prop on the TouchableOpacity
          const unlockDate = reward.unlocked_at ? new Date(reward.unlocked_at) : new Date();
          const formattedDate = unlockDate.toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric' 
          });

          return (
            <TouchableOpacity 
              key={reward.id}
              style={[styles.rewardCard, { backgroundColor: theme.colors.card }]}
              onPress={() => Alert.alert(reward.name, reward.description)}
            >
              <View style={[
                styles.iconContainer, 
                { backgroundColor: BADGE_COLORS[reward.name] || BADGE_COLORS.default }
              ]}>
                <FontAwesome5 
                  name={BADGE_ICONS[reward.name] || BADGE_ICONS.default} 
                  size={24} 
                  color="#FFFFFF" 
                  solid 
                />
              </View>
              <View style={styles.rewardDetails}>
                <Text style={[styles.rewardName, { color: theme.colors.text }]}>
                  {reward.name}
                </Text>
                <Text style={[styles.rewardDescription, { color: theme.colors.textSecondary }]}>
                  {reward.description}
                </Text>
                <Text style={[styles.unlockDate, { color: theme.colors.textTertiary }]}>
                  Unlocked on {formattedDate}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  // Add back the renderReward function for FlatList
  const renderReward = ({ item }: { item: RewardDetail }) => {
    const unlockDate = item.unlocked_at ? new Date(item.unlocked_at) : new Date();
    const formattedDate = unlockDate.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });

    return (
      <TouchableOpacity 
        key={item.id}
        style={[styles.rewardCard, { backgroundColor: theme.colors.card }]}
        onPress={() => Alert.alert(item.name, item.description)}
      >
        <View style={[
          styles.iconContainer, 
          { backgroundColor: BADGE_COLORS[item.name] || BADGE_COLORS.default }
        ]}>
          <FontAwesome5 
            name={BADGE_ICONS[item.name] || BADGE_ICONS.default} 
            size={24} 
            color="#FFFFFF" 
            solid 
          />
        </View>
        <View style={styles.rewardDetails}>
          <Text style={[styles.rewardName, { color: theme.colors.text }]}>
            {item.name}
          </Text>
          <Text style={[styles.rewardDescription, { color: theme.colors.textSecondary }]}>
            {item.description}
          </Text>
          <Text style={[styles.unlockDate, { color: theme.colors.textTertiary }]}>
            Unlocked on {formattedDate}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  // Render the quest tracker
  const renderQuestTracker = () => {
    if (!randomQuest) {
      return (
        <View style={[styles.questCard, { backgroundColor: theme.colors.card }]}>
          <FontAwesome5 name="trophy" size={24} color={theme.colors.textSecondary} style={{ marginBottom: 12 }} />
          <Text style={[styles.emptyQuestText, { color: theme.colors.textSecondary }]}>
            You've unlocked all achievements! Great job!
          </Text>
        </View>
      );
    }
    
    return (
      <View style={[styles.questCard, { backgroundColor: theme.colors.card }]}>
        <View style={[
          styles.questIconContainer, 
          { backgroundColor: BADGE_COLORS[randomQuest.name] || BADGE_COLORS.default }
        ]}>
          <FontAwesome5 
            name={BADGE_ICONS[randomQuest.name] || BADGE_ICONS.default} 
            size={24} 
            color="#FFFFFF" 
            solid 
          />
        </View>
        <View style={styles.questInfo}>
          <Text style={[styles.questName, { color: theme.colors.text }]}>
            {randomQuest.name}
          </Text>
          <Text style={[styles.questDescription, { color: theme.colors.textSecondary }]}>
            {randomQuest.description}
          </Text>
        </View>
      </View>
    );
  };

  // If we know we should have rewards, but they're just not showing properly
  if (forceShowRewards && rewards.length === 0 && !fallbackRewardIds.length) {
    // Get achievement IDs from newlyUnlockedRewards (defined in parent component)
    const knownIds = newlyUnlockedRewards ? newlyUnlockedRewards.map((id, index) => ({
      id,
      name: `Achievement #${index + 1}`
    })) : [];
    
    console.log('Forcing display of achievements using:', knownIds);
    
    if (knownIds.length > 0) {
      return (
        <View style={styles.container}>
          {/* Header with filter */}
          <View style={styles.header}>
            <Text style={[styles.title, { color: theme.colors.text }]}>
              Achievements
            </Text>
            {renderFilterDropdown()}
          </View>
          
          {/* Quest Tracker */}
          <View style={styles.sectionContainer}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionHeaderText, { color: theme.colors.text }]}>
                Quest Tracker
              </Text>
              <TouchableOpacity
                style={[styles.randomButton, { backgroundColor: theme.colors.primary }]}
                onPress={generateRandomQuest}
              >
                <FontAwesome5 name="random" size={14} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.randomButtonText}>Random</Text>
              </TouchableOpacity>
            </View>
            {renderQuestTracker()}
            <Text style={[styles.tapToDismiss, { color: theme.colors.textSecondary }]}>
              Tap to dismiss
            </Text>
          </View>
          
          {/* Achievements List */}
          <View style={styles.achievementsContainer}>
            <Text style={[styles.categoryHeader, { color: theme.colors.text }]}>
              Your Achievements ({knownIds.length})
            </Text>
            {knownIds.map((achievement, index) => (
              <View key={achievement.id} style={[styles.rewardCard, { backgroundColor: theme.colors.card }]}>
                <View style={[
                  styles.iconContainer,
                  { backgroundColor: ['#2196F3', '#4CAF50', '#9C27B0', '#FF9800', '#F44336'][index % 5] }
                ]}>
                  <FontAwesome5 
                    name={['trophy', 'medal', 'star', 'award', 'crown'][index % 5]} 
                    size={24} 
                    color="#FFFFFF"
                    solid
                  />
                </View>
                <View style={styles.rewardDetails}>
                  <Text style={[styles.rewardName, { color: theme.colors.text }]}>
                    {achievement.name}
                  </Text>
                  <Text style={[styles.rewardDescription, { color: theme.colors.textSecondary }]}>
                    ID: {achievement.id.substring(0, 8)}...
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      );
    }
  }

  return (
    <View style={styles.container}>
      {/* Header with filter */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.colors.text }]}>
          Achievements
        </Text>
        {renderFilterDropdown()}
      </View>
      
      {/* Quest Tracker */}
      <View style={styles.sectionContainer}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionHeaderText, { color: theme.colors.text }]}>
            Quest Tracker
          </Text>
          <TouchableOpacity
            style={[styles.randomButton, { backgroundColor: theme.colors.primary }]}
            onPress={generateRandomQuest}
          >
            <FontAwesome5 name="random" size={14} color="#FFFFFF" style={{ marginRight: 6 }} />
            <Text style={styles.randomButtonText}>Random</Text>
          </TouchableOpacity>
        </View>
        {renderQuestTracker()}
        <Text style={[styles.tapToDismiss, { color: theme.colors.textSecondary }]}>
          Tap to dismiss
        </Text>
      </View>
      
      {/* Achievements List */}
      <View style={styles.achievementsContainer}>
        {filter === 'all' ? (
          <>
            {animeRewards.length > 0 && (
              <View key="anime-section">
                <Text style={[styles.categoryHeader, { color: theme.colors.text }]}>
                  Anime Achievements
                </Text>
                {renderSection('anime-rewards', animeRewards)}
              </View>
            )}
            
            {mangaRewards.length > 0 && (
              <View key="manga-section">
                <Text style={[styles.categoryHeader, { color: theme.colors.text }]}>
                  Manga Achievements
                </Text>
                {renderSection('manga-rewards', mangaRewards)}
              </View>
            )}
            
            {comboRewards.length > 0 && (
              <View key="combo-section">
                <Text style={[styles.categoryHeader, { color: theme.colors.text }]}>
                  Combo Achievements
                </Text>
                {renderSection('combo-rewards', comboRewards)}
              </View>
            )}
          </>
        ) : (
          <FlatList
            data={filteredRewards}
            renderItem={renderReward}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
                No achievements found for this filter
              </Text>
            }
          />
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  sectionContainer: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionHeaderText: {
    fontSize: 18,
    fontWeight: '600',
  },
  randomButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  randomButtonText: {
    color: '#FFFFFF',
    fontWeight: '500',
    fontSize: 14,
  },
  questCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  questIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  questInfo: {
    flex: 1,
  },
  questName: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  questDescription: {
    fontSize: 14,
  },
  emptyQuestText: {
    textAlign: 'center',
    fontSize: 14,
    paddingHorizontal: 16,
  },
  tapToDismiss: {
    textAlign: 'center',
    fontSize: 12,
    marginTop: 8,
    fontStyle: 'italic',
  },
  achievementsContainer: {
    flex: 1,
  },
  categoryHeader: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
    marginTop: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorText: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: '600',
  },
  errorSubtext: {
    marginTop: 8,
    fontSize: 14,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyTitle: {
    marginTop: 16,
    fontSize: 20,
    fontWeight: 'bold',
  },
  emptySubtitle: {
    marginTop: 8,
    fontSize: 16,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 20,
    fontSize: 16,
  },
  filterContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
    zIndex: 10,
  },
  filterLabel: {
    fontSize: 16,
    marginRight: 8,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 120,
  },
  filterText: {
    fontSize: 14,
    fontWeight: '500',
    marginRight: 8,
  },
  dropdown: {
    position: 'absolute',
    top: 40,
    left: 40,
    width: 150,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    zIndex: 20,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  dropdownText: {
    fontSize: 14,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  list: {
    paddingBottom: 20,
  },
  rewardCard: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  rewardDetails: {
    flex: 1,
    justifyContent: 'center',
  },
  rewardName: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  rewardDescription: {
    fontSize: 14,
    marginBottom: 4,
  },
  unlockDate: {
    fontSize: 12,
  },
});

export default AchievementsList; 