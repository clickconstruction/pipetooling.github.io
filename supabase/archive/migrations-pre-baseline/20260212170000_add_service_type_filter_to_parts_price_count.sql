-- Add optional service_type_id filter to get_parts_ordered_by_price_count
-- so the Price Book tab respects the selected service type (Plumbing, Electrical, HVAC).

CREATE OR REPLACE FUNCTION get_parts_ordered_by_price_count(
  ascending_order boolean DEFAULT true,
  filter_service_type_id uuid DEFAULT NULL
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
  WHERE (filter_service_type_id IS NULL OR mp.service_type_id = filter_service_type_id)
  GROUP BY mp.id
  ORDER BY 
    CASE WHEN ascending_order THEN COUNT(mpp.id) END ASC,
    CASE WHEN NOT ascending_order THEN COUNT(mpp.id) END DESC,
    mp.name;
END;
$$ LANGUAGE plpgsql STABLE;
