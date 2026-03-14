import { GlassView } from 'expo-glass-effect';
import { useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

// ── Constants ──────────────────────────────────────────────────────────────────

/** Height of the city subtitle row when expanded. */
const SUBTITLE_HEIGHT = 16;
const ANIM_DURATION = 300;

// ── Types ──────────────────────────────────────────────────────────────────────

interface CityLabelProps {
  /** City name — always shown (large when alone, small subtitle when a zone is active). */
  name: string;
  /** When set, the label expands to show the zone name below a small city subtitle. */
  zoneName?: string;
  /** Safe-area top inset used to position the label below the status bar. */
  topInset: number;
}

// ── Component ──────────────────────────────────────────────────────────────────

/** Persistent frosted-glass label at the top of the map that adapts to city / zone mode. */
export function CityLabel({ name, zoneName, topInset }: CityLabelProps) {
  const subtitleProgress = useSharedValue(zoneName ? 1 : 0);

  // Keep the last zone name so it stays visible during the fade-out.
  const lastZoneNameRef = useRef(zoneName);
  if (zoneName) lastZoneNameRef.current = zoneName;

  useEffect(() => {
    subtitleProgress.value = withTiming(zoneName ? 1 : 0, { duration: ANIM_DURATION });
  }, [zoneName]);

  const subtitleStyle = useAnimatedStyle(() => ({
    height: subtitleProgress.value * SUBTITLE_HEIGHT,
    opacity: subtitleProgress.value,
  }));

  // City name fades out as zone name fades in
  const cityNameStyle = useAnimatedStyle(() => ({
    opacity: 1 - subtitleProgress.value,
  }));

  const zoneNameStyle = useAnimatedStyle(() => ({
    opacity: subtitleProgress.value,
  }));

  return (
    <Animated.View style={[styles.wrapper, { top: topInset + 4 }]}>
      <GlassView style={styles.pill}>
        <Animated.View style={[styles.subtitleRow, subtitleStyle]}>
          <Text style={styles.citySubtitle} numberOfLines={1}>
            {name}
          </Text>
        </Animated.View>

        {/* Stacked labels — one fades out while the other fades in */}
        <View style={styles.mainLabelContainer}>
          <Animated.Text style={[styles.mainLabel, cityNameStyle]} numberOfLines={1}>
            {name}
          </Animated.Text>
          <Animated.Text
            style={[styles.mainLabel, styles.mainLabelOverlay, zoneNameStyle]}
            numberOfLines={1}
          >
            {lastZoneNameRef.current}
          </Animated.Text>
        </View>
      </GlassView>
    </Animated.View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    alignSelf: 'center',
    zIndex: 10,
  },
  pill: {
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignItems: 'center',
  },
  subtitleRow: {
    overflow: 'hidden',
  },
  citySubtitle: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  mainLabelContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  mainLabel: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  mainLabelOverlay: {
    position: 'absolute',
  },
});
