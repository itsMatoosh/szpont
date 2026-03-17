import Ionicons from '@expo/vector-icons/Ionicons';
import RNBounceable from '@freakycoder/react-native-bounceable';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  KeyboardAvoidingView,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  View,
} from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { zodResolver } from '@hookform/resolvers/zod';

import { AnimatedSlide } from '@/components/animated-slide/animated-slide.component';
import { useAuth } from '@/hooks/auth/use-auth.hook';
import { useProfileContext } from '@/hooks/profile/profile.context';
import {
  getOnboardingFormSchema,
  type OnboardingFormInput,
  type OnboardingFormValues,
} from '@/util/onboarding/onboarding.util';
import { supabase } from '@/util/supabase/supabase.util';
import { Colors } from '@/util/theme/theme.util';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const TOTAL_SLIDES = 4;
const LAST_FORM_SLIDE = 2;

const nunitoBold = { fontFamily: 'Nunito_700Bold' } as const;
const nunitoSemiBold = { fontFamily: 'Nunito_600SemiBold' } as const;
const nunitoRegular = { fontFamily: 'Nunito_400Regular' } as const;

const styles = StyleSheet.create({
  inputBase: { fontSize: 24, textAlign: 'center' as const, fontFamily: 'Nunito_400Regular' },
  inputLarge: { fontSize: 30, textAlign: 'center' as const, fontFamily: 'Nunito_700Bold' },
});

