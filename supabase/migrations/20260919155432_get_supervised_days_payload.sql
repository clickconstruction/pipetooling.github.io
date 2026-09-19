SET lock_timeout = '3s';

-- v2.3613 Supervision, PR 3 (to-dos/supervision): the supervisor's Dashboard.
-- One read for "the job-days I supervised": every (job, day) in the range where the caller
-- was listed on a schedule block or clocked in AND can run a job (a master, or a helper /
-- sub with needs_supervision off), with the crew on each (everyone else listed or clocked
-- there), how many reports the job got that day, and the crew's clock sessions on those
-- job-days — read-only, no wages, never the caller's own sessions. Anyone else gets
-- {"supervisor": false} and empty lists. SECURITY DEFINER because clock_sessions RLS lets a
-- sub read only their own rows; this is the narrow window the supervision rule opens.

CREATE OR REPLACE FUNCTION public.get_supervised_days_payload(p_from date, p_to date)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
WITH me AS (
  SELECT u.id, u.role::text AS role, u.needs_supervision
    FROM public.users u
   WHERE u.id = (SELECT auth.uid())
),
sup AS (
  SELECT id FROM me
   WHERE role = 'master_technician'
      OR (role IN ('helpers', 'subcontractor') AND NOT needs_supervision)
),
my_days AS (
  SELECT DISTINCT b.job_id, b.work_date
    FROM public.job_schedule_blocks b
    JOIN sup ON sup.id = b.assignee_user_id
   WHERE b.work_date BETWEEN p_from AND p_to
     AND b.job_id IS NOT NULL
  UNION
  SELECT DISTINCT s.job_ledger_id, s.work_date
    FROM public.clock_sessions s
    JOIN sup ON sup.id = s.user_id
   WHERE s.work_date BETWEEN p_from AND p_to
     AND s.job_ledger_id IS NOT NULL
     AND s.rejected_at IS NULL
     AND s.revoked_at IS NULL
),
crew AS (
  SELECT d.job_id, d.work_date, b.assignee_user_id AS user_id
    FROM my_days d
    JOIN public.job_schedule_blocks b ON b.job_id = d.job_id AND b.work_date = d.work_date
  UNION
  SELECT d.job_id, d.work_date, s.user_id
    FROM my_days d
    JOIN public.clock_sessions s ON s.job_ledger_id = d.job_id AND s.work_date = d.work_date
   WHERE s.rejected_at IS NULL AND s.revoked_at IS NULL
)
SELECT jsonb_build_object(
  'supervisor', EXISTS (SELECT 1 FROM sup),
  'from', p_from,
  'to', p_to,
  'job_days', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
             'job_id', d.job_id,
             'work_date', d.work_date,
             'hcp_number', j.hcp_number,
             'click_number', j.click_number,
             'job_name', j.job_name,
             'customer_name', j.customer_name,
             'job_address', j.job_address,
             'report_count', (SELECT count(*) FROM public.reports r
                               WHERE r.job_ledger_id = d.job_id
                                 AND (r.created_at AT TIME ZONE 'America/Chicago')::date = d.work_date),
             'my_report_count', (SELECT count(*) FROM public.reports r
                                  WHERE r.job_ledger_id = d.job_id
                                    AND r.created_by_user_id = (SELECT auth.uid())
                                    AND (r.created_at AT TIME ZONE 'America/Chicago')::date = d.work_date),
             'crew', COALESCE((
               SELECT jsonb_agg(jsonb_build_object('user_id', u.id, 'name', u.name, 'role', u.role::text) ORDER BY u.name)
                 FROM (SELECT DISTINCT c.user_id FROM crew c WHERE c.job_id = d.job_id AND c.work_date = d.work_date) cu
                 JOIN public.users u ON u.id = cu.user_id
                WHERE u.id <> (SELECT auth.uid())
             ), '[]'::jsonb)
           ) ORDER BY d.work_date DESC, j.hcp_number)
      FROM my_days d
      JOIN public.jobs_ledger j ON j.id = d.job_id
  ), '[]'::jsonb),
  'sessions', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
             'id', s.id,
             'user_id', s.user_id,
             'name', u.name,
             'job_id', s.job_ledger_id,
             'work_date', s.work_date,
             'clocked_in_at', s.clocked_in_at,
             'clocked_out_at', s.clocked_out_at,
             'notes', s.notes,
             'approved', s.approved_at IS NOT NULL
           ) ORDER BY s.work_date DESC, s.clocked_in_at)
      FROM public.clock_sessions s
      JOIN my_days d ON d.job_id = s.job_ledger_id AND d.work_date = s.work_date
      JOIN public.users u ON u.id = s.user_id
     WHERE s.rejected_at IS NULL
       AND s.revoked_at IS NULL
       AND s.user_id <> (SELECT auth.uid())
  ), '[]'::jsonb)
);
$$;

ALTER FUNCTION public.get_supervised_days_payload(date, date) OWNER TO postgres;
REVOKE EXECUTE ON FUNCTION public.get_supervised_days_payload(date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_supervised_days_payload(date, date) TO authenticated;
COMMENT ON FUNCTION public.get_supervised_days_payload(date, date) IS
  'v2.3613 Supervision: the job-days the caller supervised in [p_from, p_to] (listed or clocked on the job while able to run one — a master, or a helper / sub with needs_supervision off), each with its crew and report counts, plus the crew''s clock sessions on those job-days (read-only, no wages, never the caller''s own). {"supervisor": false} for anyone else.';
