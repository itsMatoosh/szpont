/**
 * Module-scope background location task for the Expo adapter.
 *
 * `TaskManager.defineTask` MUST be called at the top level of a module that is
 * imported early (before any component renders). The root layout already
 * imports `@/util/geofencing/geofencing.util` which now also imports this
 * file, guaranteeing registration.
 *
 * On each location delivery from the OS the task:
 * 1. Reads the current HTTP config (url, headers, extras) from localStorage.
 * 2. POSTs the location to the Edge Function in the same body shape the
 *    Transistor plugin uses, so the server-side code stays unchanged.
 * 3. Silently drops any failures — only the most recent position matters.
 */

import 'expo-sqlite/localStorage/install';

import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';

// ── Task name ───────────────────────────────────────────────────────────────────

export const EXPO_LOCATION_TASK = 'szpont-bg-location-task';

// ── localStorage keys for HTTP config ───────────────────────────────────────────
// Written by ExpoAdapter.ready / .setConfig, read here in the background.

const CONFIG_KEY = 'bgLocation:config';

/** Shape persisted to localStorage so the headless task can build HTTP requests. */
export interface PersistedBgLocationConfig {
  url: string;
  headers: Record<string, string>;
  extras: Record<string, string>;
}

/** Persist HTTP config so the background task can read it. */
export function persistBgLocationConfig(config: PersistedBgLocationConfig): void {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
}

/** Read the persisted HTTP config (returns null if not yet written). */
function readBgLocationConfig(): PersistedBgLocationConfig | null {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// ── Task definition ─────────────────────────────────────────────────────────────

TaskManager.defineTask(EXPO_LOCATION_TASK, async ({ data, error }) => {
  if (error) {
    console.warn('[ExpoLocationTask] error:', error.message);
    return;
  }

  const { locations } = data as { locations: Location.LocationObject[] };
  if (!locations || locations.length === 0) return;

  const config = readBgLocationConfig();
  if (!config?.url) return;

  // Use the most recent location only — older ones are stale
  const loc = locations[locations.length - 1];

  // Mirror the Transistor plugin's body shape so the Edge Function
  // can parse both adapters identically.
  const body = {
    location: {
      coords: {
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        accuracy: loc.coords.accuracy,
      },
      extras: config.extras,
      timestamp: new Date(loc.timestamp).toISOString(),
    },
  };

  // Fire-and-forget — if it fails we just wait for the next update
  try {
    await fetch(config.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...config.headers },
      body: JSON.stringify(body),
    });
  } catch {
    // Silently drop — only the most current position matters
  }
});
