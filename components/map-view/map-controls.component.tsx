import Ionicons from '@expo/vector-icons/Ionicons';
import RNBounceable from '@freakycoder/react-native-bounceable';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { type CameraMode } from '@/components/map-view/map-view.types';

interface MapControlsInsets {
  top: number;
  left: number;
  bottom: number;
  right: number;
}

interface MapControlsProps {
  cameraMode: CameraMode;
  activeZoneId: string | null;
  showCityOverviewToggle: boolean;
  showZoneGeofenceToggle: boolean;
  onCityToggle: () => void;
  onZoneGeofenceToggle: () => void;
  mapControlChipBackground: string;
  mapControlIconColor: string;
  insets: MapControlsInsets;
  /** Distance from the physical bottom of the screen to the bottom edge of the lowest chip (px). */
  controlsBottomPx: number;
}

const MAP_CONTROL_EDGE_INSET = 12;
const MAP_CONTROL_CHIP_GAP = 10;

/** Renders city / geofence map control chips in the bottom-right corner, stacked above the tab bar. */
export function MapControls({
  cameraMode,
  activeZoneId,
  showCityOverviewToggle,
  showZoneGeofenceToggle,
  onCityToggle,
  onZoneGeofenceToggle,
  mapControlChipBackground,
  mapControlIconColor,
  insets,
  controlsBottomPx,
}: MapControlsProps) {
  const { t } = useTranslation();

  if (!showCityOverviewToggle && !showZoneGeofenceToggle) {
    return null;
  }

  return (
    <View
      style={[
        styles.column,
        {
          bottom: controlsBottomPx,
          right: insets.right + MAP_CONTROL_EDGE_INSET,
        },
      ]}
    >
      {showCityOverviewToggle && (
        <RNBounceable
          onPress={onCityToggle}
          accessibilityRole="button"
          accessibilityLabel={
            cameraMode.mode === 'city' ? t('map.followMyLocation') : t('map.showCityOverview')
          }
        >
          <View style={[styles.mapControlChip, { backgroundColor: mapControlChipBackground }]}>
            <Ionicons
              name={cameraMode.mode === 'city' ? 'navigate' : 'map-outline'}
              size={22}
              color={mapControlIconColor}
            />
          </View>
        </RNBounceable>
      )}

      {showZoneGeofenceToggle && (
        <RNBounceable
          onPress={onZoneGeofenceToggle}
          accessibilityRole="button"
          accessibilityLabel={
            cameraMode.mode === 'zone' && cameraMode.zoneId === activeZoneId
              ? t('map.backToFollowFromZone')
              : t('map.orbitCurrentZone')
          }
        >
          <View style={[styles.mapControlChip, { backgroundColor: mapControlChipBackground }]}>
            <Ionicons
              name={
                cameraMode.mode === 'zone' && cameraMode.zoneId === activeZoneId
                  ? 'navigate'
                  : 'globe-outline'
              }
              size={22}
              color={mapControlIconColor}
            />
          </View>
        </RNBounceable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  column: {
    position: 'absolute',
    zIndex: 2,
    flexDirection: 'column',
    gap: MAP_CONTROL_CHIP_GAP,
    alignItems: 'flex-end',
  },
  mapControlChip: {
    borderRadius: 14,
    padding: 10,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
});
