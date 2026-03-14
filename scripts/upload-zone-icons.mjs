/**
 * One-shot script to upload generated zone icons to Supabase Storage
 * and set each zone's `icon_url` column.
 *
 * Usage: node scripts/upload-zone-icons.mjs
 * Requires EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY env vars.
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const BUCKET = 'zone-icons';
const ICONS_DIR = path.resolve(__dirname, '../assets/zone-icons');

/** Maps zone name to local icon filename. */
const ZONE_ICON_MAP = {
  PKiN: 'pkin.png',
  Schodki: 'schodki.png',
  Poniat: 'poniat.png',
  'Pl. Zamkowy': 'pl-zamkowy.png',
  Newonce: 'newonce.png',
};

async function main() {
  const { data: zones, error } = await supabase.from('zones').select('id, name');
  if (error) throw error;

  for (const zone of zones) {
    const filename = ZONE_ICON_MAP[zone.name];
    if (!filename) {
      console.warn(`No icon mapped for zone "${zone.name}", skipping`);
      continue;
    }

    const filePath = path.join(ICONS_DIR, filename);
    const fileBuffer = fs.readFileSync(filePath);
    const storagePath = `${zone.id}.png`;

    console.log(`Uploading ${filename} → ${BUCKET}/${storagePath} …`);

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, fileBuffer, {
        contentType: 'image/png',
        upsert: true,
      });

    if (uploadError) {
      console.error(`  Upload failed for ${zone.name}:`, uploadError.message);
      continue;
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);

    const { error: updateError } = await supabase
      .from('zones')
      .update({ icon_url: publicUrl })
      .eq('id', zone.id);

    if (updateError) {
      console.error(`  DB update failed for ${zone.name}:`, updateError.message);
      continue;
    }

    console.log(`  done: ${zone.name} → ${publicUrl}`);
  }

  console.log('All done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
