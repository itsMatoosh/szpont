import { Database } from '@/util/supabase/database.types';
import { supabase } from '@/util/supabase/supabase.util';

/** A server-defined schedule window that can activate the game. */
export type GameSchedule = Database['public']['Tables']['game_schedule']['Row'];

/** Fetches all server-defined game schedule windows. */
export async function getGameSchedules(): Promise<GameSchedule[]> {
  const { data, error } = await supabase
    .from('game_schedule')
    .select('*')
    .order('id', { ascending: true });
  if (error) throw error;
  return data ?? [];
}
