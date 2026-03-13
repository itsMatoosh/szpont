import { Database } from '@/util/supabase/database.types';
import { supabase } from '@/util/supabase/supabase.util';

/** A city that the app supports, with its center point and coverage radius. */
export type City = Database['public']['Tables']['cities']['Row'];

/** Fetches all supported cities. */
export async function getCities(): Promise<City[]> {
  const { data, error } = await supabase
    .from('cities')
    .select('id, name, latitude, longitude, radius');
  if (error) throw error;
  return data;
}
