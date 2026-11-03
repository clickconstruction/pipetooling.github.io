SET lock_timeout = '3s';

-- Adjustments on a job's charges (punch list #254, PR 3, v2.6445): what the office changes on top of the record in the
-- Charges window — a day's crew shape, a day left off, a material line passed through at cost or left off — each with
-- a reason and who made it, kept on the job and never on a clock session or an invoice. Reverting marks the row, so
-- the log keeps what was tried. Readable and writable by the roles that see a job's profit: has_payroll_access()
-- (a dev, the controller, a pay-approved master). Idempotent.

CREATE TABLE IF NOT EXISTS public.job_charge_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs_ledger(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('day_shape', 'day_off', 'line_pass_through', 'line_off')),
  -- YYYY-MM-DD for a day; the material line's id (the invoice allocation, the tally part or the typed charge) for a line.
  target text NOT NULL,
  shape text CHECK (shape IS NULL OR shape IN ('master_helper', 'two_techs', 'master_alone', 'tech_alone', 'two_helpers', 'helper_alone')),
  reason text NOT NULL DEFAULT '',
  made_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  reverted_at timestamptz,
  reverted_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  CONSTRAINT job_charge_adjustments_shape_when_day_shape CHECK (kind <> 'day_shape' OR shape IS NOT NULL)
);
COMMENT ON TABLE public.job_charge_adjustments IS
  'Punch list #254: the office''s adjustments on a job''s charges (a day''s crew shape, a day or a material line left off, a line passed through at cost), with the reason and who made it; reverted rows keep the log. Never a change to a clock session or an invoice.';

CREATE INDEX IF NOT EXISTS job_charge_adjustments_job_idx ON public.job_charge_adjustments (job_id) WHERE reverted_at IS NULL;

ALTER TABLE public.job_charge_adjustments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS job_charge_adjustments_select ON public.job_charge_adjustments;
CREATE POLICY job_charge_adjustments_select ON public.job_charge_adjustments
  FOR SELECT TO authenticated USING (public.has_payroll_access());

DROP POLICY IF EXISTS job_charge_adjustments_insert ON public.job_charge_adjustments;
CREATE POLICY job_charge_adjustments_insert ON public.job_charge_adjustments
  FOR INSERT TO authenticated WITH CHECK (public.has_payroll_access() AND made_by = auth.uid());

-- Only the revert stamp changes after a row is written: the log is append-only in meaning.
DROP POLICY IF EXISTS job_charge_adjustments_update ON public.job_charge_adjustments;
CREATE POLICY job_charge_adjustments_update ON public.job_charge_adjustments
  FOR UPDATE TO authenticated USING (public.has_payroll_access()) WITH CHECK (public.has_payroll_access());

REVOKE ALL ON public.job_charge_adjustments FROM anon;
GRANT SELECT, INSERT, UPDATE ON public.job_charge_adjustments TO authenticated;

SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
