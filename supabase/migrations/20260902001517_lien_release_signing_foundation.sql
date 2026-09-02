SET lock_timeout = '3s';

-- Lien-release signing loop, PR 1 of 4 (v2.2616; owner-approved mockups).
-- job_lien_releases grows the full document lifecycle the owner asked for:
--   draft (autosaved, editable) → issued (snapshot locked = "minted" into
--   Documents) → awaiting_signature → signed → sent — plus stored-PDF paths
--   so "View" can serve the exact bytes that existed at mint and at signing.
-- Also: job_activity_events triggers so every lifecycle step reads on the
-- job's activity feed (client registry lands in PR 3 — events written now
-- are forward-compatible and simply don't render until then).
--
-- NOTE (storage): the private 'lien-release-documents' bucket and its
-- storage.objects policies are created OUT-OF-BAND, matching hr-files /
-- contract-signer-signatures (storage schema objects are not tracked by this
-- ledger). Exact bucket + policy SQL: docs/migrations/20260902001517_lien_release_signing_foundation.md.
-- Idempotent; additive — existing rows read as status 'issued'.

-- 1) Lifecycle + signature + document columns -------------------------------

ALTER TABLE public.job_lien_releases
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'issued',
  ADD COLUMN IF NOT EXISTS minted_at timestamptz,
  ADD COLUMN IF NOT EXISTS minted_pdf_path text,
  ADD COLUMN IF NOT EXISTS signature_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS signature_requested_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS signer_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS signed_at timestamptz,
  ADD COLUMN IF NOT EXISTS signer_printed_name text,
  ADD COLUMN IF NOT EXISTS signer_signature_mode text,
  ADD COLUMN IF NOT EXISTS signer_signature_storage_path text,
  ADD COLUMN IF NOT EXISTS signer_consented_at timestamptz,
  ADD COLUMN IF NOT EXISTS signed_pdf_path text,
  ADD COLUMN IF NOT EXISTS sent_to_customer_at timestamptz,
  ADD COLUMN IF NOT EXISTS sent_channel text,
  ADD COLUMN IF NOT EXISTS sent_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS voided_by uuid REFERENCES public.users(id) ON DELETE SET NULL;

