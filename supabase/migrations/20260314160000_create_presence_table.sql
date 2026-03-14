-- Tracks which zone a user is currently in.
-- Rows are DELETEd when the user exits; there is no soft-delete.
-- Each entry auto-expires 8 hours after creation.

create table presence (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references users(id) on delete cascade,
  zone_id    uuid not null references zones(id) on delete cascade,
  entered_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '8 hours'),

  -- A user can only be in one zone at a time
  constraint one_presence_per_user unique (user_id)
);

-- ── RLS ────────────────────────────────────────────────────────────────────────

alter table presence enable row level security;

create policy "Anyone can view presence"
  on presence for select using (true);

create policy "Users can insert own presence"
  on presence for insert with check (auth.uid() = user_id);

create policy "Users can delete own presence"
  on presence for delete using (auth.uid() = user_id);

-- ── RPCs ───────────────────────────────────────────────────────────────────────

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

-- ── Expiry cleanup ─────────────────────────────────────────────────────────────

-- Removes all presence entries whose 8-hour window has elapsed.
-- Call via Supabase cron or on-demand from the client.
create or replace function expire_stale_presence()
returns void language sql as $$
  delete from presence where expires_at < now();
$$;
