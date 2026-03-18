import { defineMiddleware } from 'astro:middleware';
import { locales, type Locale } from '@/i18n/utils';

const DEFAULT_LOCALE: Locale = 'en';

/** File extensions that should never trigger a locale redirect. */
const STATIC_EXT_RE = /\.(?:css|js|json|png|jpe?g|gif|svg|ico|webp|woff2?|ttf|eot|webmanifest)$/i;

/**
 * Parses the Accept-Language header and returns the best matching locale,
 * respecting quality values (e.g. "pl-PL,pl;q=0.9,en;q=0.8").
 * Returns null when no supported locale is found.
 */
function getPreferredLocale(header: string): Locale | null {
  const langs = header.split(',').map((part) => {
    const [lang, q] = part.trim().split(';q=');
    return { lang: lang.trim().split('-')[0].toLowerCase(), q: q ? parseFloat(q) : 1 };
  });

  langs.sort((a, b) => b.q - a.q);

  for (const { lang } of langs) {
    if ((locales as readonly string[]).includes(lang)) {
      return lang as Locale;
    }
  }

  return null;
}

/**
 * Redirects first-time visitors to the /pl/ variant of the requested page
 * when their Accept-Language header prefers Polish over English.
 *
 * Skipped when:
 * - The path already has a /pl prefix (already localized)
 * - A `lang` cookie exists (user made an explicit choice)
 * - The request targets a static asset
 * - The preferred locale is the default (en)
 */
export const onRequest = defineMiddleware(({ request, cookies, url }, next) => {
  if (STATIC_EXT_RE.test(url.pathname)) return next();
  if (url.pathname === '/pl' || url.pathname.startsWith('/pl/')) return next();
  if (cookies.get('lang')) return next();

  const acceptLanguage = request.headers.get('accept-language');
  if (!acceptLanguage) return next();

  const preferred = getPreferredLocale(acceptLanguage);
  if (!preferred || preferred === DEFAULT_LOCALE) return next();

  // Build the localized URL (e.g. /suggest-zone → /pl/suggest-zone)
  const localizedPath = `/${preferred}${url.pathname === '/' ? '/' : url.pathname}`;
  return new Response(null, {
    status: 302,
    headers: { Location: localizedPath },
  });
});
