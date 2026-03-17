-- Tracks anonymous visitor likes on zone suggestions.
-- The unique constraint on (suggestion_id, visitor_id) prevents duplicate likes.
create table zone_suggestion_likes (
  id            uuid primary key default gen_random_uuid(),
  suggestion_id uuid not null references zone_suggestions(id) on delete cascade,
  visitor_id    text not null,
  created_at    timestamptz not null default now(),
  unique (suggestion_id, visitor_id)
);

alter table zone_suggestion_likes enable row level security;

create policy "anon_insert_zone_suggestion_likes"
  on zone_suggestion_likes for insert
  to anon
  with check (true);

create policy "anon_select_zone_suggestion_likes"
  on zone_suggestion_likes for select
  to anon
  using (true);
