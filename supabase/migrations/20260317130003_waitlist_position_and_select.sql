-- Add sequential position column for queue numbering
alter table waitlist
  add column position serial not null;

-- Allow anonymous visitors to read their own row back after inserting
create policy "anon_select_waitlist"
  on waitlist for select
  to anon
  using (true);
