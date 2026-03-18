import { useEffect, useState } from 'react';

import { useNearestCity } from '@/hooks/cities/use-nearest-city.hook';
import { useGeofencing } from '@/hooks/geofencing/use-geofencing.hook';
import { useLocationPermissionContext } from '@/hooks/location/location-permission.context';
import { getBackgroundLocationAdapter } from '@/util/background-location/background-location.adapter';

/**
 * Configures the background location adapter and starts geofence monitoring
 * once both the `backgroundSecret` is available (device registered) and
 * background location permission is granted.
 *
 * Returns `true` once the applicable setup has completed.
 * When `backgroundSecret` is null the hook is a no-op and returns `true`
 * immediately.
 *
 * The adapter is readied but NOT started — the GEOFENCE_TASK starts/stops
 * tracking when a zone is entered/exited.
 */
export function useGeofencingSetup(backgroundSecret: string | null): boolean {
  const [isReady, setIsReady] = useState(!backgroundSecret);
  const { backgroundStatus } = useLocationPermissionContext();
  const { city } = useNearestCity();

  // Ready the BG location adapter once we have both a secret and permission
  useEffect(() => {
    if (!backgroundSecret) {
      setIsReady(true);
      return;
    }

    if (backgroundStatus !== 'granted') {
      setIsReady(true);
      return;
    }

    const adapter = getBackgroundLocationAdapter();
    adapter
      .ready({
        url: process.env.EXPO_PUBLIC_SUPABASE_URL + '/functions/v1/location-update',
        headers: { 'X-Device-Token': backgroundSecret },
        extras: {},
        desiredAccuracy: 'high',
        distanceFilter: 10,
        stopOnTerminate: false,
      })
      .then(() => setIsReady(true))
      .catch((e) => {
        console.warn('[useGeofencingSetup] adapter ready failed:', e);
        setIsReady(true);
      });
  }, [backgroundSecret, backgroundStatus]);

  // Start geofence monitoring when permission + city are resolved
  useGeofencing(backgroundStatus === 'granted' ? city?.id : undefined);

  return isReady;
}
