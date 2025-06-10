import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal } from 'react-native';
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
    <Modal
      visible={showSpeedOptions}
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
  speedOptionsContainer: {
    width: '85%',
    maxWidth: 400,
    backgroundColor: 'rgba(20, 20, 20, 0.95)',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
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
  speedTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  speedButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 20,
  },
  speedButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 25,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    minWidth: 80,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  activeSpeedButton: {
    backgroundColor: '#FF6B00',
    borderColor: '#FF6B00',
  },
  speedButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  activeSpeedButtonText: {
    fontWeight: 'bold',
    color: '#fff',
  },
  closeButton: {
    paddingVertical: 12,
    paddingHorizontal: 40,
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default SpeedOptions; 