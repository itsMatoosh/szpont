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

/**
 * Atomically records the user as present in a zone. If the user already has
 * a presence in a *different* zone it is removed first (a user can only be
 * in one zone at a time). If already present in the *same* zone this is a
 * no-op. Runs entirely inside a single Postgres function.
 */
export async function enterZone(zoneId: string): Promise<void> {
  const { error } = await supabase.rpc('enter_zone', { p_zone_id: zoneId });
  if (error) throw error;
}

/**
 * Atomically deletes the calling user's presence row.
 * No-op if the user has no presence.
 */
export async function exitZone(): Promise<void> {
  const { error } = await supabase.rpc('exit_zone');
  if (error) throw error;
}
