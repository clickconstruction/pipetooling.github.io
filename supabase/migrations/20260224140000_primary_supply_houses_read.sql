-- Ensure primaries can read supply_houses for Price Book display
-- When material_part_prices.select('*, supply_houses(*)') runs, PostgREST applies RLS to supply_houses.
-- If primaries cannot read supply_houses, the join returns null and names show as "Unknown".
-- Add explicit policy so primaries can read supply house names in Price Book.

DROP POLICY IF EXISTS "Primaries can read supply houses" ON public.supply_houses;
CREATE POLICY "Primaries can read supply houses"
ON public.supply_houses FOR SELECT
USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'primary')
);

COMMENT ON POLICY "Primaries can read supply houses" ON public.supply_houses IS
  'Allows primaries to read supply house records. Required for Price Book to display supply house names when fetching material_part_prices with supply_houses join.';
