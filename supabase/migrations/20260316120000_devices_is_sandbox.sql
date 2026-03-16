-- Adds an `is_sandbox` flag to the `devices` table so the server knows
-- whether to use the APNs sandbox or production host when sending
-- push-to-start payloads. Development builds register with APNs sandbox
-- and their tokens are rejected by the production endpoint.

-- ── Column ──────────────────────────────────────────────────────────────────

alter table devices
  add column if not exists is_sandbox boolean not null default false;

-- ── Recreate register_device with the new parameter ─────────────────────────

drop function if exists register_device(text, text, uuid, text);
drop function if exists register_device(text, text, uuid, text, boolean);

create or replace function register_device(
  p_platform        text,
  p_locale          text    default 'en',
  p_device_id       uuid    default null,
  p_expo_push_token text    default null,
  p_is_sandbox      boolean default false
) returns jsonb language plpgsql security definer as $$
declare
  v_id     uuid;
  v_secret text;
begin
  if p_device_id is not null then
    update devices
      set expo_push_token = coalesce(p_expo_push_token, expo_push_token),
          locale          = p_locale,
          is_sandbox      = p_is_sandbox
      where id = p_device_id and user_id = auth.uid()
      returning id, background_secret into v_id, v_secret;
  end if;

  if v_id is null then
    insert into devices (user_id, expo_push_token, platform, locale, is_sandbox)
      values (auth.uid(), p_expo_push_token, p_platform, p_locale, p_is_sandbox)
      returning id, background_secret into v_id, v_secret;
  end if;

  return jsonb_build_object('device_id', v_id, 'background_secret', v_secret);
end;
$$;
