-- Rough takeoff line: optional link to the material_part_prices row used to fill unit_price (lowest catalog).
-- NULL after user overrides unit_price on the bid line.
ALTER TABLE public.bids_takeoff_rough_part_lines
  ADD COLUMN IF NOT EXISTS source_material_part_price_id UUID REFERENCES public.material_part_prices(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.bids_takeoff_rough_part_lines.source_material_part_price_id IS
  'When set, unit_price was last auto-filled from this catalog row; cleared on manual price edit.';

CREATE INDEX IF NOT EXISTS idx_bids_takeoff_rough_part_lines_source_price_id
  ON public.bids_takeoff_rough_part_lines(source_material_part_price_id)
  WHERE source_material_part_price_id IS NOT NULL;
