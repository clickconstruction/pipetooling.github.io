SET lock_timeout = '3s';

-- Estimator twin pipeline, Wave 1 item 1.4 (docs/ESTIMATOR_TWIN_PIPELINE_PLAN.md; schema
-- contract in docs/twins/SUBSTRATE.md): the plan-substrate home. One immutable JSON per
-- extraction version, keyed to the bid — the machine-readable read of a plan set (sheet
-- classification, schedules-as-tables, note flags, scale calibration, reconciliation,
-- rollup plan brief). Served to agents via twin-mcp get_plan_brief; a bid-window panel for
-- humans is the planned Wave-1 follow-up. Deviation from the plan's storage-bucket default,
-- recorded in its status log: jsonb rows are simpler, queryable in-app, and covered by the
-- twin write fence automatically (bid_id column); the Drive job folder remains the file copy.

CREATE TABLE IF NOT EXISTS public.bids_plan_substrates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bid_id uuid NOT NULL REFERENCES public.bids(id) ON DELETE CASCADE,
  version text NOT NULL,
  substrate jsonb NOT NULL,
  created_by uuid REFERENCES public.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (bid_id, version)
);
CREATE INDEX IF NOT EXISTS bids_plan_substrates_bid_idx
  ON public.bids_plan_substrates (bid_id, created_at DESC);

ALTER TABLE public.bids_plan_substrates ENABLE ROW LEVEL SECURITY;

-- Staff policies mirror the bids family (bid_proposal_rooms pattern): estimating staff read,
-- estimator+ write. Twins reach it through these same policies — the restrictive fence then
-- confines their writes to their own/assigned bids (bid_id detection in the fence applier).
DROP POLICY IF EXISTS "Bid pricing users can read bids_plan_substrates" ON public.bids_plan_substrates;
CREATE POLICY "Bid pricing users can read bids_plan_substrates" ON public.bids_plan_substrates FOR SELECT
  USING (EXISTS ( SELECT 1 FROM public.users
    WHERE users.id = ( SELECT auth.uid() ) AND users.role = ANY (ARRAY['dev'::public.user_role, 'master_technician'::public.user_role, 'assistant'::public.user_role, 'controller'::public.user_role, 'estimator'::public.user_role, 'primary'::public.user_role, 'superintendent'::public.user_role])));
DROP POLICY IF EXISTS "Bid pricing users can write bids_plan_substrates" ON public.bids_plan_substrates;
CREATE POLICY "Bid pricing users can write bids_plan_substrates" ON public.bids_plan_substrates FOR ALL
  USING (EXISTS ( SELECT 1 FROM public.users
    WHERE users.id = ( SELECT auth.uid() ) AND users.role = ANY (ARRAY['dev'::public.user_role, 'master_technician'::public.user_role, 'assistant'::public.user_role, 'controller'::public.user_role, 'estimator'::public.user_role])))
  WITH CHECK (EXISTS ( SELECT 1 FROM public.users
    WHERE users.id = ( SELECT auth.uid() ) AND users.role = ANY (ARRAY['dev'::public.user_role, 'master_technician'::public.user_role, 'assistant'::public.user_role, 'controller'::public.user_role, 'estimator'::public.user_role])));

-- House rules: read-only training mode + the digital-twin write fence cover every new table.
SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
