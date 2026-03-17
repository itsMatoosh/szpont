import { z } from 'zod';

/** Minimum age required to use the app; used in validation. */
export const MIN_AGE = 15;

/** Maximum age allowed; used in validation. */
export const MAX_AGE = 100;

/** Translation function for localized error messages (e.g. i18n t). */
export type OnboardingSchemaT = (key: string, opts?: Record<string, unknown>) => string;

/** Parsed date of birth used for age calculation (month is 0-indexed in JS Date). */
function parseDob(day: string, month: string, year: string): Date | null {
  const d = Number(day);
  const m = Number(month) - 1;
  const y = Number(year);
  const date = new Date(y, m, d);
  if (date.getFullYear() !== y || date.getMonth() !== m || date.getDate() !== d) return null;
  return date;
}

/** Returns age in full years as of today (birthday today counts as that age). */
function ageAsOfToday(dob: Date): number {
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) age -= 1;
  return age;
}

/** Builds the onboarding form schema with localized error messages. */
export function getOnboardingFormSchema(t: OnboardingSchemaT) {
  return z
    .object({
      displayName: z
        .string()
        .min(3, t('onboarding.errors.displayNameMinLength'))
        .transform((s) => s.trim())
        .refine((s) => /^[a-zA-Z]+$/.test(s), t('onboarding.errors.displayNameLettersOnly')),
      username: z
        .string()
        .min(3, t('onboarding.errors.usernameMinLength'))
        .max(30, t('onboarding.errors.usernameMaxLength'))
        .transform((s) => s.toLowerCase().replace(/\s/g, '').trim())
        .refine((s) => /^[a-z0-9._]+$/.test(s), t('onboarding.errors.usernameInvalidChars'))
        .refine((s) => !s.startsWith('.'), t('onboarding.errors.usernameNoLeadingPeriod'))
        .refine((s) => !s.endsWith('.'), t('onboarding.errors.usernameNoTrailingPeriod'))
        .refine((s) => !s.includes('..'), t('onboarding.errors.usernameNoConsecutiveDots')),
      day: z.string().length(2, t('onboarding.errors.dobDayLength')),
      month: z.string().length(2, t('onboarding.errors.dobMonthLength')),
      year: z.string().length(4, t('onboarding.errors.dobYearLength')),
    })
    .refine(
      (data) => {
        const dob = parseDob(data.day, data.month, data.year);
        return dob !== null;
      },
      { message: t('onboarding.errors.dobInvalidDate'), path: ['year'] },
    )
    .refine(
      (data) => {
        const dob = parseDob(data.day, data.month, data.year);
        return dob !== null && ageAsOfToday(dob) >= MIN_AGE;
      },
      {
        message: t('onboarding.errors.dobMinAge', { age: MIN_AGE }),
        path: ['year'],
      },
    )
    .refine(
      (data) => {
        const dob = parseDob(data.day, data.month, data.year);
        return dob === null || ageAsOfToday(dob) <= MAX_AGE;
      },
      {
        message: t('onboarding.errors.dobMaxAge', { age: MAX_AGE }),
        path: ['year'],
      },
    );
}

/** Validated/submitted form values (after transforms). */
export type OnboardingFormValues = z.infer<ReturnType<typeof getOnboardingFormSchema>>;

/** Raw form field values (before validation/transform). */
export type OnboardingFormInput = z.input<ReturnType<typeof getOnboardingFormSchema>>;
