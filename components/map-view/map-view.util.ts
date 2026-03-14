/**
 * Returns `[minLng, minLat, maxLng, maxLat]` for a GeoJSON geometry,
 * or `null` if coordinates cannot be extracted.
 */
export function getBoundingBox(
  geometry: GeoJSON.Geometry,
): [number, number, number, number] | null {
  const coords = extractCoordinates(geometry);
  if (coords.length === 0) return null;

  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;

  for (const [lng, lat] of coords) {
    if (lng < minLng) minLng = lng;
    if (lat < minLat) minLat = lat;
    if (lng > maxLng) maxLng = lng;
    if (lat > maxLat) maxLat = lat;
  }

  return [minLng, minLat, maxLng, maxLat];
}

/**
 * Estimates a Mapbox zoom level that fits a bounding box on a phone screen.
 * Pitch only compresses the vertical (latitude) axis, so we scale latSpan
 * by 1/cos(pitch) while leaving lngSpan untouched.
 * Clamps to [0, 20].
 */
export function getZoomForBoundingBox(
  bbox: [number, number, number, number],
  pitchDeg = 0,
): number {
  const lngSpan = bbox[2] - bbox[0];
  const latSpan = bbox[3] - bbox[1];
  if (Math.max(lngSpan, latSpan) <= 0) return 16;

  const pitchFactor = Math.cos((pitchDeg * Math.PI) / 180);
  const effectiveLatSpan = latSpan / Math.max(pitchFactor, 0.4);
  const maxSpan = Math.max(lngSpan, effectiveLatSpan);

  const zoom = Math.log2(360 / maxSpan) - 1.1;
  return Math.min(Math.max(zoom, 0), 20);
}

// ── Marker overlap resolution ─────────────────────────────────────────────────

/** Which edge of the marker bubble the speech-bubble tail attaches to. */
export type TailDirection = 'none' | 'top' | 'bottom' | 'left' | 'right';

export interface ResolvedMarker {
  id: string;
  name: string;
  /** Public URL of the zone's monochrome icon, if set. */
  iconUrl: string | null;
  /** Adjusted coordinate used for collision bookkeeping (may be shifted). */
  center: [number, number];
  /** Original zone center — use as the MarkerView coordinate so the tail tip lands here. */
  originalCenter: [number, number];
  /** Which edge of the bubble the speech-bubble tail attaches to. */
  tailDirection: TailDirection;
}

/** Approximate marker dimensions in CSS pixels. */
const MARKER_WIDTH_PX = 90;
const MARKER_HEIGHT_PX = 65;

/**
 * Converts a pixel distance to degrees at a given Mapbox zoom level.
 * At zoom z the world is 256 * 2^z pixels wide (Mercator).
 */
function pxToLng(px: number, zoom: number): number {
  return (px / (256 * Math.pow(2, zoom))) * 360;
}
function pxToLat(px: number, zoom: number): number {
  return (px / (256 * Math.pow(2, zoom))) * 180;
}

/** Returns true when two marker bounding boxes overlap. */
function overlaps(
  a: [number, number],
  b: [number, number],
  threshLng: number,
  threshLat: number,
): boolean {
  return (
    Math.abs(a[0] - b[0]) < threshLng && Math.abs(a[1] - b[1]) < threshLat
  );
}

/**
 * Greedy 2D collision pass that shifts each colliding marker AWAY from the
 * specific placed marker it overlaps with, along the dominant axis.
 * Returns markers with adjusted `center` and a `tailDirection` indicating
 * which side of the bubble the pointer should be drawn on.
 */
export function resolveOverlaps(
  markers: { id: string; name: string; iconUrl: string | null; center: [number, number] }[],
  zoom: number,
): ResolvedMarker[] {
  const threshLng = pxToLng(MARKER_WIDTH_PX, zoom);
  const threshLat = pxToLat(MARKER_HEIGHT_PX, zoom);

  const placed: [number, number][] = [];
  const result: ResolvedMarker[] = [];

  /** Find the first placed marker that overlaps `pt`, or `null`. */
  const findCollision = (pt: [number, number]) =>
    placed.find((p) => overlaps(pt, p, threshLng, threshLat)) ?? null;

  const collidesWithPlaced = (pt: [number, number]) =>
    placed.some((p) => overlaps(pt, p, threshLng, threshLat));

  /** Map a shift offset to the tail direction pointing back to the original. */
  const tailForShift = (dLng: number, dLat: number): TailDirection => {
    if (Math.abs(dLng) > Math.abs(dLat)) {
      return dLng > 0 ? 'left' : 'right';
    }
    return dLat > 0 ? 'bottom' : 'top';
  };

  for (const m of markers) {
    const [lng, lat] = m.center;

    const hit = findCollision(m.center);
    if (!hit) {
      placed.push(m.center);
      result.push({ ...m, originalCenter: m.center, tailDirection: 'none' });
      continue;
    }

    // Determine direction away from the colliding marker.
    const dx = lng - hit[0];
    const dy = lat - hit[1];
    const horizontal = Math.abs(dx) > Math.abs(dy);

    // Primary shift: along the dominant axis away from the collision.
    // Fallback shift: along the perpendicular axis.
    const primaryLng = horizontal ? (dx >= 0 ? threshLng : -threshLng) : 0;
    const primaryLat = horizontal ? 0 : (dy >= 0 ? threshLat : -threshLat);
    const fallbackLng = horizontal ? 0 : (dx >= 0 ? threshLng : -threshLng);
    const fallbackLat = horizontal ? (dy >= 0 ? threshLat : -threshLat) : 0;

    const candidates: [number, number][] = [
      [lng + primaryLng, lat + primaryLat],
      [lng + fallbackLng, lat + fallbackLat],
      [lng - primaryLng, lat - primaryLat],
      [lng - fallbackLng, lat - fallbackLat],
    ];

    let resolved = false;
    for (const shifted of candidates) {
      if (!collidesWithPlaced(shifted)) {
        const tail = tailForShift(shifted[0] - lng, shifted[1] - lat);
        placed.push(shifted);
        result.push({ ...m, center: shifted, originalCenter: m.center, tailDirection: tail });
        resolved = true;
        break;
      }
    }

    if (!resolved) {
      placed.push(m.center);
      result.push({ ...m, originalCenter: m.center, tailDirection: 'none' });
    }
  }

  return result;
}

/** Recursively flattens any GeoJSON geometry into a flat array of [lng, lat] pairs. */
function extractCoordinates(geometry: GeoJSON.Geometry): [number, number][] {
  switch (geometry.type) {
    case 'Point':
      return [[geometry.coordinates[0], geometry.coordinates[1]]];
    case 'MultiPoint':
    case 'LineString':
      return geometry.coordinates.map((c) => [c[0], c[1]]);
    case 'MultiLineString':
    case 'Polygon':
      return geometry.coordinates.flat().map((c) => [c[0], c[1]]);
    case 'MultiPolygon':
      return geometry.coordinates
        .flat(2)
        .map((c) => [c[0], c[1]]);
    case 'GeometryCollection':
      return geometry.geometries.flatMap(extractCoordinates);
    default:
      return [];
  }
}
