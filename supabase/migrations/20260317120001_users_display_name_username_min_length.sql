-- Enforce minimum 3 characters for display_name and username (align with app validation).

alter table public.users
  drop constraint if exists users_display_name_letters_only;

alter table public.users
  add constraint users_display_name_letters_only
  check (char_length(display_name) >= 3 and display_name ~ '^[a-zA-Z]+$');

alter table public.users
  drop constraint if exists users_username_instagram_style;

alter table public.users
  add constraint users_username_instagram_style
  check (
    char_length(username) >= 3
    and char_length(username) <= 30
    and username ~ '^[a-z0-9._]+$'
    and username !~ '^\.'
    and username !~ '\.$'
    and username !~ '\.\.'
  );
