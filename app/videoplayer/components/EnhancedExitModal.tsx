import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, ActivityIndicator } from 'react-native';
import { BlurView } from 'expo-blur';
import { FontAwesome5 } from '@expo/vector-icons';
import { PLAYER_COLORS } from '../constants';

const EnhancedExitModal = ({
  visible, 
  onCancel, 
  onExit,
  onSave,
  isSaving,
  saveError,
  isIncognito,
  episodeProgress,
}: {
  visible: boolean;
  onCancel: () => void;
  onExit: () => void;
  onSave: () => void;
  isSaving: boolean;
  saveError: string | null;
  isIncognito: boolean;
  episodeProgress: number;
}) => {
  const [localSaveComplete, setLocalSaveComplete] = useState(false);
  const [anilistSaveComplete, setAnilistSaveComplete] = useState(false);
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  
  // Reset state when modal becomes visible
  useEffect(() => {
    if (visible) {
      setLocalSaveComplete(false);
      setAnilistSaveComplete(false);
    }
  }, [visible]);
  
  // When a save operation completes, update the UI
  useEffect(() => {
    if (!isSaving && visible) {
      setLocalSaveComplete(true);
      
      // After a small delay, show AniList save as complete too
      const timer = setTimeout(() => {
        setAnilistSaveComplete(true);
      }, 800);
      
      return () => clearTimeout(timer);
    }
  }, [isSaving, visible]);
  
  const progressPercent = Math.min(99, Math.round(episodeProgress * 100));
  const isAlmostComplete = progressPercent >= 85;
  
  return (
    <Modal
      animationType="fade"
      transparent={true}
      visible={visible}
      onRequestClose={onCancel}
    >
      <View style={styles.exitModalContainer}>
        <BlurView intensity={30} tint="dark" style={styles.blurBackground}>
          <View style={styles.exitModalContent}>
            <Text style={styles.exitModalTitle}>
              {isSaving ? "Saving Progress..." : "Save & Exit"}
            </Text>
            
            {/* Progress information */}
            <View style={styles.progressInfoContainer}>
              <Text style={styles.progressInfoText}>
                Current progress: {progressPercent}%
              </Text>
              <View style={styles.progressBarWrapper}>
                <View 
                  style={[
                    styles.progressBarFill, 
                    { 
                      width: `${progressPercent}%`,
                      backgroundColor: isAlmostComplete ? '#4CAF50' : '#02A9FF' 
                    }
                  ]}
                />
              </View>
              <Text style={styles.progressInfoSubtext}>
                {isAlmostComplete 
                  ? "This episode will be marked as completed" 
                  : "Progress will be saved for later"}
              </Text>
            </View>
            
            {/* Saving status indicators */}
            <View style={styles.saveStatusContainer}>
              <View style={styles.saveStatusRow}>
                <View style={[
                  styles.saveStatusIndicator, 
                  localSaveComplete ? styles.saveStatusComplete : styles.saveStatusPending
                ]}>
                  {localSaveComplete ? (
                    <FontAwesome5 name="check" size={12} color="#FFFFFF" />
                  ) : (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  )}
                </View>
                <Text style={styles.saveStatusText}>
                  Local progress {localSaveComplete ? "saved" : "saving"}
                </Text>
              </View>
              
              {!isIncognito && (
                <View style={styles.saveStatusRow}>
                  <View style={[
                    styles.saveStatusIndicator, 
                    anilistSaveComplete ? styles.saveStatusComplete : styles.saveStatusPending
                  ]}>
                    {anilistSaveComplete ? (
                      <FontAwesome5 name="check" size={12} color="#FFFFFF" />
                    ) : (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    )}
                  </View>
                  <Text style={styles.saveStatusText}>
                    AniList {anilistSaveComplete ? "updated" : "updating"}
                  </Text>
                </View>
              )}
              
              {isIncognito && (
                <View style={styles.saveStatusRow}>
                  <View style={[styles.saveStatusIndicator, styles.saveStatusIncognito]}>
                    <FontAwesome5 name="eye-slash" size={12} color="#FFFFFF" />
                  </View>
                  <Text style={styles.saveStatusText}>
                    Incognito Mode - Not saving
                  </Text>
                </View>
              )}
            </View>
            
            {/* Error message */}
            {saveError && (
              <Text style={styles.saveErrorText}>{saveError}</Text>
            )}
            
            {/* Additional options toggle */}
            <TouchableOpacity 
              style={styles.advancedOptionsToggle}
              onPress={() => setShowAdvancedOptions(!showAdvancedOptions)}
            >
              <Text style={styles.advancedOptionsToggleText}>
                {showAdvancedOptions ? "Hide options" : "Show options"}
              </Text>
              <FontAwesome5 
                name={showAdvancedOptions ? "chevron-up" : "chevron-down"} 
                size={12} 
                color="#02A9FF" 
              />
            </TouchableOpacity>
            
            {/* Advanced options */}
            {showAdvancedOptions && (
              <View style={styles.advancedOptionsContainer}>
                {/* Completion threshold option */}
                <View style={styles.advancedOption}>
                  <FontAwesome5 
                    name="check-circle" 
                    size={16} 
                    color="#FFFFFF" 
                  />
                  <Text style={styles.advancedOptionText}>
                    Mark as complete at 85%
                  </Text>
                </View>
              </View>
            )}
            
            {/* Action buttons */}
            <View style={styles.exitModalButtons}>
              <TouchableOpacity 
                style={[styles.exitModalButton, styles.exitModalCancelButton]}
                onPress={onCancel}
              >
                <Text style={styles.exitModalButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.exitModalButton, styles.exitModalExitButton]}
                onPress={onExit}
                disabled={isSaving}
              >
                <Text style={styles.exitModalButtonText}>
                  {isIncognito ? "Exit without saving" : "Exit"}
                </Text>
              </TouchableOpacity>
              
              {!isIncognito && (
                <TouchableOpacity 
                  style={[styles.exitModalButton, styles.exitModalSaveButton]}
                  onPress={onSave}
                  disabled={isSaving}
                >
                  <Text style={styles.exitModalButtonText}>
                    {isSaving ? "Saving..." : "Save & sync"}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </BlurView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  exitModalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(13, 27, 42, 0.6)',
  },
  blurBackground: {
    width: '90%',
    maxWidth: 400,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(173, 216, 230, 0.2)',
  },
  exitModalContent: {
    padding: 20,
    backgroundColor: 'rgba(13, 27, 42, 0.9)',
  },
  exitModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 20,
    textAlign: 'center',
  },
  progressInfoContainer: {
    width: '100%',
    marginBottom: 20,
  },
  progressInfoText: {
    color: '#FFFFFF',
    fontSize: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  progressBarWrapper: {
    width: '100%',
    height: 8,
    backgroundColor: 'rgba(173, 216, 230, 0.2)',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressInfoSubtext: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
    textAlign: 'center',
  },
  saveStatusContainer: {
    width: '100%',
    marginBottom: 20,
  },
  saveStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  saveStatusIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  saveStatusComplete: {
    backgroundColor: '#4CAF50',
  },
  saveStatusPending: {
    backgroundColor: PLAYER_COLORS.PRIMARY,
  },
  saveStatusIncognito: {
    backgroundColor: '#9E9E9E',
  },
  saveStatusText: {
    color: '#FFFFFF',
    fontSize: 14,
  },
  saveErrorText: {
    color: '#FF5252',
    fontSize: 14,
    marginBottom: 16,
    textAlign: 'center',
  },
  advancedOptionsToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  advancedOptionsToggleText: {
    color: PLAYER_COLORS.PRIMARY,
    fontSize: 14,
    marginRight: 5,
  },
  advancedOptionsContainer: {
    width: '100%',
    marginBottom: 16,
    padding: 10,
    backgroundColor: 'rgba(173, 216, 230, 0.1)',
    borderRadius: 8,
  },
  advancedOption: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  advancedOptionText: {
    color: '#FFFFFF',
    fontSize: 14,
    marginLeft: 10,
  },
  exitModalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  exitModalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 5,
  },
  exitModalCancelButton: {
    backgroundColor: 'rgba(173, 216, 230, 0.2)',
  },
  exitModalExitButton: {
    backgroundColor: PLAYER_COLORS.SECONDARY,
  },
  exitModalSaveButton: {
    backgroundColor: PLAYER_COLORS.PRIMARY,
  },
  exitModalButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
});

export default EnhancedExitModal; 