SET lock_timeout = '3s';

-- Sub-portal train, PR: sign-to-accept work orders.
--
-- The portal's Accept button captures a real signature (type or draw — the
-- same shared form contracts and lien releases use) and stamps it onto the
-- commitment row. The row stamp is the record of truth (lien-release
-- precedent); the drawn PNG in storage is the audit copy. This pass also
-- captures signer IP + user agent, which contracts/estimates record and the
-- lien lane skipped.
--
-- offer_scope_snapshot freezes what the office offered — what the sub signs
-- is exactly those lines at that price, performed under their Master
-- Subcontract Agreement (§1 Work Order). offer_expires_at lets stale offers
-- lapse quietly.
--
-- Transitions still run through the existing status machine
-- (offered → accepted / declined via respond_to_work_order for signed-in
-- subs, or the service-role sub-portal path which writes the signature in
-- the same transaction).

ALTER TABLE public.step_commitments ADD COLUMN IF NOT EXISTS offer_scope_snapshot jsonb;
ALTER TABLE public.step_commitments ADD COLUMN IF NOT EXISTS offer_expires_at date;
ALTER TABLE public.step_commitments ADD COLUMN IF NOT EXISTS signed_at timestamptz;
ALTER TABLE public.step_commitments ADD COLUMN IF NOT EXISTS signer_printed_name text;
ALTER TABLE public.step_commitments ADD COLUMN IF NOT EXISTS signer_signature_mode text
  CHECK (signer_signature_mode IN ('type', 'draw'));
ALTER TABLE public.step_commitments ADD COLUMN IF NOT EXISTS signer_signature_storage_path text;
ALTER TABLE public.step_commitments ADD COLUMN IF NOT EXISTS signer_consented_at timestamptz;
ALTER TABLE public.step_commitments ADD COLUMN IF NOT EXISTS signer_ip text;
ALTER TABLE public.step_commitments ADD COLUMN IF NOT EXISTS signer_user_agent text;

COMMENT ON COLUMN public.step_commitments.offer_scope_snapshot IS
  'Frozen at offer time: {lines: [{label, amount}], startsLabel} — what the sub signs is exactly this scope at this price. Never edited after offering; re-price = cancel + new offer.';
COMMENT ON COLUMN public.step_commitments.offer_expires_at IS
  'Offers lapse after this date: hidden from the sub portal and no longer signable.';
COMMENT ON COLUMN public.step_commitments.signed_at IS
  'When the sub signed to accept (portal sign-to-accept). accepted_at stays the business timestamp; signed_at + signer_* are the signature record of truth.';
COMMENT ON COLUMN public.step_commitments.signer_signature_storage_path IS
  'Best-effort audit copy of a drawn signature: contract-signer-signatures bucket, commitments/<commitment_id>/<uuid>.png.';
