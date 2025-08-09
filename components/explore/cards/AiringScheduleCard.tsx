import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform, Animated } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { FontAwesome5 } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';

interface AiringScheduleCardProps {
  data: {
    items?: any[];
    title?: string;
    subtitle?: string;
    showTimeline?: boolean;
    showReminders?: boolean;
    showLiveIndicator?: boolean;
    showEpisodeCount?: boolean;
  } | any[];
  theme: any;
  isDarkMode: boolean;
}

export default function AiringScheduleCard({ data, theme, isDarkMode }: AiringScheduleCardProps) {
  const router = useRouter();
  
  // Handle both old array format and new object format
  const items = Array.isArray(data) ? data : (data?.items || []);
  const title = Array.isArray(data) ? 'Airing Schedule' : (data?.title || 'Airing Schedule');
  const subtitle = Array.isArray(data) ? 'What\'s airing this week' : (data?.subtitle || 'What\'s airing this week');
  const showTimeline = Array.isArray(data) ? false : (data?.showTimeline ?? false);
  const showReminders = Array.isArray(data) ? false : (data?.showReminders ?? false);
  const showLiveIndicator = Array.isArray(data) ? true : (data?.showLiveIndicator ?? true);
  const showEpisodeCount = Array.isArray(data) ? true : (data?.showEpisodeCount ?? true);

  const [selectedDay, setSelectedDay] = useState(0);
  const [reminders, setReminders] = useState<{ [key: number]: boolean }>({});
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    // Update current time every minute
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  const getAiringStatus = (airingAt: number) => {
    const airingDate = new Date(airingAt * 1000);
    const timeDiff = airingDate.getTime() - currentTime.getTime();
    const minutesDiff = Math.abs(timeDiff) / (1000 * 60);
    
    if (minutesDiff <= 15) return 'airing';
    if (timeDiff < 0 && minutesDiff <= 60) return 'just-aired';
    if (timeDiff < -60 * 60 * 1000) return 'aired';
    return 'upcoming';
  };

  const formatAiringTime = (airingAt: number) => {
    const airingDate = new Date(airingAt * 1000);
    const timeDiff = airingDate.getTime() - currentTime.getTime();
    const minutesDiff = Math.abs(timeDiff) / (1000 * 60);
    const hoursDiff = Math.abs(timeDiff) / (1000 * 60 * 60);
    
    if (minutesDiff <= 15) return 'AIRING NOW';
    if (timeDiff < 0 && minutesDiff <= 60) return 'JUST AIRED';
    if (timeDiff < 0 && hoursDiff <= 24) {
      const hours = Math.floor(hoursDiff);
      return `AIRED ${hours}H AGO`;
    }
    if (timeDiff < -24 * 60 * 60 * 1000) {
      const days = Math.floor(hoursDiff / 24);
      return `AIRED ${days}D AGO`;
    }
    
    return airingDate.toLocaleTimeString([], { 
      hour: 'numeric', 
      minute: '2-digit'
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'airing': return '#4CAF50';
      case 'just-aired': return '#FF9800';
      case 'aired': return '#9E9E9E';
      default: return theme.colors.primary;
    }
  };

  const toggleReminder = (animeId: number) => {
    setReminders(prev => ({
      ...prev,
      [animeId]: !prev[animeId]
    }));
  };

  const getDaySchedules = () => {
    // Group items by day (simplified for demo)
    const days = ['Today', 'Tomorrow', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const schedulesByDay: { [key: string]: any[] } = {};
    
    days.forEach((day, index) => {
      schedulesByDay[day] = items.slice(index * 3, (index + 1) * 3);
    });
    
    return { days, schedulesByDay };
  };

  const { days, schedulesByDay } = getDaySchedules();

  if (!items || items.length === 0) return null;

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={styles.headerLeft}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>{title}</Text>
          <Text style={[styles.sectionSubtitle, { color: theme.colors.textSecondary }]}>
            {subtitle}
          </Text>
        </View>
        {showLiveIndicator && (
          <View style={[styles.liveIndicator, { backgroundColor: '#4CAF50' }]}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>LIVE</Text>
          </View>
        )}
      </View>

      {/* Day Selector */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.daySelector}
      >
        {days.map((day, index) => (
          <TouchableOpacity
            key={day}
            style={[
              styles.dayButton,
              { backgroundColor: selectedDay === index ? theme.colors.primary : 'transparent' }
            ]}
            onPress={() => setSelectedDay(index)}
            activeOpacity={0.7}
          >
            <Text style={[
              styles.dayText,
              { color: selectedDay === index ? '#fff' : theme.colors.text }
            ]}>
              {day}
            </Text>
            {schedulesByDay[day]?.length > 0 && (
              <View style={[
                styles.dayBadge,
                { backgroundColor: selectedDay === index ? '#fff' : theme.colors.primary }
              ]}>
                <Text style={[
                  styles.dayBadgeText,
                  { color: selectedDay === index ? theme.colors.primary : '#fff' }
                ]}>
                  {schedulesByDay[day].length}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Timeline View */}
      {showTimeline ? (
        <View style={styles.timelineContainer}>
          {schedulesByDay[days[selectedDay]]?.map((schedule, index) => {
            const status = getAiringStatus(schedule.airingAt);
            const statusColor = getStatusColor(status);
            
            return (
              <View key={schedule.id} style={styles.timelineItem}>
                <View style={[styles.timelineDot, { backgroundColor: statusColor }]} />
                <View style={styles.timelineContent}>
                  <View style={styles.timelineHeader}>
                    <Text style={[styles.timelineTime, { color: statusColor }]}>
                      {formatAiringTime(schedule.airingAt)}
                    </Text>
                    {showReminders && (
                      <TouchableOpacity
                        style={styles.reminderButton}
                        onPress={() => toggleReminder(schedule.media.id)}
                      >
                        <FontAwesome5 
                          name={reminders[schedule.media.id] ? "bell" : "bell-slash"} 
                          size={12} 
                          color={reminders[schedule.media.id] ? statusColor : theme.colors.textSecondary} 
                        />
                      </TouchableOpacity>
                    )}
                  </View>
                  
                  <TouchableOpacity 
                    style={styles.timelineAnime}
                    onPress={() => router.push(`/anime/${schedule.media.id}`)}
                  >
                    <ExpoImage
                      source={{ uri: schedule.media.coverImage.large }}
                      style={styles.timelineImage}
                      contentFit="cover"
                      transition={300}
                    />
                    <View style={styles.timelineInfo}>
                      <Text style={[styles.timelineTitle, { color: theme.colors.text }]} numberOfLines={2}>
                        {schedule.media.title.english || schedule.media.title.userPreferred}
                      </Text>
                      <View style={styles.timelineMeta}>
                        {showEpisodeCount && (
                          <Text style={[styles.episodeText, { color: theme.colors.textSecondary }]}>
                            Ep {schedule.episode}
                          </Text>
                        )}
                        {schedule.media.averageScore > 0 && (
                          <View style={styles.scoreContainer}>
                            <FontAwesome5 name="star" size={10} color="#FFD700" solid />
                            <Text style={[styles.scoreText, { color: theme.colors.textSecondary }]}>
                              {(schedule.media.averageScore / 10).toFixed(1)}
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </View>
      ) : (
        /* Horizontal Cards View */
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {schedulesByDay[days[selectedDay]]?.map((schedule) => {
            const status = getAiringStatus(schedule.airingAt);
            const statusColor = getStatusColor(status);
            
            return (
              <TouchableOpacity 
                key={schedule.id}
                style={[
                  styles.scheduleCard, 
                  { 
                    backgroundColor: theme.colors.surface,
                    shadowColor: isDarkMode ? '#000' : '#666',
                    opacity: status === 'aired' ? 0.7 : status === 'just-aired' ? 0.9 : 1.0
                  }
                ]}
                onPress={() => router.push(`/anime/${schedule.media.id}`)}
                activeOpacity={0.7}
              >
                {/* Status Badge */}
                <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
                  <Text style={styles.statusText}>{formatAiringTime(schedule.airingAt)}</Text>
                </View>

                {/* Reminder Button */}
                {showReminders && (
                  <TouchableOpacity
                    style={styles.reminderButton}
                    onPress={() => toggleReminder(schedule.media.id)}
                  >
                    <FontAwesome5 
                      name={reminders[schedule.media.id] ? "bell" : "bell-slash"} 
                      size={12} 
                      color={reminders[schedule.media.id] ? statusColor : theme.colors.textSecondary} 
                    />
                  </TouchableOpacity>
                )}

                <ExpoImage
                  source={{ uri: schedule.media.coverImage.large }}
                  style={[
                    styles.scheduleImage,
                    status === 'aired' && { opacity: 0.8 },
                    status === 'just-aired' && { opacity: 0.95 }
                  ]}
                  contentFit="cover"
                  transition={300}
                />
                
                <View style={styles.scheduleInfo}>
                  {showEpisodeCount && (
                    <Text style={[styles.episodeText, { color: theme.colors.textSecondary }]}>
                      Ep {schedule.episode}
                    </Text>
                  )}
                  
                  <Text style={[styles.scheduleTitle, { color: theme.colors.text }]} numberOfLines={2}>
                    {schedule.media.title.english || schedule.media.title.userPreferred}
                  </Text>
                  
                  <View style={styles.scheduleMeta}>
                    {schedule.media.averageScore > 0 && (
                      <View style={styles.scoreContainer}>
                        <FontAwesome5 name="star" size={10} color="#FFD700" solid />
                        <Text style={[styles.scoreText, { color: theme.colors.textSecondary }]}>
                          {(schedule.media.averageScore / 10).toFixed(1)}
                        </Text>
                      </View>
                    )}
                    <View style={[styles.formatBadge, { backgroundColor: theme.colors.primary + '20' }]}>
                      <Text style={[styles.formatText, { color: theme.colors.primary }]}>
                        {schedule.media.format}
                      </Text>
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
          
          {(!schedulesByDay[days[selectedDay]] || schedulesByDay[days[selectedDay]].length === 0) && (
            <View style={[styles.noSchedule, { backgroundColor: theme.colors.surface }]}>
              <FontAwesome5 name="calendar-times" size={24} color={theme.colors.textSecondary} />
              <Text style={[styles.noScheduleText, { color: theme.colors.textSecondary }]}>
                No episodes airing this day
              </Text>
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    paddingHorizontal: 20,
    marginBottom: 40,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerLeft: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 4,
    letterSpacing: -0.5,
  },
  sectionSubtitle: {
    fontSize: 15,
    opacity: 0.7,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#fff',
  },
  liveText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
  },
  daySelector: {
    paddingBottom: 16,
    gap: 8,
  },
  dayButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 6,
  },
  dayText: {
    fontSize: 12,
    fontWeight: '600',
  },
  dayBadge: {
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  dayBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  timelineContainer: {
    paddingLeft: 20,
  },
  timelineItem: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginTop: 4,
    marginRight: 12,
  },
  timelineContent: {
    flex: 1,
  },
  timelineHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  timelineTime: {
    fontSize: 14,
    fontWeight: '800',
  },
  reminderButton: {
    padding: 4,
  },
  timelineAnime: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 12,
    gap: 12,
  },
  timelineImage: {
    width: 60,
    height: 80,
    borderRadius: 8,
  },
  timelineInfo: {
    flex: 1,
    gap: 4,
  },
  timelineTitle: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 18,
  },
  timelineMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  episodeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  scoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  scoreText: {
    fontSize: 11,
    fontWeight: '500',
  },
  scrollContent: {
    paddingRight: 20,
    paddingBottom: 4,
  },
  scheduleCard: {
    width: 160,
    marginRight: 16,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  statusBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    zIndex: 2,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
  },
  scheduleImage: {
    width: '100%',
    height: 220,
    borderRadius: 16,
  },
  scheduleInfo: {
    padding: 12,
    gap: 6,
  },
  scheduleTitle: {
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
    textAlign: 'center',
  },
  scheduleMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 2,
  },
  formatBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  formatText: {
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  noSchedule: {
    width: 200,
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 16,
    gap: 8,
  },
  noScheduleText: {
    fontSize: 14,
    fontWeight: '500',
  },
}); 