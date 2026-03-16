-- Replaces the one-per-user device_tokens table with a multi-device
-- `devices` table keyed by a stable server-generated UUID. Each row
-- stores the device's platform, locale, an optional Expo push token
-- (may be absent until push permissions are granted), a background_secret
-- for authenticating Edge Function calls from the background, and (iOS
-- only) a zone Live Activity token for APNs push-to-start.
--
-- Also wires a pg_net trigger on `presence` that fires the
-- `start-live-activity` Edge Function whenever a user enters a zone.

-- ── Idempotent cleanup (allows re-running this migration) ────────────────────

drop trigger if exists on_presence_upsert on presence;
drop function if exists notify_live_activity_start();
drop function if exists enter_zone(uuid, uuid);
drop function if exists exit_zone(uuid);
drop function if exists register_device(text, text, text, uuid);
drop function if exists register_device(text, text, uuid, text);
drop function if exists update_zone_live_activity_token(uuid, text);
drop function if exists unregister_device(uuid);
alter table if exists presence drop column if exists device_id;
drop policy if exists "Users can view own devices" on devices;
drop table if exists devices;

-- ── Extensions ────────────────────────────────────────────────────────────────

create extension if not exists pgcrypto with schema extensions;

-- ── devices table ─────────────────────────────────────────────────────────────

create table devices (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  uuid not null references users(id) on delete cascade,
  expo_push_token          text,
  platform                 text not null check (platform in ('ios', 'android')),
  locale                   text not null default 'en',
  background_secret        text not null default encode(extensions.gen_random_bytes(32), 'hex'),
  zone_live_activity_token text,
  created_at               timestamptz not null default now()
);

alter table devices enable row level security;

create policy "Users can view own devices"
  on devices for select using (auth.uid() = user_id);

-- ── register_device ───────────────────────────────────────────────────────────
-- Upsert a device. Accepts an optional p_device_id cached from a previous
-- call. If found, updates the row (handles Expo push token rotation).
-- Otherwise inserts a new row. Returns { device_id, background_secret }.
-- The Expo push token is optional — it may be null when push permissions
-- have not yet been granted; a null value does not overwrite an existing token.

create or replace function register_device(
  p_platform text,
  p_locale text default 'en',
  p_device_id uuid default null,
  p_expo_push_token text default null
) returns jsonb language plpgsql security definer as $$
declare
  v_id uuid;
  v_secret text;
begin
  if p_device_id is not null then
    update devices
      set expo_push_token = coalesce(p_expo_push_token, expo_push_token),
          locale = p_locale
      where id = p_device_id and user_id = auth.uid()
      returning id, background_secret into v_id, v_secret;
  end if;

  if v_id is null then
    insert into devices (user_id, expo_push_token, platform, locale)
      values (auth.uid(), p_expo_push_token, p_platform, p_locale)
      returning id, background_secret into v_id, v_secret;
  end if;

  return jsonb_build_object('device_id', v_id, 'background_secret', v_secret);
end;
$$;

-- ── update_zone_live_activity_token ──────────────────────────────────────────
-- Stores the APNs push-to-start token for the zone Live Activity on a
-- specific device (iOS only). Identified by stable device UUID + auth.uid().

create or replace function update_zone_live_activity_token(
  p_device_id uuid,
  p_token text
) returns void language plpgsql security definer as $$
begin
  update devices
    set zone_live_activity_token = p_token
    where id = p_device_id
      and user_id = auth.uid();
end;
$$;

-- ── unregister_device ─────────────────────────────────────────────────────────
-- Removes a device on sign-out. Matched by the stable device UUID.

create or replace function unregister_device(p_device_id uuid)
returns void language sql security definer as $$
  delete from devices where id = p_device_id and user_id = auth.uid();
$$;

-- ── presence.device_id ────────────────────────────────────────────────────────

alter table presence
  add column device_id uuid references devices(id) on delete set null;

-- ── Updated enter_zone ────────────────────────────────────────────────────────
-- Requires a stable device_id so the presence row links to the correct
-- device. The pg_net trigger uses this to push to the right device.

create or replace function enter_zone(p_zone_id uuid, p_device_id uuid)
returns void language plpgsql security definer as $$
begin
  insert into presence (user_id, zone_id, device_id)
  values (auth.uid(), p_zone_id, p_device_id)
  on conflict (user_id)
  do update set
    zone_id    = excluded.zone_id,
    device_id  = excluded.device_id,
    entered_at = now(),
    expires_at = now() + interval '8 hours'
  where presence.zone_id is distinct from excluded.zone_id;
end;
$$;

-- ── Updated exit_zone ─────────────────────────────────────────────────────────
-- Requires device_id so one device cannot accidentally clear another
-- device's presence.

create or replace function exit_zone(p_device_id uuid)
returns void language plpgsql security definer as $$
begin
  delete from presence
    where user_id = auth.uid()
      and device_id = p_device_id;
end;
$$;

-- ── pg_net trigger on presence ────────────────────────────────────────────────
-- Fires on INSERT (first zone entry) and UPDATE OF zone_id (zone switch).
-- Calls the start-live-activity Edge Function with the device_id so it
-- can look up the correct push-to-start token.

create extension if not exists pg_net with schema extensions;

create or replace function notify_live_activity_start()
returns trigger language plpgsql security definer as $$
begin
  if new.device_id is null then
    return new;
  end if;

  perform net.http_post(
    url := current_setting('app.settings.supabase_url')
           || '/functions/v1/start-live-activity',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer '
           || current_setting('app.settings.service_role_key')
    ),
    body := jsonb_build_object(
      'user_id', new.user_id,
      'zone_id', new.zone_id,
      'device_id', new.device_id
    )
  );
  return new;
end;
$$;

create trigger on_presence_upsert
  after insert or update of zone_id on presence
  for each row
  execute function notify_live_activity_start();
