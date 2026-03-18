/**
 * Promotes a zone suggestion into a full zone, migrating all visitor likes.
 *
 * Usage:
 *   node scripts/promote-zone-suggestion.mjs            # list suggestions
 *   node scripts/promote-zone-suggestion.mjs --id <uuid> # promote one
 *
 * Requires EXPO_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars.
 */

import { createClient } from '@supabase/supabase-js';
import { parseArgs } from 'node:util';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error(
    'Missing EXPO_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY',
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const { values } = parseArgs({
  options: { id: { type: 'string' } },
  strict: false,
});

/**
 * Lists all zone suggestions with their like counts.
 * Exits after printing the table.
 */
async function listSuggestions() {
  const { data, error } = await supabase
    .from('zone_suggestions')
    .select('id, name, city_id, submitted_by_email, created_at, zone_suggestion_likes(count)')
    .order('created_at', { ascending: false });

  if (error) throw error;

  if (!data.length) {
    console.log('No zone suggestions found.');
    return;
  }

  console.log('Zone suggestions:\n');

  for (const s of data) {
    const likes = s.zone_suggestion_likes?.[0]?.count ?? 0;
    console.log(`  ${s.id}  ${s.name}  (${likes} likes)  ${s.submitted_by_email}  ${s.created_at}`);
  }

  console.log('\nRun again with --id <uuid> to promote one.');
}

/**
 * Promotes a single zone suggestion into an active zone.
 * Copies name, city_id, boundary, and submitted_by_email into `zones`,
 * migrates all likes from `zone_suggestion_likes` to `zone_likes`,
 * then deletes the original suggestion.
 */
async function promote(suggestionId) {
  // 1. Fetch the suggestion
  const { data: suggestion, error: fetchError } = await supabase
    .from('zone_suggestions')
    .select('id, name, city_id, boundary, submitted_by_email')
    .eq('id', suggestionId)
    .single();

  if (fetchError) {
    console.error(`Failed to fetch suggestion ${suggestionId}:`, fetchError.message);
    process.exit(1);
  }

  console.log(`Promoting "${suggestion.name}" (${suggestion.id}) …`);

  // 2. Insert the new zone
  const { data: zone, error: insertError } = await supabase
    .from('zones')
    .insert({
      name: suggestion.name,
      city_id: suggestion.city_id,
      boundary: suggestion.boundary,
      submitted_by_email: suggestion.submitted_by_email,
    })
    .select('id')
    .single();

  if (insertError) {
    console.error('Failed to insert zone:', insertError.message);
    process.exit(1);
  }

  console.log(`  Created zone ${zone.id}`);

  // 3. Fetch all likes for this suggestion
  const { data: likes, error: likesError } = await supabase
    .from('zone_suggestion_likes')
    .select('visitor_id, created_at')
    .eq('suggestion_id', suggestionId);

  if (likesError) {
    console.error('Failed to fetch suggestion likes:', likesError.message);
    process.exit(1);
  }

  // 4. Bulk-insert likes into zone_likes
  if (likes.length > 0) {
    const rows = likes.map((l) => ({
      zone_id: zone.id,
      visitor_id: l.visitor_id,
      created_at: l.created_at,
    }));

    const { error: bulkError } = await supabase
      .from('zone_likes')
      .insert(rows);

    if (bulkError) {
      console.error('Failed to migrate likes:', bulkError.message);
      process.exit(1);
    }
  }

  console.log(`  Migrated ${likes.length} like(s)`);

  // 5. Delete the suggestion (cascades to zone_suggestion_likes)
  const { error: deleteError } = await supabase
    .from('zone_suggestions')
    .delete()
    .eq('id', suggestionId);

  if (deleteError) {
    console.error('Failed to delete suggestion:', deleteError.message);
    process.exit(1);
  }

  console.log(`  Deleted suggestion ${suggestionId}`);
  console.log(`\nDone — zone "${suggestion.name}" is now live (${zone.id}).`);
}

async function main() {
  if (values.id) {
    await promote(values.id);
  } else {
    await listSuggestions();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
