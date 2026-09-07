# 20260907070000_one_company_drop_retired_grant_tables.sql (2026-09-07, v2.2999)

One company, **Phase 5c** of [`docs/ONE_COMPANY_PLAN.md`](../ONE_COMPANY_PLAN.md): `DROP TABLE IF EXISTS public.retired_master_assistants; DROP TABLE IF EXISTS public.retired_master_shares;` — no `CASCADE`, so a surviving dependency would fail the push rather than take anything with it.

**First push failed as designed** (2026-09-07 06:40 UTC): four policies still depended on the retired tables — the three `customer_addresses` policies, created by **dynamic SQL** in `20260817224600` and therefore invisible to the file-based census behind `20260907050000`'s re-bind, plus `retired_master_shares`' own reader policy. The file was rewritten before it was ever applied (no ledger row): step 1 is now a `pg_depend` loop that re-creates, with `retired_` stripped from `pg_get_expr`'s text, every policy on another table that still binds to either retired table (same technique as `20260906010000`'s role sweep); step 2 drops shares first, then assistants, still without `CASCADE`.

Lesson recorded in the plan doc: ten migrations create policies with `EXECUTE format('CREATE POLICY …')` inside DO blocks; a census that parses migration files misses them — ask `pg_policies` / `pg_depend` when the question is "what is live". `database.ts` loses the two `retired_*` entries on the next regeneration.

**The rows, for the record** (the adoption/sharing history the views replaced by rule):

`retired_master_assistants` (11)

| adopted on | master | adopted |
|---|---|---|
| 2026-01-26 | Malachi | Taunya (assistant) |
| 2026-02-19 | Malachi | Wendi (estimator) |
| 2026-02-19 | Malachi | William (estimator) |
| 2026-07-22 | test (dev) | Taunya, Grace (assistants) |
| 2026-07-22 | Robert (dev) | Taunya, Grace (assistants) |
| 2026-07-22 | Malachi | Grace (assistant) |
| 2026-08-09 | test (dev), Malachi, Robert (dev) | Roxi (assistant) |

`retired_master_shares` (7)

| shared on | sharing | viewing |
|---|---|---|
| 2026-02-16 | Robert (dev) | Trace (primary), Malachi |
| 2026-07-22 | test (dev) | Robert, Malachi |
| 2026-07-22 | Robert (dev) | test (dev) |
| 2026-07-22 | Malachi | test (dev), Robert |

The 2026-07-22 and 2026-08-09 rows are the v2.921 sync's; the three 2026 winter rows are the hand-made adoptions (now granted by the views' rule, estimators included); Robert → Trace was the one share outside the rule (dead after the Phase 4 backfill).
