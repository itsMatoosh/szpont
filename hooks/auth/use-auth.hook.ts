import { Session, User } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';

import { supabase } from '@/util/supabase/supabase.util';

interface AuthState {
  session: Session | null;
  user: User | null;
  isLoading: boolean;
}

/**
 * Subscribes to Supabase auth state changes and exposes the current session,
 * user, and a loading flag that is `true` until the initial session is resolved.
 */
export function useAuth(): AuthState {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Fetch the existing session on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setIsLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  return { session, user: session?.user ?? null, isLoading };
}
