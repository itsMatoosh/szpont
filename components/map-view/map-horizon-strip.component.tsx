import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, useColorScheme, View } from 'react-native';

import RNBounceable from '@freakycoder/react-native-bounceable';
import { AntDesign, Entypo } from '@expo/vector-icons';
import { GlassView } from 'expo-glass-effect';

import { type FollowHorizonMarker } from '@/hooks/map-view/use-follow-horizon-markers.hook';

/** Vertical offset below safe area before the chip band (px). */
const HORIZON_TOP_GAP = 6;
/** Tail (~6px) + glass row band (matches `ZoneMarker` bubble height). */
const HORIZON_LABEL_BAND_HEIGHT = 60;
/**
 * Map camera `paddingTop` below safe area should clear the horizon band in follow-user mode
 * (`insets.top` is added separately in `buildCameraPadding`).
 */
export const FOLLOW_HORIZON_TOP_BELOW_SAFE_PX =
  HORIZON_TOP_GAP + HORIZON_LABEL_BAND_HEIGHT + 8;
/** Total min height of the strip below `safeAreaTop` (px). */
const HORIZON_BELOW_SAFE_HEIGHT = FOLLOW_HORIZON_TOP_BELOW_SAFE_PX;

interface MapHorizonStripProps {
  markers: FollowHorizonMarker[];
  screenWidth: number;
  safeAreaTop: number;
  /** Opens zone orbit and updates squad headline zone for the tapped zone (same as map marker press). */
  onZoneChipPress: (zoneId: string) => void;
}

/**
 * Follow-user horizon: forward-cone zone chips (liquid `GlassView` rows aligned with `ZoneMarker`)
 * with a small upward tail. Chips are tappable; empty strip area uses `box-none` so orbit pan
 * still works.
 */
export function MapHorizonStrip({
  markers,
  screenWidth,
  safeAreaTop,
  onZoneChipPress,
}: MapHorizonStripProps) {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const tailColor = isDark ? '#000000' : '#ffffff';

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.root,
        {
          paddingTop: safeAreaTop + HORIZON_TOP_GAP,
          width: screenWidth,
          minHeight: safeAreaTop + HORIZON_BELOW_SAFE_HEIGHT,
        },
      ]}
    >
      <View style={styles.labelLayer} pointerEvents="box-none">
        {markers.map((m) => (
          <View key={m.id} style={[styles.labelAnchor, { left: m.xPx }]} pointerEvents="box-none">
            <RNBounceable onPress={() => onZoneChipPress(m.id)}>
              <View style={styles.chipColumn}>
                <View style={styles.tailHost} pointerEvents="none">
                  <View style={[styles.tail, { borderBottomColor: tailColor }]} />
                </View>
                <GlassView style={styles.horizonChip}>
                  <View className="w-8 h-8 bg-accent rounded-full items-center justify-center">
                    <AntDesign name="star" size={18} className="text-on-accent" />
                  </View>
                  <View className="max-w-[140px] flex-col items-start shrink">
                    <Text
                      className="text-foreground text-md font-bold tracking-wide leading-none"
                      numberOfLines={1}
                    >
                      {m.name}
                    </Text>
                    <Text
                      className="text-foreground text-sm font-medium leading-none mt-0.5"
                      numberOfLines={1}
                    >
                      {formatHorizonDistance(m.distanceM, t)}
                    </Text>
                  </View>
                  <Entypo name="chevron-thin-right" size={12} className="text-foreground" />
                </GlassView>
              </View>
            </RNBounceable>
          </View>
        ))}
      </View>
    </View>
  );
}

/** Formats distance for the horizon strip using i18n. */
function formatHorizonDistance(
  meters: number,
  t: (key: string, opts?: Record<string, unknown>) => string,
): string {
  if (meters < 1000) {
    const m = Math.max(0, Math.round(meters));
    return t('map.horizonDistanceMeters', { meters: m });
  }
  const km = Math.round((meters / 1000) * 10) / 10;
  return t('map.horizonDistanceKilometers', { km });
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 3,
    overflow: 'visible',
  },
  labelLayer: {
    position: 'relative',
    marginTop: 0,
    height: HORIZON_LABEL_BAND_HEIGHT,
    width: '100%',
    overflow: 'visible',
  },
  labelAnchor: {
    position: 'absolute',
    top: 0,
    transform: [{ translateX: '-50%' }],
  },
  /** Stacks tail + chip; centers tail on chip horizontally. */
  chipColumn: {
    alignItems: 'center',
  },
  /** Gives the border-drawn triangle real layout height for hit-testing and strip sizing. */
  tailHost: {
    height: 7,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  /** Upward-pointing triangle (apex toward the top of the screen). */
  tail: {
    width: 0,
    height: 0,
    borderStyle: 'solid',
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderBottomWidth: 6,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    marginBottom: -1,
  },
  /** Mirrors `ZoneMarker` `markerBubble` — liquid glass row chip. */
  horizonChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
  },
});
