# 20261026203000_lien_release_notary

Print for a notary (v2.5925): two additive, idempotent columns on `job_lien_releases` —
`notary_printed_at` (when the jurat page printed; the row then holds at the kernel-named status
`out_for_notary`) and `notary_copy_url` (the Google Drive link of the signed, stamped copy;
saving it stamps the row `signed` in mode `notary_paper`). The table has no status or mode CHECK,
so no constraint changes; lifecycle rules live in `src/lib/jobs/lienReleaseLifecycle.ts`.

Rollback: `ALTER TABLE public.job_lien_releases DROP COLUMN IF EXISTS notary_printed_at, DROP
COLUMN IF EXISTS notary_copy_url;` — rows signed by notary keep their signature stamps either way.
