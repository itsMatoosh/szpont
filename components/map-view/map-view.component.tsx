import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CityLabel } from '@/components/city-label/city-label.component';
import { ZoneInfoCard } from '@/components/zone-info-card/zone-info-card.component';
import { ZoneMarker } from '@/components/zone-marker/zone-marker.component';
import { useNearestCity } from '@/hooks/cities/use-nearest-city.hook';
import { useCurrentLocation } from '@/hooks/location/current-location.context';
import { useTabBarVisibility } from '@/hooks/tab-bar/tab-bar-visibility.context';
import { useZonesByCity } from '@/hooks/zones/use-zones-by-city.hook';
import Mapbox from '@/util/mapbox/mapbox.util';

import { getBoundingBox, getZoomForBoundingBox, resolveOverlaps, type ResolvedMarker, type DebugOverlayData } from './map-view.util';

// ── Types ──────────────────────────────────────────────────────────────────────

type ViewState = { mode: 'city' } | { mode: 'zone'; zoneId: string };

/** Set to `true` to render bounding-box and viewport debug overlay on the map. */
const SHOW_DEBUG_OVERLAY = false;

// ── Constants ──────────────────────────────────────────────────────────────────

/** Pitch angle when viewing a zone up close. */
const ZONE_PITCH = 45;
/** Degrees the heading advances per orbit tick. */
const ORBIT_STEP_DEG = 0.3;
/** Milliseconds between orbit ticks (~30 fps is enough for smooth rotation). */
const ORBIT_INTERVAL_MS = 32;
/** Duration of the initial flyTo zoom-in animation (ms). */
const FLYTO_DURATION_MS = 1000;
/** Heading the flyTo covers so rotation is visible during the zoom-in transition. */
const FLYTO_HEADING = (ORBIT_STEP_DEG / ORBIT_INTERVAL_MS) * FLYTO_DURATION_MS;
/** Minimum zoom when viewing a zone — Mapbox tiles lack smaller buildings below ~15. */
const MIN_ZONE_ZOOM = 15;
/** Estimated height (px) of the zone info card content, used as camera bottom padding. */
const ZONE_CARD_HEIGHT_PX = 80;

// ── Component ──────────────────────────────────────────────────────────────────

