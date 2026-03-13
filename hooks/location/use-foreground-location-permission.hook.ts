import * as Location from 'expo-location';
import { useCallback } from 'react';
import { Linking } from 'react-native';

import { useLocationPermissionContext } from './location-permission.context';

/** Possible states of a location permission check. */
export type LocationPermissionStatus =
  | 'loading'
  | 'granted'
  | 'denied'
  | 'undetermined'
  | 'restricted';

/**
 * Provides foreground location permission status (from context) and actions
 * to request permission or open Settings. Does not track state itself —
 * relies on LocationPermissionProvider for the realtime status.
 */
export function useForegroundLocationPermission() {
  const { foregroundStatus: status, recheck } = useLocationPermissionContext();

  const request = useCallback(async () => {
    await Location.requestForegroundPermissionsAsync();
    await recheck();
  }, [recheck]);

  const openSettings = useCallback(() => {
    Linking.openSettings();
  }, []);

  return { status, request, openSettings };
}
