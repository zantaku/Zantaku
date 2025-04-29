import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { showMessage } from '../utils';

interface SpeedOptionsProps {
  showSpeedOptions: boolean;
  currentSpeed: number;
  onSelectSpeed: (speed: number) => void;
  onClose: () => void;
}

const SpeedOptions: React.FC<SpeedOptionsProps> = ({
  showSpeedOptions,
  currentSpeed,
  onSelectSpeed,
  onClose,
}) => {
  if (!showSpeedOptions) return null;
  
  const speedOptions = [0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0];
  
  return (
    <View style={styles.speedOptionsContainer}>
      <Text style={styles.speedTitle}>Playback Speed</Text>
      <View style={styles.speedButtons}>
        {speedOptions.map((speed) => (
          <TouchableOpacity
            key={speed}
            style={[
              styles.speedButton,
              currentSpeed === speed && styles.activeSpeedButton
            ]}
            onPress={() => {
              onSelectSpeed(speed);
              showMessage(`Playback speed set to ${speed}x`);
              onClose();
            }}
          >
            <Text style={[
              styles.speedButtonText,
              currentSpeed === speed && styles.activeSpeedButtonText
            ]}>
              {speed}x
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <TouchableOpacity style={styles.closeButton} onPress={onClose}>
        <Text style={styles.closeButtonText}>Close</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  speedOptionsContainer: {
    position: 'absolute',
    top: '30%',
    left: '10%',
    right: '10%',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    zIndex: 10,
  },
  speedTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  speedButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  speedButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    minWidth: 80,
    alignItems: 'center',
  },
  activeSpeedButton: {
    backgroundColor: '#FF6B00',
  },
  speedButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  activeSpeedButtonText: {
    fontWeight: 'bold',
  },
  closeButton: {
    marginTop: 24,
    paddingVertical: 8,
    paddingHorizontal: 32,
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

export default SpeedOptions; 