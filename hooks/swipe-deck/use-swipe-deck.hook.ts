import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useWindowDimensions } from 'react-native';
import { Gesture } from 'react-native-gesture-handler';
import {
  cancelAnimation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

/** Outcome of a completed swipe (gesture or Skip / Like). */
export type SwipeDismissDirection = 'left' | 'right';

const SPRING_SNAP = { damping: 28, stiffness: 260 };
const EXIT_DURATION_MS = 280;

interface UseSwipeDeckParams<T extends { id: string }> {
  /** Queue of profiles; index `0` is the interactive top card. */
  items: T[];
  /** Called after the fly-off animation; parent should remove the front item (e.g. `dismissFront`). */
  onDismissComplete: (item: T, direction: SwipeDismissDirection) => void;
}

interface UseSwipeDeckResult {
  /** Pan gesture for the top card only — attach with `GestureDetector`. */
  topCardPanGesture: ReturnType<typeof Gesture.Pan>;
  /** Transform + rotation for the draggable top card. */
  topCardAnimatedStyle: ReturnType<typeof useAnimatedStyle>;
  /** Opacity for a “skip” hint overlay (stronger when dragging left). */
  passLabelAnimatedStyle: ReturnType<typeof useAnimatedStyle>;
  /** Opacity for a “like” hint overlay (stronger when dragging right). */
  likeLabelAnimatedStyle: ReturnType<typeof useAnimatedStyle>;
  /** Programmatic skip — same animation and completion as swiping left. */
  skipCard: () => void;
  /** Programmatic like — same animation and completion as swiping right. */
  likeCard: () => void;
}

/**
 * Drives Tinder-style pan physics and a single dismiss pipeline shared by gestures
 * and Skip / Like buttons. Guards against overlapping dismissals.
 */
export function useSwipeDeck<T extends { id: string }>({
  items,
  onDismissComplete,
}: UseSwipeDeckParams<T>): UseSwipeDeckResult {
  const { width: windowWidth } = useWindowDimensions();
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const screenWidthSV = useSharedValue(windowWidth);
  const isDismissingSV = useSharedValue(false);

  const isDismissingRef = useRef(false);
  const pendingItemRef = useRef<T | null>(null);
  const pendingDirectionRef = useRef<SwipeDismissDirection>('left');
  const itemsRef = useRef(items);
  const onDismissCompleteRef = useRef(onDismissComplete);

  itemsRef.current = items;
  onDismissCompleteRef.current = onDismissComplete;

  useEffect(() => {
    screenWidthSV.value = windowWidth;
  }, [screenWidthSV, windowWidth]);

  const topId = items[0]?.id;

  useEffect(() => {
    cancelAnimation(translateX);
    cancelAnimation(translateY);
    translateX.value = 0;
    translateY.value = 0;
    isDismissingSV.value = false;
    isDismissingRef.current = false;
  }, [isDismissingSV, topId, translateX, translateY]);

  const finalizeDismiss = useCallback(() => {
    const item = pendingItemRef.current;
    const direction = pendingDirectionRef.current;
    pendingItemRef.current = null;
    isDismissingRef.current = false;
    isDismissingSV.value = false;
    if (item) {
      onDismissCompleteRef.current(item, direction);
    }
  }, [isDismissingSV]);

  const runExitAnimation = useCallback(
    (direction: SwipeDismissDirection) => {
      const w = windowWidth;
      const targetX = direction === 'left' ? -w * 1.65 : w * 1.65;
      isDismissingRef.current = true;
      isDismissingSV.value = true;
      translateX.value = withTiming(targetX, { duration: EXIT_DURATION_MS }, (finished) => {
        'worklet';
        if (finished) {
          runOnJS(finalizeDismiss)();
        }
      });
      translateY.value = withTiming(0, { duration: EXIT_DURATION_MS });
    },
    [finalizeDismiss, isDismissingSV, translateX, translateY, windowWidth],
  );

  /** Shared entry for gestures and Skip / Like — captures `items[0]` then runs the exit animation. */
  const queueDismiss = useCallback(
    (direction: SwipeDismissDirection) => {
      if (isDismissingRef.current) return;
      const front = itemsRef.current[0];
      if (!front) return;
      pendingItemRef.current = front;
      pendingDirectionRef.current = direction;
      runExitAnimation(direction);
    },
    [runExitAnimation],
  );

  const skipCard = useCallback(() => queueDismiss('left'), [queueDismiss]);
  const likeCard = useCallback(() => queueDismiss('right'), [queueDismiss]);

  const topCardPanGesture = useMemo(
    () =>
      Gesture.Pan()
        .onUpdate((event) => {
          'worklet';
          if (isDismissingSV.value) return;
          translateX.value = event.translationX;
          translateY.value = event.translationY * 0.38;
        })
        .onEnd((event) => {
          'worklet';
          if (isDismissingSV.value) return;
          const w = screenWidthSV.value;
          const threshold = w * 0.22;
          const x = translateX.value;
          const vx = event.velocityX;
          const strongVelocity = Math.abs(vx) > 620;
          const pastEdge = Math.abs(x) > threshold;
          if (!pastEdge && !strongVelocity) {
            translateX.value = withSpring(0, SPRING_SNAP);
            translateY.value = withSpring(0, SPRING_SNAP);
            return;
          }
          const direction: SwipeDismissDirection =
            x > 0 || (Math.abs(x) < 8 && vx > 0) ? 'right' : 'left';
          runOnJS(queueDismiss)(direction);
        }),
    [isDismissingSV, queueDismiss, screenWidthSV, translateX, translateY],
  );

  const topCardAnimatedStyle = useAnimatedStyle(() => {
    const w = screenWidthSV.value;
    const rotate = interpolate(translateX.value, [-w / 2, 0, w / 2], [-14, 0, 14], 'clamp');
    return {
      transform: [{ translateX: translateX.value }, { translateY: translateY.value }, { rotate: `${rotate}deg` }],
    };
  });

  const passLabelAnimatedStyle = useAnimatedStyle(() => {
    const w = screenWidthSV.value;
    const opacity = interpolate(translateX.value, [-w * 0.15, -w * 0.45], [0, 1], 'clamp');
    return { opacity };
  });

  const likeLabelAnimatedStyle = useAnimatedStyle(() => {
    const w = screenWidthSV.value;
    const opacity = interpolate(translateX.value, [w * 0.15, w * 0.45], [0, 1], 'clamp');
    return { opacity };
  });

  return {
    topCardPanGesture,
    topCardAnimatedStyle,
    passLabelAnimatedStyle,
    likeLabelAnimatedStyle,
    skipCard,
    likeCard,
  };
}
