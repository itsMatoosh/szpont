-- Automatically invokes the `process-photo` Edge Function whenever a new
-- object is uploaded to the `user-profile-media` storage bucket.  Uses
-- pg_net for an async HTTP POST so the upload transaction is not blocked.
-- Credentials are read from Supabase Vault ("project_url", "service_role_key").

create or replace function public.process_uploaded_profile_media()
returns trigger as $$
declare
  v_url text;
  v_key text;
begin
  if new.bucket_id <> 'user-profile-media' then
    return new;
  end if;

  select decrypted_secret into v_url
    from vault.decrypted_secrets where name = 'project_url';
  select decrypted_secret into v_key
    from vault.decrypted_secrets where name = 'service_role_key';

  if v_url is not null and v_key is not null then
    perform net.http_post(
      url := v_url || '/functions/v1/process-photo',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_key
      ),
      body := jsonb_build_object('storagePath', new.name)
    );
  end if;

  return new;
end;
$$ language plpgsql security definer;

create trigger on_profile_media_uploaded
  after insert on storage.objects
  for each row
  execute function public.process_uploaded_profile_media();
