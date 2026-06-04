-- Per-estimate customer copy overrides + snapshot at send; dev defaults in app_settings.

ALTER TABLE public.estimates
  ADD COLUMN IF NOT EXISTS customer_experience_overrides jsonb,
  ADD COLUMN IF NOT EXISTS customer_experience_sent jsonb;

ALTER TABLE public.estimates DROP CONSTRAINT IF EXISTS estimates_customer_experience_overrides_object_chk;

ALTER TABLE public.estimates
  ADD CONSTRAINT estimates_customer_experience_overrides_object_chk
  CHECK (
    customer_experience_overrides IS NULL
    OR jsonb_typeof(customer_experience_overrides) = 'object'
  );

COMMENT ON COLUMN public.estimates.customer_experience_overrides IS
  'Optional per-estimate overrides for email/accept/thank-you/document labels (partial json). Null = use app_settings defaults only.';

COMMENT ON COLUMN public.estimates.customer_experience_sent IS
  'Frozen resolved customer_experience bundle written when estimate is sent; used for public page and thank-you after send.';

INSERT INTO public.app_settings (key, value_text) VALUES
  ('estimate_email_subject_template', 'Estimate: {{title}}'),
  (
    'estimate_email_body_template',
    E'Please review and accept your estimate.\n\nOpen this link:\n{{accept_url}}\n\nThank you.'
  ),
  ('estimate_accept_section_title', 'Accept'),
  (
    'estimate_accept_instructions',
    'Type your full name and confirm you agree to the estimate and terms above.'
  ),
  ('estimate_accept_name_field_label', 'Full name'),
  (
    'estimate_accept_checkbox_label',
    'I have read and agree to this estimate and the terms above.'
  ),
  ('estimate_accept_submit_label', 'Submit acceptance'),
  ('estimate_accept_submitting_label', 'Submitting…'),
  ('estimate_thank_you_title', 'Thank you'),
  (
    'estimate_thank_you_body',
    'Your response has been recorded. The contractor will follow up with you.'
  ),
  ('estimate_doc_title_fallback', 'Estimate'),
  ('estimate_doc_valid_through_prefix', 'Valid through '),
  ('estimate_doc_line_items_heading', 'Line items'),
  ('estimate_doc_terms_heading', 'Terms'),
  ('estimate_doc_total_label', 'Total')
ON CONFLICT (key) DO NOTHING;

-- After customer_accepted, also freeze customer experience json columns
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
      OR NEW.acceptor_consented_at IS DISTINCT FROM OLD.acceptor_consented_at
      OR NEW.acceptor_ip IS DISTINCT FROM OLD.acceptor_ip
      OR NEW.acceptor_user_agent IS DISTINCT FROM OLD.acceptor_user_agent
      OR NEW.estimate_number IS DISTINCT FROM OLD.estimate_number
      OR NEW.customer_experience_overrides IS DISTINCT FROM OLD.customer_experience_overrides
      OR NEW.customer_experience_sent IS DISTINCT FROM OLD.customer_experience_sent
    THEN
      RAISE EXCEPTION 'estimate is accepted; only job_ledger_id and internal_notes can change';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
