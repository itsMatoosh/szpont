import React from 'react';
import { Control, Controller, FieldError } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Text, TextInput, useColorScheme, View } from 'react-native';

import { nunitoBold, nunitoRegular, inputStyles } from '@/util/fonts/fonts.util';
import type { OnboardingFormInput } from '@/util/onboarding/onboarding.util';

interface StepDateOfBirthProps {
  control: Control<OnboardingFormInput>;
  errors: {
    day?: FieldError;
    month?: FieldError;
    year?: FieldError;
  };
  dayRef: React.RefObject<TextInput | null>;
  monthRef: React.RefObject<TextInput | null>;
  yearRef: React.RefObject<TextInput | null>;
}

/** Onboarding step that collects the user's date of birth via three numeric fields. */
export function StepDateOfBirth({
  control,
  errors,
  dayRef,
  monthRef,
  yearRef,
}: StepDateOfBirthProps) {
  const { t } = useTranslation();
  const scheme = useColorScheme();
  const foreground = scheme === 'dark' ? '#F5F5F5' : '#262626';

  return (
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
                ref={(el) => {
                  (dayRef as React.MutableRefObject<TextInput | null>).current = el;
                }}
                style={[inputStyles.large, { color: foreground }]}
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
                style={[inputStyles.large, { color: foreground }]}
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
                style={[inputStyles.large, { color: foreground }]}
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
  );
}
