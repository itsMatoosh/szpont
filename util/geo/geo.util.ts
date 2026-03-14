import type { Json } from '@/util/supabase/database.types';

// ── Types ──────────────────────────────────────────────────────────────────────

/** A GeoJSON Polygon as stored in the zone `boundary` column. */
export interface GeoJsonPolygon {
  type: 'Polygon';
  coordinates: number[][][];
}

// ── Point-in-polygon ───────────────────────────────────────────────────────────

/**
 * Ray-casting algorithm to test whether a point lies inside a GeoJSON Polygon.
 * Handles polygons with holes (first ring = outer, subsequent rings = holes).
 * Coordinates are [lng, lat] to match GeoJSON convention.
 *
 * @see https://en.wikipedia.org/wiki/Point_in_polygon#Ray_casting_algorithm
 */
export function isPointInPolygon(
  lng: number,
  lat: number,
  polygon: GeoJsonPolygon,
): boolean {
  const rings = polygon.coordinates;
  if (rings.length === 0) return false;

  // Must be inside the outer ring
  if (!isPointInRing(lng, lat, rings[0])) return false;

  // Must NOT be inside any hole
  for (let i = 1; i < rings.length; i++) {
    if (isPointInRing(lng, lat, rings[i])) return false;
  }

  return true;
}

/**
 * Tests whether a point is inside a single polygon ring using the
 * ray-casting (even-odd rule) method. The ring is an array of [lng, lat] pairs.
 */
function isPointInRing(
  lng: number,
  lat: number,
  ring: number[][],
): boolean {
  let inside = false;

  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];

    // Check if the ray from (lng, lat) → +∞ crosses this edge
    const intersects =
      yi > lat !== yj > lat &&
      lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;

    if (intersects) inside = !inside;
  }

  return inside;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Parses a Json boundary value from the database into a typed GeoJSON Polygon. */
export function parseGeoJsonPolygon(boundary: Json): GeoJsonPolygon {
  const obj = typeof boundary === 'string' ? JSON.parse(boundary) : boundary;
  return obj as GeoJsonPolygon;
}
