-- Add an emoji column to zones for use as map markers in the city overview.
alter table zones add column emoji text not null default '📍';