/** Multi-step onboarding wizard collecting display name, username, and date of birth. */
export default function OnboardingScreen() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { refetch } = useProfileContext();
  const insets = useSafeAreaInsets();
  const scheme = useColorScheme();
  const foreground = scheme === 'dark' ? '#F5F5F5' : '#262626';

  const scrollX = useSharedValue(0);
  const scrollRef = useRef<ScrollView>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const monthRef = useRef<TextInput>(null);
  const yearRef = useRef<TextInput>(null);

  const schema = useMemo(() => getOnboardingFormSchema(t), [t]);

  const {
    control,
    watch,
    trigger,
    handleSubmit,
    formState: { errors },
  } = useForm<OnboardingFormInput>({
    resolver: zodResolver(schema),
    mode: 'onChange',
    defaultValues: {
      displayName: '',
      username: '',
      day: '',
      month: '',
      year: '',
    },
  });

  const displayName = watch('displayName');
  const username = watch('username');
  const day = watch('day');
  const month = watch('month');
  const year = watch('year');

  /** Button enabled only when the current step has non-empty input and no validation errors. */
  const canContinue = (() => {
    switch (currentPage) {
      case 0:
        return displayName.trim().length > 0 && !errors.displayName;
      case 1:
        return username.replace(/\s/g, '').length > 0 && !errors.username;
      case 2:
        return day.length === 2 && month.length === 2 && year.length === 4
          && !errors.day && !errors.month && !errors.year;
      default:
        return false;
    }
  })();

  const isFormSlide = currentPage <= LAST_FORM_SLIDE;
  const isLastFormSlide = currentPage === LAST_FORM_SLIDE;

  /** Shows error alert, resets submitting state, and scrolls back to the first slide. */
  function handleError(message: string) {
    Alert.alert('Error', message);
    setSubmitting(false);
    scrollRef.current?.scrollTo({ x: 0, animated: true });
  }

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
      username: data.username,
      date_of_birth: dateOfBirth,
    });

    if (error) {
      handleError(error.message);
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
        : currentPage === 1 ? 'username' as const
          : (['day', 'month', 'year'] as const);
    const valid = await trigger(fields);
    if (!valid) return;

    scrollRef.current?.scrollTo({ x: (currentPage + 1) * SCREEN_WIDTH, animated: true });
  }

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

        {/* Slides */}
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
            <View style={{ flex: 1 }} className="px-8 justify-center items-center">
              <Text className="text-3xl font-bold text-foreground mb-6 text-center" style={nunitoBold}>
                {t('onboarding.nameTitle')}
              </Text>
              <View className="border-b-2 border-border pb-2 self-stretch">
                <Controller
                  control={control}
                  name="displayName"
                  render={({ field: { value, onChange, onBlur } }) => (
                    <TextInput
                      style={[styles.inputBase, { color: foreground }]}
                      placeholder={t('onboarding.namePlaceholder')}
                      placeholderTextColor="#8E8E8E"
                      value={value}
                      onChangeText={onChange}
                      onBlur={onBlur}
                      autoFocus
                      autoCapitalize="words"
                      returnKeyType="next"
                      onSubmitEditing={() => canContinue && handleContinue()}
                    />
                  )}
                />
              </View>
              {errors.displayName && (
                <Text className="text-sm text-red-500 mt-2" style={nunitoRegular}>
                  {errors.displayName.message}
                </Text>
              )}
            </View>
          </AnimatedSlide>

          <AnimatedSlide index={1} scrollX={scrollX}>
            <View style={{ flex: 1 }} className="px-8 justify-center items-center">
              <Text className="text-3xl font-bold text-foreground mb-6 text-center" style={nunitoBold}>
                {t('onboarding.usernameTitle')}
              </Text>
              <View className="flex-row items-center border-b-2 border-border pb-2 self-stretch justify-center">
                <Text className="text-2xl text-muted" style={nunitoRegular}>@</Text>
                <Controller
                  control={control}
                  name="username"
                  render={({ field: { value, onChange, onBlur } }) => (
                    <TextInput
                      style={[styles.inputBase, { flex: 1, color: foreground }]}
                      placeholder={t('onboarding.usernamePlaceholder')}
                      placeholderTextColor="#8E8E8E"
                      value={value}
                      onChangeText={(text) => onChange(text.toLowerCase().replace(/\s/g, ''))}
                      onBlur={onBlur}
                      autoFocus
                      autoCapitalize="none"
                      autoCorrect={false}
                      returnKeyType="next"
                      onSubmitEditing={() => canContinue && handleContinue()}
                    />
                  )}
                />
              </View>
              {errors.username && (
                <Text className="text-sm text-red-500 mt-2" style={nunitoRegular}>
                  {errors.username.message}
                </Text>
              )}
            </View>
          </AnimatedSlide>

          <AnimatedSlide index={2} scrollX={scrollX}>
            <View style={{ flex: 1 }} className="px-8 justify-center items-center">
              <Text className="text-3xl font-bold text-foreground mb-6 text-center" style={nunitoBold}>
                {t('onboarding.dobTitle')}
              </Text>
              <View className="flex-row gap-3 justify-center">
                <View className="border-b-2 border-border pb-2" style={{ width: 64 }}>
                  <Controller
                    control={control}
                    name="day"
                    render={({ field: { value, onChange, onBlur } }) => (
                      <TextInput
                        style={[styles.inputLarge, { color: foreground }]}
                        placeholder={t('onboarding.dobDay')}
                        placeholderTextColor="#8E8E8E"
                        value={value}
                        onChangeText={(text) => {
                          const digits = text.replace(/\D/g, '').slice(0, 2);
                          onChange(digits);
                          if (digits.length === 2) monthRef.current?.focus();
                        }}
                        onBlur={onBlur}
                        keyboardType="number-pad"
                        maxLength={2}
                        autoFocus
                      />
                    )}
                  />
                </View>
                <View className="border-b-2 border-border pb-2" style={{ width: 64 }}>
                  <Controller
                    control={control}
                    name="month"
                    render={({ field: { value, onChange, onBlur } }) => (
                      <TextInput
                        ref={(el) => {
                          (monthRef as React.MutableRefObject<TextInput | null>).current = el;
                        }}
                        style={[styles.inputLarge, { color: foreground }]}
                        placeholder={t('onboarding.dobMonth')}
                        placeholderTextColor="#8E8E8E"
                        value={value}
                        onChangeText={(text) => {
                          const digits = text.replace(/\D/g, '').slice(0, 2);
                          onChange(digits);
                          if (digits.length === 2) yearRef.current?.focus();
                        }}
                        onBlur={onBlur}
                        keyboardType="number-pad"
                        maxLength={2}
                      />
                    )}
                  />
                </View>
                <View className="border-b-2 border-border pb-2" style={{ width: 96 }}>
                  <Controller
                    control={control}
                    name="year"
                    render={({ field: { value, onChange, onBlur } }) => (
                      <TextInput
                        ref={(el) => {
                          (yearRef as React.MutableRefObject<TextInput | null>).current = el;
                        }}
                        style={[styles.inputLarge, { color: foreground }]}
                        placeholder={t('onboarding.dobYear')}
                        placeholderTextColor="#8E8E8E"
                        value={value}
                        onChangeText={(text) => onChange(text.replace(/\D/g, '').slice(0, 4))}
                        onBlur={onBlur}
                        keyboardType="number-pad"
                        maxLength={4}
                      />
                    )}
                  />
                </View>
              </View>
              {errors.day && (
                <Text className="text-sm text-red-500 mt-2" style={nunitoRegular}>
                  {errors.day.message}
                </Text>
              )}
              {errors.month && (
                <Text className="text-sm text-red-500 mt-2" style={nunitoRegular}>
                  {errors.month.message}
                </Text>
              )}
              {errors.year && (
                <Text className="text-sm text-red-500 mt-2" style={nunitoRegular}>
                  {errors.year.message}
                </Text>
              )}
            </View>
          </AnimatedSlide>

          <AnimatedSlide index={3} scrollX={scrollX}>
            <View style={{ flex: 1 }} className="px-8 justify-center items-center">
              <ActivityIndicator size="large" style={{ marginBottom: 16 }} />
              <Text className="text-xl text-foreground text-center" style={nunitoSemiBold}>
                {t('onboarding.creatingProfile')}
              </Text>
            </View>
          </AnimatedSlide>
        </ScrollView>

        {/* Continue button — only on form slides */}
        {isFormSlide && (
          <View className="px-8 pb-4">
            <RNBounceable onPress={handleContinue} disabled={!canContinue || submitting}>
              <View
                className={`rounded-2xl py-4 items-center justify-center ${canContinue && !submitting ? 'bg-accent' : 'bg-border'
                  }`}
              >
                <Text
                  className={`text-lg font-semibold ${canContinue && !submitting ? 'text-on-accent' : 'text-muted'
                    }`}
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
