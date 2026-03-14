ALTER TABLE zones ADD COLUMN icon_url text;

INSERT INTO storage.buckets (id, name, public)
VALUES ('zone-icons', 'zone-icons', true);

CREATE POLICY "Public read zone icons"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'zone-icons');
