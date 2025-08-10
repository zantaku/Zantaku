import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { BlurView } from 'expo-blur';
// import { Ionicons } from '@expo/vector-icons';
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
  onSaveTimestampOnly?: () => void;
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
  anilistUser,
  onSaveTimestampOnly
}: SaveProgressModalProps) {
  const [rememberChoice] = useState(false);
  
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
        anilistUsername: anilistUser?.username || 'Not provided',
        currentTime: currentTime ? `${Math.floor(currentTime / 60)}:${Math.floor(currentTime % 60).toString().padStart(2, '0')}` : 'Not provided',
        duration: duration ? `${Math.floor(duration / 60)}:${Math.floor(duration % 60).toString().padStart(2, '0')}` : 'Not provided'
      });
    }
  }, [isVisible, anilistId, onSaveToAniList, anilistUser, currentTime, duration, animeName, episodeNumber, isSavingProgress]);
  
  if (!isVisible) return null;
  
  // Determine if we should show the AniList button
  const hasAniList = Boolean(anilistId && onSaveToAniList && anilistUser?.token);
  
  // Format time for display
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  
  const hasTime = typeof currentTime === 'number' && typeof duration === 'number' && duration > 0;
  const progressPercent = hasTime ? Math.min(100, Math.max(0, Math.round((currentTime! / duration!) * 100))) : 0;
  const progressText = hasTime
    ? `at ${formatTime(currentTime!)} / ${formatTime(duration!)}`
    : '';

  // NEW: Main modal UI - simplified to show the primary choice
  return (
    <BlurView
      style={styles.modalBlur}
      intensity={MODAL_STYLES.BLUR_INTENSITY}
      tint="dark"
    >
      <View style={styles.modalCard}>
        <Text style={styles.title}>
          {hasAniList ? 'Save to AniList?' : 'Save Progress?'}
        </Text>
        
        <Text style={styles.body}>
          {animeName ? `${animeName} ` : ''}
          {episodeNumber ? `Episode ${episodeNumber}` : ''}
          {progressText && <Text style={styles.progressText}>{'\n'}{progressText}</Text>}
        </Text>

        {hasTime && (
          <View style={styles.progressBlock}>
            <View style={styles.progressBarTrack}>
              <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
            </View>
            <Text style={styles.progressPercentText}>{progressPercent}% watched</Text>
          </View>
        )}

        {hasAniList ? (
          // NEW: AniList save flow
          <View style={styles.buttonContainer}>
            <TouchableOpacity 
              onPress={() => {
                console.log('[SAVE_MODAL] 📱 User chose "No, Exit" - saving timestamp only');
                if (onSaveTimestampOnly) {
                  onSaveTimestampOnly();
                } else {
                  // Fallback to local save
                  onSave(false);
                }
              }} 
              style={styles.noBtn}
            >
              <Text style={styles.noBtnText}>No, Exit</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.yesBtn, isSavingProgress && styles.buttonDisabled]}
              onPress={() => {
                console.log('[SAVE_MODAL] ✅ User chose "Yes, Save & Exit" - saving to AniList', { anilistId, episodeNumber, progressPercent });
                if (onSaveToAniList) {
                  onSaveToAniList(rememberChoice);
                }
              }}
              disabled={isSavingProgress}
            >
              {isSavingProgress ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.yesBtnText}>Yes, Save & Exit</Text>
              )}
            </TouchableOpacity>
          </View>
        ) : (
          // Original flow for non-AniList users
          <View style={styles.threeButtonRow}>
            <TouchableOpacity onPress={() => { console.log('[SAVE_MODAL] ❌ Cancel pressed'); onCancel(); }} style={styles.cancelBtnSmall}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              onPress={() => { console.log('[SAVE_MODAL] 🚪 Exit without saving pressed'); if (onExitWithoutSaving) onExitWithoutSaving(); else onCancel(); }} 
              style={styles.noBtn}
            >
              <Text style={styles.noBtnText}>No</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              onPress={() => { console.log('[SAVE_MODAL] 💾 Save pressed (local)'); onSave(rememberChoice); }} 
              style={styles.yesBtn}
            >
              <Text style={styles.yesBtnText}>Yes</Text>
            </TouchableOpacity>
          </View>
        )}
        
        {/* Info text for clarity */}
        {hasAniList && (
          <Text style={styles.infoText}>
            "No" saves your position locally{'\n'}
            "Yes" marks as watched on AniList
          </Text>
        )}
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
  progressBlock: {
    width: '100%',
    marginBottom: 14,
    alignItems: 'center',
  },
  progressBarTrack: {
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 4,
    overflow: 'hidden',
    width: '100%',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: PLAYER_COLORS.PRIMARY,
  },
  progressPercentText: {
    marginTop: 6,
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  progressText: {
    fontSize: 14,
    color: '#ADD8E6',
    marginTop: 4,
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
    flexDirection: 'row',
    width: '100%',
    marginBottom: 16,
    gap: 12,
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
  infoText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)',
    textAlign: 'center',
    marginTop: 8,
    fontStyle: 'italic',
  },
}); 