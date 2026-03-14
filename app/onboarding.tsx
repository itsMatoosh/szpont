import Ionicons from '@expo/vector-icons/Ionicons';
import RNBounceable from '@freakycoder/react-native-bounceable';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, TextInput, Text, View, KeyboardAvoidingView, Platform, StyleSheet, useColorScheme } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/hooks/auth/use-auth.hook';
import { useProfileContext } from '@/hooks/profile/profile.context';
import { supabase } from '@/util/supabase/supabase.util';

const TOTAL_STEPS = 3;

const styles = StyleSheet.create({
  inputBase: { fontSize: 24, textAlign: 'center' as const },
  inputLarge: { fontSize: 30, fontWeight: 'bold', textAlign: 'center' as const },
});

/** Multi-step onboarding wizard collecting display name, username, and date of birth. */
export default function OnboardingScreen() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { refetch } = useProfileContext();
  const insets = useSafeAreaInsets();
  const scheme = useColorScheme();
  const foreground = scheme === 'dark' ? '#F5F5F5' : '#262626';

  const [step, setStep] = useState(0);
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [day, setDay] = useState('');
  const [month, setMonth] = useState('');
  const [year, setYear] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const monthRef = useRef<TextInput>(null);
  const yearRef = useRef<TextInput>(null);

  const canContinue = (() => {
    switch (step) {
      case 0:
        return displayName.trim().length > 0;
      case 1:
        return username.trim().length > 0;
      case 2:
        return day.length === 2 && month.length === 2 && year.length === 4;
      default:
        return false;
    }
  })();

  /** Inserts the profile row and triggers a refetch so the root layout navigates away. */
  async function submit() {
    if (!user) return;
    setSubmitting(true);

    const dateOfBirth = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;

    const { error } = await supabase.from('users').insert({
      id: user.id,
      display_name: displayName.trim(),
      username: username.trim().toLowerCase(),
      date_of_birth: dateOfBirth,
    });

    if (error) {
      Alert.alert('Error', error.message);
      setSubmitting(false);
      return;
    }

    await refetch();
  }

  function handleContinue() {
    if (step < TOTAL_STEPS - 1) {
      setStep(step + 1);
    } else {
      submit();
    }
  }

  function handleBack() {
    if (step > 0) setStep(step - 1);
  }

  /** Auto-advance day/month fields when full, backspace jumps to previous field. */
  function handleDayChange(text: string) {
    const digits = text.replace(/\D/g, '').slice(0, 2);
    setDay(digits);
    if (digits.length === 2) monthRef.current?.focus();
  }

  function handleMonthChange(text: string) {
    const digits = text.replace(/\D/g, '').slice(0, 2);
    setMonth(digits);
    if (digits.length === 2) yearRef.current?.focus();
  }

  function handleYearChange(text: string) {
    setYear(text.replace(/\D/g, '').slice(0, 4));
  }

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Back button */}
        <View className="px-4 h-12 justify-center">
          {step > 0 && (
            <RNBounceable onPress={handleBack}>
              <Ionicons name="arrow-back" size={28} className="text-foreground" />
            </RNBounceable>
          )}
        </View>

        {/* Content */}
        <View style={{ flex: 1 }} className="px-8 justify-center items-center">
          {step === 0 && (
            <>
              <Text className="text-3xl font-bold text-foreground mb-6 text-center">
                {t('onboarding.nameTitle')}
              </Text>
              <View className="border-b-2 border-border pb-2 self-stretch">
                <TextInput
                  style={[styles.inputBase, { color: foreground }]}
                  placeholder={t('onboarding.namePlaceholder')}
                  placeholderTextColor="#8E8E8E"
                  value={displayName}
                  onChangeText={setDisplayName}
                  autoFocus
                  autoCapitalize="words"
                  returnKeyType="next"
                  onSubmitEditing={() => canContinue && handleContinue()}
                />
              </View>
            </>
          )}

          {step === 1 && (
            <>
              <Text className="text-3xl font-bold text-foreground mb-6 text-center">
                {t('onboarding.usernameTitle')}
              </Text>
              <View className="flex-row items-center border-b-2 border-border pb-2 self-stretch justify-center">
                <Text className="text-2xl text-muted">@</Text>
                <TextInput
                  style={[styles.inputBase, { flex: 1, color: foreground }]}
                  placeholder={t('onboarding.usernamePlaceholder')}
                  placeholderTextColor="#8E8E8E"
                  value={username}
                  onChangeText={(text) => setUsername(text.toLowerCase().replace(/\s/g, ''))}
                  autoFocus
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="next"
                  onSubmitEditing={() => canContinue && handleContinue()}
                />
              </View>
            </>
          )}

          {step === 2 && (
            <>
              <Text className="text-3xl font-bold text-foreground mb-6 text-center">
                {t('onboarding.dobTitle')}
              </Text>
              <View className="flex-row gap-3 justify-center">
                <View className="border-b-2 border-border pb-2" style={{ width: 64 }}>
                  <TextInput
                    style={[styles.inputLarge, { color: foreground }]}
                    placeholder={t('onboarding.dobDay')}
                    placeholderTextColor="#8E8E8E"
                    value={day}
                    onChangeText={handleDayChange}
                    keyboardType="number-pad"
                    maxLength={2}
                    autoFocus
                  />
                </View>
                <View className="border-b-2 border-border pb-2" style={{ width: 64 }}>
                  <TextInput
                    ref={monthRef}
                    style={[styles.inputLarge, { color: foreground }]}
                    placeholder={t('onboarding.dobMonth')}
                    placeholderTextColor="#8E8E8E"
                    value={month}
                    onChangeText={handleMonthChange}
                    keyboardType="number-pad"
                    maxLength={2}
                  />
                </View>
                <View className="border-b-2 border-border pb-2" style={{ width: 96 }}>
                  <TextInput
                    ref={yearRef}
                    style={[styles.inputLarge, { color: foreground }]}
                    placeholder={t('onboarding.dobYear')}
                    placeholderTextColor="#8E8E8E"
                    value={year}
                    onChangeText={handleYearChange}
                    keyboardType="number-pad"
                    maxLength={4}
                  />
                </View>
              </View>
            </>
          )}
        </View>

        {/* Continue button */}
        <View className="px-8 pb-4">
          <RNBounceable onPress={handleContinue} disabled={!canContinue || submitting}>
            <View
              className={`rounded-2xl py-4 items-center justify-center ${
                canContinue && !submitting ? 'bg-accent' : 'bg-border'
              }`}
            >
              <Text
                className={`text-lg font-semibold ${
                  canContinue && !submitting ? 'text-on-accent' : 'text-muted'
                }`}
              >
                {t('onboarding.continue')}
              </Text>
            </View>
          </RNBounceable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
