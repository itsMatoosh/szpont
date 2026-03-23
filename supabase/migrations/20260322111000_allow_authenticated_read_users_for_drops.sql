-- Allows inactive-drop gameplay to read candidate profiles.
create policy "Authenticated users can read all profiles"
  on public.users for select
  to authenticated
  using (true);
