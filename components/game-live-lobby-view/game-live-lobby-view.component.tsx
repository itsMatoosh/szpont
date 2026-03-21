import { Text, View } from 'react-native';

/** Placeholder lobby shown while the game is active but the user is outside a zone. */
export function GameLiveLobbyView() {
  return (
    <View className="flex-1 items-center justify-center bg-background px-6">
      <Text className="text-2xl text-foreground" style={{ fontFamily: 'Nunito_700Bold' }}>
        Game Active Lobby
      </Text>
      <Text className="mt-3 text-center text-base text-muted" style={{ fontFamily: 'Nunito_400Regular' }}>
        Join an active zone during game hours to enter Zone View.
      </Text>
    </View>
  );
}
