import { defineMiddleware } from 'astro:middleware';

/**
 * Redirects the root (/) to /pl/ when the browser's Accept-Language
 * prefers Polish. Astro's i18n config exposes preferredLocale but does
 * not act on it automatically with prefixDefaultLocale: false.
 */
export const onRequest = defineMiddleware((context, next) => {
  if (context.url.pathname !== '/') return next();

  const preferred = context.preferredLocale;
  if (preferred && preferred !== 'en') {
    return context.redirect(`/${preferred}/`);
  }

  return next();
});
