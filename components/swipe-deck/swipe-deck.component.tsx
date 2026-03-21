import Ionicons from '@expo/vector-icons/Ionicons';
import RNBounceable from '@freakycoder/react-native-bounceable';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated, { type AnimatedStyle } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SwipeProfileCard } from '@/components/swipe-profile-card/swipe-profile-card.component';
import type { SwipeProfile } from '@/hooks/swipe-deck/use-swipe-feed.hook';
import { useSwipeDeck } from '@/hooks/swipe-deck/use-swipe-deck.hook';

const nunitoSemi = { fontFamily: 'Nunito_600SemiBold' } as const;
const nunitoRegular = { fontFamily: 'Nunito_400Regular' } as const;

const SCALE_STEP = 0.042;
const STACK_Y_STEP = 11;
/** Approximate native tab bar chrome height (excluding safe-area bottom). */
const NATIVE_TAB_BAR_HEIGHT = 56;

interface SwipeDeckProps {
  profiles: SwipeProfile[];
  isLoadingMore: boolean;
  onDismissComplete: (profile: SwipeProfile, direction: 'left' | 'right') => void;
  onResetFeed: () => void;
}

/**
 * Tinder-style stack: up to three cards, pan on the front card only, Skip / Like under the stack.
 */
export function SwipeDeck({
  profiles,
  isLoadingMore,
  onDismissComplete,
  onResetFeed,
}: SwipeDeckProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const bottomInset = insets.bottom + NATIVE_TAB_BAR_HEIGHT;

  const {
    topCardPanGesture,
    topCardAnimatedStyle,
    passLabelAnimatedStyle,
    likeLabelAnimatedStyle,
    skipCard,
    likeCard,
  } = useSwipeDeck<SwipeProfile>({ items: profiles, onDismissComplete });

  const frontThree = profiles.slice(0, 3);

  if (profiles.length === 0) {
    return (
      <View className="flex-1 items-center justify-center px-8" style={{ paddingTop: insets.top }}>
        {isLoadingMore ? (
          <Text className="text-center text-base text-muted" style={nunitoRegular}>
            {t('swipeTab.loadingMore')}
          </Text>
        ) : (
          <>
            <Text className="text-center text-base text-muted" style={nunitoRegular}>
              {t('swipeTab.empty')}
            </Text>
            <RNBounceable onPress={onResetFeed} style={styles.resetWrap}>
              <View className="bg-accent rounded-2xl px-6 py-3 mt-6">
                <Text className="text-on-accent font-semibold" style={nunitoSemi}>
                  {t('swipeTab.startOver')}
                </Text>
              </View>
            </RNBounceable>
          </>
        )}
      </View>
    );
  }

  return (
    <View className="flex-1">
      <View style={styles.deckColumn}>
        <View style={styles.stackFrame}>
          {[2, 1, 0].filter((i) => i < frontThree.length).map((stackPos) => {
            const profile = frontThree[stackPos]!;
            const isTop = stackPos === 0;
            const scale = 1 - stackPos * SCALE_STEP;
            const translateY = stackPos * STACK_Y_STEP;

            const footerActions = (
              <View className="flex-row items-center justify-center gap-10">
                <RNBounceable
                  onPress={skipCard}
                  accessibilityRole="button"
                  accessibilityLabel={t('swipeTab.a11ySkip')}
                >
                  <View style={styles.actionInner} className="border-2 border-red-400">
                    <Ionicons name="close" size={36} color="#f87171" />
                  </View>
                </RNBounceable>
                <RNBounceable
                  onPress={likeCard}
                  accessibilityRole="button"
                  accessibilityLabel={t('swipeTab.a11yLike')}
                >
                  <View style={styles.actionInner} className="border-2 border-accent">
                    <Ionicons name="heart" size={32} color="#CCFF00" />
                  </View>
                </RNBounceable>
              </View>
            );

            if (isTop) {
              return (
                <View
                  key={profile.id}
                  style={[styles.cardSlot, { transform: [{ scale }, { translateY }] }]}
                >
                  <GestureDetector gesture={topCardPanGesture}>
                    <Animated.View
                      style={[styles.cardFill, topCardAnimatedStyle as AnimatedStyle<ViewStyle>]}
                    >
                      <View style={styles.labelLayer} pointerEvents="none">
                        <Animated.View
                          style={[styles.passStamp, passLabelAnimatedStyle as AnimatedStyle<ViewStyle>]}
                        >
                          <Text style={styles.stampSkipText}>{t('swipeTab.stampSkip')}</Text>
                        </Animated.View>
                        <Animated.View
                          style={[styles.likeStamp, likeLabelAnimatedStyle as AnimatedStyle<ViewStyle>]}
                        >
                          <Text style={styles.stampLikeText}>{t('swipeTab.stampLike')}</Text>
                        </Animated.View>
                      </View>
                      <SwipeProfileCard
                        profile={profile}
                        bottomInset={bottomInset}
                        footerActions={footerActions}
                        showForeground
                      />
                    </Animated.View>
                  </GestureDetector>
                </View>
              );
            }

            return (
              <View
                key={profile.id}
                style={[styles.cardSlot, { transform: [{ scale }, { translateY }] }]}
              >
                <SwipeProfileCard profile={profile} showForeground={false} />
              </View>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  deckColumn: {
    flex: 1,
    alignSelf: 'stretch',
  },
  stackFrame: {
    flex: 1,
    position: 'relative',
  },
  cardSlot: {
    ...StyleSheet.absoluteFillObject,
  },
  cardFill: {
    flex: 1,
  },
  labelLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  passStamp: {
    position: 'absolute',
    top: '28%',
    right: '8%',
  },
  likeStamp: {
    position: 'absolute',
    top: '28%',
    left: '8%',
  },
  stampSkipText: {
    fontSize: 22,
    fontFamily: 'Nunito_700Bold',
    color: '#ef4444',
    borderWidth: 4,
    borderColor: '#ef4444',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 4,
    transform: [{ rotate: '-12deg' }],
  },
  stampLikeText: {
    fontSize: 22,
    fontFamily: 'Nunito_700Bold',
    color: '#CCFF00',
    borderWidth: 4,
    borderColor: '#CCFF00',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 4,
    transform: [{ rotate: '12deg' }],
  },
  actionInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  resetWrap: {
    alignSelf: 'center',
  },
});
