-- Remove zone icon_url column and the associated storage bucket.
-- Icons are replaced by a static location pin in the UI.

alter table zones drop column icon_url;