-- Normalize LineString / MultiLineString boundaries into Polygon / MultiPolygon
-- so Mapbox fill layers and PostGIS st_contains queries work correctly.
--
-- Fires BEFORE INSERT OR UPDATE on both `zones` and `zone_suggestions`.
-- Also backfills any existing rows that still hold line-type geometries.

create or replace function normalize_zone_boundary()
returns trigger
language plpgsql
as $$
declare
  geom      geometry;
  gtype     text;
  line      geometry;
  polygons  geometry[] := '{}';
  i         int;
begin
  geom  := st_setsrid(st_geomfromgeojson(new.boundary::text), 4326);
  gtype := geometrytype(geom);

  if gtype = 'LINESTRING' then
    if not st_isclosed(geom) then
      geom := st_addpoint(geom, st_startpoint(geom));
    end if;
    -- A valid polygon ring needs at least 4 points (3 unique + closing)
    if st_npoints(geom) >= 4 then
      new.boundary := st_asgeojson(st_makepolygon(geom))::jsonb;
    end if;

  elsif gtype = 'MULTILINESTRING' then
    for i in 1..st_numgeometries(geom) loop
      line := st_geometryn(geom, i);
      if not st_isclosed(line) then
        line := st_addpoint(line, st_startpoint(line));
      end if;
      -- Skip degenerate rings that can't form a valid polygon
      if st_npoints(line) >= 4 then
        polygons := array_append(polygons, st_makepolygon(line));
      end if;
    end loop;
    if array_length(polygons, 1) > 0 then
      new.boundary := st_asgeojson(st_collect(polygons))::jsonb;
    end if;
  end if;

  return new;
end;
$$;

-- Attach to zones
create trigger trg_normalize_zone_boundary
before insert or update of boundary on zones
for each row
execute function normalize_zone_boundary();

-- Attach to zone_suggestions
create trigger trg_normalize_zone_suggestion_boundary
before insert or update of boundary on zone_suggestions
for each row
execute function normalize_zone_boundary();

-- Backfill: touch existing line-type rows so the trigger normalizes them
update zones
set boundary = boundary
where geometrytype(st_geomfromgeojson(boundary::text))
  in ('LINESTRING', 'MULTILINESTRING');

update zone_suggestions
set boundary = boundary
where geometrytype(st_geomfromgeojson(boundary::text))
  in ('LINESTRING', 'MULTILINESTRING');
