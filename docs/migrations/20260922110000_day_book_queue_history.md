# 20260922110000_day_book_queue_history.sql (2026-09-22, v2.3714)

**Purpose**: Day book PR 7 — history carries what was still waiting, and the population follows the roster rule.

**Changes** — `CREATE OR REPLACE FUNCTION public.get_day_book_payload(date, date, uuid)`, the body of `20260917003402_day_book_payload.sql` with two changes:
1. The `people` CTE leaves out `is_sample`, `is_digital_twin` and `archived_at IS NOT NULL` users (the People spine's roster rule, v2.3698).
2. A `queue` key on the result: `[{ day, kind, n }]` for every day of the range up to today (company calendar), `kind = 'approvals'`, `n` = clock sessions clocked out before that day's end and not yet approved, rejected or revoked by then — reconstructed from `clocked_out_at` / `approved_at` / `rejected_at` / `revoked_at`. No table, no cron; true for days before the migration.

**Not reconstructed** (stay live-today-only on the tab): bills to send (an invoice's "ready" moment is not stamped), deposits to match (the count RPC applies a settings filter for a signed-in caller), jobs without a contract (a client kernel). A nightly snapshot for those would have to run as a named account — an owner call, recorded in `to-dos/day-book/README.md`.

**Idempotent**: `CREATE OR REPLACE`; grants unchanged. Additive: an older client ignores `queue`.
