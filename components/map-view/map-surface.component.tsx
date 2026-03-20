import { UserTrackingMode, type MapState } from '@rnmapbox/maps';
import {
  type MutableRefObject,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { type ViewStyle } from 'react-native';
import { type AnimatedStyle } from 'react-native-reanimated';

import { ZoneMarker } from '@/components/zone-marker/zone-marker.component';
import { type CameraMode } from '@/components/map-view/map-view.types';
import { type CityCamera } from '@/hooks/map-view/use-city-camera.hook';
import Mapbox from '@/util/mapbox/mapbox.util';
import { type ResolvedMarker } from '@/components/map-view/map-view.util';

/** Top-level Mapbox camera easing path (native `RNMBXCamera`). */
type TopLevelCameraAnimationMode = 'none' | 'flyTo';

/** Matches `followZoomLevel` / pitched follow framing. */
const FOLLOW_USER_ZOOM = 17;
const FOLLOW_USER_PITCH = 60;
/** Native camera transition when entering follow-user from city or zone (ms). */
const FOLLOW_USER_TRANSITION_MS = 280;

interface CameraPadding {
  paddingTop: number;
  paddingLeft: number;
  paddingRight: number;
  paddingBottom: number;
}

interface MapSurfaceProps {
  mapStyleURL: string;
  buildingExtrusionColor: string;
  canRotateCamera: boolean;
  cameraMode: CameraMode;
  shouldUseDeclarativeCamera: boolean;
  /** `[lng, lat]` while follow-user; used to prime the camera before enabling tracking. */
  userCoordinate: [number, number] | null;
  /**
   * True when this render is the first in follow-user after leaving city/zone (`previousCameraModeRef`
   * still points at the prior mode).
   */
  wantsAnimatedFollowEntry: boolean;
  followUserBearingDeg: number;
  cameraPadding: CameraPadding;
  cityCamera: CityCamera | undefined;
  zoneMarkers: ResolvedMarker[];
  presenceCounts: Record<string, number>;
  markerAnimatedStyle: AnimatedStyle<ViewStyle>;
  onZoneMarkerPress: (zoneId: string) => void;
  onMapIdle: () => void;
  /** Fired when the map camera changes; used for follow-user horizon bearing. */
  onCameraChanged?: (state: MapState) => void;
  onDidFinishLoadingStyle: () => void;
  mapRef: MutableRefObject<InstanceType<typeof Mapbox.MapView> | null>;
  cameraRef: MutableRefObject<Mapbox.Camera | null>;
  allZonesOutlineFeatureCollection: GeoJSON.FeatureCollection;
}

/** Mapbox surface including camera, base layers, zone layers, and markers. */
export function MapSurface({
  mapStyleURL,
  buildingExtrusionColor,
  canRotateCamera,
  cameraMode,
  shouldUseDeclarativeCamera,
  userCoordinate,
  wantsAnimatedFollowEntry,
  followUserBearingDeg,
  cameraPadding,
  cityCamera,
  zoneMarkers,
  presenceCounts,
  markerAnimatedStyle,
  onZoneMarkerPress,
  onMapIdle,
  onCameraChanged,
  onDidFinishLoadingStyle,
  mapRef,
  cameraRef,
  allZonesOutlineFeatureCollection,
}: MapSurfaceProps) {
  /**
   * Until the style has loaded once on this map instance, keep `followUserLocation` off and frame the
   * puck with a normal camera stop at `userCoordinate` + `none` animation — Mapbox often still flies
   * when tracking turns on even with `animationMode: 'none'`.
   */
  const [followPrimingPending, setFollowPrimingPending] = useState(true);
  /** Set when `onDidFinishLoadingStyle` fires so priming can end after layout (coords + center shot). */
  const [mapStyleReady, setMapStyleReady] = useState(false);
  /** After first idle, allow animated transitions into follow from city/zone without re-flying padding. */
  const [hasHadMapIdle, setHasHadMapIdle] = useState(false);

  // End follow priming only after the style is ready so the first center+zoom stop can apply.
  useEffect(() => {
    if (!mapStyleReady) return;
    setFollowPrimingPending(false);
  }, [mapStyleReady]);

  const handleMapIdle = useCallback(() => {
    setHasHadMapIdle(true);
    onMapIdle();
  }, [onMapIdle]);

  const handleDidFinishLoadingStyle = useCallback(() => {
    setMapStyleReady(true);
    onDidFinishLoadingStyle();
  }, [onDidFinishLoadingStyle]);

  const isFollowIntent =
    shouldUseDeclarativeCamera && cameraMode.mode === 'follow-user';
  const useFollowPriming =
    isFollowIntent && followPrimingPending && userCoordinate != null;
  const followUserLocationActive = isFollowIntent && !useFollowPriming;

  const followTopLevelAnimation = useMemo((): {
    mode: TopLevelCameraAnimationMode;
    duration: number;
  } => {
    if (!followUserLocationActive) {
      return { mode: 'none', duration: 0 };
    }
    if (!hasHadMapIdle) {
      return { mode: 'none', duration: 0 };
    }
    if (wantsAnimatedFollowEntry) {
      return { mode: 'flyTo', duration: FOLLOW_USER_TRANSITION_MS };
    }
    return { mode: 'none', duration: 0 };
  }, [followUserLocationActive, hasHadMapIdle, wantsAnimatedFollowEntry]);

  const centerCoordinate =
    shouldUseDeclarativeCamera && cameraMode.mode === 'city' && cityCamera
      ? cityCamera.center
      : useFollowPriming
        ? userCoordinate!
        : undefined;

  const zoomLevel =
    shouldUseDeclarativeCamera && cameraMode.mode === 'city' && cityCamera
      ? cityCamera.zoom
      : useFollowPriming
        ? FOLLOW_USER_ZOOM
        : undefined;

  const pitch =
    shouldUseDeclarativeCamera && cameraMode.mode === 'city'
      ? 0
      : useFollowPriming
        ? FOLLOW_USER_PITCH
        : undefined;

  const heading =
    shouldUseDeclarativeCamera && cameraMode.mode === 'city'
      ? 0
      : useFollowPriming
        ? followUserBearingDeg
        : undefined;

  const animationMode = shouldUseDeclarativeCamera
    ? cameraMode.mode === 'city'
      ? 'flyTo'
      : followUserLocationActive
        ? followTopLevelAnimation.mode
        : useFollowPriming
          ? 'none'
          : undefined
    : undefined;

  const animationDuration = shouldUseDeclarativeCamera
    ? cameraMode.mode === 'city'
      ? 280
      : followUserLocationActive
        ? followTopLevelAnimation.duration
        : useFollowPriming
          ? 0
          : undefined
    : undefined;

  return (
    <Mapbox.MapView
      ref={mapRef}
      style={{ flex: 1 }}
      styleURL={mapStyleURL}
      onMapIdle={handleMapIdle}
      onCameraChanged={onCameraChanged}
      onDidFinishLoadingStyle={handleDidFinishLoadingStyle}
      pitchEnabled={false}
      rotateEnabled={canRotateCamera}
      zoomEnabled={false}
      scrollEnabled={false}
      logoEnabled={false}
      attributionEnabled={false}
      compassEnabled={false}
      scaleBarEnabled={false}
    >
      {/* City framing uses declarative Camera props so followUserLocation and centerCoordinate arrive atomically. */}
      <Mapbox.Camera
        ref={cameraRef}
        followUserLocation={followUserLocationActive}
        followZoomLevel={FOLLOW_USER_ZOOM}
        followPitch={followUserLocationActive ? FOLLOW_USER_PITCH : undefined}
        // Follow mode ignores `padding` on CameraStop; use followPadding for tab bar / bottom chrome offset.
        followPadding={followUserLocationActive ? cameraPadding : undefined}
        followUserMode={
          followUserLocationActive ? UserTrackingMode.Follow : undefined
        }
        followHeading={
          followUserLocationActive ? followUserBearingDeg : undefined
        }
        centerCoordinate={centerCoordinate}
        zoomLevel={zoomLevel}
        pitch={pitch}
        heading={heading}
        padding={shouldUseDeclarativeCamera ? cameraPadding : undefined}
        animationMode={animationMode}
        animationDuration={animationDuration}
      />

      <Mapbox.LocationPuck puckBearingEnabled puckBearing="heading" />

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
          fillExtrusionOpacity: ['interpolate', ['linear'], ['zoom'], 13, 0, 14.5, 0.9],
        }}
      />

      {allZonesOutlineFeatureCollection.features.length > 0 && (
        <Mapbox.ShapeSource id="zone-boundaries" shape={allZonesOutlineFeatureCollection}>
          {/* Outside zone mode, `['!', ['has', 'zoneId']]` matches nothing — every feature has `zoneId`. */}
          <Mapbox.FillLayer
            id="zone-fill"
            belowLayerID="3d-buildings"
            filter={
              cameraMode.mode === 'zone'
                ? ['==', ['get', 'zoneId'], cameraMode.zoneId]
                : ['!', ['has', 'zoneId']]
            }
            style={{
              fillColor: '#CCFF00',
              fillOpacity: ['interpolate', ['linear'], ['zoom'], 12, 0, 13, 0.15],
            }}
          />
          <Mapbox.LineLayer
            id="zone-outline"
            belowLayerID="3d-buildings"
            style={{
              lineColor: '#CCFF00',
              lineWidth: 2,
              lineOpacity: ['interpolate', ['linear'], ['zoom'], 12, 0, 13, 0.8],
            }}
          />
        </Mapbox.ShapeSource>
      )}

      {zoneMarkers.map((marker) => (
        <ZoneMarker
          key={marker.id}
          marker={marker}
          presenceCount={presenceCounts[marker.id] ?? 0}
          animatedStyle={markerAnimatedStyle}
          onPress={() => onZoneMarkerPress(marker.id)}
        />
      ))}
    </Mapbox.MapView>
  );
}
