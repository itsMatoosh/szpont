/**
 * Background location adapter using `expo-location` + `expo-task-manager`.
 *
 * This is the free alternative to the paid Transistor plugin. It registers a
 * background location task that the OS wakes periodically to deliver batched
 * positions. Each delivery triggers a fire-and-forget POST to the Edge
 * Function; failures are silently dropped because only the most current
 * location matters.
 *
 * The task itself is defined in `./expo-background-task.util.ts` at module
 * scope (required by TaskManager). This adapter merely configures and
 * starts/stops the underlying `expo-location` subscription.
 */

import * as Location from 'expo-location';

import type {
  BackgroundLocationAdapter,
  BackgroundLocationConfig,
} from './background-location.adapter';
import {
  EXPO_LOCATION_TASK,
  persistBgLocationConfig,
} from './expo-background-task.util';

/** Maps our portable accuracy enum to expo-location's enum. */
function mapAccuracy(accuracy: BackgroundLocationConfig['desiredAccuracy']): Location.Accuracy {
  switch (accuracy) {
    case 'high':
      return Location.Accuracy.High;
    case 'balanced':
      return Location.Accuracy.Balanced;
  }
}

/** Adapter implementation using expo-location background updates. */
export class ExpoAdapter implements BackgroundLocationAdapter {
  private config: BackgroundLocationConfig | null = null;

  /** @inheritdoc */
  async ready(config: BackgroundLocationConfig): Promise<void> {
    this.config = config;
    persistBgLocationConfig({
      url: config.url,
      headers: config.headers,
      extras: config.extras,
    });
  }

  /** @inheritdoc */
  async start(): Promise<void> {
    if (!this.config) {
      throw new Error('ExpoAdapter.ready() must be called before start()');
    }

    await Location.startLocationUpdatesAsync(EXPO_LOCATION_TASK, {
      accuracy: mapAccuracy(this.config.desiredAccuracy),
      distanceInterval: this.config.distanceFilter,
      showsBackgroundLocationIndicator: true,
      pausesUpdatesAutomatically: false,
      activityType: Location.ActivityType.Fitness,
    });
  }

  /** @inheritdoc */
  async stop(): Promise<void> {
    const isRunning = await Location.hasStartedLocationUpdatesAsync(EXPO_LOCATION_TASK);
    if (isRunning) {
      await Location.stopLocationUpdatesAsync(EXPO_LOCATION_TASK);
    }
  }

  /** @inheritdoc */
  async setConfig(patch: Partial<BackgroundLocationConfig>): Promise<void> {
    if (!this.config) return;

    this.config = { ...this.config, ...patch };

    // Persist the merged config so the background task picks it up
    persistBgLocationConfig({
      url: this.config.url,
      headers: this.config.headers,
      extras: this.config.extras,
    });
  }
}
