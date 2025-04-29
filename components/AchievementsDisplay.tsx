import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Dimensions } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { useRewards, BadgeDisplay } from '../hooks/useRewards';
import RewardBadge from './RewardBadge';
import AchievementModal from './AchievementModal';

interface AchievementsDisplayProps {
  userId?: string;
  anilistId?: number;
  onViewAllPress?: () => void;
}

const AchievementsDisplay: React.FC<AchievementsDisplayProps> = ({
  userId,
  anilistId,
  onViewAllPress
}) => {
  const { currentTheme } = useTheme();
  const { getFormattedBadges, isLoading } = useRewards(userId);
  const [selectedBadge, setSelectedBadge] = useState<BadgeDisplay | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unlocked' | 'locked'>('all');
  
  // Get all badges and filter based on current filter
  const badges = getFormattedBadges().filter(badge => {
    if (filter === 'all') return true;
    if (filter === 'unlocked') return badge.unlocked;
    if (filter === 'locked') return !badge.unlocked;
    return true;
  });
  
  // Sort badges - unlocked first, then by name
  const sortedBadges = [...badges].sort((a, b) => {
    // Always show unlocked badges first
    if (a.unlocked && !b.unlocked) return -1;
    if (!a.unlocked && b.unlocked) return 1;
    
    // Within each group, sort by name
    return a.name.localeCompare(b.name);
  });
  
  const openBadgeDetails = (badge: BadgeDisplay) => {
    setSelectedBadge(badge);
    setModalVisible(true);
  };
  
  const closeBadgeDetails = () => {
    setModalVisible(false);
  };
  
  const renderFilterTab = (label: string, value: 'all' | 'unlocked' | 'locked') => {
    const isActive = filter === value;
    
    return (
      <TouchableOpacity
        style={[
          styles.filterTab,
          isActive && { backgroundColor: currentTheme.colors.primary }
        ]}
        onPress={() => setFilter(value)}
      >
        <Text
          style={[
            styles.filterText,
            { color: isActive ? '#FFFFFF' : currentTheme.colors.text }
          ]}
        >
          {label}
        </Text>
      </TouchableOpacity>
    );
  };
  
  const renderEmptyState = () => {
    if (isLoading) {
      return (
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyText, { color: currentTheme.colors.textSecondary }]}>
            Loading achievements...
          </Text>
        </View>
      );
    }
    
    if (filter === 'unlocked') {
      return (
        <View style={styles.emptyContainer}>
          <FontAwesome5 name="trophy" size={48} color="#BDBDBD" style={styles.emptyIcon} />
          <Text style={[styles.emptyText, { color: currentTheme.colors.textSecondary }]}>
            You haven't unlocked any achievements yet.
          </Text>
          <Text style={[styles.emptySubText, { color: currentTheme.colors.textSecondary }]}>
            Keep watching and reading to earn badges!
          </Text>
        </View>
      );
    }
    
    if (badges.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <FontAwesome5 name="medal" size={48} color="#BDBDBD" style={styles.emptyIcon} />
          <Text style={[styles.emptyText, { color: currentTheme.colors.textSecondary }]}>
            No achievements available.
          </Text>
          <Text style={[styles.emptySubText, { color: currentTheme.colors.textSecondary }]}>
            Check back later for new challenges!
          </Text>
        </View>
      );
    }
    
    return null;
  };
  
  const renderBadge = ({ item }: { item: BadgeDisplay }) => {
    return (
      <RewardBadge
        icon={item.icon}
        name={item.name}
        description={item.description}
        color={item.color}
        date={item.unlocked_at}
        onPress={() => openBadgeDetails(item)}
      />
    );
  };
  
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: currentTheme.colors.text }]}>
          Achievements
        </Text>
        
        {onViewAllPress && (
          <TouchableOpacity onPress={onViewAllPress}>
            <Text style={[styles.viewAll, { color: currentTheme.colors.primary }]}>
              View All
            </Text>
          </TouchableOpacity>
        )}
      </View>
      
      <View style={styles.filterContainer}>
        {renderFilterTab('All', 'all')}
        {renderFilterTab('Unlocked', 'unlocked')}
        {renderFilterTab('Locked', 'locked')}
      </View>
      
      {renderEmptyState() || (
        <FlatList
          data={sortedBadges}
          renderItem={renderBadge}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.badgeList}
          showsVerticalScrollIndicator={false}
        />
      )}
      
      <AchievementModal
        visible={modalVisible}
        onClose={closeBadgeDetails}
        achievement={selectedBadge}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  viewAll: {
    fontSize: 14,
    fontWeight: '600',
  },
  filterContainer: {
    flexDirection: 'row',
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  filterTab: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    marginRight: 8,
  },
  filterText: {
    fontSize: 14,
    fontWeight: '500',
  },
  badgeList: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  emptyContainer: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyIcon: {
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubText: {
    fontSize: 14,
    textAlign: 'center',
  }
});

export default AchievementsDisplay; 