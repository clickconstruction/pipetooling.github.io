SET lock_timeout = '3s';

-- Before we start (punch list #382, call C from the audit of PR 10, on Taunya's word of 2026-11-21): the crew on a
-- job is who is on it now.
--
-- start_checks_crew (20261120033820) is the gate for the look on arrival: who is asked "Is it as told?", who may
-- answer, and who reads a stage's bullets and their yeses. It counted anyone who had ever clocked in on the job,
-- with no limit of days. A helper who worked one day on a job last spring was still its crew, and could answer for a
-- stage this month. PR 10 was the first write through the gate, so it is the first place that mattered.
--
-- A clock-in now counts for 14 days: today and the fourteen days before it, by the session's work day. The job's team
-- and a sub who reads the job are as they were, with no limit of days.
--
-- The file's name ends in _start_checks.sql on purpose: scripts/pgtest-start-checks.sh applies the tables' migration a
-- second time, which puts the old gate back, and it finds this file by the same ending and applies it after.
--
-- One function replaced, the same signature, the same grants. No table, so no closing calls. Idempotent.

CREATE OR REPLACE FUNCTION public.start_checks_crew(p_job_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (SELECT auth.uid()) IS NOT NULL
     AND p_job_id IS NOT NULL
     AND NOT public.is_primary()
     AND (
       EXISTS (SELECT 1 FROM public.jobs_ledger_team_members m WHERE m.job_id = p_job_id AND m.user_id = (SELECT auth.uid()))
       OR EXISTS (
         SELECT 1 FROM public.clock_sessions cs
          WHERE cs.job_ledger_id = p_job_id AND cs.user_id = (SELECT auth.uid()) AND cs.work_date >= public.app_today() - 14
       )
       OR public.subcontractor_can_read_jobs_ledger_row(p_job_id)
     )
     AND NOT public.job_shut_to_me(p_job_id);
$$;
COMMENT ON FUNCTION public.start_checks_crew(uuid) IS 'Before we start (#382): the crew on a job, for the look on arrival. On the job''s team, clocked in on it in the last 14 days, or a sub who reads it. A primary is held to is_job_people and is never the crew.';
REVOKE EXECUTE ON FUNCTION public.start_checks_crew(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_checks_crew(uuid) TO authenticated, service_role;
