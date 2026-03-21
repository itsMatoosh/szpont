-- Add optional gender for user profiles; onboarding will require it for new profiles.
alter table public.users
  add column gender text;

-- Restrict allowed values to the current product scope.
alter table public.users
  add constraint users_gender_allowed_values
  check (gender is null or gender in ('male', 'female'));
