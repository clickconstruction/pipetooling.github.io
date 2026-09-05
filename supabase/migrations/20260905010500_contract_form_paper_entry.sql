SET lock_timeout = '3s';

-- Contract Forms PR 6 (v2.2801): "Enter from paper". A staff member keys a
-- sub's handwritten form into the same boxes, attaches the scan, and files it
-- as signed on paper. The row already had form_source ('portal' | 'paper');
-- this adds where the scan lives and who keyed it. Idempotent and additive.

ALTER TABLE public.person_contract_documents
  ADD COLUMN IF NOT EXISTS form_scan_storage_path text;

ALTER TABLE public.person_contract_documents
  ADD COLUMN IF NOT EXISTS form_keyed_by_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.person_contract_documents.form_scan_storage_path IS
  'Enter from paper: the scan / photo of the paper form the answers were keyed from, in the private contract-form-pdfs bucket (<doc id>/source.<ext>). The signature stays on the scan; the flattened PDF is built from the keyed answers.';
COMMENT ON COLUMN public.person_contract_documents.form_keyed_by_user_id IS
  'Enter from paper: the staff member who typed the answers (form_source = paper). NULL for portal signings.';
