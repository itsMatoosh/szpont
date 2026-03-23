import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import {
  getGameSchedules,
  type GameSchedule,
} from '@/util/game-window/game-schedule.util';
import {
  getNextGameStartDateTime,
  isGameActive,
} from '@/util/game-window/is-game-active.util';
import { supabase } from '@/util/supabase/supabase.util';

/** Poll interval for refreshing game-window state while the app is foregrounded. */
const GAME_STATE_POLL_MS = 30_000;

/** Public game-window state shared across the app shell. */
interface GameActiveContextValue {
  isGameActive: boolean;
  isGameActiveLoading: boolean;
  schedules: GameSchedule[];
  nextStartAt: string | null;
}

/** Internal React context instance for game-window activity state. */
const GameActiveContext = createContext<GameActiveContextValue>({
  isGameActive: false,
  isGameActiveLoading: true,
  schedules: [],
  nextStartAt: null,
});

/** Props for {@link GameActiveProvider}. */
interface GameActiveProviderProps {
  children: ReactNode;
}

/**
 * Loads and maintains global game-window activity state so all screens share
 * one schedule subscription lifecycle.
 */
export function GameActiveProvider({ children }: GameActiveProviderProps) {
  const [active, setActive] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [schedules, setSchedules] = useState<GameSchedule[]>([]);
  const schedulesRef = useRef<GameSchedule[]>([]);

  useEffect(() => {
    let cancelled = false;

    /** Recomputes active state from the latest known schedule. */
    const refreshFromCurrentSchedule = () => {
      setActive(isGameActive(schedulesRef.current));
    };

    /** Fetches all active schedule windows and applies them to context state. */
    const loadSchedules = async () => {
      try {
        const schedules = await getGameSchedules();
        if (cancelled) return;
        schedulesRef.current = schedules;
        setSchedules(schedules);
        refreshFromCurrentSchedule();
      } catch {
        if (cancelled) return;
        schedulesRef.current = [];
        setSchedules([]);
        setActive(false);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
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

  const value = useMemo<GameActiveContextValue>(
    () => ({
      isGameActive: active,
      isGameActiveLoading: isLoading,
      schedules,
      nextStartAt: getNextGameStartDateTime(schedules)?.toISO() ?? null,
    }),
    [active, isLoading, schedules],
  );

  return <GameActiveContext.Provider value={value}>{children}</GameActiveContext.Provider>;
}

/** Reads global game-window activity state from the app shell context. */
export function useGameActiveContext(): GameActiveContextValue {
  return useContext(GameActiveContext);
}
