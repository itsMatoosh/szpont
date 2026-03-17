import { en } from './en';
import { pl } from './pl';

export type Locale = 'en' | 'pl';

/** All supported locales, used by getStaticPaths to generate per-language routes. */
export const locales: Locale[] = ['en', 'pl'];

const translations = { en, pl } as const;

/** Derives a typed Locale from the [...locale] rest param (undefined → default 'en'). */
export function localeFromParam(param: string | undefined): Locale {
  return param === 'pl' ? 'pl' : 'en';
}

/** Extracts the locale from a URL path (checks for /pl/ prefix, defaults to 'en'). */
export function getLocaleFromUrl(url: URL): Locale {
  const firstSegment = url.pathname.split('/').filter(Boolean)[0];
  return firstSegment === 'pl' ? 'pl' : 'en';
}

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

/** Prefixes a path with /pl when locale is Polish; leaves as-is for English. */
export function localePath(locale: Locale, path: string): string {
  if (locale === 'pl') {
    return `/pl${path.startsWith('/') ? path : `/${path}`}`;
  }
  return path.startsWith('/') ? path : `/${path}`;
}
