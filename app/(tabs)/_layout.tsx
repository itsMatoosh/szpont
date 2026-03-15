import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { useTranslation } from 'react-i18next';
import { useColorScheme } from 'react-native';

import { useAuth } from '@/hooks/auth/use-auth.hook';
import {
  TabBarVisibilityProvider,
  useTabBarVisibility,
} from '@/hooks/tab-bar/tab-bar-visibility.context';
import { Colors } from '@/util/theme/theme.util';

/** Tabs layout: wraps the navigator with visibility context so screens can hide the tab bar. */
export default function TabsLayout() {
  return (
    <TabBarVisibilityProvider>
      <TabsNavigator />
    </TabBarVisibilityProvider>
  );
}

/** Inner navigator that reads the shared hidden flag and forwards it to NativeTabs. */
function TabsNavigator() {
  const { t } = useTranslation();
  const { session } = useAuth();
  const { hidden } = useTabBarVisibility();
  const colorScheme = useColorScheme();
  const primaryColor = colorScheme === 'dark' ? Colors.dark.foreground : Colors.light.foreground;

  const avatarUrl = session?.user.user_metadata?.avatar_url as string | undefined;

  return (
    <NativeTabs hidden={hidden} tintColor={primaryColor}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Icon sf={{ default: "map", selected: "map.fill" }} />
        <NativeTabs.Trigger.Label>{t('tabs.map')}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="profile">
        {avatarUrl ? (
          <NativeTabs.Trigger.Icon src={{ uri: avatarUrl }} />
        ) : (
          <NativeTabs.Trigger.Icon sf={{ default: "person", selected: "person.fill" }} />
        )}
        <NativeTabs.Trigger.Label>{t('tabs.profile')}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
