-- Replace the boundary column with explicit camera coordinates for cities.
-- search_boundary is retained for the get_city_at_point RPC.
alter table cities
  add column latitude float8,
  add column longitude float8,
  add column zoom float8;

-- Backfill existing rows before enforcing NOT NULL.
-- Add an UPDATE per city here as needed.
update cities set latitude = 52.2297, longitude = 21.0122, zoom = 11
  where name = 'Warszawa';

alter table cities
  alter column latitude set not null,
  alter column longitude set not null,
  alter column zoom set not null;

alter table cities drop column boundary;
