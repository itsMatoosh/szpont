import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

/**
 * Meets tab placeholder while the redesigned meets experience is being rebuilt.
 */
export default function MeetsTabScreen() {
  const { t } = useTranslation();

  return (
    <View className="flex-1 items-center justify-center bg-background px-6">
      <Text className="text-2xl text-foreground" style={{ fontFamily: 'Nunito_700Bold' }}>
        {t('placeholders.meetsTitle')}
      </Text>
      <Text
        className="mt-3 text-center text-base text-muted-foreground"
        style={{ fontFamily: 'Nunito_400Regular' }}
      >
        {t('placeholders.meetsBody')}
      </Text>
    </View>
  );
}
