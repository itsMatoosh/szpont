import Ionicons from '@expo/vector-icons/Ionicons';
import RNBounceable from '@freakycoder/react-native-bounceable';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Dimensions,
  KeyboardAvoidingView,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { zodResolver } from '@hookform/resolvers/zod';

import { AnimatedSlide } from '@/components/animated-slide/animated-slide.component';
import { StepDateOfBirth } from '@/components/onboarding-steps/step-date-of-birth.component';
import { StepDisplayName } from '@/components/onboarding-steps/step-display-name.component';
import { StepGender } from '@/components/onboarding-steps/step-gender.component';
import { StepLoading } from '@/components/onboarding-steps/step-loading.component';
import { StepPhotos } from '@/components/onboarding-steps/step-photos.component';
import { useAuth } from '@/hooks/auth/use-auth.hook';
import { useProfilePhotos } from '@/hooks/photos/use-profile-photos.hook';
import { useProfileContext } from '@/hooks/profile/profile.context';
import { nunitoSemiBold } from '@/util/fonts/fonts.util';
import {
  getOnboardingFormSchema,
  type OnboardingFormInput,
  type OnboardingFormValues,
} from '@/util/onboarding/onboarding.util';
import { supabase } from '@/util/supabase/supabase.util';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const LAST_FORM_SLIDE = 3;

