import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, StatusBar } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';

interface Chapter {
  id: string;
  number: string;
  title: string;
  url: string;
}

interface ReaderUIProps {
  showUI: boolean;
  title: string;
  chapter: string;
  currentPageIndex: number;
  totalPages: number;
  readingProgress: number;
  hasNextChapter: boolean;
  hasPreviousChapter: boolean;
  nextChapter?: Chapter;
  previousChapter?: Chapter;
  onBack: () => void;
  onNextChapter: () => void;
  onPreviousChapter: () => void;
  onSettings?: () => void;
  isInitialLoading?: boolean;
  loadingProgress?: number;
}

const ReaderUI: React.FC<ReaderUIProps> = ({
  showUI,
  title,
  chapter,
  currentPageIndex,
  totalPages,
  readingProgress,
  hasNextChapter,
  hasPreviousChapter,
  nextChapter,
  previousChapter,
  onBack,
  onNextChapter,
  onPreviousChapter,
  onSettings,
  isInitialLoading = false,
  loadingProgress = 0,
}) => {
  if (!showUI) return null;

  return (
    <>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <FontAwesome5 name="arrow-left" size={20} color="#fff" />
        </TouchableOpacity>
        <View style={styles.titleContainer}>
          <Text style={styles.title} numberOfLines={1}>
            {title.replace(/Chapter \d+:?\s*/, '')}
          </Text>
          <Text style={styles.subtitle}>
            Chapter {chapter} • Page {currentPageIndex + 1}/{totalPages}
            {isInitialLoading && ` • Loading ${Math.round(loadingProgress)}%`}
          </Text>
        </View>
        <View style={styles.headerButtons}>
          <View style={styles.progressIndicator}>
            <Text style={styles.progressText}>{Math.round(readingProgress)}%</Text>
          </View>
          {onSettings && (
            <TouchableOpacity onPress={onSettings} style={styles.settingsButton}>
              <FontAwesome5 name="cog" size={16} color="#fff" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Progress Bar */}
      <View style={styles.progressBarContainer}>
        <View style={[styles.progressBar, { width: `${readingProgress}%` }]} />
      </View>
      
      {/* Loading Progress Bar */}
      {isInitialLoading && (
        <View style={[styles.progressBarContainer, { top: Platform.OS === 'ios' ? 91 : (StatusBar.currentHeight || 0) + 47, backgroundColor: 'rgba(2, 169, 255, 0.2)' }]}>
          <View style={[styles.progressBar, { width: `${loadingProgress}%`, backgroundColor: '#02A9FF' }]} />
        </View>
      )}

      {/* Chapter Navigation */}
      <View style={styles.chapterNavigation}>
        {hasPreviousChapter && previousChapter && (
          <TouchableOpacity 
            style={[styles.chapterNavButton, styles.previousButton]}
            onPress={onPreviousChapter}
          >
            <FontAwesome5 name="chevron-left" size={16} color="#fff" />
            <View style={styles.chapterInfo}>
              <Text style={styles.chapterNavLabel}>Previous</Text>
              <Text style={styles.chapterNavText} numberOfLines={1}>
                Ch. {previousChapter.number}
              </Text>
            </View>
          </TouchableOpacity>
        )}
        
        {hasNextChapter && nextChapter && (
          <TouchableOpacity 
            style={[styles.chapterNavButton, styles.nextButton]}
            onPress={onNextChapter}
          >
            <View style={styles.chapterInfo}>
              <Text style={styles.chapterNavLabel}>Next</Text>
              <Text style={styles.chapterNavText} numberOfLines={1}>
                Ch. {nextChapter.number}
              </Text>
            </View>
            <FontAwesome5 name="chevron-right" size={16} color="#fff" />
          </TouchableOpacity>
        )}
      </View>
    </>
  );
};

const styles = StyleSheet.create({
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 44 : StatusBar.currentHeight,
    paddingHorizontal: 16,
    paddingBottom: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    zIndex: 1000,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  titleContainer: {
    flex: 1,
    marginLeft: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  subtitle: {
    fontSize: 14,
    color: '#fff',
    opacity: 0.8,
    marginTop: 2,
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  progressIndicator: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  progressText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  progressBarContainer: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 88 : (StatusBar.currentHeight || 0) + 44,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    zIndex: 999,
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#02A9FF',
  },
  chapterNavigation: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 44 : 24,
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    zIndex: 1000,
  },
  chapterNavButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 24,
    gap: 8,
    maxWidth: '45%',
  },
  previousButton: {
    alignSelf: 'flex-start',
  },
  nextButton: {
    alignSelf: 'flex-end',
  },
  chapterInfo: {
    alignItems: 'center',
  },
  chapterNavLabel: {
    color: '#fff',
    fontSize: 12,
    opacity: 0.7,
  },
  chapterNavText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  settingsButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
});

export default ReaderUI; 