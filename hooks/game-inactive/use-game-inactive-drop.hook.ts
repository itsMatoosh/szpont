import { useCallback, useEffect, useMemo, useState } from 'react';

import { supabase } from '@/util/supabase/supabase.util';

const DROP_SIZE = 2;
const DEFAULT_ELO = 1200;

/** One profile card candidate shown in game lobby drops. */
export interface GameInactiveDropCandidate {
  id: string;
  displayName: string;
  bio: string;
  age: number;
  imageUri: string;
  rating: number;
}

interface UseGameInactiveDropState {
  currentDrop: GameInactiveDropCandidate[];
  ratingsByUserId: Record<string, number>;
  isLoading: boolean;
  isSubmitting: boolean;
  error: string | null;
  dropIndex: number;
}

interface UseGameInactiveDropResult {
  currentDrop: GameInactiveDropCandidate[];
  dropIndex: number;
  dropAlignment: 'even' | 'odd';
  isLoading: boolean;
  isSubmitting: boolean;
  isFinished: boolean;
  error: string | null;
  ratingsByUserId: Record<string, number>;
  selectWinner: (winnerId: string) => Promise<void>;
  refresh: () => Promise<void>;
}

/**
 * Drives the game lobby 2-card drop flow using backend-served candidates.
 */
export function useGameInactiveDrop(currentUserId: string | null): UseGameInactiveDropResult {
  const [state, setState] = useState<UseGameInactiveDropState>({
    currentDrop: [],
    ratingsByUserId: {},
    isLoading: true,
    isSubmitting: false,
    error: null,
    dropIndex: 0,
  });

  const currentDrop = useMemo(() => state.currentDrop, [state.currentDrop]);

  const dropAlignment = state.dropIndex % 2 === 0 ? 'even' : 'odd';
  const isFinished = !state.isLoading && currentDrop.length < DROP_SIZE;

  /** Fetches the next game lobby drop from the backend RPC. */
  const fetchGameLobbyDrop = useCallback(async (): Promise<GameInactiveDropCandidate[]> => {
    const { data, error } = await supabase.rpc('get_game_lobby_drop');
    if (error) {
      throw error;
    }
    return (data ?? []).map((row) => ({
      id: row.user_id,
      displayName: row.display_name,
      bio: row.bio,
      age: row.age,
      rating: Number(row.rating),
      // Deterministic avatar per user id so cards remain visually stable across drops.
      imageUri: `https://api.dicebear.com/9.x/lorelei/png?seed=${encodeURIComponent(row.user_id)}&size=512`,
    }));
  }, []);

  const refresh = useCallback(async () => {
    if (!currentUserId) {
      setState((prev) => ({
        ...prev,
        currentDrop: [],
        ratingsByUserId: {},
        isLoading: false,
        isSubmitting: false,
        dropIndex: 0,
        error: null,
      }));
      return;
    }

    setState((prev) => ({ ...prev, isLoading: true, error: null, dropIndex: 0 }));
    try {
      const nextDrop = await fetchGameLobbyDrop();
      const nextRatingsByUserId = nextDrop.reduce<Record<string, number>>((acc, candidate) => {
        acc[candidate.id] = candidate.rating;
        return acc;
      }, {});
      setState((prev) => ({
        ...prev,
        currentDrop: nextDrop,
        ratingsByUserId: nextRatingsByUserId,
        isLoading: false,
        error: null,
        dropIndex: 0,
      }));
    } catch (error: unknown) {
      setState((prev) => ({
        ...prev,
        currentDrop: [],
        ratingsByUserId: {},
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to load game lobby drop.',
      }));
    }
  }, [currentUserId, fetchGameLobbyDrop]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const selectWinner = useCallback(
    async (winnerId: string) => {
      if (state.isSubmitting || currentDrop.length < DROP_SIZE) return;
      const winner = currentDrop.find((candidate) => candidate.id === winnerId);
      if (!winner) return;

      const loser = currentDrop.find((candidate) => candidate.id !== winnerId);
      if (!loser) return;

      setState((prev) => ({ ...prev, isSubmitting: true, error: null }));

      const { data: updatedRatings, error: voteError } = await supabase.rpc('send_rank_game_vote', {
        p_winner_id: winnerId,
        p_loser_id: loser.id,
      });
      if (voteError) {
        setState((prev) => ({
          ...prev,
          isSubmitting: false,
          error: voteError.message,
        }));
        return;
      }

      const nextRatingsByUserId = { ...state.ratingsByUserId };
      for (const row of updatedRatings ?? []) {
        nextRatingsByUserId[row.user_id] = Number(row.rating);
      }

      try {
        const nextDrop = await fetchGameLobbyDrop();
        for (const candidate of nextDrop) {
          if (nextRatingsByUserId[candidate.id] == null) {
            nextRatingsByUserId[candidate.id] = candidate.rating ?? DEFAULT_ELO;
          }
        }
        setState((prev) => ({
          ...prev,
          currentDrop: nextDrop,
          ratingsByUserId: nextRatingsByUserId,
          dropIndex: prev.dropIndex + 1,
          isSubmitting: false,
          error: null,
        }));
      } catch (error: unknown) {
        setState((prev) => ({
          ...prev,
          currentDrop: [],
          ratingsByUserId: nextRatingsByUserId,
          isSubmitting: false,
          error: error instanceof Error ? error.message : 'Failed to fetch next game lobby drop.',
        }));
      }
    },
    [currentDrop, fetchGameLobbyDrop, state.isSubmitting, state.ratingsByUserId],
  );

  return {
    currentDrop,
    dropIndex: state.dropIndex,
    dropAlignment,
    isLoading: state.isLoading,
    isSubmitting: state.isSubmitting,
    isFinished,
    error: state.error,
    ratingsByUserId: state.ratingsByUserId,
    selectWinner,
    refresh,
  };
}
