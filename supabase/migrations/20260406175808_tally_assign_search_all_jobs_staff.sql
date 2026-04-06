-- Stale tally Assign to jobs: dev / master_technician / assistant invokers can search all jobs_ledger
-- rows (for non-subcontractor targets) while staff_can_view holds. Subcontractor targets unchanged
-- (team-only). Other invokers keep jobs_ledger_row_visible_for_tally_assign(auth.uid()).

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
  AND (
    (
      EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = p_for_user_id AND u.role = 'subcontractor'
      )
      AND public.jobs_ledger_row_visible_for_tally_assign(jl.id, p_for_user_id)
    )
    OR (
      NOT EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = p_for_user_id AND u.role = 'subcontractor'
      )
      AND EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = auth.uid()
          AND u.role IN ('dev', 'master_technician', 'assistant')
      )
    )
    OR (
      NOT EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = p_for_user_id AND u.role = 'subcontractor'
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = auth.uid()
          AND u.role IN ('dev', 'master_technician', 'assistant')
      )
      AND public.jobs_ledger_row_visible_for_tally_assign(jl.id, auth.uid())
    )
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
  'Staff tally assign: staff_can_view required; subcontractor targets = team-only visibility; non-sub targets + dev/master_technician/assistant = all jobs_ledger rows matching search_text (LIMIT 50); others use invoker ledger visibility.';

REVOKE ALL ON FUNCTION public.search_jobs_for_tally_mercury_assign_as_user(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_jobs_for_tally_mercury_assign_as_user(uuid, text) TO authenticated;
