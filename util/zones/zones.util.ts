import { Database } from '@/util/supabase/database.types';
import { supabase } from '@/util/supabase/supabase.util';

export type Zone = Database['public']['Tables']['zones']['Row'];

/** All columns we select for zone queries. */
const ZONE_COLUMNS = 'id, name, city_id, boundary' as const;

/** Fetches all zones. */
export async function getZones(): Promise<Zone[]> {
  const { data, error } = await supabase.from('zones').select(ZONE_COLUMNS);
  if (error) throw error;
  return data;
}

/** Fetches a single zone by id. */
export async function getZone(id: string): Promise<Zone> {
  const { data, error } = await supabase
    .from('zones')
    .select(ZONE_COLUMNS)
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

/** Fetches all zones belonging to a given city. */
export async function getZonesByCity(cityId: string): Promise<Zone[]> {
  const { data, error } = await supabase
    .from('zones')
    .select(ZONE_COLUMNS)
    .eq('city_id', cityId);
  if (error) throw error;
  return data;
}

/** Resolves a GPS point to the zone whose boundary contains it, or `null`. */
export async function getZoneAtPoint(
  lng: number,
  lat: number,
): Promise<Zone | null> {
  const { data, error } = await supabase
    .rpc('get_zone_at_point', { lng, lat })
    .maybeSingle();
  if (error) throw error;
  return data;
}
