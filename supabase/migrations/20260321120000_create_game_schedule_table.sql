-- Server-controlled game schedule consumed by the mobile app.
-- Values are interpreted in each user's local timezone on the client.
create table public.game_schedule (
  id         integer primary key,
  enabled    boolean not null default true,
  -- Day mapping: 0=Sunday, 1=Monday, ... 6=Saturday
  start_day  integer not null check (start_day between 0 and 6),
  start_hour integer not null check (start_hour between 0 and 23),
  end_day    integer not null check (end_day between 0 and 6),
  end_hour   integer not null check (end_hour between 0 and 23),
  updated_at timestamptz not null default now()
);

alter table public.game_schedule enable row level security;

create policy "Anyone can view game schedule"
  on public.game_schedule for select using (true);

-- Seed weekend nights explicitly (local time per user):
-- Friday 18:00 -> Saturday 03:00
-- Saturday 18:00 -> Sunday 03:00
insert into public.game_schedule (id, enabled, start_day, start_hour, end_day, end_hour)
values
  (1, true, 5, 18, 6, 3),
  (2, true, 6, 18, 0, 3)
on conflict (id) do nothing;

-- Enable Realtime so clients can react to schedule updates instantly.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'game_schedule'
  ) then
    alter publication supabase_realtime add table public.game_schedule;
  end if;
end;
$$;
