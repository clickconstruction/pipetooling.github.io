SET lock_timeout = '3s';

-- The Docsmit train, PR 2 (docs/DOCSMIT_LIEN_RUN_PLAN.md, "The shape → Data"; the kernels are src/lib/mail/, v2.5375):
-- one table for every envelope the company sends certified through a mail provider, whatever sent it. The Lien desk's
-- run is its first user: a § 53.056 notice's owner and original-contractor envelopes go out through Docsmit as US-Letter
-- PDFs, and the USPS number, the acceptance scan (the legal moment a notice is given) and the delivery come back here.
--
--   * mail_pieces: one row per envelope = one provider message. kind says what the envelope is and where its facts land
--     when they come back (a lien notice writes its USPS number into the filing's sends[]); source_ids are the rows
--     behind it (every job_lien_filings row inside the envelope); job_id, when there is one, so the piece's cost and
--     papers land on the job. The address is the one sent, after the provider's CASS check. status is the fold in
--     src/lib/mail/mailPiece.ts; unknown is the needs-a-person bucket for a provider string the fold has not seen.
--     mailed_at is when USPS accepted it; delivered_at and signed_by come from the provider; events is the append-only
--     log of every poll, callback and our own marks, so a piece's timeline is one list. short_code is the per-piece
--     code under the QR on the owner's pay page, never sent to the provider; opened_at is that page's first open.
--   * The office reads and writes a piece as it does a lien filing (is_office_staff, a dev, an assistant, or the master
--     on the piece's job); nobody signed in deletes one. The provider functions (mail-send-docsmit, mail-poll, PR 3)
--     run as the service role.
--   * No new bucket: the mailed PDF and the Certification PDF live in the private lien-release-documents bucket under
--     mail/<piece id>/ (pdf_bucket names it, so a later kind can use another).

CREATE TABLE IF NOT EXISTS public.mail_pieces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- What the envelope is; each kind names where its facts land when they come back.
  kind text NOT NULL
    CONSTRAINT mail_pieces_kind_known CHECK (kind IN (
      'lien_notice_53_056', 'lien_retainage_53_057', 'lien_affidavit_copy', 'demand_31_04', 'lien_release',
      'collections_demand', 'hazmat_notice', 'hr_letter', 'other')),
  -- The rows behind it: every job_lien_filings row inside a lien envelope, a demand letter id, a release id.
  source_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  job_id uuid REFERENCES public.jobs_ledger(id) ON DELETE SET NULL,
  provider text NOT NULL DEFAULT 'docsmit'
    CONSTRAINT mail_pieces_provider_known CHECK (provider IN ('docsmit', 'lob', 'postgrid', 'labels_api')),
  -- Who the envelope is to, in the sender's words: owner, original_contractor, customer, person, ...
  recipient text NOT NULL
    CONSTRAINT mail_pieces_recipient_named CHECK (length(btrim(recipient)) BETWEEN 1 AND 60),
  -- The per-piece code under the QR and link on the owner's copy. Never sent to the provider.
  short_code text
    CONSTRAINT mail_pieces_short_code_shape CHECK (short_code IS NULL OR short_code ~ '^[A-Za-z0-9]{6,16}$'),
  -- The address as sent, after CASS (src/lib/mail/mailAddress.ts makes it from the one-line address).
  name text NOT NULL DEFAULT '',
  organization text NOT NULL DEFAULT '',
  address1 text NOT NULL DEFAULT '',
  address2 text NOT NULL DEFAULT '',
  city text NOT NULL DEFAULT '',
  state text NOT NULL DEFAULT ''
    CONSTRAINT mail_pieces_state_two_letters CHECK (state = '' OR state ~ '^[A-Z]{2}$'),
  postal_code text NOT NULL DEFAULT ''
    CONSTRAINT mail_pieces_zip_shape CHECK (postal_code = '' OR postal_code ~ '^[0-9]{5}(-[0-9]{4})?$'),
  -- What was asked for: the provider's send type as it spells it, the envelope, the sheet count.
  send_type text NOT NULL DEFAULT 'Certified, Electronic Return Receipt',
  envelope text
    CONSTRAINT mail_pieces_envelope_known CHECK (envelope IS NULL OR envelope IN ('#10', 'Flat')),
  sheets integer NOT NULL DEFAULT 0
    CONSTRAINT mail_pieces_sheets_counted CHECK (sheets >= 0),
  -- The provider's key and ours (<kind>:<piece id>, src/lib/mail/mailPiece.ts mailClientMsgId).
  provider_message_id text,
  client_msg_id text,
  price numeric(10, 2)
    CONSTRAINT mail_pieces_price_counted CHECK (price IS NULL OR price >= 0),
  status text NOT NULL DEFAULT 'prepared'
    CONSTRAINT mail_pieces_status_known CHECK (status IN (
      'prepared', 'sent', 'mailed', 'in_transit', 'notice_left', 'delivered', 'returned', 'failed', 'unknown')),
  usps_tracking text,
  -- The legal moment: when USPS accepted it. Written to the filing's sends[].sent_on for a lien notice.
  mailed_at timestamptz,
  delivered_at timestamptz,
  signed_by text,
  -- The provider's last status string, as USPS wrote it, and its as-of.
  delivery_status text,
  delivery_as_of timestamptz,
  -- Append-only: every poll or callback payload and our own marks (prepared, sent, pay page opened, call queued).
  events jsonb NOT NULL DEFAULT '[]'::jsonb
    CONSTRAINT mail_pieces_events_list CHECK (jsonb_typeof(events) = 'array'),
  -- First open of the pay page through this piece's short code.
  opened_at timestamptz,
  pdf_bucket text NOT NULL DEFAULT 'lien-release-documents',
  pdf_path text,
  certification_path text,
  -- Why a piece failed or was held, in words for the office.
  problem text,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT mail_pieces_sent_has_provider_id CHECK (status = 'prepared' OR status = 'failed' OR provider_message_id IS NOT NULL),
  CONSTRAINT mail_pieces_delivered_dated CHECK (status <> 'delivered' OR delivered_at IS NOT NULL)
);

COMMENT ON TABLE public.mail_pieces IS
  'Docsmit train (v2.5379): one row per envelope the company sends certified through a mail provider, whatever sent it. kind says what it is and where its facts land; source_ids the rows behind it; the address is as sent after CASS; status is the fold in src/lib/mail/mailPiece.ts (unknown = needs a person); mailed_at is when USPS accepted it, the day a lien notice is given; events is the append-only timeline; short_code is the QR code on the owner''s copy, never sent to the provider.';
COMMENT ON COLUMN public.mail_pieces.mailed_at IS 'When USPS accepted the piece: the legal moment a notice is given. Written to a lien filing''s sends[].sent_on.';
COMMENT ON COLUMN public.mail_pieces.status IS 'prepared → sent → mailed → in_transit → delivered | notice_left | returned | failed | unknown. unknown is a provider string the fold has not seen: a person looks.';
COMMENT ON COLUMN public.mail_pieces.events IS 'Append-only list of {at, kind, ...}: every provider poll or callback payload and our own marks (prepared, sent, opened, call_queued).';

CREATE INDEX IF NOT EXISTS mail_pieces_job ON public.mail_pieces (job_id) WHERE job_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS mail_pieces_open ON public.mail_pieces (status, updated_at)
  WHERE status IN ('sent', 'mailed', 'in_transit', 'notice_left', 'unknown');
CREATE INDEX IF NOT EXISTS mail_pieces_sources ON public.mail_pieces USING gin (source_ids);
CREATE UNIQUE INDEX IF NOT EXISTS mail_pieces_client_msg_id_key ON public.mail_pieces (client_msg_id) WHERE client_msg_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS mail_pieces_provider_message_key ON public.mail_pieces (provider, provider_message_id) WHERE provider_message_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS mail_pieces_short_code_key ON public.mail_pieces (short_code) WHERE short_code IS NOT NULL;

-- updated_at follows every change; created_by is the signed-in user when a person made the row.
CREATE OR REPLACE FUNCTION public.mail_pieces_touch()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.created_by IS NULL THEN
    NEW.created_by := auth.uid();
  END IF;
  NEW.updated_at := clock_timestamp();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS mail_pieces_touch ON public.mail_pieces;
CREATE TRIGGER mail_pieces_touch BEFORE INSERT OR UPDATE ON public.mail_pieces
  FOR EACH ROW EXECUTE FUNCTION public.mail_pieces_touch();

-- The office reads and writes a piece as it does a lien filing; a piece with a job follows that job's master too.
ALTER TABLE public.mail_pieces ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS mail_pieces_select_office ON public.mail_pieces;
CREATE POLICY mail_pieces_select_office ON public.mail_pieces
  FOR SELECT TO authenticated
  USING (public.is_office_staff() OR public.is_dev() OR public.is_assistant()
    OR (job_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.jobs_ledger AS jl WHERE jl.id = job_id AND jl.master_user_id = auth.uid())));

