import { useQuery } from '@tanstack/react-query';

import { getZonesByCity, Zone } from '@/util/zones/zones.util';

/**
 * Fetches all zones that belong to the given city.
 * The query is disabled when no `cityId` is provided.
 */
export function useZonesByCity(cityId: string | undefined): {
  zones: Zone[];
  isLoading: boolean;
} {
  const { data, isLoading } = useQuery({
    queryKey: ['zones', cityId],
    queryFn: () => getZonesByCity(cityId!),
    enabled: !!cityId,
    staleTime: Infinity,
  });

  return { zones: data ?? [], isLoading };
}
