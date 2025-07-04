import React, { useState, useRef, useCallback, useMemo } from 'react';
import { View, StyleSheet, Dimensions, Platform, ActivityIndicator, Text, TouchableOpacity } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useTheme, lightTheme, darkTheme } from '../../hooks/useTheme';
import { useExploreFeed, useUserId } from '../../lib/react-query';
import { useSettings } from '../../hooks/useSettings';

// Import all the card components
const HeroCard = require('./cards/HeroCard').default;
const ContinueWatchingCard = require('./cards/ContinueWatchingCard').default;
const PersonalizedRecommendationsCard = require('./cards/PersonalizedRecommendationsCard').default;
const SocialActivityCard = require('./cards/SocialActivityCard').default;
const AiringScheduleCard = require('./cards/AiringScheduleCard').default;
const BirthdayCard = require('./cards/BirthdayCard').default;
const TrendingAdCard = require('./cards/TrendingAdCard').default;
const RandomFactCard = require('./cards/RandomFactCard').default;
const FomoCard = require('./cards/FomoCard').default;
const QuoteCard = require('./cards/QuoteCard').default;
const StatBattleCard = require('./cards/StatBattleCard').default;
const SkeletonCard = require('./cards/SkeletonCard').default;

const { width, height } = Dimensions.get('window');

// Define the feed item types
export type FeedItemType = 
  | 'hero'
  | 'continueWatching'
  | 'personalizedRecommendations'
  | 'socialActivity'
  | 'airingSchedule'
  | 'birthdayToday'
  | 'trendingAd'
  | 'randomFact'
  | 'fomo'
  | 'quote'
  | 'statBattle'
  | 'skeleton';

export interface FeedItem {
  id: string;
  type: FeedItemType;
  data: any;
  priority?: number; // For dynamic ordering
  timestamp?: number;
}

export default function ExploreFeed() {
  const { isDarkMode } = useTheme();
  const { settings } = useSettings();
  const currentTheme = isDarkMode ? darkTheme : lightTheme;
  
  // Query hooks
  const { data: userId } = useUserId();
  const showAdultContent = settings?.displayAdultContent || false;
  const { 
    data: feedData, 
    isLoading: loading, 
    error, 
    refetch 
  } = useExploreFeed(userId || undefined, showAdultContent);

  const [refreshing, setRefreshing] = useState(false);
  const flashListRef = useRef<FlashList<FeedItem>>(null);

  // Use live feed items directly from the API
  const feedItems = useMemo(() => {
    if (!feedData?.feedItems) return [];
    
    // Transform API feed items to component format
    return feedData.feedItems.map((item: any) => ({
      id: item.id,
      type: item.type,
      data: item.data,
      priority: item.priority,
      timestamp: item.timestamp
    }));
  }, [feedData]);

  // Render individual feed item
  const renderFeedItem = useCallback(({ item }: { item: FeedItem }) => {
    const commonProps = {
      theme: currentTheme,
      isDarkMode
    };

    switch (item.type) {
      case 'hero':
        return <HeroCard data={item.data} {...commonProps} />;
      
      case 'continueWatching':
        return <ContinueWatchingCard data={item.data} {...commonProps} />;
      
      case 'personalizedRecommendations':
        return <PersonalizedRecommendationsCard data={item.data} {...commonProps} />;
      
      case 'socialActivity':
        return <SocialActivityCard data={item.data} {...commonProps} />;
      
      case 'airingSchedule':
        return <AiringScheduleCard data={item.data} {...commonProps} />;
      
      case 'birthdayToday':
        return <BirthdayCard data={item.data} {...commonProps} />;
      
      case 'trendingAd':
        return <TrendingAdCard data={item.data} {...commonProps} />;
      
      case 'randomFact':
        return <RandomFactCard data={item.data} {...commonProps} />;
      
      case 'fomo':
        return <FomoCard data={item.data} {...commonProps} />;
      
      case 'quote':
        return <QuoteCard data={item.data} {...commonProps} />;
      
      case 'statBattle':
        return <StatBattleCard data={item.data} {...commonProps} />;
      
      case 'skeleton':
        return <SkeletonCard {...commonProps} />;
      
      default:
        return null;
    }
  }, [currentTheme, isDarkMode]);

  // Get item type for FlashList optimization
  const getItemType = useCallback((item: FeedItem) => {
    return item.type;
  }, []);

  // Handle refresh
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  // Loading state
  if (loading && !feedData) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: currentTheme.colors.background }]}>
        <ActivityIndicator size="large" color="#02A9FF" />
      </View>
    );
  }

  // Error state
  if (error && !feedData) {
    return (
      <View style={[styles.errorContainer, { backgroundColor: currentTheme.colors.background }]}>
        <Text style={[styles.errorText, { color: currentTheme.colors.textSecondary }]}>
          Failed to load content
        </Text>
        <TouchableOpacity 
          style={[styles.retryButton, { backgroundColor: currentTheme.colors.primary }]}
          onPress={() => refetch()}
        >
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: currentTheme.colors.background }]}>
      <FlashList
        ref={flashListRef}
        data={feedItems}
        renderItem={renderFeedItem}
        keyExtractor={(item) => item.id}
        getItemType={getItemType}
        estimatedItemSize={400}
        showsVerticalScrollIndicator={false}
        onRefresh={handleRefresh}
        refreshing={refreshing}
        // Performance optimizations
        removeClippedSubviews={true}
        // Infinite scroll feel
        onEndReachedThreshold={0.5}
        onEndReached={() => {
          // Could implement infinite loading here
          console.log('Reached end of feed');
        }}
        // TikTok-style snap scrolling
        decelerationRate="fast"
        snapToAlignment="start"
        pagingEnabled={false}
        snapToInterval={height * 0.8} // Snap to roughly screen height sections
        // Content styling
        contentContainerStyle={styles.contentContainer}
        ListFooterComponent={() => (
          <View style={styles.footerSpacer} />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    marginBottom: 16,
    textAlign: 'center',
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  contentContainer: {
    paddingBottom: Platform.OS === 'ios' ? 100 : 80,
  },
  footerSpacer: {
    height: 20,
  },
}); 