/** Full-screen Mapbox map showing zone polygons with locked panning. */
export function MapView() {
  const { location } = useCurrentLocation();
  const { city } = useNearestCity();
  const { zones } = useZonesByCity(city?.id);
  const insets = useSafeAreaInsets();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();

  const { setHidden: setTabBarHidden } = useTabBarVisibility();

  const [viewState, setViewState] = useState<ViewState>({ mode: 'city' });
  const [displayState, setDisplayState] = useState<ViewState>({ mode: 'city' });
  const cameraRef = useRef<Mapbox.Camera>(null);
  const headingRef = useRef(0);

  // Sync displayState to viewState with a delay on zone→city so UI elements
  // stay visible while the fly-out animation plays.
  useEffect(() => {
    if (viewState.mode === 'zone') {
      setDisplayState(viewState);
    } else {
      const id = setTimeout(() => setDisplayState(viewState), FLYTO_DURATION_MS);
      return () => clearTimeout(id);
    }
  }, [viewState]);

  // Hide the native tab bar while a zone is displayed
  useEffect(() => {
    setTabBarHidden(displayState.mode === 'zone');
  }, [displayState.mode, setTabBarHidden]);

  // ── Derived camera values ────────────────────────────────────────────────

  const activeZone =
    viewState.mode === 'zone'
      ? zones.find((z) => z.id === viewState.zoneId)
      : undefined;

  /** Zone resolved from displayState — keeps card content stable during fly-out. */
  const displayZone =
    displayState.mode === 'zone'
      ? zones.find((z) => z.id === displayState.zoneId)
      : undefined;

  /** Camera framing derived from the union bounding box of all zones. */
  const cityCamera = useMemo(() => {
    if (zones.length === 0) return undefined;

    let minLng = Infinity;
    let minLat = Infinity;
    let maxLng = -Infinity;
    let maxLat = -Infinity;

    for (const z of zones) {
      const bbox = getBoundingBox(z.boundary as unknown as GeoJSON.Geometry);
      if (!bbox) continue;
      if (bbox[0] < minLng) minLng = bbox[0];
      if (bbox[1] < minLat) minLat = bbox[1];
      if (bbox[2] > maxLng) maxLng = bbox[2];
      if (bbox[3] > maxLat) maxLat = bbox[3];
    }

    if (!isFinite(minLng)) return undefined;

    const unionBbox: [number, number, number, number] = [minLng, minLat, maxLng, maxLat];
    return {
      center: [(minLng + maxLng) / 2, (minLat + maxLat) / 2] as [number, number],
      zoom: getZoomForBoundingBox(unionBbox),
    };
  }, [zones]);

  /** Center and zoom derived from the active zone's bounding box. */
  const zoneCamera = useMemo(() => {
    if (!activeZone) return undefined;
    const bbox = getBoundingBox(activeZone.boundary as unknown as GeoJSON.Geometry);
    if (!bbox) return undefined;
    return {
      center: [(bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2] as [number, number],
      zoom: Math.max(getZoomForBoundingBox(bbox, ZONE_PITCH), MIN_ZONE_ZOOM),
    };
  }, [activeZone]);

  /**
   * Declarative camera props — city / fallback only.
   * Returns an empty object for zone mode so the native Camera `stop` becomes
   * null and can't override the imperative setCamera calls from the orbit effect.
   */
  const cameraProps = useMemo(() => {
    if (zoneCamera) return {};

    if (cityCamera) {
      return {
        centerCoordinate: cityCamera.center,
        zoomLevel: cityCamera.zoom,
        pitch: 0,
        heading: 0,
      };
    }

    if (location) {
      return {
        centerCoordinate: [location.coords.longitude, location.coords.latitude] as [number, number],
        zoomLevel: 12,
        pitch: 0,
        heading: 0,
      };
    }

    return {};
  }, [zoneCamera, cityCamera, location]);

  // ── Zone fly-to + orbit effect ──────────────────────────────────────────────
  // Imperative-only so the declarative Camera props can't reset heading mid-orbit.

  // Bottom padding pushes the focal point up so it isn't hidden behind the info card.
  const zoneCameraPadding = useMemo(
    () => ({
      paddingTop: 0,
      paddingLeft: 0,
      paddingRight: 0,
      paddingBottom: insets.bottom + ZONE_CARD_HEIGHT_PX,
    }),
    [insets.bottom],
  );

  useEffect(() => {
    if (!zoneCamera) {
      headingRef.current = 0;
      return;
    }

    // FlyTo includes heading rotation so the orbit is visible from the first frame.
    cameraRef.current?.setCamera({
      centerCoordinate: zoneCamera.center,
      zoomLevel: zoneCamera.zoom,
      pitch: ZONE_PITCH,
      heading: FLYTO_HEADING,
      animationDuration: FLYTO_DURATION_MS,
      animationMode: 'flyTo',
      padding: zoneCameraPadding,
    });

    // Seed so the interval continues seamlessly from where the flyTo lands.
    headingRef.current = FLYTO_HEADING;

    let intervalId: ReturnType<typeof setInterval> | null = null;

    const timeout = setTimeout(() => {
      intervalId = setInterval(() => {
        headingRef.current = (headingRef.current + ORBIT_STEP_DEG) % 360;
        cameraRef.current?.setCamera({
          centerCoordinate: zoneCamera.center,
          zoomLevel: zoneCamera.zoom,
          pitch: ZONE_PITCH,
          heading: headingRef.current,
          animationDuration: 0,
          animationMode: 'moveTo',
          padding: zoneCameraPadding,
        });
      }, ORBIT_INTERVAL_MS);
    }, FLYTO_DURATION_MS);

    return () => {
      clearTimeout(timeout);
      if (intervalId) clearInterval(intervalId);
    };
  }, [zoneCamera, zoneCameraPadding]);

  // ── Zone markers (city view) ─────────────────────────────────────────────

  /** Zone markers placed at each zone's bounding-box center, then collision-resolved. */
  const { zoneMarkers, debugOverlay } = useMemo<{
    zoneMarkers: ResolvedMarker[];
    debugOverlay: DebugOverlayData | null;
  }>(() => {
    if (!cityCamera) return { zoneMarkers: [], debugOverlay: null };

    const raw = zones.map((z) => {
      const bbox = getBoundingBox(z.boundary as unknown as GeoJSON.Geometry);
      const center: [number, number] = bbox
        ? [(bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2]
        : [0, 0];
      return { id: z.id, name: z.name, subText: '23 osoby', iconUrl: z.icon_url, center };
    });
    const result = resolveOverlaps(raw, cityCamera.zoom, cityCamera.center, screenWidth, screenHeight, {
      top: insets.top,
      right: insets.right,
      bottom: insets.bottom,
      left: insets.left,
    });
    return { zoneMarkers: result.markers, debugOverlay: result.debug };
  }, [zones, cityCamera, screenWidth, screenHeight, insets]);

  // ── Active zone GeoJSON (zone view) ─────────────────────────────────────

  /** Single-feature collection for the selected zone's boundary polygon. */
  const activeZoneFeature = useMemo<GeoJSON.FeatureCollection | undefined>(() => {
    if (!activeZone) return undefined;
    return {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: activeZone.boundary as unknown as GeoJSON.Geometry,
          properties: {},
        },
      ],
    };
  }, [activeZone]);

  /** Keeps the zone ShapeSource mounted during the fly-out so zoom interpolation can fade it. */
  const [displayedZoneFeature, setDisplayedZoneFeature] =
    useState<GeoJSON.FeatureCollection>();

  useEffect(() => {
    if (activeZoneFeature) {
      setDisplayedZoneFeature(activeZoneFeature);
      return;
    }
    const id = setTimeout(
      () => setDisplayedZoneFeature(undefined),
      FLYTO_DURATION_MS,
    );
    return () => clearTimeout(id);
  }, [activeZoneFeature]);

  // ── Marker fade animation ────────────────────────────────────────────────

  const markerOpacity = useSharedValue(1);

  useEffect(() => {
    const fadingIn = viewState.mode === 'city';
    markerOpacity.value = withTiming(fadingIn ? 1 : 0, {
      duration: fadingIn ? FLYTO_DURATION_MS : 200,
    });
  }, [viewState.mode]);

  /** Animated style applied to each marker wrapper so they fade in/out with the flyTo. */
  const markerAnimatedStyle = useAnimatedStyle(() => ({
    opacity: markerOpacity.value,
    // Prevent phantom taps on invisible markers
    pointerEvents: markerOpacity.value === 0 ? 'none' : 'auto',
  }));

  // ── Handlers ─────────────────────────────────────────────────────────────

  /** Return to the city overview via imperative flyTo so it isn't ignored. */
  const handleBack = useCallback(() => {
    setViewState({ mode: 'city' });
    if (cityCamera) {
      cameraRef.current?.setCamera({
        centerCoordinate: cityCamera.center,
        zoomLevel: cityCamera.zoom,
        pitch: 0,
        heading: 0,
        animationDuration: 1000,
        animationMode: 'flyTo',
      });
    }
  }, [cityCamera]);

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      <Mapbox.MapView
        style={styles.map}
        styleURL="mapbox://styles/mapbox/dark-v11"
        pitchEnabled={false}
        rotateEnabled={false}
        zoomEnabled={false}
        scrollEnabled={false}
        logoEnabled={false}
        attributionEnabled={false}
        compassEnabled={false}
        scaleBarEnabled={false}
      >
        <Mapbox.Camera
          ref={cameraRef}
          {...cameraProps}
          animationMode="flyTo"
          animationDuration={1000}
        />

        <Mapbox.LocationPuck puckBearingEnabled puckBearing="heading" />

        {/* Selected zone boundary — only visible in zone view, below buildings */}
        {displayedZoneFeature && (
          <Mapbox.ShapeSource id="zone-boundaries" shape={displayedZoneFeature}>
            <Mapbox.FillLayer
              id="zone-fill"
              belowLayerID="3d-buildings"
              style={{
                fillColor: '#CCFF00',
                fillOpacity: [
                  'interpolate', ['linear'], ['zoom'],
                  13, 0,
                  15, 0.15,
                ],
              }}
            />
            <Mapbox.LineLayer
              id="zone-outline"
              belowLayerID="3d-buildings"
              style={{
                lineColor: '#CCFF00',
                lineWidth: 2,
                lineOpacity: [
                  'interpolate', ['linear'], ['zoom'],
                  13, 0,
                  15, 0.8,
                ],
              }}
            />
          </Mapbox.ShapeSource>
        )}

        {/* 3D building extrusions — on top of zone polygons */}
        <Mapbox.FillExtrusionLayer
          id="3d-buildings"
          sourceLayerID="building"
          minZoomLevel={0}
          maxZoomLevel={24}
          style={{
            fillExtrusionColor: '#aaa',
            fillExtrusionHeight: ['get', 'height'],
            fillExtrusionBase: ['get', 'min_height'],
            fillExtrusionOpacity: [
              'interpolate', ['linear'], ['zoom'],
              13, 0,
              14.5, 0.9,
            ],
          }}
        />

        {/* Zone markers — always rendered, opacity animated during transitions */}
        {zoneMarkers.map((marker) => (
          <ZoneMarker
            key={marker.id}
            marker={marker}
            animatedStyle={markerAnimatedStyle}
            onPress={() => setViewState({ mode: 'zone', zoneId: marker.id })}
          />
        ))}
      </Mapbox.MapView>

      {city && (
        <CityLabel
          name={city.name}
          zoneName={activeZone?.name}
          topInset={insets.top}
        />
      )}

      <ZoneInfoCard
        visible={viewState.mode === 'zone'}
        bottomInset={insets.bottom}
        onClose={handleBack}
      />

      {/* Debug overlay: shows the simulation's viewport boundary and marker bounding boxes */}
      {SHOW_DEBUG_OVERLAY && debugOverlay && (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          {/* Viewport boundary */}
          <View
            style={{
              position: 'absolute',
              left: debugOverlay.viewport.left,
              top: debugOverlay.viewport.top,
              width: debugOverlay.viewport.width,
              height: debugOverlay.viewport.height,
              borderWidth: 2,
              borderColor: 'lime',
              borderStyle: 'dashed',
            }}
          />
          {/* Marker bounding boxes */}
          {debugOverlay.rects.map((rect: DebugOverlayData['rects'][number]) => (
            <View
              key={rect.name}
              style={{
                position: 'absolute',
                left: rect.left,
                top: rect.top,
                width: rect.width,
                height: rect.height,
                borderWidth: 1,
                borderColor: 'red',
                backgroundColor: 'rgba(255, 0, 0, 0.15)',
              }}
            >
              <Text style={{ color: 'red', fontSize: 8 }}>{rect.name}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
});
