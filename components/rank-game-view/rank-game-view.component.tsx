import RNBounceable from '@freakycoder/react-native-bounceable';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View, type ViewStyle } from 'react-native';

import { RankGameProfileCard } from './rank-game-profile-card.component';
import { useGameInactiveDrop } from '@/hooks/game-inactive/use-game-inactive-drop.hook';
import { useProfileContext } from '@/hooks/profile/profile.context';
import { type City } from '@/util/cities/cities.util';

interface RankGameViewProps {
  currentCity: City | null;
}

const EVEN_DROP_CARD_POSITIONS: ViewStyle[] = [
  { top: '4%', left: '2%', },
  { bottom: '4%', right: '2%', },
];

const ODD_DROP_CARD_POSITIONS: ViewStyle[] = [
  { bottom: '4%', left: '2%', },
  { top: '4%', right: '2%', },
];

const CARD_ROTATION_STYLES: ViewStyle[] = [
  { transform: [{ rotate: '-2deg' }] },
  { transform: [{ rotate: '2deg' }] },
];

/** Full rank game view with backend-served card drops and ELO updates. */
export function RankGameView({ currentCity }: RankGameViewProps) {
  const { t } = useTranslation();
  const { profile } = useProfileContext();
  const {
    currentDrop,
    dropAlignment,
    isLoading,
    isSubmitting,
    isFinished,
    error,
    selectWinner,
    refresh,
  } = useGameInactiveDrop(profile?.id ?? null);

  const cardPositions = useMemo(
    () => (dropAlignment === 'even' ? EVEN_DROP_CARD_POSITIONS : ODD_DROP_CARD_POSITIONS),
    [dropAlignment],
  );

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center px-6">
        <Text className="text-2xl text-foreground" style={{ fontFamily: 'Nunito_700Bold' }}>
          {t('rankGame.preparingDrop')}
        </Text>
      </View>
    );
  }

  if (error) {
    return (
      <View className="flex-1 items-center justify-center px-6">
        <Text className="text-2xl text-foreground text-center" style={{ fontFamily: 'Nunito_700Bold' }}>
          {t('rankGame.loadErrorTitle')}
        </Text>
        <Text className="mt-3 text-center text-sm text-muted" style={{ fontFamily: 'Nunito_400Regular' }}>
          {error}
        </Text>
        <RNBounceable onPress={refresh} className="mt-6">
          <View className="rounded-2xl bg-accent px-6 py-3">
            <Text className="text-on-accent" style={{ fontFamily: 'Nunito_700Bold' }}>
              {t('rankGame.retry')}
            </Text>
          </View>
        </RNBounceable>
      </View>
    );
  }

  if (isFinished) {
    return (
      <View className="flex-1 items-center justify-center px-6">
        <Text className="text-2xl text-foreground text-center" style={{ fontFamily: 'Nunito_700Bold' }}>
          {t('rankGame.emptyTitle')}
        </Text>
        <Text className="mt-3 text-center text-base text-muted" style={{ fontFamily: 'Nunito_400Regular' }}>
          {t('rankGame.emptyDescription')}
        </Text>
        <RNBounceable onPress={refresh} className="mt-6">
          <View className="rounded-2xl bg-accent px-6 py-3">
            <Text className="text-on-accent" style={{ fontFamily: 'Nunito_700Bold' }}>
              {t('rankGame.refreshProfiles')}
            </Text>
          </View>
        </RNBounceable>
      </View>
    );
  }

  return (
    <View className="flex-1">
      {currentDrop.map((candidate, index) => (
        <RankGameProfileCard
          key={candidate.id}
          candidate={candidate}
          index={index}
          onPress={() => selectWinner(candidate.id)}
          disabled={isSubmitting}
          positionStyle={cardPositions[index]}
          rotationStyle={CARD_ROTATION_STYLES[index]}
        />
      ))}
    </View>
  );
}
