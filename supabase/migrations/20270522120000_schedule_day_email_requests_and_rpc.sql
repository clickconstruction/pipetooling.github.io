-- Schedule day email: queue rows + hub-parity block list for Edge + pg_cron dispatch.

-- Project access as a specific user (mirror of can_access_project_row for auth.uid).
CREATE OR REPLACE FUNCTION public.can_access_project_row_for_user(project_id_param UUID, viewer_user_id UUID)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  proj_master_id UUID;
  proj_customer_id UUID;
  cust_master_id UUID;
  user_role_val TEXT;
BEGIN
  SELECT p.master_user_id, p.customer_id
  INTO proj_master_id, proj_customer_id
  FROM public.projects p
  WHERE p.id = project_id_param;

  IF proj_master_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT role INTO user_role_val FROM public.users WHERE id = viewer_user_id;

  IF proj_master_id = viewer_user_id THEN
    RETURN true;
  END IF;
  IF user_role_val IN ('dev', 'master_technician') THEN
    RETURN true;
  END IF;
  IF EXISTS (SELECT 1 FROM public.master_assistants WHERE master_id = proj_master_id AND assistant_id = viewer_user_id) THEN
    RETURN true;
  END IF;
  IF EXISTS (SELECT 1 FROM public.master_primaries WHERE master_id = proj_master_id AND primary_id = viewer_user_id) THEN
    RETURN true;
  END IF;
  IF EXISTS (SELECT 1 FROM public.master_superintendents WHERE master_id = proj_master_id AND superintendent_id = viewer_user_id) THEN
    RETURN true;
  END IF;
  IF EXISTS (SELECT 1 FROM public.master_shares WHERE sharing_master_id = proj_master_id AND viewing_master_id = viewer_user_id) THEN
    RETURN true;
  END IF;

  IF proj_customer_id IS NOT NULL THEN
    SELECT master_user_id INTO cust_master_id FROM public.customers WHERE id = proj_customer_id;
    IF cust_master_id IS NOT NULL THEN
      IF cust_master_id = viewer_user_id THEN
        RETURN true;
      END IF;
      IF user_role_val IN ('dev', 'master_technician') THEN
        RETURN true;
      END IF;
      IF EXISTS (SELECT 1 FROM public.master_assistants WHERE master_id = cust_master_id AND assistant_id = viewer_user_id) THEN
        RETURN true;
      END IF;
      IF EXISTS (SELECT 1 FROM public.master_primaries WHERE master_id = cust_master_id AND primary_id = viewer_user_id) THEN
        RETURN true;
      END IF;
      IF EXISTS (SELECT 1 FROM public.master_superintendents WHERE master_id = cust_master_id AND superintendent_id = viewer_user_id) THEN
        RETURN true;
      END IF;
      IF EXISTS (SELECT 1 FROM public.master_shares WHERE sharing_master_id = cust_master_id AND viewing_master_id = viewer_user_id) THEN
        RETURN true;
      END IF;
    END IF;
  END IF;

  RETURN false;
END;
$$;

COMMENT ON FUNCTION public.can_access_project_row_for_user(UUID, UUID) IS
  'Same as can_access_project_row for a given viewer user id; used by list_job_schedule_blocks_for_schedule_email cron path.';

