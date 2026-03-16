import 'expo-sqlite/localStorage/install';

import { useEffect, useState } from 'react';

import { getBackgroundSecret, getDeviceId, registerDevice } from '@/util/device/device.util';

interface DeviceRegistration {
  deviceId: string | null;
  backgroundSecret: string | null;
  /** `true` once the registration RPC has resolved (success or error), or when `userId` is null. */
  isReady: boolean;
}

/**
 * Registers (or re-registers) the device when a valid `userId` is provided.
 * When `userId` is null (unauthenticated) the hook is a no-op and reports
 * ready immediately.
 *
 * Reads cached values from localStorage synchronously so that on an app
 * restart the values are available immediately (before the async RPC
 * round-trip completes). `isReady` stays `false` until the server call
 * finishes so callers can gate rendering on it.
 */
export function useDeviceRegistration(userId: string | null): DeviceRegistration {
  const [deviceId, setDeviceId] = useState<string | null>(getDeviceId);
  const [backgroundSecret, setBackgroundSecret] = useState<string | null>(getBackgroundSecret);
  const [isReady, setIsReady] = useState(!userId);

  useEffect(() => {
    if (!userId) {
      setIsReady(true);
      return;
    }

    setIsReady(false);

    registerDevice()
      .then(() => {
        setDeviceId(getDeviceId());
        setBackgroundSecret(getBackgroundSecret());
      })
      .catch((e) => {
        console.warn('[useDeviceRegistration] registration failed:', e);
      })
      .finally(() => setIsReady(true));
  }, [userId]);

  return { deviceId, backgroundSecret, isReady };
}
