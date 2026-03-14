-- Automatically create a geofence row whenever a zone is inserted.
-- The geofence circle is centered on the polygon centroid with a radius
-- (in meters) that reaches the farthest boundary vertex.

create or replace function create_geofence_for_zone()
returns trigger
language plpgsql
as $$
declare
  geom         geometry;
  centroid     geometry;
  max_radius_m float8;
begin
  geom     := st_setsrid(st_geomfromgeojson(new.boundary::text), 4326);
  centroid := st_centroid(geom);

  -- Find the maximum distance (meters) from centroid to any boundary vertex
  select max(st_distance(centroid::geography, (dp.geom)::geography))
  into   max_radius_m
  from   st_dumppoints(geom) as dp;

  insert into geofences (zone_id, latitude, longitude, radius)
  values (new.id, st_y(centroid), st_x(centroid), max_radius_m);

  return new;
end;
$$;

create trigger trg_create_geofence_for_zone
after insert on zones
for each row
execute function create_geofence_for_zone();

-- Backfill: create geofences for existing zones that don't have one yet
insert into geofences (zone_id, latitude, longitude, radius)
select
  z.id,
  st_y(st_centroid(geom)),
  st_x(st_centroid(geom)),
  (
    select max(st_distance(st_centroid(g.geom)::geography, (dp.geom)::geography))
    from   st_dumppoints(g.geom) as dp
  )
from zones z
cross join lateral (
  select st_setsrid(st_geomfromgeojson(z.boundary::text), 4326) as geom
) g
where not exists (
  select 1 from geofences gf where gf.zone_id = z.id
);
