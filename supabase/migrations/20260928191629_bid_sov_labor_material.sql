SET lock_timeout = '3s';

-- Cover Letter → Schedule of values, two shapes (v2.4075 + the PR after it):
--   By stage: the takeoff writes the three lines; labor and material split each line
--             (bid_sov_stage_overrides holds a typed labor figure and a note per stage).
--   My lines: the estimator's own lines (bid_sov_lines), seeded from the stages.
-- Three switches on the bid; one company default (the labor share used for a stage
-- with no labor hours). Additive; the old client ignores all of it.

ALTER TABLE public.bids
  ADD COLUMN IF NOT EXISTS sov_shape text NOT NULL DEFAULT 'stage' CHECK (sov_shape IN ('stage', 'lines'));
COMMENT ON COLUMN public.bids.sov_shape IS
  'Cover Letter schedule of values shape: stage = the takeoff writes the three lines; lines = the estimator''s own bid_sov_lines.';

ALTER TABLE public.bids
  ADD COLUMN IF NOT EXISTS sov_split_labor_material boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN public.bids.sov_split_labor_material IS
  'Cover Letter schedule of values: split each line into labor and material (letter, Approval PDF and the printed schedule).';

ALTER TABLE public.bids
  ADD COLUMN IF NOT EXISTS sov_letter_total_only boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN public.bids.sov_letter_total_only IS
  'Cover Letter schedule of values: the letter carries the total and points at the attached schedule; the lines print on the sheet only.';

-- The company labor share, used for a stage with no labor hours on the Labor tab (45 = 45 % labor / 55 % material).
INSERT INTO public.app_settings (key, value_num)
VALUES ('bid_sov_labor_share_pct_v1', 45)
ON CONFLICT (key) DO NOTHING;

-- By stage: a typed labor figure (NULL = derived from the bid's costs) and a note per stage.
CREATE TABLE IF NOT EXISTS public.bid_sov_stage_overrides (
  bid_id uuid NOT NULL REFERENCES public.bids(id) ON DELETE CASCADE,
  stage text NOT NULL CHECK (stage IN ('rough_in', 'top_out', 'trim_set')),
  labor numeric(12,2) NULL CHECK (labor IS NULL OR labor >= 0),
  note text NOT NULL DEFAULT '' CHECK (length(note) <= 500),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (bid_id, stage)
);
COMMENT ON TABLE public.bid_sov_stage_overrides IS
  'Cover Letter schedule of values, By stage shape: the estimator''s typed labor figure (NULL = from the bid''s costs) and note for a stage.';

-- My lines: the estimator's own schedule.
CREATE TABLE IF NOT EXISTS public.bid_sov_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bid_id uuid NOT NULL REFERENCES public.bids(id) ON DELETE CASCADE,
  sort_order integer NOT NULL DEFAULT 0,
  label text NOT NULL DEFAULT '' CHECK (length(label) <= 200),
  value numeric(12,2) NOT NULL DEFAULT 0 CHECK (value >= 0),
  labor numeric(12,2) NULL CHECK (labor IS NULL OR labor >= 0),
  note text NOT NULL DEFAULT '' CHECK (length(note) <= 500),
  stage text NULL CHECK (stage IS NULL OR stage IN ('rough_in', 'top_out', 'trim_set')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.bid_sov_lines IS
  'Cover Letter schedule of values, My lines shape: one row per line (value; labor when split, material = value - labor; a note; the stage it was seeded from).';
CREATE INDEX IF NOT EXISTS idx_bid_sov_lines_bid_sort ON public.bid_sov_lines (bid_id, sort_order);

ALTER TABLE public.bid_sov_stage_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bid_sov_lines ENABLE ROW LEVEL SECURITY;

-- The same predicate as the other bid-scoped letter tables (bid_payment_schedule_rows, bid_takeoff_stage_splits).
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['bid_sov_stage_overrides', 'bid_sov_lines'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Bid pricing users can read %1$s" ON public.%1$I', t);
    EXECUTE format($p$CREATE POLICY "Bid pricing users can read %1$s" ON public.%1$I FOR SELECT
      USING (((EXISTS (SELECT 1 FROM public.users WHERE ((users.id = (SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::public.user_role, 'master_technician'::public.user_role, 'assistant'::public.user_role, 'controller'::public.user_role, 'estimator'::public.user_role, 'primary'::public.user_role, 'superintendent'::public.user_role]))))) AND public.can_access_bid_for_pricing(bid_id)))$p$, t);
    EXECUTE format('DROP POLICY IF EXISTS "Bid pricing users can insert %1$s" ON public.%1$I', t);
    EXECUTE format($p$CREATE POLICY "Bid pricing users can insert %1$s" ON public.%1$I FOR INSERT
      WITH CHECK (((EXISTS (SELECT 1 FROM public.users WHERE ((users.id = (SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::public.user_role, 'master_technician'::public.user_role, 'assistant'::public.user_role, 'controller'::public.user_role, 'estimator'::public.user_role, 'primary'::public.user_role, 'superintendent'::public.user_role]))))) AND public.can_access_bid_for_pricing(bid_id)))$p$, t);
    EXECUTE format('DROP POLICY IF EXISTS "Bid pricing users can update %1$s" ON public.%1$I', t);
    EXECUTE format($p$CREATE POLICY "Bid pricing users can update %1$s" ON public.%1$I FOR UPDATE
      USING (((EXISTS (SELECT 1 FROM public.users WHERE ((users.id = (SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::public.user_role, 'master_technician'::public.user_role, 'assistant'::public.user_role, 'controller'::public.user_role, 'estimator'::public.user_role, 'primary'::public.user_role, 'superintendent'::public.user_role]))))) AND public.can_access_bid_for_pricing(bid_id)))
      WITH CHECK (((EXISTS (SELECT 1 FROM public.users WHERE ((users.id = (SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::public.user_role, 'master_technician'::public.user_role, 'assistant'::public.user_role, 'controller'::public.user_role, 'estimator'::public.user_role, 'primary'::public.user_role, 'superintendent'::public.user_role]))))) AND public.can_access_bid_for_pricing(bid_id)))$p$, t);
    EXECUTE format('DROP POLICY IF EXISTS "Bid pricing users can delete %1$s" ON public.%1$I', t);
    EXECUTE format($p$CREATE POLICY "Bid pricing users can delete %1$s" ON public.%1$I FOR DELETE
      USING (((EXISTS (SELECT 1 FROM public.users WHERE ((users.id = (SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::public.user_role, 'master_technician'::public.user_role, 'assistant'::public.user_role, 'controller'::public.user_role, 'estimator'::public.user_role, 'primary'::public.user_role, 'superintendent'::public.user_role]))))) AND public.can_access_bid_for_pricing(bid_id)))$p$, t);
  END LOOP;
END $$;

-- Training mode (read_only) and the digital-twin write fence must cover every new table.
SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
