import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import {
  getGameSchedules,
  type GameSchedule,
} from '@/util/game-window/game-schedule.util';
import { isGameActive } from '@/util/game-window/is-game-active.util';
import { supabase } from '@/util/supabase/supabase.util';

/** Poll interval for refreshing game-window state while the app is foregrounded. */
const GAME_STATE_POLL_MS = 30_000;

/** Returns whether the game window is currently active and keeps it up to date over time. */
export function useGameActive(): boolean {
  const [active, setActive] = useState<boolean>(false);
  const schedulesRef = useRef<GameSchedule[]>([]);

  useEffect(() => {
    let cancelled = false;

    /** Recomputes active state from the latest known schedule. */
    const refreshFromCurrentSchedule = () => {
      setActive(isGameActive(schedulesRef.current));
    };

    /** Fetches all active schedule windows and applies them to local state. */
    const loadSchedules = async () => {
      try {
        const schedules = await getGameSchedules();
        if (cancelled) return;
        schedulesRef.current = schedules;
        refreshFromCurrentSchedule();
      } catch {
        if (cancelled) return;
        schedulesRef.current = [];
        setActive(false);
      }
    };

    void loadSchedules();

    // Keep state fresh as wall-clock time moves through schedule boundaries.
    const interval = setInterval(refreshFromCurrentSchedule, GAME_STATE_POLL_MS);
    const appStateSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void loadSchedules();
      }
    });
    const channel = supabase
      .channel('game-schedule')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'game_schedule' },
        () => {
          void loadSchedules();
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      clearInterval(interval);
      appStateSub.remove();
      supabase.removeChannel(channel);
    };
  }, []);

  return active;
}
