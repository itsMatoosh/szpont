/**
 * Listens for APNs push-to-start tokens emitted by the expo-widgets module
 * and persists them on the device's row in the `devices` table.
 *
 * iOS only — the token is used by the `start-live-activity` Edge Function
 * to remotely start a Live Activity when the user enters a zone.
 */

import { addPushToStartTokenListener } from 'expo-widgets';

import { getDeviceId } from '@/util/device/device.util';
import { supabase } from '@/util/supabase/supabase.util';

/**
 * Subscribes to push-to-start token updates and stores each token on the
 * current device's row via the `update_zone_live_activity_token` RPC.
 *
 * Returns a cleanup function that removes the listener.
 */
export function listenForPushToStartToken(): () => void {
  const subscription = addPushToStartTokenListener((event) => {
    // Get the device ID from localStorage
    const deviceId = getDeviceId();
    if (!deviceId) {
      console.warn('[PushToStart] no device ID found');
      return;
    }

    console.log('[PushToStart] Updating zone live activity token:', event.activityPushToStartToken);
    supabase
      .rpc('update_zone_live_activity_token', {
        p_device_id: deviceId,
        p_token: event.activityPushToStartToken,
      })
      .then(({ error }) => {
        if (error) {
          console.warn('[PushToStart] failed to update token:', error);
        }
      });
  });

  return () => subscription.remove();
}
