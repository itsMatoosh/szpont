import { useMemo } from 'react';

import { resolveOverlaps, type DebugOverlayData, type ResolvedMarker, getBoundingBox } from '@/components/map-view/map-view.util';
import { type MapZone } from '@/components/map-view/map-view.types';
import { type CityCamera } from '@/hooks/map-view/use-city-camera.hook';

interface EdgeInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/** Extra top padding below the safe area reserved for top map overlays (city / follow toggle). */
const TOP_OVERLAY_HEIGHT = 52;

interface UseZoneMarkersParams {
  cityCamera: CityCamera | undefined;
  zones: MapZone[];
  insets: EdgeInsets;
  screenWidth: number;
  screenHeight: number;
  /** Bottom obstruction (tab bar reserve) passed into marker viewport padding. */
  mapBottomChromePx: number;
}

interface UseZoneMarkersResult {
  zoneMarkers: ResolvedMarker[];
  debugOverlay: DebugOverlayData | null;
}

/** Resolves zone marker positions for city overview, including overlap-collision layout. */
export function useZoneMarkers({
  cityCamera,
  zones,
  insets,
  screenWidth,
  screenHeight,
  mapBottomChromePx,
}: UseZoneMarkersParams): UseZoneMarkersResult {
  return useMemo<UseZoneMarkersResult>(() => {
    if (!cityCamera) return { zoneMarkers: [], debugOverlay: null };

    const raw = zones.map((zone) => {
      const bbox = getBoundingBox(zone.boundary as GeoJSON.Geometry);
      const center: [number, number] = bbox
        ? [(bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2]
        : [0, 0];
      return { id: zone.id, name: zone.name, subText: '23 osoby', iconUrl: null, center };
    });

    const result = resolveOverlaps(raw, cityCamera.zoom, cityCamera.center, screenWidth, screenHeight, {
      top: insets.top + TOP_OVERLAY_HEIGHT,
      right: insets.right,
      bottom: insets.bottom + mapBottomChromePx,
      left: insets.left,
    });

    return { zoneMarkers: result.markers, debugOverlay: result.debug };
  }, [
    cityCamera,
    insets.bottom,
    insets.left,
    insets.right,
    insets.top,
    screenHeight,
    screenWidth,
    mapBottomChromePx,
    zones,
  ]);
}
