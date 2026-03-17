import type { AstroCookies } from 'astro';

/** Cookie name used to persist the anonymous visitor identity. */
export const VISITOR_COOKIE_NAME = 'szpont_visitor_id';

/** Max-age for the visitor cookie (1 year in seconds). */
const MAX_AGE = 60 * 60 * 24 * 365;

/** Reads the visitor ID from the request cookies, returning null if absent. */
export function getVisitorId(cookies: AstroCookies): string | null {
  return cookies.get(VISITOR_COOKIE_NAME)?.value ?? null;
}

/**
 * Inline script body that ensures a visitor cookie exists on the client.
 * Generates a UUID on first visit so subsequent SSR requests can identify the visitor.
 */
export const VISITOR_COOKIE_SCRIPT = `
(function(){
  var name = '${VISITOR_COOKIE_NAME}';
  if (document.cookie.split('; ').some(function(c){ return c.startsWith(name + '='); })) return;
  var id = crypto.randomUUID();
  document.cookie = name + '=' + id + '; path=/; max-age=${MAX_AGE}; SameSite=Lax';
})();
`;
