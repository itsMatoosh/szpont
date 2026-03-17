import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SlidePermissions } from '@/components/welcome-slides/slide-permissions.component';

/**
 * Standalone permissions screen shown by a route guard when the user
 * has completed onboarding but hasn't granted required location permissions.
 * Automatically dismissed once all permissions are granted.
 */
export default function PermissionsScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}>
      <SlidePermissions />
    </View>
  );
}
