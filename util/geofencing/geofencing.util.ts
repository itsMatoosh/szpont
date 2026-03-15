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
 * - Enter: first geofence for a zone → `enterZone` + notification
 * - Exit: last geofence for a zone → `exitZone` + notification
 *
 * **Important:** `TaskManager.defineTask` calls MUST live at module scope —
 * they are executed once when the JS bundle loads, which happens both in the
 * foreground AND when the OS wakes the app for a background event.
 */

import 'expo-sqlite/localStorage/install';

import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';

import {
  showZoneEntryNotification,
  showZoneExitNotification,
} from '@/util/notifications/notifications.util';
import { enterZone, exitZone } from '@/util/presence/presence.util';

// ── Task names ─────────────────────────────────────────────────────────────────

export const GEOFENCE_TASK = 'szpont-geofence-task';

// ── localStorage keys for persisted state ──────────────────────────────────────

const ACTIVE_GEOFENCES_KEY = 'geofencing:activeGeofences';
const ZONE_NAMES_KEY = 'geofencing:zoneNames';
const LAST_NOTIFIED_ZONE_KEY = 'geofencing:lastNotifiedZone';

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
 * name in notifications without a network call.
 */
function getCachedZoneNames(): Record<string, string> {
  try {
    const raw = localStorage.getItem(ZONE_NAMES_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/** Persists a zoneId → name map for background notification copy. */
export function setCachedZoneNames(names: Record<string, string>): void {
  localStorage.setItem(ZONE_NAMES_KEY, JSON.stringify(names));
}

/** Returns the zone id we last showed a notification for (avoids duplicates). */
function getLastNotifiedZone(): string | null {
  return localStorage.getItem(LAST_NOTIFIED_ZONE_KEY);
}

/** Records the zone id that was last notified about. */
function setLastNotifiedZone(zoneId: string): void {
  localStorage.setItem(LAST_NOTIFIED_ZONE_KEY, zoneId);
}

/** Clears the last-notified-zone tracker (e.g. after an exit notification). */
function clearLastNotifiedZone(): void {
  localStorage.removeItem(LAST_NOTIFIED_ZONE_KEY);
}

/** Removes all persisted geofencing state (used on city change / cleanup). */
export function clearGeofencingState(): void {
  localStorage.removeItem(ACTIVE_GEOFENCES_KEY);
  localStorage.removeItem(ZONE_NAMES_KEY);
  localStorage.removeItem(LAST_NOTIFIED_ZONE_KEY);
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
      await enterZone(zoneId);

      // Only notify on the first geofence entry for this zone
      if (!wasInZone) {
        const lastNotified = getLastNotifiedZone();

        // If the user walked directly from another zone, send an exit
        // notification for the previous zone first
        if (lastNotified && lastNotified !== zoneId) {
          const prevName = names[lastNotified] ?? lastNotified;
          await showZoneExitNotification(prevName);
        }

        const name = names[zoneId] ?? zoneId;
        await showZoneEntryNotification(name);
        setLastNotifiedZone(zoneId);
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
        await exitZone();

        const lastNotified = getLastNotifiedZone();
        if (lastNotified === zoneId) {
          const name = names[zoneId] ?? zoneId;
          await showZoneExitNotification(name);
          clearLastNotifiedZone();
        }
      } catch (e) {
        console.warn('[GeofenceTask] failed to exit zone:', e);
      }
    }

    refreshActiveZone();
  }
});
