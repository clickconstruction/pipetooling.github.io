SET lock_timeout = '3s';

-- Final demand letters (v2.2640, Lien Instruments phase 2): one row per demand
-- letter generated and SENT from the Lien instruments modal — the rendered
-- snapshot, the recipient, how it physically went out (certified mail /
-- traceable courier / email / hand), the tracking number that proves it, and
-- the payment deadline the letter names. The deadline drives the Needs You
-- watch ("deadline passed unpaid — next step: the lien"). Mistaken records are
-- voided, never deleted. Additive; idempotent; no CREATE TABLE elsewhere.

CREATE TABLE IF NOT EXISTS public.job_demand_letters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs_ledger(id) ON DELETE CASCADE,
  -- Bill lines the demand covers (jobs_ledger_invoices ids) — snapshot used
  -- by the deadline watch to decide "still unpaid".
  invoice_ids uuid[] NOT NULL DEFAULT '{}',
  amount numeric(12,2) NOT NULL CHECK (amount >= 0),
  deadline_date date,
  -- Full rendered-fields snapshot (src/lib/jobsDocuments/demandLetter.ts).
  fields jsonb NOT NULL DEFAULT '{}'::jsonb,
  recipient_name text NOT NULL DEFAULT '',
  recipient_email text NOT NULL DEFAULT '',
  recipient_address text NOT NULL DEFAULT '',
  sent_method text NOT NULL DEFAULT ''
    CONSTRAINT job_demand_letters_sent_method_check
    CHECK (sent_method IN ('', 'certified_mail', 'traceable_courier', 'email', 'hand')),
  tracking_number text NOT NULL DEFAULT '',
  sent_at date,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  voided_at timestamptz
);

COMMENT ON TABLE public.job_demand_letters IS
  'Final demand letters generated + sent from the Lien instruments modal (v2.2640). fields snapshots the rendered letter; deadline_date arms the Needs You watch; voided_at hides a withdrawn letter without destroying the trail.';

CREATE INDEX IF NOT EXISTS job_demand_letters_job_id_idx ON public.job_demand_letters (job_id);
CREATE INDEX IF NOT EXISTS job_demand_letters_deadline_idx
  ON public.job_demand_letters (deadline_date)
  WHERE voided_at IS NULL AND deadline_date IS NOT NULL;

ALTER TABLE public.job_demand_letters ENABLE ROW LEVEL SECURITY;

-- Same office set as job_lien_releases (dev / assistant-like / the job's master).
DROP POLICY IF EXISTS job_demand_letters_select_office ON public.job_demand_letters;
CREATE POLICY job_demand_letters_select_office
  ON public.job_demand_letters FOR SELECT TO authenticated
  USING (
    public.is_dev()
    OR public.is_assistant()
    OR EXISTS (
      SELECT 1 FROM public.jobs_ledger jl
      WHERE jl.id = job_id AND jl.master_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS job_demand_letters_insert_office ON public.job_demand_letters;
CREATE POLICY job_demand_letters_insert_office
  ON public.job_demand_letters FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND (
      public.is_dev()
      OR public.is_assistant()
      OR EXISTS (
        SELECT 1 FROM public.jobs_ledger jl
        WHERE jl.id = job_id AND jl.master_user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS job_demand_letters_update_office ON public.job_demand_letters;
CREATE POLICY job_demand_letters_update_office
  ON public.job_demand_letters FOR UPDATE TO authenticated
  USING (
    public.is_dev()
    OR public.is_assistant()
    OR EXISTS (
      SELECT 1 FROM public.jobs_ledger jl
      WHERE jl.id = job_id AND jl.master_user_id = auth.uid()
    )
  )
  WITH CHECK (
    public.is_dev()
    OR public.is_assistant()
    OR EXISTS (
      SELECT 1 FROM public.jobs_ledger jl
      WHERE jl.id = job_id AND jl.master_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS job_demand_letters_delete_dev ON public.job_demand_letters;
CREATE POLICY job_demand_letters_delete_dev
  ON public.job_demand_letters FOR DELETE TO authenticated
  USING (public.is_dev());

SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
