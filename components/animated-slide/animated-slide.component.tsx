import { Dimensions } from 'react-native';
import Animated, {
  interpolate,
  SharedValue,
  useAnimatedStyle,
} from 'react-native-reanimated';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export type AnimatedSlideProps = {
  /** Zero-based index of this slide in the horizontal pager. */
  index: number;
  /** Reanimated shared value tracking horizontal scroll offset (e.g. contentOffset.x). */
  scrollX: SharedValue<number>;
  children: React.ReactNode;
};

/** Wraps a slide's content with scroll-driven fade and vertical translation for horizontal paged flows (welcome, onboarding). */
export function AnimatedSlide({ index, scrollX, children }: AnimatedSlideProps) {
  const animatedStyle = useAnimatedStyle(() => {
    const inputRange = [
      (index - 1) * SCREEN_WIDTH,
      index * SCREEN_WIDTH,
      (index + 1) * SCREEN_WIDTH,
    ];
    const opacity = interpolate(scrollX.value, inputRange, [0, 1, 0], 'clamp');
    const translateY = interpolate(scrollX.value, inputRange, [30, 0, 30], 'clamp');
    return { opacity, transform: [{ translateY }] };
  });

  return (
    <Animated.View style={[{ width: SCREEN_WIDTH, flex: 1 }, animatedStyle]}>
      {children}
    </Animated.View>
  );
}
