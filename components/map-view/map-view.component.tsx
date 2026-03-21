import type { LocationObject } from 'expo-location';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { type MapState } from '@rnmapbox/maps';
import { StyleSheet, useColorScheme, useWindowDimensions, View } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MapControls } from '@/components/map-view/map-controls.component';
import { MapDebugOverlay } from '@/components/map-view/map-debug-overlay.component';
import { MapHorizonStrip } from '@/components/map-view/map-horizon-strip.component';
import { MapSurface } from '@/components/map-view/map-surface.component';
import {
  type CameraMode,
  getCityFocusedZoneId,
  type ImperativeCameraCommand,
  type MapZone,
} from '@/components/map-view/map-view.types';
import { useFollowOrbitGesture } from '@/hooks/map-camera/use-follow-orbit-gesture.hook';
import { useMapCameraMode } from '@/hooks/map-camera/use-map-camera-mode.hook';
import { useZoneOrbitCamera } from '@/hooks/map-camera/use-zone-orbit-camera.hook';
import { useCityCamera } from '@/hooks/map-view/use-city-camera.hook';
import { useZoneBoundaries } from '@/hooks/map-view/use-zone-boundaries.hook';
import { useZoneCamera } from '@/hooks/map-view/use-zone-camera.hook';
import { useZoneMarkers } from '@/hooks/map-view/use-zone-markers.hook';
import { useZonesPresenceCounts } from '@/hooks/presence/use-zones-presence-counts.hook';
import { useFollowHorizonMarkers } from '@/hooks/map-view/use-follow-horizon-markers.hook';
import { useSelectedZoneContext } from '@/hooks/selected-zone/selected-zone.context';
import { type City } from '@/util/cities/cities.util';
import { normalizeDeg0To360 } from '@/util/geo/geo.util';
import Mapbox from '@/util/mapbox/mapbox.util';

/** Set to `true` to render bounding-box and viewport debug overlay on the map. */
const SHOW_DEBUG_OVERLAY = false;

// ── Constants ──────────────────────────────────────────────────────────────────

/** Duration of the initial flyTo zoom-in animation (ms). */
const FLYTO_DURATION_MS = 1000;

/** Preloaded inputs for the map: zones and geo are supplied by the map tab after its loading gate. */
export interface MapViewProps {
  /** Zone polygons for the current `nearestCity` (may be empty). */
  zones: MapZone[];
  /** City containing the user, or null when outside supported cities. */
  nearestCity: City | null;
  /** Latest device location; null when permission is denied or unavailable. */
  location: LocationObject | null;
}

// ── Component ──────────────────────────────────────────────────────────────────

/** Mapbox style URLs keyed by system color scheme; light map for light mode, dark for dark. */
const MAP_STYLE_URL = {
  dark: 'mapbox://styles/mapbox/dark-v11',
  light: 'mapbox://styles/mapbox/light-v11',
} as const;

/** 3D building extrusion color per theme — light gray on light map so buildings read as light-mode. */
const BUILDING_EXTRUSION_COLOR = {
  dark: '#aaa',
  light: '#b0b0b0',
} as const;

/**
 * Full-screen Mapbox map: follow-user (pitched) with orbit bearing gesture, city overview with markers,
 * and zone orbit. Geofence (`activeZoneId`) gates transitions only — no maxBounds, no free map pan.
 */
