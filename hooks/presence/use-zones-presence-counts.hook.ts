import { useEffect, useRef, useState } from 'react';

import type { Presence } from '@/util/presence/presence.util';
import { getZonesPresenceCounts } from '@/util/presence/presence.util';
import { supabase } from '@/util/supabase/supabase.util';

/**
 * Subscribes to Supabase Realtime on the `presence` table and maintains
 * a live map of zone_id to active user count. Falls back to an initial
 * fetch so the first render already has data.
 */
export function useZonesPresenceCounts(
  zoneIds: string[],
): Record<string, number> {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const zoneSetRef = useRef(new Set<string>());

  // Keep the set in sync so the realtime callback can read it without stale closure
  useEffect(() => {
    zoneSetRef.current = new Set(zoneIds);
  }, [zoneIds]);

  useEffect(() => {
    if (zoneIds.length === 0) {
      setCounts({});
      return;
    }

    let cancelled = false;

    // Seed with an initial fetch
    getZonesPresenceCounts(zoneIds).then((initial) => {
      if (!cancelled) setCounts(initial);
    });

    const channel = supabase
      .channel('presence-counts')
      .on<Presence>(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'presence' },
        (payload) => {
          const row = payload.new;
          if (!zoneSetRef.current.has(row.zone_id)) return;

          setCounts((prev) => ({
            ...prev,
            [row.zone_id]: (prev[row.zone_id] ?? 0) + 1,
          }));
        },
      )
      .on<Presence>(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'presence' },
        (payload) => {
          // On DELETE, payload.old contains the deleted row
          const oldRow = payload.old as Partial<Presence>;
          const zoneId = oldRow.zone_id;
          if (!zoneId || !zoneSetRef.current.has(zoneId)) return;

          setCounts((prev) => ({
            ...prev,
            [zoneId]: Math.max((prev[zoneId] ?? 1) - 1, 0),
          }));
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [zoneIds.join(',')]);

  return counts;
}
