-- Recurring Email Reports (Jobs): schedules, recipients per schedule, dispatch idempotency log, pg_cron.

CREATE TABLE IF NOT EXISTS public.recurring_job_report_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  time_local time NOT NULL,
  days_of_week smallint[] NOT NULL,
  timezone text NOT NULL DEFAULT 'America/Chicago',
  reporting_preset text NOT NULL DEFAULT 'prior_calendar_day'
    CHECK (reporting_preset IN ('prior_calendar_day')),
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  scope_master_user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  created_by uuid REFERENCES public.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT recurring_job_report_schedules_days_nonempty CHECK (
    cardinality(days_of_week) BETWEEN 1 AND 7
  )
);

COMMENT ON TABLE public.recurring_job_report_schedules IS
  'Configurable recurring emails summarizing crew hours, clock notes, and field reports per job; scope_master_user_id limits jobs to that master org.';
COMMENT ON COLUMN public.recurring_job_report_schedules.days_of_week IS
  '0=Sunday … 6=Saturday (Intl style). Matches send-scheduled-reminders day numbering.';
COMMENT ON COLUMN public.recurring_job_report_schedules.time_local IS
  'Wall clock time interpreted in timezone; should align to 15-minute grid when used with pg_cron */15.';
COMMENT ON COLUMN public.recurring_job_report_schedules.scope_master_user_id IS
  'Jobs universe: emails only include jobs_ledger rows with this master_user_id.';

CREATE INDEX IF NOT EXISTS idx_recurring_job_report_schedules_enabled
  ON public.recurring_job_report_schedules (enabled)
  WHERE enabled = true;
CREATE INDEX IF NOT EXISTS idx_recurring_job_report_schedules_master
  ON public.recurring_job_report_schedules (scope_master_user_id);

CREATE OR REPLACE FUNCTION public.recurring_job_report_schedules_check_days_of_week()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.days_of_week IS NULL THEN
    RAISE EXCEPTION 'recurring_job_report_schedules.days_of_week must not be null';
  END IF;
  IF cardinality(NEW.days_of_week) NOT BETWEEN 1 AND 7 THEN
    RAISE EXCEPTION 'recurring_job_report_schedules.days_of_week must list 1 to 7 days';
  END IF;
  IF EXISTS (SELECT 1 FROM unnest(NEW.days_of_week) AS x(v) WHERE v < 0 OR v > 6) THEN
    RAISE EXCEPTION 'recurring_job_report_schedules.days_of_week must use 0=Sun … 6=Sat';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS recurring_job_report_schedules_check_days_of_week_bi ON public.recurring_job_report_schedules;

CREATE TRIGGER recurring_job_report_schedules_check_days_of_week_bi
BEFORE INSERT OR UPDATE ON public.recurring_job_report_schedules
FOR EACH ROW
EXECUTE FUNCTION public.recurring_job_report_schedules_check_days_of_week();

CREATE TABLE IF NOT EXISTS public.recurring_job_report_schedule_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id uuid NOT NULL REFERENCES public.recurring_job_report_schedules (id) ON DELETE CASCADE,
  recipient_user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  job_scope text NOT NULL CHECK (job_scope IN ('all_jobs', 'member_jobs_only')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (schedule_id, recipient_user_id)
);

CREATE INDEX IF NOT EXISTS idx_recurring_job_report_recipients_schedule
  ON public.recurring_job_report_schedule_recipients (schedule_id);

COMMENT ON COLUMN public.recurring_job_report_schedule_recipients.job_scope IS
  'all_jobs = all jobs under scope_master_user_id for that recipient universe; member_jobs_only = intersect with jobs_ledger_team_members for recipient_user_id.';

CREATE TABLE IF NOT EXISTS public.recurring_job_report_dispatch_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id uuid NOT NULL REFERENCES public.recurring_job_report_schedules (id) ON DELETE CASCADE,
  recipient_user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  reporting_date date NOT NULL,
  dispatched_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (schedule_id, recipient_user_id, reporting_date)
);

CREATE INDEX IF NOT EXISTS idx_recurring_job_report_dispatch_schedule
  ON public.recurring_job_report_dispatch_log (schedule_id);

COMMENT ON COLUMN public.recurring_job_report_dispatch_log.reporting_date IS
  'Content date summarized (e.g. prior calendar day in schedule timezone); idempotency key with schedule + recipient.';

ALTER TABLE public.recurring_job_report_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurring_job_report_schedule_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurring_job_report_dispatch_log ENABLE ROW LEVEL SECURITY;

