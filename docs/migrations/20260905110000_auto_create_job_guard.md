# 20260905110000_auto_create_job_guard

**Auto-create-job guard (v2.2838)** — `CREATE OR REPLACE` of `auto_create_job_from_signed_estimate(uuid)`. Same signature, same `uuid` return, same service-role-only grants.

## What it does

The v2.2743 function deduped a signed estimate against existing jobs only through `jobs_ledger.bid_id` (null on every job in prod) and never read `estimates.doc_kind`. It now:

1. **Raises for a change order** (`doc_kind = 'change_order'`, `ERRCODE check_violation`) — a CO is applied to a job by the office (`apply_estimate_to_job`), never created as one. The `job_ledger_id` short-circuit still runs first, so an already-applied CO returns its job.
2. Keeps the same-bid link (unchanged).
3. **Raises for a hand-typed twin** (`ERRCODE unique_violation`, message names the J#): a `jobs_ledger` row with `customer_id` or `gc_customer_id` = the estimate's customer, `lower(regexp_replace(btrim(job_name), '\s+', ' ', 'g'))` equal to the folded title, `|round(revenue*100) − total_cents| ≤ greatest(100, 1% of total)`, `created_at ≥ now() − 90 days`. Newest match wins.
4. On a real create, inserts `job_activity_events` (`job_auto_created_from_estimate`, actor = the estimate's master, `detail.source_id` = estimate id, `financial = false`) inside a best-effort block.

The primary decision runs in the edge function through `supabase/functions/_shared/autoCreateJobGuard.ts` (same rules, tested); this function is the safety net on the only path that writes.

## Order

Any time after `20260904020000_signed_agreements_stream`. Independent of the edge deploy: an older `signedAgreementNotify.ts` that hits a raise just logs it and the letter offers "Create the job". Scans `jobs_ledger` by customer within 90 days — the customer_id index covers it; no new index.

## Rollback

Re-run the `auto_create_job_from_signed_estimate` body from `20260904020000_signed_agreements_stream.sql`. Existing `job_activity_events` rows can stay (the ledger renders any `event_type` by its summary).
