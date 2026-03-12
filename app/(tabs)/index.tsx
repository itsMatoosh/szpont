import { FlashList } from '@shopify/flash-list';
import { useQuery } from '@tanstack/react-query';
import { Dimensions, View } from 'react-native';

import { CARD_GAP, CARD_WIDTH, ZoneCard } from '@/components/zone-card/zone-card.component';
import { useDeviceMotionTilt } from '@/hooks/device-motion/use-device-motion.hook';
import { getZones } from '@/util/zones/zones.util';

const { width } = Dimensions.get('window');

const SNAP_INTERVAL = CARD_WIDTH + CARD_GAP;
const H_PADDING = (width - CARD_WIDTH) / 2;

export default function HomeScreen() {
  const { data: zones = [] } = useQuery({ queryKey: ['zones'], queryFn: getZones });
  const { tiltX, tiltY } = useDeviceMotionTilt();

  return (
    <View className="flex-1 justify-center">
      <FlashList
        data={zones}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <ZoneCard zone={item} tiltX={tiltX} tiltY={tiltY} />}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={SNAP_INTERVAL}
        snapToAlignment="center"
        decelerationRate="fast"
        contentContainerStyle={{ paddingHorizontal: H_PADDING }}
        ItemSeparatorComponent={() => <View style={{ width: CARD_GAP }} />}
      />
    </View>
  );
}
