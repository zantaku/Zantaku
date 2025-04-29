import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';

interface RewardBadgeProps {
  icon: string;
  name: string;
  description: string;
  color: string;
  date?: string;
  onPress?: () => void;
}

const RewardBadge: React.FC<RewardBadgeProps> = ({
  icon,
  name,
  description,
  color,
  date,
  onPress
}) => {
  const { currentTheme } = useTheme();
  const isUnlocked = !!date;
  
  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric'
    });
  };
  
  return (
    <TouchableOpacity
      style={[
        styles.container,
        { backgroundColor: currentTheme.colors.surface }
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View 
        style={[
          styles.iconContainer, 
          { backgroundColor: isUnlocked ? color : '#9E9E9E' }
        ]}
      >
        <FontAwesome5
          name={icon}
          size={24}
          color="#FFFFFF"
          solid
        />
      </View>
      
      <View style={styles.contentContainer}>
        <Text 
          style={[
            styles.name, 
            { color: currentTheme.colors.text }
          ]}
          numberOfLines={1}
        >
          {name}
        </Text>
        
        <Text 
          style={[
            styles.description, 
            { color: currentTheme.colors.textSecondary }
          ]}
          numberOfLines={2}
        >
          {description}
        </Text>
      </View>
      
      {isUnlocked ? (
        <View style={styles.dateContainer}>
          <FontAwesome5
            name="check-circle"
            size={14}
            color="#4CAF50"
            solid
            style={styles.checkIcon}
          />
          <Text style={[styles.date, { color: currentTheme.colors.textSecondary }]}>
            {formatDate(date)}
          </Text>
        </View>
      ) : (
        <View style={styles.lockedContainer}>
          <FontAwesome5
            name="lock"
            size={14}
            color={currentTheme.colors.textSecondary}
          />
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 12,
    marginVertical: 6,
    alignItems: 'center',
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 1.41,
    elevation: 2,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  contentContainer: {
    flex: 1,
    paddingRight: 8,
  },
  name: {
    fontWeight: '600',
    fontSize: 16,
    marginBottom: 4,
  },
  description: {
    fontSize: 12,
    lineHeight: 16,
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 8,
  },
  lockedContainer: {
    padding: 8,
  },
  checkIcon: {
    marginRight: 4,
  },
  date: {
    fontSize: 12,
  }
});

export default RewardBadge; 