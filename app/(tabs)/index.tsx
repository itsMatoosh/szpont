import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

/**
 * Swipe / discover tab placeholder until card-based matching is implemented.
 */
export default function SwipeTabScreen() {
  const { t } = useTranslation();

  return (
    <View className="flex-1 items-center justify-center bg-background px-8">
      <Text className="text-2xl font-bold text-foreground">{t('swipeTab.title')}</Text>
      <Text className="mt-3 text-center text-base text-muted">{t('swipeTab.subtitle')}</Text>
    </View>
  );
}
