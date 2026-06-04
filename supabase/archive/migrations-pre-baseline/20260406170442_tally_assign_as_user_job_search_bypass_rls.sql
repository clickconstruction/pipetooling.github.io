-- search_jobs_for_tally_mercury_assign_as_user: jobs_ledger RLS evaluated as the staff invoker,
-- so assistants often got zero rows when assigning for another user's visible jobs.
-- Use explicit card-owner visibility + row_security off (same pattern as search_bids_for_clock).

CREATE OR REPLACE FUNCTION public.jobs_ledger_row_visible_for_tally_assign(
  p_job_id uuid,
  p_user_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_role text;
BEGIN
  IF p_job_id IS NULL OR p_user_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT u.role::text INTO v_role FROM public.users u WHERE u.id = p_user_id;
  IF v_role IS NULL THEN
    RETURN false;
  END IF;

  IF v_role = 'subcontractor' THEN
    RETURN EXISTS (
      SELECT 1 FROM public.jobs_ledger_team_members jtm
      WHERE jtm.job_id = p_job_id AND jtm.user_id = p_user_id
    );
  END IF;

  IF v_role NOT IN ('dev', 'master_technician', 'assistant', 'primary') THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.jobs_ledger jl
    WHERE jl.id = p_job_id
      AND (
        jl.master_user_id = p_user_id
        OR v_role = 'dev'
        OR v_role = 'primary'
        OR EXISTS (
          SELECT 1 FROM public.master_assistants
          WHERE master_id = p_user_id AND assistant_id = jl.master_user_id
        )
        OR EXISTS (
          SELECT 1 FROM public.master_assistants
          WHERE master_id = jl.master_user_id AND assistant_id = p_user_id
        )
        OR public.assistants_share_master(p_user_id, jl.master_user_id)
      )
  )
  OR EXISTS (
    SELECT 1
    FROM public.clock_sessions cs
    WHERE cs.job_ledger_id = p_job_id
      AND public.is_team_lead_for_member(p_user_id, cs.user_id)
  );
END;
$$;

COMMENT ON FUNCTION public.jobs_ledger_row_visible_for_tally_assign(uuid, uuid) IS
  'Whether p_user_id may read this jobs_ledger row for tally Mercury assign search (matches jobs_ledger SELECT + team-lead policy; row_security off).';

REVOKE ALL ON FUNCTION public.jobs_ledger_row_visible_for_tally_assign(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.jobs_ledger_row_visible_for_tally_assign(uuid, uuid) TO authenticated;

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
  AND public.jobs_ledger_row_visible_for_tally_assign(jl.id, p_for_user_id)
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
  'Staff tally assign: job search as for p_for_user_id (card owner visibility; subcontractors team-only).';

REVOKE ALL ON FUNCTION public.search_jobs_for_tally_mercury_assign_as_user(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_jobs_for_tally_mercury_assign_as_user(uuid, text) TO authenticated;
