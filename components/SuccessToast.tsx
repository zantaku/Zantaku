import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';

interface SuccessToastProps {
  message: string;
  duration?: number;  // in milliseconds
  onDismiss?: () => void;
}

const SuccessToast: React.FC<SuccessToastProps> = ({ 
  message, 
  duration = 3000,  // 3 seconds default
  onDismiss 
}) => {
  const [visible, setVisible] = useState(true);
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  
  useEffect(() => {
    // Fade in
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true
    }).start();
    
    // Set timeout to dismiss
    const timer = setTimeout(() => {
      handleDismiss();
    }, duration);
    
    return () => clearTimeout(timer);
  }, []);
  
  const handleDismiss = () => {
    // Fade out
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true
    }).start(() => {
      setVisible(false);
      if (onDismiss) onDismiss();
    });
  };
  
  if (!visible) return null;
  
  return (
    <Animated.View 
      style={[
        styles.container,
        { opacity: fadeAnim }
      ]}
    >
      <View style={styles.iconContainer}>
        <FontAwesome5 name="check-circle" size={16} color="#FFF" />
      </View>
      <Text style={styles.message}>{message}</Text>
      <TouchableOpacity style={styles.closeButton} onPress={handleDismiss}>
        <FontAwesome5 name="times" size={16} color="#FFF" />
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(34, 197, 94, 0.9)', // Green color for success
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5,
    zIndex: 999,
  },
  iconContainer: {
    marginRight: 10,
  },
  message: {
    color: '#FFF',
    flex: 1,
    fontSize: 14,
  },
  closeButton: {
    padding: 5,
  }
});

export default SuccessToast; 