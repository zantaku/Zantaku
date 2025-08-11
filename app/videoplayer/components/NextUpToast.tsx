import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type NextUpToastProps = {
  isVisible: boolean;
  label: string; // e.g., '1 min', '30 sec', '10 sec'
  nextEpisodeNumber?: number;
  nextEpisodeTitle?: string;
  provider?: string;
  durationMs?: number; // how long to keep it visible
  onPress?: () => void;
  onHide?: () => void;
};

const NextUpToast: React.FC<NextUpToastProps> = ({
  isVisible,
  label,
  nextEpisodeNumber,
  nextEpisodeTitle,
  provider,
  durationMs = 2200,
  onPress,
  onHide,
}) => {
  const translateY = useRef(new Animated.Value(-40)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isVisible) {
      // Slide in
      console.log('[NEXT_TOAST][UI] ▶️ Showing toast overlay:', { label, nextEpisodeNumber, provider });
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: 0,
          duration: 220,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 220,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();

      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = setTimeout(() => {
        // Slide out
        Animated.parallel([
          Animated.timing(translateY, {
            toValue: -40,
            duration: 220,
            easing: Easing.in(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 0,
            duration: 220,
            easing: Easing.in(Easing.cubic),
            useNativeDriver: true,
          }),
        ]).start(() => {
          onHide?.();
        });
      }, durationMs);
    } else {
      // Ensure hidden state when toggled off
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
        hideTimeoutRef.current = null;
      }
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: -40,
          duration: 160,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 160,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    }

    return () => {
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    };
  }, [isVisible, label, durationMs, nextEpisodeNumber, provider, onHide, opacity, translateY]);

  const Title = () => (
    <View style={styles.titleRow}>
      <Text style={styles.titleText} numberOfLines={1}>
        Next in {label}
      </Text>
      {provider ? (
        <View style={styles.providerBadge}>
          <Text style={styles.providerText}>{provider.toUpperCase()}</Text>
        </View>
      ) : null}
    </View>
  );

  const Subtitle = () => (
    <Text style={styles.subtitleText} numberOfLines={1}>
      {typeof nextEpisodeNumber === 'number' ? `Episode ${nextEpisodeNumber}` : 'Next episode'}
      {nextEpisodeTitle ? `: ${nextEpisodeTitle}` : ''}
    </Text>
  );

  return (
    <Animated.View
      pointerEvents={isVisible ? 'auto' : 'none'}
      style={[
        styles.container,
        {
          transform: [{ translateY }],
          opacity,
        },
      ]}
    >
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={onPress}
        style={styles.card}
      >
        <Title />
        <Subtitle />
        <View style={styles.hintRow}>
          <Text style={styles.hintText}>
            Tap to open next episode
          </Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 26 : 16,
    right: 12,
    zIndex: 1500,
  },
  card: {
    backgroundColor: 'rgba(0,0,0,0.85)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    maxWidth: 280,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  titleText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    flexShrink: 1,
  },
  providerBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: 'rgba(2,169,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(2,169,255,0.35)',
  },
  providerText: {
    color: '#02A9FF',
    fontSize: 10,
    fontWeight: '700',
  },
  subtitleText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 12,
    marginTop: 2,
  },
  hintRow: {
    marginTop: 6,
  },
  hintText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 11,
  },
});

export default NextUpToast;


