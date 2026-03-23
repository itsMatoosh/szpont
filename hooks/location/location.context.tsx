import * as Location from 'expo-location';
import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';

import { useLocationPermissionContext } from './location-permission.context';

interface LocationContextValue {
  location: Location.LocationObject | null;
}

const LocationContext = createContext<LocationContextValue | null>(null);

/**
 * Watches the device location when foreground permission is granted.
 * Uses a distance-based watcher for responsive updates.
 * When permission is revoked or not yet granted, it tears down the watcher
 * and resets location to null.
 */
export function LocationProvider({ children }: { children: ReactNode }) {
  const { foregroundStatus } = useLocationPermissionContext();
  const [location, setLocation] = useState<Location.LocationObject | null>(null);

  useEffect(() => {
    // If the foreground permission is not granted, set the location to null.
    if (foregroundStatus !== 'granted') {
      setLocation(null);
      return;
    }

    // Watch the device location when the foreground permission is granted.
    let isCancelled = false;
    let subscription: Location.LocationSubscription | null = null;

    const startWatching = async () => {
      try {
        subscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Balanced,
            distanceInterval: 50,
          },
          (nextLocation) => {
            if (!isCancelled) {
              setLocation(nextLocation);
            }
          },
        );
      } catch {
        // Keep provider stable if the watcher fails to initialize.
        if (!isCancelled) {
          setLocation(null);
        }
      }
    };
    startWatching();

    return () => {
      isCancelled = true;
      subscription?.remove();
    };
  }, [foregroundStatus]);

  return (
    <LocationContext.Provider value={{ location }}>
      {children}
    </LocationContext.Provider>
  );
}

/** Reads the current device location. Must be used within a LocationProvider. */
export function useLocation(): LocationContextValue {
  const ctx = useContext(LocationContext);
  if (!ctx) {
    throw new Error('useLocation must be used within a LocationProvider');
  }
  return ctx;
}
