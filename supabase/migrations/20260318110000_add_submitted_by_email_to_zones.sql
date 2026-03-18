-- Stores the email of the person who originally suggested the zone.
-- Nullable because zones created before promotion (or manually) won't have one.
alter table zones add column submitted_by_email text;
