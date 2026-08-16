SET lock_timeout = '3s';

-- Job Follow-Up Mode (v2.1718): the office reviews quiet jobs one card at a
-- time. Two small tables + one read RPC:
--   job_followup_reviews  — "Looks fine" stamps and snoozes (rest the job)
--   job_followup_settings — org-wide per-stage review periods (singleton row)
--   list_job_followup_activity(p_today) — latest-activity + next-scheduled
--     per open job, so the client can compute "quiet N days" without pulling
--     every note. Idempotent and additive.

CREATE TABLE IF NOT EXISTS public.job_followup_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs_ledger(id) ON DELETE CASCADE,
  reviewed_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz NOT NULL DEFAULT now(),
  -- NULL = plain "Looks fine" (rests for settings.rest_days); a date = snoozed
  -- until that calendar day (company timezone, chosen by the reviewer).
  snoozed_until date
);

COMMENT ON TABLE public.job_followup_reviews IS
  'Follow-up mode review stamps (v2.1718): "Looks fine" / snooze from the Jobs follow-up deck. Latest row per job governs when the job re-enters the queue; the queue kernel treats reviewed_at as activity.';

CREATE INDEX IF NOT EXISTS idx_job_followup_reviews_job
  ON public.job_followup_reviews (job_id, reviewed_at DESC);

CREATE TABLE IF NOT EXISTS public.job_followup_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  working_days integer NOT NULL DEFAULT 5,
  waiting_days integer NOT NULL DEFAULT 7,
  ready_to_bill_days integer NOT NULL DEFAULT 2,
  billed_days integer NOT NULL DEFAULT 7,
  collections_days integer NOT NULL DEFAULT 3,
  rest_days integer NOT NULL DEFAULT 3,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.users(id) ON DELETE SET NULL
);

COMMENT ON TABLE public.job_followup_settings IS
  'Org-wide review periods for Job Follow-Up Mode (v2.1718). Singleton row (id = true). Days of quiet per stage before a job enters the follow-up queue; rest_days is how long a "Looks fine" keeps it out.';

INSERT INTO public.job_followup_settings (id) VALUES (true)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.job_followup_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_followup_settings ENABLE ROW LEVEL SECURITY;

-- Office pool: dev, assistants (incl. controller), and masters review jobs.
DROP POLICY IF EXISTS "Office can manage job followup reviews" ON public.job_followup_reviews;
CREATE POLICY "Office can manage job followup reviews" ON public.job_followup_reviews
  USING (
    public.is_dev() OR public.is_assistant()
    OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'master_technician')
  )
  WITH CHECK (
    public.is_dev() OR public.is_assistant()
    OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'master_technician')
  );

-- Everyone in the office reads the periods; only dev/master change them.
DROP POLICY IF EXISTS "Office can read job followup settings" ON public.job_followup_settings;
CREATE POLICY "Office can read job followup settings" ON public.job_followup_settings
  FOR SELECT USING (
    public.is_dev() OR public.is_assistant()
    OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'master_technician')
  );

DROP POLICY IF EXISTS "Masters can update job followup settings" ON public.job_followup_settings;
CREATE POLICY "Masters can update job followup settings" ON public.job_followup_settings
  FOR UPDATE USING (
    public.is_dev()
    OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'master_technician')
  )
  WITH CHECK (
    public.is_dev()
    OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'master_technician')
  );

-- Latest activity + next scheduled visit per open job. SECURITY INVOKER on
-- purpose: every subquery runs under the caller's RLS, so the function returns
-- only jobs (and notes/events/blocks) the caller could read anyway.
-- p_today is the company-timezone wall date, computed by the client.
CREATE OR REPLACE FUNCTION public.list_job_followup_activity(p_today date)
RETURNS TABLE (job_id uuid, latest_activity_at timestamptz, next_scheduled_on date)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    j.id AS job_id,
    GREATEST(
      COALESCE((SELECT max(n.created_at) FROM public.jobs_ledger_thread_notes n WHERE n.job_id = j.id), to_timestamp(0)),
      COALESCE((SELECT max(e.changed_at) FROM public.job_status_events e WHERE e.job_id = j.id), to_timestamp(0)),
      COALESCE(j.last_work_date::timestamptz, to_timestamp(0)),
      COALESCE(j.last_bill_date::timestamptz, to_timestamp(0)),
      COALESCE(j.created_at, to_timestamp(0))
    ) AS latest_activity_at,
    (
      SELECT min(b.work_date)
      FROM public.job_schedule_blocks b
      WHERE b.job_id = j.id AND b.work_date >= p_today
    ) AS next_scheduled_on
  FROM public.jobs_ledger j
  WHERE j.status IN ('waiting', 'working', 'ready_to_bill', 'billed', 'collections');
$$;

SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
