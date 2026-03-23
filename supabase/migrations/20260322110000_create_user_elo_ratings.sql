-- Stores persistent ELO ratings for matchmaking/drop ranking.
create table public.user_elo_ratings (
  user_id uuid primary key references public.users(id) on delete cascade,
  rating numeric not null default 1200,
  updated_at timestamptz not null default now()
);

alter table public.user_elo_ratings enable row level security;

-- Table is RPC-only: no direct reads/writes from clients.
revoke all on table public.user_elo_ratings from anon, authenticated;

create or replace function public.get_user_elo_ratings(p_user_ids uuid[])
returns table(user_id uuid, rating numeric)
language sql
security definer
set search_path = public
as $$
  select r.user_id, r.rating
  from public.user_elo_ratings r
  where r.user_id = any(coalesce(p_user_ids, array[]::uuid[]));
$$;

create or replace function public.apply_inactive_drop_vote(p_winner_id uuid, p_loser_ids uuid[])
returns table(user_id uuid, rating numeric)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_k_factor numeric := 32;
  v_winner_rating numeric := 1200;
  v_loser_id uuid;
  v_loser_rating numeric := 1200;
  v_winner_expected numeric;
  v_loser_expected numeric;
begin
  if p_winner_id is null then
    raise exception 'Winner id is required';
  end if;

  if coalesce(array_length(p_loser_ids, 1), 0) <> 2 then
    raise exception 'Exactly 2 loser ids are required';
  end if;

  select coalesce(r.rating, 1200) into v_winner_rating
  from public.user_elo_ratings r
  where r.user_id = p_winner_id;

  foreach v_loser_id in array p_loser_ids
  loop
    if v_loser_id = p_winner_id then
      raise exception 'Winner cannot also be a loser';
    end if;

    select coalesce(r.rating, 1200) into v_loser_rating
    from public.user_elo_ratings r
    where r.user_id = v_loser_id;

    v_winner_expected := 1 / (1 + power(10, (v_loser_rating - v_winner_rating) / 400.0));
    v_loser_expected := 1 / (1 + power(10, (v_winner_rating - v_loser_rating) / 400.0));

    v_winner_rating := round(v_winner_rating + v_k_factor * (1 - v_winner_expected));
    v_loser_rating := round(v_loser_rating + v_k_factor * (0 - v_loser_expected));

    insert into public.user_elo_ratings (user_id, rating, updated_at)
    values (v_loser_id, v_loser_rating, now())
    on conflict (user_id) do update
      set rating = excluded.rating,
          updated_at = excluded.updated_at;
  end loop;

  insert into public.user_elo_ratings (user_id, rating, updated_at)
  values (p_winner_id, v_winner_rating, now())
  on conflict (user_id) do update
    set rating = excluded.rating,
        updated_at = excluded.updated_at;

  return query
    select r.user_id, r.rating
    from public.user_elo_ratings r
    where r.user_id = p_winner_id or r.user_id = any(p_loser_ids);
end;
$$;

grant execute on function public.get_user_elo_ratings(uuid[]) to authenticated;
grant execute on function public.apply_inactive_drop_vote(uuid, uuid[]) to authenticated;
