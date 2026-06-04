-- Bids → Estimators tab.
-- Columns = users with role = 'estimator' (always) plus an org-wide augmentation
-- list maintained in `bid_estimators_extra_users` by dev / master_technician / assistant.
-- Two SECURITY DEFINER RPCs expose aggregated bid clock-hours for the tab so that
-- non-pay-access roles (estimator, primary, helpers, etc.) can read the pivot
-- without unlocking direct `clock_sessions` SELECT for others' rows.

-- ---------------------------------------------------------------------------
-- 1. Augmentation table for extra column users
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.bid_estimators_extra_users (
  user_id UUID NOT NULL PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  added_by UUID REFERENCES public.users(id) ON DELETE SET NULL
);

COMMENT ON TABLE public.bid_estimators_extra_users IS
  'Org-wide augmentation list for the Bids → Estimators tab column set. Anyone authenticated can read; dev/master_technician/assistant can insert/delete.';

ALTER TABLE public.bid_estimators_extra_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read bid estimators extra users"
ON public.bid_estimators_extra_users
FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "Staff can insert bid estimators extra users"
ON public.bid_estimators_extra_users
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
      AND role IN ('dev', 'master_technician', 'assistant')
  )
);

CREATE POLICY "Staff can delete bid estimators extra users"
ON public.bid_estimators_extra_users
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
      AND role IN ('dev', 'master_technician', 'assistant')
  )
);

-- ---------------------------------------------------------------------------
-- 2. Window RPC: aggregated bid clock-hours per (user, bid, day) within range
--    Returns DECIMAL hours per cell so the client just multiplies / sums.
--    Excludes rejected / revoked sessions (matches existing labor logic);
--    open sessions (clocked_out_at IS NULL) clip at NOW().
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.list_bid_estimators_window_hours(
  p_user_ids UUID[],
  p_start_date DATE,
  p_end_date DATE
)
RETURNS TABLE (
  user_id UUID,
  bid_id UUID,
  work_date DATE,
  hours NUMERIC
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT
    cs.user_id,
    cs.bid_id,
    cs.work_date,
    SUM(
      EXTRACT(EPOCH FROM (COALESCE(cs.clocked_out_at, now()) - cs.clocked_in_at)) / 3600.0
    )::numeric AS hours
  FROM public.clock_sessions cs
  WHERE cs.bid_id IS NOT NULL
    AND cs.rejected_at IS NULL
    AND cs.revoked_at IS NULL
    AND cs.work_date >= p_start_date
    AND cs.work_date <= p_end_date
    AND (p_user_ids IS NULL OR cs.user_id = ANY(p_user_ids))
    AND COALESCE(cs.clocked_out_at, now()) > cs.clocked_in_at
  GROUP BY cs.user_id, cs.bid_id, cs.work_date;
$$;

REVOKE ALL ON FUNCTION public.list_bid_estimators_window_hours(UUID[], DATE, DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_bid_estimators_window_hours(UUID[], DATE, DATE) TO authenticated;

COMMENT ON FUNCTION public.list_bid_estimators_window_hours(UUID[], DATE, DATE) IS
  'Bids → Estimators tab: per-day hours per (user, bid) inside the visible window. Excludes rejected/revoked sessions; clips open sessions at now().';

-- ---------------------------------------------------------------------------
-- 3. All-time totals RPC: total hours per bid across ALL time (denominator
--    for the per-day % in each cell). Same session filter semantics as #2.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.list_bid_estimators_all_time_hours(
  p_bid_ids UUID[]
)
RETURNS TABLE (
  bid_id UUID,
  hours NUMERIC
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT
    cs.bid_id,
    SUM(
      EXTRACT(EPOCH FROM (COALESCE(cs.clocked_out_at, now()) - cs.clocked_in_at)) / 3600.0
    )::numeric AS hours
  FROM public.clock_sessions cs
  WHERE cs.bid_id = ANY(p_bid_ids)
    AND cs.rejected_at IS NULL
    AND cs.revoked_at IS NULL
    AND COALESCE(cs.clocked_out_at, now()) > cs.clocked_in_at
  GROUP BY cs.bid_id;
$$;

REVOKE ALL ON FUNCTION public.list_bid_estimators_all_time_hours(UUID[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_bid_estimators_all_time_hours(UUID[]) TO authenticated;

COMMENT ON FUNCTION public.list_bid_estimators_all_time_hours(UUID[]) IS
  'Bids → Estimators tab: lifetime (all-time) total clock hours per bid. Used as the denominator for per-day per-user cell percentages. Excludes rejected/revoked sessions; clips open sessions at now().';
