import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { useTranslation } from 'react-i18next';

import { useAuth } from '@/hooks/auth/use-auth.hook';

/** Tabs layout: shows the user avatar on the profile tab when available. */
export default function TabsLayout() {
  const { t } = useTranslation();
  const { session } = useAuth();

  const avatarUrl = session?.user.user_metadata?.avatar_url as string | undefined;

  return (
    <NativeTabs>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Icon sf="map" />
        <NativeTabs.Trigger.Label>{t('tabs.map')}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="profile">
        {avatarUrl ? (
          <NativeTabs.Trigger.Icon src={{ uri: avatarUrl }} />
        ) : (
          <NativeTabs.Trigger.Icon sf="person" />
        )}
        <NativeTabs.Trigger.Label>{t('tabs.profile')}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
