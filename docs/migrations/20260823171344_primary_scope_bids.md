# 20260823171344_primary_scope_bids.sql (2026-08-23, v2.2174)

**Purpose:** primary scoping, part 1 of 3 — a `primary` sees only the **bids** they are
the estimator, the account manager, or the creator of (owner rule 2026-08-23; D3 = creating
counts).

**Mechanism:** RESTRICTIVE policies named `primary_scope_<table>` (FOR ALL, USING + WITH
CHECK) on `bids` and the bids family (`bids_count_rows`, `bids_gc_builders`, takeoff
lines/mappings, tally/materials mirrors, `bids_submission_entries`, `bid_versions`,
`bid_version_sends`, pricing assignments/package sends, payment-schedule rows, count-row
custom prices/hides, `bid_gc_recipients`, `price_book_versions`, `cost_estimates`, and
the six `cost_estimate_*_rows`). Each reads
`NOT (SELECT is_primary()) OR primary_can_access_bid(bid_id)` — a no-op for every other
role, so the existing permissive policies are untouched. Tables are created via a
`DO` loop that skips any name without the expected FK column (RAISE NOTICE).

**Helpers (new, SECURITY DEFINER, EXECUTE → authenticated):** `is_primary()`,
`primary_can_access_bid(uuid)` (estimator/AM/creator), `primary_can_access_job(uuid)`
(`jobs_ledger.account_manager_user_id`), `primary_can_access_estimate(uuid)` (creator or
AM on its job). Parts 2 and 3 reuse them.

**Safety:** no table DDL; idempotent (DROP POLICY IF EXISTS + CREATE; CREATE OR REPLACE
functions). Rollback = drop the `primary_scope_*` policies. Deploy order free — the client
change in v2.2174 is a matching board filter, not a dependency.
