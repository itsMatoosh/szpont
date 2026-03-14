import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import i18n from '@/util/i18n/i18n.util';

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
      shouldPlaySound: false,
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

// ── Local notifications ─────────────────────────────────────────────────────────

/**
 * Shows an immediate local notification informing the user they entered a zone.
 * Uses i18n directly so it works from background tasks without React context.
 */
export async function showZoneEntryNotification(
  zoneName: string,
): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: i18n.t('notifications.zoneEntryTitle', { zoneName }),
      body: i18n.t('notifications.zoneEntryBody'),
    },
    trigger: null,
  });
}

/**
 * Shows an immediate local notification informing the user they left a zone.
 * Uses i18n directly so it works from background tasks without React context.
 */
export async function showZoneExitNotification(
  zoneName: string,
): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: i18n.t('notifications.zoneExitTitle', { zoneName }),
      body: i18n.t('notifications.zoneExitBody'),
    },
    trigger: null,
  });
}
