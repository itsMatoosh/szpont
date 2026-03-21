-- Username is no longer part of profile creation or display.
alter table public.users
  drop constraint if exists users_username_instagram_style;

-- Remove username from the user profile schema.
alter table public.users
  drop column if exists username;
