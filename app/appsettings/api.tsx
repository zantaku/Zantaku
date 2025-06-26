import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Platform
} from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';
import { useRouter } from 'expo-router';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { TAKIAPI_URL, MAGAAPI_URL, JELLEE_API_URL, API_CONFIG } from '../constants/api';

interface APIEndpoint {
  name: string;
  url: string;
  category: 'Anime' | 'Manga' | 'Novel' | 'Core';
  description: string;
  healthCheckPath?: string;
  expectedResponse?: string;
  component: string;
}

interface APIStatus {
  endpoint: APIEndpoint;
  status: 'online' | 'offline' | 'slow' | 'checking';
  responseTime: number;
  lastChecked: number;
  error?: string;
  successRate: number;
}

const API_ENDPOINTS: APIEndpoint[] = [
  // ===== YOUR 3 REAL APIs - HIGH TRAFFIC OPTIMIZED =====
  {
    name: '🔥 TakiAPI',
    url: TAKIAPI_URL,
    category: 'Anime',
    description: 'Main anime streaming API - Episodes & video sources',
    healthCheckPath: '/anime/gogoanime',
    component: 'EpisodeList.tsx, EpisodeSourcesModal.tsx'
  },
  {
    name: '📚 MagaAPI',
    url: MAGAAPI_URL,
    category: 'Manga',
    description: 'Manga & novel content API - Chapters & volumes',
    healthCheckPath: '/manga',
    component: 'chapterlist.tsx, ChapterSourcesModal.tsx, NovelVolumeList.tsx'
  },
  {
    name: '⚡ JelleeAPI',
    url: JELLEE_API_URL,
    category: 'Core',
    description: 'New unified API endpoint - Multi-purpose content',
    healthCheckPath: '/health',
    component: 'Multiple components'
  },
  
  // ===== EXTERNAL APIs (Used by app but not yours) =====
  {
    name: 'AniList GraphQL',
    url: 'https://graphql.anilist.co',
    category: 'Core',
    description: '👤 User profiles, authentication, anime/manga metadata',
    healthCheckPath: '',
    expectedResponse: 'errors',
    component: 'All authentication components'
  },
  {
    name: 'Jikan (MyAnimeList)',
    url: 'https://api.jikan.moe/v4',
    category: 'Core',
    description: '📊 Anime metadata, rankings, episode information',
    healthCheckPath: '/top/anime?limit=1',
    component: 'EpisodeList.tsx, anime details'
  }
];

