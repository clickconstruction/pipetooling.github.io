SET lock_timeout = '3s';

-- Reference-grade icon (v2.2547): the Bid Board needs counts/pricing PRESENCE
-- for decided bids to render the A/B/C/D/X badge without hauling row data.
-- One security-definer RPC returning booleans only; every other grade input
-- (plans link, value, outcome, loss_category, dates) is already on the bid row.

CREATE OR REPLACE FUNCTION public.list_reference_presence()
RETURNS TABLE (bid_id uuid, has_counts boolean, has_pricing boolean)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    b.id AS bid_id,
    EXISTS (SELECT 1 FROM public.bids_count_rows cr WHERE cr.bid_id = b.id) AS has_counts,
    EXISTS (SELECT 1 FROM public.bid_pricing_assignments a WHERE a.bid_id = b.id) AS has_pricing
  FROM public.bids b
  WHERE b.outcome IS NOT NULL
    AND b.project_name NOT ILIKE 'ZZ %'
    AND b.adopted_into_bid_id IS NULL;
$$;

GRANT EXECUTE ON FUNCTION public.list_reference_presence() TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_reference_presence() TO service_role;
REVOKE EXECUTE ON FUNCTION public.list_reference_presence() FROM anon;
REVOKE EXECUTE ON FUNCTION public.list_reference_presence() FROM public;
