import '../global.css';
import '@/util/i18n/i18n.util';

// * Register background tasks at module scope
import '@/util/geofencing/geofencing.util';
import '@/util/background-location/expo-background-task.util';

import { Nunito_400Regular, Nunito_600SemiBold, Nunito_700Bold } from '@expo-google-fonts/nunito';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Asset } from 'expo-asset';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';

import { useAuth } from '@/hooks/auth/use-auth.hook';
import { useDeviceRegistration } from '@/hooks/device/use-device-registration.hook';
import { useGeofencingSetup } from '@/hooks/geofencing/use-geofencing-setup.hook';
import { CurrentLocationProvider } from '@/hooks/location/current-location.context';
import {
  LocationPermissionProvider,
  type LocationPermissionSnapshot,
  preloadLocationPermissions,
} from '@/hooks/location/location-permission.context';
import { useLocationPermissionsComplete } from '@/hooks/location/use-location-permissions-complete.hook';
import {
  NotificationPermissionProvider,
  type NotificationPermissionSnapshot,
  preloadNotificationPermissions,
} from '@/hooks/notifications/notification-permission.context';
import { useNotificationsSetup } from '@/hooks/notifications/use-notifications-setup.hook';
import { ProfileProvider, useProfileContext } from '@/hooks/profile/profile.context';
import { WelcomeProvider, useWelcome } from '@/hooks/welcome/welcome.context';

import { Loader } from '@/components/loader/loader.component';
import { Colors } from '@/util/theme/theme.util';

// Keep the native splash visible until we explicitly hide it
SplashScreen.preventAutoHideAsync();

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
  const [fontsLoaded] = useFonts({ Nunito_700Bold, Nunito_600SemiBold, Nunito_400Regular });
  const { session, user, isLoading } = useAuth();

  // Preload permission snapshots so providers start with real values
  const [locationSnapshot, setLocationSnapshot] = useState<LocationPermissionSnapshot | null>(null);
  const [notificationSnapshot, setNotificationSnapshot] = useState<NotificationPermissionSnapshot | null>(null);

  useEffect(() => {
    preloadLocationPermissions().then(setLocationSnapshot);
    preloadNotificationPermissions().then(setNotificationSnapshot);
  }, []);

  // Start preloading the intro video as soon as we know the user is unauthenticated
  const [introVideoPreloaded, setIntroVideoPreloaded] = useState(false);
  useEffect(() => {
    if (isLoading || session) return;
    Asset.loadAsync(require('@/assets/videos/intro_movie.mp4')).then(() =>
      setIntroVideoPreloaded(true),
    );
  }, [isLoading, session]);

  // Providers need complete data — keep rendering blocked until ready.
  // Video gate applies when the user is unauthenticated (login is the only pre-auth screen).
  const needsVideoGate = !session && !introVideoPreloaded;

  if (isLoading || !fontsLoaded || !locationSnapshot || !notificationSnapshot || needsVideoGate) return <Loader />;

  return (
    <ThemeProvider value={scheme === 'dark' ? darkTheme : lightTheme}>
      <QueryClientProvider client={queryClient}>
        <ProfileProvider user={user}>
          <LocationPermissionProvider initialSnapshot={locationSnapshot}>
            <NotificationPermissionProvider initialSnapshot={notificationSnapshot}>
              <CurrentLocationProvider>
                <WelcomeProvider>
                  <RootNavigator session={session} userId={user?.id ?? null} />
                </WelcomeProvider>
              </CurrentLocationProvider>
            </NotificationPermissionProvider>
          </LocationPermissionProvider>
        </ProfileProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

/**
 * Inner navigator that reads profile from context to decide which screens
 * are accessible. For authenticated users the three setup hooks run and
 * the splash screen stays visible until they all report ready.
 */
function RootNavigator({ session, userId }: { session: unknown; userId: string | null }) {
  const { profile, isLoading: profileLoading } = useProfileContext();
  const { hasSeenWelcome } = useWelcome();
  const locationReady = useLocationPermissionsComplete();

  // Always called (React rules of hooks); no-ops when inputs are null
  const { deviceId, backgroundSecret, isReady: deviceReady } = useDeviceRegistration(userId);
  const notificationsReady = useNotificationsSetup(deviceId);
  const geofencingReady = useGeofencingSetup(backgroundSecret);
  const allReady = !profileLoading && deviceReady && notificationsReady && geofencingReady;

  // Keep the native splash visible until everything is set up
  useEffect(() => {
    if (allReady) SplashScreen.hideAsync();
  }, [allReady]);

  // Fallback for flows where the splash has already been dismissed
  if (!allReady) return <Loader />;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!session}>
        <Stack.Screen name="login" />
      </Stack.Protected>

      <Stack.Protected guard={!!session && !hasSeenWelcome}>
        <Stack.Screen name="welcome" />
      </Stack.Protected>

      <Stack.Protected guard={!!session && hasSeenWelcome && !profile}>
        <Stack.Screen name="onboarding" />
      </Stack.Protected>

      <Stack.Protected guard={!!session && !!profile && !locationReady}>
        <Stack.Screen name="permissions" />
      </Stack.Protected>

      <Stack.Protected guard={!!session && !!profile && locationReady}>
        <Stack.Screen name="index" />
        <Stack.Screen
          name="sheet"
          options={{
            headerShown: false,
            presentation: 'formSheet',
            gestureEnabled: false,
            sheetGrabberVisible: true,
            contentStyle: { backgroundColor: 'transparent' },
            sheetAllowedDetents: [0.15, 1],
            sheetInitialDetentIndex: 0,
            sheetLargestUndimmedDetentIndex: 0,
          }}
        />
        <Stack.Screen
          name="profile"
          options={{
            headerShown: false,
            presentation: 'modal',
          }}
        />
        <Stack.Screen name="zone/[id]" />
        <Stack.Screen name="edit-profile" />
      </Stack.Protected>
    </Stack>
  );
}
