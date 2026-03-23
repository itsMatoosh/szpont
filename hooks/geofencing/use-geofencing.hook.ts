import * as Location from 'expo-location';
import { useEffect, useRef } from 'react';

import { getBackgroundSecret } from '@/util/device/device.util';
import { getGeofencesByCity } from '@/util/geofences/geofences.util';
import {
  clearGeofencingState,
  GEOFENCE_TASK,
} from '@/util/geofencing/geofencing.util';
import { exitZone } from '@/util/presence/presence.util';

/**
 * Initialises background geofence monitoring for the given city.
 *
 * - Fetches all circular geofences for the city's zones
 * - Caches zone names in localStorage for background notification copy
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
 * Stops geofence monitoring, exits any active presence,
 * and clears persisted state.
 */
async function teardown(): Promise<void> {
  const isGeofencing = await Location.hasStartedGeofencingAsync(GEOFENCE_TASK).catch(() => false);
  if (isGeofencing) {
    await Location.stopGeofencingAsync(GEOFENCE_TASK);
  }

  try {
    const secret = getBackgroundSecret();
    if (secret) await exitZone(secret);
  } catch {
    // No active presence or network error — safe to ignore
  }

  clearGeofencingState();
}
