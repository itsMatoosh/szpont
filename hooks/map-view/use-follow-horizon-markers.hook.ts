import { useMemo } from 'react';

import { type MapZone } from '@/components/map-view/map-view.types';
import { getBoundingBox } from '@/components/map-view/map-view.util';
import {
  haversineMeters,
  initialBearingDeg,
  normalizeDeg0To360,
  wrapDeg180,
} from '@/util/geo/geo.util';

/**
 * Relative bearing (deg) past ±this removes the zone — **after** x has extrapolated past the
 * screen so the chip can finish sliding off (see `HORIZON_MAP_SCALE_HALF_DEG`).
 */
export const HORIZON_CULL_HALF_DEG = 100;

/**
 * ±this bearing maps to screen x from `0` to `screenWidth` (effective horizon “FOV”). **Lower**
 * = narrower forward cone (side zones sit closer to the edges). Bearings between scale and cull
 * extrapolate x **past** the edges so centers keep moving until the chip leaves the viewport.
 */
export const HORIZON_MAP_SCALE_HALF_DEG = 25;

/** @alias `HORIZON_CULL_HALF_DEG` — outer limit before a zone is dropped. */
export const HORIZON_VISIBLE_HALF_DEG = HORIZON_CULL_HALF_DEG;

/** @alias `HORIZON_MAP_SCALE_HALF_DEG` — degrees mapped across full screen width. */
export const HORIZON_MAP_HALF_DEG = HORIZON_MAP_SCALE_HALF_DEG;

/** @deprecated Use `HORIZON_CULL_HALF_DEG` or `HORIZON_MAP_SCALE_HALF_DEG`. */
export const HORIZON_SHOW_HALF_DEG = HORIZON_CULL_HALF_DEG;

/**
 * Minimum horizontal distance between chip centers; below this, glass chips overlap on screen.
 * Approx. full chip width (icon + max text + chevron + padding).
 */
const HORIZON_CHIP_MIN_CENTER_SEP_PX = 180;

export interface FollowHorizonMarker {
  id: string;
  name: string;
  /** Distance from user to zone center in meters. */
  distanceM: number;
  /** Screen x of label center. */
  xPx: number;
  /** Relative bearing in (-180, 180] for debugging / tests. */
  relativeBearingDeg: number;
}

interface UseFollowHorizonMarkersParams {
  /** When false, returns an empty list (strip not mounted). */
  enabled: boolean;
  zones: MapZone[];
  userLat: number | undefined;
  userLng: number | undefined;
  /** Map camera bearing from Mapbox (`onCameraChanged`); if null, treated as 0 for layout. */
  cameraHeadingDeg: number | null;
  screenWidth: number;
}

/**
 * Computes screen positions for zone chips on the follow-user horizon: x is linear in bearing
 * with a **smaller** scale angle than the cull angle so chip centers move past the screen edges
 * before the zone is removed. When two chips overlap horizontally, only the **closest** zone is
 * kept (greedy by ascending `distanceM`).
 */
export function useFollowHorizonMarkers({
  enabled,
  zones,
  userLat,
  userLng,
  cameraHeadingDeg,
  screenWidth,
}: UseFollowHorizonMarkersParams): FollowHorizonMarker[] {
  return useMemo(() => {
    if (!enabled || userLat == null || userLng == null || screenWidth <= 0) return [];

    const cameraYaw = normalizeDeg0To360(cameraHeadingDeg ?? 0);

    const halfW = screenWidth / 2;

    const raw: FollowHorizonMarker[] = [];

    for (const zone of zones) {
      const bbox = getBoundingBox(zone.boundary as GeoJSON.Geometry);
      if (!bbox) continue;
      const centerLng = (bbox[0] + bbox[2]) / 2;
      const centerLat = (bbox[1] + bbox[3]) / 2;

      const bearingToZone = initialBearingDeg(userLat, userLng, centerLat, centerLng);
      const relativeBearing = wrapDeg180(bearingToZone - cameraYaw);

      if (Math.abs(relativeBearing) > HORIZON_CULL_HALF_DEG) continue;

      const distanceM = haversineMeters(userLat, userLng, centerLat, centerLng);
      const xPx =
        halfW +
        (relativeBearing / HORIZON_MAP_SCALE_HALF_DEG) * halfW;

      raw.push({
        id: zone.id,
        name: zone.name,
        distanceM,
        xPx,
        relativeBearingDeg: relativeBearing,
      });
    }

    // Prefer nearer zones when screen positions would overlap (same rule as "closest wins" pairwise).
    raw.sort((a, b) => {
      if (a.distanceM !== b.distanceM) return a.distanceM - b.distanceM;
      return a.id.localeCompare(b.id);
    });

    const accepted: FollowHorizonMarker[] = [];
    for (const m of raw) {
      const overlapsAccepted = accepted.some(
        (a) => Math.abs(m.xPx - a.xPx) < HORIZON_CHIP_MIN_CENTER_SEP_PX,
      );
      if (!overlapsAccepted) accepted.push(m);
    }

    accepted.sort((a, b) => a.xPx - b.xPx);
    return accepted;
  }, [enabled, zones, userLat, userLng, cameraHeadingDeg, screenWidth]);
}
