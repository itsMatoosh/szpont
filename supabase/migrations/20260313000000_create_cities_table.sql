create table cities (
  id        uuid primary key default gen_random_uuid(),
  name      text not null,
  latitude  float8 not null,
  longitude float8 not null,
  radius    float8 not null
);
