import { measureWidth } from '@domir/react-native-measure-text/src/ReactNativeMeasureText';
import { bboxCollide } from 'd3-bboxCollide';
import { forceSimulation, forceX, forceY, type SimulationNodeDatum } from 'd3-force';

// ── Mercator projection helpers ────────────────────────────────────────────────

/**
 * Mapbox GL (including @rnmapbox/maps) uses 512-point tiles, so 1 tile = 512
 * screen points at zoom 0. Using 256 here would halve all pixel offsets
 * relative to the actual on-screen rendering.
 */
const TILE_SIZE = 512;

/** Converts (lng, lat) to absolute world-pixel (x, y) at the given zoom. */
function lngLatToPixel(lng: number, lat: number, zoom: number): [number, number] {
  const scale = TILE_SIZE * Math.pow(2, zoom);
  const x = ((lng + 180) / 360) * scale;
  const latRad = (lat * Math.PI) / 180;
  const y = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * scale;
  return [x, y];
}

/** Inverse of `lngLatToPixel` — converts world pixels back to geographic coordinates. */
function pixelToLngLat(px: number, py: number, zoom: number): [number, number] {
  const scale = TILE_SIZE * Math.pow(2, zoom);
  const lng = (px / scale) * 360 - 180;
  const n = Math.PI - (2 * Math.PI * py) / scale;
  const lat = (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
  return [lng, lat];
}

// ── GeoJSON helpers ────────────────────────────────────────────────────────────

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

// ── Oriented envelope ─────────────────────────────────────────────────────────

/** 2D cross product of vectors OA and OB — positive when the turn O→A→B is counter-clockwise. */
function cross(o: [number, number], a: [number, number], b: [number, number]): number {
  return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
}

/**
 * Andrew's monotone-chain convex hull. Returns vertices in CCW order
 * without a repeated closing vertex. Input must have >= 2 points.
 */
function convexHull(points: [number, number][]): [number, number][] {
  const pts = points.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (pts.length <= 1) return pts;

  const lower: [number, number][] = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0)
      lower.pop();
    lower.push(p);
  }

  const upper: [number, number][] = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0)
      upper.pop();
    upper.push(p);
  }

  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

/**
 * Computes the oriented minimum bounding rectangle (OMBR) of a GeoJSON
 * geometry via convex hull + rotating calipers. Returns the rectangle's
 * center and the two endpoints of its major (longer) axis in [lng, lat],
 * plus the aspect ratio (long / short). Returns `null` for degenerate input.
 *
 * Internally projects to an equirectangular plane (lng scaled by cos(midLat))
 * so the aspect ratio and axis direction are metrically accurate.
 */
