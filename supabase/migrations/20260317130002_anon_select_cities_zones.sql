-- Allow anonymous read access to cities and zones for the public website.
-- Only public data (names and boundaries) is exposed; no user data.

alter table cities enable row level security;

create policy "anon_select_cities"
  on cities for select
  to anon
  using (true);

alter table zones enable row level security;

create policy "anon_select_zones"
  on zones for select
  to anon
  using (true);

-- Authenticated users also need SELECT (the mobile app reads these)
create policy "auth_select_cities"
  on cities for select
  to authenticated
  using (true);

create policy "auth_select_zones"
  on zones for select
  to authenticated
  using (true);
