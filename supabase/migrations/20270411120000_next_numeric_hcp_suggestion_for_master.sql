-- Next numeric HCP suggestion for a master (jobs_ledger scope). Used by Create job from estimate prefill.
-- SECURITY INVOKER: RLS on jobs_ledger applies to the underlying scan.

CREATE OR REPLACE FUNCTION public.next_numeric_hcp_suggestion_for_master(p_master_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT (COALESCE(MAX(CAST(trim(jl.hcp_number) AS bigint)), 0) + 1)::text
  FROM public.jobs_ledger jl
  WHERE jl.master_user_id = p_master_user_id
    AND trim(COALESCE(jl.hcp_number, '')) ~ '^[0-9]+$';
$$;

COMMENT ON FUNCTION public.next_numeric_hcp_suggestion_for_master(uuid) IS
  'Suggested next HCP as text: max numeric hcp_number for master + 1, or 1 if none. Non-numeric HCP values ignored.';

REVOKE ALL ON FUNCTION public.next_numeric_hcp_suggestion_for_master(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.next_numeric_hcp_suggestion_for_master(uuid) TO authenticated;