export function getOrientedEnvelope(
  geometry: GeoJSON.Geometry,
): {
  center: [number, number];
  majorStart: [number, number];
  majorEnd: [number, number];
  aspect: number;
} | null {
  const coords = extractCoordinates(geometry);
  if (coords.length < 3) return null;

  // Project to equirectangular so 1° x ≈ 1° y in real-world distance
  let sumLat = 0;
  for (const [, lat] of coords) sumLat += lat;
  const midLat = sumLat / coords.length;
  const cosLat = Math.cos((midLat * Math.PI) / 180);
  if (cosLat < 1e-6) return null;

  const projected: [number, number][] = coords.map(([lng, lat]) => [lng * cosLat, lat]);

  const hull = convexHull(projected);
  if (hull.length < 2) return null;

  // For each hull edge, compute the aligned bounding rectangle and keep
  // the one with the smallest area (rotating-calipers approach).
  let bestArea = Infinity;
  let bestMinPar = 0;
  let bestMaxPar = 0;
  let bestMinPerp = 0;
  let bestMaxPerp = 0;
  let bestDx = 1;
  let bestDy = 0;

  for (let i = 0; i < hull.length; i++) {
    const j = (i + 1) % hull.length;
    let dx = hull[j][0] - hull[i][0];
    let dy = hull[j][1] - hull[i][1];
    const len = Math.hypot(dx, dy);
    if (len === 0) continue;
    dx /= len;
    dy /= len;

    let minPar = Infinity;
    let maxPar = -Infinity;
    let minPerp = Infinity;
    let maxPerp = -Infinity;

    for (const p of hull) {
      const par = p[0] * dx + p[1] * dy;
      const perp = -p[0] * dy + p[1] * dx;
      if (par < minPar) minPar = par;
      if (par > maxPar) maxPar = par;
      if (perp < minPerp) minPerp = perp;
      if (perp > maxPerp) maxPerp = perp;
    }

    const area = (maxPar - minPar) * (maxPerp - minPerp);
    if (area < bestArea) {
      bestArea = area;
      bestMinPar = minPar;
      bestMaxPar = maxPar;
      bestMinPerp = minPerp;
      bestMaxPerp = maxPerp;
      bestDx = dx;
      bestDy = dy;
    }
  }

  const parLen = bestMaxPar - bestMinPar;
  const perpLen = bestMaxPerp - bestMinPerp;
  const midPar = (bestMinPar + bestMaxPar) / 2;
  const midPerp = (bestMinPerp + bestMaxPerp) / 2;

  // Reconstruct projected coordinates from (par, perp) via the basis vectors:
  // x = par * dx - perp * dy,  y = par * dy + perp * dx
  const cx = midPar * bestDx - midPerp * bestDy;
  const cy = midPar * bestDy + midPerp * bestDx;

  // Major-axis endpoints sit at the midpoints of the two shorter edges
  let ms: [number, number];
  let me: [number, number];

  if (parLen >= perpLen) {
    ms = [bestMinPar * bestDx - midPerp * bestDy, bestMinPar * bestDy + midPerp * bestDx];
    me = [bestMaxPar * bestDx - midPerp * bestDy, bestMaxPar * bestDy + midPerp * bestDx];
  } else {
    ms = [midPar * bestDx - bestMinPerp * bestDy, midPar * bestDy + bestMinPerp * bestDx];
    me = [midPar * bestDx - bestMaxPerp * bestDy, midPar * bestDy + bestMaxPerp * bestDx];
  }

  // Un-project back to [lng, lat]
  return {
    center: [cx / cosLat, cy],
    majorStart: [ms[0] / cosLat, ms[1]],
    majorEnd: [me[0] / cosLat, me[1]],
    aspect: Math.max(parLen, perpLen) / Math.max(Math.min(parLen, perpLen), 1e-12),
  };
}

// ── Marker overlap resolution ─────────────────────────────────────────────────

/** Fixed marker height derived from MarkerBubble: paddingVertical 8 + icon 32 + paddingVertical 8. */
const MARKER_H = 48;
const HALF_H = MARKER_H / 2;

/** Extra breathing room added around each marker's collision box (per side). */
const MARKER_GAP = 4;

/**
 * Fixed horizontal chrome in the MarkerBubble that doesn't depend on text:
 * 12 padL + 32 icon + 8 gap + 8 gap + ~4 caret + 4 padR = 68px
 */
const MARKER_FIXED_W = 68;

/** Font config matching the zone name line: "text-md font-bold tracking-wide" (tracking-wide = 0.025em). */
const NAME_FONT = { fontSize: 16, fontWeight: 'bold' as const, letterSpacing: 0.4 };

/** Font config matching the sub-line: "text-sm font-medium" (system font, 14px medium). */
const SUB_FONT = { fontSize: 14, fontWeight: '500' as const };

/** The sub-line prefix before the text: w-2 dot (8px) + gap-1 (4px). */
const SUB_PREFIX_W = 12;

/**
 * Measures the pixel width of a MarkerBubble using native text measurement.
 * Takes the wider of the name line and the sub-line, then adds fixed chrome.
 */
function measureMarkerWidth(name: string, subText: string): number {
  const nameWidth = measureWidth(name, NAME_FONT);
  const subWidth = SUB_PREFIX_W + measureWidth(subText, SUB_FONT);
  return MARKER_FIXED_W + Math.max(nameWidth, subWidth);
}

/** Number of ticks to run the force simulation synchronously. */
const SIM_TICKS = 300;

