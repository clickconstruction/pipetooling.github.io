-- Person contract documents: inline signing body, canonical URL, public token + signer signature (Estimates-style).

ALTER TABLE public.person_contract_documents
  ADD COLUMN IF NOT EXISTS signing_body_html TEXT,
  ADD COLUMN IF NOT EXISTS canonical_document_url TEXT,
  ADD COLUMN IF NOT EXISTS public_token_hash TEXT,
  ADD COLUMN IF NOT EXISTS public_token_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS signer_signature_storage_path TEXT,
  ADD COLUMN IF NOT EXISTS signer_printed_name TEXT,
  ADD COLUMN IF NOT EXISTS signer_ip TEXT,
  ADD COLUMN IF NOT EXISTS signer_user_agent TEXT,
  ADD COLUMN IF NOT EXISTS signer_consented_at TIMESTAMPTZ;

COMMENT ON COLUMN public.person_contract_documents.signing_body_html IS
  'Optional HTML or plain text shown on the public signing page before signature (sanitized client-side).';
COMMENT ON COLUMN public.person_contract_documents.canonical_document_url IS
  'Optional HTTPS URL to authoritative Doc/PDF; shown on signing page. Legacy url used as fallback when this and signing_body_html are empty.';
COMMENT ON COLUMN public.person_contract_documents.public_token_hash IS
  'SHA-256 hex of opaque token for public get/accept (same pattern as estimates.public_token_hash).';
COMMENT ON COLUMN public.person_contract_documents.public_token_expires_at IS
  'Optional expiry for the signing link.';
COMMENT ON COLUMN public.person_contract_documents.signer_signature_storage_path IS
  'Relative path in bucket contract-signer-signatures (person_contract_documents.id/filename.png).';

CREATE UNIQUE INDEX IF NOT EXISTS idx_person_contract_documents_public_token_hash
  ON public.person_contract_documents (public_token_hash)
  WHERE public_token_hash IS NOT NULL;

-- Private bucket for drawn signatures (same size/mime as estimate-acceptor-signatures).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'contract-signer-signatures',
  'contract-signer-signatures',
  false,
  524288,
  ARRAY['image/png']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Staff read: first path segment must match person_contract_documents.id; same org roles as contract tables.
CREATE POLICY "contract_signer_signatures_select"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'contract-signer-signatures'
  AND EXISTS (
    SELECT 1
    FROM public.person_contract_documents pcd
    WHERE pcd.id::text = split_part(name, '/', 1)
      AND (
        public.is_dev()
        OR public.is_pay_approved_master()
        OR public.is_master_or_dev()
        OR public.is_assistant_of_pay_approved_master()
        OR public.is_assistant()
      )
  )
);
