import { Text, View } from 'react-native';

interface GameLivePassiveViewProps {
  zoneId: string;
}

/** Placeholder shown for female users who are inside a zone during active game time. */
export function GameLivePassiveView({ zoneId }: GameLivePassiveViewProps) {
  return (
    <View className="flex-1 items-center justify-center bg-background px-6">
      <Text className="text-2xl text-foreground" style={{ fontFamily: 'Nunito_700Bold' }}>
        Game Live Passive
      </Text>
      <Text className="mt-3 text-center text-base text-muted" style={{ fontFamily: 'Nunito_400Regular' }}>
        You are inside zone {zoneId}.
      </Text>
    </View>
  );
}
