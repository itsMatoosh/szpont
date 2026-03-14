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
import { enterZone, exitZone } from '@/util/presence/presence.util';

// ── Task names ─────────────────────────────────────────────────────────────────

export const GEOFENCE_TASK = 'szpont-geofence-task';
export const LOCATION_TASK = 'szpont-location-task';

// ── localStorage keys for persisted state ──────────────────────────────────────

const ACTIVE_ZONES_KEY = 'geofencing:activeZones';
const ZONE_BOUNDARIES_KEY = 'geofencing:zoneBoundaries';

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

/** Removes all persisted geofencing state (used on city change / cleanup). */
export function clearGeofencingState(): void {
  localStorage.removeItem(ACTIVE_ZONES_KEY);
  localStorage.removeItem(ZONE_BOUNDARIES_KEY);
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

      // Exit any active presence
      try {
        await exitZone();
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

  try {
    if (matchedZoneId) {
      // enter_zone is a no-op when already in the same zone
      await enterZone(matchedZoneId);
    } else {
      // exit_zone is a no-op when no presence exists
      await exitZone();
    }
  } catch (e) {
    // Network or auth error — will retry on next location tick
    console.warn('[LocationTask] presence update failed:', e);
  }
});
