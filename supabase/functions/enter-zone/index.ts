/**
 * Edge Function called by the background geofence task when the user enters
 * a zone. Authenticated via the device's `background_secret` so it works
 * even when the Supabase JWT has expired.
 *
 * Delegates to the `enter_zone` RPC which atomically upserts the presence
 * row (INSERT ON CONFLICT with IS DISTINCT FROM). When the RPC reports a
 * real zone change, triggers the iOS Live Activity via APNs push-to-start.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { authenticateDevice } from '../_shared/device-auth.ts';
import { startZoneLiveActivity } from '../_shared/live-activity.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, serviceRoleKey);

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const auth = await authenticateDevice(req, supabase);
  if (auth instanceof Response) return auth;

  let body: { zone_id?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid JSON' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const { zone_id } = body;
  if (!zone_id) {
    return new Response(
      JSON.stringify({ error: 'Missing zone_id' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const { data: zoneChanged, error } = await supabase.rpc('enter_zone', {
    p_user_id: auth.userId,
    p_zone_id: zone_id,
    p_device_id: auth.deviceId,
  });

  if (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }

  // Trigger Live Activity on real zone changes (fire-and-forget)
  if (zoneChanged) {
    startZoneLiveActivity(supabase, zone_id, auth.deviceId);
  }

  return new Response(
    JSON.stringify({ ok: true, zoneChanged: !!zoneChanged }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
});
