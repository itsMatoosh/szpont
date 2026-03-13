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

/** Root layout: provides theme, query client, and blocks rendering while auth is resolving. */
export default function RootLayout() {
  const scheme = useColorScheme();
  const { session, isLoading } = useAuth();

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
        <LocationPermissionProvider initialSnapshot={locationPermissionSnapshot}>
          <CurrentLocationProvider>
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Protected guard={!session}>
                <Stack.Screen name="login" />
              </Stack.Protected>

              <Stack.Protected guard={!!session}>
                <Stack.Screen name="(tabs)" />
                <Stack.Screen name="zone/[id]" />
              </Stack.Protected>
            </Stack>
          </CurrentLocationProvider>
        </LocationPermissionProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
