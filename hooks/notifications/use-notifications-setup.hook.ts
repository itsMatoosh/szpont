import 'expo-sqlite/localStorage/install';

import * as Notifications from 'expo-notifications';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

import { useNotificationPermissionContext } from '@/hooks/notifications/notification-permission.context';
import i18n from '@/util/i18n/i18n.util';
import { listenForPushToStartToken } from '@/util/live-activity/push-to-start-token.util';
import { configureNotifications } from '@/util/notifications/notifications.util';
import { supabase } from '@/util/supabase/supabase.util';

const PUSH_TOKEN_KEY = 'expoPushToken';

/**
 * Orchestrates notification setup in two phases and reports readiness:
 *
 * 1. **Unconditional** (mount): configures handlers so foreground
 *    notifications display correctly.
 * 2. **Gated on `deviceId` + notification permission**: fetches the
 *    current Expo push token, syncs it to the server if it changed,
 *    and subscribes to token rotation and (iOS) Live Activity
 *    push-to-start token updates.
 *
 * Returns `true` once all applicable setup has completed.
 * When `deviceId` is null the hook is a no-op and returns `true` immediately.
 *
 * Does NOT request permissions — that belongs in the UI layer
 * (onboarding / settings) which calls `requestNotificationPermissions()`
 * and then `recheck()` on the context.
 */
export function useNotificationsSetup(deviceId: string | null): boolean {
  const [configured, setConfigured] = useState(false);
  const [isReady, setIsReady] = useState(!deviceId);
  const { status: notificationStatus } = useNotificationPermissionContext();

  // Phase 1: configure notification handlers (safe without deviceId)
  useEffect(() => {
    configureNotifications();
    setConfigured(true);
  }, []);

  // Phase 2: sync push token + set up listeners once device is registered
  // and notification permission is granted
  useEffect(() => {
    // Skip if no device ID
    if (!deviceId) {
      setIsReady(true);
      return;
    }

    // Skip if no permission
    if (notificationStatus !== 'granted') {
      if (configured) setIsReady(true);
      return;
    }

    let cancelled = false;

    // Fetch the current token and sync it if it differs from the cache
    (async () => {
      try {
        // APNs registration can hang on simulators or misconfigured builds,
        // so we race against a timeout to avoid blocking the app indefinitely.
        const tokenResult = await Promise.race([
          Notifications.getExpoPushTokenAsync({
            projectId: '87534a4a-d0cd-4aa4-b261-0bd2d7392486',
          }),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000)),
        ]);
        if (cancelled || !tokenResult) return;
        const token = tokenResult.data;

        // Compare to the cached token
        const cached = localStorage.getItem(PUSH_TOKEN_KEY);
        if (token === cached) return;

        // Cache the new token
        localStorage.setItem(PUSH_TOKEN_KEY, token);

        // Sync the new token to the server
        const { error } = await supabase.rpc('register_device', {
          p_platform: Platform.OS,
          p_locale: i18n.language,
          p_device_id: deviceId ?? undefined,
          p_expo_push_token: token,
          p_is_sandbox: __DEV__,
        });

        if (error) console.warn('[useNotificationsSetup] failed to sync push token:', error);
      } catch (e) {
        console.warn('[useNotificationsSetup] syncCurrentToken error:', e);
      } finally {
        if (!cancelled) setIsReady(true);
      }
    })();

    // Listen for future token rotations
    const tokenSub = Notifications.addPushTokenListener(({ data: newToken }) => {
      // Cache the new token
      localStorage.setItem(PUSH_TOKEN_KEY, newToken);

      // Sync the new token to the server
      supabase
        .rpc('register_device', {
          p_platform: Platform.OS,
          p_locale: i18n.language,
          p_device_id: deviceId ?? undefined,
          p_expo_push_token: newToken,
          p_is_sandbox: __DEV__,
        })
        .then(({ error }) => {
          if (error) console.warn('[useNotificationsSetup] failed to update push token:', error);
        });
    });

    // iOS: listen for Live Activity push-to-start tokens
    const pushToStartCleanup = Platform.OS === 'ios' ? listenForPushToStartToken() : undefined;

    return () => {
      cancelled = true;
      tokenSub.remove();
      pushToStartCleanup?.();
    };
  }, [deviceId, notificationStatus, configured]);

  return isReady;
}
