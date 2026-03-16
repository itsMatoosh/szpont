/**
 * Shared APNs push-to-start logic for iOS Live Activities.
 *
 * Signs a short-lived ES256 JWT and sends the push-to-start payload to
 * APNs. Imported directly by the `enter-zone` Edge Function so no extra
 * HTTP hop is needed.
 *
 * Required Deno env vars:
 * - APNS_KEY_ID   — Apple Developer key ID
 * - APNS_TEAM_ID  — Apple Developer team ID
 * - APNS_AUTH_KEY  — Base64-encoded contents of the .p8 private key
 */

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

const APNS_KEY_ID = Deno.env.get('APNS_KEY_ID')!;
const APNS_TEAM_ID = Deno.env.get('APNS_TEAM_ID')!;
const APNS_AUTH_KEY_B64 = Deno.env.get('APNS_AUTH_KEY')!;

const APNS_HOST_PROD = 'https://api.push.apple.com';
const APNS_HOST_SANDBOX = 'https://api.sandbox.push.apple.com';
const APNS_TOPIC = 'app.szpont.push-type.liveactivity';

/** Hardcoded hint translations — avoids pulling in i18n on the server. */
const HINTS: Record<string, string> = {
  en: '\u2764\uFE0F Beware! People you liked may approach you here.',
  pl: '\u2764\uFE0F Uwaga! Osoby, kt\u00F3re polubi\u0142e\u015B, mog\u0105 tu do Ciebie zagada\u0107.',
};

// ── APNs JWT signing ──────────────────────────────────────────────────────────

/** Imports the PKCS#8 .p8 key for ES256 signing. */
async function importApnsKey(): Promise<CryptoKey> {
  const pem = atob(APNS_AUTH_KEY_B64);
  const lines = pem
    .split('\n')
    .filter((l) => !l.startsWith('-----'))
    .join('');
  const der = Uint8Array.from(atob(lines), (c) => c.charCodeAt(0));

  return crypto.subtle.importKey(
    'pkcs8',
    der,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  );
}

/** Base64url-encodes a Uint8Array or string. */
function b64url(input: Uint8Array | string): string {
  const str =
    typeof input === 'string'
      ? btoa(input)
      : btoa(String.fromCharCode(...input));
  return str.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Creates a short-lived APNs JWT (ES256, 1 hour). */
async function createApnsJwt(): Promise<string> {
  const header = b64url(JSON.stringify({ alg: 'ES256', kid: APNS_KEY_ID }));
  const payload = b64url(
    JSON.stringify({
      iss: APNS_TEAM_ID,
      iat: Math.floor(Date.now() / 1000),
    }),
  );

  const signingInput = new TextEncoder().encode(`${header}.${payload}`);
  const key = await importApnsKey();
  const sig = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    signingInput,
  );

  return `${header}.${payload}.${b64url(new Uint8Array(sig))}`;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Sends an APNs push-to-start payload to the device's zone Live Activity
 * token. Silently returns on skip conditions (no token registered, zone
 * not found). Logs errors but never throws so callers are not interrupted.
 */
export async function startZoneLiveActivity(
  supabase: SupabaseClient,
  zoneId: string,
  deviceId: string,
): Promise<void> {
  try {
    // Look up device token, locale, and sandbox flag
    const { data: device, error: deviceErr } = await supabase
      .from('devices')
      .select('zone_live_activity_token, locale, is_sandbox')
      .eq('id', deviceId)
      .maybeSingle();

    if (deviceErr || !device?.zone_live_activity_token) return;

    // Look up zone name
    const { data: zone, error: zoneErr } = await supabase
      .from('zones')
      .select('name')
      .eq('id', zoneId)
      .maybeSingle();

    if (zoneErr || !zone) return;

    // Build APNs payload
    const hint = HINTS[device.locale] ?? HINTS.en;
    const apnsPayload = {
      aps: {
        timestamp: Math.floor(Date.now() / 1000),
        event: 'start',
        'content-state': { zoneName: zone.name, hint },
        'attributes-type': 'LiveActivityAttributes',
        attributes: {},
      },
    };

    const jwt = await createApnsJwt();
    // Dev builds register with APNs sandbox; their tokens only work there
    const apnsHost = device.is_sandbox ? APNS_HOST_SANDBOX : APNS_HOST_PROD;
    const apnsUrl = `${apnsHost}/3/device/${device.zone_live_activity_token}`;

    const apnsRes = await fetch(apnsUrl, {
      method: 'POST',
      headers: {
        authorization: `bearer ${jwt}`,
        'apns-push-type': 'liveactivity',
        'apns-topic': APNS_TOPIC,
        'apns-priority': '10',
      },
      body: JSON.stringify(apnsPayload),
    });

    if (!apnsRes.ok) {
      const body = await apnsRes.text();
      console.error('[live-activity] APNs error:', apnsRes.status, body);
    }
  } catch (e) {
    console.error('[live-activity] unexpected error:', e);
  }
}