REVOKE ALL ON FUNCTION public.can_access_project_row_for_user(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_access_project_row_for_user(UUID, UUID) TO service_role;

-- Rows visible to p_recipient mirroring job_schedule_blocks_select (substitute p_recipient for auth.uid()).
CREATE OR REPLACE FUNCTION public.list_job_schedule_blocks_for_schedule_email(p_recipient UUID, p_work_date DATE)
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
  WHERE jsb.work_date = p_work_date
    AND (
      jsb.assignee_user_id = p_recipient
      OR EXISTS (SELECT 1 FROM public.users WHERE id = p_recipient AND role = 'dev')
      OR jl.master_user_id = p_recipient
      OR EXISTS (SELECT 1 FROM public.users WHERE id = p_recipient AND role = 'primary')
      OR EXISTS (
        SELECT 1 FROM public.master_superintendents ms
        WHERE ms.master_id = jl.master_user_id AND ms.superintendent_id = p_recipient
      )
      OR (jl.project_id IS NOT NULL AND public.can_access_project_row_for_user(jl.project_id, p_recipient))
      OR EXISTS (
        SELECT 1 FROM public.master_assistants
        WHERE master_id = p_recipient AND assistant_id = jl.master_user_id
      )
      OR EXISTS (
        SELECT 1 FROM public.master_assistants
        WHERE master_id = jl.master_user_id AND assistant_id = p_recipient
      )
      OR public.assistants_share_master(p_recipient, jl.master_user_id)
      OR EXISTS (
        SELECT 1 FROM public.jobs_ledger_team_members jtm
        WHERE jtm.job_id = jl.id AND jtm.user_id = p_recipient
      )
    )
  ORDER BY jsb.time_start ASC, jsb.assignee_user_id ASC;
$$;

COMMENT ON FUNCTION public.list_job_schedule_blocks_for_schedule_email(UUID, DATE) IS
  'Dispatch schedule blocks for one calendar day visible to p_recipient (job_schedule_blocks SELECT policy). Service role / Edge only.';

REVOKE ALL ON FUNCTION public.list_job_schedule_blocks_for_schedule_email(UUID, DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_job_schedule_blocks_for_schedule_email(UUID, DATE) TO service_role;

CREATE TABLE IF NOT EXISTS public.schedule_day_email_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_user_id UUID NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  work_date DATE NOT NULL,
  send_at TIMESTAMPTZ NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'America/Chicago',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'cancelled')),
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ,
  created_by UUID REFERENCES public.users (id) ON DELETE SET NULL
);

COMMENT ON TABLE public.schedule_day_email_requests IS
  'User-queued email of job_schedule_blocks for one work_date; send_at is absolute instant (UTC).';

CREATE UNIQUE INDEX IF NOT EXISTS idx_schedule_day_email_requests_one_pending_per_day
  ON public.schedule_day_email_requests (recipient_user_id, work_date)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_schedule_day_email_requests_pending_send
  ON public.schedule_day_email_requests (send_at)
  WHERE status = 'pending';

CREATE OR REPLACE FUNCTION public.schedule_day_email_requests_set_created_by()
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

DROP TRIGGER IF EXISTS schedule_day_email_requests_created_by_tr ON public.schedule_day_email_requests;
CREATE TRIGGER schedule_day_email_requests_created_by_tr
  BEFORE INSERT ON public.schedule_day_email_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.schedule_day_email_requests_set_created_by();

ALTER TABLE public.schedule_day_email_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "schedule_day_email_requests_select_own"
  ON public.schedule_day_email_requests FOR SELECT
  USING (recipient_user_id = (SELECT auth.uid()));

CREATE POLICY "schedule_day_email_requests_insert_dev_master_assistant_self"
  ON public.schedule_day_email_requests FOR INSERT
  WITH CHECK (
    recipient_user_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = (SELECT auth.uid())
        AND u.role IN ('dev', 'master_technician', 'assistant')
    )
  );

CREATE POLICY "schedule_day_email_requests_update_own"
  ON public.schedule_day_email_requests FOR UPDATE
  USING (recipient_user_id = (SELECT auth.uid()))
  WITH CHECK (recipient_user_id = (SELECT auth.uid()));

-- Subcontractor, helpers, estimator, primary, superintendent: no direct access (no policies)

-- pg_cron: call Edge schedule-day-email-dispatch every 15 minutes
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'schedule-day-email-dispatch';

SELECT cron.schedule(
  'schedule-day-email-dispatch',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'PROJECT_URL') || '/functions/v1/schedule-day-email-dispatch',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Cron-Secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'CRON_SECRET')
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
