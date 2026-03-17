-- Waitlist sign-ups collected from the landing page
create table waitlist (
  id         uuid primary key default gen_random_uuid(),
  email      text not null unique,
  created_at timestamptz not null default now()
);

alter table waitlist enable row level security;

-- Allow anonymous visitors to insert their email
create policy "anon_insert_waitlist"
  on waitlist for insert
  to anon
  with check (true);
