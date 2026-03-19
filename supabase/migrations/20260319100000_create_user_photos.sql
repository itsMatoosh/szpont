-- ---------------------------------------------------------------------------
-- media_type enum — extensible as new formats (video, loop, …) are added
-- ---------------------------------------------------------------------------

create type public.media_type as enum ('photo');

-- pg_net is used by the storage-cleanup trigger (idempotent if already enabled)
create extension if not exists pg_net with schema extensions;

-- ---------------------------------------------------------------------------
-- user_profile_media: up to 9 profile media items per user, ordered by position
-- ---------------------------------------------------------------------------

create table public.user_profile_media (
  id            uuid        primary key default gen_random_uuid(),
  user_id       uuid        not null references public.users(id) on delete cascade,
  type          public.media_type not null default 'photo',
  position      int2        not null check (position between 0 and 8),
  storage_path  text        not null,
  created_at    timestamptz not null default now(),

  -- Deferred so the reorder RPC can temporarily create duplicate positions
  -- within a single transaction; uniqueness is enforced at commit.
  constraint user_profile_media_user_id_position_key
    unique (user_id, position) deferrable initially deferred
);

alter table public.user_profile_media enable row level security;

-- All authenticated users can view media (needed for other profiles)
create policy "Authenticated users can view all profile media"
  on public.user_profile_media for select
  to authenticated
  using (true);

create policy "Users can insert own profile media"
  on public.user_profile_media for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update own profile media"
  on public.user_profile_media for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own profile media"
  on public.user_profile_media for delete
  to authenticated
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- reorder_user_profile_media RPC — bulk-update positions for all of a user's media
-- ---------------------------------------------------------------------------

create or replace function public.reorder_user_profile_media(
  p_ordering jsonb  -- e.g. [{"id":"uuid-1","position":0},{"id":"uuid-2","position":1}]
) returns void as $$
declare
  v_user_id uuid := auth.uid();
  v_entry   jsonb;
begin
  for v_entry in select * from jsonb_array_elements(p_ordering)
  loop
    update public.user_profile_media
      set position = (v_entry->>'position')::int2
      where id = (v_entry->>'id')::uuid
        and user_id = v_user_id;
  end loop;
end;
$$ language plpgsql security definer;

-- ---------------------------------------------------------------------------
-- Auto-delete storage object when a media row is removed
-- ---------------------------------------------------------------------------

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

-- ---------------------------------------------------------------------------
-- Storage bucket + policies
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values (
    'user-profile-media',
    'user-profile-media',
    true,
    10485760,                                    -- 10 MB
    array['image/jpeg', 'image/png', 'image/webp']
  )
  on conflict (id) do nothing;

create policy "Public read access for user profile media"
  on storage.objects for select
  using (bucket_id = 'user-profile-media');

create policy "Users can upload own profile media"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'user-profile-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users can update own profile media objects"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'user-profile-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users can delete own profile media objects"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'user-profile-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ---------------------------------------------------------------------------
-- Auto-invoke process-photo Edge Function on new uploads
-- ---------------------------------------------------------------------------

create or replace function public.process_uploaded_profile_media()
returns trigger as $$
declare
  v_url text;
  v_key text;
begin
  if new.bucket_id <> 'user-profile-media' then
    return new;
  end if;

  select decrypted_secret into v_url
    from vault.decrypted_secrets where name = 'project_url';
  select decrypted_secret into v_key
    from vault.decrypted_secrets where name = 'service_role_key';

  if v_url is not null and v_key is not null then
    perform net.http_post(
      url := v_url || '/functions/v1/process-photo',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_key
      ),
      body := jsonb_build_object('storagePath', new.name)
    );
  end if;

  return new;
end;
$$ language plpgsql security definer;

create trigger on_profile_media_uploaded
  after insert on storage.objects
  for each row
  execute function public.process_uploaded_profile_media();
