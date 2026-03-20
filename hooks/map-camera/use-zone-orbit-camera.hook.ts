import { useEffect, useRef } from 'react';

import { type CameraMode, type ImperativeCameraCommand } from '@/components/map-view/map-view.types';

interface ZoneCamera {
  center: [number, number];
  zoom: number;
  slideEndpoints: { start: [number, number]; end: [number, number] } | null;
}

interface UseZoneOrbitCameraParams {
  cameraMode: CameraMode;
  zoneCamera: ZoneCamera | undefined;
  applyImperativeCamera: (command: ImperativeCameraCommand) => void;
}

/** Pitch angle when viewing a zone up close (orbit and zone entry). */
const ZONE_PITCH = 45;
/** Degrees the heading advances per orbit tick. */
const ORBIT_STEP_DEG = 0.3;
/** Milliseconds between orbit ticks (~30 fps is enough for smooth rotation). */
const ORBIT_INTERVAL_MS = 32;
/** Duration of the initial flyTo zoom-in animation (ms). */
const FLYTO_DURATION_MS = 1000;

/** Builds the initial zone-entry fly command before orbit takeover begins. */
function createZoneEntryFlyCommand(
  centerCoordinate: [number, number],
  zoomLevel: number,
): ImperativeCameraCommand {
  return {
    centerCoordinate,
    zoomLevel,
    // Match orbit pitch at landing to avoid a visible tilt snap at handoff.
    pitch: ZONE_PITCH,
    heading: 0,
    animationMode: 'flyTo',
    animationDuration: FLYTO_DURATION_MS,
  };
}

/** Builds a single orbit tick command used by the zone orbit loop. */
function createZoneOrbitTickCommand(
  centerCoordinate: [number, number],
  zoomLevel: number,
  heading: number,
): ImperativeCameraCommand {
  return {
    centerCoordinate,
    zoomLevel,
    pitch: ZONE_PITCH,
    heading,
    animationMode: 'moveTo',
    animationDuration: 0,
  };
}

/**
 * Drives the imperative zone camera sequence:
 * fly to zone, then run continuous orbit (with optional sinusoidal slide).
 */
export function useZoneOrbitCamera({
  cameraMode,
  zoneCamera,
  applyImperativeCamera,
}: UseZoneOrbitCameraParams): void {
  const headingRef = useRef(0);

  useEffect(() => {
    if (cameraMode.mode === 'follow-user' || cameraMode.mode === 'city') {
      headingRef.current = 0;
      return;
    }

    if (!zoneCamera) return;

    const { slideEndpoints } = zoneCamera;
    // For elongated zones the flyTo lands at the slide start so the tour
    // begins from one end; compact zones use the bbox center as before.
    const flyToCenter = slideEndpoints ? slideEndpoints.start : zoneCamera.center;

    // Land directly on orbit pitch so the transition into orbit has no tilt jump.
    applyImperativeCamera(createZoneEntryFlyCommand(flyToCenter, zoneCamera.zoom));

    // Seed orbit heading from the same orientation as the initial flyTo.
    headingRef.current = 0;

    let intervalId: ReturnType<typeof setInterval> | null = null;

    const timeout = setTimeout(() => {
      intervalId = setInterval(() => {
        headingRef.current = (headingRef.current + ORBIT_STEP_DEG) % 360;

        // Sinusoidal ping-pong along the major axis for elongated zones
        let center = zoneCamera.center;
        if (slideEndpoints) {
          const t = (Math.sin((headingRef.current * Math.PI) / 180 - Math.PI / 2) + 1) / 2;
          center = [
            slideEndpoints.start[0] + t * (slideEndpoints.end[0] - slideEndpoints.start[0]),
            slideEndpoints.start[1] + t * (slideEndpoints.end[1] - slideEndpoints.start[1]),
          ];
        }

        applyImperativeCamera(
          createZoneOrbitTickCommand(center, zoneCamera.zoom, headingRef.current),
        );
      }, ORBIT_INTERVAL_MS);
    }, FLYTO_DURATION_MS);

    return () => {
      clearTimeout(timeout);
      if (intervalId) clearInterval(intervalId);
    };
  }, [applyImperativeCamera, cameraMode, zoneCamera]);
}
