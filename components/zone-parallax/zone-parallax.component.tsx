import { Image } from 'expo-image';
import { useWindowDimensions, View } from 'react-native';
import Animated, { SharedValue, useAnimatedStyle } from 'react-native-reanimated';

import { Zone } from '@/util/zones/zones.util';

const BG_STRENGTH_X = 16;
const BG_STRENGTH_Y = 16;
const FG_STRENGTH_X = 6;
const FG_STRENGTH_Y = 6;
// Extra image size factor so parallax shift never reveals empty edges
const OVERFLOW = 1.1;

/** Clamps value to [min, max] — runs on the UI thread as a Reanimated worklet. */
function clamp(value: number, min: number, max: number) {
  'worklet';
  return Math.min(Math.max(value, min), max);
}

interface ZoneParallaxProps {
  zone: Zone;
  tiltX: SharedValue<number>;
  tiltY: SharedValue<number>;
}

/**
 * Full-bleed gyro parallax visualizer for a zone.
 * Renders a background and foreground image that shift independently in
 * response to device tilt, creating a depth effect.
 */
export function ZoneParallax({ zone, tiltX, tiltY }: ZoneParallaxProps) {
  // get screen width and height
  const { width, height } = useWindowDimensions();

  const bgStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: clamp(tiltX.value, -1, 1) * -BG_STRENGTH_X },
      { translateY: clamp(tiltY.value, -1, 1) * -BG_STRENGTH_Y },
    ],
  }));

  const fgStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: clamp(tiltX.value, -1, 1) * -FG_STRENGTH_X },
      { translateY: clamp(tiltY.value, -1, 1) * -FG_STRENGTH_Y },
    ],
  }));

  const imageStyle = {
    position: 'absolute' as const,
    width: '110%' as const,
    height: '110%' as const,
    top: -(height * (OVERFLOW - 1)) / 2,
    left: -(width * (OVERFLOW - 1)) / 2,
  };

  return (
    <View className='flex-1'>
      {/* Animated.View owns the parallax transform; expo-image handles caching */}
      <Animated.View style={[imageStyle, bgStyle]}>
        <Image
          source={{ uri: zone.background_image ?? undefined }}
          contentFit="cover"
          style={{ width: '100%', height: '100%' }}
        />
      </Animated.View>
      <Animated.View style={[imageStyle, fgStyle]}>
        <Image
          source={{ uri: zone.foreground_image ?? undefined }}
          contentFit="cover"
          style={{ width: '100%', height: '100%' }}
        />
      </Animated.View>
    </View>
  );
}
