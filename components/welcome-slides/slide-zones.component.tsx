import { useTranslation } from 'react-i18next';
import { useColorScheme, View } from 'react-native';

import { AccentTitle } from '@/components/accent-title/accent-title.component';

/** Slide 3 — zone activation: "on friday and saturday we activate meetup zones across the city". */
export function SlideZones() {
  const { t } = useTranslation();
  const isLight = useColorScheme() === 'light';

  return (
    <View className="flex-1 items-center justify-center px-8">
      <AccentTitle
        before={t('welcome.slide3TitleBefore')}
        accent={t('welcome.slide3TitleAccent')}
        after={t('welcome.slide3TitleAfter')}
        large
        outlined={isLight}
      />
    </View>
  );
}
