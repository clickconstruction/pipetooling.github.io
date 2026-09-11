SET lock_timeout = '3s';

-- Test reports PR 2 (v2.3298): the hydrostatic / pinpoint / gas test report as
-- a job document. One row per report; the typed fields the paper needs (the
-- external plumbingtooling.com app kept them in a form nobody could find
-- again), the certifier snapshotted at send time, the stored PDF's path once
-- Send uploads it (PR 3), and the send record. Drafts are 'draft'; Send flips
-- the row to 'sent' and every later edit writes a new PDF version (the old
-- file stays — the GC already has it).
--
-- Access mirrors the job's own children (jobs_ledger_fixtures): dev any job;
-- master own; assistant-like (assistant + controller) through adoption or a
-- shared master; primary reads. The helper below is the fixtures predicate,
-- kept in one place so the policies read as sentences. Read-only training
-- accounts are stopped by the two apply_* calls at the end.

CREATE TABLE IF NOT EXISTS public.job_test_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs_ledger(id) ON DELETE CASCADE,
  test_type text NOT NULL CHECK (test_type IN ('pre_test', 'post_test', 'pinpoint', 'gas')),
  system text CHECK (system IS NULL OR system IN ('supply', 'sewer')),
  result text CHECK (result IS NULL OR result IN ('pass', 'fail')),
  test_date date NOT NULL,
  duration_minutes integer CHECK (duration_minutes IS NULL OR duration_minutes > 0),
  notes text NOT NULL DEFAULT '',
  pinpoint_location text NOT NULL DEFAULT '',
  pinpoint_method text NOT NULL DEFAULT '',
  pinpoint_findings text NOT NULL DEFAULT '',
  gas_pressure_psi numeric(10, 4) CHECK (gas_pressure_psi IS NULL OR gas_pressure_psi >= 0),
  -- [{ "name": "Furnace", "btuPerHour": 100000 }, …]
  gas_fixtures jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- Per-report overrides of the Settings text; NULL = the default at render time.
  system_tested text,
  test_method text,
  test_pressure text,
  conclusion text,
  -- Snapshotted when the report is sent, so a later Settings change never rewrites a sent paper.
  certifier_name text,
  certifier_license text,
  -- The tech's clock-out report that drafted this row (PR 4), when there was one.
  source_report_id uuid REFERENCES public.reports(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent')),
  -- Storage: job-test-reports/<job_id>/<report_id>-v<pdf_version>.pdf (PR 3).
  pdf_path text,
  pdf_version integer NOT NULL DEFAULT 0,
  sent_at timestamptz,
  sent_to text[] NOT NULL DEFAULT '{}'::text[],
  sent_cc text[] NOT NULL DEFAULT '{}'::text[],
  sent_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  -- The Stripe hosted pay link that rode in the email, as sent.
  sent_pay_url text,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS job_test_reports_job_idx ON public.job_test_reports (job_id, created_at DESC);
CREATE INDEX IF NOT EXISTS job_test_reports_status_idx ON public.job_test_reports (status) WHERE status = 'draft';
CREATE UNIQUE INDEX IF NOT EXISTS job_test_reports_source_report_idx ON public.job_test_reports (source_report_id) WHERE source_report_id IS NOT NULL;

COMMENT ON TABLE public.job_test_reports IS
  'Hydrostatic / pinpoint / gas test reports per job (v2.3298): the typed fields the paper needs, the certifier snapshot, the stored PDF path + version once sent, and the send record. Drafts → sent via send-test-report (PR 3); drafted from the tech''s clock-out report by trigger (PR 4). Kernel: supabase/functions/_shared/testReport.ts.';

DROP TRIGGER IF EXISTS update_job_test_reports_updated_at ON public.job_test_reports;
CREATE TRIGGER update_job_test_reports_updated_at BEFORE UPDATE ON public.job_test_reports
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------------------------------------------------------------------------
-- Access helper: the jobs_ledger_fixtures job predicate, named.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.can_reach_job_for_test_report(p_job_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.jobs_ledger j
    WHERE j.id = p_job_id
      AND (
        j.master_user_id = (SELECT auth.uid())
        OR public.is_dev()
        OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND u.role = 'primary')
        OR EXISTS (SELECT 1 FROM public.master_assistants ma WHERE ma.master_id = (SELECT auth.uid()) AND ma.assistant_id = j.master_user_id)
        OR EXISTS (SELECT 1 FROM public.master_assistants ma WHERE ma.master_id = j.master_user_id AND ma.assistant_id = (SELECT auth.uid()))
        OR public.assistants_share_master((SELECT auth.uid()), j.master_user_id)
      )
  );
$$;

REVOKE EXECUTE ON FUNCTION public.can_reach_job_for_test_report(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_reach_job_for_test_report(uuid) TO authenticated;

ALTER TABLE public.job_test_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Office and primary read job test reports" ON public.job_test_reports;
CREATE POLICY "Office and primary read job test reports" ON public.job_test_reports
  FOR SELECT USING (
    (public.is_dev() OR public.is_assistant()
      OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND u.role IN ('master_technician', 'primary')))
    AND public.can_reach_job_for_test_report(job_id)
  );

DROP POLICY IF EXISTS "Office writes job test reports" ON public.job_test_reports;
CREATE POLICY "Office writes job test reports" ON public.job_test_reports
  FOR INSERT WITH CHECK (
    (public.is_dev() OR public.is_assistant()
      OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND u.role = 'master_technician'))
    AND public.can_reach_job_for_test_report(job_id)
  );

DROP POLICY IF EXISTS "Office updates job test reports" ON public.job_test_reports;
CREATE POLICY "Office updates job test reports" ON public.job_test_reports
  FOR UPDATE USING (
    (public.is_dev() OR public.is_assistant()
      OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND u.role = 'master_technician'))
    AND public.can_reach_job_for_test_report(job_id)
  ) WITH CHECK (
    (public.is_dev() OR public.is_assistant()
      OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND u.role = 'master_technician'))
    AND public.can_reach_job_for_test_report(job_id)
  );

-- Only drafts can be deleted; a sent report is a record.
DROP POLICY IF EXISTS "Office deletes draft job test reports" ON public.job_test_reports;
CREATE POLICY "Office deletes draft job test reports" ON public.job_test_reports
  FOR DELETE USING (
    status = 'draft'
    AND (public.is_dev() OR public.is_assistant()
      OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND u.role = 'master_technician'))
    AND public.can_reach_job_for_test_report(job_id)
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.job_test_reports TO authenticated;

-- ---------------------------------------------------------------------------
-- Settings seed: the certifier and the paper's text, editable on Settings →
-- Jobs & billing. Seeded from the external app's literals so the first report
-- reads exactly like the last one plumbingtooling.com produced. Idempotent.
-- ---------------------------------------------------------------------------

INSERT INTO public.app_settings (key, value_text)
VALUES (
  'test_report_settings_v1',
  '{"companyName":"Click Plumbing","companyTagline":"Plumbing, Electrical, and HVAC","officePhone":"(512) 360-0599","mailingAddress":"5501 Balcones Dr A141 Austin TX 78731","tsbpeAddress":"929 East 41st St Austin TX 78751","certifierName":"Malachi Whites","certifierLicense":"#RMP41130"}'
)
ON CONFLICT (key) DO NOTHING;

SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
