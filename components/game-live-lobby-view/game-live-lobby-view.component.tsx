import { Text, View } from 'react-native';

import { type City } from '@/util/cities/cities.util';

interface GameLiveLobbyViewProps {
  currentCity: City | null;
}

/** Placeholder lobby shown while the game is active but the user is outside a zone. */
export function GameLiveLobbyView({ currentCity }: GameLiveLobbyViewProps) {
  return (
    <View className="flex-1 items-center justify-center bg-background px-6">
      <Text className="text-2xl text-foreground" style={{ fontFamily: 'Nunito_700Bold' }}>
        Game Active Lobby
      </Text>
      <Text className="mt-3 text-center text-base text-muted" style={{ fontFamily: 'Nunito_400Regular' }}>
        Join an active zone during game hours to enter Zone View.
      </Text>
      <Text className="mt-1 text-center text-sm text-muted" style={{ fontFamily: 'Nunito_400Regular' }}>
        City: {currentCity?.name ?? 'Unknown'}
      </Text>
    </View>
  );
}
