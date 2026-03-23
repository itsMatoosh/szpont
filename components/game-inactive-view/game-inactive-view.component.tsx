import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View, type TextStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GameInactiveCountdownCard } from '@/components/game-inactive-countdown-card/game-inactive-countdown-card.component';
import { RankGameView } from '@/components/rank-game-view/rank-game-view.component';
import { type City } from '@/util/cities/cities.util';
import { Ionicons } from '@expo/vector-icons';

interface GameInactiveViewProps {
  currentCity: City | null;
}

/** Inactive tab summary with an embedded rank game view. */
export function GameInactiveView({ currentCity }: GameInactiveViewProps) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();

  return (
    <View className="flex-1 px-4 gap-4" style={{ paddingBottom: insets.bottom + 16, paddingTop: insets.top }}>
      <View className="flex-row items-center">
        <View className="flex-1">
          <GameInactiveCountdownCard />
        </View>
        <View className="w-3" />
        <View className="aspect-square h-20 items-center justify-center bg-surface border border-border rounded-2xl">
          <Ionicons name="flame" size={24} color="#FF4500" />
          <Text className="text-sm text-muted" style={styles.nunitoBold}>100</Text>
        </View>
      </View>
      <View className="flex-1 bg-accent rounded-3xl p-4 flex-col">
        <Text className="text-2xl text-foreground" style={styles.nunitoBold}>
          {t('gameInactiveView.summaryTitle')}
        </Text>
        <Text className="text-foreground">
          {t('gameInactiveView.summarySubtitle')}
        </Text>

        <RankGameView currentCity={currentCity} />

        <Text className="text-center text-sm text-muted">
          {t('gameInactiveView.summaryHint')}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create<{
  nunitoBold: TextStyle;
}>({
  nunitoBold: {
    fontFamily: 'Nunito_700Bold',
  },
});
