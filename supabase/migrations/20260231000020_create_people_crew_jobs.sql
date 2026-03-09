-- People Crew Jobs: per-person-per-day crew lead and job assignments for Team Costs tab
-- Crew members inherit job breakdown from their crew lead
-- RLS: same as people_hours (pay access + shared read-only)

CREATE TABLE IF NOT EXISTS public.people_crew_jobs (
  work_date DATE NOT NULL,
  person_name TEXT NOT NULL,
  crew_lead_person_name TEXT,
  job_assignments JSONB NOT NULL DEFAULT '[]'::jsonb,
  PRIMARY KEY (work_date, person_name)
);
CREATE INDEX IF NOT EXISTS idx_people_crew_jobs_work_date ON public.people_crew_jobs(work_date);
CREATE INDEX IF NOT EXISTS idx_people_crew_jobs_person ON public.people_crew_jobs(person_name);
COMMENT ON TABLE public.people_crew_jobs IS 'Crew lead and job/percentage assignments per person per day. Crew members inherit crew lead job breakdown. Used by Team Costs tab.';
COMMENT ON COLUMN public.people_crew_jobs.crew_lead_person_name IS 'When set, this person inherits crew lead job assignments. When null, job_assignments applies.';
COMMENT ON COLUMN public.people_crew_jobs.job_assignments IS 'JSON array of { job_id: uuid, pct: number }. Only used when crew_lead_person_name is null. Should sum to 100.';
ALTER TABLE public.people_crew_jobs ENABLE ROW LEVEL SECURITY;
-- SELECT: pay access users + cost matrix shared (read-only)
DROP POLICY IF EXISTS "Pay access and shared users can read people crew jobs" ON public.people_crew_jobs;
CREATE POLICY "Pay access and shared users can read people crew jobs"
ON public.people_crew_jobs
FOR SELECT
USING (
  public.is_pay_approved_master()
  OR public.is_assistant_of_pay_approved_master()
  OR public.is_assistant()
  OR public.is_cost_matrix_shared_with_current_user()
);
-- INSERT/UPDATE/DELETE: pay access only (shared users are read-only)
DROP POLICY IF EXISTS "Pay access users can insert people crew jobs" ON public.people_crew_jobs;
CREATE POLICY "Pay access users can insert people crew jobs"
ON public.people_crew_jobs
FOR INSERT
WITH CHECK (
  public.is_pay_approved_master()
  OR public.is_assistant_of_pay_approved_master()
  OR public.is_assistant()
);
DROP POLICY IF EXISTS "Pay access users can update people crew jobs" ON public.people_crew_jobs;
CREATE POLICY "Pay access users can update people crew jobs"
ON public.people_crew_jobs
FOR UPDATE
USING (
  public.is_pay_approved_master()
  OR public.is_assistant_of_pay_approved_master()
  OR public.is_assistant()
)
WITH CHECK (
  public.is_pay_approved_master()
  OR public.is_assistant_of_pay_approved_master()
  OR public.is_assistant()
);
DROP POLICY IF EXISTS "Pay access users can delete people crew jobs" ON public.people_crew_jobs;
CREATE POLICY "Pay access users can delete people crew jobs"
ON public.people_crew_jobs
FOR DELETE
USING (
  public.is_pay_approved_master()
  OR public.is_assistant_of_pay_approved_master()
  OR public.is_assistant()
);
