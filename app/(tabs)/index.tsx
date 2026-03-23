import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { GameInactiveView } from '@/components/game-inactive-view/game-inactive-view.component';
import { GameLiveActiveView } from '@/components/game-live-active-view/game-live-active-view.component';
import { GameLiveLobbyView } from '@/components/game-live-lobby-view/game-live-lobby-view.component';
import { GameLivePassiveView } from '@/components/game-live-passive-view/game-live-passive-view.component';
import { GameUnsupportedCityView } from '@/components/game-unsupported-city-view/game-unsupported-city-view.component';
import { useGameActiveContext } from '@/hooks/game-active/game-active.context';
import { useProfileContext } from '@/hooks/profile/profile.context';
import { useSelectedZoneContext } from '@/hooks/selected-zone/selected-zone.context';
import {
  createFadeScaleEnteringTransition,
  createFadeScaleExitingTransition,
} from '@/util/animation/fade-scale-transition.util';
import { useMemo } from 'react';

type DiscoverVisibleScreen =
  | 'game-live-active'
  | 'game-live-passive'
  | 'game-live-lobby'
  | 'game-inactive'
  | 'game-unsupported-city';

/**
 * Development-only override for forcing a specific screen on this tab.
 * Set to one of the `DiscoverVisibleScreen` values while developing.
 */
const DEBUG_SCREEN_OVERRIDE: DiscoverVisibleScreen | null = 'game-inactive';

/** Discover tab root that crossfades between lobby and zone states. */
export default function DiscoverTabScreen() {
  const { activeZoneId, nearestCity } = useSelectedZoneContext();
  const { profile } = useProfileContext();
  const { isGameActive } = useGameActiveContext();
  const isMaleUser = profile?.gender === 'male';

  // Determine the screen to show based on the game state and user gender.
  const resolvedScreen: DiscoverVisibleScreen = useMemo(() => {
    if (__DEV__ && DEBUG_SCREEN_OVERRIDE != null) {
      return DEBUG_SCREEN_OVERRIDE;
    }
    if (nearestCity == null) {
      return 'game-unsupported-city';
    }
    if (!isGameActive) {
      return 'game-inactive';
    }
    if (activeZoneId == null) {
      return 'game-live-lobby';
    }
    return isMaleUser ? 'game-live-active' : 'game-live-passive';
  }, [nearestCity, isGameActive, activeZoneId, isMaleUser]);

  // Ensure active/passive views can render when a debug override is used outside a zone.
  const zoneIdForView = activeZoneId ?? 'debug-zone';

  return (
    <View className="flex-1 bg-background">
      {resolvedScreen === 'game-live-active' && (
        <Animated.View
          key="game-live-active-view"
          entering={createFadeScaleEnteringTransition()}
          exiting={createFadeScaleExitingTransition()}
          style={StyleSheet.absoluteFill}
        >
          <GameLiveActiveView zoneId={zoneIdForView} currentCity={nearestCity} />
        </Animated.View>
      )}
      {resolvedScreen === 'game-live-passive' && (
        <Animated.View
          key="game-live-passive-view"
          entering={createFadeScaleEnteringTransition()}
          exiting={createFadeScaleExitingTransition()}
          style={StyleSheet.absoluteFill}
        >
          <GameLivePassiveView zoneId={zoneIdForView} currentCity={nearestCity} />
        </Animated.View>
      )}
      {resolvedScreen === 'game-live-lobby' && (
        <Animated.View
          key="game-live-lobby-view"
          entering={createFadeScaleEnteringTransition()}
          exiting={createFadeScaleExitingTransition()}
          style={StyleSheet.absoluteFill}
        >
          <GameLiveLobbyView currentCity={nearestCity} />
        </Animated.View>
      )}
      {resolvedScreen === 'game-inactive' && (
        <Animated.View
          key="game-inactive-view"
          entering={createFadeScaleEnteringTransition()}
          exiting={createFadeScaleExitingTransition()}
          style={StyleSheet.absoluteFill}
        >
          <GameInactiveView currentCity={nearestCity} />
        </Animated.View>
      )}
      {resolvedScreen === 'game-unsupported-city' && (
        <Animated.View
          key="game-unsupported-city-view"
          entering={createFadeScaleEnteringTransition()}
          exiting={createFadeScaleExitingTransition()}
          style={StyleSheet.absoluteFill}
        >
          <GameUnsupportedCityView currentCity={nearestCity} />
        </Animated.View>
      )}
    </View>
  );
}