export interface ResolvedMarker {
  id: string;
  name: string;
  /** Public URL of the zone's monochrome icon, if set. */
  iconUrl: string | null;
  /** Collision-resolved coordinate used as the MarkerView position. */
  center: [number, number];
  /** Original zone center before displacement. */
  originalCenter: [number, number];
  /** Anchor within the marker view — always centered since displacement is in the coordinate. */
  anchor: { x: number; y: number };
}

/** Screen-space rectangle for the debug overlay. */
export interface DebugRect {
  /** Marker name label. */
  name: string;
  /** Left edge in screen points. */
  left: number;
  /** Top edge in screen points. */
  top: number;
  /** Width in screen points. */
  width: number;
  /** Height in screen points. */
  height: number;
}

/** Data for the visual debug overlay, all in screen-point coordinates. */
export interface DebugOverlayData {
  rects: DebugRect[];
  /** The viewport boundary rect in screen space (should be 0,0..screenW,screenH). */
  viewport: { left: number; top: number; width: number; height: number };
}

/** Node type extending d3's SimulationNodeDatum with the original pixel position. */
interface MarkerNode extends SimulationNodeDatum {
  /** Index into the input markers array. */
  idx: number;
  /** Original pixel x before simulation. */
  ox: number;
  /** Original pixel y before simulation. */
  oy: number;
  /** Half of this marker's estimated pixel width (varies by name length). */
  hw: number;
}

/**
 * Custom d3-force that repels nodes inward when their bounding box overflows
 * the viewport. Applied proportionally so it participates naturally in the
 * simulation alongside collision and anchoring forces.
 */
function forceViewportBoundary(
  viewLeft: number,
  viewTop: number,
  viewRight: number,
  viewBottom: number,
  strength = 1,
) {
  let nodes: MarkerNode[] = [];

  function force(_alpha: number) {
    for (const node of nodes) {
      const x = node.x ?? 0;
      const y = node.y ?? 0;
      const hw = node.hw;

      const overflowLeft = viewLeft + hw - x;
      const overflowRight = x + hw - viewRight;
      const overflowTop = viewTop + HALF_H - y;
      const overflowBottom = y + HALF_H - viewBottom;

      if (overflowLeft > 0) node.vx = (node.vx ?? 0) + overflowLeft * strength;
      if (overflowRight > 0) node.vx = (node.vx ?? 0) - overflowRight * strength;
      if (overflowTop > 0) node.vy = (node.vy ?? 0) + overflowTop * strength;
      if (overflowBottom > 0) node.vy = (node.vy ?? 0) - overflowBottom * strength;
    }
  }

  force.initialize = (n: MarkerNode[]) => {
    nodes = n;
  };

  return force;
}

/**
 * Runs a d3-force simulation to resolve marker overlaps within the camera
 * viewport. Markers whose original center falls outside the viewport are
 * excluded entirely. Bounding boxes are kept within the viewport via a
 * custom boundary force.
 */
