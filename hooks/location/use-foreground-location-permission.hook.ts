import * as Location from 'expo-location';
import { useCallback } from 'react';
import { Alert, Linking } from 'react-native';

import { useLocationPermissionContext } from './location-permission.context';
import { useTranslation } from 'react-i18next';

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
  const { t } = useTranslation();

  const request = useCallback(async () => {
    await Location.requestForegroundPermissionsAsync();
    await recheck();
  }, [recheck]);

  const openSettings = useCallback(() => {
    // show alert to open settings
    Alert.alert(t('foregroundLocationPermission.openSettings.title'), t('foregroundLocationPermission.openSettings.description'), [
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
  }, []);

  return { status, request, openSettings };
}
