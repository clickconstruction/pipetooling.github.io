# 20261008091000_labor_rows_unmatched_one_per_fixture.sql (2026-10-07, v2.4903)

One set-aside labor row per fixture on a cost estimate: the database's guard against the race PR 0b (`20261008071000`) shipped with. Four Labor syncs started by one version switch each set the same rows aside on ZZ Test, the only estimate touched (12 rows, 3 fixtures × 4).

1. **Dedupe**: of each `(cost_estimate_id, fixture)` the oldest row (`parked_at`, then `id`) stays and the rest are deleted. On prod that is ZZ Test's nine copies, each identical to the row kept; the delete archive and the bid's ledger keep them.
2. **`cost_estimate_labor_rows_unmatched_estimate_fixture_key`**: `UNIQUE (cost_estimate_id, fixture)`, the live table's own key (`cost_estimate_labor_rows_cost_estimate_id_fixture_key`, baseline). The exact name, not the sync's loose key: a set-aside row only ever comes from a live row, which is already one per name, while seven estimates on prod carry two live names on one loose key.

Idempotent (the delete finds nothing the second time, `CREATE UNIQUE INDEX IF NOT EXISTS`); `SET lock_timeout = '3s'`; the index build locks only the set-aside table, which holds a handful of rows. No new table, so no fence footers.

Apply order: either. The client of the same PR never writes a second copy (one sync at a time, claim by delete); the index refuses one whatever a client does. A refused copy leaves its live row deleted, as before PR 0b (the ledger keeps it). That only happens when a set-aside row of the name already exists, and that row keeps its hours.

Test: `npm run test:pg:bid-changes` case 5c refuses a second set-aside row of one fixture (runs on GitHub in `sql-beds.yml`). On a scratch Postgres 15: twelve rows (4 × 3) became three, the oldest of each, the file applied twice, and a second copy was refused by the index.
