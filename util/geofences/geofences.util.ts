import type { Json } from '@/util/supabase/database.types';
import { Database } from '@/util/supabase/database.types';
import { supabase } from '@/util/supabase/supabase.util';

/** A circular geofence region tied to a zone. */
export type Geofence = Database['public']['Tables']['geofences']['Row'];

/** A geofence with its parent zone's boundary attached. */
export interface GeofenceWithBoundary extends Geofence {
  boundary: Json;
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
 * boundary polygon for client-side point-in-polygon checks.
 */
export async function getGeofencesByCity(
  cityId: string,
): Promise<GeofenceWithBoundary[]> {
  const { data, error } = await supabase
    .from('geofences')
    .select('id, zone_id, latitude, longitude, radius, zones!inner(boundary, city_id)')
    .eq('zones.city_id', cityId);
  if (error) throw error;

  // Flatten the nested zones relation into a flat object
  return (data ?? []).map((row) => {
    const zone = row.zones as unknown as { boundary: Json };
    return {
      id: row.id,
      zone_id: row.zone_id,
      latitude: row.latitude,
      longitude: row.longitude,
      radius: row.radius,
      boundary: zone.boundary,
    };
  });
}
