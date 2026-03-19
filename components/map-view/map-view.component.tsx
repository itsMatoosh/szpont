import * as Location from 'expo-location';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, useColorScheme, useWindowDimensions, View } from 'react-native';
import { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CityLabel } from '@/components/city-label/city-label.component';
import { ZoneInfoCard } from '@/components/zone-info-card/zone-info-card.component';
import { ZoneMarker } from '@/components/zone-marker/zone-marker.component';
import { useActiveZoneId } from '@/hooks/active-zone/use-active-zone-id.hook';
import { useNearestCity } from '@/hooks/cities/use-nearest-city.hook';
import { useZonesPresenceCounts } from '@/hooks/presence/use-zones-presence-counts.hook';
import { useTabBarVisibility } from '@/hooks/tab-bar/tab-bar-visibility.context';
import { useZonesByCity } from '@/hooks/zones/use-zones-by-city.hook';
import Mapbox from '@/util/mapbox/mapbox.util';

import { expandBoundingBox, getBoundingBox, getOrientedEnvelope, getZoomForBoundingBox, resolveOverlaps, type ResolvedMarker, type DebugOverlayData } from './map-view.util';

// ── Types ──────────────────────────────────────────────────────────────────────

type CameraMode =
  | { mode: 'follow-user' }
  | { mode: 'city' }
  | { mode: 'zone'; zoneId: string }
  | { mode: 'zone-active'; zoneId: string };

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
/** OMBR aspect ratio above which the orbit also slides along the major axis. */
const SLIDE_ASPECT_THRESHOLD = 1.8;
/** Fraction of the OMBR major-axis half-length used for each slide endpoint (0 = center, 1 = edge). */
const SLIDE_INSET = 0.6;
/** How much each bbox axis is expanded for zone-active maxBounds (0.05 = 5 % padding per side). */
const ZONE_ACTIVE_BOUNDS_PADDING = 0.05;

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

