import Ionicons from '@expo/vector-icons/Ionicons';
import RNBounceable from '@freakycoder/react-native-bounceable';
import { router } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MapView, type MapViewProps } from '@/components/map-view/map-view.component';
import { type MapZone } from '@/components/map-view/map-view.types';
import { useLocation } from '@/hooks/location/location.context';
import { useLocationPermissionContext } from '@/hooks/location/location-permission.context';
import { useSelectedZoneContext } from '@/hooks/selected-zone/selected-zone.context';
import { useZonesByCity } from '@/hooks/zones/use-zones-by-city.hook';

/**
 * Full-screen map screen in the root stack.
 * Preloads nearest city and zones before rendering `MapView`.
 */
export default function MapScreen() {
  const insets = useSafeAreaInsets();
  const { foregroundStatus } = useLocationPermissionContext();
  const { location } = useLocation();
  const { nearestCity, nearestCityLoading } = useSelectedZoneContext();
  const { zones: rawZones, isLoading: zonesLoading } = useZonesByCity(nearestCity?.id);

  const isMapDataLoading =
    foregroundStatus === 'granted' &&
    (location == null ||
      nearestCityLoading ||
      (nearestCity != null && zonesLoading));

  const mapProps: MapViewProps = {
    zones: rawZones as unknown as MapZone[],
    nearestCity,
    location,
  };

  return (
    <View style={styles.container}>
      {isMapDataLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" />
        </View>
      ) : (
        <MapView {...mapProps} />
      )}

      <View style={[styles.backButtonContainer, { top: insets.top + 8 }]}>
        <RNBounceable onPress={() => router.back()}>
          <View className="h-11 w-11 items-center justify-center rounded-full bg-background/90">
            <Ionicons name="chevron-back" size={22} className="text-foreground" />
          </View>
        </RNBounceable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  backButtonContainer: {
    position: 'absolute',
    left: 12,
    zIndex: 10,
  },
});
