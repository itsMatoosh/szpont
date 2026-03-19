-- Replaces the direct `DELETE FROM storage.objects` trigger with an async
-- pg_net HTTP DELETE call to the Storage REST API.  Supabase's internal
-- `storage.protect_delete()` blocks raw SQL deletes on storage tables, so
-- the only supported path is the HTTP API.
--
-- Credentials are read from Supabase Vault (secrets "project_url" and
-- "service_role_key").  If either secret is missing, the storage delete
-- is silently skipped — the DB row is still removed.

-- ── Drop the broken trigger + function ─────────────────────────────────────

drop trigger if exists cascade_delete_profile_media_storage
  on public.user_profile_media;

drop function if exists public.delete_user_profile_media_storage();

-- ── Recreate using pg_net + Vault secrets ──────────────────────────────────

create or replace function public.delete_user_profile_media_storage()
returns trigger as $$
declare
  v_url text;
  v_key text;
begin
  select decrypted_secret into v_url
    from vault.decrypted_secrets where name = 'project_url';
  select decrypted_secret into v_key
    from vault.decrypted_secrets where name = 'service_role_key';

  if v_url is not null and v_key is not null then
    -- Async HTTP DELETE — fires after the transaction commits
    perform net.http_delete(
      url := v_url || '/storage/v1/object/user-profile-media/' || old.storage_path,
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || v_key
      )
    );
  end if;

  return old;
end;
$$ language plpgsql security definer;

create trigger cascade_delete_profile_media_storage
  after delete on public.user_profile_media
  for each row
  execute function public.delete_user_profile_media_storage();
