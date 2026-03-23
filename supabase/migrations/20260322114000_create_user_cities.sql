-- Tracks each authenticated user's currently resolved city.
create table public.user_cities (
  user_id uuid primary key references public.users(id) on delete cascade,
  city_id uuid not null references public.cities(id) on delete cascade,
  updated_at timestamptz not null default now()
);

create index user_cities_city_id_idx on public.user_cities (city_id);

alter table public.user_cities enable row level security;

create policy "Users can read own city"
  on public.user_cities for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can insert own city"
  on public.user_cities for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update own city"
  on public.user_cities for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
