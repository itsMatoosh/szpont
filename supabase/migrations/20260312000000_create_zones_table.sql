create table zones (
  id    uuid primary key default gen_random_uuid(),
  name  text not null,
  image text
);
