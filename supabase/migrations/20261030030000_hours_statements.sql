SET lock_timeout = '3s';

-- Signed hours statement (punch list #212, PR 2, v2.6097): the table behind the Hours statement window. One row per
-- paper the office makes for one worker on one job for a period: the record id the paper carries (HS-<job number>-<n>,
-- n counted per job), who and when, the two switches, the stated days the worker adds, the gap before the app's first
-- row, the rows as they were read (the snapshot the paper is printed from again), and where it stands (draft · printed ·
-- sent · signed). PR 3 ties a row to the Contract Form it is signed on (contract_document_id); PR 4 to the copy filed
-- on a legal matter's Evidence tab (matter_document_id). Both stay null until then.
--
-- Who may touch a row (the owner's call 6 of 2026-10-29): the payroll roles — a dev, the controller, a pay-approved
-- master — on every verb, for any row; an assistant on every verb, but only a row with the pay left off
-- (with_pay = false), since the hours-only paper is theirs to make and the pay tables never answer them anyway.

CREATE TABLE IF NOT EXISTS public.hours_statements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id text NOT NULL UNIQUE CHECK (record_id ~ '^HS-' AND length(record_id) <= 60),
  job_ledger_id uuid NOT NULL REFERENCES public.jobs_ledger(id) ON DELETE CASCADE,
  person_id uuid REFERENCES public.people(id) ON DELETE SET NULL,
  user_id uuid NOT NULL REFERENCES public.users(id),
  labor_company text CHECK (length(labor_company) <= 160),
  period_start date NOT NULL,
  period_end date NOT NULL CHECK (period_end >= period_start),
  with_pay boolean NOT NULL DEFAULT true,
  kind text NOT NULL CHECK (kind IN ('clock', 'sheet', 'schedule')),
  stated_days jsonb NOT NULL DEFAULT '[]'::jsonb,
  gap_from date,
  gap_to date,
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  prepared_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  prepared_at timestamptz NOT NULL DEFAULT now(),
  contract_document_id uuid REFERENCES public.person_contract_documents(id) ON DELETE SET NULL,
  matter_document_id uuid REFERENCES public.legal_matter_documents(id) ON DELETE SET NULL,
  state text NOT NULL DEFAULT 'draft' CHECK (state IN ('draft', 'printed', 'sent', 'signed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (gap_from IS NULL OR gap_to IS NULL OR gap_to >= gap_from)
);
CREATE INDEX IF NOT EXISTS hours_statements_job_idx ON public.hours_statements (job_ledger_id, prepared_at DESC);
CREATE INDEX IF NOT EXISTS hours_statements_user_idx ON public.hours_statements (user_id, prepared_at DESC);

COMMENT ON TABLE public.hours_statements IS 'Signed hours statement (#212): one worker''s recorded hours on one job for a period, as the paper they sign. record_id is HS-<job number>-<n>; snapshot holds the kernel''s input as read, so the paper prints again as it was; state is draft, printed, sent (PR 3) or signed (PR 3).';
COMMENT ON COLUMN public.hours_statements.record_id IS 'HS-<job number>-<n>, n counted per job from 0001; printed in the paper''s header and footer.';
COMMENT ON COLUMN public.hours_statements.with_pay IS 'The paper carries the rate, the amount and what was paid. False is the hours-only paper, the only kind an assistant may make.';
COMMENT ON COLUMN public.hours_statements.kind IS 'clock = punches and typed days; sheet = a sub''s sheet lines; schedule = a salaried person''s schedule rows.';
COMMENT ON COLUMN public.hours_statements.stated_days IS 'The days the worker adds, as [{day, hours, note, statedBy}]; the block the paper prints under "days the company''s records do not show" or "days the worker adds".';
COMMENT ON COLUMN public.hours_statements.gap_from IS 'With gap_to, the part of the period before the app''s first recorded day (2026-03-12 live); null when the app recorded the whole period.';
COMMENT ON COLUMN public.hours_statements.snapshot IS 'The window''s read as it stood: the kernel''s input, the worker, the job''s facts, the approver, the preparer and the as-of time. The list prints a row again from it.';
COMMENT ON COLUMN public.hours_statements.contract_document_id IS 'PR 3: the person_contract_documents row the statement is sent for signature on. Null until then.';
COMMENT ON COLUMN public.hours_statements.matter_document_id IS 'PR 4: the legal_matter_documents row the signed copy was filed as on a matter''s Evidence tab. Null until then.';

-- The gate, one function so the four policies read the same line.
CREATE OR REPLACE FUNCTION public.can_touch_hours_statement(p_with_pay boolean)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL AND (
    public.is_dev()
    OR public.has_payroll_access()
    OR (public.is_assistant() AND NOT p_with_pay)
  );
$$;
COMMENT ON FUNCTION public.can_touch_hours_statement(boolean) IS 'Signed hours statement (#212): a dev, the controller or a pay-approved master for any row; an assistant for a row with the pay left off.';

ALTER TABLE public.hours_statements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS hours_statements_select ON public.hours_statements;
CREATE POLICY hours_statements_select ON public.hours_statements FOR SELECT TO authenticated
  USING (public.can_touch_hours_statement(with_pay));
DROP POLICY IF EXISTS hours_statements_insert ON public.hours_statements;
CREATE POLICY hours_statements_insert ON public.hours_statements FOR INSERT TO authenticated
  WITH CHECK (public.can_touch_hours_statement(with_pay));
DROP POLICY IF EXISTS hours_statements_update ON public.hours_statements;
CREATE POLICY hours_statements_update ON public.hours_statements FOR UPDATE TO authenticated
  USING (public.can_touch_hours_statement(with_pay))
  WITH CHECK (public.can_touch_hours_statement(with_pay));
DROP POLICY IF EXISTS hours_statements_delete ON public.hours_statements;
CREATE POLICY hours_statements_delete ON public.hours_statements FOR DELETE TO authenticated
  USING (public.can_touch_hours_statement(with_pay));

-- The consent kind for PR 3's signing, so the ledger of e-sign consents can name a statement.
ALTER TABLE public.esign_consents DROP CONSTRAINT IF EXISTS esign_consents_record_type_check;
ALTER TABLE public.esign_consents
  ADD CONSTRAINT esign_consents_record_type_check
  CHECK (record_type IN ('estimate', 'job_contract', 'person_contract_document', 'step_commitment', 'bid_proposal_room', 'lien_owner_record_request', 'gc_sow', 'gc_draw', 'gc_trade_change', 'hours_statement')) NOT VALID;
ALTER TABLE public.esign_consents VALIDATE CONSTRAINT esign_consents_record_type_check;

-- House rules for every CREATE TABLE: training-mode blocks and the digital-twin fence on the new table.
SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
