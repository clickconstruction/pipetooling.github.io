-- Allow a rough takeoff line to represent an assembly bought as a supply-house BUNDLE:
-- one opaque line with no individual part, priced at the assembly's bundle price.
-- A bundle line has part_id = NULL and source_template_id = the assembly; the unit_price
-- comes from material_template_prices (Phase 1). Existing part lines are unaffected.
ALTER TABLE public.bids_takeoff_rough_part_lines
  ALTER COLUMN part_id DROP NOT NULL;

-- A line must reference either a part (normal line) or an assembly (bundle line).
ALTER TABLE public.bids_takeoff_rough_part_lines
  DROP CONSTRAINT IF EXISTS bids_takeoff_rough_part_lines_part_or_template;
ALTER TABLE public.bids_takeoff_rough_part_lines
  ADD CONSTRAINT bids_takeoff_rough_part_lines_part_or_template
  CHECK (part_id IS NOT NULL OR source_template_id IS NOT NULL);

COMMENT ON COLUMN public.bids_takeoff_rough_part_lines.part_id IS
  'Material part for this line; NULL for an assembly bundle line (source_template_id set, priced from material_template_prices).';
