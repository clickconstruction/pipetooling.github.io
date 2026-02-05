-- Function to get part IDs ordered by price count
-- This function efficiently sorts all parts by their price count without
-- needing to load all parts client-side.

CREATE OR REPLACE FUNCTION get_parts_ordered_by_price_count(
  ascending_order boolean DEFAULT true
)
RETURNS TABLE (
  part_id uuid,
  price_count bigint
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    mp.id as part_id,
    COUNT(mpp.id) as price_count
  FROM material_parts mp
  LEFT JOIN material_part_prices mpp ON mpp.part_id = mp.id
  GROUP BY mp.id
  ORDER BY 
    CASE WHEN ascending_order THEN COUNT(mpp.id) END ASC,
    CASE WHEN NOT ascending_order THEN COUNT(mpp.id) END DESC,
    mp.name;
END;
$$ LANGUAGE plpgsql STABLE;
