-- Recreate cost_estimates policies with short names (avoid truncation collisions)
-- Logs showed only DELETE policy present; INSERT/UPDATE/SELECT missing. Drop all and recreate.

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'cost_estimates'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.cost_estimates', r.policyname);
  END LOOP;
END $$;

CREATE POLICY "ce_select"
ON public.cost_estimates FOR SELECT USING (
  public.can_access_bid_for_pricing(cost_estimates.bid_id)
);

CREATE POLICY "ce_insert"
ON public.cost_estimates FOR INSERT WITH CHECK (
  public.can_access_bid_for_pricing(cost_estimates.bid_id)
);

CREATE POLICY "ce_update"
ON public.cost_estimates FOR UPDATE USING (
  public.can_access_bid_for_pricing(cost_estimates.bid_id)
) WITH CHECK (
  public.can_access_bid_for_pricing(cost_estimates.bid_id)
);

CREATE POLICY "ce_delete"
ON public.cost_estimates FOR DELETE USING (
  public.can_access_bid_for_pricing(cost_estimates.bid_id)
);
