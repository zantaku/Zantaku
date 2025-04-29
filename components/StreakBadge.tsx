import React from 'react';
import { View, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';

interface StreakBadgeProps {
  streak: number;
  type?: 'anime' | 'manga' | 'combo' | 'none';
  size?: 'small' | 'medium' | 'large';
  style?: ViewStyle;
  textStyle?: TextStyle;
  showIcon?: boolean;
  showLabel?: boolean;
}

const StreakBadge = ({
  streak,
  type = 'none',
  size = 'medium',
  style,
  textStyle,
  showIcon = true,
  showLabel = true,
}: StreakBadgeProps) => {
  const { currentTheme } = useTheme();
  
  // If streak is 0, don't show anything unless specifically requested
  if (streak === 0 && !style) {
    return null;
  }
  
  // Determine color based on activity type
  const getTypeColor = () => {
    switch (type) {
      case 'anime':
        return '#3F51B5'; // Indigo for anime
      case 'manga':
        return '#4CAF50'; // Green for manga
      case 'combo':
        return '#9C27B0'; // Purple for combo
      default:
        return '#FF5722'; // Orange as default/fire color
    }
  };
  
  // Determine size styles
  const getSizeStyles = () => {
    switch (size) {
      case 'small':
        return {
          container: { 
            paddingVertical: 2, 
            paddingHorizontal: 6, 
            borderRadius: 8 
          },
          text: { 
            fontSize: 12 
          },
          iconSize: 10
        };
      case 'large':
        return {
          container: { 
            paddingVertical: 8, 
            paddingHorizontal: 12, 
            borderRadius: 16 
          },
          text: { 
            fontSize: 18 
          },
          iconSize: 18
        };
      default: // medium
        return {
          container: { 
            paddingVertical: 4, 
            paddingHorizontal: 8, 
            borderRadius: 12 
          },
          text: { 
            fontSize: 14 
          },
          iconSize: 14
        };
    }
  };
  
  const sizeStyles = getSizeStyles();
  const typeColor = getTypeColor();
  
  return (
    <View 
      style={[
        styles.container, 
        sizeStyles.container,
        { backgroundColor: currentTheme.colors.surface },
        style
      ]}
    >
      {showIcon && (
        <FontAwesome5 
          name="fire" 
          size={sizeStyles.iconSize} 
          color={typeColor}
          solid
          style={styles.icon}
        />
      )}
      
      <Text 
        style={[
          styles.text, 
          sizeStyles.text, 
          { color: currentTheme.colors.text },
          textStyle
        ]}
      >
        {streak}
      </Text>
      
      {showLabel && (
        <Text 
          style={[
            styles.label, 
            { 
              fontSize: sizeStyles.text.fontSize - 2,
              color: currentTheme.colors.textSecondary 
            }
          ]}
        >
          {streak === 1 ? 'day' : 'days'}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  icon: {
    marginRight: 4,
  },
  text: {
    fontWeight: '700',
  },
  label: {
    marginLeft: 2,
    fontWeight: '500',
  }
});

export default StreakBadge; 