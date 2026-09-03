SET lock_timeout = '3s';

-- Contract Desk, PR 1 of the job-contract signing loop (owner-approved
-- "Contract Desk" proposal, 2026-09-03): every job carries a customer-signed
-- agreement. This migration lays the schema; the office modal + send function
-- (PR 2), the public signing page + sign function (PR 3), and the backlog
-- sweep (PR 4) build on it.
--
-- Model (mirrors job_lien_releases, the codebase's one-table-per-document-
-- family rule): one live contract per job (draft or sent), signed rows keep
-- the frozen document + the e-signature audit, voided rows keep the trail.
-- The customer side goes through service-role edge functions only (token
-- link, hashed at rest like estimates.public_token_hash). Storage bucket +
-- policies are created OUT-OF-BAND (docs/migrations/20260903141146_job_contracts.md).
-- Idempotent; additive.

-- 1) job_contracts ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.job_contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs_ledger(id) ON DELETE CASCADE,
  -- draft (autosaved, editable) → sent (token minted, fields locked) → signed;
  -- voided is terminal (Void & redo supersedes with a fresh draft on the SAME link).
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'signed', 'voided')),
  revision integer NOT NULL DEFAULT 1 CHECK (revision >= 1),
  -- Contract Book document (contract_template_documents, audience = 'customer') the terms came from.
  template_document_id uuid REFERENCES public.contract_template_documents(id) ON DELETE SET NULL,
  template_name text,
  template_version_date date,
  -- { scope_lines: string[], exclusions: string, amount_cents: number|null, payment_terms_key: string,
  --   payment_terms_text: string, start_date: string|null, completion_date: string|null }
  fields jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- Terms body snapshot at send — never re-rendered from the Book afterwards.
  body_html text,
  body_format text NOT NULL DEFAULT 'plain' CHECK (body_format IN ('html', 'plain', 'markdown')),
  recipient_name text,
  recipient_email text,
  recipient_phone text,
  cc_emails text[] NOT NULL DEFAULT '{}',
  -- The durable link. Raw token lives only in the email / clipboard; resend refreshes expiry.
  public_token_hash text,
  public_token_expires_at timestamptz,
  sent_at timestamptz,
  last_sent_at timestamptz,
  send_count integer NOT NULL DEFAULT 0,
  first_viewed_at timestamptz,
  last_viewed_at timestamptz,
  view_count integer NOT NULL DEFAULT 0,
  reminders_enabled boolean NOT NULL DEFAULT true,
  reminder_count integer NOT NULL DEFAULT 0,
  next_reminder_at timestamptz,
  minted_pdf_path text,
  -- Signature (e-sign audit block, same shape as estimates.acceptor_* / person_contract_documents.signer_*).
  signed_at timestamptz,
  signer_printed_name text,
  signer_mode text CHECK (signer_mode IS NULL OR signer_mode IN ('type', 'draw', 'in_person', 'paper')),
  signer_consented_at timestamptz,
  signer_ip text,
  signer_user_agent text,
  signer_signature_storage_path text,
  signed_pdf_path text,
  -- "Upload signed copy": a scan/photo of paper signed outside the app.
  paper_upload_path text,
  paper_signed_on date,
  recorded_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  voided_at timestamptz,
  voided_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  void_reason text,
  superseded_by uuid REFERENCES public.job_contracts(id) ON DELETE SET NULL,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.job_contracts IS
  'Customer-facing job agreements (Contract Desk). One live (draft|sent) row per job; signed rows freeze the document + e-signature audit; voided rows keep the trail. Customer access is via service-role edge functions only.';

CREATE INDEX IF NOT EXISTS job_contracts_job_id_idx ON public.job_contracts (job_id);
-- One live contract per job.
CREATE UNIQUE INDEX IF NOT EXISTS job_contracts_one_live_per_job_idx
  ON public.job_contracts (job_id) WHERE status IN ('draft', 'sent');
-- Token lookup for the public page.
CREATE UNIQUE INDEX IF NOT EXISTS job_contracts_public_token_hash_idx
  ON public.job_contracts (public_token_hash) WHERE public_token_hash IS NOT NULL;
-- The reminder cron's queue (PR 5).
CREATE INDEX IF NOT EXISTS job_contracts_reminder_due_idx
  ON public.job_contracts (next_reminder_at) WHERE status = 'sent' AND reminders_enabled;

CREATE OR REPLACE FUNCTION public.job_contracts_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS job_contracts_touch_updated_at_u ON public.job_contracts;
CREATE TRIGGER job_contracts_touch_updated_at_u
  BEFORE UPDATE ON public.job_contracts
  FOR EACH ROW EXECUTE FUNCTION public.job_contracts_touch_updated_at();

