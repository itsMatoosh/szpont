-- =============================================================================
-- Game Lobby RPC Surface
-- -----------------------------------------------------------------------------
-- This migration centralizes game-lobby behavior server-side so clients do not
-- query broad profile lists directly.
--
-- It introduces RPCs for:
--   1) Serving a 2-card game lobby drop (`get_game_lobby_drop`)
--   2) Persisting decision history (`record_game_lobby_like` / skip)
--   3) Applying ELO updates and decision writes in one call
--      (`send_rank_game_vote`)
--
-- Security model:
--   - Functions run as `security definer` and resolve requester via `auth.uid()`
--   - Eligibility, dedupe, and write behavior are enforced in SQL
--   - Client should call only `get_game_lobby_drop` and
--     `send_rank_game_vote` for the game flow.
-- =============================================================================

-- Moves game lobby candidate serving and decisions into backend RPCs.
drop policy if exists "Authenticated users can read all profiles" on public.users;

-- ---------------------------------------------------------------------------
-- get_game_lobby_drop
-- ---------------------------------------------------------------------------
-- Returns up to 2 candidates for the current requester.
--
-- Selection strategy:
--   - Enforce city match via `user_cities`
--   - Enforce requester filter preferences from `user_filters`
--   - Exclude already decided users from `user_likes` and `user_skips`
--   - Blend exploit/explore:
--       * closest ELO candidate
--       * one randomized alternative
--
-- Notes:
--   - Default requester ELO is 1200 when absent
--   - Ensures requester has a default `user_filters` row
-- ---------------------------------------------------------------------------
create or replace function public.get_game_lobby_drop()
returns table(
  user_id uuid,
  display_name text,
  bio text,
  age int,
  rating numeric
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_requester_id uuid := auth.uid();
  v_city_id uuid;
  v_filter_gender public.user_gender;
  v_filter_min_age int;
  v_filter_max_age int;
  v_requester_rating numeric := 1200;
begin
  if v_requester_id is null then
    return;
  end if;

  -- Ensure every user has a filter row so downstream logic can rely on concrete values.
  insert into public.user_filters (user_id)
  values (v_requester_id)
  on conflict on constraint user_filters_pkey do nothing;

  -- Get the requester's city.
  select uc.city_id
    into v_city_id
    from public.user_cities uc
    where uc.user_id = v_requester_id;

  if v_city_id is null then
    return;
  end if;

  -- Get the requester's filter preferences.
  select uf.gender, uf.min_age, uf.max_age
    into v_filter_gender, v_filter_min_age, v_filter_max_age
    from public.user_filters uf
    where uf.user_id = v_requester_id;

  -- Get the requester's ELO rating.
  select coalesce(uer.rating, 1200)
    into v_requester_rating
    from public.user_elo_ratings uer
    where uer.user_id = v_requester_id;

  -- Get the eligible users.
  return query
  with eligible as (
    select
      u.id as user_id,
      u.display_name,
      u.bio,
      extract(year from age(u.date_of_birth))::int as age,
      coalesce(uer.rating, 1200) as rating
    from public.users u
    join public.user_cities uc on uc.user_id = u.id
    left join public.user_elo_ratings uer on uer.user_id = u.id
    where uc.city_id = v_city_id
      and u.id <> v_requester_id
      and extract(year from age(u.date_of_birth))::int between v_filter_min_age and v_filter_max_age
      and (v_filter_gender is null or u.gender = v_filter_gender)
      and not exists (
        select 1
        from public.user_likes ul
        where ul.actor_user_id = v_requester_id
          and ul.target_user_id = u.id
      )
      and not exists (
        select 1
        from public.user_skips us
        where us.actor_user_id = v_requester_id
          and us.target_user_id = u.id
      )
  ),
  -- Get the closest user by ELO rating.
  closest as (
    select e.*
    from eligible e
    order by abs(e.rating - v_requester_rating), random()
    limit 1
  ),
  -- Get a random user not already in the closest user.
  explore as (
    select e.*
    from eligible e
    where not exists (
      select 1 from closest c where c.user_id = e.user_id
    )
    order by random()
    limit 1
  ),
  -- Get a random user not already in the closest or explore users.
  fallback as (
    select e.*
    from eligible e
    where not exists (
      select 1 from closest c where c.user_id = e.user_id
    )
      and not exists (
        select 1 from explore x where x.user_id = e.user_id
      )
    order by abs(e.rating - v_requester_rating), random()
    limit 1
  ),
  -- Get the final candidates.
  combined as (
    select * from closest
    union all
    select * from explore
    union all
    select * from fallback
  )
  select c.user_id, c.display_name, c.bio, c.age, c.rating
  from combined c
  limit 2;
end;
$$;

-- ---------------------------------------------------------------------------
-- record_game_lobby_like
-- ---------------------------------------------------------------------------
-- Persists a "like" edge from requester -> target and removes any conflicting
-- skip edge for that same pair.
-- ---------------------------------------------------------------------------
create or replace function public.record_game_lobby_like(p_target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_requester_id uuid := auth.uid();
begin
  if v_requester_id is null then
    raise exception 'Authentication required';
  end if;
  if p_target_user_id is null or p_target_user_id = v_requester_id then
    raise exception 'Invalid target user';
  end if;

  delete from public.user_skips
  where actor_user_id = v_requester_id
    and target_user_id = p_target_user_id;

  insert into public.user_likes (actor_user_id, target_user_id)
  values (v_requester_id, p_target_user_id)
  on conflict (actor_user_id, target_user_id) do nothing;
end;
$$;

create or replace function public.record_game_lobby_skip(p_target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_requester_id uuid := auth.uid();
begin
  if v_requester_id is null then
    raise exception 'Authentication required';
  end if;
  if p_target_user_id is null or p_target_user_id = v_requester_id then
    raise exception 'Invalid target user';
  end if;

  delete from public.user_likes
  where actor_user_id = v_requester_id
    and target_user_id = p_target_user_id;

  insert into public.user_skips (actor_user_id, target_user_id)
  values (v_requester_id, p_target_user_id)
  on conflict (actor_user_id, target_user_id) do nothing;
end;
$$;

-- ---------------------------------------------------------------------------
-- send_rank_game_vote
-- ---------------------------------------------------------------------------
-- Single-call vote pipeline for clients.
--
-- Responsibilities:
--   1) Persist decision history by calling:
--        - record_game_lobby_like(winner)
--        - record_game_lobby_skip(loser)
--   2) Recompute and persist winner/loser ELO ratings
--   3) Return updated ratings for both users
--
-- This keeps decision + rating updates in one server-side transaction context
-- and avoids multi-call client orchestration.
-- ---------------------------------------------------------------------------
create or replace function public.send_rank_game_vote(p_winner_id uuid, p_loser_id uuid)
returns table(user_id uuid, rating numeric)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_k_factor numeric := 32;
  v_winner_rating numeric := 1200;
  v_loser_rating numeric := 1200;
  v_winner_expected numeric;
  v_loser_expected numeric;
