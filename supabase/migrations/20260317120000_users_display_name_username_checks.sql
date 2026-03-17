-- Enforce display name: letters only (A–Z, a–z).
alter table public.users
  add constraint users_display_name_letters_only
  check (display_name ~ '^[a-zA-Z]+$');

-- Enforce username: Instagram-style (1–30 chars, a-z 0-9 . _, no leading/trailing period, no consecutive periods).
alter table public.users
  add constraint users_username_instagram_style
  check (
    char_length(username) >= 1
    and char_length(username) <= 30
    and username ~ '^[a-z0-9._]+$'
    and username !~ '^\.'
    and username !~ '\.$'
    and username !~ '\.\.'
  );
