-- Fix race condition in enter_zone: concurrent location updates could both
-- pass the SELECT check and attempt INSERT, violating the unique constraint.
-- Uses INSERT ... ON CONFLICT for a single atomic upsert instead.

-- Ensure the unique constraint exists (may have been dropped manually)
do $$
begin
  alter table presence
    add constraint one_presence_per_user unique (user_id);
exception when duplicate_table then
  null;
end;
$$;

create or replace function enter_zone(p_zone_id uuid)
returns void language plpgsql security definer as $$
begin
  insert into presence (user_id, zone_id)
  values (auth.uid(), p_zone_id)
  on conflict (user_id)
  do update set
    zone_id    = excluded.zone_id,
    entered_at = now(),
    expires_at = now() + interval '8 hours'
  where presence.zone_id is distinct from excluded.zone_id;
end;
$$;
