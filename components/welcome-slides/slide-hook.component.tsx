import { useTranslation } from 'react-i18next';
import { useColorScheme, View } from 'react-native';

import { AccentTitle } from '@/components/accent-title/accent-title.component';

/** Slide 1 — the opening hook: "going out is more fun when you're meeting new people". */
export function SlideHook() {
  const { t } = useTranslation();
  const isLight = useColorScheme() === 'light';

  return (
    <View className="flex-1 items-center justify-center px-8">
      <AccentTitle
        before={t('welcome.slide1TitleBefore')}
        accent={t('welcome.slide1TitleAccent')}
        large
        outlined={isLight}
      />
    </View>
  );
}
