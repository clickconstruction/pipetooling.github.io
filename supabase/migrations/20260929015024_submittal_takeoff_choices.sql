SET lock_timeout = '3s';

-- Submittals from the takeoff (v2.4107): which takeoff fixtures the estimator ticked for
-- the submittal (remembered per bid, so a rebuild keeps the pruning), and which takeoff
-- fixture a submittal row came from (so × sends it back to the left-out list). Additive.

CREATE TABLE IF NOT EXISTS public.bid_submittal_takeoff_choices (
  bid_id uuid NOT NULL REFERENCES public.bids(id) ON DELETE CASCADE,
  count_row_id uuid NOT NULL REFERENCES public.bids_count_rows(id) ON DELETE CASCADE,
  ticked boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (bid_id, count_row_id)
);
COMMENT ON TABLE public.bid_submittal_takeoff_choices IS
  'Submittals → Choose from the takeoff: the estimator''s tick per takeoff fixture (absent = the default for its group).';

ALTER TABLE public.bid_submittal_items
  ADD COLUMN IF NOT EXISTS source_count_row_id uuid NULL REFERENCES public.bids_count_rows(id) ON DELETE SET NULL;
COMMENT ON COLUMN public.bid_submittal_items.source_count_row_id IS
  'The takeoff fixture this row was built from (v2.4107); NULL for rows from picks or by hand.';

ALTER TABLE public.bid_submittal_takeoff_choices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Bid pricing users can read bid_submittal_takeoff_choices" ON public.bid_submittal_takeoff_choices;
CREATE POLICY "Bid pricing users can read bid_submittal_takeoff_choices" ON public.bid_submittal_takeoff_choices FOR SELECT
  USING (((EXISTS (SELECT 1 FROM public.users WHERE ((users.id = (SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::public.user_role, 'master_technician'::public.user_role, 'assistant'::public.user_role, 'controller'::public.user_role, 'estimator'::public.user_role, 'primary'::public.user_role, 'superintendent'::public.user_role]))))) AND public.can_access_bid_for_pricing(bid_id)));
DROP POLICY IF EXISTS "Bid pricing users can insert bid_submittal_takeoff_choices" ON public.bid_submittal_takeoff_choices;
CREATE POLICY "Bid pricing users can insert bid_submittal_takeoff_choices" ON public.bid_submittal_takeoff_choices FOR INSERT
  WITH CHECK (((EXISTS (SELECT 1 FROM public.users WHERE ((users.id = (SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::public.user_role, 'master_technician'::public.user_role, 'assistant'::public.user_role, 'controller'::public.user_role, 'estimator'::public.user_role, 'primary'::public.user_role, 'superintendent'::public.user_role]))))) AND public.can_access_bid_for_pricing(bid_id)));
DROP POLICY IF EXISTS "Bid pricing users can update bid_submittal_takeoff_choices" ON public.bid_submittal_takeoff_choices;
CREATE POLICY "Bid pricing users can update bid_submittal_takeoff_choices" ON public.bid_submittal_takeoff_choices FOR UPDATE
  USING (((EXISTS (SELECT 1 FROM public.users WHERE ((users.id = (SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::public.user_role, 'master_technician'::public.user_role, 'assistant'::public.user_role, 'controller'::public.user_role, 'estimator'::public.user_role, 'primary'::public.user_role, 'superintendent'::public.user_role]))))) AND public.can_access_bid_for_pricing(bid_id)))
  WITH CHECK (((EXISTS (SELECT 1 FROM public.users WHERE ((users.id = (SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::public.user_role, 'master_technician'::public.user_role, 'assistant'::public.user_role, 'controller'::public.user_role, 'estimator'::public.user_role, 'primary'::public.user_role, 'superintendent'::public.user_role]))))) AND public.can_access_bid_for_pricing(bid_id)));
DROP POLICY IF EXISTS "Bid pricing users can delete bid_submittal_takeoff_choices" ON public.bid_submittal_takeoff_choices;
CREATE POLICY "Bid pricing users can delete bid_submittal_takeoff_choices" ON public.bid_submittal_takeoff_choices FOR DELETE
  USING (((EXISTS (SELECT 1 FROM public.users WHERE ((users.id = (SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::public.user_role, 'master_technician'::public.user_role, 'assistant'::public.user_role, 'controller'::public.user_role, 'estimator'::public.user_role, 'primary'::public.user_role, 'superintendent'::public.user_role]))))) AND public.can_access_bid_for_pricing(bid_id)));

-- A row built from the takeoff with no plans' schedule to compare against is 'proposed' (v2.4107).
ALTER TABLE public.bid_submittal_items DROP CONSTRAINT IF EXISTS bid_submittal_items_status_check;
ALTER TABLE public.bid_submittal_items ADD CONSTRAINT bid_submittal_items_status_check
  CHECK (status IN ('as_specified', 'superseded', 'equal', 'alternate', 'design_change', 'missing', 'accessory', 'proposed'));

-- Training mode (read_only) and the digital-twin write fence must cover every new table.
SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
