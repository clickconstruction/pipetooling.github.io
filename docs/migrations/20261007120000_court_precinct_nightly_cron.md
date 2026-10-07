# 20261007120000_court_precinct_nightly_cron.sql (2026-10-07, v2.4770)

Which court, step 4 ([v2.4770](../recent-features/v2.4770.md)): the nightly precinct classification.

1. `cron.schedule('court-precinct-nightly', '20 6 * * *', …)`: a `net.http_post` to `/functions/v1/court-precinct-nightly` with `X-Cron-Secret`, the vault's `PROJECT_URL` and `CRON_SECRET`, the shape of `lien-pay-offer-nightly` (20261007020000). Unscheduled first, so a re-push is one job.

No table change; no locks beyond the cron catalog. Idempotent.

## Order

After `20261007110000_court_areas` (the table it reads). Push, then `supabase functions deploy court-precinct-nightly`.
