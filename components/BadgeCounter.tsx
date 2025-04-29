import React from 'react';
import { Text, View, ActivityIndicator } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useRewards } from '../hooks/useRewards';

interface BadgeCounterProps {
  userId: string;
  style?: any;
  textStyle?: any;
  iconSize?: number;
  iconColor?: string;
}

const BadgeCounter: React.FC<BadgeCounterProps> = ({ 
  userId, 
  style,
  textStyle,
  iconSize = 20,
  iconColor = "#FFC107"
}) => {
  const { rewardsCount, isLoading } = useRewards(userId);

  if (isLoading) {
    return (
      <View>
        <View style={style}>
          <ActivityIndicator size="small" color={iconColor} />
        </View>
        <Text style={textStyle}>...</Text>
      </View>
    );
  }

  return (
    <>
      <View style={style}>
        <FontAwesome5 
          name="trophy" 
          size={iconSize} 
          color={iconColor} 
          solid 
        />
      </View>
      <Text style={textStyle}>{rewardsCount}</Text>
    </>
  );
};

export default BadgeCounter; 