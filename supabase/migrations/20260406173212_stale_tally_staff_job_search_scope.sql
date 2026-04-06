-- Stale tally staff Assign to jobs: non-subcontractor targets use the staff invoker's jobs_ledger
-- visibility (auth.uid()). Subcontractor targets stay card-owner scoped (team-only) so save
-- matches replace_mercury_job_splits_for_linked_card_as_staff.

CREATE OR REPLACE FUNCTION public.search_jobs_for_tally_mercury_assign_as_user(
  p_for_user_id uuid,
  search_text text DEFAULT ''
)
RETURNS TABLE (
  id uuid,
  hcp_number text,
  job_name text,
  job_address text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT
    jl.id,
    COALESCE(jl.hcp_number, '')::text,
    COALESCE(jl.job_name, '')::text,
    COALESCE(jl.job_address, '')::text
  FROM public.jobs_ledger jl
  WHERE public.staff_can_view_user_for_tally_followup(auth.uid(), p_for_user_id)
  AND public.jobs_ledger_row_visible_for_tally_assign(
    jl.id,
    CASE
      WHEN EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = p_for_user_id AND u.role = 'subcontractor'
      ) THEN p_for_user_id
      ELSE auth.uid()
    END
  )
  AND (
    search_text IS NULL OR search_text = ''
    OR jl.hcp_number ILIKE '%' || search_text || '%'
    OR (
      length(search_text) >= 2
      AND lower(left(search_text, 1)) = 'j'
      AND jl.hcp_number ILIKE '%' || substring(search_text from 2) || '%'
    )
    OR jl.job_name ILIKE '%' || search_text || '%'
    OR jl.job_address ILIKE '%' || search_text || '%'
  )
  ORDER BY (CASE WHEN jl.hcp_number = '' OR jl.hcp_number IS NULL THEN 1 ELSE 0 END), jl.hcp_number DESC
  LIMIT 50;
$$;

COMMENT ON FUNCTION public.search_jobs_for_tally_mercury_assign_as_user(uuid, text) IS
  'Staff tally assign: job search gated by staff_can_view; visibility is staff invoker (auth.uid()) except subcontractor targets use p_for_user_id (team-only, save-safe).';

REVOKE ALL ON FUNCTION public.search_jobs_for_tally_mercury_assign_as_user(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_jobs_for_tally_mercury_assign_as_user(uuid, text) TO authenticated;
