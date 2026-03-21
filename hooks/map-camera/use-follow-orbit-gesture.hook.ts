import { useCallback, useEffect, useMemo, useState } from 'react';
import { type LayoutChangeEvent } from 'react-native';
import { Gesture } from 'react-native-gesture-handler';
import { runOnJS, useSharedValue } from 'react-native-reanimated';

interface CameraPadding {
  paddingTop: number;
  paddingLeft: number;
  paddingRight: number;
  paddingBottom: number;
}

interface UseFollowOrbitGestureParams {
  /** Mapbox camera padding (safe area only) — pivot Y matches the follow viewport center. */
  cameraPadding: CameraPadding;
}

interface UseFollowOrbitGestureResult {
  followUserBearingDeg: number;
  followUserPanGesture: ReturnType<typeof Gesture.Pan>;
  onMapStackLayout: (event: LayoutChangeEvent) => void;
  resetFollowUserBearing: () => void;
}

/** Scales `(r × Δ) / |r|²` to degrees for follow-user orbit rotation (r = finger − puck). */
const FOLLOW_USER_ORBIT_DEG_SCALE = 140;
/** Added to `|r|²` so the pivot never divides by zero when the touch starts on the puck. */
const FOLLOW_USER_ORBIT_R2_EPS = 900;

/** Normalizes degrees to `[0, 360)`. */
function normalizeHeadingDeg(degrees: number): number {
  let value = degrees % 360;
  if (value < 0) value += 360;
  return value;
}

/**
 * Provides the follow-user orbit interaction:
 * a full-screen pan gesture rotates camera heading around the puck center.
 */
export function useFollowOrbitGesture({
  cameraPadding,
}: UseFollowOrbitGestureParams): UseFollowOrbitGestureResult {
  /** Manual map bearing while following the puck (driven by orbit-style pan around the puck). */
  const [followUserBearingDeg, setFollowUserBearingDeg] = useState(0);
  /** Map stack size in screen points; used to place the puck pivot (matches `followPadding` center). */
  const [mapStackLayout, setMapStackLayout] = useState<{ width: number; height: number } | null>(
    null,
  );

  /** Screen-space pivot matching Mapbox follow padding (puck sits in the middle of the padded viewport). */
  const followPuckCenterX = useSharedValue(0);
  const followPuckCenterY = useSharedValue(0);
  /** Last pan translation so each frame uses incremental movement. */
  const followPanLastTranslationX = useSharedValue(0);
  const followPanLastTranslationY = useSharedValue(0);

  const applyFollowUserBearingDelta = useCallback((deltaDeg: number) => {
    setFollowUserBearingDeg((prev) => normalizeHeadingDeg(prev + deltaDeg));
  }, []);

  useEffect(() => {
    if (!mapStackLayout) return;
    const { width: mapWidth, height: mapHeight } = mapStackLayout;
    followPuckCenterX.value = mapWidth / 2;
    followPuckCenterY.value =
      cameraPadding.paddingTop +
      (mapHeight - cameraPadding.paddingTop - cameraPadding.paddingBottom) / 2;
  }, [cameraPadding, followPuckCenterX, followPuckCenterY, mapStackLayout]);

  /** Pan updates follow bearing like twisting a dial around the puck. */
  const followUserPanGesture = useMemo(
    () =>
      Gesture.Pan()
        .minDistance(10)
        .onBegin(() => {
          'worklet';
          followPanLastTranslationX.value = 0;
          followPanLastTranslationY.value = 0;
        })
        .onUpdate((event) => {
          'worklet';
          const centerX = followPuckCenterX.value;
          const centerY = followPuckCenterY.value;
          const radiusX = event.x - centerX;
          const radiusY = event.y - centerY;
          const deltaX = event.translationX - followPanLastTranslationX.value;
          const deltaY = event.translationY - followPanLastTranslationY.value;
          followPanLastTranslationX.value = event.translationX;
          followPanLastTranslationY.value = event.translationY;
          const radiusSquared = radiusX * radiusX + radiusY * radiusY + FOLLOW_USER_ORBIT_R2_EPS;
          const crossed = radiusX * deltaY - radiusY * deltaX;
          // Negated so drag direction matches expected map yaw (clockwise / CCW around the puck).
          const deltaDeg = (-crossed / radiusSquared) * FOLLOW_USER_ORBIT_DEG_SCALE;
          runOnJS(applyFollowUserBearingDelta)(deltaDeg);
        })
        .onFinalize(() => {
          'worklet';
          followPanLastTranslationX.value = 0;
          followPanLastTranslationY.value = 0;
        }),
    [
      applyFollowUserBearingDelta,
      followPanLastTranslationX,
      followPanLastTranslationY,
      followPuckCenterX,
      followPuckCenterY,
    ],
  );

  const onMapStackLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setMapStackLayout({ width, height });
  }, []);

  const resetFollowUserBearing = useCallback(() => {
    setFollowUserBearingDeg(0);
  }, []);

  return {
    followUserBearingDeg,
    followUserPanGesture,
    onMapStackLayout,
    resetFollowUserBearing,
  };
}
