import RNBounceable from '@freakycoder/react-native-bounceable';
import { GlassView } from 'expo-glass-effect';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

// ── Constants ──────────────────────────────────────────────────────────────────

/** Off-screen translateY offset used for the slide-in / slide-out animation. */
const SLIDE_OFFSET = 300;

// ── Types ──────────────────────────────────────────────────────────────────────

interface ZoneInfoCardProps {
  /** Whether the card is visible (drives the slide animation). */
  visible: boolean;
  /** Safe-area bottom inset so the card clears the home indicator. */
  bottomInset: number;
  /** Called when the user taps the close button to return to the city view. */
  onClose: () => void;
}

// ── Component ──────────────────────────────────────────────────────────────────

/** Frosted-glass info card anchored to the bottom of the screen while a zone is focused. */
export function ZoneInfoCard({
  visible,
  bottomInset,
  onClose,
}: ZoneInfoCardProps) {
  const translateY = useSharedValue(SLIDE_OFFSET);

  useEffect(() => {
    translateY.value = withSpring(visible ? 0 : SLIDE_OFFSET);
  }, [visible]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    pointerEvents: translateY.value === 0 ? 'auto' : 'none',
  }));

  return (
    <Animated.View style={[styles.wrapper, { bottom: bottomInset }, animatedStyle]}>
      <GlassView style={styles.card}>
        <View style={styles.header}>
          <RNBounceable onPress={onClose}>
            <View style={styles.closeButton}>
              <Text style={styles.closeText}>✕</Text>
            </View>
          </RNBounceable>
        </View>

        <View style={styles.divider} />

        <Text style={styles.subtitle}>Zone details coming soon</Text>
        <Text style={styles.body}>
          Check-ins, leaderboards, and more will appear here.
        </Text>
      </GlassView>
    </Animated.View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 10,
  },
  card: {
    borderRadius: 20,
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    marginVertical: 14,
  },
  subtitle: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.3,
    marginBottom: 6,
  },
  body: {
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: 13,
    lineHeight: 18,
  },
});
