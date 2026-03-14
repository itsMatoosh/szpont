create table public.users (
  id            uuid primary key references auth.users(id) on delete cascade,
  display_name  text not null,
  username      text not null unique,
  date_of_birth date not null,
  bio           text not null default '',
  created_at    timestamptz not null default now()
);

alter table public.users enable row level security;

create policy "Users can read own profile"
  on public.users for select using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.users for insert with check (auth.uid() = id);

create policy "Users can update own profile"
  on public.users for update using (auth.uid() = id);
