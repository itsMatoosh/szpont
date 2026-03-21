import { StyleSheet, View } from 'react-native';
import Animated, { Keyframe } from 'react-native-reanimated';

import { GameInactiveView } from '@/components/game-inactive-view/game-inactive-view.component';
import { GameLiveActiveView } from '@/components/game-live-active-view/game-live-active-view.component';
import { GameLiveLobbyView } from '@/components/game-live-lobby-view/game-live-lobby-view.component';
import { GameLivePassiveView } from '@/components/game-live-passive-view/game-live-passive-view.component';
import { useGameActive } from '@/hooks/game-active/use-game-active.hook';
import { useProfileContext } from '@/hooks/profile/profile.context';
import { useSelectedZoneContext } from '@/hooks/selected-zone/selected-zone.context';

/** Enter transition: fade in while scaling up to full size. */
const VIEW_ENTERING = new Keyframe({
  0: { opacity: 0, transform: [{ scale: 0.96 }] },
  100: { opacity: 1, transform: [{ scale: 1 }] },
}).duration(320);

/** Exit transition: fade out while scaling down slightly. */
const VIEW_EXITING = new Keyframe({
  0: { opacity: 1, transform: [{ scale: 1 }] },
  100: { opacity: 0, transform: [{ scale: 0.98 }] },
}).duration(320);

/** Discover tab root that crossfades between lobby and zone states. */
export default function DiscoverTabScreen() {
  const { activeZoneId } = useSelectedZoneContext();
  const { profile } = useProfileContext();
  const isGameActive = useGameActive();
  const isMaleUser = profile?.gender === 'male';

  return (
    <View className="flex-1 bg-background">
      {isGameActive && (
        <>
          {activeZoneId != null && (
            <>
              {isMaleUser ? (
                <Animated.View
                  key="game-live-active-view"
                  entering={VIEW_ENTERING}
                  exiting={VIEW_EXITING}
                  style={StyleSheet.absoluteFill}
                >
                  <GameLiveActiveView zoneId={activeZoneId} />
                </Animated.View>
              ) : (
                <Animated.View
                  key="game-live-passive-view"
                  entering={VIEW_ENTERING}
                  exiting={VIEW_EXITING}
                  style={StyleSheet.absoluteFill}
                >
                  <GameLivePassiveView zoneId={activeZoneId} />
                </Animated.View>
              )}

            </>
          )}
          {activeZoneId == null && (
            <Animated.View
              key="game-live-lobby-view"
              entering={VIEW_ENTERING}
              exiting={VIEW_EXITING}
              style={StyleSheet.absoluteFill}
            >
              <GameLiveLobbyView />
            </Animated.View>
          )}
        </>
      )}
      {!isGameActive && (
        <Animated.View
          key="game-inactive-view"
          entering={VIEW_ENTERING}
          exiting={VIEW_EXITING}
          style={StyleSheet.absoluteFill}
        >
          <GameInactiveView />
        </Animated.View>
      )}
    </View>
  );
}
