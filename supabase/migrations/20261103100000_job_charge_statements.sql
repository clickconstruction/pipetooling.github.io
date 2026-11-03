SET lock_timeout = '3s';

-- The Statement of charges (punch list #254, PR 2, v2.6447): a job-level paper for a period, saved with its snapshot so
-- it prints again as it read, numbered SC-<job number>-<n> per job. Readable and writable by every office role that may
-- make an hours statement (can_touch_hours_statement(false): a dev or the controller, as v2.6450 draws it); the
-- customer copy carries no pay, but the paper is the office's. Idempotent.

CREATE TABLE IF NOT EXISTS public.job_charge_statements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id text NOT NULL UNIQUE CHECK (record_id ~ '^SC-' AND length(record_id) <= 60),
  job_ledger_id uuid NOT NULL REFERENCES public.jobs_ledger(id) ON DELETE CASCADE,
  period_start date NOT NULL,
  period_end date NOT NULL CHECK (period_end >= period_start),
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  labor_usd numeric,
  materials_usd numeric,
  charges_usd numeric,
  premium_usd numeric,
  state text NOT NULL DEFAULT 'draft' CHECK (state IN ('draft', 'printed')),
  prepared_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  prepared_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS job_charge_statements_job_idx ON public.job_charge_statements (job_ledger_id, prepared_at DESC);
COMMENT ON TABLE public.job_charge_statements IS
  'Punch list #254: the Statement of charges for a job and a period — the crew-days at the rate card or the job''s rule, the material lines at the markup, the adjustments — kept as the window''s read (snapshot) with the figures beside it; record_id SC-<job number>-<n> per job.';

ALTER TABLE public.job_charge_statements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS job_charge_statements_select ON public.job_charge_statements;
CREATE POLICY job_charge_statements_select ON public.job_charge_statements FOR SELECT TO authenticated
  USING (public.can_touch_hours_statement(false));
DROP POLICY IF EXISTS job_charge_statements_insert ON public.job_charge_statements;
CREATE POLICY job_charge_statements_insert ON public.job_charge_statements FOR INSERT TO authenticated
  WITH CHECK (public.can_touch_hours_statement(false) AND prepared_by = auth.uid());
DROP POLICY IF EXISTS job_charge_statements_update ON public.job_charge_statements;
CREATE POLICY job_charge_statements_update ON public.job_charge_statements FOR UPDATE TO authenticated
  USING (public.can_touch_hours_statement(false)) WITH CHECK (public.can_touch_hours_statement(false));
DROP POLICY IF EXISTS job_charge_statements_delete ON public.job_charge_statements;
CREATE POLICY job_charge_statements_delete ON public.job_charge_statements FOR DELETE TO authenticated
  USING (public.can_touch_hours_statement(false) AND state = 'draft');

REVOKE ALL ON public.job_charge_statements FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.job_charge_statements TO authenticated;

SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
