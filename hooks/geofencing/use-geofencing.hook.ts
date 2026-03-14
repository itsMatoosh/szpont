import * as Location from 'expo-location';
import { useEffect, useRef } from 'react';

import { getGeofencesByCity } from '@/util/geofences/geofences.util';
import {
  clearGeofencingState,
  GEOFENCE_TASK,
  LOCATION_TASK,
  setCachedBoundaries,
} from '@/util/geofencing/geofencing.util';
import { exitZone } from '@/util/presence/presence.util';

/**
 * Initialises background geofence monitoring for the given city.
 *
 * - Fetches all circular geofences (and their zone boundaries) for the city
 * - Caches zone boundaries in localStorage for offline point-in-polygon checks
 * - Registers the geofences with `expo-location` so the OS delivers
 *   enter/exit events even when the app is killed
 * - Re-registers when the city changes (user travels)
 *
 * Should be rendered once in the root layout when the user is authenticated
 * and has background location permission.
 */
export function useGeofencing(cityId: string | undefined): void {
  const prevCityRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!cityId) return;

    // Same city — nothing to do
    if (prevCityRef.current === cityId) return;
    prevCityRef.current = cityId;

    let cancelled = false;

    async function register() {
      // Tear down any existing geofencing session
      await teardown();

      if (cancelled) return;

      const geofences = await getGeofencesByCity(cityId!);
      if (cancelled || geofences.length === 0) return;

      // Build boundary cache keyed by zone_id
      const boundaries: Record<string, unknown> = {};
      for (const gf of geofences) {
        boundaries[gf.zone_id] = gf.boundary;
      }
      setCachedBoundaries(boundaries);

      // Build expo-location geofence regions
      const regions: Location.LocationRegion[] = geofences.map((gf) => ({
        // Encode both zone and geofence id so the task knows which zone fired
        identifier: `${gf.zone_id}:${gf.id}`,
        latitude: gf.latitude,
        longitude: gf.longitude,
        radius: gf.radius,
        notifyOnEnter: true,
        notifyOnExit: true,
      }));

      await Location.startGeofencingAsync(GEOFENCE_TASK, regions);
    }

    register().catch((e) =>
      console.warn('[useGeofencing] registration failed:', e),
    );

    return () => {
      cancelled = true;
    };
  }, [cityId]);
}

// ── Teardown ───────────────────────────────────────────────────────────────────

/**
 * Stops all geofencing and location tracking, exits any active presence,
 * and clears persisted state.
 */
async function teardown(): Promise<void> {
  const isGeofencing = await Location.hasStartedGeofencingAsync(GEOFENCE_TASK).catch(() => false);
  if (isGeofencing) {
    await Location.stopGeofencingAsync(GEOFENCE_TASK);
  }

  const isTracking = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK).catch(() => false);
  if (isTracking) {
    await Location.stopLocationUpdatesAsync(LOCATION_TASK);
  }

  try {
    await exitZone();
  } catch {
    // No active presence or network error — safe to ignore
  }

  clearGeofencingState();
}
