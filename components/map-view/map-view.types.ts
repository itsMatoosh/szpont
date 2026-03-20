/** Camera framing modes supported by the map screen. */
export type CameraMode =
  | { mode: 'follow-user' }
  /** City overview; `focusedZoneId` set when entering via an on-map zone marker tap (not horizon chips). */
  | { mode: 'city'; focusedZoneId?: string }
  | { mode: 'zone'; zoneId: string };

/** When in city mode, returns the zone id from an on-map marker tap (if any). */
export function getCityFocusedZoneId(mode: CameraMode): string | undefined {
  return mode.mode === 'city' ? mode.focusedZoneId : undefined;
}

/** Imperative camera command payload passed to Mapbox `setCamera`. */
export type ImperativeCameraCommand = {
  centerCoordinate: [number, number];
  zoomLevel: number;
  pitch: number;
  heading: number;
  animationDuration: number;
  animationMode: 'easeTo' | 'flyTo' | 'moveTo' | 'linearTo';
};

/** Shape used by map and camera hooks for city zones. */
export interface MapZone {
  id: string;
  name: string;
  boundary: unknown;
}
