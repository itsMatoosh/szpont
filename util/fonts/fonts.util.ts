import { StyleSheet } from 'react-native';

/** Nunito 700 Bold font style object. */
export const nunitoBold = { fontFamily: 'Nunito_700Bold' } as const;

/** Nunito 600 SemiBold font style object. */
export const nunitoSemiBold = { fontFamily: 'Nunito_600SemiBold' } as const;

/** Nunito 400 Regular font style object. */
export const nunitoRegular = { fontFamily: 'Nunito_400Regular' } as const;

/** Shared text input styles used across onboarding and profile forms. */
export const inputStyles = StyleSheet.create({
  base: { fontSize: 24, textAlign: 'center' as const, fontFamily: 'Nunito_400Regular' },
  large: { fontSize: 30, textAlign: 'center' as const, fontFamily: 'Nunito_700Bold' },
});