begin
  if p_winner_id is null or p_loser_id is null then
    raise exception 'Winner and loser ids are required';
  end if;
  if p_winner_id = p_loser_id then
    raise exception 'Winner and loser must be different users';
  end if;

  -- Persist this drop decision as like/skip in one server-side flow.
  perform public.record_game_lobby_like(p_winner_id);
  perform public.record_game_lobby_skip(p_loser_id);

  select coalesce(
    (select r.rating from public.user_elo_ratings r where r.user_id = p_winner_id),
    1200
  )
  into v_winner_rating;

  select coalesce(
    (select r.rating from public.user_elo_ratings r where r.user_id = p_loser_id),
    1200
  )
  into v_loser_rating;

  v_winner_expected := 1 / (1 + power(10, (v_loser_rating - v_winner_rating) / 400.0));
  v_loser_expected := 1 / (1 + power(10, (v_winner_rating - v_loser_rating) / 400.0));

  v_winner_rating := round(v_winner_rating + v_k_factor * (1 - v_winner_expected));
  v_loser_rating := round(v_loser_rating + v_k_factor * (0 - v_loser_expected));

  insert into public.user_elo_ratings (user_id, rating, updated_at)
  values (p_winner_id, v_winner_rating, now())
  on conflict on constraint user_elo_ratings_pkey do update
    set rating = excluded.rating,
        updated_at = excluded.updated_at;

  insert into public.user_elo_ratings (user_id, rating, updated_at)
  values (p_loser_id, v_loser_rating, now())
  on conflict on constraint user_elo_ratings_pkey do update
    set rating = excluded.rating,
        updated_at = excluded.updated_at;

  return query
    select r.user_id, r.rating
    from public.user_elo_ratings r
    where r.user_id in (p_winner_id, p_loser_id);
end;
$$;

-- Public RPC entry points used by authenticated clients.
grant execute on function public.get_game_lobby_drop() to authenticated;
grant execute on function public.record_game_lobby_like(uuid) to authenticated;
grant execute on function public.record_game_lobby_skip(uuid) to authenticated;
grant execute on function public.send_rank_game_vote(uuid, uuid) to authenticated;
