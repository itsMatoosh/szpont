/**
 * Shared interface and factory for background location adapters.
 *
 * Two implementations exist:
 * - **TransistorAdapter** — wraps the paid `react-native-background-geolocation` plugin
 * - **ExpoAdapter** — free alternative using `expo-location` + `expo-task-manager`
 *
 * The factory selects the adapter based on `EXPO_PUBLIC_BG_LOCATION_ADAPTER`
 * (`"transistor"` by default, or `"expo"` for the free implementation).
 */

// ── Config types ────────────────────────────────────────────────────────────────

/** Configuration passed to `ready()` to set up the adapter. */
export interface BackgroundLocationConfig {
  /** Edge Function URL that receives location POSTs. */
  url: string;
  /** HTTP headers sent with every location POST (e.g. device token). */
  headers: Record<string, string>;
  /** Extra key-value pairs persisted alongside each location (e.g. zone_id). */
  extras: Record<string, string>;
  /** GPS accuracy level. */
  desiredAccuracy: 'high' | 'balanced';
  /** Minimum distance (meters) between recorded locations. */
  distanceFilter: number;
  /** Whether tracking stops when the app is terminated. */
  stopOnTerminate: boolean;
}

// ── Adapter interface ───────────────────────────────────────────────────────────

/** Common API surface that every background location adapter must implement. */
export interface BackgroundLocationAdapter {
  /** One-time initialisation — call before `start()`. */
  ready(config: BackgroundLocationConfig): Promise<void>;
  /** Begin recording and posting locations. */
  start(): Promise<void>;
  /** Stop recording locations. */
  stop(): Promise<void>;
  /** Merge partial config changes (e.g. new zone_id or token) at runtime. */
  setConfig(config: Partial<BackgroundLocationConfig>): Promise<void>;
}

// ── Factory ─────────────────────────────────────────────────────────────────────

let _instance: BackgroundLocationAdapter | null = null;

/**
 * Returns the singleton adapter selected by `EXPO_PUBLIC_BG_LOCATION_ADAPTER`.
 *
 * The instance is created lazily and cached — safe to call from any context
 * (foreground component, background task, sign-out handler, etc.).
 */
export function getBackgroundLocationAdapter(): BackgroundLocationAdapter {
  if (_instance) return _instance;

  const kind = process.env.EXPO_PUBLIC_BG_LOCATION_ADAPTER ?? 'transistor';

  switch (kind) {
    case 'expo': {
      // Lazy require keeps the Transistor native module out of the bundle
      // when it isn't selected (and vice-versa).
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { ExpoAdapter } = require('./expo.adapter') as typeof import('./expo.adapter');
      _instance = new ExpoAdapter();
      break;
    }
    case 'transistor': {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { TransistorAdapter } = require('./transistor.adapter') as typeof import('./transistor.adapter');
      _instance = new TransistorAdapter();
      break;
    }
    default: {
      const _exhaustive: never = kind as never;
      throw new Error(`Unknown BG_LOCATION_ADAPTER: ${_exhaustive}`);
    }
  }

  return _instance;
}
