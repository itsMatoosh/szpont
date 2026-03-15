import RNBounceable from '@freakycoder/react-native-bounceable';
import { GlassView } from 'expo-glass-effect';
import { useEffect } from 'react';
import { StyleSheet, Text, useColorScheme, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { Colors } from '@/util/theme/theme.util';

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
  const colorScheme = useColorScheme();
  const palette = colorScheme === 'dark' ? Colors.dark : Colors.light;
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
            <View style={[styles.closeButton, { backgroundColor: palette.border }]}>
              <Text style={[styles.closeText, { color: palette.foreground }]}>✕</Text>
            </View>
          </RNBounceable>
        </View>

        <View style={[styles.divider, { backgroundColor: palette.border }]} />

        <Text style={[styles.subtitle, { color: palette.muted }]}>Zone details coming soon</Text>
        <Text style={[styles.body, { color: palette.muted }]}>
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    fontSize: 14,
    fontWeight: '700',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 14,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.3,
    marginBottom: 6,
  },
  body: {
    fontSize: 13,
    lineHeight: 18,
  },
});
