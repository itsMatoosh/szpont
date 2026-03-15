import { useEffect, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';

import {
  getActiveZoneIdSnapshot,
  refreshActiveZone,
  subscribeActiveZone,
} from '@/util/geofencing/geofencing.util';

/**
 * Returns the zone ID the user is physically inside (via OS geofencing),
 * or `null` when outside all zones. Reacts instantly to foreground geofence
 * events and re-syncs when the app returns from background.
 */
export function useActiveZoneId(): string | null {
  // Re-read localStorage when the app comes to the foreground in case
  // geofence events fired while the JS context was suspended.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') refreshActiveZone();
    });
    return () => sub.remove();
  }, []);

  return useSyncExternalStore(subscribeActiveZone, getActiveZoneIdSnapshot);
}