/** Full-screen Mapbox map showing zone polygons with locked panning. */
export function MapView() {
  const colorScheme = useColorScheme();
  const { city } = useNearestCity();
  const { zones } = useZonesByCity(city?.id);
  const zoneIds = useMemo(() => zones.map((z) => z.id), [zones]);
  const presenceCounts = useZonesPresenceCounts(zoneIds);
  const insets = useSafeAreaInsets();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();

  const { setHidden: setTabBarHidden } = useTabBarVisibility();
  const activeZoneId = useActiveZoneId();

  const [cameraMode, setCameraMode] = useState<CameraMode>({ mode: 'follow-user' });
  const [displayMode, setDisplayMode] = useState<CameraMode>({ mode: 'follow-user' });
  const cameraRef = useRef<Mapbox.Camera>(null);
  const headingRef = useRef(0);
  const mapRef = useRef<InstanceType<typeof Mapbox.MapView> | null>(null);
  /** Last known map center/zoom; restored after style change remount so camera does not jump to default. */
  const savedCameraRef = useRef<{ center: [number, number]; zoom: number } | null>(null);

  // ── Zone-active auto-enter / auto-exit ──────────────────────────────────
  // When the OS geofencing detects the user inside a zone, take over the
  // map. When they leave, revert to the previous non-active mode.

  useEffect(() => {
    if (activeZoneId) {
      setCameraMode({ mode: 'zone-active', zoneId: activeZoneId });
    } else {
      setCameraMode((prev) =>
        prev.mode === 'zone-active'
          ? city ? { mode: 'city' } : { mode: 'follow-user' }
          : prev,
      );
    }
  }, [activeZoneId, city]);

  // Sync displayMode to cameraMode with a delay on zone/zone-active → other
  // so UI elements stay visible while the fly-out animation plays.
  useEffect(() => {
    if (cameraMode.mode === 'zone' || cameraMode.mode === 'zone-active') {
      setDisplayMode(cameraMode);
    } else {
      const id = setTimeout(() => setDisplayMode(cameraMode), FLYTO_DURATION_MS);
      return () => clearTimeout(id);
    }
  }, [cameraMode]);

  // Hide the native tab bar while a zone is displayed
  useEffect(() => {
    setTabBarHidden(displayMode.mode === 'zone' || displayMode.mode === 'zone-active');
  }, [displayMode.mode, setTabBarHidden]);

  // ── Derived camera values ────────────────────────────────────────────────

  const activeZone =
    cameraMode.mode === 'zone' || cameraMode.mode === 'zone-active'
      ? zones.find((z) => z.id === cameraMode.zoneId)
      : undefined;

  /** Zone resolved from displayMode — keeps card content stable during fly-out. */
  const displayZone =
    displayMode.mode === 'zone' || displayMode.mode === 'zone-active'
      ? zones.find((z) => z.id === displayMode.zoneId)
      : undefined;

  /** Bounds and min-zoom used to constrain the camera in zone-active mode. */
  const zoneActiveCamera = useMemo(() => {
    if (cameraMode.mode !== 'zone-active') return undefined;
    const zone = zones.find((z) => z.id === cameraMode.zoneId);
    if (!zone) return undefined;
    const geom = zone.boundary as unknown as GeoJSON.Geometry;
    const bbox = getBoundingBox(geom);
    if (!bbox) return undefined;
    const expanded = expandBoundingBox(bbox, ZONE_ACTIVE_BOUNDS_PADDING);
    return {
      bounds: {
        ne: [expanded[2], expanded[3]] as [number, number],
        sw: [expanded[0], expanded[1]] as [number, number],
      },
      bbox,
      minZoom: getZoomForBoundingBox(bbox) + 0.5,
    };
  }, [cameraMode, zones]);

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

  // ── City-change effect ────────────────────────────────────────────────────
  // Transitions to city mode when the resolved city changes AND zone data
  // is ready (cityCamera defined). Stays on follow-user while zones are
  // still loading to avoid a native race between the Camera's
  // followUserLocation prop and an imperative setCamera call.

  const prevCityIdRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    const prev = prevCityIdRef.current;
    prevCityIdRef.current = city?.id;

    if (city?.id !== prev) {
      // City changed — transition immediately if zone data is ready,
      // otherwise fall back to follow-user until the next run.
      setCameraMode((current) => {
        if (current.mode === 'zone-active') return current;
        if (!city) return { mode: 'follow-user' };
        return cityCamera ? { mode: 'city' } : { mode: 'follow-user' };
      });
      return;
    }

    // City unchanged but zone data may have just finished loading.
    if (cityCamera && city) {
      setCameraMode((current) =>
        current.mode === 'follow-user' ? { mode: 'city' } : current,
      );
    }
  }, [city, cityCamera]);

  /** Center, zoom, and optional slide endpoints derived from the active zone's oriented envelope. */
  const zoneCamera = useMemo(() => {
    if (!activeZone) return undefined;
    const geom = activeZone.boundary as unknown as GeoJSON.Geometry;

    const envelope = getOrientedEnvelope(geom);
    if (!envelope) return undefined;

    const bbox = getBoundingBox(geom);
    if (!bbox) return undefined;

    const { center, majorStart, majorEnd, aspect } = envelope;
    const zoom = Math.max(getZoomForBoundingBox(bbox, ZONE_PITCH), MIN_ZONE_ZOOM);

    let slideEndpoints: { start: [number, number]; end: [number, number] } | null = null;

    if (aspect >= SLIDE_ASPECT_THRESHOLD) {
      // Inset from the full major-axis endpoints toward center
      slideEndpoints = {
        start: [
          center[0] + (majorStart[0] - center[0]) * SLIDE_INSET,
          center[1] + (majorStart[1] - center[1]) * SLIDE_INSET,
        ],
        end: [
          center[0] + (majorEnd[0] - center[0]) * SLIDE_INSET,
          center[1] + (majorEnd[1] - center[1]) * SLIDE_INSET,
        ],
      };
    }

    return { center, zoom, slideEndpoints };
  }, [activeZone]);

  // ── Camera effect ────────────────────────────────────────────────────────
  // follow-user and city modes are handled declaratively via Camera props.
  // zone and zone-active use imperative setCamera calls.

  /** Bottom padding pushes the focal point up so it isn't hidden behind the info card. */
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
    if (cameraMode.mode === 'follow-user' || cameraMode.mode === 'city') {
      headingRef.current = 0;
      return;
    }

    if (cameraMode.mode === 'zone-active') {
      headingRef.current = 0;
      if (!zoneActiveCamera) return;

      const zoneCenter: [number, number] = [
        (zoneActiveCamera.bbox[0] + zoneActiveCamera.bbox[2]) / 2,
        (zoneActiveCamera.bbox[1] + zoneActiveCamera.bbox[3]) / 2,
      ];

      // Fetch a fresh device position so we zoom to where the user
      // actually is right now, not a potentially stale cached value.
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
        .then((loc) => {
          cameraRef.current?.setCamera({
            centerCoordinate: [loc.coords.longitude, loc.coords.latitude],
            zoomLevel: MIN_ZONE_ZOOM,
            pitch: 0,
            heading: 0,
            animationDuration: FLYTO_DURATION_MS,
            animationMode: 'flyTo',
          });
        })
        .catch(() => {
          cameraRef.current?.setCamera({
            centerCoordinate: zoneCenter,
            zoomLevel: MIN_ZONE_ZOOM,
            pitch: 0,
            heading: 0,
            animationDuration: FLYTO_DURATION_MS,
            animationMode: 'flyTo',
          });
        });
      return;
    }

    // mode === 'zone'
    if (!zoneCamera) return;

    const { slideEndpoints } = zoneCamera;

    // For elongated zones the flyTo lands at the slide start so the tour
    // begins from one end; compact zones use the bbox center as before.
    const flyToCenter = slideEndpoints ? slideEndpoints.start : zoneCamera.center;

    // FlyTo includes heading rotation so the orbit is visible from the first frame.
    cameraRef.current?.setCamera({
      centerCoordinate: flyToCenter,
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

        // Sinusoidal ping-pong along the major axis for elongated zones
        let center = zoneCamera.center;
        if (slideEndpoints) {
          const t = (Math.sin((headingRef.current * Math.PI) / 180 - Math.PI / 2) + 1) / 2;
          center = [
            slideEndpoints.start[0] + t * (slideEndpoints.end[0] - slideEndpoints.start[0]),
            slideEndpoints.start[1] + t * (slideEndpoints.end[1] - slideEndpoints.start[1]),
          ];
        }

        cameraRef.current?.setCamera({
          centerCoordinate: center,
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
  }, [cameraMode, zoneCamera, zoneActiveCamera, zoneCameraPadding]);

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
      return { id: z.id, name: z.name, subText: '23 osoby', iconUrl: null, center };
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
    const fadingIn = cameraMode.mode !== 'zone' && cameraMode.mode !== 'zone-active';
    markerOpacity.value = withTiming(fadingIn ? 1 : 0, {
      duration: fadingIn ? FLYTO_DURATION_MS : 200,
    });
  }, [cameraMode.mode]);

  /** Animated style applied to each marker wrapper so they fade in/out with the flyTo. */
  const markerAnimatedStyle = useAnimatedStyle(() => ({
    opacity: markerOpacity.value,
    pointerEvents: markerOpacity.value === 0 ? 'none' : 'auto',
  }));

  // ── Handlers ─────────────────────────────────────────────────────────────

  /** Return to city overview or follow-user — the camera effect handles the flyTo. */
  const handleBack = useCallback(() => {
    setCameraMode(city ? { mode: 'city' } : { mode: 'follow-user' });
  }, [city]);

  const isZoneActive = cameraMode.mode === 'zone-active';

  const theme = colorScheme === 'dark' ? 'dark' : 'light';
  const mapStyleURL = MAP_STYLE_URL[theme];
  const buildingExtrusionColor = BUILDING_EXTRUSION_COLOR[theme];

  // ── Render ───────────────────────────────────────────────────────────────

  const handleMapIdle = useCallback(() => {
    mapRef.current?.getCenter().then((center) => {
      if (!center) return;
      mapRef.current?.getZoom().then((zoom) => {
        if (zoom != null) savedCameraRef.current = { center: center as [number, number], zoom };
      });
    });
  }, []);

  const handleDidFinishLoadingStyle = useCallback(() => {
    const saved = savedCameraRef.current;
    if (saved) {
      cameraRef.current?.setCamera({
        centerCoordinate: saved.center,
        zoomLevel: saved.zoom,
        animationDuration: 0,
      });
    }
  }, [mapStyleURL]);

  return (
    <View style={styles.container}>
      <Mapbox.MapView
        ref={mapRef}
        key={mapStyleURL}
        style={styles.map}
        styleURL={mapStyleURL}
        onMapIdle={handleMapIdle}
        onDidFinishLoadingStyle={handleDidFinishLoadingStyle}
        pitchEnabled={isZoneActive}
        rotateEnabled={isZoneActive}
        zoomEnabled={isZoneActive}
        scrollEnabled={isZoneActive}
        logoEnabled={false}
        attributionEnabled={false}
        compassEnabled={false}
        scaleBarEnabled={false}
      >
        {/* City framing uses declarative Camera props so followUserLocation
            and centerCoordinate arrive as a single atomic native update,
            avoiding a race between the prop change and imperative setCamera. */}
        <Mapbox.Camera
          ref={cameraRef}
          followUserLocation={cameraMode.mode === 'follow-user'}
          followZoomLevel={12}
          centerCoordinate={cameraMode.mode === 'city' && cityCamera ? cityCamera.center : undefined}
          zoomLevel={cameraMode.mode === 'city' && cityCamera ? cityCamera.zoom : undefined}
          pitch={cameraMode.mode === 'city' ? 0 : undefined}
          heading={cameraMode.mode === 'city' ? 0 : undefined}
          animationMode="flyTo"
          animationDuration={FLYTO_DURATION_MS}
        />

        <Mapbox.LocationPuck puckBearingEnabled puckBearing="heading" />

        {/* 3D building extrusions — rendered first so zone layers can use belowLayerID="3d-buildings" */}
        <Mapbox.FillExtrusionLayer
          id="3d-buildings"
          sourceID="composite"
          sourceLayerID="building"
          minZoomLevel={0}
          maxZoomLevel={24}
          style={{
            fillExtrusionColor: buildingExtrusionColor,
            fillExtrusionHeight: ['get', 'height'],
            fillExtrusionBase: ['get', 'min_height'],
            fillExtrusionOpacity: [
              'interpolate', ['linear'], ['zoom'],
              13, 0,
              14.5, 0.9,
            ],
          }}
        />

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
                  12, 0,
                  13, 0.15,
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
                  12, 0,
                  13, 0.8,
                ],
              }}
            />
          </Mapbox.ShapeSource>
        )}

        {/* Zone markers — always rendered, opacity animated during transitions */}
        {zoneMarkers.map((marker) => (
          <ZoneMarker
            key={marker.id}
            marker={marker}
            presenceCount={presenceCounts[marker.id] ?? 0}
            animatedStyle={markerAnimatedStyle}
            onPress={() => setCameraMode({ mode: 'zone', zoneId: marker.id })}
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
        visible={cameraMode.mode === 'zone'}
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
