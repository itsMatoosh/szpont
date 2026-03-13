import * as Location from 'expo-location';
import { useCallback } from 'react';
import { Linking } from 'react-native';

import { useLocationPermissionContext } from './location-permission.context';
import { type LocationPermissionStatus } from './use-foreground-location-permission.hook';

/**
 * Resolves the combined status from foreground + background permission.
 * Only returns 'granted' when both levels are granted.
 */
function resolveStatus(
  fg: LocationPermissionStatus,
  bg: LocationPermissionStatus,
): LocationPermissionStatus {
  if (fg !== 'granted') return fg;
  return bg;
}

/**
 * Provides combined foreground + background location permission status (from
 * context) and actions to request both permissions in one go or open Settings.
 * Does not track state itself — relies on LocationPermissionProvider.
 */
export function useBackgroundLocationPermission() {
  const { foregroundStatus, backgroundStatus, recheck } = useLocationPermissionContext();
  const status = resolveStatus(foregroundStatus, backgroundStatus);

  /** Requests foreground permission, then immediately requests background. */
  const request = useCallback(async () => {
    const fg = await Location.requestForegroundPermissionsAsync();
    if (fg.status !== Location.PermissionStatus.GRANTED) {
      await recheck();
      return;
    }

    await Location.requestBackgroundPermissionsAsync();
    await recheck();
  }, [recheck]);

  const openSettings = useCallback(() => {
    Linking.openSettings();
  }, []);

  return { status, request, openSettings };
}
