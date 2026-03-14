import { useTranslation } from 'react-i18next';

import { ForegroundLocationGate } from '@/components/foreground-location-gate/foreground-location-gate.component';
import { MapView } from '@/components/map-view/map-view.component';

/** Map screen: location-gated full-screen map. */
export default function MapScreen() {
  const { t } = useTranslation();

  return (
    <ForegroundLocationGate
      title={t('locationGate.foregroundTitle')}
      message={t('locationGate.foregroundMessage')}
    >
      <MapView />
    </ForegroundLocationGate>
  );
}
