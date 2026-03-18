import { en } from './en';
import { pl } from './pl';

export type Locale = 'en' | 'pl';

/** All supported locales. */
export const locales: Locale[] = ['en', 'pl'];

const translations = { en, pl } as const;

/**
 * Looks up a translation string by dot-notated key.
 * Falls back to the key itself if not found.
 */
export function t(locale: Locale, key: string): string {
  const dict = translations[locale];
  const parts = key.split('.');
  let result: unknown = dict;
  for (const part of parts) {
    if (result && typeof result === 'object' && part in result) {
      result = (result as Record<string, unknown>)[part];
    } else {
      return key;
    }
  }
  return typeof result === 'string' ? result : key;
}