DROP POLICY IF EXISTS mail_pieces_insert_office ON public.mail_pieces;
CREATE POLICY mail_pieces_insert_office ON public.mail_pieces
  FOR INSERT TO authenticated
  WITH CHECK (public.is_office_staff() OR public.is_dev() OR public.is_assistant()
    OR (job_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.jobs_ledger AS jl WHERE jl.id = job_id AND jl.master_user_id = auth.uid())));

DROP POLICY IF EXISTS mail_pieces_update_office ON public.mail_pieces;
CREATE POLICY mail_pieces_update_office ON public.mail_pieces
  FOR UPDATE TO authenticated
  USING (public.is_office_staff() OR public.is_dev() OR public.is_assistant()
    OR (job_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.jobs_ledger AS jl WHERE jl.id = job_id AND jl.master_user_id = auth.uid())))
  WITH CHECK (public.is_office_staff() OR public.is_dev() OR public.is_assistant()
    OR (job_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.jobs_ledger AS jl WHERE jl.id = job_id AND jl.master_user_id = auth.uid())));

REVOKE ALL ON TABLE public.mail_pieces FROM PUBLIC, anon;
REVOKE DELETE, TRUNCATE ON TABLE public.mail_pieces FROM authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.mail_pieces TO authenticated;
GRANT ALL ON TABLE public.mail_pieces TO service_role;
REVOKE EXECUTE ON FUNCTION public.mail_pieces_touch() FROM PUBLIC, anon, authenticated;

-- The mailed PDF and the Certification PDF: mail/<piece id>/ in the private lien-release-documents bucket. The
-- service role writes them; the office reads them through the bucket's existing office policy.

-- House rules: read-only training mode and the twin write fence cover every new table.
SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
