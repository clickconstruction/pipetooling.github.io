# 20261029150000_requests_development_reference.sql (2026-10-29, v2.6047)

A question about a development (punch list #208 PR 4, [v2.6047](../recent-features/v2.6047.md)).

1. **`development_id`** on `estimator_requests` and `dispatch_requests` (`REFERENCES developments ON DELETE SET NULL`), a partial index each, and the check **`<table>_one_reference`**: at most one of `bid_id`, `job_ledger_id`, `development_id`, added `NOT VALID` so the rows already there are not re-read (a request written from here on carries one reference).
2. **The widened read**: both `_select` policies are dropped and re-created with one more branch, `gc_office_team()` on a request that carries a reference, so the office and the estimators read the questions on a bid, a job or a site; the asker's own, the dev's and the lane's group's reads are unchanged. The INSERT and UPDATE policies are untouched (the asker writes their own; the lane's group answers).

Locks: two `ADD COLUMN` with no default (ACCESS EXCLUSIVE for an instant), two partial indexes, two `NOT VALID` checks (a short lock, no scan); `SET lock_timeout = '3s'` first. Idempotent. No table, no fences.

## Order

After PR 3. Merge, `supabase db push`, then the types chore. The page writes `development_id` only once the column exists, so deploy and push together.
