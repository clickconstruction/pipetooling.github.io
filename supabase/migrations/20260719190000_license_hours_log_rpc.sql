-- License hours log: per-user approved clock hours grouped by job, for the
-- People → Licenses tab "Hours log" export (apprenticeship hours submitted to
-- plumbing/electrical licensing boards).
--
-- SECURITY DEFINER on purpose: the clock_sessions SELECT policy only lets
-- dev / pay-approved masters / assistants-of-pay-approved-masters / team leads
-- read other users' sessions. A licensing log must never be silently partial,
-- so this RPC enforces the Licenses-tab audience itself (dev, assistant-like
-- incl. controller, pay-approved master) and raises on anyone else.
-- Read-only; returns only hours + job metadata — no wage data.

CREATE OR REPLACE FUNCTION public.list_user_license_hours_log(
  p_user_id uuid,
  p_start date DEFAULT NULL,
  p_end date DEFAULT NULL
)
RETURNS TABLE(
  session_id uuid,
  work_date date,
  clocked_in_at timestamp with time zone,
  clocked_out_at timestamp with time zone,
  hours numeric,
  job_ledger_id uuid,
  job_number text,
  job_name text,
  job_address text,
  service_type_name text,
  bid_id uuid,
  notes text
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT (public.is_dev() OR public.is_assistant() OR public.is_pay_approved_master()) THEN
    RAISE EXCEPTION 'list_user_license_hours_log: not authorized';
  END IF;

  RETURN QUERY
  SELECT
    cs.id,
    cs.work_date,
    cs.clocked_in_at,
    cs.clocked_out_at,
    (EXTRACT(EPOCH FROM (cs.clocked_out_at - cs.clocked_in_at)) / 3600.0)::numeric,
    cs.job_ledger_id,
    COALESCE(NULLIF(jl.hcp_number, ''), NULLIF(jl.click_number, ''), ''),
    COALESCE(jl.job_name, ''),
    COALESCE(jl.job_address, ''),
    COALESCE(st.name, ''),
    cs.bid_id,
    COALESCE(cs.notes, '')
  FROM public.clock_sessions cs
  LEFT JOIN public.jobs_ledger jl ON jl.id = cs.job_ledger_id
  LEFT JOIN public.service_types st ON st.id = jl.service_type_id
  WHERE cs.user_id = p_user_id
    AND cs.approved_at IS NOT NULL
    AND cs.rejected_at IS NULL
    AND cs.revoked_at IS NULL
    AND cs.clocked_in_at IS NOT NULL
    AND cs.clocked_out_at IS NOT NULL
    AND (p_start IS NULL OR cs.work_date >= p_start)
    AND (p_end IS NULL OR cs.work_date <= p_end)
  ORDER BY cs.work_date, cs.clocked_in_at;
END;
$$;

COMMENT ON FUNCTION public.list_user_license_hours_log(uuid, date, date) IS
  'People → Licenses "Hours log": one user''s approved+closed clock sessions with job metadata (effective job number = HCP else Click), for the licensing-board hours CSV. Gate: dev / assistant-like / pay-approved master. Hours only — no wages.';

GRANT EXECUTE ON FUNCTION public.list_user_license_hours_log(uuid, date, date) TO authenticated;
