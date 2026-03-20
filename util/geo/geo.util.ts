/** Earth radius in meters (mean) for haversine distance. */
const EARTH_RADIUS_M = 6_371_000;

/** Converts degrees to radians. */
function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Converts radians to degrees. */
function toDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

/**
 * Normalizes a heading in degrees to the half-open interval [0, 360).
 */
export function normalizeDeg0To360(deg: number): number {
  let d = deg % 360;
  if (d < 0) d += 360;
  return d;
}

/**
 * Wraps a signed angle difference to (-180, 180], e.g. relative bearing from camera forward.
 */
export function wrapDeg180(deg: number): number {
  let d = deg % 360;
  if (d > 180) d -= 360;
  if (d <= -180) d += 360;
  return d;
}

/**
 * Initial (forward) bearing from point A to point B in degrees clockwise from true north, in [0, 360).
 */
export function initialBearingDeg(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number,
): number {
  const φ1 = toRad(fromLat);
  const φ2 = toRad(toLat);
  const Δλ = toRad(toLng - fromLng);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  const θ = Math.atan2(y, x);
  return normalizeDeg0To360(toDeg(θ));
}

/**
 * Great-circle distance between two WGS84 points in meters.
 */
export function haversineMeters(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number,
): number {
  const φ1 = toRad(fromLat);
  const φ2 = toRad(toLat);
  const Δφ = toRad(toLat - fromLat);
  const Δλ = toRad(toLng - fromLng);
  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
  return EARTH_RADIUS_M * c;
}
