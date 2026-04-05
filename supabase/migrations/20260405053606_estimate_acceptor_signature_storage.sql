-- Acceptor drawn signature: Storage path on estimates + private bucket + read policy aligned with estimates_select.

ALTER TABLE public.estimates
  ADD COLUMN IF NOT EXISTS acceptor_signature_storage_path text null;

COMMENT ON COLUMN public.estimates.acceptor_signature_storage_path IS
  'Relative path in bucket estimate-acceptor-signatures (estimate_id/filename.png) when customer accepts by drawing; null for typed-name only.';

-- Freeze column after accept (same guard as other acceptor fields)
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
    THEN
      RAISE EXCEPTION 'estimate is accepted; only job_ledger_id and internal_notes can change';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'estimate-acceptor-signatures',
  'estimate-acceptor-signatures',
  false,
  524288,
  ARRAY['image/png']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Staff read: first path segment must be estimates.id; access mirrors public.estimates_select.
CREATE POLICY "estimate_acceptor_signatures_select"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'estimate-acceptor-signatures'
  AND EXISTS (
    SELECT 1
    FROM public.estimates e
    WHERE e.id::text = split_part(name, '/', 1)
      AND EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid()
          AND role IN (
            'dev',
            'master_technician',
            'assistant',
            'estimator',
            'primary',
            'superintendent'
          )
      )
      AND (
        public.user_can_access_estimate(e)
        OR public.superintendent_can_access_estimate(e)
        OR EXISTS (
          SELECT 1 FROM public.users
          WHERE id = auth.uid()
            AND role IN (
              'dev',
              'assistant',
              'estimator',
              'master_technician',
              'primary'
            )
        )
      )
  )
);
