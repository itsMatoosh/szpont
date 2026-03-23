import { useQuery } from '@tanstack/react-query';

import { useLocation } from '@/hooks/location/location.context';
import { City, getCityAtPoint } from '@/util/cities/cities.util';

/** Decimal places to round coordinates to before using them as a query key (~100 m). */
const COORD_PRECISION = 3;

/**
 * Returns the city whose search_boundary contains the user's current GPS
 * position, or `null` when the user is outside every supported city.
 * Coordinates are rounded to avoid re-fetching on minor GPS jitter.
 */
export function useNearestCity(): {
  city: City | null;
  isLoading: boolean;
  isFetching: boolean;
} {
  const { location } = useLocation();

  const lng = location
    ? Number(location.coords.longitude.toFixed(COORD_PRECISION))
    : undefined;
  const lat = location
    ? Number(location.coords.latitude.toFixed(COORD_PRECISION))
    : undefined;

  const { data, isFetching } = useQuery({
    queryKey: ['cityAtPoint', lng, lat],
    queryFn: () => getCityAtPoint(lng!, lat!),
    enabled: lng != null && lat != null,
    staleTime: Infinity,
    // Keep the previous city visible while coordinates refresh in the background.
    placeholderData: (previousData) => previousData,
  });

  const hasCoordinates = lng != null && lat != null;
  const hasResolvedForCoordinates = data !== undefined;
  const isLoading = hasCoordinates && !hasResolvedForCoordinates && isFetching;

  return { city: data ?? null, isLoading, isFetching };
}
