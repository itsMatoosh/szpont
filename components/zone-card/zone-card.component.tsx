import { Dimensions, View, Text } from 'react-native';
import { SharedValue } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';

import { ZoneParallax } from '@/components/zone-parallax/zone-parallax.component';
import { Zone } from '@/util/zones/zones.util';

const { width } = Dimensions.get('window');

// * CARD DIMENSIONS
export const CARD_GAP = 12;
export const CARD_WIDTH = width - CARD_GAP * 4;
const CARD_PADDING = 6;
const CARD_HINT_HEIGHT = 28;
export const CARD_HEIGHT =
  CARD_PADDING * 2
  + (CARD_WIDTH - CARD_PADDING * 2) * (4 / 3)
  + CARD_HINT_HEIGHT;
export const CARD_SNAPPING_INTERVAL = CARD_WIDTH + CARD_GAP * 2;

interface ZoneCardProps {
  zone: Zone;
  tiltX: SharedValue<number>;
  tiltY: SharedValue<number>;
}

/** Card shown in the horizontal home screen zone list. */
export function ZoneCard({ zone, tiltX, tiltY }: ZoneCardProps) {
  return (
    <View className="rounded-3xl overflow-hidden bg-accent p-[6px]" style={{ width: CARD_WIDTH }}>
      <View className='rounded-[18px] overflow-hidden' style={{ aspectRatio: 3 / 4 }}>
        {/* Zone parallax image */}
        <ZoneParallax zone={zone} tiltX={tiltX} tiltY={tiltY} />
        {/* Zone name */}
        <LinearGradient colors={['transparent', 'rgba(0, 0, 0, 0.8)']} style={{ position: 'absolute', bottom: 0, left: 0, right: 0, paddingVertical: 24, paddingHorizontal: 16, flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <Text className='text-5xl text-white font-black tracking-tighter leading-none'>{zone.name.toUpperCase()}</Text>
          <View className='flex-row items-center gap-2'>
            <View className='w-2 h-2 bg-accent rounded-full'></View>
            <Text className='text-xl text-white font-bold'>23 osoby na miejscu</Text>
          </View>
        </LinearGradient>
      </View>
      {/* Countdown timer */}
      <View className='flex-col items-center justify-center pt-2' style={{ height: CARD_HINT_HEIGHT }}>
        <Text className='text-md text-on-accent font-medium tracking-widest'>{"Starting in 10 seconds".toUpperCase()}</Text>
      </View>
    </View>
  );
}
