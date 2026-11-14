SET lock_timeout = '3s';

-- Lien desk (v2.7270, punch list #356 part 2): the months an affidavit swears, set by hand. One row per job — the months
-- the paper names in its paragraph 5 ('YYYY-MM', oldest first), counsel's reason, who and when. The paper otherwise
-- names the months the job's recorded § 53.056 notices name inside the job's own work span; on a job with no clock hours
-- and a last day set by hand that span is one month, and a notice recorded for several jobs at a property that names
-- earlier months leaves it blank. The owner's door 1 of 2026-11-14: a person picks the months and types counsel's word,
-- as the claim set by hand works (job_lien_claim_corrections). The record stays per job. Nothing else is touched.
CREATE TABLE IF NOT EXISTS public.job_lien_affidavit_months (
  job_id uuid PRIMARY KEY REFERENCES public.jobs_ledger(id) ON DELETE CASCADE,
  months text[] NOT NULL,
  reason text NOT NULL,
  set_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  set_by_name text NOT NULL DEFAULT '',
  set_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT job_lien_affidavit_months_reason_check CHECK (btrim(reason) <> ''),
  CONSTRAINT job_lien_affidavit_months_months_check CHECK (cardinality(months) > 0)
);

COMMENT ON TABLE public.job_lien_affidavit_months IS
  'Lien desk (v2.7270, punch list #356): the months a job''s lien affidavit swears, set by hand with counsel''s reason — one row per job, the months as YYYY-MM, who and when. Read in place of the months the recorded notices name inside the job''s work span. Never changes a notice or the ledger.';

ALTER TABLE public.job_lien_affidavit_months ENABLE ROW LEVEL SECURITY;

-- The office set (dev, assistant-like, the master) — the desk's own roles, as job_lien_claim_corrections. The office may clear its own row.
DROP POLICY IF EXISTS job_lien_affidavit_months_select_office ON public.job_lien_affidavit_months;
CREATE POLICY job_lien_affidavit_months_select_office
  ON public.job_lien_affidavit_months FOR SELECT TO authenticated
  USING (
    public.is_dev()
    OR public.is_assistant()
    OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'master_technician')
  );

DROP POLICY IF EXISTS job_lien_affidavit_months_insert_office ON public.job_lien_affidavit_months;
CREATE POLICY job_lien_affidavit_months_insert_office
  ON public.job_lien_affidavit_months FOR INSERT TO authenticated
  WITH CHECK (
    public.is_dev()
    OR public.is_assistant()
    OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'master_technician')
  );

DROP POLICY IF EXISTS job_lien_affidavit_months_update_office ON public.job_lien_affidavit_months;
CREATE POLICY job_lien_affidavit_months_update_office
  ON public.job_lien_affidavit_months FOR UPDATE TO authenticated
  USING (
    public.is_dev()
    OR public.is_assistant()
    OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'master_technician')
  );

DROP POLICY IF EXISTS job_lien_affidavit_months_delete_office ON public.job_lien_affidavit_months;
CREATE POLICY job_lien_affidavit_months_delete_office
  ON public.job_lien_affidavit_months FOR DELETE TO authenticated
  USING (
    public.is_dev()
    OR public.is_assistant()
    OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'master_technician')
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.job_lien_affidavit_months TO authenticated;

-- House rules for every CREATE TABLE: training-mode blocks, the digital-twin fence and the archived seal.
SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
SELECT public.apply_archived_read_blocks();
