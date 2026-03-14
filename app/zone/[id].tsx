import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';

import { getZone } from '@/util/zones/zones.util';

/** Zone detail screen — placeholder for future zone content. */
export default function ZoneScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: zone } = useQuery({ queryKey: ['zone', id], queryFn: () => getZone(id) });

  return (
    <View className="flex-1 items-center justify-center">
      {zone && (
        <Text className="text-3xl font-bold text-foreground">{zone.name}</Text>
      )}
    </View>
  );
}
