# 20261027180000_lien_release_notary_copy_file

The notarized PDF itself on the record (v2.5985, phase 0 of the online-notary study): one additive,
idempotent column on `job_lien_releases` — `notary_copy_path`, the PDF the office brings back from a
notary (an online notary's sealed file, or the scan of the stamped paper), stored at
`<release_id>/notary-copy-<ms>.pdf` in the private `lien-release-documents` bucket. Attaching it in the
Release of Lien window stamps an `out_for_notary` row `signed` in mode `notary_paper`, as saving the
Drive link (`notary_copy_url`, v2.5925) does, or files it on a row already signed that way by link.
**Send it** attaches the stored file in place of the rebuilt page and drops the link line; **Download
PDF** hands it over.

`job_lien_releases_notary_copy_path_check` holds the path to a PDF directly in the release's own folder
(`^<id>/[A-Za-z0-9._-]+\.pdf$`) and to a row signed in mode `notary_paper`; every existing row has a
NULL path, so it validates at once.

**Storage: nothing to run.** The bucket's out-of-band policies
(`docs/migrations/20260902001517_lien_release_signing_foundation.md`) already admit dev and
assistant/controller anywhere and the job's master under `<release_id>/`; it already allows
`application/pdf`, up to 5 MB. The window caps the file at 4 MB so it always fits the send email, and
names a new object each time (no update policy, so never an upsert).

The `lien-release-sign` SQL bed's `26_notary_file.sql` files the PDF through the office's own policies
on a held waiver and on one already signed by link, refuses a stranger and every path the CHECK holds
out, and plays the upload against the documented storage policies.

Verify after the push: `select pg_get_constraintdef(oid) from pg_constraint where conname =
'job_lien_releases_notary_copy_path_check';` returns the CHECK, and a REST column probe
`/rest/v1/job_lien_releases?select=notary_copy_path&limit=0` answers 200.

Rollback: `ALTER TABLE public.job_lien_releases DROP CONSTRAINT IF EXISTS
job_lien_releases_notary_copy_path_check, DROP COLUMN IF EXISTS notary_copy_path;` — a row signed by
its file keeps its signature stamps, and its PDF stays in the bucket.
