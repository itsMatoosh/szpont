alter table zones
  add column city_id uuid references cities(id);
