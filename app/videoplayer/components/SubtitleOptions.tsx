import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal } from 'react-native';
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
    <Modal
      visible={showSubtitleOptions}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <TouchableOpacity 
          style={styles.modalBackdrop} 
          activeOpacity={1} 
          onPress={onClose}
        />
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
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  subtitleOptionsContainer: {
    width: 280,
    maxHeight: 400,
    backgroundColor: 'rgba(20, 20, 20, 0.95)',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  settingsTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  subtitleOptionsList: {
    maxHeight: 250,
  },
  subtitleOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 6,
    marginBottom: 2,
  },
  selectedSubtitleOption: {
    backgroundColor: 'rgba(255, 107, 0, 0.2)',
    borderColor: 'rgba(255, 107, 0, 0.3)',
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
    marginTop: 16,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 8,
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default SubtitleOptions; 