import RNBounceable from '@freakycoder/react-native-bounceable';
import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dimensions, NativeScrollEvent, NativeSyntheticEvent, ScrollView, Text, View } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimatedSlide } from '@/components/animated-slide/animated-slide.component';
import { SlideCta } from '@/components/welcome-slides/slide-cta.component';
import { SlideHook } from '@/components/welcome-slides/slide-hook.component';
import { SlideLocation } from '@/components/welcome-slides/slide-location.component';
import { SlideMatching } from '@/components/welcome-slides/slide-matching.component';
import { SlideNotifications } from '@/components/welcome-slides/slide-notifications.component';
import { SlideZoneExplanation } from '@/components/welcome-slides/slide-zone-explanation.component';
import { SlideZones } from '@/components/welcome-slides/slide-zones.component';
import { useLocationPermissionsComplete } from '@/hooks/location/use-location-permissions-complete.hook';
import { useNotificationPermissionContext } from '@/hooks/notifications/notification-permission.context';
import { useWelcome } from '@/hooks/welcome/welcome.context';
import { requestNotificationPermissions } from '@/util/notifications/notifications.util';

const nunitoSemiBold = { fontFamily: 'Nunito_600SemiBold' } as const;

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const TOTAL_SLIDES = 7;
const NOTIFICATIONS_SLIDE = 5;

/** Full-screen welcome walkthrough explaining the Szpont concept in 7 swipeable slides. */
export default function WelcomeScreen() {
  const { t } = useTranslation();
  const { completeWelcome } = useWelcome();
  const locationReady = useLocationPermissionsComplete();
  const { recheck: recheckNotifications } = useNotificationPermissionContext();
  const insets = useSafeAreaInsets();
  const scrollX = useSharedValue(0);
  const scrollRef = useRef<ScrollView>(null);
  const [currentPage, setCurrentPage] = useState(0);

  const isLastSlide = currentPage >= TOTAL_SLIDES - 1;
  const nextDisabled = isLastSlide && !locationReady;

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const x = event.nativeEvent.contentOffset.x;
      scrollX.value = x;
      setCurrentPage(Math.round(x / SCREEN_WIDTH));
    },
    [scrollX],
  );

  /** Advances to the next slide, or finishes the walkthrough on the last one. */
  const handleNext = useCallback(async () => {
    if (isLastSlide && !locationReady) return;

    // Show the system notification permission dialog, then proceed regardless of choice
    if (currentPage === NOTIFICATIONS_SLIDE) {
      await requestNotificationPermissions();
      recheckNotifications();
    }

    if (isLastSlide) {
      completeWelcome();
    } else {
      scrollRef.current?.scrollTo({ x: (currentPage + 1) * SCREEN_WIDTH, animated: true });
    }
  }, [currentPage, completeWelcome, isLastSlide, locationReady, recheckNotifications]);

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}>
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
        <AnimatedSlide index={5} scrollX={scrollX}><SlideNotifications /></AnimatedSlide>
        <AnimatedSlide index={6} scrollX={scrollX}><SlideLocation /></AnimatedSlide>
      </ScrollView>

      {/* Bottom controls */}
      <View className="px-8 pt-2 pb-2">
        <RNBounceable onPress={handleNext} disabled={nextDisabled}>
          <View
            className="bg-accent rounded-2xl py-4 items-center justify-center"
            style={{ opacity: nextDisabled ? 0.4 : 1 }}
          >
            <Text className="text-on-accent text-lg font-semibold" style={nunitoSemiBold}>
              {t('common.continue')}
            </Text>
          </View>
        </RNBounceable>
      </View>
    </View>
  );
}
