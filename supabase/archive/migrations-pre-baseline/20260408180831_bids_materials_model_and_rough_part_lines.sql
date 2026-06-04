-- Bid-level Exact vs Rough materials mode (Takeoffs / Cost Estimate / Pricing Cost Model)
ALTER TABLE public.bids
  ADD COLUMN IF NOT EXISTS materials_model TEXT NOT NULL DEFAULT 'exact'
  CHECK (materials_model IN ('exact', 'rough'));

COMMENT ON COLUMN public.bids.materials_model IS
  'exact: template+stage takeoffs and 3 PO materials; rough: per-count-row material_parts lines without stage.';

-- Rough takeoff: individual material_parts lines per count row (no stage)
CREATE TABLE IF NOT EXISTS public.bids_takeoff_rough_part_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bid_id UUID NOT NULL REFERENCES public.bids(id) ON DELETE CASCADE,
  count_row_id UUID NOT NULL REFERENCES public.bids_count_rows(id) ON DELETE CASCADE,
  part_id UUID NOT NULL REFERENCES public.material_parts(id) ON DELETE RESTRICT,
  quantity NUMERIC NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price NUMERIC NOT NULL DEFAULT 0 CHECK (unit_price >= 0),
  sequence_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bids_takeoff_rough_part_lines_bid_id
  ON public.bids_takeoff_rough_part_lines(bid_id);

CREATE INDEX IF NOT EXISTS idx_bids_takeoff_rough_part_lines_count_row_id
  ON public.bids_takeoff_rough_part_lines(count_row_id);

COMMENT ON TABLE public.bids_takeoff_rough_part_lines IS
  'Rough takeoff: material part lines per bid count row; unit_price for CE/Pricing without PO.';

ALTER TABLE public.bids_takeoff_rough_part_lines ENABLE ROW LEVEL SECURITY;

-- Postgres truncates policy names to 63 bytes; the previous long names collided after
-- truncation (duplicate policy). Drop any leftovers from a failed apply, then use
-- short unique names (< 63 chars).
DO $$
DECLARE
  r RECORD;
BEGIN
  IF to_regclass('public.bids_takeoff_rough_part_lines') IS NOT NULL THEN
    FOR r IN
      SELECT policyname
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'bids_takeoff_rough_part_lines'
    LOOP
      EXECUTE format(
        'DROP POLICY IF EXISTS %I ON public.bids_takeoff_rough_part_lines',
        r.policyname
      );
    END LOOP;
  END IF;
END $$;

-- Mirror bids_takeoff_template_mappings access (superintendent migration pattern)
CREATE POLICY bids_takeoff_rough_part_lines_select
ON public.bids_takeoff_rough_part_lines FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'estimator', 'primary', 'superintendent'))
  AND EXISTS (
    SELECT 1 FROM public.bids b
    WHERE b.id = bids_takeoff_rough_part_lines.bid_id
    AND (
      b.created_by = auth.uid()
      OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'assistant', 'estimator', 'master_technician', 'primary'))
      OR public.superintendent_can_access_bid(b)
    )
  )
);

CREATE POLICY bids_takeoff_rough_part_lines_insert
ON public.bids_takeoff_rough_part_lines FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'estimator', 'primary', 'superintendent'))
  AND EXISTS (
    SELECT 1 FROM public.bids b
    WHERE b.id = bids_takeoff_rough_part_lines.bid_id
    AND (
      b.created_by = auth.uid()
      OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'assistant', 'estimator', 'master_technician', 'primary'))
      OR public.superintendent_can_access_bid(b)
    )
  )
);

CREATE POLICY bids_takeoff_rough_part_lines_update
ON public.bids_takeoff_rough_part_lines FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'estimator', 'primary', 'superintendent'))
  AND EXISTS (
    SELECT 1 FROM public.bids b
    WHERE b.id = bids_takeoff_rough_part_lines.bid_id
    AND (
      b.created_by = auth.uid()
      OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'assistant', 'estimator', 'master_technician', 'primary'))
      OR public.superintendent_can_access_bid(b)
    )
  )
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'estimator', 'primary', 'superintendent'))
);

CREATE POLICY bids_takeoff_rough_part_lines_delete
ON public.bids_takeoff_rough_part_lines FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'estimator', 'primary', 'superintendent'))
  AND EXISTS (
    SELECT 1 FROM public.bids b
    WHERE b.id = bids_takeoff_rough_part_lines.bid_id
    AND (
      b.created_by = auth.uid()
      OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'assistant', 'estimator', 'master_technician', 'primary'))
      OR public.superintendent_can_access_bid(b)
    )
  )
);
