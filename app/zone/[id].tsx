import { useQuery } from '@tanstack/react-query';
import { Link, useLocalSearchParams } from 'expo-router';
import { Dimensions, View } from 'react-native';

import { ZoneParallax } from '@/components/zone-parallax/zone-parallax.component';
import { useDeviceMotionTilt } from '@/hooks/device-motion/use-device-motion.hook';
import { getZone } from '@/util/zones/zones.util';

const { width, height } = Dimensions.get('window');
const PARALLAX_HEIGHT = height * 0.6;

/** Zone detail screen — placeholder with the gyro parallax header as the zoom transition target. */
export default function ZoneScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: zone } = useQuery({ queryKey: ['zone', id], queryFn: () => getZone(id) });
  const { tiltX, tiltY } = useDeviceMotionTilt();

  return (
    <View className="flex-1">
      <Link.AppleZoomTarget>
        <View>
          {zone && (
            <ZoneParallax
              zone={zone}
              tiltX={tiltX}
              tiltY={tiltY}
              width={width}
              height={PARALLAX_HEIGHT}
            />
          )}
        </View>
      </Link.AppleZoomTarget>

      {/* Placeholder for future zone content */}
      <View className="flex-1" />
    </View>
  );
}
