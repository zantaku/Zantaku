import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Platform,
  Animated,
  Dimensions
} from 'react-native';
import { FontAwesome5, MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';
import { useRouter } from 'expo-router';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BlurView } from 'expo-blur';
import { TAKIAPI_URL, MAGAAPI_URL, JELLEE_API_URL, API_CONFIG } from '../constants/api';
// Health checks for in-repo providers
import { zoroProvider, animePaheProvider } from '../../api/proxy/providers/anime';
import { MangaFireProvider } from '../../api/proxy/providers/manga/mangafire';
import { AniListProvider } from '../../api/proxy/providers/news/AniList';
import { ANNProvider } from '../../api/proxy/providers/news/ANN';
import { CrunchyrollProvider } from '../../api/proxy/providers/news/Crunchyroll';
import { NHKProvider } from '../../api/proxy/providers/news/NHK';
import { MALProvider } from '../../api/proxy/providers/news/MALNews';
import { SoraNews24Provider } from '../../api/proxy/providers/news/soranews24';
import { TokyoReporterProvider } from '../../api/proxy/providers/news/ToykoReporter';
import { resolveAnimeId, getAnimeInfo } from '../../api/kuroji';

const { width } = Dimensions.get('window');

interface APIEndpoint {
  name: string;
  url: string;
  category: 'Anime' | 'Manga' | 'Novel' | 'Core';
  description: string;
  healthCheckPath?: string;
  expectedResponse?: string;
  component: string;
  icon: string;
  color: string;
  // Optional custom functional health check used for in-repo providers
  customCheck?: () => Promise<{
    ok: boolean;
    detail?: string;
    responseTimeMs?: number;
  }>;
}

interface APIStatus {
  endpoint: APIEndpoint;
  status: 'online' | 'offline' | 'slow' | 'checking';
  responseTime: number;
  lastChecked: number;
  error?: string;
  successRate: number;
  uptime: number;
  lastError?: string;
}

