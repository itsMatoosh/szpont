import { createContext, ReactNode, useCallback, useContext, useMemo, useState } from 'react';

import { useActiveZoneId } from '@/hooks/active-zone/use-active-zone-id.hook';
import { useNearestCity } from '@/hooks/cities/use-nearest-city.hook';
import { type City } from '@/util/cities/cities.util';

/** Origin of the currently selected zone. */
type SelectedZoneSource = 'map' | 'active';

/** Minimal zone payload shared between map camera state and squad UI. */
interface SelectedZoneValue {
  id: string;
  name: string;
  source: SelectedZoneSource;
}

/** Public context: shell-level geo/city plus map-driven zone selection. */
interface SelectedZoneContextValue {
  /** Zone ID from OS geofencing (user inside polygon), or null. */
  activeZoneId: string | null;
  /** Resolved city from current GPS; shared query for map, geofencing, and labels. */
  nearestCity: City | null;
  selectedZoneId: string | null;
  selectedZoneName: string | null;
  selectedZoneSource: SelectedZoneSource | null;
  /** Display name of `nearestCity`; derived for squad header fallbacks. */
  currentCityName: string | null;
  clearSelectedZoneRequestVersion: number;
  setSelectedZone: (zone: SelectedZoneValue | null) => void;
  clearSelectedZone: () => void;
}

/** Internal React context instance for selected zone and shell geo state. */
const SelectedZoneContext = createContext<SelectedZoneContextValue>({
  activeZoneId: null,
  nearestCity: null,
  selectedZoneId: null,
  selectedZoneName: null,
  selectedZoneSource: null,
  currentCityName: null,
  clearSelectedZoneRequestVersion: 0,
  setSelectedZone: () => {},
  clearSelectedZone: () => {},
});

/** Props for {@link SelectedZoneProvider}. */
interface SelectedZoneProviderProps {
  children: ReactNode;
}

/**
 * Subscribes to geofence active zone and nearest city at the app shell, and holds
 * map-driven zone selection (`setSelectedZone` / `clearSelectedZone`).
 */
export function SelectedZoneProvider({ children }: SelectedZoneProviderProps) {
  const activeZoneId = useActiveZoneId();
  const { city: nearestCity } = useNearestCity();
  const [selectedZone, setSelectedZone] = useState<SelectedZoneValue | null>(null);
  const [clearSelectedZoneRequestVersion, setClearSelectedZoneRequestVersion] = useState(0);

  /** Clears current zone and bumps a version token so listeners can react to repeated clears. */
  const clearSelectedZone = useCallback(() => {
    setSelectedZone(null);
    // Increment a request token so map can react even if selected id is already null.
    setClearSelectedZoneRequestVersion((version) => version + 1);
  }, []);

  const currentCityName = nearestCity?.name ?? null;

  const value = useMemo<SelectedZoneContextValue>(
    () => ({
      activeZoneId,
      nearestCity,
      selectedZoneId: selectedZone?.id ?? null,
      selectedZoneName: selectedZone?.name ?? null,
      selectedZoneSource: selectedZone?.source ?? null,
      currentCityName,
      clearSelectedZoneRequestVersion,
      setSelectedZone,
      clearSelectedZone,
    }),
    [
      activeZoneId,
      nearestCity,
      clearSelectedZone,
      clearSelectedZoneRequestVersion,
      currentCityName,
      selectedZone,
    ],
  );

  return <SelectedZoneContext.Provider value={value}>{children}</SelectedZoneContext.Provider>;
}

/** Reads shared zone selection and shell-level geofence / nearest-city state. */
export function useSelectedZoneContext(): SelectedZoneContextValue {
  return useContext(SelectedZoneContext);
}
