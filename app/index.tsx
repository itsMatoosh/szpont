import RNBounceable from '@freakycoder/react-native-bounceable';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/avatar/avatar.component';
import { MapView } from '@/components/map-view/map-view.component';
import { useAuth } from '@/hooks/auth/use-auth.hook';
import { useProfileContext } from '@/hooks/profile/profile.context';

/** Map screen with profile button overlay and persistent liquid glass sheet. */
export default function MapScreen() {
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const { profile } = useProfileContext();

  const avatarUrl = session?.user.user_metadata?.avatar_url as string | undefined;

  // Auto-present the persistent liquid glass bottom sheet on mount
  useEffect(() => {
    router.push('/sheet');
  }, []);

  return (
    <View style={styles.container}>
      <MapView />

      {/* Profile button — top right corner, above the map */}
      {profile && (
        <View style={[styles.profileButton, { top: insets.top + 8 }]}>
          <RNBounceable onPress={() => router.push('/profile')}>
            <Avatar uri={avatarUrl} name={profile.display_name} size={40} />
          </RNBounceable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  profileButton: {
    position: 'absolute',
    right: 16,
    zIndex: 10,
  },
});
