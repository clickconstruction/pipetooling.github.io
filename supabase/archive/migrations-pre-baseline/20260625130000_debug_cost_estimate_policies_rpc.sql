-- Return cost_estimates policies (for debugging RLS)
CREATE OR REPLACE FUNCTION public.debug_cost_estimate_policies()
RETURNS TABLE(policyname text, cmd text, qual text, with_check text)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT p.policyname::text, p.cmd::text, p.qual::text, p.with_check::text
  FROM pg_policies p
  WHERE p.schemaname = 'public' AND p.tablename = 'cost_estimates'
  ORDER BY p.policyname;
END;
$$;
COMMENT ON FUNCTION public.debug_cost_estimate_policies() IS 'Dev debug: returns cost_estimates RLS policies.';
