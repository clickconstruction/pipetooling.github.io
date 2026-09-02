SET lock_timeout = '3s';

-- Lien releases issued from the Jobs board (v2.2582, phase 2 of the lien
-- tooling proposal): one row per generated waiver-and-release document so the
-- board can show what was issued, the Bill Customer modal can list releases
-- for the job, and the Dashboard can nudge for the unconditional follow-up
-- once the payment behind a conditional release clears. The row is
-- bookkeeping — the legal document is the generated PDF/print/email; `fields`
-- snapshots exactly what was rendered. Idempotent; additive.

CREATE TABLE IF NOT EXISTS public.job_lien_releases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs_ledger(id) ON DELETE CASCADE,
  -- Bill lines the release covers (jobs_ledger_invoices ids). Array, not a
  -- join table: read-only snapshot used for clearance checks and labels.
  invoice_ids uuid[] NOT NULL DEFAULT '{}',
  form_type text NOT NULL CHECK (form_type IN ('conditional_progress', 'unconditional_progress', 'unconditional_final')),
  amount numeric(12,2) NOT NULL CHECK (amount >= 0),
  through_date date,
  signed_date date,
  -- Full LienWaiverFields snapshot as rendered (src/lib/jobsDocuments/lienWaiverRelease.ts).
  fields jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  voided_at timestamptz
);

COMMENT ON TABLE public.job_lien_releases IS
  'Waiver-and-release documents generated from Jobs (LienReleaseModal). fields snapshots the rendered document; voided_at hides a mistaken record without destroying the trail.';

CREATE INDEX IF NOT EXISTS job_lien_releases_job_id_idx ON public.job_lien_releases (job_id);

ALTER TABLE public.job_lien_releases ENABLE ROW LEVEL SECURITY;

-- Same office set that can generate documents from the board (dev /
-- assistant-like via is_assistant() / the job's master).
DROP POLICY IF EXISTS job_lien_releases_select_office ON public.job_lien_releases;
CREATE POLICY job_lien_releases_select_office
  ON public.job_lien_releases FOR SELECT TO authenticated
  USING (
    public.is_dev()
    OR public.is_assistant()
    OR EXISTS (
      SELECT 1 FROM public.jobs_ledger jl
      WHERE jl.id = job_id AND jl.master_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS job_lien_releases_insert_office ON public.job_lien_releases;
CREATE POLICY job_lien_releases_insert_office
  ON public.job_lien_releases FOR INSERT TO authenticated
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

-- Void / correct a mistaken record (same set; deletes reserved for dev).
DROP POLICY IF EXISTS job_lien_releases_update_office ON public.job_lien_releases;
CREATE POLICY job_lien_releases_update_office
  ON public.job_lien_releases FOR UPDATE TO authenticated
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

DROP POLICY IF EXISTS job_lien_releases_delete_dev ON public.job_lien_releases;
CREATE POLICY job_lien_releases_delete_dev
  ON public.job_lien_releases FOR DELETE TO authenticated
  USING (public.is_dev());

SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
