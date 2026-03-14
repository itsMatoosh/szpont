import RNBounceable from '@freakycoder/react-native-bounceable';
import { GlassView } from 'expo-glass-effect';
import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';

import type { ResolvedMarker, TailDirection } from '@/components/map-view/map-view.util';
import Mapbox from '@/util/mapbox/mapbox.util';

// ── Types ──────────────────────────────────────────────────────────────────────

interface ZoneMarkerProps {
  marker: ResolvedMarker;
  /** Reanimated style controlling opacity during city/zone transitions. */
  animatedStyle: ReturnType<typeof Animated.useAnimatedStyle>;
  onPress: () => void;
}

// ── Anchor map ────────────────────────────────────────────────────────────────
// Anchor shifts the coordinate point relative to the marker's bounding box so
// the tail tip lands on the actual coordinate.

const TAIL_ANCHOR: Record<TailDirection, { x: number; y: number }> = {
  none: { x: 0.5, y: 0.5 },
  top: { x: 0.5, y: 0 },
  bottom: { x: 0.5, y: 1 },
  left: { x: 0, y: 0.5 },
  right: { x: 1, y: 0.5 },
};

// ── Component ──────────────────────────────────────────────────────────────────

/** Speech-bubble marker placed at a zone's center on the city overview map. */
export function ZoneMarker({ marker, animatedStyle, onPress }: ZoneMarkerProps) {
  return (
    <Mapbox.MarkerView
      coordinate={marker.originalCenter}
      allowOverlap
      anchor={TAIL_ANCHOR[marker.tailDirection]}
    >
      <Animated.View style={animatedStyle}>
        <RNBounceable onPress={onPress}>
          <View style={styles.markerWrapper}>
            {marker.tailDirection === 'top' && (
              <View style={styles.tailTop} />
            )}
            {marker.tailDirection === 'left' ? (
              <View style={styles.tailRowLeft}>
                <View style={styles.tailLeft} />
                <MarkerBubble marker={marker} />
              </View>
            ) : marker.tailDirection === 'right' ? (
              <View style={styles.tailRowRight}>
                <MarkerBubble marker={marker} />
                <View style={styles.tailRight} />
              </View>
            ) : (
              <MarkerBubble marker={marker} />
            )}
            {marker.tailDirection === 'bottom' && (
              <View style={styles.tailBottom} />
            )}
          </View>
        </RNBounceable>
      </Animated.View>
    </Mapbox.MarkerView>
  );
}

// ── Marker bubble ─────────────────────────────────────────────────────────────

/** Inner bubble content shared between all tail orientations. */
function MarkerBubble({ marker }: { marker: { name: string; iconUrl: string | null } }) {
  return (
    <GlassView style={styles.marker} tintColor="rgba(204, 255, 0, 0.8)" glassEffectStyle="clear">
      {marker.iconUrl && (
        <Image source={{ uri: marker.iconUrl }} style={styles.markerIcon} />
      )}
      <Text style={styles.markerLabel}>{marker.name}</Text>
    </GlassView>
  );
}

// ── Tail triangle size ────────────────────────────────────────────────────────

const TAIL_SIZE = 6;

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  markerWrapper: {
    alignItems: 'center',
  },
  marker: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingTop: 4,
    paddingBottom: 6,
  },
  markerIcon: {
    width: 14,
    height: 14,
  },
  markerLabel: {
    color: '#000000',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  tailTop: {
    width: 0,
    height: 0,
    borderLeftWidth: TAIL_SIZE,
    borderRightWidth: TAIL_SIZE,
    borderBottomWidth: TAIL_SIZE,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: 'rgba(204, 255, 0, 0.5)',
  },
  tailBottom: {
    width: 0,
    height: 0,
    borderLeftWidth: TAIL_SIZE,
    borderRightWidth: TAIL_SIZE,
    borderTopWidth: TAIL_SIZE,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: 'rgba(204, 255, 0, 0.5)',
  },
  tailRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tailLeft: {
    width: 0,
    height: 0,
    borderTopWidth: TAIL_SIZE,
    borderBottomWidth: TAIL_SIZE,
    borderRightWidth: TAIL_SIZE,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderRightColor: 'rgba(204, 255, 0, 0.5)',
  },
  tailRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tailRight: {
    width: 0,
    height: 0,
    borderTopWidth: TAIL_SIZE,
    borderBottomWidth: TAIL_SIZE,
    borderLeftWidth: TAIL_SIZE,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderLeftColor: 'rgba(204, 255, 0, 0.5)',
  },
});
