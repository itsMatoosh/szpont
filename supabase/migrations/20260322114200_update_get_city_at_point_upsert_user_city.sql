-- Resolves city by coordinates and persists the caller's latest city.
create or replace function public.get_city_at_point(lng float8, lat float8)
returns setof public.cities
language plpgsql
security definer
set search_path = public
as $$
declare
  v_city public.cities%rowtype;
  v_user_id uuid := auth.uid();
begin
  select c.*
    into v_city
    from public.cities c
    where st_contains(
            st_geomfromgeojson(c.search_boundary::text),
            st_setsrid(st_makepoint(lng, lat), 4326)
          )
    limit 1;

  if not found then
    return;
  end if;

  if v_user_id is not null then
    insert into public.user_cities (user_id, city_id, updated_at)
    values (v_user_id, v_city.id, now())
    on conflict (user_id) do update
      set city_id = excluded.city_id,
          updated_at = excluded.updated_at;
  end if;

  return next v_city;
end;
$$;

grant execute on function public.get_city_at_point(float8, float8) to authenticated;
