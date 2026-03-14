import { User } from '@supabase/supabase-js';
import { useEffect, useState, useCallback } from 'react';

import { supabase } from '@/util/supabase/supabase.util';
import { Tables } from '@/util/supabase/database.types';

type Profile = Tables<'users'>;

interface ProfileState {
  profile: Profile | null;
  isLoading: boolean;
  refetch: () => Promise<void>;
}

/**
 * Fetches the current user's profile row from the `users` table.
 * Returns `null` when the user hasn't completed onboarding yet (no row).
 */
export function useProfile(user: User | null): ProfileState {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!user) {
      setProfile(null);
      setIsLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single();

    // PGRST116 = no rows returned — user hasn't onboarded
    if (error && error.code === 'PGRST116') {
      setProfile(null);
    } else {
      setProfile(data);
    }

    setIsLoading(false);
  }, [user]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { profile, isLoading, refetch: fetch };
}
