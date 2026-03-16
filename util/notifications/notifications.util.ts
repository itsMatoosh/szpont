import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// ── Android channel ─────────────────────────────────────────────────────────────

const ZONE_CHANNEL_ID = 'zone-alerts';

/**
 * Sets the default notification handler so notifications are displayed even
 * when the app is in the foreground, and creates the Android notification
 * channel for zone alerts.
 */
export async function configureNotifications(): Promise<void> {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(ZONE_CHANNEL_ID, {
      name: 'Zone Alerts',
      importance: Notifications.AndroidImportance.HIGH,
    });
  }
}

// ── Permission ──────────────────────────────────────────────────────────────────

/**
 * Requests notification permission from the user.
 * Returns `true` if granted, `false` otherwise.
 */
export async function requestNotificationPermissions(): Promise<boolean> {
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;

  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}
