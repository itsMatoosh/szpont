import RNBounceable from '@freakycoder/react-native-bounceable';
import { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { useForegroundLocationPermission } from '@/hooks/location/use-foreground-location-permission.hook';

interface ForegroundLocationGateProps {
  title: string;
  message: string;
  children: ReactNode;
}

/**
 * Conditionally renders children only when foreground location permission is
 * granted. Shows a prompt with a contextual action button for all other states.
 */
export function ForegroundLocationGate({ title, message, children }: ForegroundLocationGateProps) {
  const { status, request, openSettings } = useForegroundLocationPermission();
  const { t } = useTranslation();

  if (status === 'loading') return null;
  if (status === 'granted') return <>{children}</>;

  return (
    <View className="flex-1 items-center justify-center px-8">
      <Text className="text-3xl font-bold text-foreground text-center">{title}</Text>
      <Text className="text-lg text-muted-foreground text-center mt-4">
        {status === 'restricted' ? t('locationGate.restricted') : message}
      </Text>

      {status === 'undetermined' && (
        <RNBounceable onPress={request}>
          <View className="bg-accent rounded-2xl px-8 py-4 mt-8">
            <Text className="text-lg font-semibold text-on-accent">{t('locationGate.grant')}</Text>
          </View>
        </RNBounceable>
      )}

      {status === 'denied' && (
        <RNBounceable onPress={openSettings}>
          <View className="bg-accent rounded-2xl px-8 py-4 mt-8">
            <Text className="text-lg font-semibold text-on-accent">{t('locationGate.openSettings')}</Text>
          </View>
        </RNBounceable>
      )}
    </View>
  );
}
