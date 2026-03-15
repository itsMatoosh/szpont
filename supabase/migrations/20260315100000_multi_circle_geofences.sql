-- Replace single-circle geofence generation with adaptive multi-circle
-- coverage via recursive binary subdivision of the zone polygon.
--
-- Algorithm per zone:
-- 1. Compute the bounding circle (centroid + max vertex distance)
-- 2. Compute a waste ratio: 1 - polygon_area / circle_area
-- 3. If waste < 70% or max depth (3) reached, emit a single geofence
-- 4. Otherwise, compute the oriented bounding rectangle, bisect it
--    along its longer dimension, split the polygon, and recurse
-- 5. Each emitted circle includes a 15 m overlap buffer to prevent
--    brief false-exit events when walking between adjacent circles

-- ── Recursive subdivision ───────────────────────────────────────────────────────

create or replace function subdivide_zone_geofence(
  p_zone_id uuid,
  p_geom    geometry,
  p_depth   int
)
returns void
language plpgsql
as $$
declare
  centroid_pt   geometry;
  max_radius_m  float8;
  poly_area_m2  float8;
  circle_area   float8;
  waste         float8;
  obb           geometry;
  ring          geometry;
  p0 geometry;  p1 geometry;  p2 geometry;  p3 geometry;
  len_01        float8;
  len_12        float8;
  mid_a         geometry;
  mid_b         geometry;
  dx            float8;
  dy            float8;
  ext_a         geometry;
  ext_b         geometry;
  blade         geometry;
  parts         geometry;
  part          geometry;
  i             int;
begin
  if p_geom is null or st_isempty(p_geom) or st_dimension(p_geom) < 2 then
    return;
  end if;

  centroid_pt := st_centroid(p_geom);

  -- Bounding circle: centroid → farthest vertex
  select max(st_distance(centroid_pt::geography, (dp.geom)::geography))
  into   max_radius_m
  from   st_dumppoints(p_geom) as dp;

  -- Waste = fraction of circle area that falls outside the polygon
  poly_area_m2 := st_area(p_geom::geography);
  circle_area  := pi() * max_radius_m * max_radius_m;
  waste        := 1.0 - poly_area_m2 / nullif(circle_area, 0);

  -- Accept this piece if waste is acceptable or we've hit max recursion depth.
  -- 0.7 threshold = only subdivide when >70% of the circle falls outside the
  -- polygon, which targets genuinely poor fits (L-shapes, thin strips, etc.).
  if waste < 0.7 or poly_area_m2 = 0 or p_depth >= 3 then
    insert into geofences (zone_id, latitude, longitude, radius)
    values (p_zone_id, st_y(centroid_pt), st_x(centroid_pt), max_radius_m + 15.0);
    return;
  end if;

  -- Oriented minimum bounding rectangle of this piece
  obb  := st_orientedenvelope(p_geom);
  ring := st_exteriorring(obb);

  -- Extract 4 corners (ring has 5 points: p0, p1, p2, p3, p0)
  p0 := st_pointn(ring, 1);
  p1 := st_pointn(ring, 2);
  p2 := st_pointn(ring, 3);
  p3 := st_pointn(ring, 4);

  -- Two pairs of opposite edge lengths
  len_01 := st_distance(p0::geography, p1::geography);
  len_12 := st_distance(p1::geography, p2::geography);

  -- Bisect the longer dimension: the cutting line connects the midpoints
  -- of the two longer edges, running parallel to the shorter edges
  if len_01 >= len_12 then
    mid_a := st_lineinterpolatepoint(st_makeline(p0, p1), 0.5);
    mid_b := st_lineinterpolatepoint(st_makeline(p3, p2), 0.5);
  else
    mid_a := st_lineinterpolatepoint(st_makeline(p1, p2), 0.5);
    mid_b := st_lineinterpolatepoint(st_makeline(p0, p3), 0.5);
  end if;

  -- Extend blade well past the geometry so ST_Split fully crosses the boundary
  dx    := st_x(mid_b) - st_x(mid_a);
  dy    := st_y(mid_b) - st_y(mid_a);
  ext_a := st_setsrid(st_makepoint(st_x(mid_a) - dx, st_y(mid_a) - dy), 4326);
  ext_b := st_setsrid(st_makepoint(st_x(mid_b) + dx, st_y(mid_b) + dy), 4326);
  blade := st_makeline(ext_a, ext_b);

  -- ST_Split can fail on degenerate or tangent edge cases
  begin
    parts := st_split(p_geom, blade);
  exception when others then
    insert into geofences (zone_id, latitude, longitude, radius)
    values (p_zone_id, st_y(centroid_pt), st_x(centroid_pt), max_radius_m + 15.0);
    return;
  end;

  -- If the blade didn't actually divide the geometry, emit as-is to
  -- avoid infinite recursion
  if st_numgeometries(parts) <= 1 then
    insert into geofences (zone_id, latitude, longitude, radius)
    values (p_zone_id, st_y(centroid_pt), st_x(centroid_pt), max_radius_m + 15.0);
    return;
  end if;

  for i in 1..st_numgeometries(parts) loop
    part := st_geometryn(parts, i);
    perform subdivide_zone_geofence(p_zone_id, part, p_depth + 1);
  end loop;
end;
$$;

-- ── Entry-point wrapper ─────────────────────────────────────────────────────────

create or replace function generate_zone_geofences(
  p_zone_id  uuid,
  p_boundary jsonb
)
returns void
language plpgsql
as $$
declare
  geom geometry;
begin
  geom := st_setsrid(st_geomfromgeojson(p_boundary::text), 4326);
  perform subdivide_zone_geofence(p_zone_id, geom, 0);
end;
$$;

-- ── Replace the old trigger ─────────────────────────────────────────────────────

drop trigger if exists trg_create_geofence_for_zone on zones;
drop trigger if exists trg_create_geofences_for_zone on zones;
drop function if exists create_geofence_for_zone();

create or replace function create_geofences_for_zone()
returns trigger
language plpgsql
as $$
begin
  perform generate_zone_geofences(new.id, new.boundary);
  return new;
end;
$$;

create trigger trg_create_geofences_for_zone
after insert on zones
for each row
execute function create_geofences_for_zone();

-- ── Backfill: regenerate geofences for all existing zones ───────────────────────

delete from geofences;

do $$
declare
  z record;
begin
  for z in select id, boundary from zones loop
    perform generate_zone_geofences(z.id, z.boundary);
  end loop;
end;
$$;
