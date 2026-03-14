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
