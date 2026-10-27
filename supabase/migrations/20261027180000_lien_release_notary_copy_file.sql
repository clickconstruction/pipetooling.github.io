SET lock_timeout = '3s';

-- The notarized PDF itself on the record (v2.5985, phase 0 of the online-notary study the owner approved on
-- 2026-10-27). Print for a notary (v2.5925) filed the signed, stamped copy only as a Google Drive link. An online
-- notary's session (BlueNotary, Proof) ends with a sealed, tamper-evident PDF, and a paper notary's scan is a PDF too:
-- the Release of Lien window now stores that file in the private lien-release-documents bucket under the release's
-- own folder, and Send it attaches it. One additive column and one CHECK: the path names a PDF directly in the
-- release's own folder, and only a release signed before a notary carries one. No storage change: the bucket's insert
-- and select policies (out of band, docs/migrations/20260902001517_lien_release_signing_foundation.md) already admit
-- the office under <release_id>/, and each file is a new object, never an overwrite.

ALTER TABLE public.job_lien_releases ADD COLUMN IF NOT EXISTS notary_copy_path text NULL;

ALTER TABLE public.job_lien_releases DROP CONSTRAINT IF EXISTS job_lien_releases_notary_copy_path_check;
ALTER TABLE public.job_lien_releases
  ADD CONSTRAINT job_lien_releases_notary_copy_path_check CHECK (
    notary_copy_path IS NULL
    OR (signer_signature_mode = 'notary_paper' AND notary_copy_path ~ ('^' || id::text || '/[A-Za-z0-9._-]+\.pdf$'))
  );

COMMENT ON COLUMN public.job_lien_releases.notary_copy_path IS
  'Print for a notary (v2.5985): the notarized PDF itself — an online notary''s sealed file or the scan of the stamped paper — at <release_id>/notary-copy-<ms>.pdf in the private lien-release-documents bucket. Attaching it stamps an out_for_notary row signed in mode notary_paper (or files it on a row already signed that way by link); Send it attaches this file in place of the rebuilt page, and Download PDF hands it over. Only a notary_paper row carries one (job_lien_releases_notary_copy_path_check).';
COMMENT ON COLUMN public.job_lien_releases.notary_copy_url IS
  'Print for a notary (v2.5925): the Google Drive link of the signed, notarized copy the office brought back. Saving it stamps the row signed in mode notary_paper; the link prints in the Signature Record and rides in the send email, unless notary_copy_path holds the PDF itself (v2.5985), which the email attaches instead.';
