/**
 * Edge Function called by the background geofence task when the user exits
 * a zone. Authenticated via the device's `background_secret` so it works
 * even when the Supabase JWT has expired.
 *
 * Delegates to the `exit_zone` RPC which deletes the presence row only
 * for the authenticated user + device pair.
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

  const { error } = await supabase.rpc('exit_zone', {
    p_user_id: auth.userId,
    p_device_id: auth.deviceId,
  });

  if (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }

  return new Response(
    JSON.stringify({ ok: true }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
});