/** Multi-step onboarding wizard collecting display name, gender, date of birth, and photos. */
export default function OnboardingScreen() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { refetch } = useProfileContext();
  const { photos, pickPhoto, removePhoto, reorderPhotos, uploadAll } =
    useProfilePhotos(user?.id ?? null);
  const insets = useSafeAreaInsets();

  const scrollX = useSharedValue(0);
  const scrollRef = useRef<ScrollView>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const displayNameRef = useRef<TextInput>(null);
  const dayRef = useRef<TextInput>(null);
  const monthRef = useRef<TextInput>(null);
  const yearRef = useRef<TextInput>(null);

  const schema = useMemo(() => getOnboardingFormSchema(t), [t]);

  const {
    control,
    watch,
    trigger,
    handleSubmit,
    formState: { errors },
  } = useForm<OnboardingFormInput, unknown, OnboardingFormValues>({
    resolver: zodResolver(schema),
    mode: 'onChange',
    defaultValues: {
      displayName: '',
      gender: '',
      day: '',
      month: '',
      year: '',
    },
  });

  const displayName = watch('displayName');
  const gender = watch('gender');
  const day = watch('day');
  const month = watch('month');
  const year = watch('year');

  /** Button enabled only when the current step has valid input. */
  const canContinue = (() => {
    switch (currentPage) {
      case 0:
        return displayName.trim().length > 0 && !errors.displayName;
      case 1:
        return (gender === 'male' || gender === 'female') && !errors.gender;
      case 2:
        return day.length === 2 && month.length === 2 && year.length === 4
          && !errors.day && !errors.month && !errors.year;
      case 3:
        return photos.length >= 3;
      default:
        return false;
    }
  })();

  // Focus the primary input of the active slide after the scroll animation settles
  useEffect(() => {
    const timer = setTimeout(() => {
      switch (currentPage) {
        case 0: displayNameRef.current?.focus(); break;
        case 1: break;
        case 2: dayRef.current?.focus(); break;
        case 3: break;
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [currentPage]);

  const isFormSlide = currentPage <= LAST_FORM_SLIDE;
  const isLastFormSlide = currentPage === LAST_FORM_SLIDE;

  /** Shows error alert, resets submitting state, and scrolls back to the first slide. */
  function handleError(message: string) {
    Alert.alert('Error', message);
    setSubmitting(false);
    scrollRef.current?.scrollTo({ x: 0, animated: true });
  }

  /** Handles the scroll event and updates the current page. */
  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const x = event.nativeEvent.contentOffset.x;
      scrollX.value = x;
      setCurrentPage(Math.round(x / SCREEN_WIDTH));
    },
    [scrollX],
  );

  /** Inserts the profile row and triggers a refetch so the root layout navigates away. */
  async function onValidSubmit(data: OnboardingFormValues) {
    if (!user) return;
    scrollRef.current?.scrollTo({ x: (LAST_FORM_SLIDE + 1) * SCREEN_WIDTH, animated: true });
    setSubmitting(true);

    const dateOfBirth = `${data.year}-${data.month.padStart(2, '0')}-${data.day.padStart(2, '0')}`;

    const { error } = await supabase.from('users').insert({
      id: user.id,
      display_name: data.displayName,
      gender: data.gender,
      date_of_birth: dateOfBirth,
    });

    if (error) {
      handleError(error.message);
      return;
    }

    try {
      await uploadAll();
    } catch (e: unknown) {
      handleError((e as Error).message);
      return;
    }

    await refetch();
  }

  /** Advances to the next slide, or on the last form slide runs validation and submits. */
  async function handleContinue() {
    if (submitting) return;
    if (isLastFormSlide) {
      handleSubmit(onValidSubmit)();
      return;
    }
    if (!canContinue) return;

    const fields =
      currentPage === 0 ? 'displayName' as const
        : currentPage === 1 ? 'gender' as const
          : (['day', 'month', 'year'] as const);
    const valid = await trigger(fields);
    if (!valid) return;

    scrollRef.current?.scrollTo({ x: (currentPage + 1) * SCREEN_WIDTH, animated: true });
  }

  /** Handles the back button press and scrolls to the previous slide. */
  function handleBack() {
    if (currentPage > 0) {
      scrollRef.current?.scrollTo({ x: (currentPage - 1) * SCREEN_WIDTH, animated: true });
    }
  }

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Back button — only on form slides */}
        <View className="px-4 h-12 justify-center">
          {currentPage > 0 && isFormSlide && (
            <RNBounceable onPress={handleBack}>
              <Ionicons name="arrow-back" size={28} className="text-foreground" />
            </RNBounceable>
          )}
        </View>

        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          scrollEnabled={false}
          showsHorizontalScrollIndicator={false}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          bounces={false}
        >
          <AnimatedSlide index={0} scrollX={scrollX}>
            <StepDisplayName
              control={control}
              error={errors.displayName}
              inputRef={displayNameRef}
              canContinue={canContinue}
              onSubmit={handleContinue}
            />
          </AnimatedSlide>

          <AnimatedSlide index={1} scrollX={scrollX}>
            <StepGender
              control={control}
              error={errors.gender}
            />
          </AnimatedSlide>

          <AnimatedSlide index={2} scrollX={scrollX}>
            <StepDateOfBirth
              control={control}
              errors={{ day: errors.day, month: errors.month, year: errors.year }}
              dayRef={dayRef}
              monthRef={monthRef}
              yearRef={yearRef}
            />
          </AnimatedSlide>

          <AnimatedSlide index={3} scrollX={scrollX}>
            <StepPhotos
              photos={photos}
              onAdd={(pos) => pickPhoto(pos)}
              onRemove={removePhoto}
              onReorder={reorderPhotos}
            />
          </AnimatedSlide>

          <AnimatedSlide index={4} scrollX={scrollX}>
            <StepLoading />
          </AnimatedSlide>
        </ScrollView>

        {/* Continue button — only on form slides */}
        {isFormSlide && (
          <View className="px-8 pb-4">
            <RNBounceable onPress={handleContinue} disabled={!canContinue || submitting}>
              <View
                className={`rounded-2xl py-4 items-center justify-center ${canContinue && !submitting ? 'bg-accent' : 'bg-border'}`}
              >
                <Text
                  className={`text-lg font-semibold ${canContinue && !submitting ? 'text-on-accent' : 'text-muted'}`}
                  style={nunitoSemiBold}
                >
                  {isLastFormSlide ? t('onboarding.createProfile') : t('common.continue')}
                </Text>
              </View>
            </RNBounceable>
          </View>
        )}
      </KeyboardAvoidingView>
    </View>
  );
}
