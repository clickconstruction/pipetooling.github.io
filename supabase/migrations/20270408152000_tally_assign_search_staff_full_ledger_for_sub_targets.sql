-- Stale tally Assign to jobs: dev / is_dev() / master_technician / assistant invokers search
-- full jobs_ledger for any target user (including subcontractors) while staff_can_view holds.
-- Prior version applied team-only jl visibility first for subcontractor targets, so staff helping
-- subs only saw ~jobs_ledger_team_members rows (e.g. missing job 667). Non-staff invokers
-- keep subcontractor team + invoker ledger branches below.

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
    public.is_dev()
    OR EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role IN ('dev', 'master_technician', 'assistant')
    )
    OR (
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
  'Staff tally assign: staff_can_view required; dev/is_dev/master_technician/assistant = all jobs_ledger rows matching search_text (LIMIT 50) for any target role; otherwise subcontractor target = team visibility for target, non-sub target = invoker jl visibility.';

REVOKE ALL ON FUNCTION public.search_jobs_for_tally_mercury_assign_as_user(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_jobs_for_tally_mercury_assign_as_user(uuid, text) TO authenticated;
