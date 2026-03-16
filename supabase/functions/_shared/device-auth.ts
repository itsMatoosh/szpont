/**
 * Shared device authentication for Edge Functions.
 *
 * Authenticates background requests using the `X-Device-Token` header which
 * carries the device's `background_secret`. This avoids relying on Supabase
 * JWTs which expire while the app is backgrounded or killed.
 */

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

/** Successful auth result containing the device's owner and ID. */
export interface DeviceAuth {
  userId: string;
  deviceId: string;
}

/**
 * Reads the `X-Device-Token` header and looks up the corresponding device
 * row by `background_secret`.
 *
 * Returns the device owner's `userId` and the `deviceId` on success, or a
 * 401 `Response` on failure (missing header / unknown secret).
 */
export async function authenticateDevice(
  req: Request,
  supabase: SupabaseClient,
): Promise<DeviceAuth | Response> {
  const token = req.headers.get('x-device-token');
  if (!token) {
    return new Response(
      JSON.stringify({ error: 'Missing X-Device-Token header' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const { data, error } = await supabase
    .from('devices')
    .select('user_id, id')
    .eq('background_secret', token)
    .maybeSingle();

  if (error || !data) {
    return new Response(
      JSON.stringify({ error: 'Invalid device token' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } },
    );
  }

  return { userId: data.user_id, deviceId: data.id };
}
