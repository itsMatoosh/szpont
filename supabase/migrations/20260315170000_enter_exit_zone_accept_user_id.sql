-- Replaces enter_zone / exit_zone RPCs with versions that accept an
-- explicit p_user_id parameter instead of relying on auth.uid().
--
-- This lets the Edge Functions (which authenticate via background_secret
-- and run with the service-role client) call the RPCs directly, keeping
-- the atomic INSERT ON CONFLICT / DELETE logic in one place.

-- ── Drop old signatures ─────────────────────────────────────────────────────

drop function if exists enter_zone(uuid, uuid);
drop function if exists exit_zone(uuid);

-- ── enter_zone ──────────────────────────────────────────────────────────────
-- Atomic upsert: inserts a presence row or updates it only when the zone
-- actually changed (IS DISTINCT FROM). The pg_net trigger on presence
-- fires the start-live-activity Edge Function on real zone changes.

create or replace function enter_zone(
  p_user_id   uuid,
  p_zone_id   uuid,
  p_device_id uuid
) returns void language plpgsql security definer as $$
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
end;
$$;

-- ── exit_zone ───────────────────────────────────────────────────────────────
-- Deletes presence only for the given user + device pair so one device
-- cannot accidentally clear another device's presence.

create or replace function exit_zone(
  p_user_id   uuid,
  p_device_id uuid
) returns void language plpgsql security definer as $$
begin
  delete from presence
    where user_id   = p_user_id
      and device_id = p_device_id;
end;
$$;
