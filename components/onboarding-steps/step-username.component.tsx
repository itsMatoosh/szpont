import React from 'react';
import { Control, Controller, FieldError } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Text, TextInput, useColorScheme, View } from 'react-native';

import { nunitoBold, nunitoRegular, inputStyles } from '@/util/fonts/fonts.util';
import type { OnboardingFormInput } from '@/util/onboarding/onboarding.util';

interface StepUsernameProps {
  control: Control<OnboardingFormInput>;
  error: FieldError | undefined;
  inputRef: React.RefObject<TextInput | null>;
  canContinue: boolean;
  onSubmit: () => void;
}

/** Onboarding step that collects the user's username. */
export function StepUsername({
  control,
  error,
  inputRef,
  canContinue,
  onSubmit,
}: StepUsernameProps) {
  const { t } = useTranslation();
  const scheme = useColorScheme();
  const foreground = scheme === 'dark' ? '#F5F5F5' : '#262626';

  return (
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
              ref={(el) => {
                (inputRef as React.MutableRefObject<TextInput | null>).current = el;
              }}
              style={[inputStyles.base, { flex: 1, color: foreground }]}
              placeholder={t('onboarding.usernamePlaceholder')}
              placeholderTextColor="#8E8E8E"
              value={value}
              onChangeText={(text) => onChange(text.toLowerCase().replace(/\s/g, ''))}
              onBlur={onBlur}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="next"
              onSubmitEditing={() => canContinue && onSubmit()}
            />
          )}
        />
      </View>
      {error && (
        <Text className="text-sm text-red-500 mt-2" style={nunitoRegular}>
          {error.message}
        </Text>
      )}
    </View>
  );
}
