/**
 * Dynamic Expo config that extends the static `app.json` and injects
 * environment variables for build-time values (license keys, adapter choice).
 *
 * When `EXPO_PUBLIC_BG_LOCATION_ADAPTER=expo` the Transistorsoft-specific
 * plist keys, background modes, and native plugin are stripped so the build
 * only contains the free Expo-based location stack.
 *
 * Expo uses this file instead of `app.json` when both are present.
 */

import type { ExpoConfig } from 'expo/config';

import appJson from './app.json';

const adapter = process.env.EXPO_PUBLIC_BG_LOCATION_ADAPTER ?? 'transistor';
const isTransistor = adapter === 'transistor';

// ── iOS infoPlist ───────────────────────────────────────────────────────────────

/** Build the infoPlist appropriate for the chosen adapter. */
function buildInfoPlist(): Record<string, unknown> {
  const base = { ...appJson.expo.ios.infoPlist } as Record<string, unknown>;

  if (isTransistor) {
    return {
      ...base,
      NSMotionUsageDescription:
        'Szpont uses motion detection to save battery while tracking your location in zones.',
      UIBackgroundModes: ['location', 'fetch', 'processing'],
      BGTaskSchedulerPermittedIdentifiers: [
        'com.transistorsoft.fetch',
        'com.transistorsoft.customtask',
      ],
      TSLocationManagerLicense:
        process.env.EXPO_PUBLIC_TRANSISTOR_IOS_LICENSE ?? '',
    };
  }

  return {
    ...base,
    UIBackgroundModes: ['location'],
  };
}

// ── Plugins ─────────────────────────────────────────────────────────────────────

/** Build the plugins array, appending Transistorsoft plugins only when needed. */
function buildPlugins(): ExpoConfig['plugins'] {
  const base = (appJson.expo.plugins as ExpoConfig['plugins'])!;

  if (!isTransistor) return base;

  return [
    ...base,
    [
      'react-native-background-geolocation',
      { license: process.env.EXPO_PUBLIC_TRANSISTOR_ANDROID_LICENSE ?? '' },
    ],
    [
      'expo-gradle-ext-vars',
      { googlePlayServicesLocationVersion: '21.1.0' },
    ],
  ];
}

// ── Final config ────────────────────────────────────────────────────────────────

const config: ExpoConfig = {
  ...(appJson.expo as ExpoConfig),

  ios: {
    ...appJson.expo.ios,
    infoPlist: buildInfoPlist(),
  },

  plugins: buildPlugins(),
};

export default config;
