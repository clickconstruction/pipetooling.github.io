SET lock_timeout = '3s';

-- Our lead on the job, for the crew (punch list #355, v2.7380). Taunya's answer of 2026-11-15 to "does a sub see the
-- customer's number or our lead's": our lead's.
--
-- A subcontractor's job window names the person who runs the job for us and their number, where it used to show the
-- customer's. The sub cannot read that person today: jobs_ledger_team_members shows a sub only their own crew row, and
-- users shows them a master only when that master adopted them. So the read is a SECURITY DEFINER function, row
-- security off, that answers one row and only to someone on the job's crew (helper_on_job, 20261014220000) or in the
-- office.
--
-- Our lead is the first master technician on the job's team, else the first superintendent on it, by the day they were
-- put on the team. Never the caller, never an archived account. The job's master_user_id is not read: since one
-- company (v2.2967) it is the account the row was filed under, not a person on the job.
--
-- No CREATE TABLE. Idempotent: CREATE OR REPLACE.

CREATE OR REPLACE FUNCTION public.job_lead_contact(p_job_id uuid)
RETURNS TABLE (lead_user_id uuid, lead_name text, lead_phone text, lead_role text)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT u.id, u.name, NULLIF(btrim(u.phone), ''), u.role::text
  FROM public.jobs_ledger_team_members m
  JOIN public.users u ON u.id = m.user_id
  WHERE m.job_id = p_job_id
    AND auth.uid() IS NOT NULL
    AND (public.helper_on_job(p_job_id) OR public.is_office_staff())
    AND u.id <> auth.uid()
    AND u.archived_at IS NULL
    AND u.role IN ('master_technician', 'superintendent')
  ORDER BY (u.role = 'master_technician') DESC, m.created_at, u.name
  LIMIT 1
$$;

COMMENT ON FUNCTION public.job_lead_contact(uuid) IS
  'Punch list #355: the person who runs the job for us (the first master technician on its team, else the first superintendent), with their number, for a caller on the job''s crew (helper_on_job) or in the office. SECURITY DEFINER + row_security off: a subcontractor reads neither the team table nor a master''s users row.';
REVOKE EXECUTE ON FUNCTION public.job_lead_contact(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.job_lead_contact(uuid) TO authenticated, service_role;
