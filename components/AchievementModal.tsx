import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Dimensions } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { BadgeDisplay } from '../hooks/useRewards';

interface AchievementModalProps {
  visible: boolean;
  onClose: () => void;
  achievement: BadgeDisplay | null;
  onDismiss?: () => void;
}

const { width, height } = Dimensions.get('window');

const AchievementModal: React.FC<AchievementModalProps> = ({
  visible,
  onClose,
  achievement,
  onDismiss
}) => {
  const { currentTheme } = useTheme();
  
  if (!achievement) return null;
  
  const getIconSize = () => {
    return achievement.unlocked ? 64 : 48;
  };
  
  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };
  
  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View 
          style={[
            styles.container, 
            { backgroundColor: currentTheme.colors.surface }
          ]}
        >
          <TouchableOpacity 
            style={styles.closeButton} 
            onPress={onClose}
          >
            <FontAwesome5 
              name="times" 
              size={20} 
              color={currentTheme.colors.textSecondary} 
            />
          </TouchableOpacity>
          
          <View style={styles.content}>
            <View 
              style={[
                styles.iconContainer, 
                { backgroundColor: achievement.color }
              ]}
            >
              <FontAwesome5 
                name={achievement.icon} 
                size={getIconSize()} 
                color="#FFFFFF" 
                solid 
              />
            </View>
            
            <Text style={[styles.title, { color: currentTheme.colors.text }]}>
              {achievement.name}
            </Text>
            
            <Text style={[styles.description, { color: currentTheme.colors.textSecondary }]}>
              {achievement.description}
            </Text>
            
            {achievement.unlocked && (
              <View style={styles.unlockedInfo}>
                <FontAwesome5 
                  name="check-circle" 
                  size={16} 
                  color="#4CAF50" 
                  solid 
                  style={styles.checkIcon}
                />
                <Text style={[styles.unlockedText, { color: currentTheme.colors.textSecondary }]}>
                  Unlocked on {formatDate(achievement.unlocked_at)}
                </Text>
              </View>
            )}
            
            {!achievement.unlocked && (
              <View style={styles.lockedContainer}>
                <FontAwesome5 
                  name="lock" 
                  size={14} 
                  color={currentTheme.colors.textSecondary} 
                  style={styles.lockIcon}
                />
                <Text style={[styles.lockedText, { color: currentTheme.colors.textSecondary }]}>
                  Keep watching to unlock this achievement!
                </Text>
              </View>
            )}
          </View>
          
          {onDismiss && achievement.unlocked && (
            <TouchableOpacity 
              style={[styles.dismissButton, { borderColor: currentTheme.colors.border }]}
              onPress={onDismiss}
            >
              <Text style={[styles.dismissText, { color: currentTheme.colors.text }]}>
                Dismiss
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    width: width * 0.85,
    maxWidth: 400,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.27,
    shadowRadius: 4.65,
    elevation: 6,
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 10,
  },
  content: {
    width: '100%',
    alignItems: 'center',
  },
  iconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  description: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 22,
  },
  unlockedInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  checkIcon: {
    marginRight: 6,
  },
  unlockedText: {
    fontSize: 14,
  },
  lockedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    padding: 12,
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 8,
  },
  lockIcon: {
    marginRight: 8,
  },
  lockedText: {
    fontSize: 14,
    fontStyle: 'italic',
  },
  dismissButton: {
    marginTop: 24,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderRadius: 8,
  },
  dismissText: {
    fontSize: 16,
    fontWeight: '600',
  }
});

export default AchievementModal; 