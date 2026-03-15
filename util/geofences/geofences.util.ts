import { Database } from '@/util/supabase/database.types';
import { supabase } from '@/util/supabase/supabase.util';

/** A circular geofence region tied to a zone. */
export type Geofence = Database['public']['Tables']['geofences']['Row'];

/** A geofence with its parent zone's name attached. */
export interface GeofenceWithZone extends Geofence {
  zone_name: string;
}

/** Fetches all geofences belonging to a given zone. */
export async function getGeofencesByZone(zoneId: string): Promise<Geofence[]> {
  const { data, error } = await supabase
    .from('geofences')
    .select('id, zone_id, latitude, longitude, radius')
    .eq('zone_id', zoneId);
  if (error) throw error;
  return data;
}

/**
 * Fetches all geofences for zones in a given city, including each zone's
 * name for notification copy.
 */
export async function getGeofencesByCity(
  cityId: string,
): Promise<GeofenceWithZone[]> {
  const { data, error } = await supabase
    .from('geofences')
    .select('id, zone_id, latitude, longitude, radius, zones!inner(name, city_id)')
    .eq('zones.city_id', cityId);
  if (error) throw error;

  return (data ?? []).map((row) => {
    const zone = row.zones as unknown as { name: string };
    return {
      id: row.id,
      zone_id: row.zone_id,
      latitude: row.latitude,
      longitude: row.longitude,
      radius: row.radius,
      zone_name: zone.name,
    };
  });
}
