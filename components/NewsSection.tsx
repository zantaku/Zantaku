import { View, Text, StyleSheet, TouchableOpacity, Image, Platform, Linking, ActivityIndicator, Alert } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useState, useCallback, useEffect } from 'react';
import { useTheme, lightTheme, darkTheme } from '../hooks/useTheme';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { NewsSettings } from '../app/appsettings/newssettings';

// Helper function to check if settings are still basic (same as in newssettings.tsx)
const isBasicSettings = (settings: NewsSettings): boolean => {
  // Check if only AniList and ANN are enabled (basic setup)
  const basicSources = settings.enableAniList && settings.enableANN && 
    !settings.enableCrunchyrollNews && !settings.enableMyAnimeListNews &&
    !settings.enableJapanTimes && !settings.enableNHKWorld && 
    !settings.enableSoraNews24 && !settings.enableTokyoReporter;
  
  // Check if only basic categories are enabled
  const basicCategories = settings.enableAnimeNews && settings.enableMangaNews && 
    settings.enableLightNovelNews && !settings.enableJapanCulture &&
    !settings.enableTechnology && !settings.enableGaming && 
    !settings.enableEntertainment && !settings.enableLifestyle;
  
  return basicSources && basicCategories;
};

interface NewsItem {
  id: string;
  title: string;
  source: string;
  timestamp: string;
  url: string;
  thumbnail?: string | null;
  category: string;
  isInternalLink: boolean;
  nextEpisode?: number;
  score?: number;
  scoreFormat?: string;
  description?: string;
  author?: string;
}

const ITEMS_PER_PAGE = 5;
const MAX_AUTO_ITEMS = 10; // Safety cap for auto-loading to avoid heavy renders

