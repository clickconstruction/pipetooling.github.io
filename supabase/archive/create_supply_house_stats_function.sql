-- Function to get price counts per supply house
-- This function efficiently counts prices for all supply houses in the database,
-- including supply houses with 0 prices, without hitting row limits.

CREATE OR REPLACE FUNCTION get_supply_house_price_counts()
RETURNS TABLE (
  supply_house_id uuid,
  supply_house_name text,
  price_count bigint
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    sh.id as supply_house_id,
    sh.name as supply_house_name,
    COALESCE(COUNT(mpp.id), 0) as price_count
  FROM supply_houses sh
  LEFT JOIN material_part_prices mpp ON mpp.supply_house_id = sh.id
  GROUP BY sh.id, sh.name
  ORDER BY price_count DESC, sh.name;
END;
$$ LANGUAGE plpgsql STABLE;
