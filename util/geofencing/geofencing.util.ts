/**
 * Background geofencing task for zone presence management.
 *
 * Defines a single `expo-task-manager` task that runs even when the app
 * is backgrounded or killed:
 *
 * **GEOFENCE_TASK** – receives circular geofence enter/exit events from the
 * OS. Each zone may have multiple overlapping geofences that approximate
 * its polygon boundary. The task tracks which individual geofences are
 * active and manages zone presence accordingly:
 *
 * - Enter: first geofence for a zone → `enterZone` (Live Activity started
 *   server-side via a Postgres trigger on the `presence` table)
 * - Exit: last geofence for a zone → `exitZone` + local Live Activity end
 *
 * **Important:** `TaskManager.defineTask` calls MUST live at module scope —
 * they are executed once when the JS bundle loads, which happens both in the
 * foreground AND when the OS wakes the app for a background event.
 */

import 'expo-sqlite/localStorage/install';

import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';

import { getBackgroundLocationAdapter } from '@/util/background-location/background-location.adapter';
import { getBackgroundSecret } from '@/util/device/device.util';
import { endZoneLiveActivity } from '@/util/live-activity/live-activity.util';
import { enterZone, exitZone } from '@/util/presence/presence.util';

// ── Task names ─────────────────────────────────────────────────────────────────

export const GEOFENCE_TASK = 'szpont-geofence-task';

// ── localStorage keys for persisted state ──────────────────────────────────────

const ACTIVE_GEOFENCES_KEY = 'geofencing:activeGeofences';
const ZONE_NAMES_KEY = 'geofencing:zoneNames';

// ── Helpers for persisted state ────────────────────────────────────────────────

/**
 * Active geofences are stored as a JSON object mapping geofenceId → zoneId.
 * This lets us track which individual circles are active and derive which
 * zones still have at least one active geofence.
 */
function getActiveGeofences(): Record<string, string> {
  try {
    const raw = localStorage.getItem(ACTIVE_GEOFENCES_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/** Persists the active geofence map. */
function setActiveGeofences(map: Record<string, string>): void {
  localStorage.setItem(ACTIVE_GEOFENCES_KEY, JSON.stringify(map));
}

/**
 * Zone names are cached so background tasks can include the human-readable
 * name in the Live Activity without a network call.
 */
function getCachedZoneNames(): Record<string, string> {
  try {
    const raw = localStorage.getItem(ZONE_NAMES_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/** Persists a zoneId → name map so background tasks can display zone names. */
export function setCachedZoneNames(names: Record<string, string>): void {
  localStorage.setItem(ZONE_NAMES_KEY, JSON.stringify(names));
}

/** Removes all persisted geofencing state (used on city change / cleanup). */
export function clearGeofencingState(): void {
  localStorage.removeItem(ACTIVE_GEOFENCES_KEY);
  localStorage.removeItem(ZONE_NAMES_KEY);
  refreshActiveZone();
}

/** Returns true if any active geofence belongs to the given zone. */
function hasActiveGeofenceForZone(
  activeGeofences: Record<string, string>,
  zoneId: string,
): boolean {
  return Object.values(activeGeofences).includes(zoneId);
}

// ── Active-zone external store ─────────────────────────────────────────────────
// Lets React subscribe (via useSyncExternalStore) to the zone the user is
// physically inside, without polling.

/** Derives the single active zone ID from the geofence→zone map, or null. */
function readActiveZoneIdFromStorage(): string | null {
  const map = getActiveGeofences();
  const zoneIds = [...new Set(Object.values(map))];
  return zoneIds[0] ?? null;
}

let _cachedActiveZoneId: string | null = readActiveZoneIdFromStorage();
const _listeners = new Set<() => void>();

/**
 * Re-reads localStorage and notifies subscribers if the active zone changed.
 * Called internally after every geofence event and exported so the AppState
 * foreground handler can force a refresh.
 */
export function refreshActiveZone(): void {
  const next = readActiveZoneIdFromStorage();
  if (next === _cachedActiveZoneId) return;
  _cachedActiveZoneId = next;
  for (const fn of _listeners) fn();
}

/** `useSyncExternalStore` subscribe callback. */
export function subscribeActiveZone(onStoreChange: () => void): () => void {
  _listeners.add(onStoreChange);
  return () => { _listeners.delete(onStoreChange); };
}

/** `useSyncExternalStore` getSnapshot callback. */
export function getActiveZoneIdSnapshot(): string | null {
  return _cachedActiveZoneId;
}

// ── GEOFENCE_TASK ──────────────────────────────────────────────────────────────

TaskManager.defineTask(GEOFENCE_TASK, async ({ data, error }) => {
  if (error) {
    console.warn('[GeofenceTask] error:', error.message);
    return;
  }

  const { eventType, region } = data as {
    eventType: Location.GeofencingEventType;
    region: Location.LocationRegion;
  };

  // Region identifiers are formatted as "zoneId:geofenceId" by the hook
  const parts = region.identifier?.split(':');
  if (!parts || parts.length < 2) return;
  const [zoneId, geofenceId] = parts;

  const active = getActiveGeofences();
  const names = getCachedZoneNames();

  if (eventType === Location.GeofencingEventType.Enter) {
    const wasInZone = hasActiveGeofenceForZone(active, zoneId);

    active[geofenceId] = zoneId;
    setActiveGeofences(active);

    try {
      const secret = getBackgroundSecret();
      if (!secret) {
        console.warn('[GeofenceTask] no background secret — skipping enter');
        return;
      }

      // Mark the user as being in the zone (triggers server-side Live
      // Activity start via the pg_net trigger on the presence table)
      await enterZone(zoneId, secret);

      // Only start BG location on the first geofence entry for this zone
      if (!wasInZone) {
        const adapter = getBackgroundLocationAdapter();
        await adapter.setConfig({
          extras: { zone_id: zoneId },
          headers: { 'X-Device-Token': secret },
        });
        await adapter.start();
      }
    } catch (e) {
      console.warn('[GeofenceTask] failed to enter zone:', e);
    }

    refreshActiveZone();
  } else if (eventType === Location.GeofencingEventType.Exit) {
    delete active[geofenceId];
    setActiveGeofences(active);

    // Only exit the zone when ALL geofences for it have been exited
    const stillInZone = hasActiveGeofenceForZone(active, zoneId);

    if (!stillInZone) {
      try {
        // Stop background location tracking — no longer in any zone
        await getBackgroundLocationAdapter().stop();

        // Mark the user as being outside the zone
        const secret = getBackgroundSecret();
        if (!secret) {
          console.warn('[GeofenceTask] no background secret — skipping exit');
          return;
        }
        await exitZone(secret);

        // End the Live Activity
        await endZoneLiveActivity();
      } catch (e) {
        console.warn('[GeofenceTask] failed to exit zone:', e);
      }
    }

    refreshActiveZone();
  }
});
