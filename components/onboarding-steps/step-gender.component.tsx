import RNBounceable from '@freakycoder/react-native-bounceable';
import { Control, Controller, FieldError } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { nunitoBold, nunitoRegular } from '@/util/fonts/fonts.util';
import type { OnboardingFormInput } from '@/util/onboarding/onboarding.util';

interface StepGenderProps {
  control: Control<OnboardingFormInput>;
  error: FieldError | undefined;
}

/** Onboarding step that requires selecting one gender option before continuing. */
export function StepGender({ control, error }: StepGenderProps) {
  const { t } = useTranslation();

  return (
    <View style={{ flex: 1 }} className="px-8 justify-center items-center">
      <Text className="text-3xl font-bold text-foreground mb-6 text-center" style={nunitoBold}>
        {t('onboarding.genderTitle')}
      </Text>
      <Controller
        control={control}
        name="gender"
        render={({ field: { value, onChange, onBlur } }) => (
          <View className="self-stretch gap-3">
            {[
              { value: 'male', label: t('onboarding.genderMale') },
              { value: 'female', label: t('onboarding.genderFemale') },
            ].map((option) => {
              const isSelected = value === option.value;

              return (
                <RNBounceable
                  key={option.value}
                  onPress={() => {
                    onChange(option.value);
                    onBlur();
                  }}
                >
                  <View
                    className={`rounded-2xl border py-4 items-center ${
                      isSelected ? 'bg-accent border-accent' : 'bg-card border-border'
                    }`}
                  >
                    <Text
                      className={`text-lg ${isSelected ? 'text-on-accent' : 'text-foreground'}`}
                      style={nunitoBold}
                    >
                      {option.label}
                    </Text>
                  </View>
                </RNBounceable>
              );
            })}
          </View>
        )}
      />
      {error && (
        <Text className="text-sm text-red-500 mt-3" style={nunitoRegular}>
          {error.message}
        </Text>
      )}
    </View>
  );
}
