import RNBounceable from '@freakycoder/react-native-bounceable';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';

import type { ResolvedMarker } from '@/components/map-view/map-view.util';
import Mapbox from '@/util/mapbox/mapbox.util';
import { AntDesign, Entypo } from '@expo/vector-icons';
import { GlassView } from 'expo-glass-effect';

// ── Types ──────────────────────────────────────────────────────────────────────

interface ZoneMarkerProps {
  marker: ResolvedMarker;
  /** Number of users currently present in this zone. */
  presenceCount: number;
  /** Reanimated style controlling opacity during city/zone transitions. */
  animatedStyle: ReturnType<typeof Animated.useAnimatedStyle>;
  onPress: () => void;
}

// ── Component ──────────────────────────────────────────────────────────────────

/** Marker bubble placed at a zone's center on the city overview map. */
export function ZoneMarker({ marker, presenceCount, animatedStyle, onPress }: ZoneMarkerProps) {
  return (
    <Mapbox.MarkerView
      coordinate={marker.center}
      allowOverlap
      anchor={{ x: 0.5, y: 0.5 }}
    >
      <Animated.View style={animatedStyle}>
        <RNBounceable onPress={onPress}>
          <MarkerBubble marker={marker} presenceCount={presenceCount} />
        </RNBounceable>
      </Animated.View>
    </Mapbox.MarkerView>
  );
}

// ── Marker bubble ─────────────────────────────────────────────────────────────

/** Inner bubble content shared between all tail orientations. */
function MarkerBubble({ marker, presenceCount }: { marker: { name: string; iconUrl: string | null }; presenceCount: number }) {
  const { t } = useTranslation();

  return (
    <GlassView style={styles.markerBubble}>
      <View className="w-8 h-8 bg-accent rounded-full items-center justify-center">
        <AntDesign name="star" size={18} className="text-on-accent" />
      </View>
      <View className="flex-col items-start">
        <Text className="text-foreground text-md font-bold tracking-wide leading-none">{marker.name}</Text>
        {presenceCount > 0 && (
          <View className="flex-row items-center gap-1">
            <View className="w-2 h-2 bg-accent rounded-full" />
            <Text className="text-foreground text-sm font-medium leading-none">
              {t('map.presenceCount', { count: presenceCount })}
            </Text>
          </View>
        )}
      </View>
      <Entypo name='chevron-thin-right' size={12} className="text-foreground" />
    </GlassView>
  );
}

const styles = StyleSheet.create({
  markerBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
  },
});