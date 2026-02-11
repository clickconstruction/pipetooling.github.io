-- Function to get statistics per service type and supply house
-- This function provides a breakdown of price coverage by service type,
-- showing which supply houses have prices for which trades.
CREATE OR REPLACE FUNCTION get_supply_house_stats_by_service_type()
RETURNS TABLE (
  service_type_id uuid,
  service_type_name text,
  total_parts bigint,
  parts_with_prices bigint,
  parts_with_multiple_prices bigint,
  supply_house_id uuid,
  supply_house_name text,
  price_count bigint
) AS $$
BEGIN
  RETURN QUERY
  WITH service_type_stats AS (
    SELECT 
      mp.service_type_id,
      COUNT(DISTINCT mp.id) as total_parts,
      COUNT(DISTINCT CASE WHEN EXISTS(
        SELECT 1 FROM material_part_prices mpp WHERE mpp.part_id = mp.id
      ) THEN mp.id END) as parts_with_prices,
      COUNT(DISTINCT CASE WHEN (
        SELECT COUNT(*) FROM material_part_prices mpp WHERE mpp.part_id = mp.id
      ) >= 2 THEN mp.id END) as parts_with_multiple_prices
    FROM material_parts mp
    GROUP BY mp.service_type_id
  ),
  supply_house_prices_per_service AS (
    SELECT
      mp.service_type_id,
      mpp.supply_house_id,
      COUNT(mpp.id) as price_count
    FROM material_parts mp
    INNER JOIN material_part_prices mpp ON mpp.part_id = mp.id
    GROUP BY mp.service_type_id, mpp.supply_house_id
  )
  SELECT 
    st.id as service_type_id,
    st.name as service_type_name,
    COALESCE(sts.total_parts, 0) as total_parts,
    COALESCE(sts.parts_with_prices, 0) as parts_with_prices,
    COALESCE(sts.parts_with_multiple_prices, 0) as parts_with_multiple_prices,
    sh.id as supply_house_id,
    sh.name as supply_house_name,
    COALESCE(shp.price_count, 0) as price_count
  FROM service_types st
  CROSS JOIN supply_houses sh
  LEFT JOIN service_type_stats sts ON sts.service_type_id = st.id
  LEFT JOIN supply_house_prices_per_service shp 
    ON shp.service_type_id = st.id 
    AND shp.supply_house_id = sh.id
  ORDER BY st.sequence_order, sh.name;
END;
$$ LANGUAGE plpgsql STABLE;
