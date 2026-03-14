-- Clean up zones: drop image columns, make boundary and city_id mandatory
alter table zones
  drop column background_image,
  drop column foreground_image,
  drop column logo_image;

alter table zones
  alter column boundary set not null,
  alter column city_id set not null;

-- Replace lat/lng/radius on cities with GeoJSON boundary polygons
alter table cities
  add column boundary jsonb not null,
  add column search_boundary jsonb not null;

alter table cities
  drop column latitude,
  drop column longitude,
  drop column radius;

-- Enable PostGIS for spatial queries
create extension if not exists postgis;

-- Resolve a GPS point to the city whose search_boundary contains it.
-- st_makepoint has no SRID by default; must match the 4326 on the stored polygons.
create or replace function get_city_at_point(lng float8, lat float8)
returns setof cities
language sql stable
as $$
  select *
  from cities
  where st_contains(
          st_geomfromgeojson(search_boundary::text),
          st_setsrid(st_makepoint(lng, lat), 4326)
        )
  limit 1;
$$;

-- Resolve a GPS point to the zone whose boundary contains it.
create or replace function get_zone_at_point(lng float8, lat float8)
returns setof zones
language sql stable
as $$
  select *
  from zones
  where st_contains(
          st_geomfromgeojson(boundary::text),
          st_setsrid(st_makepoint(lng, lat), 4326)
        )
  limit 1;
$$;
