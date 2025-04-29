import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Subtitle } from '../types/player';
import { usePlayerContext, PlayerPreferences } from '../contexts/PlayerContext';

interface ControlsOverlayProps {
  // ... existing props ...
  availableSubtitles: Subtitle[];
  selectedSubtitle: Subtitle | null;
  onSubtitleChange: (subtitle: Subtitle) => void;
}

export const ControlsOverlay = ({
  // ... existing props ...
  availableSubtitles,
  selectedSubtitle,
  onSubtitleChange
}: ControlsOverlayProps) => {
  const playerContext = usePlayerContext();
  const [showSubtitleMenu, setShowSubtitleMenu] = useState(false);

  // Add subtitle menu
  const renderSubtitleMenu = () => {
    if (!showSubtitleMenu) return null;

    return (
      <View style={styles.subtitleMenu}>
        <TouchableOpacity
          style={[
            styles.subtitleOption,
            !playerContext.preferences.subtitlesEnabled && styles.subtitleOptionSelected
          ]}
          onPress={() => {
            playerContext.setPreferences({
              ...playerContext.preferences,
              subtitlesEnabled: false
            });
            setShowSubtitleMenu(false);
          }}
        >
          <Text style={styles.subtitleOptionText}>Off</Text>
        </TouchableOpacity>
        
        {availableSubtitles.map((subtitle, index) => (
          <TouchableOpacity
            key={index}
            style={[
              styles.subtitleOption,
              playerContext.preferences.subtitlesEnabled &&
              selectedSubtitle?.lang === subtitle.lang &&
              styles.subtitleOptionSelected
            ]}
            onPress={() => {
              playerContext.setPreferences({
                ...playerContext.preferences,
                subtitlesEnabled: true
              });
              onSubtitleChange(subtitle);
              setShowSubtitleMenu(false);
            }}
          >
            <Text style={styles.subtitleOptionText}>{subtitle.lang}</Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  return (
    <View style={styles.controlsContainer}>
      {/* ... existing controls ... */}
      
      {/* Add controls container for buttons */}
      <View style={styles.bottomControls}>
        {/* Add debug toggle button */}
        <TouchableOpacity
          style={styles.controlButton}
          onPress={() => {
            playerContext.setPreferences({
              ...playerContext.preferences,
              debugOverlayEnabled: !playerContext.preferences.debugOverlayEnabled
            });
          }}
        >
          <Text style={styles.buttonText}>
            {playerContext.preferences.debugOverlayEnabled ? 'Debug On' : 'Debug Off'}
          </Text>
        </TouchableOpacity>

        {/* Add subtitle button */}
        <TouchableOpacity
          style={styles.controlButton}
          onPress={() => setShowSubtitleMenu(!showSubtitleMenu)}
        >
          <Text style={styles.buttonText}>
            {playerContext.preferences.subtitlesEnabled
              ? selectedSubtitle?.lang || 'CC'
              : 'CC Off'}
          </Text>
        </TouchableOpacity>
      </View>

      {renderSubtitleMenu()}
    </View>
  );
};

const styles = StyleSheet.create({
  controlsContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomControls: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    flexDirection: 'row',
    gap: 8,
  },
  controlButton: {
    padding: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 4,
  },
  buttonText: {
    color: '#fff',
    fontSize: 14,
  },
  subtitleMenu: {
    position: 'absolute',
    right: 16,
    bottom: 56,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    borderRadius: 8,
    padding: 8,
    maxHeight: 200,
  },
  subtitleOption: {
    padding: 8,
    borderRadius: 4,
  },
  subtitleOptionSelected: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  subtitleOptionText: {
    color: '#fff',
    fontSize: 14,
  },
}); 