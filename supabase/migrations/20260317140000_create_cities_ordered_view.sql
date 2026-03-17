-- Cities ordered by total zone likes (descending).
-- Used by the landing page to rank cities by popularity.
CREATE OR REPLACE VIEW cities_ordered_by_zone_likes AS
SELECT
  c.id,
  c.name
FROM cities c
LEFT JOIN (
  SELECT z.city_id, COUNT(zl.id) AS total_likes
  FROM zones z
  JOIN zone_likes zl ON zl.zone_id = z.id
  GROUP BY z.city_id
) agg ON agg.city_id = c.id
ORDER BY COALESCE(agg.total_likes, 0) DESC;

GRANT SELECT ON cities_ordered_by_zone_likes TO anon, authenticated;
