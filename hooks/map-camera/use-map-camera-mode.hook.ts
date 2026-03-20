import { type Dispatch, type SetStateAction, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { type CameraMode, type MapZone } from '@/components/map-view/map-view.types';

interface UseMapCameraModeParams {
  activeZoneId: string | null;
  cityId: string | undefined;
  cityCameraAvailable: boolean;
  clearSelectedZoneRequestVersion: number;
  zones: MapZone[];
}

interface UseMapCameraModeResult {
  cameraMode: CameraMode;
  setCameraMode: Dispatch<SetStateAction<CameraMode>>;
  showCityOverviewToggle: boolean;
  showZoneGeofenceToggle: boolean;
  handleCityOverviewToggle: () => void;
  handleZoneGeofenceToggle: () => void;
  handleZoneMarkerPress: (zoneId: string) => void;
  /** Like `handleZoneMarkerPress` but opening city overview does not set squad headline zone (`cityFocusedZoneId`). */
  handleHorizonZoneChipPress: (zoneId: string) => void;
}

/** Returns whether switching to `next` is allowed while geofenced into `activeZoneId`. */
function isCameraModeAllowedWithGeofence(next: CameraMode, activeZoneId: string | null): boolean {
  if (activeZoneId == null) return true;
  if (next.mode === 'city') return false;
  if (next.mode === 'zone' && next.zoneId !== activeZoneId) return false;
  return true;
}

/**
 * Owns map camera mode transitions and geofence policy:
 * - city mode is disallowed while geofenced,
 * - entering/switching geofence can correct invalid current mode,
 * - exits never force a mode change,
 * - on-map marker taps from **follow-user** open city overview and set squad headline zone;
 *   **horizon** chips open city overview without that headline zone; from **city** (or **zone**) taps switch
 *   to **zone** orbit so the camera zooms to that polygon;
 * - squad header back (`clearSelectedZone`) goes to **city** overview without headline zone when bounds exist.
 */
export function useMapCameraMode({
  activeZoneId,
  cityId,
  cityCameraAvailable,
  clearSelectedZoneRequestVersion,
  zones,
}: UseMapCameraModeParams): UseMapCameraModeResult {
  const [cameraMode, setCameraMode] = useState<CameraMode>({ mode: 'follow-user' });

  /** Tracks last geofence zone for enter/switch detection (exit does not change camera mode). */
  const previousGeofenceZoneIdRef = useRef<string | null>(null);
  const previousClearRequestVersionRef = useRef(clearSelectedZoneRequestVersion);
  const previousCityIdRef = useRef<string | undefined>(undefined);

  // On entering/switching into zone Z, correct illegal city or orbit of another zone.
  useEffect(() => {
    const prev = previousGeofenceZoneIdRef.current;
    const current = activeZoneId ?? null;
    if (current != null && prev !== current) {
      setCameraMode((mode) => {
        if (mode.mode === 'city') return { mode: 'follow-user' };
        if (mode.mode === 'zone' && mode.zoneId !== current) return { mode: 'follow-user' };
        return mode;
      });
    }
    previousGeofenceZoneIdRef.current = current;
  }, [activeZoneId]);

  // clearSelectedZone (squad back) should land on city overview (no headline zone), not follow-user.
  useEffect(() => {
    if (previousClearRequestVersionRef.current === clearSelectedZoneRequestVersion) return;
    previousClearRequestVersionRef.current = clearSelectedZoneRequestVersion;
    if (activeZoneId != null) return;
    setCameraMode(cityCameraAvailable ? { mode: 'city' } : { mode: 'follow-user' });
  }, [activeZoneId, cityCameraAvailable, clearSelectedZoneRequestVersion]);

  // Never auto-switch to city overview; when the resolved city changes, drop out of city framing.
  useEffect(() => {
    const prev = previousCityIdRef.current;
    previousCityIdRef.current = cityId;

    if (cityId === prev) return;

    setCameraMode((mode) => {
      if (mode.mode === 'zone') return mode;
      return { mode: 'follow-user' };
    });
  }, [cityId]);

  // City overview requires computed bounds; fall back if zone data disappears while in city mode.
  useEffect(() => {
    if (cameraMode.mode === 'city' && !cityCameraAvailable) {
      setCameraMode({ mode: 'follow-user' });
    }
  }, [cameraMode.mode, cityCameraAvailable]);

  const geofenceLocked = activeZoneId != null;
  const activeGeofenceZone = useMemo(
    () => (activeZoneId ? zones.find((zone) => zone.id === activeZoneId) : undefined),
    [activeZoneId, zones],
  );

  /** City toggle only when unlocked — geofence disallows city mode. */
  const showCityOverviewToggle =
    cityCameraAvailable &&
    !geofenceLocked &&
    (cameraMode.mode === 'follow-user' || cameraMode.mode === 'city');

  /** Toggle between follow and zone orbit for the geofenced zone only. */
  const showZoneGeofenceToggle =
    activeGeofenceZone != null &&
    (cameraMode.mode === 'follow-user' ||
      cameraMode.mode === 'city' ||
      (cameraMode.mode === 'zone' && cameraMode.zoneId === activeZoneId));

  const handleCityOverviewToggle = useCallback(() => {
    if (geofenceLocked) return;
    setCameraMode((mode) => {
      if (mode.mode === 'follow-user') return { mode: 'city' };
      if (mode.mode === 'city') return { mode: 'follow-user' };
      return mode;
    });
  }, [geofenceLocked]);

  const handleZoneGeofenceToggle = useCallback(() => {
    if (activeZoneId == null) return;
    setCameraMode((mode) => {
      if (mode.mode === 'follow-user' || mode.mode === 'city') {
        return { mode: 'zone', zoneId: activeZoneId };
      }
      if (mode.mode === 'zone' && mode.zoneId === activeZoneId) {
        return { mode: 'follow-user' };
      }
      return mode;
    });
  }, [activeZoneId]);

  const handleZoneMarkerPress = useCallback(
    (zoneId: string) => {
      if (activeZoneId != null) {
        const next: CameraMode = { mode: 'zone', zoneId };
        setCameraMode((mode) => (isCameraModeAllowedWithGeofence(next, activeZoneId) ? next : mode));
        return;
      }
      setCameraMode((mode) => {
        if (mode.mode === 'city' || mode.mode === 'zone') {
          return { mode: 'zone', zoneId };
        }
        if (cityCameraAvailable) {
          return { mode: 'city', focusedZoneId: zoneId };
        }
        return { mode: 'zone', zoneId };
      });
    },
    [activeZoneId, cityCameraAvailable],
  );

  const handleHorizonZoneChipPress = useCallback(
    (zoneId: string) => {
      if (activeZoneId != null) {
        const next: CameraMode = { mode: 'zone', zoneId };
        setCameraMode((mode) => (isCameraModeAllowedWithGeofence(next, activeZoneId) ? next : mode));
        return;
      }
      setCameraMode((mode) => {
        if (mode.mode === 'city' || mode.mode === 'zone') {
          return { mode: 'zone', zoneId };
        }
        if (cityCameraAvailable) {
          return { mode: 'city' };
        }
        return { mode: 'zone', zoneId };
      });
    },
    [activeZoneId, cityCameraAvailable],
  );

  return {
    cameraMode,
    setCameraMode,
    showCityOverviewToggle,
    showZoneGeofenceToggle,
    handleCityOverviewToggle,
    handleZoneGeofenceToggle,
    handleZoneMarkerPress,
    handleHorizonZoneChipPress,
  };
}
