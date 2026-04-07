-- Optional external document link for customer acceptance (e.g. Google Drive PDF).
-- Staff edits customer_attachment_* on draft; customer_attachment_sent is set at first send.

ALTER TABLE public.estimates
  ADD COLUMN IF NOT EXISTS customer_attachment_url text,
  ADD COLUMN IF NOT EXISTS customer_attachment_label text,
  ADD COLUMN IF NOT EXISTS customer_attachment_sent jsonb;

COMMENT ON COLUMN public.estimates.customer_attachment_url IS
  'HTTPS URL to supporting document (staff, draft); copied into customer_attachment_sent when estimate is sent.';

COMMENT ON COLUMN public.estimates.customer_attachment_label IS
  'Optional short label for the supporting document (staff, draft); frozen in customer_attachment_sent at send.';

COMMENT ON COLUMN public.estimates.customer_attachment_sent IS
  'Frozen JSON {"url","label"} at send; public accept page reads this for sent/customer_accepted.';

ALTER TABLE public.estimates
  DROP CONSTRAINT IF EXISTS estimates_customer_attachment_url_valid;

ALTER TABLE public.estimates
  ADD CONSTRAINT estimates_customer_attachment_url_valid CHECK (
    customer_attachment_url IS NULL
    OR (
      length(customer_attachment_url) <= 2048
      AND customer_attachment_url ~ '^https://'
    )
  );

ALTER TABLE public.estimates
  DROP CONSTRAINT IF EXISTS estimates_customer_attachment_label_len;

ALTER TABLE public.estimates
  ADD CONSTRAINT estimates_customer_attachment_label_len CHECK (
    customer_attachment_label IS NULL
    OR length(customer_attachment_label) <= 200
  );

CREATE OR REPLACE FUNCTION public.estimates_protect_after_accept()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.status = 'customer_accepted' THEN
    IF NEW.id IS DISTINCT FROM OLD.id
      OR NEW.created_at IS DISTINCT FROM OLD.created_at
      OR NEW.master_user_id IS DISTINCT FROM OLD.master_user_id
      OR NEW.created_by IS DISTINCT FROM OLD.created_by
      OR NEW.customer_id IS DISTINCT FROM OLD.customer_id
      OR NEW.project_id IS DISTINCT FROM OLD.project_id
      OR NEW.title IS DISTINCT FROM OLD.title
      OR NEW.line_items_snapshot IS DISTINCT FROM OLD.line_items_snapshot
      OR NEW.terms_snapshot IS DISTINCT FROM OLD.terms_snapshot
      OR NEW.total_cents IS DISTINCT FROM OLD.total_cents
      OR NEW.valid_until IS DISTINCT FROM OLD.valid_until
      OR NEW.status IS DISTINCT FROM OLD.status
      OR NEW.sent_at IS DISTINCT FROM OLD.sent_at
      OR NEW.customer_email IS DISTINCT FROM OLD.customer_email
      OR NEW.public_token_hash IS DISTINCT FROM OLD.public_token_hash
      OR NEW.public_token_expires_at IS DISTINCT FROM OLD.public_token_expires_at
      OR NEW.acceptor_printed_name IS DISTINCT FROM OLD.acceptor_printed_name
      OR NEW.acceptor_signature_storage_path IS DISTINCT FROM OLD.acceptor_signature_storage_path
      OR NEW.acceptor_consented_at IS DISTINCT FROM OLD.acceptor_consented_at
      OR NEW.acceptor_ip IS DISTINCT FROM OLD.acceptor_ip
      OR NEW.acceptor_user_agent IS DISTINCT FROM OLD.acceptor_user_agent
      OR NEW.estimate_number IS DISTINCT FROM OLD.estimate_number
      OR NEW.customer_experience_overrides IS DISTINCT FROM OLD.customer_experience_overrides
      OR NEW.customer_experience_sent IS DISTINCT FROM OLD.customer_experience_sent
      OR NEW.customer_attachment_url IS DISTINCT FROM OLD.customer_attachment_url
      OR NEW.customer_attachment_label IS DISTINCT FROM OLD.customer_attachment_label
      OR NEW.customer_attachment_sent IS DISTINCT FROM OLD.customer_attachment_sent
    THEN
      RAISE EXCEPTION 'estimate is accepted; only job_ledger_id and internal_notes can change';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
