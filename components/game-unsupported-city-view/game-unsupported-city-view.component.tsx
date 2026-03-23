import { Text, View } from 'react-native';

import { type City } from '@/util/cities/cities.util';

interface GameUnsupportedCityViewProps {
  currentCity: City | null;
}

/** Placeholder shown when the user is outside all currently supported cities. */
export function GameUnsupportedCityView({ currentCity }: GameUnsupportedCityViewProps) {
  return (
    <View className="flex-1 items-center justify-center bg-background px-6">
      <Text className="text-center text-2xl text-foreground" style={{ fontFamily: 'Nunito_700Bold' }}>
        City Not Supported Yet
      </Text>
      <Text className="mt-3 text-center text-base text-muted" style={{ fontFamily: 'Nunito_400Regular' }}>
        We couldn&apos;t match your current location to a supported city.
      </Text>
      {currentCity?.name != null && (
        <Text className="mt-1 text-center text-sm text-muted" style={{ fontFamily: 'Nunito_400Regular' }}>
          Resolved city: {currentCity.name}
        </Text>
      )}
      <Text className="mt-1 text-center text-sm text-muted" style={{ fontFamily: 'Nunito_400Regular' }}>
        Move into a supported city to access live game views.
      </Text>
    </View>
  );
}
