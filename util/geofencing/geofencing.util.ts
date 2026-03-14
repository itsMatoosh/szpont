/**
 * Background geofencing and location tracking tasks.
 *
 * This module defines two `expo-task-manager` tasks that run even when the app
 * is backgrounded or killed:
 *
 * 1. **GEOFENCE_TASK** – receives circular geofence enter/exit events from the
 *    OS. On enter it starts fine-grained background location updates; on exit
 *    it stops them (when no geofences remain active).
 *
 * 2. **LOCATION_TASK** – receives continuous location updates while at least
 *    one circular geofence is active. Each update runs a client-side
 *    point-in-polygon test against the cached zone boundaries to decide
 *    whether to enter or exit a zone in the `presence` table.
 *
 * **Important:** `TaskManager.defineTask` calls MUST live at module scope —
 * they are executed once when the JS bundle loads, which happens both in the
 * foreground AND when the OS wakes the app for a background event.
 */

import 'expo-sqlite/localStorage/install';

import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';

import { isPointInPolygon, parseGeoJsonPolygon } from '@/util/geo/geo.util';
import {
  showZoneEntryNotification,
  showZoneExitNotification,
} from '@/util/notifications/notifications.util';
import { enterZone, exitZone } from '@/util/presence/presence.util';

// ── Task names ─────────────────────────────────────────────────────────────────

export const GEOFENCE_TASK = 'szpont-geofence-task';
export const LOCATION_TASK = 'szpont-location-task';

// ── localStorage keys for persisted state ──────────────────────────────────────

const ACTIVE_ZONES_KEY = 'geofencing:activeZones';
const ZONE_BOUNDARIES_KEY = 'geofencing:zoneBoundaries';
const ZONE_NAMES_KEY = 'geofencing:zoneNames';
const LAST_NOTIFIED_ZONE_KEY = 'geofencing:lastNotifiedZone';

// ── Helpers for persisted state ────────────────────────────────────────────────

/**
 * The "active set" tracks which zone_ids currently have an active circular
 * geofence. Stored as a JSON array in localStorage so it survives app kills.
 */
function getActiveZoneIds(): string[] {
  try {
    const raw = localStorage.getItem(ACTIVE_ZONES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function setActiveZoneIds(ids: string[]): void {
  localStorage.setItem(ACTIVE_ZONES_KEY, JSON.stringify(ids));
}

/**
 * Zone boundaries are cached as a JSON map of { [zoneId]: GeoJSON }.
 * Written by the initialization hook when geofences are registered, and read
 * by the location task for point-in-polygon checks.
 */
function getCachedBoundaries(): Record<string, unknown> {
  try {
    const raw = localStorage.getItem(ZONE_BOUNDARIES_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/** Persists zone boundaries so background tasks can read them without network. */
export function setCachedBoundaries(
  boundaries: Record<string, unknown>,
): void {
  localStorage.setItem(ZONE_BOUNDARIES_KEY, JSON.stringify(boundaries));
}

/**
 * Zone names are cached alongside boundaries so background tasks can include
 * the human-readable name in notifications without a network call.
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
  localStorage.removeItem(ACTIVE_ZONES_KEY);
  localStorage.removeItem(ZONE_BOUNDARIES_KEY);
  localStorage.removeItem(ZONE_NAMES_KEY);
  localStorage.removeItem(LAST_NOTIFIED_ZONE_KEY);
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

  // The region identifier is formatted as "zoneId:geofenceId" by the hook
  const zoneId = region.identifier?.split(':')[0];
  if (!zoneId) return;

  const activeIds = getActiveZoneIds();

  if (eventType === Location.GeofencingEventType.Enter) {
    if (!activeIds.includes(zoneId)) {
      activeIds.push(zoneId);
      setActiveZoneIds(activeIds);
    }

    // Ensure background location updates are running
    const isTracking = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK).catch(() => false);
    if (!isTracking) {
      await Location.startLocationUpdatesAsync(LOCATION_TASK, {
        accuracy: Location.Accuracy.High,
        distanceInterval: 20,
        deferredUpdatesInterval: 5_000,
        showsBackgroundLocationIndicator: false,
        foregroundService: {
          notificationTitle: 'Szpont',
          notificationBody: 'Tracking your zone presence',
          notificationColor: '#000000',
        },
      });
    }
  } else if (eventType === Location.GeofencingEventType.Exit) {
    const filtered = activeIds.filter((id) => id !== zoneId);
    setActiveZoneIds(filtered);

    if (filtered.length === 0) {
      // No more active geofences — stop location tracking
      const isTracking = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK).catch(() => false);
      if (isTracking) {
        await Location.stopLocationUpdatesAsync(LOCATION_TASK);
      }

      // Exit any active presence and notify the user
      try {
        await exitZone();

        const lastZone = getLastNotifiedZone();
        if (lastZone) {
          const names = getCachedZoneNames();
          const name = names[lastZone] ?? lastZone;
          await showZoneExitNotification(name);
          clearLastNotifiedZone();
        }
      } catch (e) {
        console.warn('[GeofenceTask] failed to exit zone:', e);
      }
    }
  }
});

// ── LOCATION_TASK ──────────────────────────────────────────────────────────────

TaskManager.defineTask(LOCATION_TASK, async ({ data, error }) => {
  if (error) {
    console.warn('[LocationTask] error:', error.message);
    return;
  }

  const { locations } = data as { locations: Location.LocationObject[] };
  const latest = locations[locations.length - 1];
  if (!latest) return;

  const { longitude: lng, latitude: lat } = latest.coords;

  const activeIds = getActiveZoneIds();
  const boundaries = getCachedBoundaries();

  // Determine which zone (if any) the user is inside
  let matchedZoneId: string | null = null;
  for (const zoneId of activeIds) {
    const boundary = boundaries[zoneId];
    if (!boundary) continue;

    try {
      const polygon = parseGeoJsonPolygon(boundary as Parameters<typeof parseGeoJsonPolygon>[0]);
      if (isPointInPolygon(lng, lat, polygon)) {
        matchedZoneId = zoneId;
        break;
      }
    } catch {
      // Malformed boundary — skip
    }
  }

  const names = getCachedZoneNames();
  const lastNotified = getLastNotifiedZone();

  try {
    if (matchedZoneId) {
      await enterZone(matchedZoneId);

      // Only notify when the zone changes to avoid duplicate notifications on
      // every location tick (enterZone itself is idempotent for the same zone).
      if (lastNotified !== matchedZoneId) {
        // If the user moved directly between zones, send an exit notification
        // for the previous zone first.
        if (lastNotified) {
          const prevName = names[lastNotified] ?? lastNotified;
          await showZoneExitNotification(prevName);
        }

        const name = names[matchedZoneId] ?? matchedZoneId;
        await showZoneEntryNotification(name);
        setLastNotifiedZone(matchedZoneId);
      }
    } else {
      await exitZone();

      if (lastNotified) {
        const name = names[lastNotified] ?? lastNotified;
        await showZoneExitNotification(name);
        clearLastNotifiedZone();
      }
    }
  } catch (e) {
    // Network or auth error — will retry on next location tick
    console.warn('[LocationTask] presence update failed:', e);
  }
});
