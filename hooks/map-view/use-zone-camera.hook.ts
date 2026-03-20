import { useMemo } from 'react';

import { getBoundingBox, getOrientedEnvelope, getZoomForBoundingBox } from '@/components/map-view/map-view.util';
import { type MapZone } from '@/components/map-view/map-view.types';

/** Minimum zoom when viewing a zone — Mapbox tiles lack smaller buildings below ~15. */
const MIN_ZONE_ZOOM = 15;
/** OMBR aspect ratio above which the orbit also slides along the major axis. */
const SLIDE_ASPECT_THRESHOLD = 1.8;
/** Fraction of the OMBR major-axis half-length used for each slide endpoint (0 = center, 1 = edge). */
const SLIDE_INSET = 0.6;
/** Pitch angle when viewing a zone up close (orbit and zone entry). */
const ZONE_PITCH = 45;

/** Zone-focused camera target including optional slide endpoints for elongated zones. */
export interface ZoneCamera {
  center: [number, number];
  zoom: number;
  slideEndpoints: { start: [number, number]; end: [number, number] } | null;
}

/** Computes focused-zone camera target used by imperative zone fly + orbit logic. */
export function useZoneCamera(activeZone: MapZone | undefined): ZoneCamera | undefined {
  return useMemo(() => {
    if (!activeZone) return undefined;
    const geometry = activeZone.boundary as GeoJSON.Geometry;

    const envelope = getOrientedEnvelope(geometry);
    if (!envelope) return undefined;

    const bbox = getBoundingBox(geometry);
    if (!bbox) return undefined;

    const { center, majorStart, majorEnd, aspect } = envelope;
    const zoom = Math.max(getZoomForBoundingBox(bbox, ZONE_PITCH), MIN_ZONE_ZOOM);

    let slideEndpoints: { start: [number, number]; end: [number, number] } | null = null;

    if (aspect >= SLIDE_ASPECT_THRESHOLD) {
      // Inset from the full major-axis endpoints toward center.
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
}