export function resolveOverlaps(
  markers: { id: string; name: string; subText: string; iconUrl: string | null; center: [number, number] }[],
  zoom: number,
  cameraCenter: [number, number],
  screenWidth: number,
  screenHeight: number,
  padding: { top: number; right: number; bottom: number; left: number },
): { markers: ResolvedMarker[]; debug: DebugOverlayData } {
  const EXTRA = 8;
  const padTop = padding.top + EXTRA;
  const padRight = padding.right + EXTRA;
  const padBottom = padding.bottom + EXTRA;
  const padLeft = padding.left + EXTRA;

  const emptyDebug: DebugOverlayData = {
    rects: [],
    viewport: { left: padLeft, top: padTop, width: screenWidth - padLeft - padRight, height: screenHeight - padTop - padBottom },
  };

  if (markers.length === 0) return { markers: [], debug: emptyDebug };

  // Full-screen origin in world-pixel space (used for debug overlay positioning)
  const [cx, cy] = lngLatToPixel(cameraCenter[0], cameraCenter[1], zoom);
  const screenLeft = cx - screenWidth / 2;
  const screenTop = cy - screenHeight / 2;

  // Padded viewport rect in world-pixel space
  const viewLeft = screenLeft + padLeft;
  const viewTop = screenTop + padTop;
  const viewRight = screenLeft + screenWidth - padRight;
  const viewBottom = screenTop + screenHeight - padBottom;

  // Convert to pixels and filter markers outside viewport
  const nodes: MarkerNode[] = [];
  const sourceIndices: number[] = [];

  for (let i = 0; i < markers.length; i++) {
    const [lng, lat] = markers[i].center;
    const [px, py] = lngLatToPixel(lng, lat, zoom);

    if (px < viewLeft || px > viewRight || py < viewTop || py > viewBottom) continue;

    const hw = measureMarkerWidth(markers[i].name, markers[i].subText) / 2;
    nodes.push({ idx: i, x: px, y: py, ox: px, oy: py, hw });
    sourceIndices.push(i);
  }

  if (nodes.length === 0) return { markers: [], debug: emptyDebug };

  // Single marker — no simulation needed, just return it directly
  if (nodes.length === 1) {
    const node = nodes[0];
    const m = markers[sourceIndices[0]];
    const sx = (node.x ?? 0) - screenLeft;
    const sy = (node.y ?? 0) - screenTop;
    return {
      markers: [{ ...m, originalCenter: m.center, anchor: { x: 0.5, y: 0.5 } }],
      debug: {
        rects: [{ name: m.name, left: sx - node.hw, top: sy - HALF_H, width: node.hw * 2, height: MARKER_H }],
        viewport: emptyDebug.viewport,
      },
    };
  }

  // Run a synchronous d3-force simulation with three forces
  const simulation = forceSimulation<MarkerNode>(nodes)
    .force(
      'collide',
      bboxCollide<MarkerNode>((d) => [
        [-d.hw - MARKER_GAP, -HALF_H - MARKER_GAP],
        [d.hw + MARKER_GAP, HALF_H + MARKER_GAP],
      ]).strength(1).iterations(2),
    )
    .force(
      'x',
      forceX<MarkerNode>((d) => d.ox).strength(0.5),
    )
    .force(
      'y',
      forceY<MarkerNode>((d) => d.oy).strength(0.5),
    )
    .force(
      'boundary',
      forceViewportBoundary(viewLeft, viewTop, viewRight, viewBottom, 1),
    )
    .stop();

  simulation.tick(SIM_TICKS);

  // Build debug rects in screen-point coordinates
  const debugRects: DebugRect[] = nodes.map((node) => {
    const sx = (node.x ?? 0) - screenLeft;
    const sy = (node.y ?? 0) - screenTop;
    return {
      name: markers[node.idx].name,
      left: sx - node.hw,
      top: sy - HALF_H,
      width: node.hw * 2,
      height: MARKER_H,
    };
  });

  // Convert resolved pixel positions back to geographic coordinates
  const resolved = nodes.map((node) => {
    const m = markers[node.idx];
    const [lng, lat] = pixelToLngLat(node.x!, node.y!, zoom);
    return {
      ...m,
      center: [lng, lat] as [number, number],
      originalCenter: m.center,
      anchor: { x: 0.5, y: 0.5 },
    };
  });

  return {
    markers: resolved,
    debug: { rects: debugRects, viewport: emptyDebug.viewport },
  };
}

// ── Bounding-box helpers ──────────────────────────────────────────────────────

/**
 * Returns a new bbox whose each edge is pushed outward by `fraction` of the
 * original span. For example `fraction = 0.2` adds 20 % padding on every side.
 */
export function expandBoundingBox(
  bbox: [number, number, number, number],
  fraction: number,
): [number, number, number, number] {
  const lngPad = (bbox[2] - bbox[0]) * fraction;
  const latPad = (bbox[3] - bbox[1]) * fraction;
  return [
    bbox[0] - lngPad,
    bbox[1] - latPad,
    bbox[2] + lngPad,
    bbox[3] + latPad,
  ];
}

// ── Internal helpers ───────────────────────────────────────────────────────────

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
