-- Replace the free-text city column with a proper FK to cities.
-- Nullable so existing rows (submitted before this migration) are preserved.
alter table zone_suggestions
  drop column city,
  add column city_id uuid references cities(id);

-- Allow anonymous visitors to read suggestions (needed for the zones section).
create policy "anon_select_zone_suggestions"
  on zone_suggestions for select
  to anon
  using (true);

-- Allow new cities to be created without boundary data (e.g. via the "Other" option).
alter table cities
  alter column search_boundary drop not null;

-- Finds an existing city by name or creates a new one without boundary data.
-- Security definer so anon callers don't need direct INSERT on cities.
create or replace function get_or_create_city(city_name text)
returns uuid
language plpgsql
security definer
as $$
declare
  found_id uuid;
begin
  select id into found_id
    from cities
   where lower(name) = lower(city_name)
   limit 1;

  if found_id is null then
    insert into cities (name)
    values (city_name)
    returning id into found_id;
  end if;

  return found_id;
end;
$$;