const API_ENDPOINTS: APIEndpoint[] = [
  // Core external services
  {
    name: 'AniList GraphQL',
    url: 'https://graphql.anilist.co',
    category: 'Core',
    description: 'GraphQL API for profiles and rich anime/manga metadata',
    healthCheckPath: '',
    expectedResponse: 'errors',
    component: 'Authentication, Explore, Metadata',
    icon: 'user-circle',
    color: '#9B59B6'
  },
  // Novel provider: Jellee API
  {
    name: 'Jellee API (Novels)',
    url: JELLEE_API_URL,
    category: 'Novel',
    description: 'Light novel search and data via Jellee API',
    component: 'Novel screens, readers',
    icon: 'book',
    color: '#1ABC9C',
    customCheck: async () => {
      const started = Date.now();
      try {
        const checkUrl = `${JELLEE_API_URL}/novel/jellee/search?query=${encodeURIComponent('overlord')}`;
        const res = await axios.get(checkUrl, { timeout: API_CONFIG.TIMEOUT || 10000 });
        const data = res?.data;
        let count = 0;
        if (Array.isArray(data)) count = data.length;
        else if (Array.isArray(data?.data)) count = data.data.length;
        else if (Array.isArray(data?.results)) count = data.results.length;
        if (count <= 0) throw new Error('No results');
        return { ok: true, detail: `${count} results`, responseTimeMs: Date.now() - started };
      } catch (e: any) {
        return { ok: false, detail: e?.message || 'Search failed', responseTimeMs: Date.now() - started };
      }
    }
  },
  {
    name: 'Jikan (MyAnimeList)',
    url: 'https://api.jikan.moe/v4',
    category: 'Core',
    description: 'REST API for anime metadata, rankings, schedules',
    healthCheckPath: '/top/anime?limit=1',
    component: 'Explore, Details',
    icon: 'chart-line',
    color: '#F39C12'
  },
  // Internal app providers (function checks)
  {
    name: 'Kuroji Resolver',
    url: 'internal:kuroji',
    category: 'Anime',
    description: 'Kuroji base and resolver (resolve/search/info)',
    component: 'Playback pipeline',
    icon: 'link',
    color: '#45B7D1',
    customCheck: async () => {
      const started = Date.now();
      try {
        const id = await resolveAnimeId({ title: 'Naruto' });
        if (!id) throw new Error('resolveAnimeId returned null');
        const info = await getAnimeInfo(id);
        if (!info) throw new Error('getAnimeInfo returned null');
        return { ok: true, detail: `Resolved id ${id}`, responseTimeMs: Date.now() - started };
      } catch (e: any) {
        return { ok: false, detail: e?.message || 'Unknown error', responseTimeMs: Date.now() - started };
      }
    }
  },
  {
    name: 'Zoro/HiAnime Provider',
    url: 'internal:zoro',
    category: 'Anime',
    description: 'Episode sourcing via Zoro/HiAnime provider',
    component: 'EpisodeList.tsx, Playback',
    icon: 'play-circle',
    color: '#FF6B6B',
    customCheck: async () => {
      const started = Date.now();
      try {
        const results = await zoroProvider.searchAnime('Naruto');
        if (!Array.isArray(results) || results.length === 0) throw new Error('Empty search results');
        return { ok: true, detail: `${results.length} results`, responseTimeMs: Date.now() - started };
      } catch (e: any) {
        return { ok: false, detail: e?.message || 'Search failed', responseTimeMs: Date.now() - started };
      }
    }
  },
  {
    name: 'AnimePahe Provider',
    url: 'internal:animepahe',
    category: 'Anime',
    description: 'Episode sourcing via AnimePahe provider',
    component: 'EpisodeList.tsx, Playback',
    icon: 'video',
    color: '#E67E22',
    customCheck: async () => {
      const started = Date.now();
      try {
        const results = await animePaheProvider.searchAnime('Naruto');
        if (!Array.isArray(results) || results.length === 0) throw new Error('Empty search results');
        return { ok: true, detail: `${results.length} results`, responseTimeMs: Date.now() - started };
      } catch (e: any) {
        return { ok: false, detail: e?.message || 'Search failed', responseTimeMs: Date.now() - started };
      }
    }
  },
  {
    name: 'MangaFire Provider',
    url: 'internal:mangafire',
    category: 'Manga',
    description: 'Manga search and chapters via MangaFire provider',
    component: 'chapterlist.tsx',
    icon: 'book-open',
    color: '#4ECDC4',
    customCheck: async () => {
      const started = Date.now();
      try {
        const provider = new MangaFireProvider();
        const results = await provider.search('One Piece', 1);
        if (!Array.isArray(results) || results.length === 0) throw new Error('Empty search results');
        // Probe chapters for the first result lightly
        try {
          await provider.getChapters(results[0].id, { limit: 1 });
        } catch { /* ignore chapter fetch errors for health */ }
        return { ok: true, detail: `${results.length} results`, responseTimeMs: Date.now() - started };
      } catch (e: any) {
        return { ok: false, detail: e?.message || 'Search failed', responseTimeMs: Date.now() - started };
      }
    }
  },
  // News providers
  {
    name: 'News: AniList',
    url: 'internal:news-anilist',
    category: 'Core',
    description: 'AniList-based news/activity feed',
    component: 'News screens',
    icon: 'newspaper',
    color: '#1ABC9C',
    customCheck: async () => {
      const started = Date.now();
      try {
        const items = await AniListProvider.fetchNews(3);
        if (!Array.isArray(items) || items.length === 0) throw new Error('No items');
        return { ok: true, detail: `${items.length} items`, responseTimeMs: Date.now() - started };
      } catch (e: any) {
        return { ok: false, detail: e?.message || 'Fetch failed', responseTimeMs: Date.now() - started };
      }
    }
  },
  {
    name: 'News: ANN',
    url: 'https://www.animenewsnetwork.com/all/rss.xml?ann-edition=w',
    category: 'Core',
    description: 'Anime News Network RSS',
    component: 'News screens',
    icon: 'rss',
    color: '#F39C12',
    customCheck: async () => {
      const started = Date.now();
      try {
        const items = await ANNProvider.fetchNews(3);
        if (!Array.isArray(items) || items.length === 0) throw new Error('No items');
        return { ok: true, detail: `${items.length} items`, responseTimeMs: Date.now() - started };
      } catch (e: any) {
        return { ok: false, detail: e?.message || 'Fetch failed', responseTimeMs: Date.now() - started };
      }
    }
  },
  {
    name: 'News: Crunchyroll',
    url: 'https://www.crunchyroll.com/news/rss',
    category: 'Core',
    description: 'Crunchyroll RSS feed',
    component: 'News screens',
    icon: 'rss',
    color: '#E67E22',
    customCheck: async () => {
      const started = Date.now();
      try {
        const items = await CrunchyrollProvider.fetchNews(3);
        if (!Array.isArray(items) || items.length === 0) throw new Error('No items');
        return { ok: true, detail: `${items.length} items`, responseTimeMs: Date.now() - started };
      } catch (e: any) {
        return { ok: false, detail: e?.message || 'Fetch failed', responseTimeMs: Date.now() - started };
      }
    }
  },
  {
    name: 'News: MAL',
    url: 'https://myanimelist.net/news',
    category: 'Core',
    description: 'MAL news fetch',
    component: 'News screens',
    icon: 'rss',
    color: '#2C3E50',
    customCheck: async () => {
      const started = Date.now();
      try {
        const items = await MALProvider.fetchNews(3);
        if (!Array.isArray(items) || items.length === 0) throw new Error('No items');
        return { ok: true, detail: `${items.length} items`, responseTimeMs: Date.now() - started };
      } catch (e: any) {
        return { ok: false, detail: e?.message || 'Fetch failed', responseTimeMs: Date.now() - started };
      }
    }
  },
  {
    name: 'News: NHK',
    url: 'https://www3.nhk.or.jp/nhkworld/en/news/',
    category: 'Core',
    description: 'NHK World RSS',
    component: 'News screens',
    icon: 'rss',
    color: '#2980B9',
    customCheck: async () => {
      const started = Date.now();
      try {
        const items = await NHKProvider.fetchNews(3);
        if (!Array.isArray(items) || items.length === 0) throw new Error('No items');
        return { ok: true, detail: `${items.length} items`, responseTimeMs: Date.now() - started };
      } catch (e: any) {
        return { ok: false, detail: e?.message || 'Fetch failed', responseTimeMs: Date.now() - started };
      }
    }
  },
  {
    name: 'News: Tokyo Reporter',
    url: 'https://www.tokyoreporter.com/',
    category: 'Core',
    description: 'Tokyo Reporter RSS',
    component: 'News screens',
    icon: 'rss',
    color: '#8E44AD',
    customCheck: async () => {
      const started = Date.now();
      try {
        const items = await TokyoReporterProvider.fetchNews(3);
        if (!Array.isArray(items) || items.length === 0) throw new Error('No items');
        return { ok: true, detail: `${items.length} items`, responseTimeMs: Date.now() - started };
      } catch (e: any) {
        return { ok: false, detail: e?.message || 'Fetch failed', responseTimeMs: Date.now() - started };
      }
    }
  }
];

