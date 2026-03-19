/**
 * Edge Function: process-photo
 *
 * Invoked by a storage.objects INSERT trigger (service role only).
 * Re-validates and re-compresses profile photos to max 2668x4000
 * (4K at 2:3) JPEG at quality 85, regardless of what the client sent.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Image } from 'https://deno.land/x/imagescript@1.3.0/mod.ts';

const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(Deno.env.get('SUPABASE_URL')!, serviceRoleKey);

const MAX_WIDTH = 2668;
const MAX_HEIGHT = 4000;
const JPEG_QUALITY = 85;

Deno.serve(async (req) => {
  // Only the service role key (sent by the pg_net trigger) is accepted
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (token !== serviceRoleKey) {
    return json({ error: 'Unauthorized' }, 401);
  }

  let body: { storagePath?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  const { storagePath } = body;
  if (!storagePath) {
    return json({ error: 'Missing storagePath' }, 400);
  }

  const { data: fileData, error: downloadError } = await supabase.storage
    .from('user-profile-media')
    .download(storagePath);

  if (downloadError || !fileData) {
    return json({ error: 'Failed to download image' }, 500);
  }

  try {
    const bytes = new Uint8Array(await fileData.arrayBuffer());
    const image = await Image.decode(bytes);

    if (image.width > MAX_WIDTH || image.height > MAX_HEIGHT) {
      const scale = Math.min(MAX_WIDTH / image.width, MAX_HEIGHT / image.height);
      image.resize(
        Math.round(image.width * scale),
        Math.round(image.height * scale),
      );
    }

    const encoded = await image.encodeJPEG(JPEG_QUALITY);
    const blob = new Blob([encoded], { type: 'image/jpeg' });

    const { error: uploadError } = await supabase.storage
      .from('user-profile-media')
      .update(storagePath, blob, {
        contentType: 'image/jpeg',
        upsert: true,
      });

    if (uploadError) {
      return json({ error: uploadError.message }, 500);
    }

    return json({ ok: true });
  } catch (e) {
    return json({ error: `Image processing failed: ${(e as Error).message}` }, 500);
  }
});

/** Shorthand for JSON responses. */
function json(data: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
