import { Text, View } from 'react-native';

/** Placeholder shown while the game is currently inactive. */
export function GameInactiveView() {
  return (
    <View className="flex-1 items-center justify-center bg-background px-6">
      <Text className="text-2xl text-foreground" style={{ fontFamily: 'Nunito_700Bold' }}>
        Game Inactive Lobby
      </Text>
      <Text className="mt-3 text-center text-base text-muted" style={{ fontFamily: 'Nunito_400Regular' }}>
        The game is currently inactive. Check back during active hours.
      </Text>
    </View>
  );
}
