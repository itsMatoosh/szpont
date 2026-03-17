import { useTranslation } from 'react-i18next';
import { Text, useColorScheme, View } from 'react-native';

import { AccentTitle } from '@/components/accent-title/accent-title.component';

const nunitoRegular = { fontFamily: 'Nunito_400Regular' } as const;

/** Slide 6 — notification permissions: "know when your squad is out". */
export function SlideNotifications() {
  const { t } = useTranslation();
  const isLight = useColorScheme() === 'light';

  return (
    <View className="flex-1 items-center justify-center px-8">
      <AccentTitle
        before={t('welcome.slideNotifTitleBefore')}
        accent={t('welcome.slideNotifTitleAccent')}
        after={t('welcome.slideNotifTitleAfter')}
        large
        outlined={isLight}
      />
      <Text className="text-muted text-xl text-center mt-4 leading-relaxed" style={nunitoRegular}>
        {t('welcome.slideNotifSubtitle')}
      </Text>
    </View>
  );
}
