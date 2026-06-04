-- Share Schedule: full-board (all assignees) block list over a DATE RANGE for Edge email,
-- plus recurring share subscriptions + idempotency log + pg_cron dispatch.

-- Full dispatch board visible to p_viewer over [p_start, p_end] (mirror of
-- list_job_schedule_blocks_for_schedule_email, generalized to a date range, grouped by person).
CREATE OR REPLACE FUNCTION public.list_schedule_blocks_for_share(p_viewer UUID, p_start DATE, p_end DATE)
RETURNS TABLE (
  id UUID,
  job_id UUID,
  assignee_user_id UUID,
  work_date DATE,
  time_start TIME,
  time_end TIME,
  note TEXT,
  assignee_name TEXT,
  job_hcp_number TEXT,
  job_name TEXT,
  job_address TEXT
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT
    jsb.id,
    jsb.job_id,
    jsb.assignee_user_id,
    jsb.work_date,
    jsb.time_start,
    jsb.time_end,
    jsb.note,
    trim(COALESCE(u.name, '')) AS assignee_name,
    jl.hcp_number AS job_hcp_number,
    jl.job_name AS job_name,
    jl.job_address AS job_address
  FROM public.job_schedule_blocks jsb
  INNER JOIN public.jobs_ledger jl ON jl.id = jsb.job_id
  LEFT JOIN public.users u ON u.id = jsb.assignee_user_id
  WHERE jsb.work_date BETWEEN p_start AND p_end
    AND (
      jsb.assignee_user_id = p_viewer
      OR EXISTS (SELECT 1 FROM public.users WHERE id = p_viewer AND role = 'dev')
      OR jl.master_user_id = p_viewer
      OR EXISTS (SELECT 1 FROM public.users WHERE id = p_viewer AND role = 'primary')
      OR EXISTS (
        SELECT 1 FROM public.master_superintendents ms
        WHERE ms.master_id = jl.master_user_id AND ms.superintendent_id = p_viewer
      )
      OR (jl.project_id IS NOT NULL AND public.can_access_project_row_for_user(jl.project_id, p_viewer))
      OR EXISTS (
        SELECT 1 FROM public.master_assistants
        WHERE master_id = p_viewer AND assistant_id = jl.master_user_id
      )
      OR EXISTS (
        SELECT 1 FROM public.master_assistants
        WHERE master_id = jl.master_user_id AND assistant_id = p_viewer
      )
      OR public.assistants_share_master(p_viewer, jl.master_user_id)
      OR EXISTS (
        SELECT 1 FROM public.jobs_ledger_team_members jtm
        WHERE jtm.job_id = jl.id AND jtm.user_id = p_viewer
      )
    )
  ORDER BY assignee_name ASC, jsb.work_date ASC, jsb.time_start ASC;
$$;

COMMENT ON FUNCTION public.list_schedule_blocks_for_share(UUID, DATE, DATE) IS
  'Full dispatch board (all assignees) over [p_start, p_end] visible to p_viewer (job_schedule_blocks SELECT policy). Service role / Edge only.';

REVOKE ALL ON FUNCTION public.list_schedule_blocks_for_share(UUID, DATE, DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_schedule_blocks_for_share(UUID, DATE, DATE) TO service_role;

-- True when caller may use Share Schedule (mirror of schedule-dispatch edit roles).
CREATE OR REPLACE FUNCTION public.can_manage_schedule_share()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid()
      AND u.archived_at IS NULL
      AND u.role IN ('dev', 'master_technician', 'assistant', 'superintendent')
  );
$$;

COMMENT ON FUNCTION public.can_manage_schedule_share() IS
  'True when caller may create/edit Share Schedule recurring emails (schedule-dispatch edit roles). Used by RLS + Edge (JWT).';

REVOKE ALL ON FUNCTION public.can_manage_schedule_share() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_manage_schedule_share() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_schedule_share() TO service_role;

-- Recurring share subscriptions (one recipient per row; a user may create several).
CREATE TABLE IF NOT EXISTS public.schedule_share_recurring (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  created_by uuid REFERENCES public.users (id) ON DELETE SET NULL,
  time_local time NOT NULL,
  timezone text NOT NULL DEFAULT 'America/Chicago',
  days_of_week smallint[] NOT NULL,
  include_current_day boolean NOT NULL DEFAULT true,
  scope text NOT NULL DEFAULT 'none' CHECK (scope IN ('none', 'next_day', 'rest_of_week')),
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT schedule_share_recurring_at_least_one_dayset CHECK (include_current_day OR scope <> 'none'),
  CONSTRAINT schedule_share_recurring_days_nonempty CHECK (cardinality(days_of_week) BETWEEN 1 AND 7)
);

COMMENT ON TABLE public.schedule_share_recurring IS
  'Standing emails of the full dispatch board to a recipient on chosen weekdays/time; day-set = current_day plus (next_day XOR rest_of_week).';
COMMENT ON COLUMN public.schedule_share_recurring.days_of_week IS
  '0=Sunday … 6=Saturday (Intl style). Days the email is sent.';
COMMENT ON COLUMN public.schedule_share_recurring.time_local IS
  'Wall clock send time interpreted in timezone; align to 15-minute grid for pg_cron */15.';
COMMENT ON COLUMN public.schedule_share_recurring.scope IS
  'none = only current_day; next_day = +tomorrow; rest_of_week = +tomorrow..coming Sunday.';

CREATE INDEX IF NOT EXISTS idx_schedule_share_recurring_enabled
  ON public.schedule_share_recurring (enabled)
  WHERE enabled = true;

CREATE OR REPLACE FUNCTION public.schedule_share_recurring_check_days_of_week()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.days_of_week IS NULL THEN
    RAISE EXCEPTION 'schedule_share_recurring.days_of_week must not be null';
  END IF;
  IF cardinality(NEW.days_of_week) NOT BETWEEN 1 AND 7 THEN
    RAISE EXCEPTION 'schedule_share_recurring.days_of_week must list 1 to 7 days';
  END IF;
  IF EXISTS (SELECT 1 FROM unnest(NEW.days_of_week) AS x(v) WHERE v < 0 OR v > 6) THEN
    RAISE EXCEPTION 'schedule_share_recurring.days_of_week must use 0=Sun … 6=Sat';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS schedule_share_recurring_check_days_of_week_bi ON public.schedule_share_recurring;
CREATE TRIGGER schedule_share_recurring_check_days_of_week_bi
BEFORE INSERT OR UPDATE ON public.schedule_share_recurring
FOR EACH ROW
EXECUTE FUNCTION public.schedule_share_recurring_check_days_of_week();

-- Stamp created_by from the JWT when omitted.
CREATE OR REPLACE FUNCTION public.schedule_share_recurring_set_created_by()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.created_by IS NULL AND auth.uid() IS NOT NULL THEN
    NEW.created_by := auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS schedule_share_recurring_created_by_tr ON public.schedule_share_recurring;
CREATE TRIGGER schedule_share_recurring_created_by_tr
  BEFORE INSERT ON public.schedule_share_recurring
  FOR EACH ROW
  EXECUTE FUNCTION public.schedule_share_recurring_set_created_by();

-- Keep updated_at fresh on UPDATE.
CREATE OR REPLACE FUNCTION public.schedule_share_recurring_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS schedule_share_recurring_touch_updated_at_tr ON public.schedule_share_recurring;
CREATE TRIGGER schedule_share_recurring_touch_updated_at_tr
  BEFORE UPDATE ON public.schedule_share_recurring
  FOR EACH ROW
  EXECUTE FUNCTION public.schedule_share_recurring_touch_updated_at();

-- Idempotency log: one send per subscription per local run date.
CREATE TABLE IF NOT EXISTS public.schedule_share_recurring_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL REFERENCES public.schedule_share_recurring (id) ON DELETE CASCADE,
  run_date date NOT NULL,
  status text NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'failed')),
  error text,
  sent_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (subscription_id, run_date)
);

