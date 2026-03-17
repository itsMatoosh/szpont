import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

/** Supabase client for the public website (uses the anon key). */
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
