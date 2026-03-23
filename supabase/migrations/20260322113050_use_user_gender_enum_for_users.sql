-- Introduces shared gender enum and migrates users.gender from text to enum.
create type public.user_gender as enum ('male', 'female');

alter table public.users
  drop constraint if exists users_gender_allowed_values;

alter table public.users
  alter column gender type public.user_gender
  using gender::public.user_gender;
