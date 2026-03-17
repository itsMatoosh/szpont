import { useTranslation } from 'react-i18next';
import { Text, useColorScheme, View } from 'react-native';

import { AccentTitle } from '@/components/accent-title/accent-title.component';

const nunitoRegular = { fontFamily: 'Nunito_400Regular' } as const;

/** Slide 5 — closing CTA: "don't be afraid to say hi, you've got the green light". */
export function SlideCta() {
  const { t } = useTranslation();
  const isLight = useColorScheme() === 'light';

  return (
    <View className="flex-1 items-center justify-center px-8">
      <AccentTitle
        before={t('welcome.slide5TitleBefore')}
        accent={t('welcome.slide5TitleAccent')}
        large
        outlined={isLight}
      />
      <Text className="text-muted text-xl text-center mt-4 leading-relaxed" style={nunitoRegular}>
        {t('welcome.slide5Subtitle')}
      </Text>
    </View>
  );
}
