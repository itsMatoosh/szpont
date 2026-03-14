import '../global.css';
import '@/util/i18n/i18n.util';

import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Asset } from 'expo-asset';
import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';

import { useAuth } from '@/hooks/auth/use-auth.hook';
import { CurrentLocationProvider } from '@/hooks/location/current-location.context';
import {
  LocationPermissionProvider,
  type LocationPermissionSnapshot,
  preloadLocationPermissions,
} from '@/hooks/location/location-permission.context';
import { ProfileProvider, useProfileContext } from '@/hooks/profile/profile.context';
import { Colors } from '@/util/theme/theme.util';

const queryClient = new QueryClient();

const lightTheme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, background: Colors.light.background },
};

const darkTheme = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: Colors.dark.background },
};

/** Root layout: provides theme, query client, profile context, and blocks rendering while resolving. */
export default function RootLayout() {
  const scheme = useColorScheme();
  const { session, user, isLoading } = useAuth();

  // Preload location permissions so the provider starts with real values
  const [locationPermissionSnapshot, setLocationPermissionSnapshot] = useState<LocationPermissionSnapshot | null>(null);
  useEffect(() => {
    preloadLocationPermissions().then(setLocationPermissionSnapshot);
  }, []);

  // Only preload the intro video once we know the user is unauthenticated
  const [introVideoPreloaded, setIntroVideoPreloaded] = useState(false);
  useEffect(() => {
    if (isLoading || session) return;
    Asset.loadAsync(require('@/assets/videos/intro_movie.mp4')).then(() =>
      setIntroVideoPreloaded(true),
    );
  }, [isLoading, session]);

  // Keep the splash screen visible while auth and location permissions resolve
  // (and while the video loads for unauthenticated users).
  if (isLoading || !locationPermissionSnapshot || (!session && !introVideoPreloaded)) return null;

  return (
    <ThemeProvider value={scheme === 'dark' ? darkTheme : lightTheme}>
      <QueryClientProvider client={queryClient}>
        <ProfileProvider user={user}>
          <LocationPermissionProvider initialSnapshot={locationPermissionSnapshot}>
            <CurrentLocationProvider>
              <RootNavigator session={session} />
            </CurrentLocationProvider>
          </LocationPermissionProvider>
        </ProfileProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

/** Inner navigator that reads profile from context to decide which screens are accessible. */
function RootNavigator({ session }: { session: unknown }) {
  const { profile, isLoading: profileLoading } = useProfileContext();

  if (profileLoading) return null;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!session}>
        <Stack.Screen name="login" />
      </Stack.Protected>

      <Stack.Protected guard={!!session && !profile}>
        <Stack.Screen name="onboarding" />
      </Stack.Protected>

      <Stack.Protected guard={!!session && !!profile}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="zone/[id]" />
      </Stack.Protected>
    </Stack>
  );
}
