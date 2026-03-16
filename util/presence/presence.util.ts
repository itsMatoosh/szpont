import { Database } from '@/util/supabase/database.types';
import { supabase } from '@/util/supabase/supabase.util';

/** A row from the `presence` table. */
export type Presence = Database['public']['Tables']['presence']['Row'];

// ── Queries ────────────────────────────────────────────────────────────────────

/**
 * Returns the user's current presence entry, or `null` if they are not in any
 * zone. Only non-expired rows are considered.
 */
export async function getActivePresence(
  userId: string,
): Promise<Presence | null> {
  const { data, error } = await supabase
    .from('presence')
    .select('*')
    .eq('user_id', userId)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * Counts how many users are currently present in a given zone.
 * Only non-expired entries are counted.
 */
export async function getZonePresenceCount(
  zoneId: string,
): Promise<number> {
  const { count, error } = await supabase
    .from('presence')
    .select('*', { count: 'exact', head: true })
    .eq('zone_id', zoneId)
    .gt('expires_at', new Date().toISOString());
  if (error) throw error;
  return count ?? 0;
}

/**
 * Fetches active presence counts for multiple zones in a single query.
 * Returns a map of zone_id to count. Zones with zero presence are omitted.
 */
export async function getZonesPresenceCounts(
  zoneIds: string[],
): Promise<Record<string, number>> {
  if (zoneIds.length === 0) return {};

  const { data, error } = await supabase
    .from('presence')
    .select('zone_id')
    .in('zone_id', zoneIds)
    .gt('expires_at', new Date().toISOString());
  if (error) throw error;

  const counts: Record<string, number> = {};
  for (const row of data ?? []) {
    counts[row.zone_id] = (counts[row.zone_id] ?? 0) + 1;
  }
  return counts;
}

// ── Mutations ──────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;

/**
 * Records the user as present in a zone via the `enter-zone` Edge Function.
 * Uses the device's `backgroundSecret` for auth so the call succeeds even
 * when the Supabase JWT has expired in the background.
 */
export async function enterZone(zoneId: string, backgroundSecret: string): Promise<void> {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/enter-zone`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Device-Token': backgroundSecret,
    },
    body: JSON.stringify({ zone_id: zoneId }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`enter-zone failed (${res.status}): ${body}`);
  }
}

/**
 * Deletes the calling device's presence row via the `exit-zone` Edge
 * Function. Only the presence belonging to this device is cleared.
 */
export async function exitZone(backgroundSecret: string): Promise<void> {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/exit-zone`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Device-Token': backgroundSecret,
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`exit-zone failed (${res.status}): ${body}`);
  }
}
