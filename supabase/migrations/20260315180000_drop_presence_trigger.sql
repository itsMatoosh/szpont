-- Removes the pg_net trigger that called start-live-activity from Postgres.
-- The enter-zone Edge Function now calls start-live-activity directly,
-- which avoids needing superuser-only app.settings.* config params.
--
-- Also updates enter_zone to return boolean (true = zone changed).

-- ── Drop trigger + helper ───────────────────────────────────────────────────

drop trigger if exists on_presence_upsert on presence;
drop function if exists notify_live_activity_start();

-- ── Replace enter_zone: return boolean ──────────────────────────────────────
-- Must drop first — CREATE OR REPLACE cannot change return type.
-- Returns true when a row was inserted or updated (zone actually changed),
-- false when the upsert was a no-op (user already in the same zone).

drop function if exists enter_zone(uuid, uuid, uuid);

create or replace function enter_zone(
  p_user_id   uuid,
  p_zone_id   uuid,
  p_device_id uuid
) returns boolean language plpgsql security definer as $$
declare
  v_rows int;
begin
  insert into presence (user_id, zone_id, device_id)
  values (p_user_id, p_zone_id, p_device_id)
  on conflict (user_id)
  do update set
    zone_id    = excluded.zone_id,
    device_id  = excluded.device_id,
    entered_at = now(),
    expires_at = now() + interval '8 hours'
  where presence.zone_id is distinct from excluded.zone_id;

  get diagnostics v_rows = row_count;
  return v_rows > 0;
end;
$$;
