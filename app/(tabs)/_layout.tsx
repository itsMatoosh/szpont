import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { useTranslation } from 'react-i18next';
import { useColorScheme } from 'react-native';

import { Colors } from '@/util/theme/theme.util';

/**
 * Main app shell: system tab bar with three primary destinations (discover, meets, profile).
 */
export default function TabsLayout() {
  const { t } = useTranslation();
  const scheme = useColorScheme();
  const colors = scheme === 'dark' ? Colors.dark : Colors.light;

  return (
    <NativeTabs iconColor={{ default: colors.muted, selected: colors.foreground }}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>{t('tabs.discover')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: 'square.stack', selected: 'square.stack.fill' }}
          md="layers"
        />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="meets" disableTransparentOnScrollEdge>
        <NativeTabs.Trigger.Label>{t('tabs.meets')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: 'heart', selected: 'heart.fill' }}
          md="favorite"
        />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="profile">
        <NativeTabs.Trigger.Label>{t('tabs.profile')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: 'person.crop.circle', selected: 'person.crop.circle.fill' }}
          md="person"
        />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
