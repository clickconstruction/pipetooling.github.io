SET lock_timeout = '3s';

-- Materials by stage (Wendi's schedule of values, PR 1).
-- Each fixture or tie-in on the Combined takeoff sheet carries a stage split
-- (Rough In / Top Out / Trim Set, or a weighted combination); any part line
-- under it, or any part inside an assembly bundle, can carry its own. The
-- per-stage material cost × the company factor is the schedule of values.
--
-- Scope of a row:
--   line_id NULL, part_id NULL  → the fixture (count row): the default for its lines
--   line_id set,  part_id NULL  → one part line, or a whole assembly bundle line
--   line_id set,  part_id set   → one part inside that bundle line
-- Weights are relative (1·1·0 = an even split, 70·30·0 = seventy / thirty); the
-- kernel normalizes them. A row is deleted, never zeroed, to fall back to the
-- scope above it.

CREATE TABLE IF NOT EXISTS public.bid_takeoff_stage_splits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bid_id uuid NOT NULL REFERENCES public.bids(id) ON DELETE CASCADE,
  count_row_id uuid NOT NULL REFERENCES public.bids_count_rows(id) ON DELETE CASCADE,
  line_id uuid NULL REFERENCES public.bids_takeoff_rough_part_lines(id) ON DELETE CASCADE,
  part_id uuid NULL REFERENCES public.material_parts(id) ON DELETE CASCADE,
  rough_in numeric(8,4) NOT NULL DEFAULT 0 CHECK (rough_in >= 0),
  top_out numeric(8,4) NOT NULL DEFAULT 0 CHECK (top_out >= 0),
  trim_set numeric(8,4) NOT NULL DEFAULT 0 CHECK (trim_set >= 0),
  source text NOT NULL DEFAULT 'hand' CHECK (source IN ('hand', 'rule', 'book', 'assembly')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bid_takeoff_stage_splits_some_weight CHECK (rough_in + top_out + trim_set > 0),
  CONSTRAINT bid_takeoff_stage_splits_part_needs_line CHECK (part_id IS NULL OR line_id IS NOT NULL)
);

COMMENT ON TABLE public.bid_takeoff_stage_splits IS
  'Materials by stage: a stage split (Rough In / Top Out / Trim Set weights) on a takeoff fixture, one of its part lines, or one part inside an assembly bundle line. Missing row = inherit from the scope above.';

-- One split per scope. NULLs are distinct in a plain UNIQUE, so the key coalesces them.
CREATE UNIQUE INDEX IF NOT EXISTS bid_takeoff_stage_splits_scope_key
  ON public.bid_takeoff_stage_splits (
    count_row_id,
    COALESCE(line_id, '00000000-0000-0000-0000-000000000000'::uuid),
    COALESCE(part_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

CREATE INDEX IF NOT EXISTS idx_bid_takeoff_stage_splits_bid ON public.bid_takeoff_stage_splits (bid_id);

CREATE OR REPLACE FUNCTION public.bid_takeoff_stage_splits_touch()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS bid_takeoff_stage_splits_touch ON public.bid_takeoff_stage_splits;
CREATE TRIGGER bid_takeoff_stage_splits_touch
  BEFORE UPDATE ON public.bid_takeoff_stage_splits
  FOR EACH ROW EXECUTE FUNCTION public.bid_takeoff_stage_splits_touch();

ALTER TABLE public.bid_takeoff_stage_splits ENABLE ROW LEVEL SECURITY;

-- Same predicate as the other bid-scoped pricing overlay tables
-- (bid_payment_schedule_rows / bid_count_row_custom_prices).

DROP POLICY IF EXISTS "Bid pricing users can read stage splits" ON public.bid_takeoff_stage_splits;
CREATE POLICY "Bid pricing users can read stage splits"
  ON public.bid_takeoff_stage_splits FOR SELECT
  USING (((EXISTS ( SELECT 1
    FROM public.users
    WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::public.user_role, 'master_technician'::public.user_role, 'assistant'::public.user_role, 'controller'::public.user_role, 'estimator'::public.user_role, 'primary'::public.user_role, 'superintendent'::public.user_role]))))) AND public.can_access_bid_for_pricing(bid_id)));

DROP POLICY IF EXISTS "Bid pricing users can insert stage splits" ON public.bid_takeoff_stage_splits;
CREATE POLICY "Bid pricing users can insert stage splits"
  ON public.bid_takeoff_stage_splits FOR INSERT
  WITH CHECK (((EXISTS ( SELECT 1
    FROM public.users
    WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::public.user_role, 'master_technician'::public.user_role, 'assistant'::public.user_role, 'controller'::public.user_role, 'estimator'::public.user_role, 'primary'::public.user_role, 'superintendent'::public.user_role]))))) AND public.can_access_bid_for_pricing(bid_id)));

DROP POLICY IF EXISTS "Bid pricing users can update stage splits" ON public.bid_takeoff_stage_splits;
CREATE POLICY "Bid pricing users can update stage splits"
  ON public.bid_takeoff_stage_splits FOR UPDATE
  USING (((EXISTS ( SELECT 1
    FROM public.users
    WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::public.user_role, 'master_technician'::public.user_role, 'assistant'::public.user_role, 'controller'::public.user_role, 'estimator'::public.user_role, 'primary'::public.user_role, 'superintendent'::public.user_role]))))) AND public.can_access_bid_for_pricing(bid_id)))
  WITH CHECK ((EXISTS ( SELECT 1
    FROM public.users
    WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::public.user_role, 'master_technician'::public.user_role, 'assistant'::public.user_role, 'controller'::public.user_role, 'estimator'::public.user_role, 'primary'::public.user_role, 'superintendent'::public.user_role]))))));

DROP POLICY IF EXISTS "Bid pricing users can delete stage splits" ON public.bid_takeoff_stage_splits;
CREATE POLICY "Bid pricing users can delete stage splits"
  ON public.bid_takeoff_stage_splits FOR DELETE
  USING (((EXISTS ( SELECT 1
    FROM public.users
    WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::public.user_role, 'master_technician'::public.user_role, 'assistant'::public.user_role, 'controller'::public.user_role, 'estimator'::public.user_role, 'primary'::public.user_role, 'superintendent'::public.user_role]))))) AND public.can_access_bid_for_pricing(bid_id)));

-- The letter toggle and the per-bid factor (NULL = the company default in app_settings).
ALTER TABLE public.bids
  ADD COLUMN IF NOT EXISTS include_materials_by_stage boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN public.bids.include_materials_by_stage IS
  'When true, the Materials by stage section (stage material × factor) renders in the cover letter and the Approval PDF.';

ALTER TABLE public.bids
  ADD COLUMN IF NOT EXISTS sov_material_factor numeric(6,3) NULL CHECK (sov_material_factor IS NULL OR (sov_material_factor >= 1 AND sov_material_factor <= 5));
COMMENT ON COLUMN public.bids.sov_material_factor IS
  'Per-bid override of the schedule-of-values material factor (app_settings bid_sov_material_factor_v1, seeded 1.5). NULL = the company default.';

-- The company default: raw material by stage × 1.5 (Wendi's number), editable on Settings.
INSERT INTO public.app_settings (key, value_num)
VALUES ('bid_sov_material_factor_v1', 1.5)
ON CONFLICT (key) DO NOTHING;

-- Training mode (read_only) and the digital-twin write fence must cover every new table.
SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
