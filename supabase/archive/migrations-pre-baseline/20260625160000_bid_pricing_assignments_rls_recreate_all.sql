-- Recreate bid_pricing_assignments policies with short names (avoid truncation collisions)
-- Same fix as cost_estimates: use only can_access_bid_for_pricing, drop users subquery.

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'bid_pricing_assignments'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.bid_pricing_assignments', r.policyname);
  END LOOP;
END $$;

CREATE POLICY "bpa_select"
ON public.bid_pricing_assignments FOR SELECT USING (
  public.can_access_bid_for_pricing(bid_id)
);

CREATE POLICY "bpa_insert"
ON public.bid_pricing_assignments FOR INSERT WITH CHECK (
  public.can_access_bid_for_pricing(bid_id)
);

CREATE POLICY "bpa_update"
ON public.bid_pricing_assignments FOR UPDATE USING (
  public.can_access_bid_for_pricing(bid_id)
) WITH CHECK (
  public.can_access_bid_for_pricing(bid_id)
);

CREATE POLICY "bpa_delete"
ON public.bid_pricing_assignments FOR DELETE USING (
  public.can_access_bid_for_pricing(bid_id)
);
