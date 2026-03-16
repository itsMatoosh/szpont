/**
 * Device registration and identification.
 *
 * Each physical device gets a stable server-generated UUID (`deviceId`)
 * and a `backgroundSecret` used to authenticate Edge Function calls from
 * the background (where Supabase JWTs may have expired).
 *
 * The Expo push token is optional — it may be unavailable until the user
 * grants push notification permissions. When it becomes available (or
 * rotates), `useNotificationsSetup` syncs it to the server.
 *
 * Three values are cached in localStorage for synchronous background access:
 * - `deviceId`         – stable UUID, used for upsert matching
 * - `backgroundSecret` – hex secret for X-Device-Token auth headers
 * - `expoPushToken`    – current Expo push token (may be absent)
 */

import 'expo-sqlite/localStorage/install';

import { Platform } from 'react-native';

import i18n from '@/util/i18n/i18n.util';
import { supabase } from '@/util/supabase/supabase.util';

const DEVICE_ID_KEY = 'deviceId';
const BG_SECRET_KEY = 'backgroundSecret';
const PUSH_TOKEN_KEY = 'expoPushToken';

/**
 * Registers (or re-registers) this device with the server.
 * Does NOT attempt to fetch the Expo push token — that is handled
 * independently by `useNotificationsSetup` once the device is registered.
 * Caches `deviceId` and `backgroundSecret` in localStorage.
 */
export async function registerDevice(): Promise<void> {
  const cachedDeviceId = localStorage.getItem(DEVICE_ID_KEY);

  const { data, error } = await supabase.rpc('register_device', {
    p_platform: Platform.OS,
    p_locale: i18n.language,
    p_device_id: cachedDeviceId ?? undefined,
  });

  if (error) throw error;

  const { device_id, background_secret } = data as {
    device_id: string;
    background_secret: string;
  };

  localStorage.setItem(DEVICE_ID_KEY, device_id);
  localStorage.setItem(BG_SECRET_KEY, background_secret);
}

/** Synchronous read of the background secret for Edge Function auth. */
export function getBackgroundSecret(): string | null {
  return localStorage.getItem(BG_SECRET_KEY);
}

/** Synchronous read of the stable device UUID from localStorage. */
export function getDeviceId(): string | null {
  return localStorage.getItem(DEVICE_ID_KEY);
}

/**
 * Unregisters the device on the server and clears the local cache.
 * Call on sign-out so the device row is cleaned up.
 */
export async function unregisterDevice(): Promise<void> {
  const deviceId = localStorage.getItem(DEVICE_ID_KEY);
  if (!deviceId) return;

  await supabase.rpc('unregister_device', { p_device_id: deviceId });
  localStorage.removeItem(DEVICE_ID_KEY);
  localStorage.removeItem(BG_SECRET_KEY);
  localStorage.removeItem(PUSH_TOKEN_KEY);
}
