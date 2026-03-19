import * as Crypto from 'expo-crypto';
import { File } from 'expo-file-system';
import { useCallback, useEffect, useState } from 'react';
import ImageCropPicker from 'react-native-image-crop-picker';

import { supabase } from '@/util/supabase/supabase.util';

/** Maximum width for a profile photo (4K at 2:3 aspect ratio). */
const MAX_WIDTH = 2668;

/** Maximum height for a profile photo (4K at 2:3 aspect ratio). */
const MAX_HEIGHT = 4000;

/** JPEG compression quality (0-1). Server-side processing re-validates regardless. */
const JPEG_QUALITY = 0.85;

/** A single profile photo — may be pending (local-only) or persisted. */
export interface ProfilePhoto {
  id: string;
  uri: string;
  position: number;
  storagePath?: string;
  pending: boolean;
}

/**
 * Manages the current user's profile photos: pick, crop, upload, remove,
 * reorder. Pending photos live in local state until `uploadAll` persists them.
 */
export function useProfilePhotos(userId: string | null) {
  const [photos, setPhotos] = useState<ProfilePhoto[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  /** Loads persisted photos from the database, ordered by position. */
  const fetchPhotos = useCallback(async () => {
    if (!userId) return;
    setIsLoading(true);

    const { data, error } = await supabase
      .from('user_profile_media')
      .select('*')
      .eq('user_id', userId)
      .order('position');

    if (data && !error) {
      const base = process.env.EXPO_PUBLIC_SUPABASE_URL!;
      setPhotos(
        data.map((row) => ({
          id: row.id,
          uri: `${base}/storage/v1/object/public/user-profile-media/${row.storage_path}`,
          position: row.position,
          storagePath: row.storage_path,
          pending: false,
        })),
      );
    }

    setIsLoading(false);
  }, [userId]);

  useEffect(() => {
    fetchPhotos();
  }, [fetchPhotos]);

  /**
   * Opens the camera roll, lets the user crop to 2:3, then resizes and
   * compresses to JPEG. The result is added to local state as a pending photo.
   * Server-side `process-photo` Edge Function re-validates regardless.
   */
  const pickPhoto = useCallback(async (position: number) => {
    // Open the camera roll and let the user crop to 2:3
    let image;
    try {
      image = await ImageCropPicker.openPicker({
        mediaType: 'photo',
        cropping: true,
        width: MAX_WIDTH,
        height: MAX_HEIGHT,
        compressImageMaxWidth: MAX_WIDTH,
        compressImageMaxHeight: MAX_HEIGHT,
        compressImageQuality: JPEG_QUALITY,
        forceJpg: true,
      });
    } catch {
      return;
    }

    const localId = Crypto.randomUUID();
    setPhotos((prev) => [
      ...prev,
      { id: localId, uri: image.path, position, pending: true },
    ]);
  }, []);

  /**
   * Removes a photo locally and, if persisted, deletes the DB row.
   * The storage object is cleaned up automatically by a database trigger.
   */
  const removePhoto = useCallback(
    async (photoId: string) => {
      const target = photos.find((p) => p.id === photoId);
      if (!target) return;

      // Optimistically remove the photo from local state
      setPhotos((prev) => {
        const filtered = prev.filter((p) => p.id !== photoId);
        return filtered
          .sort((a, b) => a.position - b.position)
          .map((p, i) => ({ ...p, position: i }));
      });

      // Delete the photo from the database
      if (target.storagePath) {
        await supabase.from('user_profile_media').delete().eq('id', target.id);
      }
    },
    [photos],
  );

  /**
   * Optimistically reorders photos in local state, then persists the full
   * ordering via `reorder_user_profile_media` RPC. Rolls back on failure.
   */
  const reorderPhotos = useCallback(
    async (photoId: string, newPosition: number) => {
      const target = photos.find((p) => p.id === photoId);
      if (!target || target.position === newPosition) return;

      const oldPosition = target.position;

      const updated = photos.map((p) => {
        if (p.id === photoId) return { ...p, position: newPosition };
        if (oldPosition < newPosition) {
          if (p.position > oldPosition && p.position <= newPosition) {
            return { ...p, position: p.position - 1 };
          }
        } else {
          if (p.position >= newPosition && p.position < oldPosition) {
            return { ...p, position: p.position + 1 };
          }
        }
        return p;
      });

      setPhotos(updated);

      const persisted = updated.filter((p) => !p.pending);
      if (persisted.length > 0) {
        const { error } = await supabase.rpc('reorder_user_profile_media', {
          p_ordering: persisted.map((p) => ({ id: p.id, position: p.position })),
        });
        if (error) await fetchPhotos();
      }
    },
    [photos, fetchPhotos],
  );

  /** Uploads all pending photos to storage, runs server-side processing, and inserts DB rows. */
  const uploadAll = useCallback(async () => {
    if (!userId) return;

    const pending = photos.filter((p) => p.pending);

    for (const photo of pending) {
      const fileName = `${userId}/${photo.id}.jpg`;

      // RN fetch() returns empty blobs for file:// URIs and RN's Blob doesn't
      // accept ArrayBuffer — read via expo-file-system and pass ArrayBuffer directly.
      const file = new File(photo.uri);
      const arrayBuffer = await file.arrayBuffer();

      // Upload the file to the storage
      const { error: uploadError } = await supabase.storage
        .from('user-profile-media')
        .upload(fileName, arrayBuffer, { contentType: 'image/jpeg', upsert: true });

      if (uploadError) throw uploadError;

      // Insert the photo into the database
      const { error: dbError } = await supabase.from('user_profile_media').insert({
        id: photo.id,
        user_id: userId,
        type: 'photo',
        position: photo.position,
        storage_path: fileName,
      });

      if (dbError) throw dbError;
    }

    setPhotos((prev) =>
      prev.map((p) =>
        p.pending
          ? { ...p, pending: false, storagePath: `${userId}/${p.id}.jpg` }
          : p,
      ),
    );
  }, [photos, userId]);

  return {
    photos,
    isLoading,
    pickPhoto,
    removePhoto,
    reorderPhotos,
    uploadAll,
    fetchPhotos,
    setPhotos,
  };
}
