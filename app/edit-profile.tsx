import Ionicons from '@expo/vector-icons/Ionicons';
import RNBounceable from '@freakycoder/react-native-bounceable';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  useColorScheme,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PhotoGrid } from '@/components/photo-grid/photo-grid.component';
import { useAuth } from '@/hooks/auth/use-auth.hook';
import { useProfilePhotos } from '@/hooks/photos/use-profile-photos.hook';
import { useProfileContext } from '@/hooks/profile/profile.context';
import { supabase } from '@/util/supabase/supabase.util';

const nunitoBold = { fontFamily: 'Nunito_700Bold' } as const;
const nunitoSemiBold = { fontFamily: 'Nunito_600SemiBold' } as const;
const nunitoRegular = { fontFamily: 'Nunito_400Regular' } as const;

/** Screen for editing profile photos, display name, and bio. */
export default function EditProfileScreen() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { profile, refetch } = useProfileContext();
  const insets = useSafeAreaInsets();
  const scheme = useColorScheme();
  const foreground = scheme === 'dark' ? '#F5F5F5' : '#262626';

  const { photos, pickPhoto, removePhoto, reorderPhotos, uploadAll } =
    useProfilePhotos(user?.id ?? null);

  const [displayName, setDisplayName] = useState(profile?.display_name ?? '');
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [saving, setSaving] = useState(false);

  const canSave = displayName.trim().length >= 3 && photos.length >= 3;

  /** Persists photo and text changes, then navigates back. */
  async function handleSave() {
    if (!user || saving || !canSave) return;
    setSaving(true);

    try {
      await uploadAll();

      const { error } = await supabase
        .from('users')
        .update({ display_name: displayName.trim(), bio: bio.trim() })
        .eq('id', user.id);

      if (error) throw error;
      await refetch();
      router.back();
    } catch (e: unknown) {
      Alert.alert('Error', (e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <View
      className="flex-1 bg-background"
      style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header */}
        <View className="flex-row items-center justify-between px-4 h-12">
          <RNBounceable onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={28} className="text-foreground" />
          </RNBounceable>
          <Text className="text-lg font-bold text-foreground" style={nunitoBold}>
            {t('editProfile.title')}
          </Text>
          <RNBounceable onPress={handleSave} disabled={!canSave || saving}>
            {saving ? (
              <ActivityIndicator size="small" />
            ) : (
              <Ionicons
                name="checkmark-circle"
                size={32}
                color={canSave ? '#FF4458' : '#555'}
              />
            )}
          </RNBounceable>
        </View>

        <ScrollView
          className="flex-1"
          contentContainerClassName="px-4 pb-12"
          keyboardShouldPersistTaps="handled"
        >
          {/* Photo grid */}
          <View className="mt-4">
            <PhotoGrid
              photos={photos.map((p) => ({
                id: p.id,
                uri: p.uri,
                position: p.position,
              }))}
              onAdd={(pos) => pickPhoto(pos)}
              onRemove={removePhoto}
              onReorder={reorderPhotos}
            />
          </View>

          {/* Display name */}
          <Text
            className="text-sm font-semibold text-muted mt-6 mb-2"
            style={nunitoSemiBold}
          >
            {t('onboarding.nameTitle')}
          </Text>
          <View className="border-b border-border pb-2">
            <TextInput
              style={[{ fontSize: 18, color: foreground }, nunitoRegular]}
              value={displayName}
              onChangeText={setDisplayName}
              placeholder={t('onboarding.namePlaceholder')}
              placeholderTextColor="#8E8E8E"
            />
          </View>

          {/* Bio */}
          <Text
            className="text-sm font-semibold text-muted mt-6 mb-2"
            style={nunitoSemiBold}
          >
            {t('editProfile.bioLabel')}
          </Text>
          <View className="border-b border-border pb-2">
            <TextInput
              style={[{ fontSize: 18, color: foreground }, nunitoRegular]}
              value={bio}
              onChangeText={setBio}
              placeholder={t('editProfile.bioPlaceholder')}
              placeholderTextColor="#8E8E8E"
              multiline
              maxLength={300}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
