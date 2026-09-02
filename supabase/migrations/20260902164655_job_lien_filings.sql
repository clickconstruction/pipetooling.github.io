SET lock_timeout = '3s';

-- Lien filings (v2.2645, Lien Instruments phases 3+4): one row per statutory
-- instrument generated from the Lien instruments modal — the § 53.056 notice
-- of claim (with its per-recipient certified sends), the § 53.054 lien
-- affidavit (filed at the County Clerk; serve-by stamped per § 53.055), and
-- the release of a recorded lien. `fields` snapshots the rendered document;
-- `sends` is a small jsonb array of {recipient, method, tracking, sent_on}
-- (the statute names two recipients — owner AND original contractor — so a
-- join table would be ceremony for a bounded list). Voided, never deleted.

CREATE TABLE IF NOT EXISTS public.job_lien_filings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs_ledger(id) ON DELETE CASCADE,
  kind text NOT NULL
    CONSTRAINT job_lien_filings_kind_check
    CHECK (kind IN ('notice_53_056', 'affidavit', 'release_of_record')),
  invoice_ids uuid[] NOT NULL DEFAULT '{}',
  amount numeric(12,2) NOT NULL CHECK (amount >= 0),
  -- 'YYYY-MM' furnishing months the office says this notice covers (notices only).
  months_covered text[] NOT NULL DEFAULT '{}',
  fields jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- [{recipient: 'owner'|'original_contractor'|text, method, tracking, sent_on}]
  sends jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- Affidavit lifecycle (kind = 'affidavit'); release_of_record references the
  -- filed instrument via fields + recording_number.
  filed_at date,
  county text NOT NULL DEFAULT '',
  recording_number text NOT NULL DEFAULT '',
  serve_due date,
  served_at date,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  voided_at timestamptz
);

COMMENT ON TABLE public.job_lien_filings IS
  'Statutory lien instruments from the Lien instruments modal (v2.2645): § 53.056 notices (per-recipient sends jsonb), § 53.054 affidavits (filed_at/county/recording_number; serve_due = 5th day per § 53.055), and releases of recorded liens. fields snapshots the rendered document; voided_at hides mistakes without destroying the trail.';

CREATE INDEX IF NOT EXISTS job_lien_filings_job_id_idx ON public.job_lien_filings (job_id);
CREATE INDEX IF NOT EXISTS job_lien_filings_serve_watch_idx
  ON public.job_lien_filings (serve_due)
  WHERE voided_at IS NULL AND kind = 'affidavit' AND filed_at IS NOT NULL AND served_at IS NULL;

ALTER TABLE public.job_lien_filings ENABLE ROW LEVEL SECURITY;

-- Same office set as job_lien_releases / job_demand_letters.
DROP POLICY IF EXISTS job_lien_filings_select_office ON public.job_lien_filings;
CREATE POLICY job_lien_filings_select_office
  ON public.job_lien_filings FOR SELECT TO authenticated
  USING (
    public.is_dev()
    OR public.is_assistant()
    OR EXISTS (
      SELECT 1 FROM public.jobs_ledger jl
      WHERE jl.id = job_id AND jl.master_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS job_lien_filings_insert_office ON public.job_lien_filings;
CREATE POLICY job_lien_filings_insert_office
  ON public.job_lien_filings FOR INSERT TO authenticated
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

DROP POLICY IF EXISTS job_lien_filings_update_office ON public.job_lien_filings;
CREATE POLICY job_lien_filings_update_office
  ON public.job_lien_filings FOR UPDATE TO authenticated
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

DROP POLICY IF EXISTS job_lien_filings_delete_dev ON public.job_lien_filings;
CREATE POLICY job_lien_filings_delete_dev
  ON public.job_lien_filings FOR DELETE TO authenticated
  USING (public.is_dev());

SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
