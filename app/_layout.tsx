import '../global.css';
import '@/util/i18n/i18n.util';

import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Asset } from 'expo-asset';
import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';

import { useAuth } from '@/hooks/auth/use-auth.hook';
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

  // Only preload the intro video once we know the user is unauthenticated
  const [introVideoPreloaded, setIntroVideoPreloaded] = useState(false);
  useEffect(() => {
    if (isLoading || session) return;
    Asset.loadAsync(require('@/assets/videos/intro_movie.mp4')).then(() =>
      setIntroVideoPreloaded(true),
    );
  }, [isLoading, session]);

  // Keep the splash screen visible while auth resolves (and while the video
  // loads for unauthenticated users so playback starts immediately).
  if (isLoading || (!session && !introVideoPreloaded)) return null;

  return (
    <ThemeProvider value={scheme === 'dark' ? darkTheme : lightTheme}>
      <QueryClientProvider client={queryClient}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Protected guard={!session}>
            <Stack.Screen name="login" />
          </Stack.Protected>

          <Stack.Protected guard={!!session}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="zone/[id]" />
          </Stack.Protected>
        </Stack>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