export function MapView({ zones, nearestCity, location }: MapViewProps) {
  const colorScheme = useColorScheme();
  const { activeZoneId, clearSelectedZoneRequestVersion, setSelectedZone } = useSelectedZoneContext();
  const zoneIds = useMemo(() => zones.map((z) => z.id), [zones]);
  const presenceCounts = useZonesPresenceCounts(zoneIds);
  const insets = useSafeAreaInsets();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();

  /** Mapbox camera padding: safe area only (no tab bar / overlay reserves). */
  const cameraPadding = useMemo(
    () => ({
      paddingTop: insets.top,
      paddingLeft: insets.left,
      paddingRight: insets.right,
      paddingBottom: insets.bottom,
    }),
    [insets.top, insets.left, insets.right, insets.bottom],
  );

  const cameraRef = useRef<Mapbox.Camera>(null);
  const previousCameraModeRef = useRef<CameraMode['mode'] | undefined>(undefined);
  const mapRef = useRef<InstanceType<typeof Mapbox.MapView> | null>(null);
  /** Last known map center/zoom; restored after style change remount so camera does not jump to default. */
  const savedCameraRef = useRef<{ center: [number, number]; zoom: number } | null>(null);

  const cityCamera = useCityCamera(zones);
  const {
    cameraMode,
    showCityOverviewToggle,
    showZoneGeofenceToggle,
    handleCityOverviewToggle,
    handleZoneGeofenceToggle,
    handleZoneMarkerPress,
    handleHorizonZoneChipPress,
  } = useMapCameraMode({
    activeZoneId,
    cityId: nearestCity?.id,
    cityCameraAvailable: cityCamera != null,
    clearSelectedZoneRequestVersion,
    zones,
  });

  const followUserMode = cameraMode.mode === 'follow-user';
  /** Horizon chips only outside geofence — inside a zone we use standard top padding only. */
  const showFollowHorizon = followUserMode && activeZoneId == null;
  const cameraModeRef = useRef(cameraMode.mode);
  cameraModeRef.current = cameraMode.mode;

  const [mapCameraHeadingDeg, setMapCameraHeadingDeg] = useState<number | null>(null);

  const handleMapCameraChanged = useCallback((state: MapState) => {
    if (cameraModeRef.current !== 'follow-user') return;
    setMapCameraHeadingDeg(normalizeDeg0To360(state.properties.heading));
  }, []);

  const { followUserBearingDeg, followUserPanGesture, onMapStackLayout, resetFollowUserBearing } =
    useFollowOrbitGesture({
      cameraPadding,
    });

  /** Applies imperative camera commands with safe-area padding. */
  const applyImperativeCamera = useCallback(
    (command: ImperativeCameraCommand) => {
      cameraRef.current?.setCamera({
        ...command,
        padding: cameraPadding,
      });
    },
    [cameraPadding],
  );

  const userLat = location?.coords.latitude;
  const userLng = location?.coords.longitude;

  const horizonMarkers = useFollowHorizonMarkers({
    enabled: showFollowHorizon,
    zones,
    userLat,
    userLng,
    cameraHeadingDeg: mapCameraHeadingDeg,
    screenWidth,
  });

  // Drop stored bearing outside follow-user so we do not reuse city/zone camera yaw on re-entry.
  useEffect(() => {
    if (cameraMode.mode !== 'follow-user') {
      setMapCameraHeadingDeg(null);
    }
  }, [cameraMode.mode]);

  // Reset manual bearing when switching into follow-user so city/zone exits don't preserve stale yaw.
  useEffect(() => {
    const prev = previousCameraModeRef.current;
    previousCameraModeRef.current = cameraMode.mode;
    if (cameraMode.mode === 'follow-user' && prev !== 'follow-user') {
      resetFollowUserBearing();
    }
  }, [cameraMode.mode, resetFollowUserBearing]);

  // ── Derived camera values ────────────────────────────────────────────────

  const activeZone =
    cameraMode.mode === 'zone' ? zones.find((z) => z.id === cameraMode.zoneId) : undefined;
  const activeZoneName = activeZone?.name;
  const activeZoneSelectionId = activeZone?.id;

  // Keep squad zone selection in sync with map-selected/active zone state.
  useEffect(() => {
    if (cameraMode.mode === 'zone' && activeZoneSelectionId && activeZoneName) {
      const source =
        activeZoneId != null && cameraMode.zoneId === activeZoneId ? 'active' : 'map';
      setSelectedZone({
        id: activeZoneSelectionId,
        name: activeZoneName,
        source,
      });
      return;
    }
    const cityFocusedId = getCityFocusedZoneId(cameraMode);
    if (cityFocusedId != null) {
      const z = zones.find((zone) => zone.id === cityFocusedId);
      if (z) {
        setSelectedZone({ id: z.id, name: z.name, source: 'map' });
        return;
      }
    }
    if (
      (cameraMode.mode === 'follow-user' || cameraMode.mode === 'city') &&
      activeZoneId != null
    ) {
      const z = zones.find((zone) => zone.id === activeZoneId);
      if (z) {
        setSelectedZone({ id: activeZoneId, name: z.name, source: 'active' });
        return;
      }
    }
    setSelectedZone(null);
  }, [
    activeZoneId,
    activeZoneName,
    activeZoneSelectionId,
    cameraMode,
    setSelectedZone,
    zones,
  ]);

  const zoneCamera = useZoneCamera(activeZone);
  useZoneOrbitCamera({ cameraMode, zoneCamera, applyImperativeCamera });

  const { zoneMarkers, debugOverlay } = useZoneMarkers({
    cityCamera,
    zones,
    insets,
    screenWidth,
    screenHeight,
  });

  const { allZonesOutlineFeatureCollection } = useZoneBoundaries(zones);

  // ── Marker fade animation ────────────────────────────────────────────────

  const markerOpacity = useSharedValue(1);

  useEffect(() => {
    const fadingIn = cameraMode.mode === 'city';
    markerOpacity.value = withTiming(fadingIn ? 1 : 0, {
      duration: fadingIn ? FLYTO_DURATION_MS : 200,
    });
  }, [cameraMode.mode]);

  /** Animated style applied to each marker wrapper so they fade in/out with the flyTo. */
  const markerAnimatedStyle = useAnimatedStyle(() => ({
    opacity: markerOpacity.value,
    pointerEvents: markerOpacity.value === 0 ? 'none' : 'auto',
  }));

  const shouldUseDeclarativeCamera = cameraMode.mode === 'follow-user' || cameraMode.mode === 'city';

  /** Follow-user orbit gesture only; no native rotate / free pan anywhere. */
  const canRotateCamera = cameraMode.mode === 'follow-user';

  const theme = colorScheme === 'dark' ? 'dark' : 'light';
  const mapControlIconColor = colorScheme === 'dark' ? '#f5f5f5' : '#262626';
  const mapControlChipBackground = colorScheme === 'dark' ? 'rgba(38,38,38,0.92)' : 'rgba(255,255,255,0.94)';
  const mapStyleURL = MAP_STYLE_URL[theme];
  const buildingExtrusionColor = BUILDING_EXTRUSION_COLOR[theme];

  /** Used to prime the map at the puck before `followUserLocation` turns on (`MapSurface`). */
  const userCoordinate = useMemo((): [number, number] | null => {
    if (userLng == null || userLat == null) return null;
    return [userLng, userLat];
  }, [userLat, userLng]);

  /**
   * During render, `previousCameraModeRef` is still the last committed mode — so this is true exactly
   * when transitioning into follow-user from city or zone.
   */
  const wantsAnimatedFollowEntry =
    cameraMode.mode === 'follow-user' &&
    (previousCameraModeRef.current === 'city' ||
      previousCameraModeRef.current === 'zone');

  // ── Render ───────────────────────────────────────────────────────────────

  /** Saves the map center and zoom when the map is idle. */
  const handleMapIdle = useCallback(() => {
    mapRef.current?.getCenter().then((center) => {
      if (!center) return;
      mapRef.current?.getZoom().then((zoom) => {
        if (zoom != null) savedCameraRef.current = { center: center as [number, number], zoom };
      });
    });
  }, []);

  /** Restores the map center and zoom when the map style finishes loading. */
  const handleDidFinishLoadingStyle = useCallback(() => {
    // Follow-user uses `MapSurface` priming at the puck; restoring city/zoom here fights that.
    if (cameraModeRef.current !== 'city') return;
    const saved = savedCameraRef.current;
    if (saved) {
      cameraRef.current?.setCamera({
        centerCoordinate: saved.center,
        zoomLevel: saved.zoom,
        padding: cameraPadding,
        animationDuration: 0,
      });
    }
  }, [cameraPadding]);

  return (
    <View style={styles.container}>
      <View style={styles.mapStack} onLayout={onMapStackLayout}>
        <MapSurface
          key={mapStyleURL}
          mapStyleURL={mapStyleURL}
          buildingExtrusionColor={buildingExtrusionColor}
          canRotateCamera={canRotateCamera}
          cameraMode={cameraMode}
          shouldUseDeclarativeCamera={shouldUseDeclarativeCamera}
          userCoordinate={userCoordinate}
          wantsAnimatedFollowEntry={wantsAnimatedFollowEntry}
          followUserBearingDeg={followUserBearingDeg}
          cameraPadding={cameraPadding}
          cityCamera={cityCamera}
          zoneMarkers={zoneMarkers}
          presenceCounts={presenceCounts}
          markerAnimatedStyle={markerAnimatedStyle}
          onZoneMarkerPress={handleZoneMarkerPress}
          onMapIdle={handleMapIdle}
          onCameraChanged={handleMapCameraChanged}
          onDidFinishLoadingStyle={handleDidFinishLoadingStyle}
          mapRef={mapRef}
          cameraRef={cameraRef}
          allZonesOutlineFeatureCollection={allZonesOutlineFeatureCollection}
        />
        {cameraMode.mode === 'follow-user' && (
          <GestureDetector gesture={followUserPanGesture}>
            <View style={styles.followUserPanOverlay} collapsable={false} />
          </GestureDetector>
        )}
      </View>

      {/* Outside `mapStack` so native MapView does not clip chips at the screen edges. */}
      {showFollowHorizon && (
        <MapHorizonStrip
          markers={horizonMarkers}
          screenWidth={screenWidth}
          safeAreaTop={insets.top}
          onZoneChipPress={handleHorizonZoneChipPress}
        />
      )}

      <MapControls
        cameraMode={cameraMode}
        activeZoneId={activeZoneId}
        showCityOverviewToggle={showCityOverviewToggle}
        showZoneGeofenceToggle={showZoneGeofenceToggle}
        onCityToggle={handleCityOverviewToggle}
        onZoneGeofenceToggle={handleZoneGeofenceToggle}
        mapControlChipBackground={mapControlChipBackground}
        mapControlIconColor={mapControlIconColor}
        insets={{
          top: insets.top,
          left: insets.left,
          bottom: insets.bottom,
          right: insets.right,
        }}
        controlsBottomPx={insets.bottom}
      />

      {SHOW_DEBUG_OVERLAY && debugOverlay && <MapDebugOverlay debugOverlay={debugOverlay} />}
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, overflow: 'visible' },
  mapStack: { flex: 1, overflow: 'visible' },
  /** Full-screen touch layer above the map in follow-user so horizontal pan reaches RNGH. */
  followUserPanOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
    backgroundColor: 'transparent',
  },
});
