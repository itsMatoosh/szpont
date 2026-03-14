import RNBounceable from '@freakycoder/react-native-bounceable';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useNearestCity } from '@/hooks/cities/use-nearest-city.hook';
import { useCurrentLocation } from '@/hooks/location/current-location.context';
import { useZonesByCity } from '@/hooks/zones/use-zones-by-city.hook';
import Mapbox from '@/util/mapbox/mapbox.util';

import {
  getBoundingBox,
  getZoomForBoundingBox,
  resolveOverlaps,
  type TailDirection,
} from './map-view.util';

// ── Types ──────────────────────────────────────────────────────────────────────

type ViewState = { mode: 'city' } | { mode: 'zone'; zoneId: string };

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

// ── Component ──────────────────────────────────────────────────────────────────

/** Full-screen Mapbox map showing zone polygons with locked panning. */
export function MapView() {
  const { location } = useCurrentLocation();
  const { city } = useNearestCity();
  const { zones } = useZonesByCity(city?.id);
  const insets = useSafeAreaInsets();

  const [viewState, setViewState] = useState<ViewState>({ mode: 'city' });
  const cameraRef = useRef<Mapbox.Camera>(null);
  const headingRef = useRef(0);

  // ── Derived camera values ────────────────────────────────────────────────

  const activeZone =
    viewState.mode === 'zone'
      ? zones.find((z) => z.id === viewState.zoneId)
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
        });
      }, ORBIT_INTERVAL_MS);
    }, FLYTO_DURATION_MS);

    return () => {
      clearTimeout(timeout);
      if (intervalId) clearInterval(intervalId);
    };
  }, [zoneCamera]);

  // ── Zone markers (city view) ─────────────────────────────────────────────

  /** Zone centers with 2D collision avoidance applied. */
  const zoneMarkers = useMemo(() => {
    const raw = zones.map((z) => {
      const bbox = getBoundingBox(z.boundary as unknown as GeoJSON.Geometry);
      const center: [number, number] = bbox
        ? [(bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2]
        : [0, 0];
      return { id: z.id, name: z.name, center };
    });
    return resolveOverlaps(raw, cityCamera?.zoom ?? 12);
  }, [zones, cityCamera?.zoom]);

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
      >
        <Mapbox.Camera
          ref={cameraRef}
          {...cameraProps}
          animationMode="flyTo"
          animationDuration={1000}
        />

        <Mapbox.LocationPuck puckBearingEnabled puckBearing="heading" />

        {/* Selected zone boundary — only visible in zone view, below buildings */}
        {activeZoneFeature && (
          <Mapbox.ShapeSource id="zone-boundaries" shape={activeZoneFeature}>
            <Mapbox.FillLayer
              id="zone-fill"
              belowLayerID="3d-buildings"
              style={{
                fillColor: '#CCFF00',
                fillOpacity: 0.15,
              }}
            />
            <Mapbox.LineLayer
              id="zone-outline"
              belowLayerID="3d-buildings"
              style={{
                lineColor: '#CCFF00',
                lineWidth: 2,
                lineOpacity: 0.8,
              }}
            />
          </Mapbox.ShapeSource>
        )}

        {/* 3D building extrusions — on top of zone polygons */}
        <Mapbox.FillExtrusionLayer
          id="3d-buildings"
          sourceLayerID="building"
          minZoomLevel={13}
          maxZoomLevel={24}
          style={{
            fillExtrusionColor: '#aaa',
            fillExtrusionHeight: ['get', 'height'],
            fillExtrusionBase: ['get', 'min_height'],
            fillExtrusionOpacity: 0.9,
          }}
        />

        {/* Zone markers — visible only in city view */}
        {viewState.mode === 'city' &&
          zoneMarkers.map((marker) => (
            <Mapbox.MarkerView
              key={marker.id}
              coordinate={marker.originalCenter}
              allowOverlap
              anchor={TAIL_ANCHOR[marker.tailDirection]}
            >
              <RNBounceable
                onPress={() => setViewState({ mode: 'zone', zoneId: marker.id })}
              >
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
            </Mapbox.MarkerView>
          ))}
      </Mapbox.MapView>

      {/* Back button — visible only in zone view */}
      {viewState.mode === 'zone' && (
        <View style={[styles.backButton, { top: insets.top + 12 }]}>
          <RNBounceable onPress={handleBack}>
            <View style={styles.backButtonInner}>
              <Text style={styles.backChevron}>‹</Text>
            </View>
          </RNBounceable>
        </View>
      )}
    </View>
  );
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

// ── Marker bubble ─────────────────────────────────────────────────────────────

/** Inner bubble content shared between all tail orientations. */
function MarkerBubble({ marker }: { marker: { name: string } }) {
  return (
    <View style={styles.marker}>
      <Text style={styles.markerLabel}>{marker.name}</Text>
    </View>
  );
}

// ── Tail triangle size ────────────────────────────────────────────────────────

const TAIL_SIZE = 6;

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  backButton: {
    position: 'absolute',
    left: 16,
    zIndex: 10,
  },
  backButtonInner: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backChevron: {
    color: '#FFFFFF',
    fontSize: 28,
    lineHeight: 32,
    marginLeft: -2,
  },
  markerWrapper: {
    alignItems: 'center',
  },
  marker: {
    alignItems: 'center',
    backgroundColor: '#CCFF00',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingTop: 4,
    paddingBottom: 6,
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
    borderBottomColor: '#CCFF00',
  },
  tailBottom: {
    width: 0,
    height: 0,
    borderLeftWidth: TAIL_SIZE,
    borderRightWidth: TAIL_SIZE,
    borderTopWidth: TAIL_SIZE,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#CCFF00',
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
    borderRightColor: '#CCFF00',
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
    borderLeftColor: '#CCFF00',
  },
});
