import { User } from '@supabase/supabase-js';
import { createContext, ReactNode, useContext } from 'react';

import { useProfile } from '@/hooks/profile/use-profile.hook';
import { Tables } from '@/util/supabase/database.types';

type Profile = Tables<'users'>;

interface ProfileContextValue {
  profile: Profile | null;
  isLoading: boolean;
  refetch: () => Promise<void>;
}

const ProfileContext = createContext<ProfileContextValue>({
  profile: null,
  isLoading: true,
  refetch: async () => {},
});

interface ProfileProviderProps {
  user: User | null;
  children: ReactNode;
}

/** Shares profile state across the component tree so refetch propagates everywhere. */
export function ProfileProvider({ user, children }: ProfileProviderProps) {
  const value = useProfile(user);
  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

/** Reads the shared profile state from the nearest ProfileProvider. */
export function useProfileContext(): ProfileContextValue {
  return useContext(ProfileContext);
}
