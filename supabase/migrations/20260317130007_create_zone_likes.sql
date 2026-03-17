-- Tracks anonymous visitor likes on active zones.
-- The unique constraint on (zone_id, visitor_id) prevents duplicate likes.
create table zone_likes (
  id         uuid primary key default gen_random_uuid(),
  zone_id    uuid not null references zones(id) on delete cascade,
  visitor_id text not null,
  created_at timestamptz not null default now(),
  unique (zone_id, visitor_id)
);

alter table zone_likes enable row level security;

create policy "anon_insert_zone_likes"
  on zone_likes for insert
  to anon
  with check (true);

create policy "anon_select_zone_likes"
  on zone_likes for select
  to anon
  using (true);
