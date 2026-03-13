import * as Location from 'expo-location';
import { createContext, ReactNode, useContext, useEffect, useState } from 'react';

import { useLocationPermissionContext } from './location-permission.context';

interface CurrentLocationContextValue {
  location: Location.LocationObject | null;
}

const CurrentLocationContext = createContext<CurrentLocationContextValue | null>(null);

/**
 * Watches the device location when foreground permission is granted.
 * When permission is revoked or not yet granted, tears down the watcher
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
        // Effect was cleaned up before the subscription resolved
        sub.remove();
      } else {
        subscription = sub;
      }
    });

    return () => {
      removed = true;
      subscription?.remove();
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
