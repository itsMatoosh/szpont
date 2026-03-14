import * as Location from 'expo-location';
import { createContext, ReactNode, useContext, useEffect, useState } from 'react';

import { useLocationPermissionContext } from './location-permission.context';

interface CurrentLocationContextValue {
  location: Location.LocationObject | null;
}

const CurrentLocationContext = createContext<CurrentLocationContextValue | null>(null);

/** How often the fallback poll fetches the current position (ms). */
const POLL_INTERVAL_MS = 10_000;

/**
 * Watches the device location when foreground permission is granted.
 * Uses a distance-based watcher for responsive updates plus a periodic
 * poll to catch simulated / static location changes the watcher misses.
 * When permission is revoked or not yet granted, tears down everything
 * and resets location to null.
 */
export function CurrentLocationProvider({ children }: { children: ReactNode }) {
  const { foregroundStatus } = useLocationPermissionContext();
  const [location, setLocation] = useState<Location.LocationObject | null>(null);

  useEffect(() => {
    if (foregroundStatus !== 'granted') {
      setLocation(null);
      return;
    }

    let removed = false;
    let subscription: Location.LocationSubscription | undefined;

    // Primary: distance-based watcher for responsive real-device updates.
    Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.Balanced,
        distanceInterval: 50,
      },
      (loc) => {
        if (!removed) setLocation(loc);
      },
    ).then((sub) => {
      if (removed) {
        sub.remove();
      } else {
        subscription = sub;
      }
    });

    // Fallback: periodic poll catches simulated location changes and
    // edge cases where the distance filter silently swallows an update.
    const interval = setInterval(async () => {
      if (removed) return;
      try {
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (!removed) setLocation(loc);
      } catch {
        // Silently ignore — watcher is the primary source.
      }
    }, POLL_INTERVAL_MS);

    return () => {
      removed = true;
      subscription?.remove();
      clearInterval(interval);
    };
  }, [foregroundStatus]);

  return (
    <CurrentLocationContext.Provider value={{ location }}>
      {children}
    </CurrentLocationContext.Provider>
  );
}

/** Reads the current device location. Must be used within a CurrentLocationProvider. */
export function useCurrentLocation(): CurrentLocationContextValue {
  const ctx = useContext(CurrentLocationContext);
  if (!ctx) {
    throw new Error('useCurrentLocation must be used within a CurrentLocationProvider');
  }
  return ctx;
}