-- Schedules: dev, masters, assistants with access to scope master (mirror jobs_ledger orbit).
CREATE POLICY recurring_job_report_schedules_select_dma
ON public.recurring_job_report_schedules FOR SELECT TO authenticated USING (
  public.is_dev()
  OR (
    public.is_dev_or_master_or_assistant()
    AND (
      scope_master_user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.master_assistants ma
        WHERE ma.master_id = recurring_job_report_schedules.scope_master_user_id
          AND ma.assistant_id = auth.uid()
      )
      OR public.assistants_share_master(auth.uid(), scope_master_user_id)
    )
  )
);

CREATE POLICY recurring_job_report_schedules_insert_dma
ON public.recurring_job_report_schedules FOR INSERT TO authenticated WITH CHECK (
  public.is_dev()
  OR (
    public.is_dev_or_master_or_assistant()
    AND (
      scope_master_user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.master_assistants ma
        WHERE ma.master_id = recurring_job_report_schedules.scope_master_user_id
          AND ma.assistant_id = auth.uid()
      )
      OR public.assistants_share_master(auth.uid(), scope_master_user_id)
    )
  )
);

CREATE POLICY recurring_job_report_schedules_update_dma
ON public.recurring_job_report_schedules FOR UPDATE TO authenticated
USING (
  public.is_dev()
  OR (
    public.is_dev_or_master_or_assistant()
    AND (
      scope_master_user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.master_assistants ma
        WHERE ma.master_id = recurring_job_report_schedules.scope_master_user_id
          AND ma.assistant_id = auth.uid()
      )
      OR public.assistants_share_master(auth.uid(), scope_master_user_id)
    )
  )
)
WITH CHECK (
  public.is_dev()
  OR (
    public.is_dev_or_master_or_assistant()
    AND (
      scope_master_user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.master_assistants ma
        WHERE ma.master_id = recurring_job_report_schedules.scope_master_user_id
          AND ma.assistant_id = auth.uid()
      )
      OR public.assistants_share_master(auth.uid(), scope_master_user_id)
    )
  )
);

CREATE POLICY recurring_job_report_schedules_delete_dma
ON public.recurring_job_report_schedules FOR DELETE TO authenticated USING (
  public.is_dev()
  OR (
    public.is_dev_or_master_or_assistant()
    AND (
      scope_master_user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.master_assistants ma
        WHERE ma.master_id = recurring_job_report_schedules.scope_master_user_id
          AND ma.assistant_id = auth.uid()
      )
      OR public.assistants_share_master(auth.uid(), scope_master_user_id)
    )
  )
);

-- Recipients CRUD inherits schedule access.
CREATE POLICY recurring_job_report_recipients_select
ON public.recurring_job_report_schedule_recipients FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.recurring_job_report_schedules s
    WHERE s.id = recurring_job_report_schedule_recipients.schedule_id
      AND (
        public.is_dev()
        OR (
          public.is_dev_or_master_or_assistant()
          AND (
            s.scope_master_user_id = auth.uid()
            OR EXISTS (
              SELECT 1 FROM public.master_assistants ma
              WHERE ma.master_id = s.scope_master_user_id
                AND ma.assistant_id = auth.uid()
            )
            OR public.assistants_share_master(auth.uid(), s.scope_master_user_id)
          )
        )
      )
  )
);

CREATE POLICY recurring_job_report_recipients_insert
ON public.recurring_job_report_schedule_recipients FOR INSERT TO authenticated WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.recurring_job_report_schedules s
    WHERE s.id = recurring_job_report_schedule_recipients.schedule_id
      AND (
        public.is_dev()
        OR (
          public.is_dev_or_master_or_assistant()
          AND (
            s.scope_master_user_id = auth.uid()
            OR EXISTS (
              SELECT 1 FROM public.master_assistants ma
              WHERE ma.master_id = s.scope_master_user_id
                AND ma.assistant_id = auth.uid()
            )
            OR public.assistants_share_master(auth.uid(), s.scope_master_user_id)
          )
        )
      )
  )
);

CREATE POLICY recurring_job_report_recipients_update
ON public.recurring_job_report_schedule_recipients FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.recurring_job_report_schedules s
    WHERE s.id = recurring_job_report_schedule_recipients.schedule_id
      AND (
        public.is_dev()
        OR (
          public.is_dev_or_master_or_assistant()
          AND (
            s.scope_master_user_id = auth.uid()
            OR EXISTS (
              SELECT 1 FROM public.master_assistants ma
              WHERE ma.master_id = s.scope_master_user_id
                AND ma.assistant_id = auth.uid()
            )
            OR public.assistants_share_master(auth.uid(), s.scope_master_user_id)
          )
        )
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.recurring_job_report_schedules s
    WHERE s.id = recurring_job_report_schedule_recipients.schedule_id
      AND (
        public.is_dev()
        OR (
          public.is_dev_or_master_or_assistant()
          AND (
            s.scope_master_user_id = auth.uid()
            OR EXISTS (
              SELECT 1 FROM public.master_assistants ma
              WHERE ma.master_id = s.scope_master_user_id
                AND ma.assistant_id = auth.uid()
            )
            OR public.assistants_share_master(auth.uid(), s.scope_master_user_id)
          )
        )
      )
  )
);

