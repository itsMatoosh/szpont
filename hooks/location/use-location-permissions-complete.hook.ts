import { useLocationPermissionContext } from './location-permission.context';

/**
 * Returns `true` when all required location permissions are granted
 * (foreground + background). Motion/battery checks can be wired in
 * later once those permission states are tracked.
 */
export function useLocationPermissionsComplete(): boolean {
  const { foregroundStatus, backgroundStatus } = useLocationPermissionContext();
  return foregroundStatus === 'granted' && backgroundStatus === 'granted';
}
