import { useMemo } from 'react';

import { type MapZone } from '@/components/map-view/map-view.types';

interface UseZoneBoundariesResult {
  allZonesOutlineFeatureCollection: GeoJSON.FeatureCollection;
}

/** Builds GeoJSON for all zone boundaries (`zoneId` on each feature) for map fill/outline layers. */
export function useZoneBoundaries(zones: MapZone[]): UseZoneBoundariesResult {
  const allZonesOutlineFeatureCollection = useMemo<GeoJSON.FeatureCollection>(() => {
    return {
      type: 'FeatureCollection',
      features: zones.map((zone) => ({
        type: 'Feature' as const,
        geometry: zone.boundary as GeoJSON.Geometry,
        properties: { zoneId: zone.id },
      })),
    };
  }, [zones]);

  return {
    allZonesOutlineFeatureCollection,
  };
}
