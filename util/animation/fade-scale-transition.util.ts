import { Keyframe } from 'react-native-reanimated';

const FADE_SCALE_DURATION_MS = 320;

/** Creates a fade-scale enter transition with optional delay. */
export function createFadeScaleEnteringTransition(delayMs = 0) {
  return new Keyframe({
    0: { opacity: 0, transform: [{ scale: 0.96 }] },
    100: { opacity: 1, transform: [{ scale: 1 }] },
  })
    .duration(FADE_SCALE_DURATION_MS)
    .delay(delayMs);
}

/** Creates a fade-scale exit transition with optional delay. */
export function createFadeScaleExitingTransition(delayMs = 0) {
  return new Keyframe({
    0: { opacity: 1, transform: [{ scale: 1 }] },
    100: { opacity: 0, transform: [{ scale: 0.98 }] },
  })
    .duration(FADE_SCALE_DURATION_MS)
    .delay(delayMs);
}
