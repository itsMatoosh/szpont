import { Text, View } from 'react-native';

import { type City } from '@/util/cities/cities.util';

interface GameLivePassiveViewProps {
  zoneId: string;
  currentCity: City | null;
}

/** Placeholder shown for female users who are inside a zone during active game time. */
export function GameLivePassiveView({ zoneId, currentCity }: GameLivePassiveViewProps) {
  return (
    <View className="flex-1 items-center justify-center bg-background px-6">
      <Text className="text-2xl text-foreground" style={{ fontFamily: 'Nunito_700Bold' }}>
        Game Live Passive
      </Text>
      <Text className="mt-3 text-center text-base text-muted" style={{ fontFamily: 'Nunito_400Regular' }}>
        You are inside zone {zoneId}.
      </Text>
      <Text className="mt-1 text-center text-sm text-muted" style={{ fontFamily: 'Nunito_400Regular' }}>
        City: {currentCity?.name ?? 'Unknown'}
      </Text>
    </View>
  );
}
