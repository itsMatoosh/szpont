-- Atomic RPCs for entering and exiting zones.
-- These use auth.uid() so the client never passes a user ID for mutations.

-- Atomically enters a zone: deletes any existing presence for the calling user,
-- then inserts a new row. No-op if the user is already in the given zone.
create or replace function enter_zone(p_zone_id uuid)
returns void language plpgsql security definer as $$
declare
  current_zone_id uuid;
begin
  select zone_id into current_zone_id
    from presence
    where user_id = auth.uid();

  -- Already in this zone — nothing to do
  if current_zone_id = p_zone_id then
    return;
  end if;

  -- Remove any existing presence (different zone or expired)
  if current_zone_id is not null then
    delete from presence where user_id = auth.uid();
  end if;

  insert into presence (user_id, zone_id) values (auth.uid(), p_zone_id);
end;
$$;

-- Atomically exits by deleting the calling user's presence row.
create or replace function exit_zone()
returns void language sql security definer as $$
  delete from presence where user_id = auth.uid();
$$;