CREATE POLICY recurring_job_report_recipients_delete
ON public.recurring_job_report_schedule_recipients FOR DELETE TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.recurring_job_report_schedules s
    WHERE s.id = recurring_job_report_schedule_recipients.schedule_id
      AND (
        public.is_dev()
        OR (
          public.is_dev_or_master_or_assistant()
          AND (
            s.scope_master_user_id = auth.uid()
            OR EXISTS (
              SELECT 1 FROM public.master_assistants ma
              WHERE ma.master_id = s.scope_master_user_id
                AND ma.assistant_id = auth.uid()
            )
            OR public.assistants_share_master(auth.uid(), s.scope_master_user_id)
          )
        )
      )
  )
);

-- Dispatch log: readable by schedule managers only (Edge uses service_role bypass).
CREATE POLICY recurring_job_report_dispatch_log_select
ON public.recurring_job_report_dispatch_log FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.recurring_job_report_schedules s
    WHERE s.id = recurring_job_report_dispatch_log.schedule_id
      AND (
        public.is_dev()
        OR (
          public.is_dev_or_master_or_assistant()
          AND (
            s.scope_master_user_id = auth.uid()
            OR EXISTS (
              SELECT 1 FROM public.master_assistants ma
              WHERE ma.master_id = s.scope_master_user_id
                AND ma.assistant_id = auth.uid()
            )
            OR public.assistants_share_master(auth.uid(), s.scope_master_user_id)
          )
        )
      )
  )
);

-- INSERT/UPDATE/DELETE: no policies for authenticated (deny). Service role Edge bypasses RLS.

CREATE OR REPLACE FUNCTION public.user_can_manage_recurring_job_report_scope(p_scope_master_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.archived_at IS NULL)
    AND (
      public.is_dev()
      OR (
        EXISTS (
          SELECT 1 FROM public.users u
          WHERE u.id = auth.uid()
          AND u.role IN ('master_technician', 'assistant')
        )
        AND (
          p_scope_master_user_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.master_assistants ma
            WHERE ma.master_id = p_scope_master_user_id
              AND ma.assistant_id = auth.uid()
          )
          OR public.assistants_share_master(auth.uid(), p_scope_master_user_id)
        )
      )
    );
$$;

COMMENT ON FUNCTION public.user_can_manage_recurring_job_report_scope(uuid) IS
  'True when caller may configure recurring job report emails for the given scope master_user_id org. Used by Edge (JWT).';

REVOKE ALL ON FUNCTION public.user_can_manage_recurring_job_report_scope(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_can_manage_recurring_job_report_scope(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_can_manage_recurring_job_report_scope(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.reporting_window_for_recurring_job_email(
  p_timezone text,
  p_preset text
)
RETURNS TABLE (window_start_utc timestamptz, window_end_utc timestamptz, reporting_date date)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH z AS (
    SELECT COALESCE(NULLIF(trim(p_timezone), ''), 'America/Chicago') AS tznm
  ),
  b AS (
    SELECT (
      (timezone(z.tznm, now()))::date - INTERVAL '1 day'
    )::date AS rpt
    FROM z
    WHERE lower(trim(coalesce(p_preset, ''))) = 'prior_calendar_day'
  )
  SELECT
    (b.rpt::timestamp AT TIME ZONE (SELECT tznm FROM z))::timestamptz AS window_start_utc,
    (((b.rpt + INTERVAL '1 day')::date)::timestamp AT TIME ZONE (SELECT tznm FROM z))::timestamptz AS window_end_utc,
    b.rpt AS reporting_date
  FROM b;
$$;

COMMENT ON FUNCTION public.reporting_window_for_recurring_job_email(text, text) IS
  'Reporting period in UTC for recurring job report emails (prior_calendar_day = yesterday in p_timezone).';

REVOKE ALL ON FUNCTION public.reporting_window_for_recurring_job_email(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reporting_window_for_recurring_job_email(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reporting_window_for_recurring_job_email(text, text) TO service_role;

SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'recurring-job-report-dispatch';

SELECT cron.schedule(
  'recurring-job-report-dispatch',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'PROJECT_URL') || '/functions/v1/recurring-job-report-dispatch',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Cron-Secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'CRON_SECRET')
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);