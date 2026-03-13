import RNBounceable from '@freakycoder/react-native-bounceable';
import { FlashList } from '@shopify/flash-list';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'expo-router';
import { View } from 'react-native';

import { CARD_GAP, CARD_HEIGHT, CARD_SNAPPING_INTERVAL as CARD_SNAP_INTERVAL, CARD_WIDTH, ZoneCard } from '@/components/zone-card/zone-card.component';
import { useDeviceMotionTilt } from '@/hooks/device-motion/use-device-motion.hook';
import { getZones, Zone } from '@/util/zones/zones.util';

interface ZoneCardItemProps {
  item: Zone;
  tiltX: ReturnType<typeof useDeviceMotionTilt>['tiltX'];
  tiltY: ReturnType<typeof useDeviceMotionTilt>['tiltY'];
}

/** Single tappable zone card wired up to the zoom transition with bounce feedback. */
function ZoneCardItem({ item, tiltX, tiltY }: ZoneCardItemProps) {
  return (
    <Link href={{ pathname: '/zone/[id]', params: { id: item.id } }} asChild>
      <RNBounceable>
        <Link.AppleZoom>
          <ZoneCard zone={item} tiltX={tiltX} tiltY={tiltY} />
        </Link.AppleZoom>
      </RNBounceable>
    </Link>
  );
}

/** Home screen: horizontal zone list with a static Join button below. */
export default function HomeScreen() {
  const { data: zones = [] } = useQuery({ queryKey: ['zones'], queryFn: getZones });
  const { tiltX, tiltY } = useDeviceMotionTilt();

  return (
    <View className="flex-1 justify-center items-center">
      <View style={{ height: CARD_HEIGHT }}>
        <FlashList
          data={zones}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <ZoneCardItem item={item} tiltX={tiltX} tiltY={tiltY} />}
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={CARD_SNAP_INTERVAL}
          snapToAlignment="center"
          decelerationRate="fast"
          contentContainerStyle={{ paddingHorizontal: 2 * CARD_GAP }}
          ItemSeparatorComponent={() => <View style={{ width: CARD_GAP }} />}
        />
      </View>
    </View>
  );
}
