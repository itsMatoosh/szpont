import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { PhotoGrid } from '@/components/photo-grid/photo-grid.component';
import type { ProfilePhoto } from '@/hooks/photos/use-profile-photos.hook';
import { nunitoBold, nunitoRegular } from '@/util/fonts/fonts.util';

interface StepPhotosProps {
  photos: ProfilePhoto[];
  onAdd: (position: number) => void;
  onRemove: (photoId: string) => void;
  onReorder: (photoId: string, newPosition: number) => void;
}

/** Onboarding step that collects at least 3 profile photos via a draggable grid. */
export function StepPhotos({ photos, onAdd, onRemove, onReorder }: StepPhotosProps) {
  const { t } = useTranslation();

  return (
    <View style={{ flex: 1 }} className="px-8 pt-4">
      <Text className="text-3xl font-bold text-foreground mb-2 text-center" style={nunitoBold}>
        {t('onboarding.photosTitle')}
      </Text>
      <Text className="text-base text-muted mb-6 text-center" style={nunitoRegular}>
        {t('onboarding.photosSubtitle')}
      </Text>
      <PhotoGrid
        photos={photos.map((p) => ({
          id: p.id,
          uri: p.uri,
          position: p.position,
        }))}
        onAdd={onAdd}
        onRemove={onRemove}
        onReorder={onReorder}
      />
    </View>
  );
}
