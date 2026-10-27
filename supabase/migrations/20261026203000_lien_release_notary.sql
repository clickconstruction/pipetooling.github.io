SET lock_timeout = '3s';

-- Print for a notary (v2.5925, the owner's ask on the Sign by his code canvas): a fourth way to
-- sign a lien waiver. The window prints the page with a Texas jurat block, the release holds at
-- status 'out_for_notary', and when the signed, stamped copy comes back the office pastes its
-- Google Drive link — the row goes 'signed' in mode 'notary_paper' and the link rides on the record
-- and in the send email. Two additive columns, and the table's two CHECKs (v2.2616) widened to the
-- new status and mode: without them the hold and the signature each failed the row's check.

ALTER TABLE public.job_lien_releases ADD COLUMN IF NOT EXISTS notary_printed_at timestamptz NULL;
ALTER TABLE public.job_lien_releases ADD COLUMN IF NOT EXISTS notary_copy_url text NULL;

ALTER TABLE public.job_lien_releases DROP CONSTRAINT IF EXISTS job_lien_releases_status_check;
ALTER TABLE public.job_lien_releases
  ADD CONSTRAINT job_lien_releases_status_check CHECK (status IN ('draft', 'issued', 'awaiting_signature', 'out_for_notary', 'signed'));
ALTER TABLE public.job_lien_releases DROP CONSTRAINT IF EXISTS job_lien_releases_signature_mode_check;
ALTER TABLE public.job_lien_releases
  ADD CONSTRAINT job_lien_releases_signature_mode_check CHECK (signer_signature_mode IS NULL OR signer_signature_mode IN ('type', 'draw', 'code', 'notary_paper'));

COMMENT ON COLUMN public.job_lien_releases.status IS
  'draft (autosaved, editable) → issued (snapshot locked/minted) → awaiting_signature or out_for_notary (v2.5925: printed with the jurat block, out for ink and a stamp) → signed. sent is orthogonal (sent_to_customer_at); voided_at is orthogonal.';
COMMENT ON COLUMN public.job_lien_releases.signer_signature_mode IS
  'Release of Lien signing: type = the signer placed his name in cursive under his own sign-in; draw = he drew it on the pad (his own screen or a present leader on another''s). Code (v2.5924): he typed his own signing code on the signed-in user''s screen (signed_on_device_of), and sign_lien_release_with_code checked it. Notary paper (v2.5925): he signed the printed page in ink before a notary; notary_copy_url links the stamped copy.';

COMMENT ON COLUMN public.job_lien_releases.notary_printed_at IS
  'Print for a notary (v2.5925): when the jurat page was printed; the row then holds at status out_for_notary until the signed copy''s link is saved or the office steps back to issued.';
COMMENT ON COLUMN public.job_lien_releases.notary_copy_url IS
  'Print for a notary (v2.5925): the Google Drive link of the signed, notarized copy the office brought back. Saving it stamps the row signed in mode notary_paper; the link prints in the Signature Record and rides in the send email.';
