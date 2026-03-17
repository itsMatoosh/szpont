import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, useColorScheme, View } from 'react-native';

import { AccentTitle } from '@/components/accent-title/accent-title.component';

const nunitoRegular = { fontFamily: 'Nunito_400Regular' } as const;

/** Slide 4 — zone explanation: square map with avatars + "when you enter a zone, others can approach you". */
export function SlideZoneExplanation() {
  const { t } = useTranslation();
  const isLight = useColorScheme() === 'light';

  return (
    <View className="flex-1 justify-center items-center px-8">
      {/* Square map with zone glow + scattered avatars */}
      <View className="w-full rounded-3xl overflow-hidden items-center justify-center" style={{ aspectRatio: 1 }}>
        <Image
          source={isLight ? require('@/assets/images/map-bg-light.jpg') : require('@/assets/images/map-bg-dark.jpg')}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
        />
        <View className="bg-accent rounded-full absolute" style={{ width: 220, height: 220, opacity: isLight ? 0.25 : 0.15 }} />
        <View className="rounded-full overflow-hidden border-2 border-accent absolute" style={{ width: 48, height: 48, top: '22%', left: '25%' }}>
          <Image source={require('@/assets/images/avatar-1.jpg')} style={{ width: '100%', height: '100%' }} contentFit="cover" />
        </View>
        <View className="rounded-full overflow-hidden border-2 border-accent absolute" style={{ width: 44, height: 44, top: '30%', right: '22%' }}>
          <Image source={require('@/assets/images/avatar-2.jpg')} style={{ width: '100%', height: '100%' }} contentFit="cover" />
        </View>
        <View className="rounded-full overflow-hidden border-2 border-accent absolute" style={{ width: 46, height: 46, top: '52%', left: '35%' }}>
          <Image source={require('@/assets/images/avatar-3.jpg')} style={{ width: '100%', height: '100%' }} contentFit="cover" />
        </View>
        <View className="rounded-full overflow-hidden border-2 border-accent absolute" style={{ width: 42, height: 42, top: '42%', right: '30%' }}>
          <Image source={require('@/assets/images/avatar-4.jpg')} style={{ width: '100%', height: '100%' }} contentFit="cover" />
        </View>
      </View>

      {/* Title */}
      <View className="mt-8">
        <AccentTitle
          before={t('welcome.slide4TitleBefore')}
          accent={t('welcome.slide4TitleAccent')}
          outlined={isLight}
        />
      </View>

      {/* Subtitle card */}
      <View className="rounded-2xl px-5 py-4 mt-6 flex-row items-center gap-3" style={{ backgroundColor: isLight ? '#f0f0f0' : 'rgba(28,28,28,0.8)' }}>
        <Ionicons name="lock-closed" size={18} color="#888" />
        <Text className="text-muted text-base leading-relaxed flex-1" style={nunitoRegular}>
          {t('welcome.slide4Subtitle')}
        </Text>
      </View>
    </View>
  );
}
