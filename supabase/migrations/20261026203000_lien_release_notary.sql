SET lock_timeout = '3s';

-- Print for a notary (v2.5925, the owner's ask on the Sign by his code canvas): a fourth way to
-- sign a lien waiver. The window prints the page with a Texas jurat block, the release holds at
-- status 'out_for_notary' (no CHECK constrains status on this table; the kernel names the value),
-- and when the signed, stamped copy comes back the office pastes its Google Drive link — the row
-- goes 'signed' in mode 'notary_paper' and the link rides on the record and in the send email.
-- Two additive columns; everything else is client and kernel.

ALTER TABLE public.job_lien_releases ADD COLUMN IF NOT EXISTS notary_printed_at timestamptz NULL;
ALTER TABLE public.job_lien_releases ADD COLUMN IF NOT EXISTS notary_copy_url text NULL;

COMMENT ON COLUMN public.job_lien_releases.notary_printed_at IS
  'Print for a notary (v2.5925): when the jurat page was printed; the row then holds at status out_for_notary until the signed copy''s link is saved or the office steps back to issued.';
COMMENT ON COLUMN public.job_lien_releases.notary_copy_url IS
  'Print for a notary (v2.5925): the Google Drive link of the signed, notarized copy the office brought back. Saving it stamps the row signed in mode notary_paper; the link prints in the Signature Record and rides in the send email.';
