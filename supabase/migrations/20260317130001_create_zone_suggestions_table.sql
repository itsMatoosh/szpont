-- Zone suggestions submitted by visitors via the website
create table zone_suggestions (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null,
  city               text not null,
  motivation         text not null,
  attendance         text not null check (
    attendance in ('< 100', '100–200', '200–500', '500–1000', '1000+')
  ),
  boundary           jsonb not null,
  submitted_by_email text not null,
  created_at         timestamptz not null default now()
);

alter table zone_suggestions enable row level security;

-- Allow anonymous visitors to submit suggestions
create policy "anon_insert_zone_suggestions"
  on zone_suggestions for insert
  to anon
  with check (true);