-- CHECK constraints (ADD CONSTRAINT has no IF NOT EXISTS — guard via catalog).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'job_lien_releases_status_check') THEN
    ALTER TABLE public.job_lien_releases
      ADD CONSTRAINT job_lien_releases_status_check
      CHECK (status IN ('draft', 'issued', 'awaiting_signature', 'signed'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'job_lien_releases_signature_mode_check') THEN
    ALTER TABLE public.job_lien_releases
      ADD CONSTRAINT job_lien_releases_signature_mode_check
      CHECK (signer_signature_mode IS NULL OR signer_signature_mode IN ('type', 'draw'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'job_lien_releases_sent_channel_check') THEN
    ALTER TABLE public.job_lien_releases
      ADD CONSTRAINT job_lien_releases_sent_channel_check
      CHECK (sent_channel IS NULL OR sent_channel IN ('email', 'manual'));
  END IF;
END $$;

COMMENT ON COLUMN public.job_lien_releases.status IS
  'draft (autosaved, editable) → issued (snapshot locked/minted) → awaiting_signature → signed. sent is orthogonal (sent_to_customer_at); voided_at is orthogonal.';

-- Existing rows were minted the moment they were recorded.
UPDATE public.job_lien_releases SET minted_at = created_at WHERE minted_at IS NULL AND status <> 'draft';

-- Inbox lanes: the signer's "awaiting your signature" and the requester's
-- "signed — ready to send".
CREATE INDEX IF NOT EXISTS job_lien_releases_awaiting_signer_idx
  ON public.job_lien_releases (signer_user_id)
  WHERE status = 'awaiting_signature' AND voided_at IS NULL;
CREATE INDEX IF NOT EXISTS job_lien_releases_ready_to_send_idx
  ON public.job_lien_releases (signature_requested_by)
  WHERE status = 'signed' AND sent_to_customer_at IS NULL AND voided_at IS NULL;

-- 2) Activity ledger writer --------------------------------------------------
-- One writer for the whole lifecycle, idempotency-guarded per event type on
-- (event_type, detail->>'source_id') like every other bridge trigger.
-- Re-requests and re-sends key their source_id by timestamp so a canceled
-- request followed by a new one still logs. All lien events are financial.

CREATE OR REPLACE FUNCTION public.job_lien_releases_to_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_label text;
  v_amount text;
  v_sid text;
BEGIN
  v_label := CASE NEW.form_type
    WHEN 'conditional_progress' THEN 'Conditional · progress'
    WHEN 'unconditional_progress' THEN 'Unconditional · progress'
    ELSE 'Unconditional · final'
  END;
  v_amount := '$' || trim(to_char(NEW.amount, 'FM999,999,990.00'));

  -- Issued (minted): the first time the row exists past 'draft'.
  IF NEW.status <> 'draft' AND (TG_OP = 'INSERT' OR OLD.status = 'draft') THEN
    INSERT INTO public.job_activity_events (job_id, event_type, occurred_at, actor_user_id, summary, detail, financial)
    SELECT NEW.job_id, 'lien_release_issued', coalesce(NEW.minted_at, now()), NEW.created_by,
      'Release of lien issued — ' || v_label || ' ' || v_amount,
      jsonb_build_object('source_id', NEW.id::text, 'form_type', NEW.form_type, 'amount', NEW.amount),
      true
    WHERE NOT EXISTS (
      SELECT 1 FROM public.job_activity_events e
      WHERE e.event_type = 'lien_release_issued' AND e.detail ->> 'source_id' = NEW.id::text
    );
  END IF;

  -- Signature requested (re-requests get fresh source_ids).
  IF NEW.signature_requested_at IS NOT NULL
     AND (TG_OP = 'INSERT' OR OLD.signature_requested_at IS DISTINCT FROM NEW.signature_requested_at) THEN
    v_sid := NEW.id::text || ':req:' || extract(epoch FROM NEW.signature_requested_at)::bigint::text;
    INSERT INTO public.job_activity_events (job_id, event_type, occurred_at, actor_user_id, summary, detail, financial)
    SELECT NEW.job_id, 'lien_release_signature_requested', NEW.signature_requested_at, NEW.signature_requested_by,
      'Signature requested — ' || v_label || ' ' || v_amount,
      jsonb_build_object('source_id', v_sid, 'release_id', NEW.id::text, 'form_type', NEW.form_type),
      true
    WHERE NOT EXISTS (
      SELECT 1 FROM public.job_activity_events e
      WHERE e.event_type = 'lien_release_signature_requested' AND e.detail ->> 'source_id' = v_sid
    );
  END IF;

  -- Signed.
  IF NEW.signed_at IS NOT NULL AND (TG_OP = 'INSERT' OR OLD.signed_at IS NULL) THEN
    INSERT INTO public.job_activity_events (job_id, event_type, occurred_at, actor_user_id, summary, detail, financial)
    SELECT NEW.job_id, 'lien_release_signed', NEW.signed_at, NEW.signer_user_id,
      'Release of lien signed by ' || coalesce(nullif(trim(NEW.signer_printed_name), ''), 'the signer'),
      jsonb_build_object('source_id', NEW.id::text, 'release_id', NEW.id::text, 'form_type', NEW.form_type),
      true
    WHERE NOT EXISTS (
      SELECT 1 FROM public.job_activity_events e
      WHERE e.event_type = 'lien_release_signed' AND e.detail ->> 'source_id' = NEW.id::text
    );
  END IF;

  -- Sent to customer (re-sends get fresh source_ids).
  IF NEW.sent_to_customer_at IS NOT NULL
     AND (TG_OP = 'INSERT' OR OLD.sent_to_customer_at IS DISTINCT FROM NEW.sent_to_customer_at) THEN
    v_sid := NEW.id::text || ':sent:' || extract(epoch FROM NEW.sent_to_customer_at)::bigint::text;
    INSERT INTO public.job_activity_events (job_id, event_type, occurred_at, actor_user_id, summary, detail, financial)
    SELECT NEW.job_id, 'lien_release_sent', NEW.sent_to_customer_at, NEW.sent_by,
      CASE WHEN NEW.sent_channel = 'email'
        THEN 'Signed release emailed to customer — PDF attached'
        ELSE 'Release marked sent to customer' END,
      jsonb_build_object('source_id', v_sid, 'release_id', NEW.id::text, 'channel', NEW.sent_channel),
      true
    WHERE NOT EXISTS (
      SELECT 1 FROM public.job_activity_events e
      WHERE e.event_type = 'lien_release_sent' AND e.detail ->> 'source_id' = v_sid
    );
  END IF;

  -- Voided.
  IF TG_OP = 'UPDATE' AND NEW.voided_at IS NOT NULL AND OLD.voided_at IS NULL THEN
    INSERT INTO public.job_activity_events (job_id, event_type, occurred_at, actor_user_id, summary, detail, financial)
    SELECT NEW.job_id, 'lien_release_voided', NEW.voided_at, NEW.voided_by,
      'Release of lien voided — ' || v_label || ' ' || v_amount,
      jsonb_build_object('source_id', NEW.id::text, 'release_id', NEW.id::text, 'form_type', NEW.form_type),
      true
    WHERE NOT EXISTS (
      SELECT 1 FROM public.job_activity_events e
      WHERE e.event_type = 'lien_release_voided' AND e.detail ->> 'source_id' = NEW.id::text
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS job_lien_releases_to_activity_iud ON public.job_lien_releases;
CREATE TRIGGER job_lien_releases_to_activity_iud
  AFTER INSERT OR UPDATE ON public.job_lien_releases
  FOR EACH ROW EXECUTE FUNCTION public.job_lien_releases_to_activity();

-- 3) Backfill: existing releases were issued (and possibly voided) before the
-- ledger knew about them. Guarded on the same (event_type, source_id) pairs.

INSERT INTO public.job_activity_events (job_id, event_type, occurred_at, actor_user_id, summary, detail, financial)
SELECT r.job_id, 'lien_release_issued', r.created_at, r.created_by,
  'Release of lien issued — '
    || CASE r.form_type
         WHEN 'conditional_progress' THEN 'Conditional · progress'
         WHEN 'unconditional_progress' THEN 'Unconditional · progress'
         ELSE 'Unconditional · final' END
    || ' $' || trim(to_char(r.amount, 'FM999,999,990.00')),
  jsonb_build_object('source_id', r.id::text, 'form_type', r.form_type, 'amount', r.amount),
  true
FROM public.job_lien_releases r
WHERE r.status <> 'draft'
  AND NOT EXISTS (
    SELECT 1 FROM public.job_activity_events e
    WHERE e.event_type = 'lien_release_issued' AND e.detail ->> 'source_id' = r.id::text
  );

INSERT INTO public.job_activity_events (job_id, event_type, occurred_at, actor_user_id, summary, detail, financial)
SELECT r.job_id, 'lien_release_voided', r.voided_at, r.voided_by,
  'Release of lien voided — '
    || CASE r.form_type
         WHEN 'conditional_progress' THEN 'Conditional · progress'
         WHEN 'unconditional_progress' THEN 'Unconditional · progress'
         ELSE 'Unconditional · final' END
    || ' $' || trim(to_char(r.amount, 'FM999,999,990.00')),
  jsonb_build_object('source_id', r.id::text, 'release_id', r.id::text, 'form_type', r.form_type),
  true
FROM public.job_lien_releases r
WHERE r.voided_at IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.job_activity_events e
    WHERE e.event_type = 'lien_release_voided' AND e.detail ->> 'source_id' = r.id::text
  );

SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
