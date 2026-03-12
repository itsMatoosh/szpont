import { Database } from '@/util/supabase/database.types';
import { supabase } from '@/util/supabase/supabase.util';

export type Zone = Database['public']['Tables']['zones']['Row'];

export async function getZones(): Promise<Zone[]> {
  const { data, error } = await supabase.from('zones').select('id, name, background_image, foreground_image');
  if (error) throw error;
  return data;
}
