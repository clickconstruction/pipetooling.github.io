SET lock_timeout = '3s';

-- Pay applications the job remembers (v2.4490): the AIA G702-G703 window's saved rows.
-- The window filled a workbook and kept nothing, so a job's second application could not know
-- its first: "work from previous application" and "less previous certificates" were always 0.
-- One row per job and application number holds the form as it was typed (`fields`) and the
-- sheet's totals over it, so the next application starts from the last and the job can list
-- them. Nothing locks: the office opens a saved application, changes it and saves it again.
CREATE TABLE IF NOT EXISTS public.job_pay_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs_ledger(id) ON DELETE CASCADE,
  application_number integer NOT NULL
    CONSTRAINT job_pay_applications_number_check CHECK (application_number BETWEEN 1 AND 9999),
  -- The form's dates when they read as dates; the text as typed stays in `fields`.
  period_to date,
  application_date date,
  -- The window's form, keyed by its field keys (src/lib/aiaG702G703Template.ts).
  fields jsonb NOT NULL DEFAULT '{}'::jsonb
    CONSTRAINT job_pay_applications_fields_object CHECK (jsonb_typeof(fields) = 'object'),
  -- The sheet's math over `fields`, written by the client that saved it.
  contract_sum_to_date numeric(14, 2) NOT NULL DEFAULT 0,
  total_completed_and_stored numeric(14, 2) NOT NULL DEFAULT 0,
  retainage_pct numeric(6, 3) NOT NULL DEFAULT 0
    CONSTRAINT job_pay_applications_retainage_pct_check CHECK (retainage_pct BETWEEN 0 AND 100),
  retainage_held numeric(14, 2) NOT NULL DEFAULT 0,
  total_earned_less_retainage numeric(14, 2) NOT NULL DEFAULT 0,
  current_payment_due numeric(14, 2) NOT NULL DEFAULT 0,
  -- 'window' = made in the window; 'file' = one already sent, added from its file.
  source text NOT NULL DEFAULT 'window'
    CONSTRAINT job_pay_applications_source_check CHECK (source IN ('window', 'file')),
  -- The files kept beside it: [{ path, name, kind, at, by }]. Filled by the files step.
  files jsonb NOT NULL DEFAULT '[]'::jsonb
    CONSTRAINT job_pay_applications_files_array CHECK (jsonb_typeof(files) = 'array'),
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT job_pay_applications_job_number_uniq UNIQUE (job_id, application_number)
);

COMMENT ON TABLE public.job_pay_applications IS
  'Pay applications the job remembers (v2.4490): per (job, application number), the AIA G702-G703 window''s form as typed (fields) and the sheet''s totals over it, so the next application carries the previous amounts and the job can list them. Not locked: a saved application can be changed and saved again.';

ALTER TABLE public.job_pay_applications ENABLE ROW LEVEL SECURITY;

-- The office set that bills jobs (dev, assistant-like, master): the roles the AIA window opens for.
DROP POLICY IF EXISTS job_pay_applications_select_office ON public.job_pay_applications;
CREATE POLICY job_pay_applications_select_office
  ON public.job_pay_applications FOR SELECT TO authenticated
  USING (
    public.is_dev()
    OR public.is_assistant()
    OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND u.role = 'master_technician')
  );

DROP POLICY IF EXISTS job_pay_applications_insert_office ON public.job_pay_applications;
CREATE POLICY job_pay_applications_insert_office
  ON public.job_pay_applications FOR INSERT TO authenticated
  WITH CHECK (
    public.is_dev()
    OR public.is_assistant()
    OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND u.role = 'master_technician')
  );

DROP POLICY IF EXISTS job_pay_applications_update_office ON public.job_pay_applications;
CREATE POLICY job_pay_applications_update_office
  ON public.job_pay_applications FOR UPDATE TO authenticated
  USING (
    public.is_dev()
    OR public.is_assistant()
    OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND u.role = 'master_technician')
  )
  WITH CHECK (
    public.is_dev()
    OR public.is_assistant()
    OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND u.role = 'master_technician')
  );

DROP POLICY IF EXISTS job_pay_applications_delete_office ON public.job_pay_applications;
CREATE POLICY job_pay_applications_delete_office
  ON public.job_pay_applications FOR DELETE TO authenticated
  USING (
    public.is_dev()
    OR public.is_assistant()
    OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND u.role = 'master_technician')
  );

-- Who saved it and when are stamped on the server, whatever the client sends.
CREATE OR REPLACE FUNCTION public.job_pay_applications_stamp()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.created_by := auth.uid();
    NEW.created_at := now();
  ELSE
    NEW.created_by := OLD.created_by;
    NEW.created_at := OLD.created_at;
  END IF;
  NEW.updated_by := auth.uid();
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
-- A trigger function is never called by hand.
REVOKE ALL ON FUNCTION public.job_pay_applications_stamp() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS job_pay_applications_stamp ON public.job_pay_applications;
CREATE TRIGGER job_pay_applications_stamp
  BEFORE INSERT OR UPDATE ON public.job_pay_applications
  FOR EACH ROW EXECUTE FUNCTION public.job_pay_applications_stamp();

-- House rules: read-only training mode + the twin write fence cover every new table.
SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