ALTER TABLE public.job_contracts ENABLE ROW LEVEL SECURITY;

-- Same office set that issues lien releases from the board: dev, assistant-like
-- (is_assistant() = assistant + controller), the job's master.
DROP POLICY IF EXISTS job_contracts_select_office ON public.job_contracts;
CREATE POLICY job_contracts_select_office
  ON public.job_contracts FOR SELECT TO authenticated
  USING (
    public.is_dev()
    OR public.is_assistant()
    OR EXISTS (SELECT 1 FROM public.jobs_ledger jl WHERE jl.id = job_id AND jl.master_user_id = auth.uid())
  );

DROP POLICY IF EXISTS job_contracts_insert_office ON public.job_contracts;
CREATE POLICY job_contracts_insert_office
  ON public.job_contracts FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND (
      public.is_dev()
      OR public.is_assistant()
      OR EXISTS (SELECT 1 FROM public.jobs_ledger jl WHERE jl.id = job_id AND jl.master_user_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS job_contracts_update_office ON public.job_contracts;
CREATE POLICY job_contracts_update_office
  ON public.job_contracts FOR UPDATE TO authenticated
  USING (
    public.is_dev()
    OR public.is_assistant()
    OR EXISTS (SELECT 1 FROM public.jobs_ledger jl WHERE jl.id = job_id AND jl.master_user_id = auth.uid())
  )
  WITH CHECK (
    public.is_dev()
    OR public.is_assistant()
    OR EXISTS (SELECT 1 FROM public.jobs_ledger jl WHERE jl.id = job_id AND jl.master_user_id = auth.uid())
  );

DROP POLICY IF EXISTS job_contracts_delete_dev ON public.job_contracts;
CREATE POLICY job_contracts_delete_dev
  ON public.job_contracts FOR DELETE TO authenticated
  USING (public.is_dev());

-- 2) job_contract_events (room-style telemetry; the customer side writes via service role)

CREATE TABLE IF NOT EXISTS public.job_contract_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES public.job_contracts(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('sent', 'viewed', 'reminded', 'signed', 'voided', 'recorded')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  client_ip text,
  user_agent text,
  actor_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS job_contract_events_contract_id_idx
  ON public.job_contract_events (contract_id, occurred_at);

ALTER TABLE public.job_contract_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS job_contract_events_select_office ON public.job_contract_events;
CREATE POLICY job_contract_events_select_office
  ON public.job_contract_events FOR SELECT TO authenticated
  USING (
    public.is_dev()
    OR public.is_assistant()
    OR EXISTS (
      SELECT 1 FROM public.job_contracts c
      JOIN public.jobs_ledger jl ON jl.id = c.job_id
      WHERE c.id = contract_id AND jl.master_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS job_contract_events_insert_office ON public.job_contract_events;
CREATE POLICY job_contract_events_insert_office
  ON public.job_contract_events FOR INSERT TO authenticated
  WITH CHECK (
    public.is_dev()
    OR public.is_assistant()
    OR EXISTS (
      SELECT 1 FROM public.job_contracts c
      JOIN public.jobs_ledger jl ON jl.id = c.job_id
      WHERE c.id = contract_id AND jl.master_user_id = auth.uid()
    )
  );

-- 3) Contract Book audience: staff packets vs customer contract templates never mix.

ALTER TABLE public.contract_template_documents
  ADD COLUMN IF NOT EXISTS audience text NOT NULL DEFAULT 'staff';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'contract_template_documents_audience_check') THEN
    ALTER TABLE public.contract_template_documents
      ADD CONSTRAINT contract_template_documents_audience_check
      CHECK (audience IN ('staff', 'customer'));
  END IF;
END $$;

COMMENT ON COLUMN public.contract_template_documents.audience IS
  'staff = People → Contracts packets (default); customer = job-contract templates (Contract Desk). Kept in one library so the Book editor is shared.';

-- 4) Activity ledger writer — the job's feed reads sent / first view / signed / voided.
-- Idempotency-guarded per (event_type, detail->>'source_id') like every bridge trigger;
-- re-sends key by timestamp so each send logs. All contract events are financial.

CREATE OR REPLACE FUNCTION public.job_contracts_to_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sid text;
  v_amount text;
  v_doc text;
BEGIN
  v_doc := coalesce(nullif(trim(NEW.template_name), ''), 'Contract');
  v_amount := CASE
    WHEN (NEW.fields ->> 'amount_cents') ~ '^-?[0-9]+$'
      THEN ' — $' || trim(to_char(((NEW.fields ->> 'amount_cents')::bigint)::numeric / 100, 'FM999,999,990.00'))
    ELSE '' END;

  -- Sent (every send logs; the row's last_sent_at moves per send).
  IF NEW.last_sent_at IS NOT NULL
     AND (TG_OP = 'INSERT' OR OLD.last_sent_at IS DISTINCT FROM NEW.last_sent_at) THEN
    v_sid := NEW.id::text || ':sent:' || extract(epoch FROM NEW.last_sent_at)::bigint::text;
    INSERT INTO public.job_activity_events (job_id, event_type, occurred_at, actor_user_id, summary, detail, financial)
    SELECT NEW.job_id, 'contract_sent', NEW.last_sent_at, NEW.created_by,
      CASE WHEN NEW.send_count > 1 THEN 'Contract re-sent to ' ELSE 'Contract sent to ' END
        || coalesce(nullif(trim(NEW.recipient_email), ''), 'customer') || ' — ' || v_doc || v_amount,
      jsonb_build_object('source_id', v_sid, 'contract_id', NEW.id::text, 'revision', NEW.revision, 'send_count', NEW.send_count),
      true
    WHERE NOT EXISTS (
      SELECT 1 FROM public.job_activity_events e
      WHERE e.event_type = 'contract_sent' AND e.detail ->> 'source_id' = v_sid
    );
  END IF;

  -- First view by the customer.
  IF NEW.first_viewed_at IS NOT NULL AND (TG_OP = 'INSERT' OR OLD.first_viewed_at IS NULL) THEN
    INSERT INTO public.job_activity_events (job_id, event_type, occurred_at, actor_user_id, summary, detail, financial)
    SELECT NEW.job_id, 'contract_viewed', NEW.first_viewed_at, NULL,
      'Contract opened by the customer',
      jsonb_build_object('source_id', NEW.id::text, 'contract_id', NEW.id::text),
      true
    WHERE NOT EXISTS (
      SELECT 1 FROM public.job_activity_events e
      WHERE e.event_type = 'contract_viewed' AND e.detail ->> 'source_id' = NEW.id::text
    );
  END IF;

  -- Signed (online) or recorded (paper upload) — both land as contract_signed.
  IF NEW.signed_at IS NOT NULL AND (TG_OP = 'INSERT' OR OLD.signed_at IS NULL) THEN
    INSERT INTO public.job_activity_events (job_id, event_type, occurred_at, actor_user_id, summary, detail, financial)
    SELECT NEW.job_id, 'contract_signed', NEW.signed_at, NEW.recorded_by,
      CASE WHEN NEW.signer_mode = 'paper'
        THEN 'Signed contract on file (paper) — ' || v_doc || v_amount
        ELSE 'Contract signed by ' || coalesce(nullif(trim(NEW.signer_printed_name), ''), 'the customer') || ' — ' || v_doc || v_amount END,
      jsonb_build_object('source_id', NEW.id::text, 'contract_id', NEW.id::text, 'signer_mode', NEW.signer_mode),
      true
    WHERE NOT EXISTS (
      SELECT 1 FROM public.job_activity_events e
      WHERE e.event_type = 'contract_signed' AND e.detail ->> 'source_id' = NEW.id::text
    );
  END IF;

  -- Voided.
  IF TG_OP = 'UPDATE' AND NEW.voided_at IS NOT NULL AND OLD.voided_at IS NULL THEN
    INSERT INTO public.job_activity_events (job_id, event_type, occurred_at, actor_user_id, summary, detail, financial)
    SELECT NEW.job_id, 'contract_voided', NEW.voided_at, NEW.voided_by,
      'Contract voided — ' || v_doc || coalesce(' · ' || nullif(trim(NEW.void_reason), ''), ''),
      jsonb_build_object('source_id', NEW.id::text, 'contract_id', NEW.id::text),
      true
    WHERE NOT EXISTS (
      SELECT 1 FROM public.job_activity_events e
      WHERE e.event_type = 'contract_voided' AND e.detail ->> 'source_id' = NEW.id::text
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS job_contracts_to_activity_iud ON public.job_contracts;
CREATE TRIGGER job_contracts_to_activity_iud
  AFTER INSERT OR UPDATE ON public.job_contracts
  FOR EACH ROW EXECUTE FUNCTION public.job_contracts_to_activity();

-- House rules: read-only training mode + the digital-twin write fence cover every new table.
SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
