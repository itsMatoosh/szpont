import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Text, View } from 'react-native';

import { nunitoSemiBold } from '@/util/fonts/fonts.util';

/** Terminal onboarding slide shown while the profile is being created. */
export function StepLoading() {
  const { t } = useTranslation();

  return (
    <View style={{ flex: 1 }} className="px-8 justify-center items-center">
      <ActivityIndicator size="large" style={{ marginBottom: 16 }} />
      <Text className="text-xl text-foreground text-center" style={nunitoSemiBold}>
        {t('onboarding.creatingProfile')}
      </Text>
    </View>
  );
}
