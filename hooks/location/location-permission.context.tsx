import * as Location from 'expo-location';
import { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { type LocationPermissionStatus } from './use-foreground-location-permission.hook';

interface LocationPermissionContextValue {
  foregroundStatus: LocationPermissionStatus;
  backgroundStatus: LocationPermissionStatus;
  /** Re-checks both permission levels. Call after requesting permissions. */
  recheck: () => Promise<void>;
}

/** Preloaded permission snapshot passed into the provider to avoid a loading flash. */
export interface LocationPermissionSnapshot {
  foregroundStatus: LocationPermissionStatus;
  backgroundStatus: LocationPermissionStatus;
}

const LocationPermissionContext = createContext<LocationPermissionContextValue | null>(null);

/** Maps the expo-location status to our simplified union. */
function mapStatus(status: Location.PermissionStatus, canAskAgain: boolean): LocationPermissionStatus {
  switch (status) {
    case Location.PermissionStatus.GRANTED:
      return 'granted';
    case Location.PermissionStatus.UNDETERMINED:
      return 'undetermined';
    case Location.PermissionStatus.DENIED:
      return canAskAgain ? 'undetermined' : 'denied';
    default:
      return 'restricted';
  }
}

/**
 * Fetches the current foreground and background permission status.
 * Call during app startup and pass the result as `initialSnapshot` to the provider
 * so it can render immediately without a loading state.
 */
export async function preloadLocationPermissions(): Promise<LocationPermissionSnapshot> {
  const fg = await Location.getForegroundPermissionsAsync();
  const fgMapped = mapStatus(fg.status, fg.canAskAgain);

  if (fgMapped !== 'granted') {
    return { foregroundStatus: fgMapped, backgroundStatus: 'loading' };
  }

  const bg = await Location.getBackgroundPermissionsAsync();
  return { foregroundStatus: fgMapped, backgroundStatus: mapStatus(bg.status, bg.canAskAgain) };
}

interface LocationPermissionProviderProps {
  initialSnapshot: LocationPermissionSnapshot;
  children: ReactNode;
}

/**
 * Passively tracks foreground and background location permission status.
 * Accepts a preloaded snapshot so the initial render has real values.
 * Re-checks automatically when the app returns from the background.
 * Does NOT request permissions — that responsibility belongs to the hooks.
 */
export function LocationPermissionProvider({ initialSnapshot, children }: LocationPermissionProviderProps) {
  const [foregroundStatus, setForegroundStatus] = useState(initialSnapshot.foregroundStatus);
  const [backgroundStatus, setBackgroundStatus] = useState(initialSnapshot.backgroundStatus);
  const appStateRef = useRef(AppState.currentState);

  const recheck = useCallback(async () => {
    const fg = await Location.getForegroundPermissionsAsync();
    const fgMapped = mapStatus(fg.status, fg.canAskAgain);
    setForegroundStatus(fgMapped);

    if (fgMapped !== 'granted') {
      // Background is irrelevant when foreground isn't granted
      setBackgroundStatus('loading');
      return;
    }

    const bg = await Location.getBackgroundPermissionsAsync();
    setBackgroundStatus(mapStatus(bg.status, bg.canAskAgain));
  }, []);

  // Re-check when returning from background (user may have toggled in Settings)
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (appStateRef.current.match(/inactive|background/) && nextState === 'active') {
        recheck();
      }
      appStateRef.current = nextState;
    });
    return () => subscription.remove();
  }, [recheck]);

  return (
    <LocationPermissionContext.Provider value={{ foregroundStatus, backgroundStatus, recheck }}>
      {children}
    </LocationPermissionContext.Provider>
  );
}

/** Reads the location permission context. Must be used within a LocationPermissionProvider. */
export function useLocationPermissionContext(): LocationPermissionContextValue {
  const ctx = useContext(LocationPermissionContext);
  if (!ctx) {
    throw new Error('useLocationPermissionContext must be used within a LocationPermissionProvider');
  }
  return ctx;
}
