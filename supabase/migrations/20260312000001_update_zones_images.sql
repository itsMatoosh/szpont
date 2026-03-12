alter table zones
  rename column image to background_image;

alter table zones
  add column foreground_image text;
