import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { PLAYER_COLORS, MODAL_STYLES } from '../constants';

interface SaveProgressModalProps {
  isVisible: boolean;
  onCancel: () => void;
  onSave: (rememberChoice: boolean) => void;
  onSaveToAniList?: (rememberChoice: boolean) => void;
  onExitWithoutSaving?: () => void;
  animeName?: string;
  episodeNumber?: string | number;
  currentTime?: number;
  duration?: number;
  anilistId?: string;
  isSavingProgress?: boolean;
  anilistUser?: {
    userId: number;
    username: string;
    token: string;
    avatar?: string;
  };
}

export default function SaveProgressModal({
  isVisible,
  onCancel,
  onSave,
  onSaveToAniList,
  onExitWithoutSaving,
  animeName,
  episodeNumber,
  currentTime,
  duration,
  anilistId,
  isSavingProgress = false,
  anilistUser
}: SaveProgressModalProps) {
  const [rememberChoice, setRememberChoice] = useState(false);
  const [showSaveOptions, setShowSaveOptions] = useState(false);
  
  // Add debug logging to help diagnose why the AniList button isn't showing
  useEffect(() => {
    if (isVisible) {
      console.log('[SAVE_PROGRESS_MODAL] 🔍 Modal is visible with props:', {
        hasAnilistId: Boolean(anilistId),
        anilistId: anilistId || 'Not provided',
        hasSaveToAniListCallback: Boolean(onSaveToAniList),
        isSavingProgress,
        animeName: animeName || 'Not provided',
        episodeNumber: episodeNumber || 'Not provided',
        showAniListButton: Boolean(anilistId && onSaveToAniList),
        hasAnilistUser: Boolean(anilistUser),
        anilistUserId: anilistUser?.userId || 'Not provided',
        anilistUsername: anilistUser?.username || 'Not provided'
      });
    }
  }, [isVisible, anilistId, onSaveToAniList, anilistUser]);
  
  if (!isVisible) return null;
  
  // Determine if we should show the AniList button
  const hasAniList = Boolean(anilistId && onSaveToAniList && anilistUser?.token);

  if (showSaveOptions) {
    // Show the secondary modal with save options
    return (
      <BlurView
        style={styles.modalBlur}
        intensity={MODAL_STYLES.BLUR_INTENSITY}
        tint="dark"
      >
        <View style={styles.modalCard}>
          <Text style={styles.title}>Save To:</Text>
          
          <View style={styles.buttonContainer}>
            <TouchableOpacity 
              onPress={() => onSave(rememberChoice)} 
              style={styles.saveBtn}
            >
              <Text style={styles.saveBtnText}>Local Storage</Text>
            </TouchableOpacity>
            
            {hasAniList && (
              <TouchableOpacity 
                style={[styles.anilistBtn, isSavingProgress && styles.buttonDisabled]}
                onPress={() => onSaveToAniList && onSaveToAniList(rememberChoice)}
                disabled={isSavingProgress}
              >
                {isSavingProgress ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.saveBtnText}>AniList</Text>
                )}
              </TouchableOpacity>
            )}
          </View>
          
          <TouchableOpacity 
            onPress={() => setShowSaveOptions(false)} 
            style={styles.cancelBtn}
          >
            <Text style={styles.cancelBtnText}>Back</Text>
          </TouchableOpacity>
        </View>
      </BlurView>
    );
  }

  return (
    <BlurView
      style={styles.modalBlur}
      intensity={MODAL_STYLES.BLUR_INTENSITY}
      tint="dark"
    >
      <View style={styles.modalCard}>
        <Text style={styles.title}>Save Progress?</Text>
        
        <Text style={styles.body}>
          Would you like to save your progress before leaving?
          {episodeNumber ? ` (Episode ${episodeNumber})` : ''}
        </Text>

        <View style={styles.toggleRow}>
          <TouchableOpacity 
            style={styles.toggleContainer}
            onPress={() => setRememberChoice(!rememberChoice)}
          >
            <View style={[styles.toggleTrack, rememberChoice && styles.toggleTrackActive]}>
              <View style={[styles.toggleThumb, rememberChoice && styles.toggleThumbActive]} />
            </View>
            <Text style={styles.toggleText}>Remember my choice</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.threeButtonRow}>
          <TouchableOpacity onPress={onCancel} style={styles.cancelBtnSmall}>
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            onPress={onExitWithoutSaving || onCancel} 
            style={styles.noBtn}
          >
            <Text style={styles.noBtnText}>No</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            onPress={() => {
              if (hasAniList) {
                setShowSaveOptions(true);
              } else {
                onSave(rememberChoice);
              }
            }} 
            style={styles.yesBtn}
          >
            <Text style={styles.yesBtnText}>Yes</Text>
          </TouchableOpacity>
        </View>
      </View>
    </BlurView>
  );
}

const styles = StyleSheet.create({
  modalBlur: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  modalCard: {
    width: '80%',
    backgroundColor: 'rgba(13, 27, 42, 0.9)',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(173, 216, 230, 0.2)',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 16,
    textAlign: 'center',
  },
  body: {
    fontSize: 16,
    color: '#FFFFFF',
    marginBottom: 16,
    textAlign: 'center',
    opacity: 0.9,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    alignSelf: 'flex-start',
  },
  toggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  toggleTrack: {
    width: 44,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    paddingHorizontal: 2,
    marginRight: 10,
  },
  toggleTrackActive: {
    backgroundColor: PLAYER_COLORS.PRIMARY,
  },
  toggleThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    alignSelf: 'flex-start',
  },
  toggleThumbActive: {
    alignSelf: 'flex-end',
  },
  toggleText: {
    color: '#FFFFFF',
    fontSize: 14,
  },
  threeButtonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  buttonContainer: {
    width: '100%',
    marginBottom: 16,
  },
  cancelBtnSmall: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginRight: 4,
    alignItems: 'center',
  },
  cancelBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
  noBtn: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 100, 100, 0.8)',
    marginHorizontal: 4,
    alignItems: 'center',
  },
  noBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
  },
  yesBtn: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: PLAYER_COLORS.PRIMARY,
    marginLeft: 4,
    alignItems: 'center',
  },
  yesBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
  },
  saveBtn: {
    width: '100%',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: PLAYER_COLORS.PRIMARY,
    marginBottom: 8,
    alignItems: 'center',
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
  },
  anilistBtn: {
    width: '100%',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: PLAYER_COLORS.SECONDARY,
    marginBottom: 8,
    alignItems: 'center',
  },
  cancelBtn: {
    width: '100%',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
}); 