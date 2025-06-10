import React, { useState, useRef } from 'react';
import { 
  View, 
  StyleSheet, 
  TouchableWithoutFeedback, 
  Dimensions,
  Animated 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PLAYER_COLORS, PLAYER_BEHAVIOR, ANIMATIONS, PLAYER_UI } from '../constants';

interface DoubleTapOverlayProps {
  onSingleTap: () => void;
  onDoubleTapLeft: () => void;
  onDoubleTapRight: () => void;
  disabled?: boolean;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DOUBLE_TAP_DELAY = 300; // ms

const DoubleTapOverlay: React.FC<DoubleTapOverlayProps> = ({
  onSingleTap,
  onDoubleTapLeft,
  onDoubleTapRight,
  disabled = false
}) => {
  const [lastTapTime, setLastTapTime] = useState(0);
  const singleTapTimer = useRef<NodeJS.Timeout | null>(null);
  
  // Animations
  const leftOpacity = useRef(new Animated.Value(0)).current;
  const rightOpacity = useRef(new Animated.Value(0)).current;
  
  const showLeftAnimation = () => {
    leftOpacity.setValue(1);
    Animated.timing(leftOpacity, {
      toValue: 0,
      duration: ANIMATIONS.SEEK_ANIMATION_DURATION,
      useNativeDriver: true
    }).start();
  };
  
  const showRightAnimation = () => {
    rightOpacity.setValue(1);
    Animated.timing(rightOpacity, {
      toValue: 0,
      duration: ANIMATIONS.SEEK_ANIMATION_DURATION,
      useNativeDriver: true
    }).start();
  };
  
  const handleTap = (side: 'left' | 'right') => {
    if (disabled) return;
    
    const now = Date.now();
    const isDoubleTap = (now - lastTapTime) < DOUBLE_TAP_DELAY;
    
    if (isDoubleTap) {
      // Clear any pending single tap
      if (singleTapTimer.current) {
        clearTimeout(singleTapTimer.current);
        singleTapTimer.current = null;
      }
      
      // Handle double tap based on side
      if (side === 'left') {
        showLeftAnimation();
        onDoubleTapLeft();
      } else {
        showRightAnimation();
        onDoubleTapRight();
      }
    } else {
      // Set a timer for single tap
      if (singleTapTimer.current) {
        clearTimeout(singleTapTimer.current);
      }
      
      singleTapTimer.current = setTimeout(() => {
        onSingleTap();
        singleTapTimer.current = null;
      }, DOUBLE_TAP_DELAY);
    }
    
    setLastTapTime(now);
  };
  
  return (
    <View style={styles.container}>
      {/* Left side double tap area */}
      <TouchableWithoutFeedback onPress={() => handleTap('left')}>
        <View style={styles.leftArea}>
          <Animated.View style={[styles.animationContainer, { opacity: leftOpacity }]}>
            <View style={styles.iconCircle}>
              <Ionicons name="play-back" size={PLAYER_UI.ICON_SIZE.LARGE} color={PLAYER_COLORS.TEXT_LIGHT} />
            </View>
            <Animated.Text style={styles.rewindText}>-{PLAYER_BEHAVIOR.DOUBLE_TAP_SEEK_TIME}s</Animated.Text>
          </Animated.View>
        </View>
      </TouchableWithoutFeedback>
      
      {/* Right side double tap area */}
      <TouchableWithoutFeedback onPress={() => handleTap('right')}>
        <View style={styles.rightArea}>
          <Animated.View style={[styles.animationContainer, { opacity: rightOpacity }]}>
            <View style={styles.iconCircle}>
              <Ionicons name="play-forward" size={PLAYER_UI.ICON_SIZE.LARGE} color={PLAYER_COLORS.TEXT_LIGHT} />
            </View>
            <Animated.Text style={styles.forwardText}>+{PLAYER_BEHAVIOR.DOUBLE_TAP_SEEK_TIME}s</Animated.Text>
          </Animated.View>
        </View>
      </TouchableWithoutFeedback>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    zIndex: 50,
  },
  leftArea: {
    width: SCREEN_WIDTH / 2,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  rightArea: {
    width: SCREEN_WIDTH / 2,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  animationContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircle: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: PLAYER_COLORS.OVERLAY_BACKGROUND,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: `rgba(255, 102, 196, 0.8)`,
  },
  rewindText: {
    color: PLAYER_COLORS.TEXT_LIGHT,
    fontSize: 14,
    fontWeight: 'bold',
    marginTop: 5,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  forwardText: {
    color: PLAYER_COLORS.TEXT_LIGHT,
    fontSize: 14,
    fontWeight: 'bold',
    marginTop: 5,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
});

export default DoubleTapOverlay; 