-- Stores user-level game lobby filtering preferences.
-- Reuses public.user_gender enum created in 20260322113050_use_user_gender_enum_for_users.sql.

create table public.user_filters (
  user_id uuid primary key references public.users(id) on delete cascade,
  min_age int2 not null default 15,
  max_age int2 not null default 100,
  gender public.user_gender null,
  updated_at timestamptz not null default now(),
  constraint user_filters_min_max_check check (min_age <= max_age),
  constraint user_filters_age_bounds_check check (min_age >= 15 and max_age <= 100)
);

alter table public.user_filters enable row level security;

create policy "Users can read own filters"
  on public.user_filters for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can insert own filters"
  on public.user_filters for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update own filters"
  on public.user_filters for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
