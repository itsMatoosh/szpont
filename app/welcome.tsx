import RNBounceable from '@freakycoder/react-native-bounceable';
import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dimensions, NativeScrollEvent, NativeSyntheticEvent, ScrollView, Text, View } from 'react-native';
import Animated, {
  interpolate,
  SharedValue,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SlideCta } from '@/components/welcome-slides/slide-cta.component';
import { SlideHook } from '@/components/welcome-slides/slide-hook.component';
import { SlideMatching } from '@/components/welcome-slides/slide-matching.component';
import { SlidePermissions } from '@/components/welcome-slides/slide-permissions.component';
import { SlideZoneExplanation } from '@/components/welcome-slides/slide-zone-explanation.component';
import { SlideZones } from '@/components/welcome-slides/slide-zones.component';
import { useWelcome } from '@/hooks/welcome/welcome.context';

const nunitoSemiBold = { fontFamily: 'Nunito_600SemiBold' } as const;

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const TOTAL_SLIDES = 6;

// ── Animated slide wrapper ─────────────────────────────────────────────

/** Wraps a slide's content with scroll-driven fade and vertical translation. */
function AnimatedSlide({
  index,
  scrollX,
  children,
}: {
  index: number;
  scrollX: SharedValue<number>;
  children: React.ReactNode;
}) {
  const animatedStyle = useAnimatedStyle(() => {
    const inputRange = [
      (index - 1) * SCREEN_WIDTH,
      index * SCREEN_WIDTH,
      (index + 1) * SCREEN_WIDTH,
    ];
    const opacity = interpolate(scrollX.value, inputRange, [0, 1, 0], 'clamp');
    const translateY = interpolate(scrollX.value, inputRange, [30, 0, 30], 'clamp');
    return { opacity, transform: [{ translateY }] };
  });

  return (
    <Animated.View style={[{ width: SCREEN_WIDTH, flex: 1 }, animatedStyle]}>
      {children}
    </Animated.View>
  );
}

// ── Main screen ────────────────────────────────────────────────────────

/** Full-screen welcome walkthrough explaining the Szpont concept in 6 swipeable slides. */
export default function WelcomeScreen() {
  const { t } = useTranslation();
  const { completeWelcome } = useWelcome();
  const insets = useSafeAreaInsets();
  const scrollX = useSharedValue(0);
  const scrollRef = useRef<ScrollView>(null);
  const [currentPage, setCurrentPage] = useState(0);

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const x = event.nativeEvent.contentOffset.x;
      scrollX.value = x;
      setCurrentPage(Math.round(x / SCREEN_WIDTH));
    },
    [scrollX],
  );

  /** Advances to the next slide, or finishes the walkthrough on the last one. */
  const handleNext = useCallback(() => {
    if (currentPage >= TOTAL_SLIDES - 1) {
      completeWelcome();
    } else {
      scrollRef.current?.scrollTo({ x: (currentPage + 1) * SCREEN_WIDTH, animated: true });
    }
  }, [currentPage, completeWelcome]);

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}>
      {/* Skip button */}
      <View className="absolute z-10 right-6" style={{ top: insets.top + 12 }}>
        <RNBounceable onPress={completeWelcome}>
          <Text className="text-muted text-base font-medium" style={nunitoSemiBold}>{t('welcome.skip')}</Text>
        </RNBounceable>
      </View>

      {/* Slides */}
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        bounces={false}
      >
        <AnimatedSlide index={0} scrollX={scrollX}><SlideHook /></AnimatedSlide>
        <AnimatedSlide index={1} scrollX={scrollX}><SlideMatching /></AnimatedSlide>
        <AnimatedSlide index={2} scrollX={scrollX}><SlideZones /></AnimatedSlide>
        <AnimatedSlide index={3} scrollX={scrollX}><SlideZoneExplanation /></AnimatedSlide>
        <AnimatedSlide index={4} scrollX={scrollX}><SlideCta /></AnimatedSlide>
        <AnimatedSlide index={5} scrollX={scrollX}><SlidePermissions /></AnimatedSlide>
      </ScrollView>

      {/* Bottom controls */}
      <View className="px-8 pt-2 pb-2">
        <RNBounceable onPress={handleNext}>
          <View className="bg-accent rounded-2xl py-4 items-center justify-center">
            <Text className="text-on-accent text-lg font-semibold" style={nunitoSemiBold}>
              {currentPage >= TOTAL_SLIDES - 1 ? t('welcome.cta') : t('welcome.continue')}
            </Text>
          </View>
        </RNBounceable>
      </View>
    </View>
  );
}
