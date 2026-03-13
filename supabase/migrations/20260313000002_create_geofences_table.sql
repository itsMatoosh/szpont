create table geofences (
  id        uuid primary key default gen_random_uuid(),
  zone_id   uuid not null references zones(id),
  latitude  float8 not null,
  longitude float8 not null,
  radius    float8 not null
);
