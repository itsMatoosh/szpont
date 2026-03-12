import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

export default function ProfileScreen() {
  const { t } = useTranslation();

  return (
    <View className="flex-1 items-center justify-center">
      <Text className="text-2xl font-semibold text-foreground">
        {t('profile.title')}
      </Text>
    </View>
  );
}
