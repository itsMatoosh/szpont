import * as Location from 'expo-location';
import { useCallback } from 'react';
import { Alert, Linking } from 'react-native';

import { useLocationPermissionContext } from './location-permission.context';
import { type LocationPermissionStatus } from './use-foreground-location-permission.hook';
import { useTranslation } from 'react-i18next';

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
  const { t } = useTranslation();

  /** Requests foreground permission, then immediately requests background. */
  const request = useCallback(async () => {
    // Request foreground permission.
    const fg = await Location.requestForegroundPermissionsAsync();
    if (fg.status !== Location.PermissionStatus.GRANTED) {
      await recheck();
      return;
    }

    // Request background permission.
    await Location.requestBackgroundPermissionsAsync();
    await recheck();
  }, [recheck]);

  /** Shows an alert to open settings. */
  const openSettings = useCallback(() => {
    // show alert to open settings
    Alert.alert(t('backgroundLocationPermission.openSettings.title'), t('backgroundLocationPermission.openSettings.description'), [
      {
        text: t('permissionDialog.openSettings.button'),
        style: 'default',
        onPress: () => Linking.openSettings(),
      },
      {
        text: t('common.cancel'),
        style: 'cancel',
      },
    ]);
  }, [t]);

  return { status, request, openSettings };
}