export default function APIStatusPage() {
  const { isDarkMode, currentTheme } = useTheme();
  const router = useRouter();
  const [statuses, setStatuses] = useState<APIStatus[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdateTime, setLastUpdateTime] = useState<number>(0);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const autoRefreshInterval = useRef<NodeJS.Timeout | null>(null);

  const styles = createStyles(isDarkMode, currentTheme);
  const categories = ['All', 'Core', 'Anime', 'Manga', 'Novel'];

  // Initialize with proper animations
  useEffect(() => {
    console.log('[API Status] 🎬 Component initializing...');
    const initialStatuses = API_ENDPOINTS.map(endpoint => ({
      endpoint,
      status: 'checking' as const,
      responseTime: 0,
      lastChecked: 0,
      successRate: 100,
      uptime: 0
    }));
    setStatuses(initialStatuses);
    
    // Animate in
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }),
    ]).start();

    console.log('[API Status] 🚀 Initial API health check starting...');
    checkAllAPIs();
  }, []);

  // Improved auto-refresh with proper cleanup (default every hour)
  useEffect(() => {
    if (autoRefresh) {
      console.log('[API Status] 🔄 Auto-refresh ENABLED - will check APIs every 60 minutes');
      autoRefreshInterval.current = setInterval(() => {
        console.log('[API Status] ⏰ Auto-refresh triggered - checking all APIs...');
        checkAllAPIs();
      }, 60 * 60 * 1000);
    } else {
      console.log('[API Status] ⏸️ Auto-refresh DISABLED - stopping interval');
      if (autoRefreshInterval.current) {
        clearInterval(autoRefreshInterval.current);
        autoRefreshInterval.current = null;
      }
    }

    return () => {
      if (autoRefreshInterval.current) {
        console.log('[API Status] 🧹 Cleaning up auto-refresh interval');
        clearInterval(autoRefreshInterval.current);
      }
    };
  }, [autoRefresh]);

  const checkAPIHealth = async (endpoint: APIEndpoint): Promise<Omit<APIStatus, 'endpoint'>> => {
    const startTime = Date.now();
    console.log(`[API Status] 🔍 Testing ${endpoint.name} (${endpoint.category}) - ${endpoint.url}`);
    
    try {
      // If a custom functional check is defined, run it
      if (endpoint.customCheck) {
        const res = await endpoint.customCheck();
        const responseTime = res.responseTimeMs ?? Date.now() - startTime;
        const ok = res.ok === true;
        const status: 'online' | 'offline' | 'slow' = ok ? (responseTime > 2000 ? 'slow' : 'online') : 'offline';
        await updateHistory(endpoint.name, ok, responseTime, ok ? 200 : 0, res.detail);
        return {
          status,
          responseTime,
          lastChecked: Date.now(),
          successRate: await computeSuccessRate(endpoint.name),
          uptime: await computeSuccessRate(endpoint.name),
          ...(ok ? {} : { error: res.detail, lastError: res.detail })
        };
      }

      let checkUrl = endpoint.url;
      if (endpoint.healthCheckPath) {
        checkUrl += endpoint.healthCheckPath;
      }
      console.log(`[API Status] 📡 Making request to: ${checkUrl}`);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), API_CONFIG.TIMEOUT || 10000);

      // Special handling for different APIs
      let requestConfig: any = {
        timeout: API_CONFIG.TIMEOUT || 10000,
        headers: {
          'User-Agent': 'Kamilist-App/2.0.0',
          'Accept': 'application/json',
          'Cache-Control': 'no-cache'
        },
        validateStatus: (status: number) => status < 500,
        signal: controller.signal
      };

      // Special handling for AniList GraphQL
      if (endpoint.name === 'AniList GraphQL') {
        requestConfig.method = 'POST';
        requestConfig.data = {
          query: '{ Page { pageInfo { total } } }'
        };
        requestConfig.headers['Content-Type'] = 'application/json';
      }

      const response = await axios(checkUrl, requestConfig);

      clearTimeout(timeoutId);
      const responseTime = Date.now() - startTime;
      console.log(`[API Status] ✅ ${endpoint.name} responded in ${responseTime}ms (Status: ${response.status})`);
      
      // Enhanced history tracking
      await updateHistory(endpoint.name, true, responseTime, response.status);
      const successRate = await computeSuccessRate(endpoint.name);
      const uptime = successRate;

      let status: 'online' | 'offline' | 'slow' = 'online';
      if (responseTime > 5000) {
        status = 'slow';
      } else if (responseTime > 2000) {
        status = 'slow';
      }

      console.log(`[API Status] 📊 ${endpoint.name} final status: ${status.toUpperCase()} (Success Rate: ${successRate.toFixed(1)}%, Uptime: ${uptime.toFixed(1)}%)`);

      return {
        status,
        responseTime,
        lastChecked: Date.now(),
        successRate,
        uptime
      };
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      console.log(`[API Status] ❌ ${endpoint.name} FAILED after ${responseTime}ms - Error: ${error.message}`);
      
      // Log failed check with more detail
      await updateHistory(endpoint.name, false, responseTime, 0, error.message, error.code);
      const successRate = await computeSuccessRate(endpoint.name);
      const uptime = successRate;

      console.log(`[API Status] 📊 ${endpoint.name} marked as OFFLINE (Success Rate: ${successRate.toFixed(1)}%, Uptime: ${uptime.toFixed(1)}%)`);

      return {
        status: 'offline',
        responseTime,
        lastChecked: Date.now(),
        error: error.message,
        lastError: error.message,
        successRate,
        uptime
      };
    }
  };

  // Helpers for history tracking reused by both HTTP and custom checks
  const getHistoryKey = (name: string) => `api_history_${name.replace(/\s+/g, '_')}`;
  const updateHistory = async (
    name: string,
    success: boolean,
    responseTime: number,
    status: number,
    detail?: string,
    code?: string
  ) => {
    const historyKey = getHistoryKey(name);
    const history = await AsyncStorage.getItem(historyKey);
    const checks = history ? JSON.parse(history) : [];
    checks.push({
      timestamp: Date.now(),
      success,
      responseTime,
      status,
      detail,
      code
    });
    const recentChecks = checks.slice(-20);
    await AsyncStorage.setItem(historyKey, JSON.stringify(recentChecks));
  };
  const computeSuccessRate = async (name: string) => {
    const historyKey = getHistoryKey(name);
    const history = await AsyncStorage.getItem(historyKey);
    const checks = history ? JSON.parse(history) : [];
    if (checks.length === 0) return 100;
    const successCount = checks.filter((c: any) => c.success).length;
    return (successCount / checks.length) * 100;
  };

  const checkAllAPIs = useCallback(async () => {
    const startTime = Date.now();
    console.log('\n[API Status] 🚀 Starting comprehensive health checks...');
    console.log(`[API Status] 📋 Testing ${API_ENDPOINTS.length} APIs: ${API_ENDPOINTS.map(ep => ep.name).join(', ')}`);
    
    // Animate status updates
    setStatuses(prev => prev.map(status => ({
      ...status,
      status: 'checking' as const
    })));

    try {
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
          console.log(`[API Status] ❌ ${API_ENDPOINTS[index].name} health check FAILED with Promise rejection`);
          return {
            endpoint: API_ENDPOINTS[index],
            status: 'offline' as const,
            responseTime: 0,
            lastChecked: Date.now(),
            error: 'Health check failed',
            lastError: 'Health check failed',
            successRate: 0,
            uptime: 0
          };
        }
      });

      setStatuses(newStatuses);
      setLastUpdateTime(Date.now());
      
      const totalTime = Date.now() - startTime;
      const onlineCount = newStatuses.filter(s => s.status === 'online').length;
      const slowCount = newStatuses.filter(s => s.status === 'slow').length;
      const offlineCount = newStatuses.filter(s => s.status === 'offline').length;
      
      console.log(`[API Status] ✅ All health checks completed in ${totalTime}ms`);
      console.log(`[API Status] 📊 Results: ${onlineCount} Online, ${slowCount} Slow, ${offlineCount} Offline`);
      console.log('[API Status] ─────────────────────────────────────────\n');
    } catch (error) {
      console.error('[API Status] ❌ CRITICAL ERROR during health checks:', error);
    }
  }, []);

  const handleRefresh = useCallback(async () => {
    console.log('[API Status] 🔄 Manual refresh triggered by user');
    setRefreshing(true);
    await checkAllAPIs();
    setRefreshing(false);
    console.log('[API Status] ✅ Manual refresh completed');
  }, [checkAllAPIs]);

  const getStatusInfo = (status: APIStatus['status']) => {
    switch (status) {
      case 'online':
        return { color: '#00C851', icon: 'check-circle', label: 'Online' };
      case 'slow':
        return { color: '#FFB74D', icon: 'clock', label: 'Slow' };
      case 'offline':
        return { color: '#FF5252', icon: 'times-circle', label: 'Offline' };
      case 'checking':
        return { color: '#42A5F5', icon: 'sync-alt', label: 'Checking' };
      default:
        return { color: '#9E9E9E', icon: 'question-circle', label: 'Unknown' };
    }
  };

  const formatResponseTime = (time: number) => {
    if (time === 0) return '---';
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
    const avgResponseTime = total > 0 ? 
      categoryStatuses.reduce((sum, s) => sum + s.responseTime, 0) / total : 0;
    const avgUptime = total > 0 ?
      categoryStatuses.reduce((sum, s) => sum + s.uptime, 0) / total : 0;
    
    return { online, total, avgResponseTime, avgUptime };
  };

  const filteredStatuses = selectedCategory === 'All' 
    ? statuses 
    : statuses.filter(s => s.endpoint.category === selectedCategory);

  const overallStats = getCategoryStats('All');

  const handleAPIDetails = (apiStatus: APIStatus) => {
    const statusInfo = getStatusInfo(apiStatus.status);
    const redactText = (text?: string) =>
      (text || '').replace(/https?:\/\/[\w.-]+(?::\d+)?[^\s]*/gi, '[redacted]');
    
    Alert.alert(
      `${apiStatus.endpoint.icon} ${apiStatus.endpoint.name}`,
      `${apiStatus.endpoint.description}\n\n` +
      `📊 Status: ${statusInfo.label}\n` +
      `⚡ Response: ${formatResponseTime(apiStatus.responseTime)}\n` +
      `📈 Success Rate: ${apiStatus.successRate.toFixed(1)}%\n` +
      `⏰ Uptime: ${apiStatus.uptime.toFixed(1)}%\n` +
      `🔄 Last Check: ${formatLastChecked(apiStatus.lastChecked)}\n` +
      `🛠️ Used in: ${apiStatus.endpoint.component}` +
      (apiStatus.error ? `\n\n❌ Error: ${redactText(apiStatus.error)}` : ''),
      [
        {
          text: '🔄 Test Again',
          onPress: async () => {
            console.log(`[API Status] 🧪 Individual API test triggered for ${apiStatus.endpoint.name}`);
            const index = statuses.findIndex(s => s.endpoint.name === apiStatus.endpoint.name);
            if (index !== -1) {
              const newStatuses = [...statuses];
              newStatuses[index] = { ...newStatuses[index], status: 'checking' };
              setStatuses(newStatuses);
              
              const result = await checkAPIHealth(apiStatus.endpoint);
              newStatuses[index] = { endpoint: apiStatus.endpoint, ...result };
              setStatuses(newStatuses);
              console.log(`[API Status] ✅ Individual test completed for ${apiStatus.endpoint.name}`);
            }
          }
        },
        { text: 'Close', style: 'cancel' }
      ]
    );
  };

  const StatusCard = ({ apiStatus, index }: { apiStatus: APIStatus; index: number }) => {
    const statusInfo = getStatusInfo(apiStatus.status);
    const cardAnim = useRef(new Animated.Value(0)).current;
    const redactText = (text?: string) =>
      (text || '').replace(/https?:\/\/[\w.-]+(?::\d+)?[^\s]*/gi, '[redacted]');

    useEffect(() => {
      Animated.timing(cardAnim, {
        toValue: 1,
        duration: 600,
        delay: index * 100,
        useNativeDriver: true,
      }).start();
    }, []);

    return (
      <Animated.View
        style={[
          styles.apiCard,
          {
            opacity: cardAnim,
            transform: [{
              translateY: cardAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [30, 0],
              }),
            }],
          },
        ]}
      >
        <TouchableOpacity
          onPress={() => handleAPIDetails(apiStatus)}
          style={styles.apiCardContent}
          activeOpacity={0.7}
        >
          {/* Header */}
          <View style={styles.apiCardHeader}>
            <View style={styles.apiIconContainer}>
              <View style={[styles.apiIcon, { backgroundColor: apiStatus.endpoint.color + '20' }]}>
                <FontAwesome5 
                  name={apiStatus.endpoint.icon} 
                  size={20} 
                  color={apiStatus.endpoint.color} 
                />
              </View>
            </View>
            
            <View style={styles.apiInfo}>
              <Text style={[styles.apiName, { color: currentTheme.colors.text }]}>
                {apiStatus.endpoint.name}
              </Text>
              <Text style={[styles.apiCategory, { color: currentTheme.colors.textSecondary }]}>
                {apiStatus.endpoint.category}
              </Text>
            </View>

            <View style={[styles.statusIndicator, { backgroundColor: statusInfo.color }]}> 
              {apiStatus.status === 'checking' ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <FontAwesome5 name={statusInfo.icon} size={14} color="#fff" />
              )}
            </View>
          </View>

          {/* Description (no raw URLs shown) */}
          <Text style={[styles.apiDescription, { color: currentTheme.colors.textSecondary }]}> 
            {apiStatus.endpoint.description}
          </Text>

          {/* Metrics */}
          <View style={styles.metricsGrid}>
            <View style={styles.metricItem}>
              <Text style={[styles.metricValue, { 
                color: apiStatus.responseTime > 2000 ? '#FFB74D' : 
                       apiStatus.responseTime > 1000 ? '#FFC107' : '#00C851'
              }]}>
                {formatResponseTime(apiStatus.responseTime)}
              </Text>
              <Text style={[styles.metricLabel, { color: currentTheme.colors.textSecondary }]}>
                Response
              </Text>
            </View>

            <View style={styles.metricItem}>
              <Text style={[styles.metricValue, { 
                color: apiStatus.successRate >= 95 ? '#00C851' : 
                       apiStatus.successRate >= 80 ? '#FFB74D' : '#FF5252'
              }]}>
                {apiStatus.successRate.toFixed(0)}%
              </Text>
              <Text style={[styles.metricLabel, { color: currentTheme.colors.textSecondary }]}>
                Success
              </Text>
            </View>

            <View style={styles.metricItem}>
              <Text style={[styles.metricValue, { 
                color: apiStatus.uptime >= 95 ? '#00C851' : 
                       apiStatus.uptime >= 80 ? '#FFB74D' : '#FF5252'
              }]}>
                {apiStatus.uptime.toFixed(0)}%
              </Text>
              <Text style={[styles.metricLabel, { color: currentTheme.colors.textSecondary }]}>
                Uptime
              </Text>
            </View>

            <View style={styles.metricItem}>
              <Text style={[styles.metricValue, { color: currentTheme.colors.text }]}>
                {formatLastChecked(apiStatus.lastChecked)}
              </Text>
              <Text style={[styles.metricLabel, { color: currentTheme.colors.textSecondary }]}>
                Updated
              </Text>
            </View>
          </View>

          {/* Error display */}
          {apiStatus.error && (
            <View style={styles.errorBanner}>
              <FontAwesome5 name="exclamation-triangle" size={12} color="#FF5252" />
              <Text style={styles.errorText} numberOfLines={2}>
                {redactText(apiStatus.error)}
              </Text>
            </View>
          )}

          {/* Progress bar for uptime */}
          <View style={styles.uptimeBar}>
            <View 
              style={[
                styles.uptimeProgress, 
                { 
                  width: `${Math.max(0, Math.min(100, apiStatus.uptime))}%`,
                  backgroundColor: apiStatus.uptime >= 95 ? '#00C851' : 
                                   apiStatus.uptime >= 80 ? '#FFB74D' : '#FF5252'
                }
              ]} 
            />
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  return (
    <Animated.View 
      style={[
        styles.container, 
        { 
          backgroundColor: currentTheme.colors.background,
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }]
        }
      ]}
    >
      {/* Modern Header */}
      <View style={[styles.header, { backgroundColor: currentTheme.colors.background }]}>
        <TouchableOpacity
          style={[styles.headerButton, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }]}
          onPress={() => router.back()}
        >
          <FontAwesome5 name="arrow-left" size={20} color={currentTheme.colors.text} />
        </TouchableOpacity>
        
        <View style={styles.headerContent}>
          <Text style={[styles.headerTitle, { color: currentTheme.colors.text }]}>
            API Monitor
          </Text>
          <Text style={[styles.headerSubtitle, { color: currentTheme.colors.textSecondary }]}>
            Real-time status tracking
          </Text>
        </View>

        <TouchableOpacity
          style={[
            styles.headerButton,
            autoRefresh ? styles.autoRefreshActive : { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }
          ]}
          onPress={() => setAutoRefresh(!autoRefresh)}
        >
          <FontAwesome5 
            name={autoRefresh ? "pause" : "sync-alt"} 
            size={18} 
            color={autoRefresh ? '#fff' : currentTheme.colors.text} 
          />
        </TouchableOpacity>
      </View>

      {/* Overview Stats */}
      <View style={[styles.statsCard, { backgroundColor: currentTheme.colors.surface }]}>
        <View style={styles.statRow}>
          <View style={styles.primaryStat}>
            <Text style={[styles.statNumber, { color: '#00C851' }]}>
              {overallStats.online}
            </Text>
            <Text style={[styles.statLabel, { color: currentTheme.colors.textSecondary }]}>
              ONLINE
            </Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.secondaryStat}>
            <Text style={[styles.statValue, { color: currentTheme.colors.text }]}>
              {overallStats.total}
            </Text>
            <Text style={[styles.statSubLabel, { color: currentTheme.colors.textSecondary }]}>
              Total APIs
            </Text>
          </View>
          <View style={styles.secondaryStat}>
            <Text style={[styles.statValue, { color: currentTheme.colors.text }]}>
              {formatResponseTime(overallStats.avgResponseTime)}
            </Text>
            <Text style={[styles.statSubLabel, { color: currentTheme.colors.textSecondary }]}>
              Avg Response
            </Text>
          </View>
          <View style={styles.secondaryStat}>
            <Text style={[styles.statValue, { color: currentTheme.colors.text }]}>
              {overallStats.avgUptime.toFixed(0)}%
            </Text>
            <Text style={[styles.statSubLabel, { color: currentTheme.colors.textSecondary }]}>
              Uptime
            </Text>
          </View>
        </View>
      </View>

      {/* Category Filter */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.categoryScrollView}
        contentContainerStyle={styles.categoryContainer}
      >
        {categories.map((category) => {
          const stats = getCategoryStats(category);
          const isSelected = selectedCategory === category;
          
          return (
            <TouchableOpacity
              key={category}
              style={[
                styles.categoryChip,
                isSelected && styles.categoryChipActive,
                { 
                  backgroundColor: isSelected ? '#007AFF' : (isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)')
                }
              ]}
              onPress={() => setSelectedCategory(category)}
            >
              <Text style={[
                styles.categoryText,
                { color: isSelected ? '#fff' : currentTheme.colors.text }
              ]}>
                {category}
              </Text>
              <View style={[
                styles.categoryBadge,
                { backgroundColor: isSelected ? 'rgba(255,255,255,0.2)' : currentTheme.colors.surface }
              ]}>
                <Text style={[
                  styles.categoryBadgeText,
                  { color: isSelected ? '#fff' : currentTheme.colors.textSecondary }
                ]}>
                  {stats.online}/{stats.total}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* API Status List */}
      <ScrollView
        style={styles.apiList}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={['#007AFF']}
            tintColor={isDarkMode ? '#007AFF' : '#666'}
            progressBackgroundColor={currentTheme.colors.surface}
          />
        }
      >
        {filteredStatuses.map((apiStatus, index) => (
          <StatusCard 
            key={apiStatus.endpoint.name} 
            apiStatus={apiStatus} 
            index={index}
          />
        ))}
        
        <View style={styles.listFooter}>
          <MaterialIcons name="info-outline" size={16} color={currentTheme.colors.textSecondary} />
          <Text style={[styles.footerText, { color: currentTheme.colors.textSecondary }]}>
            Tap any API for detailed information • Pull to refresh
          </Text>
        </View>
      </ScrollView>
    </Animated.View>
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
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingTop: Platform.OS === 'ios' ? 60 : 16,
  },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  autoRefreshActive: {
    backgroundColor: '#007AFF',
  },
  headerContent: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 13,
    fontWeight: '500',
    marginTop: 2,
  },
  statsCard: {
    marginHorizontal: 20,
    marginVertical: 16,
    borderRadius: 16,
    padding: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: isDarkMode ? 0.3 : 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  primaryStat: {
    alignItems: 'center',
    flex: 1,
  },
  statNumber: {
    fontSize: 36,
    fontWeight: '800',
    letterSpacing: -1,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
    letterSpacing: 1,
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
    marginHorizontal: 20,
  },
  secondaryStat: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  statSubLabel: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 4,
  },
  categoryScrollView: {
    maxHeight: 60,
  },
  categoryContainer: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    gap: 12,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 8,
  },
  categoryChipActive: {
    backgroundColor: '#007AFF',
  },
  categoryText: {
    fontSize: 14,
    fontWeight: '600',
  },
  categoryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  categoryBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  apiList: {
    flex: 1,
    paddingHorizontal: 20,
  },
  apiCard: {
    marginBottom: 16,
  },
  apiCardContent: {
    backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : '#fff',
    borderRadius: 16,
    padding: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: isDarkMode ? 0.3 : 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  apiCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  apiIconContainer: {
    marginRight: 12,
  },
  apiIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  apiInfo: {
    flex: 1,
  },
  apiName: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  apiCategory: {
    fontSize: 13,
    fontWeight: '500',
    marginTop: 2,
  },
  statusIndicator: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  apiDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  metricsGrid: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  metricItem: {
    flex: 1,
    alignItems: 'center',
  },
  metricValue: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 82, 82, 0.1)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    gap: 8,
  },
  errorText: {
    color: '#FF5252',
    fontSize: 12,
    flex: 1,
    fontWeight: '500',
  },
  uptimeBar: {
    height: 4,
    backgroundColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  uptimeProgress: {
    height: '100%',
    borderRadius: 2,
  },
  listFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    gap: 8,
  },
  footerText: {
    fontSize: 13,
    fontWeight: '500',
  },
}); 