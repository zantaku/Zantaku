import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import type { Subtitle } from '../types';

interface SubtitleOptionsProps {
  showSubtitleOptions: boolean;
  subtitles: Subtitle[];
  selectedSubtitleLanguage: string;
  onSelectLanguage: (language: string) => void;
  onClose: () => void;
}

const SubtitleOptions: React.FC<SubtitleOptionsProps> = ({
  showSubtitleOptions,
  subtitles,
  selectedSubtitleLanguage,
  onSelectLanguage,
  onClose,
}) => {
  if (!showSubtitleOptions) return null;
  
  const availableLanguages = subtitles 
    ? [...new Set(subtitles.map(sub => sub.lang))]
    : ['English']; // Default if no subtitles available
  
  return (
    <View style={styles.subtitleOptionsContainer}>
      <Text style={styles.settingsTitle}>Subtitle Language</Text>
      <ScrollView style={styles.subtitleOptionsList}>
        {availableLanguages.map((lang) => (
          <TouchableOpacity
            key={lang}
            style={[
              styles.subtitleOption,
              selectedSubtitleLanguage === lang && styles.selectedSubtitleOption
            ]}
            onPress={() => onSelectLanguage(lang)}
          >
            <Text style={[
              styles.subtitleOptionText,
              selectedSubtitleLanguage === lang && styles.selectedSubtitleOptionText
            ]}>
              {lang}
            </Text>
            {selectedSubtitleLanguage === lang && (
              <FontAwesome5 name="check" size={16} color="#FF6B00" />
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>
      <TouchableOpacity
        style={styles.closeButton}
        onPress={onClose}
      >
        <Text style={styles.closeButtonText}>Close</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  subtitleOptionsContainer: {
    position: 'absolute',
    bottom: 100,
    right: 20,
    width: 250,
    maxHeight: 300,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    borderRadius: 10,
    padding: 15,
    zIndex: 10,
  },
  settingsTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  subtitleOptionsList: {
    maxHeight: 200,
  },
  subtitleOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  selectedSubtitleOption: {
    backgroundColor: 'rgba(255, 107, 0, 0.2)',
    borderRadius: 5,
  },
  subtitleOptionText: {
    color: 'white',
    fontSize: 16,
  },
  selectedSubtitleOptionText: {
    color: '#FF6B00',
    fontWeight: 'bold',
  },
  closeButton: {
    marginTop: 10,
    paddingVertical: 8,
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 4,
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
});

export default SubtitleOptions; 