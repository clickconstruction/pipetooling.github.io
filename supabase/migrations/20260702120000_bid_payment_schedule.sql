-- Schedule of Values (payment schedule) for the Bids Cover Letter.
-- Opt-in per bid via bids.include_payment_schedule; rows persist even while the toggle is off.
-- Each row = payment timing (before/after Rough In / Top Out / Trim Set, or before start)
-- + percent of the contract amount. Client seeds the 30/30/30/10 default on first enable.

ALTER TABLE public.bids
  ADD COLUMN IF NOT EXISTS include_payment_schedule boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.bids.include_payment_schedule IS
  'When true, the Schedule of Values section renders in the cover letter and Approval PDF.';

CREATE TABLE IF NOT EXISTS public.bid_payment_schedule_rows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bid_id uuid NOT NULL REFERENCES public.bids(id) ON DELETE CASCADE,
  timing text NOT NULL CHECK (timing IN (
    'before_start', 'before_rough_in', 'after_rough_in',
    'before_top_out', 'after_top_out', 'before_trim_set', 'after_trim_set')),
  percent numeric NOT NULL CHECK (percent >= 0 AND percent <= 100),
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.bid_payment_schedule_rows IS
  'Cover-letter Schedule of Values: each row = payment timing + percent of contract amount.';

CREATE INDEX IF NOT EXISTS idx_bid_payment_schedule_rows_bid_sort
  ON public.bid_payment_schedule_rows (bid_id, sort_order);

ALTER TABLE public.bid_payment_schedule_rows ENABLE ROW LEVEL SECURITY;

-- Same predicate as the other bid-scoped pricing overlay tables
-- (bid_count_row_submission_hides / bid_count_row_custom_prices).

CREATE POLICY "Bid pricing users can read payment schedule rows"
  ON public.bid_payment_schedule_rows FOR SELECT
  USING (((EXISTS ( SELECT 1
    FROM public.users
    WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::public.user_role, 'master_technician'::public.user_role, 'assistant'::public.user_role, 'estimator'::public.user_role, 'primary'::public.user_role, 'superintendent'::public.user_role]))))) AND public.can_access_bid_for_pricing(bid_id)));

CREATE POLICY "Bid pricing users can insert payment schedule rows"
  ON public.bid_payment_schedule_rows FOR INSERT
  WITH CHECK (((EXISTS ( SELECT 1
    FROM public.users
    WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::public.user_role, 'master_technician'::public.user_role, 'assistant'::public.user_role, 'estimator'::public.user_role, 'primary'::public.user_role, 'superintendent'::public.user_role]))))) AND public.can_access_bid_for_pricing(bid_id)));

CREATE POLICY "Bid pricing users can update payment schedule rows"
  ON public.bid_payment_schedule_rows FOR UPDATE
  USING (((EXISTS ( SELECT 1
    FROM public.users
    WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::public.user_role, 'master_technician'::public.user_role, 'assistant'::public.user_role, 'estimator'::public.user_role, 'primary'::public.user_role, 'superintendent'::public.user_role]))))) AND public.can_access_bid_for_pricing(bid_id)))
  WITH CHECK ((EXISTS ( SELECT 1
    FROM public.users
    WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::public.user_role, 'master_technician'::public.user_role, 'assistant'::public.user_role, 'estimator'::public.user_role, 'primary'::public.user_role, 'superintendent'::public.user_role]))))));

CREATE POLICY "Bid pricing users can delete payment schedule rows"
  ON public.bid_payment_schedule_rows FOR DELETE
  USING (((EXISTS ( SELECT 1
    FROM public.users
    WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::public.user_role, 'master_technician'::public.user_role, 'assistant'::public.user_role, 'estimator'::public.user_role, 'primary'::public.user_role, 'superintendent'::public.user_role]))))) AND public.can_access_bid_for_pricing(bid_id)));
