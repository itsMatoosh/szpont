import * as Notifications from 'expo-notifications';
import { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

/** Possible states of a notification permission check. */
export type NotificationPermissionStatus =
  | 'loading'
  | 'granted'
  | 'undetermined'
  | 'denied';

interface NotificationPermissionContextValue {
  status: NotificationPermissionStatus;
  /** Re-checks the current permission level. Call after requesting permissions. */
  recheck: () => Promise<void>;
}

/** Preloaded permission snapshot passed into the provider to avoid a loading flash. */
export interface NotificationPermissionSnapshot {
  status: NotificationPermissionStatus;
}

const NotificationPermissionContext = createContext<NotificationPermissionContextValue | null>(null);

/** Maps the expo-notifications permission status to our simplified union. */
function mapStatus(status: Notifications.PermissionStatus, canAskAgain: boolean): NotificationPermissionStatus {
  switch (status) {
    case Notifications.PermissionStatus.GRANTED:
      return 'granted';
    case Notifications.PermissionStatus.UNDETERMINED:
      return 'undetermined';
    case Notifications.PermissionStatus.DENIED:
      return canAskAgain ? 'undetermined' : 'denied';
    default:
      return 'denied';
  }
}

/**
 * Fetches the current notification permission status.
 * Call during app startup and pass the result as `initialSnapshot` to the
 * provider so it can render immediately without a loading state.
 */
export async function preloadNotificationPermissions(): Promise<NotificationPermissionSnapshot> {
  const perm = await Notifications.getPermissionsAsync();
  return { status: mapStatus(perm.status, perm.canAskAgain) };
}

interface NotificationPermissionProviderProps {
  initialSnapshot: NotificationPermissionSnapshot;
  children: ReactNode;
}

/**
 * Passively tracks notification permission status.
 * Accepts a preloaded snapshot so the initial render has real values.
 * Re-checks automatically when the app returns from the background
 * (user may have toggled in Settings).
 * Does NOT request permissions — that responsibility belongs to UI screens.
 */
export function NotificationPermissionProvider({ initialSnapshot, children }: NotificationPermissionProviderProps) {
  const [status, setStatus] = useState(initialSnapshot.status);
  const appStateRef = useRef(AppState.currentState);

  const recheck = useCallback(async () => {
    const perm = await Notifications.getPermissionsAsync();
    setStatus(mapStatus(perm.status, perm.canAskAgain));
  }, []);

  // Re-check when returning from background (user may have toggled in Settings)
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (appStateRef.current.match(/inactive|background/) && nextState === 'active') {
        recheck();
      }
      appStateRef.current = nextState;
    });
    return () => subscription.remove();
  }, [recheck]);

  return (
    <NotificationPermissionContext.Provider value={{ status, recheck }}>
      {children}
    </NotificationPermissionContext.Provider>
  );
}

/** Reads the notification permission context. Must be used within a NotificationPermissionProvider. */
export function useNotificationPermissionContext(): NotificationPermissionContextValue {
  const ctx = useContext(NotificationPermissionContext);
  if (!ctx) {
    throw new Error('useNotificationPermissionContext must be used within a NotificationPermissionProvider');
  }
  return ctx;
}
