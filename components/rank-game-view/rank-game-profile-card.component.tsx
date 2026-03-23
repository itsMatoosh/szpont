import RNBounceable from '@freakycoder/react-native-bounceable';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import type { GameInactiveDropCandidate } from '@/hooks/game-inactive/use-game-inactive-drop.hook';
import { createFadeScaleEnteringTransition, createFadeScaleExitingTransition } from '@/util/animation/fade-scale-transition.util';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Animated from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';

interface RankGameProfileCardProps {
  candidate: GameInactiveDropCandidate;
  index: number;
  onPress: () => void;
  positionStyle: StyleProp<ViewStyle>;
  rotationStyle: StyleProp<ViewStyle>;
  disabled?: boolean;
}

/** Builds a stable `pravatar.cc` URL from the candidate id. */
function getRankGameAvatarUri(candidateId: string): string {
  // Hash-like deterministic index so each user keeps a consistent placeholder image.
  const seed = Array.from(candidateId).reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const imageId = (seed % 70) + 1;
  return `https://i.pravatar.cc/512?img=${imageId}`;
}

/** Offset animation timing to create a stacked cascade effect. */
const CARD_ANIMATION_STAGGER_MS = 100;

/** Selectable profile card shown in rank game drops. */
export function RankGameProfileCard({
  candidate,
  index,
  onPress,
  positionStyle,
  rotationStyle,
  disabled = false,
}: RankGameProfileCardProps) {
  // Get delayed entry animation.
  const staggerDelayMs = useMemo(() => Math.max(0, index) * CARD_ANIMATION_STAGGER_MS, [index]);
  const enteringTransition = useMemo(() => createFadeScaleEnteringTransition(staggerDelayMs), [staggerDelayMs]);
  const exitingTransition = useMemo(() => createFadeScaleExitingTransition(staggerDelayMs), [staggerDelayMs]);
  const likeEnteringTransition = useMemo(() => createFadeScaleEnteringTransition(), []);
  const likeExitingTransition = useMemo(() => createFadeScaleExitingTransition(), []);

  // Whether the like icon is visible
  const [isLikeVisible, setIsLikeVisible] = useState(false);

  // Play soft haptic on entry
  useEffect(() => {
    setTimeout(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }, staggerDelayMs);
  }, [staggerDelayMs]);

  // Play medium haptic on press
  const handlePress = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsLikeVisible(true);
    await new Promise((resolve) => setTimeout(resolve, 200));
    onPress();
  }, [onPress, setIsLikeVisible]);

  return (
    <Animated.View entering={enteringTransition} exiting={exitingTransition} style={[styles.wrapper, positionStyle]}>
      <View style={rotationStyle}>
        <RNBounceable onPress={handlePress} disabled={disabled} >
          <View className="rounded-3xl overflow-hidden border border-border bg-surface" style={styles.cardFrame}>
            <Image source={{ uri: getRankGameAvatarUri(candidate.id) }} style={styles.image} contentFit="cover" />
            <LinearGradient
              colors={['transparent', 'rgba(0, 0, 0, 0.8)']}
              locations={[0.35, 1]}
              style={styles.gradientOverlay}
            >
              <View className="px-4 pb-4 pt-8">
                <Text className="text-lg" style={[styles.nunitoBold, styles.titleText]} numberOfLines={1}>
                  {candidate.displayName}, {candidate.age}
                </Text>
                <Text className="mt-1 text-sm" style={[styles.nunitoRegular, styles.bioText]} numberOfLines={2}>
                  {candidate.bio}
                </Text>
              </View>
            </LinearGradient>
            {isLikeVisible && (
              <Animated.View entering={likeEnteringTransition} exiting={likeExitingTransition} className="absolute inset-0 items-center justify-center">
                <Ionicons name="heart" size={56} color="#CCFF00" />
              </Animated.View>
            )}
          </View>
        </RNBounceable>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    width: '54%',
    shadowColor: '#000',
    shadowOpacity: 0.24,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  cardFrame: {
    aspectRatio: 2 / 3,
  },
  image: {
    ...StyleSheet.absoluteFill,
  },
  gradientOverlay: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'flex-end',
  },
  nunitoBold: {
    fontFamily: 'Nunito_700Bold',
  },
  nunitoRegular: {
    fontFamily: 'Nunito_400Regular',
  },
  titleText: {
    color: '#fff',
  },
  bioText: {
    color: 'rgba(255, 255, 255, 0.9)',
  },
});
