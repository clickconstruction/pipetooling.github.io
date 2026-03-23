-- Debug RPC for cost_estimate RLS diagnostics (dev only; safe to leave in prod)
-- Returns: can_access (from helper), auth_id, user_role, bid_exists, bid_created_by
CREATE OR REPLACE FUNCTION public.debug_cost_estimate_check(p_bid_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  out_json JSONB;
  v_role TEXT;
  v_bid_created_by UUID;
  v_bid_exists BOOLEAN;
BEGIN
  SELECT role INTO v_role FROM public.users WHERE id = auth.uid();
  SELECT b.created_by INTO v_bid_created_by FROM public.bids b WHERE b.id = p_bid_id;
  v_bid_exists := FOUND;
  out_json := jsonb_build_object(
    'can_access', public.can_access_bid_for_pricing(p_bid_id),
    'auth_id', auth.uid(),
    'user_role', v_role,
    'bid_exists', v_bid_exists,
    'bid_created_by', v_bid_created_by
  );
  RETURN out_json;
END;
$$;
COMMENT ON FUNCTION public.debug_cost_estimate_check(UUID) IS 'Dev debug: returns cost_estimate policy check diagnostics. Remove or restrict in prod.';
