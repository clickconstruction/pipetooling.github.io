SET lock_timeout = '3s';

-- Lien desk (v2.3682): the claim, corrected by hand. One row per job — the amount the
-- office takes off the app's unpaid balance for the § 53.056 notice (negative = the
-- notice claims more than the app says is owed; the leader alone may send that),
-- an optional per-month split the paper prints, the reason, who and when, whether it
-- carries to later notices and the affidavit, and when someone last said "still
-- true". The app's balance is never touched: Billing and Collections keep chasing it.
CREATE TABLE IF NOT EXISTS public.job_lien_claim_corrections (
  job_id uuid PRIMARY KEY REFERENCES public.jobs_ledger(id) ON DELETE CASCADE,
  amount_off numeric NOT NULL,
  per_month jsonb,
  reason text NOT NULL,
  carry boolean NOT NULL DEFAULT true,
  set_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  set_by_name text NOT NULL DEFAULT '',
  set_at timestamptz NOT NULL DEFAULT now(),
  looked_at timestamptz,
  looked_by_name text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT job_lien_claim_corrections_reason_check CHECK (btrim(reason) <> '')
);

COMMENT ON TABLE public.job_lien_claim_corrections IS
  'Lien desk (v2.3682): the claim set by hand per job — amount_off the app''s unpaid balance (negative = over it; leader-only send), an optional per-month split, the required reason, who/when, whether it carries to later notices and the affidavit, and the last "still true". Never changes the ledger.';

ALTER TABLE public.job_lien_claim_corrections ENABLE ROW LEVEL SECURITY;

-- The office set (dev, assistant-like, the master) — the desk's own roles. The office may clear its own correction (delete).
DROP POLICY IF EXISTS job_lien_claim_corrections_select_office ON public.job_lien_claim_corrections;
CREATE POLICY job_lien_claim_corrections_select_office
  ON public.job_lien_claim_corrections FOR SELECT TO authenticated
  USING (
    public.is_dev()
    OR public.is_assistant()
    OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'master_technician')
  );

DROP POLICY IF EXISTS job_lien_claim_corrections_insert_office ON public.job_lien_claim_corrections;
CREATE POLICY job_lien_claim_corrections_insert_office
  ON public.job_lien_claim_corrections FOR INSERT TO authenticated
  WITH CHECK (
    public.is_dev()
    OR public.is_assistant()
    OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'master_technician')
  );

DROP POLICY IF EXISTS job_lien_claim_corrections_update_office ON public.job_lien_claim_corrections;
CREATE POLICY job_lien_claim_corrections_update_office
  ON public.job_lien_claim_corrections FOR UPDATE TO authenticated
  USING (
    public.is_dev()
    OR public.is_assistant()
    OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'master_technician')
  );

DROP POLICY IF EXISTS job_lien_claim_corrections_delete_office ON public.job_lien_claim_corrections;
CREATE POLICY job_lien_claim_corrections_delete_office
  ON public.job_lien_claim_corrections FOR DELETE TO authenticated
  USING (
    public.is_dev()
    OR public.is_assistant()
    OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'master_technician')
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.job_lien_claim_corrections TO authenticated;

SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
