-- Persistent device tokens for background auth and a table to store
-- fine-grained location updates pushed by the Transistor plugin while
-- a user is inside a zone.

-- ── device_tokens ──────────────────────────────────────────────────────────────

create table device_tokens (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references users(id) on delete cascade,
  token      text unique not null default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  created_at timestamptz not null default now()
);

alter table device_tokens enable row level security;

create policy "Users can view own device tokens"
  on device_tokens for select using (auth.uid() = user_id);

create policy "Users can delete own device tokens"
  on device_tokens for delete using (auth.uid() = user_id);

-- Returns an existing token for the caller or creates a new one.
create or replace function generate_device_token()
returns text language plpgsql security definer as $$
declare
  existing_token text;
begin
  select token into existing_token
    from device_tokens
    where user_id = auth.uid()
    limit 1;

  if existing_token is not null then
    return existing_token;
  end if;

  insert into device_tokens (user_id)
    values (auth.uid())
    returning token into existing_token;

  return existing_token;
end;
$$;

-- Deletes a specific token belonging to the calling user.
create or replace function revoke_device_token(p_token text)
returns void language sql security definer as $$
  delete from device_tokens
    where token = p_token
      and user_id = auth.uid();
$$;

-- ── location_updates ───────────────────────────────────────────────────────────

create table location_updates (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references users(id) on delete cascade,
  zone_id     uuid not null references zones(id) on delete cascade,
  latitude    float8 not null,
  longitude   float8 not null,
  accuracy    float8,
  recorded_at timestamptz,
  created_at  timestamptz not null default now()
);

alter table location_updates enable row level security;

create policy "Users can insert own location updates"
  on location_updates for insert with check (auth.uid() = user_id);

create policy "Users can view own location updates"
  on location_updates for select using (auth.uid() = user_id);
