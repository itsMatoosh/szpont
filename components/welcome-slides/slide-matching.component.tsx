import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, useColorScheme, View } from 'react-native';

import { AccentTitle } from '@/components/accent-title/accent-title.component';

const nunitoRegular = { fontFamily: 'Nunito_400Regular' } as const;

/** Two overlapping swipe cards with profile photos. */
function CardStackPlaceholder() {
  return (
    <View className="items-center justify-center" style={styles.visualContainer}>
      <View style={[styles.card, styles.cardBack]} className="bg-surface border border-border rounded-3xl overflow-hidden">
        <Image source={require('@/assets/images/swipe-2.jpg')} style={{ width: '100%', height: '100%' }} contentFit="cover" />
      </View>
      <View style={[styles.card, styles.cardFront]} className="bg-surface border border-border rounded-3xl overflow-hidden">
        <Image source={require('@/assets/images/swipe-1.jpg')} style={{ width: '100%', height: '100%' }} contentFit="cover" />
        <View className="absolute bottom-0 left-0 right-0 items-center pb-4">
          <Ionicons name="heart" size={36} color="#CCFF00" />
        </View>
      </View>
    </View>
  );
}

/** Slide 2 — matching: card stack visual + "find your squad" title. */
export function SlideMatching() {
  const { t } = useTranslation();
  const isLight = useColorScheme() === 'light';

  return (
    <View className="flex-1 justify-center items-center px-8">
      <CardStackPlaceholder />
      <View className="mt-8">
        <AccentTitle
          before={t('welcome.slide2TitleBefore')}
          accent={t('welcome.slide2TitleAccent')}
          outlined={isLight}
        />
        <Text className="text-muted text-lg text-center mt-4 leading-relaxed" style={nunitoRegular}>
          {t('welcome.slide2Subtitle')}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  visualContainer: {
    width: '100%',
    aspectRatio: 0.75,
    maxHeight: '45%',
  },
  card: {
    width: 220,
    height: 300,
    position: 'absolute',
  },
  cardBack: {
    transform: [{ rotate: '-6deg' }, { translateX: -20 }],
    opacity: 0.5,
  },
  cardFront: {
    transform: [{ rotate: '3deg' }, { translateX: 10 }],
  },
});
