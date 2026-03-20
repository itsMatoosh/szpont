import { Stack } from 'expo-router';

/**
 * Squad tab stack so the screen can use a native header (title + conditional back).
 */
export default function SquadTabLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerTitleAlign: 'center',
        headerTitleStyle: { fontFamily: 'Nunito_700Bold' },
      }}
    />
  );
}
