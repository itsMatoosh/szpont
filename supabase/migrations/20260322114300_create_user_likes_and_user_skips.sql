-- Persists game lobby decisions so candidates are never shown twice.
create table public.user_likes (
  actor_user_id uuid not null references public.users(id) on delete cascade,
  target_user_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (actor_user_id, target_user_id),
  constraint user_likes_not_self check (actor_user_id <> target_user_id)
);

create table public.user_skips (
  actor_user_id uuid not null references public.users(id) on delete cascade,
  target_user_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (actor_user_id, target_user_id),
  constraint user_skips_not_self check (actor_user_id <> target_user_id)
);

create index user_likes_actor_target_idx on public.user_likes (actor_user_id, target_user_id);
create index user_skips_actor_target_idx on public.user_skips (actor_user_id, target_user_id);

alter table public.user_likes enable row level security;
alter table public.user_skips enable row level security;

create policy "Users can read own likes"
  on public.user_likes for select
  to authenticated
  using (auth.uid() = actor_user_id);

create policy "Users can insert own likes"
  on public.user_likes for insert
  to authenticated
  with check (auth.uid() = actor_user_id);

create policy "Users can read own skips"
  on public.user_skips for select
  to authenticated
  using (auth.uid() = actor_user_id);

create policy "Users can insert own skips"
  on public.user_skips for insert
  to authenticated
  with check (auth.uid() = actor_user_id);
