/**
 * Background location adapter backed by the paid Transistor
 * `react-native-background-geolocation` plugin.
 *
 * This is a thin wrapper that maps the generic
 * {@link BackgroundLocationAdapter} interface onto the plugin's native API.
 * The plugin handles battery optimisation, HTTP queuing, and motion detection
 * out of the box.
 */

import BackgroundGeolocation from 'react-native-background-geolocation';

import type {
  BackgroundLocationAdapter,
  BackgroundLocationConfig,
} from './background-location.adapter';

/** Maps our portable accuracy enum to the plugin's native constant. */
function mapAccuracy(accuracy: BackgroundLocationConfig['desiredAccuracy']) {
  switch (accuracy) {
    case 'high':
      return BackgroundGeolocation.DesiredAccuracy.High;
    case 'balanced':
      return BackgroundGeolocation.DesiredAccuracy.Medium;
  }
}

/** Adapter implementation using react-native-background-geolocation. */
export class TransistorAdapter implements BackgroundLocationAdapter {
  /** @inheritdoc */
  async ready(config: BackgroundLocationConfig): Promise<void> {
    await BackgroundGeolocation.ready({
      geolocation: {
        desiredAccuracy: mapAccuracy(config.desiredAccuracy),
        distanceFilter: config.distanceFilter,
      },
      http: {
        url: config.url,
        headers: config.headers,
        autoSync: true,
        batchSync: false,
      },
      persistence: {
        extras: config.extras,
      },
      app: {
        stopOnTerminate: config.stopOnTerminate,
        startOnBoot: !config.stopOnTerminate,
      },
      logger: {
        debug: false,
      },
    });
  }

  /** @inheritdoc */
  async start(): Promise<void> {
    await BackgroundGeolocation.start();
  }

  /** @inheritdoc */
  async stop(): Promise<void> {
    await BackgroundGeolocation.stop();
  }

  /** @inheritdoc */
  async setConfig(config: Partial<BackgroundLocationConfig>): Promise<void> {
    const patch: Record<string, unknown> = {};

    if (config.extras) {
      patch.persistence = { extras: config.extras };
    }
    if (config.headers) {
      patch.http = { headers: config.headers };
    }
    if (config.desiredAccuracy !== undefined) {
      patch.geolocation = {
        ...(patch.geolocation as Record<string, unknown> | undefined),
        desiredAccuracy: mapAccuracy(config.desiredAccuracy),
      };
    }
    if (config.distanceFilter !== undefined) {
      patch.geolocation = {
        ...(patch.geolocation as Record<string, unknown> | undefined),
        distanceFilter: config.distanceFilter,
      };
    }

    await BackgroundGeolocation.setConfig(patch);
  }
}