export default function NewsSection({ news }: { news: NewsItem[] }) {
  const router = useRouter();
  const [displayCount, setDisplayCount] = useState(ITEMS_PER_PAGE);
  const [isLoading, setIsLoading] = useState(false);
  const [newsSettings, setNewsSettings] = useState<NewsSettings | null>(null);
  const [hasReachedEnd, setHasReachedEnd] = useState(false);
  const { isDarkMode } = useTheme();
  const currentTheme = isDarkMode ? darkTheme : lightTheme;

  const formatScore = (score: number | undefined, format: string = 'POINT_10') => {
    if (!score) return null;
    
    switch (format) {
      case 'POINT_100':
        return `${score}/100`;
      case 'POINT_10_DECIMAL':
        return `${(score / 10).toFixed(1)}/10`;
      case 'POINT_10':
        return `${Math.round(score / 10)}/10`;
      case 'POINT_5':
        return `${Math.round(score / 20)}/5`;
      case 'POINT_3':
        return `${Math.round(score / 33.33)}/3`;
      default:
        return `${(score / 10).toFixed(1)}/10`;
    }
  };

  const handleNewsPress = useCallback(async (item: NewsItem) => {
    if (item.isInternalLink) {
      router.push(item.url as any);
    } else {
      await Linking.openURL(item.url);
    }
  }, [router]);

  // Reset pagination when incoming news changes
  useEffect(() => {
    setDisplayCount(Math.min(ITEMS_PER_PAGE, news.length));
    setHasReachedEnd(false);
  }, [news]);

  // Load news settings
  useEffect(() => {
    const loadNewsSettings = async () => {
      try {
        const savedSettings = await AsyncStorage.getItem('newsSettings');
        if (savedSettings) {
          setNewsSettings(JSON.parse(savedSettings));
        }
      } catch (error) {
        console.error('Error loading news settings:', error);
      }
    };
    loadNewsSettings();
  }, []);

  const loadMore = useCallback(() => {
    if (isLoading || displayCount >= news.length || hasReachedEnd) return;
    
    setIsLoading(true);
    setTimeout(() => {
      const newCount = Math.min(displayCount + ITEMS_PER_PAGE, news.length);
      setDisplayCount(newCount);
      
      // Check if we've reached the maximum items setting
      const maxItems = newsSettings?.maxNewsItems || 50;
      if (newCount >= maxItems || newCount >= news.length) {
        setHasReachedEnd(true);
      }
      
      setIsLoading(false);
    }, 500);
  }, [displayCount, news.length, isLoading, hasReachedEnd, newsSettings]);

  // Auto load a limited amount only when explicitly enabled in settings
  useEffect(() => {
    const shouldAutoLoad = newsSettings?.enableEndlessLoading === true;
    const autoTarget = Math.min(MAX_AUTO_ITEMS, newsSettings?.maxNewsItems || 50, news.length);
    if (!isLoading && shouldAutoLoad && displayCount < autoTarget && !hasReachedEnd) {
      loadMore();
    }
  }, [displayCount, news.length, isLoading, hasReachedEnd, newsSettings, loadMore]);

  if (!news || news.length === 0) return null;

  const formatTimestamp = (item: NewsItem) => {
    if (item.category === 'Trending' || item.category === 'New') {
      return item.timestamp;
    }

    const date = new Date(item.timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  const getCategoryColor = (item: NewsItem): [string, string] => {
    switch (item.category) {
      case 'Trending':
        return ['#FF6B6B', '#ee5253'];
      case 'New':
        return ['#4ECDC4', '#45B7AF'];
      case 'News':
        return ['#FF5722', '#F4511E'];
      default:
        return ['#666', '#444'];
    }
  };

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionTitleContainer}>
          <LinearGradient
            colors={['#02A9FF', '#0288D1']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.iconContainer}
          >
            <FontAwesome5 
              name="newspaper" 
              size={16} 
              color="#fff"
            />
          </LinearGradient>
          <View style={styles.titleTextContainer}>
            <Text style={[styles.sectionTitle, { color: currentTheme.colors.text }]}>News Feed</Text>
            <Text style={[styles.sectionSubtitle, { color: currentTheme.colors.textSecondary }]}>Stay up to date with the latest</Text>
          </View>
        </View>
      </View>
      
      {/* Customization Note - Only show if settings are still basic */}
      {(!newsSettings || isBasicSettings(newsSettings)) && (
        <View style={[styles.customizationNote, { 
          backgroundColor: currentTheme.colors.surface,
          borderColor: currentTheme.colors.border
        }]}>
          <View style={styles.noteContent}>
            <FontAwesome5 name="info-circle" size={14} color="#02A9FF" />
            <Text style={[styles.noteText, { color: currentTheme.colors.textSecondary }]}>
              Currently showing basic AniList & ANN news. 
            </Text>
          </View>
          <TouchableOpacity 
            style={[styles.customizeLink, { backgroundColor: '#02A9FF' }]}
            onPress={() => router.push('/appsettings/newssettings')}
            activeOpacity={0.8}
          >
            <Text style={styles.customizeLinkText}>Customize</Text>
            <FontAwesome5 name="arrow-right" size={12} color="#fff" />
          </TouchableOpacity>
        </View>
      )}
      <View style={[styles.newsContainer, { 
        backgroundColor: currentTheme.colors.surface,
        shadowColor: isDarkMode ? '#000' : '#666'
      }]}>
        {news.slice(0, displayCount).map((item) => (
          <TouchableOpacity
            key={item.id}
            style={[styles.newsItem, { 
              backgroundColor: currentTheme.colors.surface,
              borderBottomColor: currentTheme.colors.border
            }]}
            onPress={() => handleNewsPress(item)}
            activeOpacity={0.7}
          >
            <View style={styles.newsContent}>
              <View style={styles.newsHeader}>
                <LinearGradient
                  colors={getCategoryColor(item)}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.categoryTag}
                >
                  <Text style={styles.categoryText}>{item.category}</Text>
                </LinearGradient>
                {item.score && (
                  <View style={[styles.scoreTag, { 
                    backgroundColor: currentTheme.colors.background,
                    shadowColor: isDarkMode ? '#000' : '#666'
                  }]}>
                    <FontAwesome5 name="star" size={10} color="#FFD700" solid />
                    <Text style={[styles.scoreText, { color: currentTheme.colors.text }]}>
                      {formatScore(item.score, item.scoreFormat)}
                    </Text>
                  </View>
                )}
              </View>
              <View style={styles.mainContent}>
                {item.thumbnail && (
                  <Image
                    source={{ uri: item.thumbnail }}
                    style={styles.newsImage}
                  />
                )}
                <View style={styles.textContent}>
                  <Text style={[styles.newsTitle, { color: currentTheme.colors.text }]} numberOfLines={2}>
                    {item.title}
                    {item.nextEpisode && item.category === 'Trending' && (
                      <Text style={[styles.episodeText, { color: currentTheme.colors.textSecondary }]}>
                        {` • EP ${item.nextEpisode}`}
                      </Text>
                    )}
                  </Text>
                  <View style={styles.newsFooter}>
                    <View style={styles.timeContainer}>
                      <FontAwesome5 name="clock" size={10} color={currentTheme.colors.textSecondary} solid />
                      <Text style={[styles.timeText, { color: currentTheme.colors.textSecondary }]}>
                        {formatTimestamp(item)}
                      </Text>
                    </View>
                    <View style={styles.sourceContainer}>
                      <Text style={[styles.sourceText, { color: currentTheme.colors.textSecondary }]}>
                        {item.source}
                      </Text>
                      {item.isInternalLink ? (
                        <FontAwesome5 name="chevron-right" size={12} color="#02A9FF" />
                      ) : (
                        <FontAwesome5 name="external-link-alt" size={10} color="#02A9FF" />
                      )}
                    </View>
                  </View>
                </View>
              </View>
            </View>
          </TouchableOpacity>
        ))}
        {isLoading && displayCount < news.length && (
          <View style={[styles.loadingContainer, { borderTopColor: currentTheme.colors.border }]}>
            <ActivityIndicator size="small" color="#02A9FF" />
            <Text style={[styles.loadingText, { color: currentTheme.colors.textSecondary }]}>
              Loading more news...
            </Text>
          </View>
        )}
        
        {/* Load More Button (when endless loading is not explicitly enabled) */}
        {!isLoading && displayCount < news.length && !hasReachedEnd && newsSettings?.enableEndlessLoading !== true && (
          <View style={[styles.loadMoreContainer, { borderTopColor: currentTheme.colors.border }]}>
            <TouchableOpacity 
              style={[styles.loadMoreButton, { backgroundColor: '#02A9FF' }]}
              onPress={loadMore}
              activeOpacity={0.8}
            >
              <FontAwesome5 name="plus" size={14} color="#fff" />
              <Text style={styles.loadMoreText}>Load More News</Text>
            </TouchableOpacity>
          </View>
        )}
        
        {/* End of Feed Message */}
        {hasReachedEnd && (
          <View style={[styles.endOfFeedContainer, { borderTopColor: currentTheme.colors.border }]}>
            <FontAwesome5 name="check-circle" size={16} color={currentTheme.colors.textSecondary} />
            <Text style={[styles.endOfFeedText, { color: currentTheme.colors.textSecondary }]}>
              You've reached the end of your news feed
            </Text>
            <Text style={[styles.endOfFeedSubtext, { color: currentTheme.colors.textSecondary }]}>
              Customize your sources for more content
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: 24,
    paddingHorizontal: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
    marginBottom: 2,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#666',
    fontWeight: '400',
  },
  newsContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  newsItem: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  newsContent: {
    padding: 16,
  },
  newsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  categoryTag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  categoryText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  scoreTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#fff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  scoreText: {
    fontSize: 12,
    color: '#333',
    fontWeight: 'bold',
  },
  mainContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
  },
  newsImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
  },
  textContent: {
    flex: 1,
  },
  newsTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    lineHeight: 20,
    marginBottom: 8,
  },
  episodeText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '400',
  },
  newsFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timeText: {
    fontSize: 12,
    color: '#666',
  },
  sourceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  sourceText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  loadingContainer: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  titleTextContainer: {
    flex: 1,
  },
  customizeButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    marginLeft: 8,
  },
  customizationNote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  noteContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 8,
  },
  noteText: {
    fontSize: 13,
    color: '#666',
    flex: 1,
  },
  customizeLink: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#02A9FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 6,
  },
  customizeLinkText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  loadingText: {
    marginTop: 8,
    fontSize: 13,
    color: '#666',
  },
  loadMoreContainer: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  loadMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#02A9FF',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    gap: 8,
  },
  loadMoreText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  endOfFeedContainer: {
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    gap: 4,
  },
  endOfFeedText: {
    fontSize: 14,
    fontWeight: '500',
    marginTop: 8,
  },
  endOfFeedSubtext: {
    fontSize: 12,
    opacity: 0.7,
  },
}); 