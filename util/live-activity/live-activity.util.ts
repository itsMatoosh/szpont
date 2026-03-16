/**
 * Manages the iOS Live Activity lifecycle for zone presence.
 *
 * Starting is handled server-side via APNs push-to-start (triggered by a
 * Postgres trigger on the `presence` table). This module only provides the
 * local `end` helper that the background geofence task calls on zone exit.
 * On non-iOS platforms the function is a no-op.
 */

import { Platform } from 'react-native';

import ZoneActivity from '@/widgets/zone-activity/zone-activity.widget';

/**
 * Ends the currently running zone Live Activity (if any) and cleans up
 * any stale instances.
 */
export async function endZoneLiveActivity(): Promise<void> {
  if (Platform.OS !== 'ios') return;

  try {
    const remaining = ZoneActivity.getInstances();
    for (const inst of remaining) {
      await inst.end('immediate');
    }
  } catch (e) {
    console.warn('[LiveActivity] failed to end:', e);
  }
}
