import { Dimensions, View } from 'react-native';
import Animated, { SharedValue, useAnimatedStyle } from 'react-native-reanimated';

import { Zone } from '@/util/zones/zones.util';

const { width, height } = Dimensions.get('window');

export const CARD_WIDTH = width * 0.9;
const IDEAL_HEIGHT = CARD_WIDTH * (4 / 3);
const MAX_HEIGHT = height * 0.8;
export const CARD_HEIGHT = Math.min(IDEAL_HEIGHT, MAX_HEIGHT);
export const CARD_GAP = 16;

const BG_STRENGTH_X = 22;
const BG_STRENGTH_Y = 22;
const FG_STRENGTH_X = 8;
const FG_STRENGTH_Y = 8;
const OVERFLOW = 1.1;

function clamp(value: number, min: number, max: number) {
  'worklet';
  return Math.min(Math.max(value, min), max);
}

interface ZoneCardProps {
  zone: Zone;
  tiltX: SharedValue<number>;
  tiltY: SharedValue<number>;
}

export function ZoneCard({ zone, tiltX, tiltY }: ZoneCardProps) {
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

  return (
    <View
      style={{ width: CARD_WIDTH, height: CARD_HEIGHT }}
      className="rounded-3xl overflow-hidden"
    >
      <Animated.Image
        source={{ uri: zone.background_image ?? undefined }}
        style={[
          {
            position: 'absolute',
            width: CARD_WIDTH * OVERFLOW,
            height: CARD_HEIGHT * OVERFLOW,
            top: -(CARD_HEIGHT * (OVERFLOW - 1)) / 2,
            left: -(CARD_WIDTH * (OVERFLOW - 1)) / 2,
          },
          bgStyle,
        ]}
        resizeMode="cover"
      />
      <Animated.Image
        source={{ uri: zone.foreground_image ?? undefined }}
        style={[
          {
            position: 'absolute',
            width: CARD_WIDTH * OVERFLOW,
            height: CARD_HEIGHT * OVERFLOW,
            top: -(CARD_HEIGHT * (OVERFLOW - 1)) / 2,
            left: -(CARD_WIDTH * (OVERFLOW - 1)) / 2,
          },
          fgStyle,
        ]}
        resizeMode="cover"
      />
    </View>
  );
}
