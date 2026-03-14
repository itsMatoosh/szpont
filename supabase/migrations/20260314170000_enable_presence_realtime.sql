-- Enable Supabase Realtime on the presence table so clients can subscribe
-- to INSERT/DELETE events for live presence count updates.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'presence'
  ) then
    alter publication supabase_realtime add table presence;
  end if;
end;
$$;