COMMENT ON TABLE public.schedule_share_recurring_log IS
  'Idempotency key (subscription_id, run_date) so the */15 cron sends each recurring share at most once per local day.';

ALTER TABLE public.schedule_share_recurring ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule_share_recurring_log ENABLE ROW LEVEL SECURITY;

-- SELECT: every authenticated user with page access can SEE recurring shares.
CREATE POLICY schedule_share_recurring_select
  ON public.schedule_share_recurring FOR SELECT TO authenticated
  USING (public.can_manage_schedule_share());

CREATE POLICY schedule_share_recurring_insert
  ON public.schedule_share_recurring FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_schedule_share());

CREATE POLICY schedule_share_recurring_update
  ON public.schedule_share_recurring FOR UPDATE TO authenticated
  USING (public.can_manage_schedule_share())
  WITH CHECK (public.can_manage_schedule_share());

CREATE POLICY schedule_share_recurring_delete
  ON public.schedule_share_recurring FOR DELETE TO authenticated
  USING (public.can_manage_schedule_share());

-- Log readable by page managers; writes are service-role only (Edge bypasses RLS).
CREATE POLICY schedule_share_recurring_log_select
  ON public.schedule_share_recurring_log FOR SELECT TO authenticated
  USING (public.can_manage_schedule_share());

-- pg_cron: call Edge schedule-share-dispatch every 15 minutes (recurring path).
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'schedule-share-dispatch';

SELECT cron.schedule(
  'schedule-share-dispatch',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'PROJECT_URL') || '/functions/v1/schedule-share-dispatch',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Cron-Secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'CRON_SECRET')
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