export default function APIStatusPage() {
  const { isDarkMode, currentTheme } = useTheme();
  const router = useRouter();
  const [statuses, setStatuses] = useState<APIStatus[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdateTime, setLastUpdateTime] = useState<number>(0);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [autoRefresh, setAutoRefresh] = useState(false);

  const styles = createStyles(isDarkMode, currentTheme);

  const categories = ['All', 'Core', 'Anime', 'Manga', 'Novel'];

  // Initialize statuses
  useEffect(() => {
    const initialStatuses = API_ENDPOINTS.map(endpoint => ({
      endpoint,
      status: 'checking' as const,
      responseTime: 0,
      lastChecked: 0,
      successRate: 100
    }));
    setStatuses(initialStatuses);
    checkAllAPIs();
  }, []);

  // Auto-refresh setup
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (autoRefresh) {
      interval = setInterval(() => {
        checkAllAPIs();
      }, 30000); // Check every 30 seconds
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh]);

  const checkAPIHealth = async (endpoint: APIEndpoint): Promise<Omit<APIStatus, 'endpoint'>> => {
    const startTime = Date.now();
    
    try {
      let checkUrl = endpoint.url;
      if (endpoint.healthCheckPath) {
        checkUrl += endpoint.healthCheckPath;
      }

      const response = await axios.get(checkUrl, {
        timeout: API_CONFIG.TIMEOUT,
        headers: {
          'User-Agent': 'Kamilist-App/1.0.0',
          'Accept': 'application/json'
        },
        validateStatus: (status) => status < 500 // Accept any status < 500
      });

      const responseTime = Date.now() - startTime;
      
      // Load historical data
      const historyKey = `api_history_${endpoint.name.replace(/\s+/g, '_')}`;
      const history = await AsyncStorage.getItem(historyKey);
      const checks = history ? JSON.parse(history) : [];
      
      // Add current check
      checks.push({
        timestamp: Date.now(),
        success: true,
        responseTime
      });
      
      // Keep only last 10 checks
      const recentChecks = checks.slice(-10);
      await AsyncStorage.setItem(historyKey, JSON.stringify(recentChecks));
      
      // Calculate success rate
      const successCount = recentChecks.filter((check: any) => check.success).length;
      const successRate = (successCount / recentChecks.length) * 100;

      let status: 'online' | 'offline' | 'slow' = 'online';
      if (responseTime > 3000) {
        status = 'slow';
      }

      return {
        status,
        responseTime,
        lastChecked: Date.now(),
        successRate
      };
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      
      // Log failed check
      const historyKey = `api_history_${endpoint.name.replace(/\s+/g, '_')}`;
      const history = await AsyncStorage.getItem(historyKey);
      const checks = history ? JSON.parse(history) : [];
      
      checks.push({
        timestamp: Date.now(),
        success: false,
        responseTime,
        error: error.message
      });
      
      const recentChecks = checks.slice(-10);
      await AsyncStorage.setItem(historyKey, JSON.stringify(recentChecks));
      
      const successCount = recentChecks.filter((check: any) => check.success).length;
      const successRate = (successCount / recentChecks.length) * 100;

      return {
        status: 'offline',
        responseTime,
        lastChecked: Date.now(),
        error: error.message,
        successRate
      };
    }
  };

  const checkAllAPIs = useCallback(async () => {
    console.log('[API Status] Starting health checks for all endpoints...');
    
    // Update all to checking state
    setStatuses(prev => prev.map(status => ({
      ...status,
      status: 'checking' as const
    })));

    const results = await Promise.allSettled(
      API_ENDPOINTS.map(async (endpoint) => {
        const result = await checkAPIHealth(endpoint);
        return {
          endpoint,
          ...result
        };
      })
    );

    const newStatuses = results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        return {
          endpoint: API_ENDPOINTS[index],
          status: 'offline' as const,
          responseTime: 0,
          lastChecked: Date.now(),
          error: 'Health check failed',
          successRate: 0
        };
      }
    });

    setStatuses(newStatuses);
    setLastUpdateTime(Date.now());
    
    console.log('[API Status] Health checks completed');
  }, []);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await checkAllAPIs();
    setRefreshing(false);
  }, [checkAllAPIs]);

  const getStatusColor = (status: APIStatus['status']) => {
    switch (status) {
      case 'online': return '#4CAF50';
      case 'slow': return '#FF9800';
      case 'offline': return '#F44336';
      case 'checking': return '#2196F3';
      default: return '#9E9E9E';
    }
  };

  const getStatusIcon = (status: APIStatus['status']) => {
    switch (status) {
      case 'online': return 'check-circle';
      case 'slow': return 'exclamation-triangle';
      case 'offline': return 'times-circle';
      case 'checking': return 'spinner';
      default: return 'question-circle';
    }
  };

  const formatResponseTime = (time: number) => {
    if (time === 0) return 'N/A';
    if (time < 1000) return `${time}ms`;
    return `${(time / 1000).toFixed(1)}s`;
  };

  const formatLastChecked = (timestamp: number) => {
    if (timestamp === 0) return 'Never';
    const now = Date.now();
    const diff = now - timestamp;
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return `${Math.floor(diff / 86400000)}d ago`;
  };

  const getCategoryStats = (category: string) => {
    const categoryStatuses = category === 'All' 
      ? statuses 
      : statuses.filter(s => s.endpoint.category === category);
    
    const online = categoryStatuses.filter(s => s.status === 'online').length;
    const total = categoryStatuses.length;
    const avgResponseTime = categoryStatuses.reduce((sum, s) => sum + s.responseTime, 0) / total || 0;
    
    return { online, total, avgResponseTime };
  };

  const filteredStatuses = selectedCategory === 'All' 
    ? statuses 
    : statuses.filter(s => s.endpoint.category === selectedCategory);

  const overallStats = getCategoryStats('All');

  const handleAPIDetails = (apiStatus: APIStatus) => {
    Alert.alert(
      apiStatus.endpoint.name,
      `Description: ${apiStatus.endpoint.description}\n\n` +
      `Used in: ${apiStatus.endpoint.component}\n\n` +
      `Status: ${apiStatus.status.toUpperCase()}\n` +
      `Response Time: ${formatResponseTime(apiStatus.responseTime)}\n` +
      `Success Rate: ${apiStatus.successRate.toFixed(1)}%\n` +
      `Last Checked: ${formatLastChecked(apiStatus.lastChecked)}\n` +
      `URL: ${apiStatus.endpoint.url}` +
      (apiStatus.error ? `\n\nError: ${apiStatus.error}` : ''),
      [
        {
          text: 'Test Again',
          onPress: async () => {
            const index = statuses.findIndex(s => s.endpoint.name === apiStatus.endpoint.name);
            if (index !== -1) {
              const newStatuses = [...statuses];
              newStatuses[index] = { ...newStatuses[index], status: 'checking' };
              setStatuses(newStatuses);
              
              const result = await checkAPIHealth(apiStatus.endpoint);
              newStatuses[index] = { endpoint: apiStatus.endpoint, ...result };
              setStatuses(newStatuses);
            }
          }
        },
        { text: 'Close', style: 'cancel' }
      ]
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: currentTheme.colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: currentTheme.colors.surface }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <FontAwesome5 name="arrow-left" size={20} color={currentTheme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: currentTheme.colors.text }]}>
          API Status Monitor
        </Text>
        <TouchableOpacity
          style={[styles.autoRefreshButton, autoRefresh && styles.autoRefreshActive]}
          onPress={() => setAutoRefresh(!autoRefresh)}
        >
          <FontAwesome5 
            name={autoRefresh ? "pause" : "sync-alt"} 
            size={16} 
            color={autoRefresh ? '#fff' : currentTheme.colors.text} 
          />
        </TouchableOpacity>
      </View>

      {/* Overall Stats */}
      <LinearGradient
        colors={isDarkMode ? ['#1a1a1a', '#2a2a2a'] : ['#f8f9fa', '#e9ecef']}
        style={styles.statsContainer}
      >
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: getStatusColor('online') }]}>
            {overallStats.online}
          </Text>
          <Text style={[styles.statLabel, { color: currentTheme.colors.textSecondary }]}>
            Online
          </Text>
        </View>
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: currentTheme.colors.text }]}>
            {overallStats.total}
          </Text>
          <Text style={[styles.statLabel, { color: currentTheme.colors.textSecondary }]}>
            Total APIs
          </Text>
        </View>
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: currentTheme.colors.text }]}>
            {formatResponseTime(overallStats.avgResponseTime)}
          </Text>
          <Text style={[styles.statLabel, { color: currentTheme.colors.textSecondary }]}>
            Avg Response
          </Text>
        </View>
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: currentTheme.colors.textSecondary }]}>
            {formatLastChecked(lastUpdateTime)}
          </Text>
          <Text style={[styles.statLabel, { color: currentTheme.colors.textSecondary }]}>
            Last Update
          </Text>
        </View>
      </LinearGradient>

      {/* Category Filters */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.categoriesContainer}
        contentContainerStyle={styles.categoriesContent}
      >
        {categories.map((category) => {
          const stats = getCategoryStats(category);
          const isSelected = selectedCategory === category;
          
          return (
            <TouchableOpacity
              key={category}
              style={[
                styles.categoryButton,
                isSelected && styles.categoryButtonActive,
                { backgroundColor: isSelected ? '#02A9FF' : currentTheme.colors.surface }
              ]}
              onPress={() => setSelectedCategory(category)}
            >
              <Text style={[
                styles.categoryText,
                { color: isSelected ? '#fff' : currentTheme.colors.text }
              ]}>
                {category}
              </Text>
              <Text style={[
                styles.categoryStats,
                { color: isSelected ? 'rgba(255,255,255,0.8)' : currentTheme.colors.textSecondary }
              ]}>
                {stats.online}/{stats.total}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* API List */}
      <ScrollView
        style={styles.apiList}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={['#02A9FF']}
            tintColor={isDarkMode ? '#02A9FF' : '#666'}
          />
        }
      >
        {filteredStatuses.map((apiStatus, index) => (
          <TouchableOpacity
            key={apiStatus.endpoint.name}
            style={[styles.apiItem, { backgroundColor: currentTheme.colors.surface }]}
            onPress={() => handleAPIDetails(apiStatus)}
          >
            <View style={styles.apiHeader}>
              <View style={styles.apiInfo}>
                <View style={styles.apiNameRow}>
                  <Text style={[styles.apiName, { color: currentTheme.colors.text }]}>
                    {apiStatus.endpoint.name}
                  </Text>
                  <View style={[
                    styles.statusBadge,
                    { backgroundColor: getStatusColor(apiStatus.status) }
                  ]}>
                    <FontAwesome5
                      name={getStatusIcon(apiStatus.status)}
                      size={12}
                      color="#fff"
                    />
                  </View>
                </View>
                <Text style={[styles.apiDescription, { color: currentTheme.colors.textSecondary }]}>
                  {apiStatus.endpoint.description}
                </Text>
                <Text style={[styles.componentText, { color: currentTheme.colors.textSecondary }]}>
                  Used in: {apiStatus.endpoint.component}
                </Text>
              </View>
            </View>
            
            <View style={styles.apiMetrics}>
              <View style={styles.metric}>
                <Text style={[styles.metricLabel, { color: currentTheme.colors.textSecondary }]}>
                  Response
                </Text>
                <Text style={[styles.metricValue, { 
                  color: apiStatus.responseTime > 3000 ? '#FF9800' : 
                         apiStatus.responseTime > 1000 ? '#FFC107' : '#4CAF50'
                }]}>
                  {formatResponseTime(apiStatus.responseTime)}
                </Text>
              </View>
              
              <View style={styles.metric}>
                <Text style={[styles.metricLabel, { color: currentTheme.colors.textSecondary }]}>
                  Success Rate
                </Text>
                <Text style={[styles.metricValue, { 
                  color: apiStatus.successRate >= 80 ? '#4CAF50' : 
                         apiStatus.successRate >= 50 ? '#FF9800' : '#F44336'
                }]}>
                  {apiStatus.successRate.toFixed(0)}%
                </Text>
              </View>
              
              <View style={styles.metric}>
                <Text style={[styles.metricLabel, { color: currentTheme.colors.textSecondary }]}>
                  Last Check
                </Text>
                <Text style={[styles.metricValue, { color: currentTheme.colors.text }]}>
                  {formatLastChecked(apiStatus.lastChecked)}
                </Text>
              </View>
            </View>
            
            {apiStatus.error && (
              <View style={styles.errorContainer}>
                <FontAwesome5 name="exclamation-triangle" size={12} color="#F44336" />
                <Text style={styles.errorText} numberOfLines={2}>
                  {apiStatus.error}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Footer Info */}
      <View style={[styles.footer, { backgroundColor: currentTheme.colors.surface }]}>
        <FontAwesome5 name="info-circle" size={12} color={currentTheme.colors.textSecondary} />
        <Text style={[styles.footerText, { color: currentTheme.colors.textSecondary }]}>
          Tap any API for details • Pull down to refresh • Auto-refresh every 30s when enabled
        </Text>
      </View>
    </View>
  );
}

const createStyles = (isDarkMode: boolean, currentTheme: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: currentTheme.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 16,
    paddingTop: Platform.OS === 'ios' ? 60 : 16,
    backgroundColor: currentTheme.colors.background,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: isDarkMode ? 0.3 : 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 16,
    color: currentTheme.colors.text,
    letterSpacing: -0.5,
  },
  autoRefreshButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: isDarkMode ? 0.3 : 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  autoRefreshActive: {
    backgroundColor: currentTheme.colors.primary,
    shadowColor: currentTheme.colors.primary,
    shadowOpacity: 0.4,
  },
  statsContainer: {
    marginHorizontal: 24,
    marginVertical: 20,
    backgroundColor: isDarkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
    borderRadius: 24,
    padding: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: isDarkMode ? 0.3 : 0.06,
    shadowRadius: 16,
    elevation: 8,
    borderWidth: isDarkMode ? 1 : 0,
    borderColor: isDarkMode ? 'rgba(255,255,255,0.08)' : 'transparent',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: 36,
    fontWeight: '900',
    color: currentTheme.colors.text,
    marginBottom: 6,
    letterSpacing: -1,
  },
  statLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: currentTheme.colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  categoriesContainer: {
    marginBottom: 20,
  },
  categoriesContent: {
    paddingHorizontal: 24,
    gap: 12,
  },
  categoryButton: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 18,
    alignItems: 'center',
    minWidth: 90,
    backgroundColor: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: isDarkMode ? 0.2 : 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  categoryButtonActive: {
    backgroundColor: currentTheme.colors.primary,
    shadowColor: currentTheme.colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
    transform: [{ scale: 1.02 }],
  },
  categoryText: {
    fontSize: 15,
    fontWeight: '700',
    color: currentTheme.colors.textSecondary,
  },
  categoryStats: {
    fontSize: 11,
    marginTop: 2,
    color: currentTheme.colors.textSecondary,
    opacity: 0.8,
  },
  apiList: {
    flex: 1,
    paddingHorizontal: 24,
  },
  apiItem: {
    padding: 24,
    marginBottom: 16,
    borderRadius: 20,
    backgroundColor: isDarkMode ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.9)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: isDarkMode ? 0.3 : 0.08,
    shadowRadius: 16,
    elevation: 8,
    borderWidth: isDarkMode ? 1 : 0,
    borderColor: isDarkMode ? 'rgba(255,255,255,0.08)' : 'transparent',
  },
  apiHeader: {
    marginBottom: 16,
  },
  apiInfo: {
    flex: 1,
  },
  apiNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  apiName: {
    fontSize: 20,
    fontWeight: '800',
    flex: 1,
    color: currentTheme.colors.text,
    letterSpacing: -0.3,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginLeft: 12,
  },
  apiDescription: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 6,
    color: currentTheme.colors.textSecondary,
  },
  componentText: {
    fontSize: 12,
    fontStyle: 'italic',
    color: currentTheme.colors.textSecondary,
    opacity: 0.7,
  },
  apiMetrics: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
  },
  metric: {
    alignItems: 'center',
    flex: 1,
  },
  metricLabel: {
    fontSize: 12,
    marginBottom: 6,
    color: currentTheme.colors.textSecondary,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  metricValue: {
    fontSize: 18,
    fontWeight: '800',
    color: currentTheme.colors.text,
    letterSpacing: -0.3,
  },
  errorContainer: {
    marginTop: 16,
    padding: 16,
    backgroundColor: 'rgba(244, 67, 54, 0.1)',
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#F44336',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  errorText: {
    color: '#F44336',
    fontSize: 13,
    flex: 1,
    fontWeight: '500',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    gap: 8,
    backgroundColor: isDarkMode ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
    borderTopWidth: 1,
    borderTopColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
  },
  footerText: {
    fontSize: 13,
    textAlign: 'center',
    color: currentTheme.colors.textSecondary,
    fontWeight: '500',
  },
}); 