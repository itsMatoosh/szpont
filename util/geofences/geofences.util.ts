import { Database } from '@/util/supabase/database.types';
import { supabase } from '@/util/supabase/supabase.util';

/** A circular geofence region tied to a zone. */
export type Geofence = Database['public']['Tables']['geofences']['Row'];

/** Fetches all geofences belonging to a given zone. */
export async function getGeofencesByZone(zoneId: string): Promise<Geofence[]> {
  const { data, error } = await supabase
    .from('geofences')
    .select('id, zone_id, latitude, longitude, radius')
    .eq('zone_id', zoneId);
  if (error) throw error;
  return data;
}
