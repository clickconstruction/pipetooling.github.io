# 20261026203000_lien_release_notary

Print for a notary (v2.5925): two additive, idempotent columns on `job_lien_releases` —
`notary_printed_at` (when the jurat page printed; the row then holds at status `out_for_notary`)
and `notary_copy_url` (the Google Drive link of the signed, stamped copy; saving it stamps the row
`signed` in mode `notary_paper`). The table's two CHECKs from the foundation migration
(`20260902001517`, v2.2616) are dropped and made again wider: `job_lien_releases_status_check`
admits `out_for_notary`, and `job_lien_releases_signature_mode_check` admits `notary_paper` beside
`type`, `draw` and v2.5924's `code`. Without them the hold and the signature each failed the row's
check. Lifecycle rules live in `src/lib/jobs/lienReleaseLifecycle.ts`.

The `lien-release-sign` SQL bed's `25_notary.sql` prints a waiver for a notary through the office's
own policies, files the stamped copy's link, and steps one back.

Verify after the push: `select conname, pg_get_constraintdef(oid) from pg_constraint where conname
in ('job_lien_releases_status_check', 'job_lien_releases_signature_mode_check');` carries
`out_for_notary` and `notary_paper`.

Rollback: `ALTER TABLE public.job_lien_releases DROP COLUMN IF EXISTS notary_printed_at, DROP
COLUMN IF EXISTS notary_copy_url;` — rows signed by notary keep their signature stamps either way,
so the wider CHECKs stay.

**Applied** to prod by 2026-10-28: `npm run check:migration-drift` read 994 local files and 994 remote versions, fully applied (read in the docs pass after #6245); types regenerated in #6312.
