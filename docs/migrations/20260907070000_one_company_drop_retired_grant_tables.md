# 20260907070000_one_company_drop_retired_grant_tables.sql (2026-09-07, v2.2999)

One company, **Phase 5c** of [`docs/ONE_COMPANY_PLAN.md`](../ONE_COMPANY_PLAN.md): `DROP TABLE IF EXISTS public.retired_master_assistants; DROP TABLE IF EXISTS public.retired_master_shares;` — no `CASCADE`, so a surviving dependency would fail the push rather than take anything with it.

Nothing named the pair after `20260907050000` (views under the old names, 84 policies re-bound) and `20260907060000` (opaque view columns): no policy, function, view, foreign key or client code. `database.ts` loses the two `retired_*` entries on the next regeneration.

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
