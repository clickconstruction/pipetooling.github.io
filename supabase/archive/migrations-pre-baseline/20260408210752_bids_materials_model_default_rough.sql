-- New bids default to Rough materials (Takeoffs / Cost Estimate / Pricing Cost Model).
ALTER TABLE public.bids
  ALTER COLUMN materials_model SET DEFAULT 'rough';

COMMENT ON COLUMN public.bids.materials_model IS
  'exact: template+stage takeoffs and 3 PO materials; rough: per-count-row material_parts lines without stage. New rows default to rough.';
