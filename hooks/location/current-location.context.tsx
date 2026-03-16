import * as Location from 'expo-location';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { useLocationPermissionContext } from './location-permission.context';

interface CurrentLocationContextValue {
  location: Location.LocationObject | null;
}

const CurrentLocationContext = createContext<CurrentLocationContextValue | null>(null);

/** How often the fallback poll fetches the current position (ms). */
const POLL_INTERVAL_MS = 10_000;

/**
 * Decimal places used to compare incoming coordinates against the current
 * state. 4 decimals ≈ 11 m — enough to suppress jitter while still
 * detecting meaningful movement.
 */
const COORD_COMPARE_PRECISION = 4;

/** Rounds a number to `COORD_COMPARE_PRECISION` decimals for comparison. */
function roundCoord(n: number): number {
  const f = 10 ** COORD_COMPARE_PRECISION;
  return Math.round(n * f) / f;
}

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

  // Ref tracks the last committed coordinates so the effect callbacks
  // (which capture a stale closure) can compare without re-subscribing.
  const lastCoordsRef = useRef<{ lat: number; lng: number } | null>(null);

  /**
   * Only commits a new location to state when the rounded coordinates
   * differ from the previous value, preventing re-renders from GPS noise
   * or polls that return the same position.
   */
  const commitLocation = useCallback((loc: Location.LocationObject) => {
    const lat = roundCoord(loc.coords.latitude);
    const lng = roundCoord(loc.coords.longitude);
    const prev = lastCoordsRef.current;
    if (prev && prev.lat === lat && prev.lng === lng) return;
    lastCoordsRef.current = { lat, lng };
    setLocation(loc);
  }, []);

  useEffect(() => {
    if (foregroundStatus !== 'granted') {
      lastCoordsRef.current = null;
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
        if (!removed) commitLocation(loc);
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
        if (!removed) commitLocation(loc);
      } catch {
        // Silently ignore — watcher is the primary source.
      }
    }, POLL_INTERVAL_MS);

    return () => {
      removed = true;
      subscription?.remove();
      clearInterval(interval);
    };
  }, [foregroundStatus, commitLocation]);

  /** Stable reference — only changes when `location` state actually changes. */
  const value = useMemo(() => ({ location }), [location]);

  return (
    <CurrentLocationContext.Provider value={value}>
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
