/**
 * Supabase Edge Function that receives background location updates from
 * react-native-background-geolocation and persists them.
 *
 * Auth is handled via the device's `background_secret` (X-Device-Token
 * header). This avoids relying on Supabase JWTs which expire while the
 * app is backgrounded or killed.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { authenticateDevice } from '../_shared/device-auth.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(supabaseUrl, serviceRoleKey);

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const auth = await authenticateDevice(req, supabase);
  if (auth instanceof Response) return auth;

  // ── Parse the plugin's default POST body ───────────────────────────────────
  // With the default rootProperty ("location"), the plugin wraps everything:
  // { location: { coords: { latitude, longitude, accuracy, ... }, timestamp, extras: { zone_id }, ... } }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const location = body.location as Record<string, unknown> | undefined;
  const coords = location?.coords as Record<string, unknown> | undefined;
  const extras = location?.extras as Record<string, unknown> | undefined;

  const latitude = coords?.latitude as number | undefined;
  const longitude = coords?.longitude as number | undefined;
  const accuracy = coords?.accuracy as number | undefined;
  const timestamp = location?.timestamp as string | undefined;
  const zoneId = extras?.zone_id as string | undefined;

  if (latitude == null || longitude == null || !zoneId) {
    return new Response(
      JSON.stringify({ error: 'Missing required fields: latitude, longitude, zone_id' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }

  // ── Insert ─────────────────────────────────────────────────────────────────

  const { error: insertError } = await supabase.from('location_updates').insert({
    user_id: auth.userId,
    zone_id: zoneId,
    latitude,
    longitude,
    accuracy: accuracy ?? null,
    recorded_at: timestamp ?? new Date().toISOString(),
  });

  if (insertError) {
    return new Response(JSON.stringify({ error: insertError.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
