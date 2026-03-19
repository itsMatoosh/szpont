import React from 'react';
import { Control, Controller, FieldError } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Text, TextInput, useColorScheme, View } from 'react-native';

import { nunitoBold, nunitoRegular, inputStyles } from '@/util/fonts/fonts.util';
import type { OnboardingFormInput } from '@/util/onboarding/onboarding.util';

interface StepDisplayNameProps {
  control: Control<OnboardingFormInput>;
  error: FieldError | undefined;
  inputRef: React.RefObject<TextInput | null>;
  canContinue: boolean;
  onSubmit: () => void;
}

/** Onboarding step that collects the user's display name. */
export function StepDisplayName({
  control,
  error,
  inputRef,
  canContinue,
  onSubmit,
}: StepDisplayNameProps) {
  const { t } = useTranslation();
  const scheme = useColorScheme();
  const foreground = scheme === 'dark' ? '#F5F5F5' : '#262626';

  return (
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
              ref={(el) => {
                (inputRef as React.MutableRefObject<TextInput | null>).current = el;
              }}
              style={[inputStyles.base, { color: foreground }]}
              placeholder={t('onboarding.namePlaceholder')}
              placeholderTextColor="#8E8E8E"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              autoCapitalize="words"
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
