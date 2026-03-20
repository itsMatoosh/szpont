import { useMemo } from 'react';

import { getBoundingBox, getZoomForBoundingBox } from '@/components/map-view/map-view.util';
import { type MapZone } from '@/components/map-view/map-view.types';

/** Camera framing derived from the union bounding box of all zones. */
export interface CityCamera {
  center: [number, number];
  zoom: number;
}

/**
 * Computes city overview camera from all zone boundaries.
 * Returns `undefined` when no valid zone geometry exists.
 */
export function useCityCamera(zones: MapZone[]): CityCamera | undefined {
  return useMemo(() => {
    if (zones.length === 0) return undefined;

    let minLng = Infinity;
    let minLat = Infinity;
    let maxLng = -Infinity;
    let maxLat = -Infinity;

    for (const zone of zones) {
      const bbox = getBoundingBox(zone.boundary as GeoJSON.Geometry);
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
}
