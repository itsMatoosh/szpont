import { Database } from '@/util/supabase/database.types';
import { supabase } from '@/util/supabase/supabase.util';

/** A city that the app supports, with display and search boundary polygons. */
export type City = Database['public']['Tables']['cities']['Row'];

/** All columns we select for city queries. */
const CITY_COLUMNS = 'id, name, search_boundary' as const;

/** Fetches all supported cities. */
export async function getCities(): Promise<City[]> {
  const { data, error } = await supabase.from('cities').select(CITY_COLUMNS);
  if (error) throw error;
  return data;
}

/** Resolves a GPS point to the city whose search_boundary contains it, or `null`. */
export async function getCityAtPoint(
  lng: number,
  lat: number,
): Promise<City | null> {
  const { data, error } = await supabase
    .rpc('get_city_at_point', { lng, lat })
    .maybeSingle();
  if (error) throw error;
  return data;
}
