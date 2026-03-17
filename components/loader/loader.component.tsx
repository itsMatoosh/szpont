import { ActivityIndicator, View } from 'react-native';

/** Full-screen centered circular spinner shown while async setup is in progress. */
export function Loader() {
  return (
    <View className="flex-1 items-center justify-center">
      <ActivityIndicator size="large" />
    </View>
  );
}
